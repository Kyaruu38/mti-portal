// Label Inventory Tracker — stock, buy/don't-buy lists, upload history.
//
// The Excel workbook stays the source of truth (owner's decision): every number
// shown here comes from the sheet unchanged. The portal ALSO recomputes each
// derived column and flags disagreements — see parsers/labelStock.js. It never
// substitutes its own figure.
//
// Tab names deliberately mirror the workbook (Master Tracker / BUY NOW / DO NOT
// BUY) so nobody has to learn a second vocabulary for the same job.
import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit } from '../core/store.js';
import { card, badge, btn, icon, dropzone, modal, searchInput, selectEl } from '../ui/components.js';
import { num, money, fmtDate, fmtDateTime } from '../core/format.js';
import { readWorkbook, writeWorkbook } from '../core/xlsx.js';
import { parseLabelStockSheet, STATUSES, guessErp } from '../parsers/labelStock.js';
import { labelOrders, erpCandidates } from '../core/labelOrders.js';
import { applyLabelStockUpload, fetchLabelStock, fetchLabelUploads, setLabelStockErp } from '../core/labelStockApi.js';
import { isConfigured } from '../core/supabase.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';

const TONE = { 'BUY NOW': 'red', 'SUFFICIENT': 'green', 'OVERSTOCK': 'amber', 'IDLE STOCK': 'gray' };

export function labelStockScreen() {
  const st = getState(); const ui = st.ui;
  const tab = ui.lsTab || 'master';
  const rows = st.labelStock || [];

  const unmatched = rows.filter(r => !r.erp).length;
  const ord = labelOrders(st, st.labelSettings, new Date());
  const tabs = [
    ['master', `Master Tracker · ${rows.length}`],
    ['buy', `BUY NOW · ${rows.filter(r => r.status === 'BUY NOW').length}`],
    ['nobuy', `DO NOT BUY · ${rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK').length}`],
    ['orders', `Order Tracking · ${ord.summary.open} open`],
    ['match', unmatched ? `Cocokkan ERP · ${unmatched} belum` : 'Cocokkan ERP ✓'],
    ['uploads', 'Riwayat Upload'],
  ];
  const tabBar = h('div.row.gap8.wrap', tabs.map(([id, label]) =>
    h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ lsTab: id }) }, label)));

  let body;
  if (tab === 'buy') body = listTab(st, r => r.status === 'BUY NOW', 'BUY NOW', 'Stok di bawah kebutuhan — perlu order.');
  else if (tab === 'nobuy') body = listTab(st, r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK', 'DO NOT BUY', 'Stok berlebih atau tidak terpakai — jangan order, habiskan dulu.');
  else if (tab === 'orders') body = ordersTab(st, ord);
  else if (tab === 'match') body = matchTab(st);
  else if (tab === 'uploads') body = uploadsTab(st);
  else body = masterTab(st);

  return h('div.stack', [
    dashboardCards(st),
    uploadCard(st),
    tabBar,
    body,
    ui.lsPreview ? previewModal(st) : null,
  ]);
}

