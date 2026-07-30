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
import { parseLabelStockSheet, STATUSES } from '../parsers/labelStock.js';
import { applyLabelStockUpload, fetchLabelStock, fetchLabelUploads } from '../core/labelStockApi.js';
import { isConfigured } from '../core/supabase.js';
import { can } from '../auth/roles.js';

const TONE = { 'BUY NOW': 'red', 'SUFFICIENT': 'green', 'OVERSTOCK': 'amber', 'IDLE STOCK': 'gray' };

export function labelStockScreen() {
  const st = getState(); const ui = st.ui;
  const tab = ui.lsTab || 'master';
  const rows = st.labelStock || [];

  const tabs = [
    ['master', `Master Tracker · ${rows.length}`],
    ['buy', `BUY NOW · ${rows.filter(r => r.status === 'BUY NOW').length}`],
    ['nobuy', `DO NOT BUY · ${rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK').length}`],
    ['uploads', 'Riwayat Upload'],
  ];
  const tabBar = h('div.row.gap8.wrap', tabs.map(([id, label]) =>
    h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ lsTab: id }) }, label)));

  let body;
  if (tab === 'buy') body = listTab(st, r => r.status === 'BUY NOW', 'BUY NOW', 'Stok di bawah kebutuhan — perlu order.');
  else if (tab === 'nobuy') body = listTab(st, r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK', 'DO NOT BUY', 'Stok berlebih atau tidak terpakai — jangan order, habiskan dulu.');
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