// ---------------------------------------------------------------------------
// Dashboard — mirrors the workbook's Dashboard sheet.
// ---------------------------------------------------------------------------
function dashboardCards(st) {
  const rows = st.labelStock || [];
  if (!rows.length) return null;
  const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const totStock = sum('stock');
  const totReq = sum('requirement');
  const cnt = s => rows.filter(r => r.status === s).length;
  const mismatch = rows.filter(r => r.hasMismatch).length;
  const missing = rows.filter(r => r.missing).length;

  const tile = (label, value, sub, tone) => h('div.card', { style: { padding: '13px 16px', flex: '1', minWidth: '150px' } }, [
    h('div', { style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em' } }, label),
    h('div.mono', { style: { fontSize: '19px', fontWeight: 800, marginTop: '4px', color: tone ? `var(--st-${tone}-tx)` : 'var(--text)' } }, value),
    sub ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' } }, sub) : null,
  ]);

  return h('div.stack', { style: { gap: '10px' } }, [
    h('div.row.gap8.wrap', [
      tile('TOTAL STOK LABEL', num(totStock), `${rows.length} SKU`),
      tile('TOTAL KEBUTUHAN', num(totReq), 'termasuk buffer'),
      tile('HARUS BELI', String(cnt('BUY NOW')), 'stok di bawah kebutuhan', 'red'),
      tile('BERLEBIH', String(cnt('OVERSTOCK')), 'stok ≥ 2× kebutuhan', 'amber'),
      tile('NGANGGUR', String(cnt('IDLE STOCK')), 'tidak ada rencana produksi', 'gray'),
    ]),
    // Two things the workbook can't tell you, so they get top billing.
    (mismatch || missing) ? h('div.row.gap8.wrap', [
      mismatch ? h('div.cfg-banner', { style: { flex: 1, background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } },
        [icon('warn', 14), ` ${mismatch} baris angkanya beda dari hasil hitung ulang — cek rumus di Excel`]) : null,
      missing ? h('div.cfg-banner', { style: { flex: 1 } },
        [icon('warn', 14), ` ${missing} SKU tidak muncul di upload terakhir — belum dihapus, cuma ditandai`]) : null,
    ]) : null,
  ]);
}

// ---------------------------------------------------------------------------
// Upload. Parse -> PREVIEW THE DIFF -> apply. The preview is the whole point:
// a mis-picked sheet must be catchable before it overwrites 984 rows, which is
// exactly what Excel cannot offer.
// ---------------------------------------------------------------------------
function uploadCard(st) {
  const ui = st.ui;
  if (!can(st.user.role, 'labelStockWrite')) return null;
  const dz = dropzone({
    title: 'Upload Label Inventory Tracker (.xlsx)',
    sub: 'Sheet "Master Tracker" · isi tetap dari Excel, portal cuma nyimpen & ngecek',
    accept: '.xlsx,.xls', iconName: 'upload', compact: true,
    onFiles: f => handleFile(f[0]),
  });
  return card([h('div.card-pad', [
    dz,
    ui.lsSheets ? h('div.row.gap8.wrap', { style: { marginTop: '12px', alignItems: 'flex-end' } }, [
      h('div', [
        h('div.field-label', 'Pilih sheet'),
        selectEl(ui.lsSheets.map(s => ({ value: s.name, label: `${s.name} (${s.count} baris)` })),
          { value: ui.lsSheet, onChange: v => setUI({ lsSheet: v }) }),
      ]),
      btn('Baca sheet ini →', { variant: 'primary', onClick: () => parseSheet() }),
      btn('Batal', { onClick: () => setUI({ lsSheets: null, lsWb: null, lsSheet: null, lsFile: null }) }),
    ]) : null,
  ])]);
}

async function handleFile(file) {
  if (blockWrite('upload file stok label')) return;
  if (!file) return;
  toast('Membaca file…');
  try {
    const wb = await readWorkbook(file);
    const sheets = wb.sheetNames.map(n => ({ name: n, count: wb.countRows(n) }));
    // Prefer the sheet the tracker actually keeps its data in.
    const pref = sheets.find(s => /master\s*tracker/i.test(s.name)) || sheets[0];
    setUI({ lsWb: wb, lsSheets: sheets, lsSheet: (pref || {}).name, lsFile: file.name });
  } catch (e) {
    console.error(e); toast('Gagal membaca Excel: ' + (e.message || e));
  }
}

function parseSheet() {
  const st = getState(); const ui = st.ui;
  if (!ui.lsWb || !ui.lsSheet) { toast('Pilih sheet dulu'); return; }
  let res;
  try {
    res = parseLabelStockSheet(ui.lsWb.rows(ui.lsSheet), {
      moq: (st.labelSettings || {}).moq || 500,
      overstockMultiple: (st.labelSettings || {}).overstockMultiple || 2,
      items: st.items || [],
    });
  } catch (e) { console.error(e); toast('Parse gagal: ' + (e.message || e)); return; }
  if (!res.ok) { toast(res.error); return; }
  setUI({ lsPreview: { res, diff: buildDiff(st.labelStock || [], res.items), fileName: ui.lsFile, sheetName: ui.lsSheet } });
}

// What actually changes if this upload is applied. Compared by (spec, market).
function buildDiff(current, incoming) {
  const key = r => `${String(r.spec).trim().toUpperCase()}||${String(r.market || '').trim().toUpperCase()}`;
  const cur = new Map(current.map(r => [key(r), r]));
  const inc = new Map(incoming.map(r => [key(r), r]));
  const up = [], down = [], same = [], added = [];
  for (const [k, r] of inc) {
    const before = cur.get(k);
    if (!before) { added.push(r); continue; }
    const d = r.stock - before.stock;
    if (d > 0) up.push({ r, before, d });
    else if (d < 0) down.push({ r, before, d });
    else same.push(r);
  }
  const missing = [...cur.entries()].filter(([k]) => !inc.has(k)).map(([, r]) => r);
  return { up, down, same, added, missing };
}

function previewModal(st) {
  const { res, diff, fileName, sheetName } = st.ui.lsPreview;
  const first = !(st.labelStock || []).length;

  const stat = (label, n, tone) => h('div.row.gap8', { style: { justifyContent: 'space-between' } }, [
    h('span', { style: { fontSize: '12px' } }, label),
    h('span.mono', { style: { fontWeight: 700, color: tone ? `var(--st-${tone}-tx)` : 'var(--text)' } }, num(n)),
  ]);

  return modal({
    title: 'Cek dulu sebelum disimpan', subtitle: `${fileName} · sheet "${sheetName}"`, width: 680,
    onClose: () => setUI({ lsPreview: null }),
    body: [
      h('div.grid.g2', [
        card([h('div.card-pad', [
          h('div.card-title', { style: { marginBottom: '8px' } }, 'Isi file'),
          stat('Baris dibaca', res.stats.total),
          stat('Akan masuk', res.stats.imported, 'green'),
          stat('Dikarantina (dobel)', res.stats.duplicated, res.stats.duplicated ? 'red' : null),
          stat('Rumus tidak cocok', res.stats.mismatched, res.stats.mismatched ? 'amber' : null),
        ])]),
        card([h('div.card-pad', [
          h('div.card-title', { style: { marginBottom: '8px' } }, first ? 'Upload pertama' : 'Perubahan vs data sekarang'),
          first
            ? h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, 'Belum ada data sebelumnya — semua baris masuk sebagai baru.')
            : h('div.stack', { style: { gap: '3px' } }, [
                stat('Stok naik', diff.up.length, 'green'),
                stat('Stok turun', diff.down.length, 'amber'),
                stat('Tidak berubah', diff.same.length),
                stat('SKU baru', diff.added.length, 'blue'),
                stat('Tidak ada di file ini', diff.missing.length, diff.missing.length ? 'red' : null),
              ]),
        ])]),
      ]),

      // The one thing that must never pass silently.
      diff.missing.length && !first
        ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
            h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ` ${diff.missing.length} SKU yang ada sekarang TIDAK ada di file ini`]),
            h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, 'Mereka tidak akan dihapus — cuma ditandai. Kalau angkanya kelihatan aneh (misal ratusan), kemungkinan salah pilih sheet.'),
            ...diff.missing.slice(0, 5).map(r => h('div.mono', { style: { fontSize: '10px' } }, `• ${r.spec} ${r.market}`)),
            diff.missing.length > 5 ? h('div', { style: { fontSize: '10px' } }, `…dan ${diff.missing.length - 5} lagi`) : null,
          ])
        : null,

      res.duplicates.length ? duplicateBlock(res.duplicates) : null,
      res.stats.mismatched ? mismatchBlock(res.mismatches) : null,

      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
        'Angka yang disimpan diambil apa adanya dari Excel. Hasil hitung ulang portal disimpan terpisah, cuma buat pembanding.'),
    ],
    footer: [
      btn('Batal', { onClick: () => setUI({ lsPreview: null }) }),
      res.duplicates.length
        ? btn(`Simpan ${num(res.stats.imported)} SKU (${res.stats.duplicated} dobel dilewati)`, { variant: 'primary', onClick: () => applyUpload() })
        : btn(`Simpan ${num(res.stats.imported)} SKU`, { variant: 'primary', onClick: () => applyUpload() }),
    ],
  });
}

function duplicateBlock(dups) {
  return h('div.cfg-banner', { style: { display: 'block' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ` ${dups.length} spec dobel — ${dups.reduce((s, d) => s + d.rows.length, 0)} baris ini TIDAK disimpan`]),
    h('div', { style: { fontSize: '10.5px', margin: '3px 0 6px' } }, 'Nomor baris di bawah = baris asli di Excel. Buka Master Tracker, Ctrl+G, ketik nomornya.'),
    ...dups.map(d => h('div', { style: { fontSize: '10.5px', marginBottom: '3px' } }, [
      h('span.mono', { style: { fontWeight: 700 } }, `baris ${d.rows.map(r => r.excelRow).join(' & ')}`),
      ` — ${d.spec} ${d.market}`,
      h('span', { style: { color: 'var(--text-3)' } }, ` · stok ${d.rows.map(r => num(r.stock)).join(' + ')} = ${num(d.combinedStock)}, kebutuhan ${num(d.requirement)}`),
    ])),
  ]);
}

function mismatchBlock(list) {
  return h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ` ${list.length} baris: angka di Excel beda dari hasil hitung ulang`]),
    h('div', { style: { fontSize: '10.5px', margin: '3px 0 6px' } }, 'Nilai dari Excel tetap dipakai. Ini cuma penanda kalau ada rumus rusak atau kolom yang ke-paste jadi angka mati.'),
    ...list.slice(0, 6).map(r => h('div.mono', { style: { fontSize: '10px' } },
      `baris ${r.excelRow}: ` + r.mismatch.map(m => `${m.field} Excel=${m.sheet} hitung=${m.calc}`).join(' · '))),
    list.length > 6 ? h('div', { style: { fontSize: '10px' } }, `…dan ${list.length - 6} lagi`) : null,
  ]);
}

async function applyUpload() {
  if (blockWrite('simpan upload stok label')) return;
  const st = getState(); const p = st.ui.lsPreview;
  if (!p) return;
  const { res, fileName, sheetName } = p;
  try {
    await applyLabelStockUpload({
      fileName, sheetName,
      weekOf: '',
      total: res.stats.total, imported: res.stats.imported,
      duplicate: res.stats.duplicated, mismatch: res.stats.mismatched,
      duplicates: res.duplicates,
    }, res.items);
  } catch (e) {
    console.error('applyLabelStockUpload failed', e);
    toast('Gagal simpan ke server: ' + (e.message || e));
    return;   // modal stays open, nothing lost
  }
  // Re-read rather than patching local state: the RPC also flags the missing
  // rows, and that flag is only knowable server-side.
  const fresh = await fetchLabelStock();
  if (fresh) getState().labelStock = fresh;
  const ups = await fetchLabelUploads();
  if (ups) getState().labelUploads = ups;

  logAudit({
    entity: 'label_stock', target: fileName || sheetName, action: 'upload',
    detail: `${res.stats.imported} SKU masuk · ${res.stats.duplicated} dobel dilewati · ${res.stats.mismatched} rumus tidak cocok`,
  });
  setUI({ lsPreview: null, lsWb: null, lsSheets: null, lsSheet: null, lsFile: null });
  toast(`${res.stats.imported} SKU tersimpan`);
  setState({});
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
function filtered(st) {
  const q = (st.ui.lsQ || '').toLowerCase();
  const f = st.ui.lsStatus || 'Semua';
  return (st.labelStock || []).filter(r =>
    (f === 'Semua' || r.status === f) &&
    (!q || `${r.spec} ${r.market} ${r.erp}`.toLowerCase().includes(q)));
}

function masterTab(st) {
  const rows = filtered(st);
  return h('div.stack', [
    h('div.row.gap8.wrap', [
      searchInput({ id: 'ls-q', placeholder: 'Cari spec / market / ERP…', value: st.ui.lsQ || '', onChange: v => setUI({ lsQ: v }) }),
      selectEl(['Semua', ...STATUSES], { value: st.ui.lsStatus || 'Semua', onChange: v => setUI({ lsStatus: v }) }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${rows.length} dari ${(st.labelStock || []).length} SKU`),
      h('div.mla.row.gap8', [
        isConfigured() ? btn('Refresh dari server', { sm: true, iconName: 'clock', onClick: () => refreshLabelStock() }) : null,
        btn('Export Excel', { sm: true, iconName: 'download', onClick: () => exportRows(rows) }),
      ]),
    ]),
    stockTable(rows, true),
  ]);
}

function listTab(st, pred, title, sub) {
  const rows = (st.labelStock || []).filter(pred)
    .sort((a, b) => (title === 'BUY NOW' ? a.surplus - b.surplus : b.surplus - a.surplus));
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', title),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, sub),
      h('div.mla', btn('Export Excel', { sm: true, iconName: 'download', onClick: () => exportRows(rows) })),
    ]),
    stockTable(rows, false),
  ]);
}

function stockTable(rows, showAll) {
  if (!rows.length) {
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } },
      'Belum ada data. Upload file Label Inventory Tracker di atas.')]);
  }
  const head = ['Spec', 'Market', 'ERP', 'Stok', 'Rencana Produksi', 'Buffer', 'Kebutuhan', 'Surplus / (Kurang)', 'Status', 'Saran Order'];
  return h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', head.map((c, i) => h('th' + (i >= 3 && i !== 8 ? '.r' : ''), c)))),
    h('tbody', rows.slice(0, 400).map(r => h('tr', {
      style: r.missing ? { opacity: '.55' } : {},
    }, [
      h('td.cell-strong', { style: { maxWidth: '300px' } }, [
        r.spec,
        r.hasMismatch ? h('span', { style: { marginLeft: '6px' } }, badge('rumus?', 'amber')) : null,
        r.missing ? h('span', { style: { marginLeft: '6px' } }, badge('tidak di upload terakhir', 'gray')) : null,
      ]),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, r.market),
      h('td.mono', { style: { fontSize: '10.5px' } }, r.erp || h('span', { style: { color: 'var(--text-3)' } }, '—')),
      h('td.mono.r', num(r.stock)),
      h('td.mono.r', num(r.production)),
      h('td.mono.r', `${Math.round((r.buffer || 0) * 100)}%`),
      h('td.mono.r', num(r.requirement)),
      h('td.mono.r', { style: { fontWeight: 700, color: r.surplus < 0 ? 'var(--st-red-tx)' : 'var(--text)' } }, num(r.surplus)),
      h('td', badge(r.status || '—', TONE[r.status] || 'gray')),
      h('td.mono.r', { style: { fontWeight: r.suggestedQty ? 700 : 400 } }, r.suggestedQty ? num(r.suggestedQty) : '—'),
    ]))),
  ])), rows.length > 400 ? h('div', { style: { padding: '10px 16px', fontSize: '10.5px', color: 'var(--text-3)' } },
    `Menampilkan 400 dari ${num(rows.length)} baris — pakai pencarian atau filter status untuk mempersempit. Export Excel tetap berisi semuanya.`) : null);
}

function uploadsTab(st) {
  const list = st.labelUploads || [];
  if (!list.length) return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, 'Belum ada riwayat upload.')]);
  return h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', ['Waktu', 'Oleh', 'File', 'Sheet', 'Dibaca', 'Masuk', 'Dobel', 'Rumus?'].map((c, i) => h('th' + (i >= 4 ? '.r' : ''), c)))),
    h('tbody', list.map(u => h('tr', [
      h('td.mono', { style: { fontSize: '10.5px' } }, fmtDateTime(u.at)),
      h('td', u.by || '—'),
      h('td', { style: { fontSize: '11px' } }, u.fileName || '—'),
      h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, u.sheetName || '—'),
      h('td.mono.r', num(u.total)),
      h('td.mono.r', num(u.imported)),
      h('td.mono.r', { style: { color: u.duplicate ? 'var(--st-red-tx)' : 'var(--text-3)', fontWeight: u.duplicate ? 700 : 400 } }, num(u.duplicate)),
      h('td.mono.r', { style: { color: u.mismatch ? 'var(--st-amber-tx)' : 'var(--text-3)' } }, num(u.mismatch)),
    ]))),
  ])));
}

async function exportRows(rows) {
  const aoa = [
    ['Spec Name', 'Market Code', 'ERP', 'Current Label Stock', 'Planned Production', 'Planned Sales',
     'Buffer %', 'Label Requirement', 'Surplus / (Shortage)', 'Reorder Status', 'Suggested Order Qty',
     'Hitung Ulang: Requirement', 'Hitung Ulang: Surplus', 'Hitung Ulang: Status', 'Rumus Cocok?'],
    ...rows.map(r => [
      r.spec, r.market, r.erp || '', r.stock, r.production, r.sales, r.buffer,
      r.requirement, r.surplus, r.status, r.suggestedQty,
      r.calc.requirement, r.calc.surplus, r.calc.status, r.hasMismatch ? 'TIDAK COCOK' : 'ok',
    ]),
  ];
  await writeWorkbook(`label-stock-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Label Stock', aoa }]);
  toast('Export Excel diunduh');
}

// Pull fresh data — used by session login and the refresh button.
export async function refreshLabelStock() {
  if (!isConfigured()) return;
  const [rows, ups] = await Promise.all([fetchLabelStock(), fetchLabelUploads()]);
  if (rows) getState().labelStock = rows;
  if (ups) getState().labelUploads = ups;
  setState({});
}


// ---------------------------------------------------------------------------
// ORDER TRACKING — fully derived, see core/labelOrders.js. No inputs on this
// screen at all, deliberately: everything here is already recorded elsewhere.
// ---------------------------------------------------------------------------
function ordersTab(st, ord) {
  const { orders, summary } = ord;
  const ALERT_TONE = { OVERDUE: 'red', 'IN TRANSIT': 'amber', RECEIVED: 'green' };

  const chips = h('div.row.gap8.wrap', [
    badge(`${summary.open} order jalan`, 'amber'),
    badge(`${summary.overdue} telat`, summary.overdue ? 'red' : 'gray'),
    badge(`${summary.received} diterima`, 'green'),
    summary.doubles ? badge(`${summary.doubles} DOBEL ORDER`, 'red', { iconName: 'warn' }) : null,
    summary.unlinked ? badge(`${summary.unlinked} belum kecocok ke SKU`, 'gray') : null,
    h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
      'Semua kolom di sini dihitung dari PO + surat jalan — tidak ada yang diinput manual.'),
  ]);

  if (!orders.length) {
    return h('div.stack', [chips, card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } },
      'Belum ada order label. Order muncul di sini otomatis begitu PO label dibuat dan di-approve.')])]);
  }

  const dbl = orders.filter(o => o.doubleOrder);
  const dblBanner = dbl.length ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ' DOBEL ORDER — label yang sama dipesan lagi padahal order sebelumnya belum sampai:']),
    ...[...new Set(dbl.map(o => o.erp))].slice(0, 8).map(e => {
      const g = dbl.filter(o => o.erp === e);
      return h('div', { style: { fontSize: '10.5px' } }, [
        h('span.mono', { style: { fontWeight: 700 } }, e || '(tanpa ERP)'),
        ` — ${g.length}x: ${g.map(o => `${o.poNo} (${num(o.qtyOrdered)})`).join(', ')}`,
      ]);
    }),
  ]) : null;

  const head = ['PO', 'Tgl Order', 'ERP', 'Nama', 'Qty', 'Diterima', 'Sisa', 'Prioritas', 'Perkiraan Sampai', 'Status', 'Umur'];
  return h('div.stack', [chips, dblBanner, h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', head.map((c, i) => h('th' + ([4, 5, 6].includes(i) ? '.r' : ''), c)))),
    h('tbody', orders.slice(0, 300).map(o => h('tr', {
      style: o.doubleOrder ? { background: 'var(--st-red-bg)' } : {},
    }, [
      h('td.mono.cell-strong', { style: { fontSize: '11px' } }, o.poNo),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, fmtDate(o.orderDate)),
      h('td.mono', { style: { fontSize: '10.5px' } }, [
        o.erp || h('span', { style: { color: 'var(--text-3)' } }, '—'),
        !o.linked ? h('span', { style: { marginLeft: '5px' } }, badge('belum kecocok', 'gray')) : null,
        o.doubleOrder ? h('span', { style: { marginLeft: '5px' } }, badge('DOBEL', 'red')) : null,
      ]),
      h('td', { style: { maxWidth: '240px', fontSize: '11px' } }, o.name),
      h('td.mono.r', num(o.qtyOrdered)),
      h('td.mono.r', num(o.qtyReceived)),
      h('td.mono.r', { style: { fontWeight: o.outstanding ? 700 : 400 } }, o.outstanding ? num(o.outstanding) : '—'),
      h('td', badge(o.priority, o.priority === 'Super Urgent' ? 'red' : o.priority === 'Urgent' ? 'amber' : 'gray')),
      h('td.mono', { style: { fontSize: '10.5px' } }, o.expectedArrival ? fmtDate(o.expectedArrival) : '—'),
      h('td', h('div.row.gap8', [
        badge(o.alert, ALERT_TONE[o.alert] || 'gray'),
        o.daysLate ? h('span', { style: { fontSize: '10px', color: 'var(--st-red-tx)', fontWeight: 700 } }, `+${o.daysLate}h`) : null,
      ])),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
        o.status === 'Received' ? (o.receivedAt ? fmtDate(o.receivedAt) : 'selesai') : `${o.daysOutstanding}h`),
    ]))),
  ])))]);
}

// ---------------------------------------------------------------------------
// ERP MATCHING — one-time bridge from the tracker's spec names to ERP codes.
//
// Never auto-applied. A wrong ERP silently attributes another product's
// shipments to this SKU, which is worse than no link at all.
// ---------------------------------------------------------------------------
function matchTab(st) {
  const rows = st.labelStock || [];
  const cands = erpCandidates(st);
  const unmatched = rows.filter(r => !r.erp);
  const matched = rows.length - unmatched.length;

  const info = h('div.stack', { style: { gap: '8px' } }, [
    h('div.row.gap8.wrap', [
      badge(`${matched} sudah kecocok`, matched ? 'green' : 'gray'),
      badge(`${unmatched.length} belum`, unmatched.length ? 'amber' : 'green'),
      badge(`${cands.length} kandidat ERP tersedia`, cands.length ? 'blue' : 'red'),
    ]),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 } },
      'Kolom Material Code di Excel kosong semua, jadi portal harus tahu sendiri "nama panjang ini = kode barang mana". '
      + 'Tebakan diambil dari item master, design library, dan PO yang sudah pernah dibuat. '
      + 'Dicocokkan sekali saja — setelah itu Order Tracking bisa nyambungin order ke SKU.'),
  ]);

  if (!cands.length) {
    return h('div.stack', [info, h('div.cfg-banner', { style: { display: 'block' } }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ' Belum ada sumber kode ERP sama sekali']),
      h('div', { style: { fontSize: '10.5px', marginTop: '3px' } },
        'Portal belum punya satu pun pasangan "kode ERP ↔ spec" untuk dijadikan tebakan. '
        + 'Sumbernya: Item Master di Master Data, Design Library, atau PO label yang sudah pernah dibuat. '
        + 'Isi salah satu dulu, atau ketik kode ERP-nya manual di tabel bawah.'),
    ]), matchTable(st, unmatched, cands)]);
  }
  return h('div.stack', [info, matchTable(st, unmatched, cands)]);
}

function matchTable(st, unmatched, cands) {
  // Confirming an ERP match WRITES to label_stock (setLabelStockErp), so this
  // tab needs the same capability as the weekly upload. uploadCard() was gated;
  // this tab was not, which made it the one write path left open on a screen
  // whose obvious write button was already locked.
  const canWrite = can(st.user.role, 'labelStockWrite');
  if (!unmatched.length) {
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--st-green-tx)', fontWeight: 600 } },
      'Semua SKU sudah punya kode ERP. Order Tracking bisa nyambungin order ke SKU.')]);
  }
  // Guess once per render for the visible slice only — guessErp scans every
  // candidate, so doing all 974 x N candidates on each keystroke would crawl.
  const shown = unmatched.slice(0, 60);
  const guesses = shown.map(r => guessErp(r, cands));

  return h('div.stack', [
    h('div.row.gap8', [
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } },
        `Menampilkan ${shown.length} dari ${unmatched.length} yang belum kecocok`),
      h('div.mla', canWrite
        ? btn(`Terima semua tebakan yakin (skor ≥ 0.8)`, {
            sm: true, variant: 'primary',
            disabled: !guesses.some(g => g && g.score >= 0.8),
            onClick: () => acceptConfident(shown, guesses),
          })
        : badge('Read-only — pencocokan ERP dipegang purchasing', 'gray', { iconName: 'eye' })),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['Spec (dari tracker)', 'Market', 'Tebakan ERP', 'Spec kandidat', 'Yakin', 'Aksi'].map(c => h('th', c)))),
      h('tbody', shown.map((r, i) => {
        const g = guesses[i];
        return h('tr', [
          h('td.cell-strong', { style: { maxWidth: '280px', fontSize: '11px' } }, r.spec),
          h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, r.market),
          h('td.mono', { style: { fontWeight: 700 } }, g ? g.erp : h('span', { style: { color: 'var(--text-3)', fontWeight: 400 } }, 'tidak ketemu')),
          h('td', { style: { fontSize: '10.5px', color: 'var(--text-3)', maxWidth: '240px' } }, g ? g.spec : '—'),
          h('td', g ? badge(`${Math.round(g.score * 100)}%`, g.score >= 0.8 ? 'green' : g.score >= 0.6 ? 'amber' : 'gray') : badge('—', 'gray')),
          h('td', canWrite ? h('div.row.gap8', [
            g ? btn('Terima', { sm: true, variant: 'primary', onClick: () => acceptErp(r, g.erp) }) : null,
            btn('Ketik manual', { sm: true, onClick: () => setUI({ lsManual: r.id }) }),
          ]) : h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, '—')),
        ]);
      })),
    ]))),
    st.ui.lsManual ? manualErpModal(st) : null,
  ]);
}

function manualErpModal(st) {
  const row = (st.labelStock || []).find(r => r.id === st.ui.lsManual);
  if (!row) return null;
  const draft = { erp: row.erp || '' };
  return modal({
    title: 'Kode ERP manual', subtitle: row.spec, width: 480,
    onClose: () => setUI({ lsManual: null }),
    body: [
      h('div', [h('div.field-label', 'Kode ERP'), h('input.input.mono', {
        value: draft.erp, placeholder: 'mis. 1010203040',
        onInput: e => { draft.erp = e.target.value; },
      })]),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
        'Kosongkan lalu Simpan untuk melepas kecocokan yang salah.'),
    ],
    footer: [
      btn('Batal', { onClick: () => setUI({ lsManual: null }) }),
      btn('Simpan', { variant: 'primary', onClick: () => acceptErp(row, draft.erp.trim(), true) }),
    ],
  });
}

async function acceptErp(row, erp, closeModal) {
  if (blockWrite('cocokkan kode ERP')) return;
  try {
    await setLabelStockErp(row.id, erp);
  } catch (e) {
    console.error('setLabelStockErp failed', e);
    toast('Gagal simpan kode ERP: ' + (e.message || e));
    return;
  }
  row.erp = erp; row.erpConfirmed = !!erp;
  logAudit({ entity: 'label_stock', target: row.spec, action: 'erp_match', detail: erp || '(dilepas)' });
  if (closeModal) setUI({ lsManual: null });
  else setState({});
  toast(erp ? `${row.spec.slice(0, 30)}… → ${erp}` : 'Kecocokan dilepas');
}

// Bulk-accept only the guesses the matcher is confident about. Anything below
// the threshold stays for a human, on purpose.
async function acceptConfident(rows, guesses) {
  if (blockWrite('cocokkan kode ERP massal')) return;
  const pairs = rows.map((r, i) => [r, guesses[i]]).filter(([, g]) => g && g.score >= 0.8);
  if (!pairs.length) return;
  let ok = 0, fail = 0;
  for (const [r, g] of pairs) {
    try { await setLabelStockErp(r.id, g.erp); r.erp = g.erp; r.erpConfirmed = true; ok++; }
    catch (e) { console.error('setLabelStockErp failed for', r.spec, e); fail++; }
  }
  logAudit({ entity: 'label_stock', target: `${ok} SKU`, action: 'erp_match_bulk', detail: `skor >= 0.8${fail ? ` · ${fail} gagal` : ''}` });
  setState({});
  toast(fail ? `${ok} kecocokan disimpan, ${fail} gagal — cek console` : `${ok} kecocokan disimpan`);
}
