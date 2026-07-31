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
import { tr } from '../i18n/index.js';
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

// DISPLAY ONLY. The stored strings (workbook status, PO priority, derived alert)
// are matched exactly everywhere else — filters, tone maps, labelOrders.js — so
// these lookups are used at the point of rendering and nowhere else. Anything
// not in a map falls through unchanged.
const STATUS_LABEL = {
  'BUY NOW': { id: 'BUY NOW', en: 'BUY NOW', zh: '需采购' },
  'SUFFICIENT': { id: 'SUFFICIENT', en: 'SUFFICIENT', zh: '库存充足' },
  'OVERSTOCK': { id: 'OVERSTOCK', en: 'OVERSTOCK', zh: '库存过剩' },
  'IDLE STOCK': { id: 'IDLE STOCK', en: 'IDLE STOCK', zh: '呆滞库存' },
};
const statusLabel = s => (STATUS_LABEL[s] ? tr(STATUS_LABEL[s]) : s);

const PRIORITY_LABEL = {
  'Normal': { id: 'Normal', en: 'Normal', zh: '普通' },
  'Urgent': { id: 'Urgent', en: 'Urgent', zh: '加急' },
  'Super Urgent': { id: 'Super Urgent', en: 'Super Urgent', zh: '特急' },
};
const priorityLabel = p => (PRIORITY_LABEL[p] ? tr(PRIORITY_LABEL[p]) : p);

const ALERT_LABEL = {
  'OVERDUE': { id: 'OVERDUE', en: 'OVERDUE', zh: '已逾期' },
  'IN TRANSIT': { id: 'IN TRANSIT', en: 'IN TRANSIT', zh: '在途' },
  'RECEIVED': { id: 'RECEIVED', en: 'RECEIVED', zh: '已收货' },
};
const alertLabel = a => (ALERT_LABEL[a] ? tr(ALERT_LABEL[a]) : a);

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
    ['orders', tr({
      id: `Order Tracking · ${ord.summary.open} open`,
      en: `Order Tracking · ${ord.summary.open} open`,
      zh: `订单跟踪 · ${ord.summary.open} 进行中`,
    })],
    ['match', unmatched
      ? tr({ id: `Cocokkan ERP · ${unmatched} belum`, en: `Match ERP · ${unmatched} left`, zh: `匹配 ERP · 剩 ${unmatched} 条` })
      : tr({ id: 'Cocokkan ERP ✓', en: 'Match ERP ✓', zh: '匹配 ERP ✓' })],
    ['uploads', tr({ id: 'Riwayat Upload', en: 'Upload History', zh: '上传记录' })],
  ];
  const tabBar = h('div.row.gap8.wrap', tabs.map(([id, label]) =>
    h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ lsTab: id }) }, label)));

  let body;
  if (tab === 'buy') body = listTab(st, r => r.status === 'BUY NOW', 'BUY NOW',
    tr({ id: 'Stok di bawah kebutuhan — perlu order.', en: 'Stock below requirement — needs ordering.', zh: '库存低于需求量 — 需要下单。' }));
  else if (tab === 'nobuy') body = listTab(st, r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK', 'DO NOT BUY',
    tr({ id: 'Stok berlebih atau tidak terpakai — jangan order, habiskan dulu.', en: 'Overstocked or unused — do not order, use it up first.', zh: '库存过剩或未使用 — 请勿下单，先消耗现有库存。' }));
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
      tile(tr({ id: 'TOTAL STOK LABEL', en: 'TOTAL LABEL STOCK', zh: '标签库存总量' }), num(totStock),
        tr({ id: `${rows.length} SKU`, en: `${rows.length} SKU`, zh: `${rows.length} 个 SKU` })),
      tile(tr({ id: 'TOTAL KEBUTUHAN', en: 'TOTAL REQUIREMENT', zh: '需求总量' }), num(totReq),
        tr({ id: 'termasuk buffer', en: 'buffer included', zh: '含缓冲量' })),
      tile(tr({ id: 'HARUS BELI', en: 'MUST BUY', zh: '需采购' }), String(cnt('BUY NOW')),
        tr({ id: 'stok di bawah kebutuhan', en: 'stock below requirement', zh: '库存低于需求量' }), 'red'),
      tile(tr({ id: 'BERLEBIH', en: 'OVERSTOCK', zh: '库存过剩' }), String(cnt('OVERSTOCK')),
        tr({ id: 'stok ≥ 2× kebutuhan', en: 'stock ≥ 2× requirement', zh: '库存 ≥ 需求量的 2 倍' }), 'amber'),
      tile(tr({ id: 'NGANGGUR', en: 'IDLE', zh: '呆滞' }), String(cnt('IDLE STOCK')),
        tr({ id: 'tidak ada rencana produksi', en: 'no production plan', zh: '无生产计划' }), 'gray'),
    ]),
    // Two things the workbook can't tell you, so they get top billing.
    (mismatch || missing) ? h('div.row.gap8.wrap', [
      mismatch ? h('div.cfg-banner', { style: { flex: 1, background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } },
        [icon('warn', 14), tr({
          id: ` ${mismatch} baris angkanya beda dari hasil hitung ulang — cek rumus di Excel`,
          en: ` ${mismatch} rows differ from the recalculation — check the Excel formulas`,
          zh: ` ${mismatch} 行数据与重新计算结果不一致 — 请检查 Excel 公式`,
        })]) : null,
      missing ? h('div.cfg-banner', { style: { flex: 1 } },
        [icon('warn', 14), tr({
          id: ` ${missing} SKU tidak muncul di upload terakhir — belum dihapus, cuma ditandai`,
          en: ` ${missing} SKU did not appear in the last upload — not deleted, only flagged`,
          zh: ` ${missing} 个 SKU 未出现在最近一次上传中 — 未删除，仅作标记`,
        })]) : null,
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
    title: tr({
      id: 'Upload Label Inventory Tracker (.xlsx)',
      en: 'Upload Label Inventory Tracker (.xlsx)',
      zh: '上传标签库存跟踪表 (.xlsx)',
    }),
    sub: tr({
      id: 'Sheet "Master Tracker" · isi tetap dari Excel, portal cuma nyimpen & ngecek',
      en: 'Sheet "Master Tracker" · the figures stay Excel\'s, the portal only stores and checks them',
      zh: '工作表 "Master Tracker" · 数值以 Excel 为准，门户仅保存与核对',
    }),
    accept: '.xlsx,.xls', iconName: 'upload', compact: true,
    onFiles: f => handleFile(f[0]),
  });
  return card([h('div.card-pad', [
    dz,
    ui.lsSheets ? h('div.row.gap8.wrap', { style: { marginTop: '12px', alignItems: 'flex-end' } }, [
      h('div', [
        h('div.field-label', tr({ id: 'Pilih sheet', en: 'Pick a sheet', zh: '选择工作表' })),
        selectEl(ui.lsSheets.map(s => ({
          value: s.name,
          label: tr({ id: `${s.name} (${s.count} baris)`, en: `${s.name} (${s.count} rows)`, zh: `${s.name}（${s.count} 行）` }),
        })), { value: ui.lsSheet, onChange: v => setUI({ lsSheet: v }) }),
      ]),
      btn(tr({ id: 'Baca sheet ini →', en: 'Read this sheet →', zh: '读取此工作表 →' }), { variant: 'primary', onClick: () => parseSheet() }),
      btn(tr({ id: 'Batal', en: 'Cancel', zh: '取消' }), { onClick: () => setUI({ lsSheets: null, lsWb: null, lsSheet: null, lsFile: null }) }),
    ]) : null,
  ])]);
}

async function handleFile(file) {
  if (blockWrite('upload file stok label')) return;
  if (!file) return;
  toast({ id: 'Membaca file…', en: 'Reading file…', zh: '正在读取文件…' });
  try {
    const wb = await readWorkbook(file);
    const sheets = wb.sheetNames.map(n => ({ name: n, count: wb.countRows(n) }));
    // Prefer the sheet the tracker actually keeps its data in.
    const pref = sheets.find(s => /master\s*tracker/i.test(s.name)) || sheets[0];
    setUI({ lsWb: wb, lsSheets: sheets, lsSheet: (pref || {}).name, lsFile: file.name });
  } catch (e) {
    console.error(e); toast({
      id: 'Gagal membaca Excel: ' + (e.message || e),
      en: 'Failed to read Excel: ' + (e.message || e),
      zh: '读取 Excel 失败：' + (e.message || e),
    });
  }
}

function parseSheet() {
  const st = getState(); const ui = st.ui;
  if (!ui.lsWb || !ui.lsSheet) { toast({ id: 'Pilih sheet dulu', en: 'Pick a sheet first', zh: '请先选择工作表' }); return; }
  let res;
  try {
    res = parseLabelStockSheet(ui.lsWb.rows(ui.lsSheet), {
      moq: (st.labelSettings || {}).moq || 500,
      overstockMultiple: (st.labelSettings || {}).overstockMultiple || 2,
      items: st.items || [],
    });
  } catch (e) { console.error(e); toast({
    id: 'Parse gagal: ' + (e.message || e),
    en: 'Parse failed: ' + (e.message || e),
    zh: '解析失败：' + (e.message || e),
  }); return; }
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
    title: tr({ id: 'Cek dulu sebelum disimpan', en: 'Check before saving', zh: '保存前请先核对' }),
    subtitle: `${fileName} · sheet "${sheetName}"`, width: 680,
    onClose: () => setUI({ lsPreview: null }),
    body: [
      h('div.grid.g2', [
        card([h('div.card-pad', [
          h('div.card-title', { style: { marginBottom: '8px' } }, tr({ id: 'Isi file', en: 'File contents', zh: '文件内容' })),
          stat(tr({ id: 'Baris dibaca', en: 'Rows read', zh: '已读取行数' }), res.stats.total),
          stat(tr({ id: 'Akan masuk', en: 'Will be imported', zh: '将导入' }), res.stats.imported, 'green'),
          stat(tr({ id: 'Dikarantina (dobel)', en: 'Quarantined (duplicate)', zh: '已隔离（重复）' }), res.stats.duplicated, res.stats.duplicated ? 'red' : null),
          stat(tr({ id: 'Rumus tidak cocok', en: 'Formula mismatch', zh: '公式不一致' }), res.stats.mismatched, res.stats.mismatched ? 'amber' : null),
        ])]),
        card([h('div.card-pad', [
          h('div.card-title', { style: { marginBottom: '8px' } }, first
            ? tr({ id: 'Upload pertama', en: 'First upload', zh: '首次上传' })
            : tr({ id: 'Perubahan vs data sekarang', en: 'Changes vs current data', zh: '与当前数据的差异' })),
          first
            ? h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, tr({
                id: 'Belum ada data sebelumnya — semua baris masuk sebagai baru.',
                en: 'No previous data — every row comes in as new.',
                zh: '此前没有数据 — 所有行都将作为新数据导入。',
              }))
            : h('div.stack', { style: { gap: '3px' } }, [
                stat(tr({ id: 'Stok naik', en: 'Stock up', zh: '库存增加' }), diff.up.length, 'green'),
                stat(tr({ id: 'Stok turun', en: 'Stock down', zh: '库存减少' }), diff.down.length, 'amber'),
                stat(tr({ id: 'Tidak berubah', en: 'Unchanged', zh: '无变化' }), diff.same.length),
                stat(tr({ id: 'SKU baru', en: 'New SKU', zh: '新增 SKU' }), diff.added.length, 'blue'),
                stat(tr({ id: 'Tidak ada di file ini', en: 'Not in this file', zh: '此文件中缺失' }), diff.missing.length, diff.missing.length ? 'red' : null),
              ]),
        ])]),
      ]),

      // The one thing that must never pass silently.
      diff.missing.length && !first
        ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
            h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
              id: ` ${diff.missing.length} SKU yang ada sekarang TIDAK ada di file ini`,
              en: ` ${diff.missing.length} SKU that exist now are NOT in this file`,
              zh: ` 当前有 ${diff.missing.length} 个 SKU 未出现在此文件中`,
            })]),
            h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
              id: 'Mereka tidak akan dihapus — cuma ditandai. Kalau angkanya kelihatan aneh (misal ratusan), kemungkinan salah pilih sheet.',
              en: 'They will not be deleted — only flagged. If the number looks odd (hundreds, say), the wrong sheet was probably picked.',
              zh: '它们不会被删除 — 仅作标记。如果数量异常（例如成百上千），很可能是选错了工作表。',
            })),
            ...diff.missing.slice(0, 5).map(r => h('div.mono', { style: { fontSize: '10px' } }, `• ${r.spec} ${r.market}`)),
            diff.missing.length > 5 ? h('div', { style: { fontSize: '10px' } }, tr({
              id: `…dan ${diff.missing.length - 5} lagi`,
              en: `…and ${diff.missing.length - 5} more`,
              zh: `…还有 ${diff.missing.length - 5} 个`,
            })) : null,
          ])
        : null,

      res.duplicates.length ? duplicateBlock(res.duplicates) : null,
      res.stats.mismatched ? mismatchBlock(res.mismatches) : null,

      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: 'Angka yang disimpan diambil apa adanya dari Excel. Hasil hitung ulang portal disimpan terpisah, cuma buat pembanding.',
        en: 'The figures saved are taken from Excel as-is. The portal\'s recalculation is stored separately, for comparison only.',
        zh: '保存的数值原样取自 Excel。门户的重算结果单独保存，仅供比对。',
      })),
    ],
    footer: [
      btn(tr({ id: 'Batal', en: 'Cancel', zh: '取消' }), { onClick: () => setUI({ lsPreview: null }) }),
      res.duplicates.length
        ? btn(tr({
            id: `Simpan ${num(res.stats.imported)} SKU (${res.stats.duplicated} dobel dilewati)`,
            en: `Save ${num(res.stats.imported)} SKU (${res.stats.duplicated} duplicates skipped)`,
            zh: `保存 ${num(res.stats.imported)} 个 SKU（跳过 ${res.stats.duplicated} 个重复）`,
          }), { variant: 'primary', onClick: () => applyUpload() })
        : btn(tr({
            id: `Simpan ${num(res.stats.imported)} SKU`,
            en: `Save ${num(res.stats.imported)} SKU`,
            zh: `保存 ${num(res.stats.imported)} 个 SKU`,
          }), { variant: 'primary', onClick: () => applyUpload() }),
    ],
  });
}

function duplicateBlock(dups) {
  return h('div.cfg-banner', { style: { display: 'block' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${dups.length} spec dobel — ${dups.reduce((s, d) => s + d.rows.length, 0)} baris ini TIDAK disimpan`,
      en: ` ${dups.length} duplicate specs — these ${dups.reduce((s, d) => s + d.rows.length, 0)} rows are NOT saved`,
      zh: ` ${dups.length} 个规格重复 — 这 ${dups.reduce((s, d) => s + d.rows.length, 0)} 行不会保存`,
    })]),
    h('div', { style: { fontSize: '10.5px', margin: '3px 0 6px' } }, tr({
      id: 'Nomor baris di bawah = baris asli di Excel. Buka Master Tracker, Ctrl+G, ketik nomornya.',
      en: 'The row numbers below are the original Excel rows. Open Master Tracker, press Ctrl+G, type the number.',
      zh: '下方行号即 Excel 中的原始行号。打开 Master Tracker，按 Ctrl+G，输入行号。',
    })),
    ...dups.map(d => h('div', { style: { fontSize: '10.5px', marginBottom: '3px' } }, [
      h('span.mono', { style: { fontWeight: 700 } }, tr({
        id: `baris ${d.rows.map(r => r.excelRow).join(' & ')}`,
        en: `row ${d.rows.map(r => r.excelRow).join(' & ')}`,
        zh: `第 ${d.rows.map(r => r.excelRow).join(' & ')} 行`,
      })),
      ` — ${d.spec} ${d.market}`,
      h('span', { style: { color: 'var(--text-3)' } }, tr({
        id: ` · stok ${d.rows.map(r => num(r.stock)).join(' + ')} = ${num(d.combinedStock)}, kebutuhan ${num(d.requirement)}`,
        en: ` · stock ${d.rows.map(r => num(r.stock)).join(' + ')} = ${num(d.combinedStock)}, requirement ${num(d.requirement)}`,
        zh: ` · 库存 ${d.rows.map(r => num(r.stock)).join(' + ')} = ${num(d.combinedStock)}，需求 ${num(d.requirement)}`,
      })),
    ])),
  ]);
}

function mismatchBlock(list) {
  return h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${list.length} baris: angka di Excel beda dari hasil hitung ulang`,
      en: ` ${list.length} rows: the Excel figures differ from the recalculation`,
      zh: ` ${list.length} 行：Excel 中的数值与重算结果不一致`,
    })]),
    h('div', { style: { fontSize: '10.5px', margin: '3px 0 6px' } }, tr({
      id: 'Nilai dari Excel tetap dipakai. Ini cuma penanda kalau ada rumus rusak atau kolom yang ke-paste jadi angka mati.',
      en: 'The Excel values are still used. This only flags a broken formula or a column pasted in as static numbers.',
      zh: '仍以 Excel 中的数值为准。此处仅提示公式可能损坏，或某列被粘贴成了固定数值。',
    })),
    ...list.slice(0, 6).map(r => h('div.mono', { style: { fontSize: '10px' } }, tr({
      id: `baris ${r.excelRow}: ` + r.mismatch.map(m => `${m.field} Excel=${m.sheet} hitung=${m.calc}`).join(' · '),
      en: `row ${r.excelRow}: ` + r.mismatch.map(m => `${m.field} Excel=${m.sheet} calc=${m.calc}`).join(' · '),
      zh: `第 ${r.excelRow} 行：` + r.mismatch.map(m => `${m.field} Excel=${m.sheet} 计算=${m.calc}`).join(' · '),
    }))),
    list.length > 6 ? h('div', { style: { fontSize: '10px' } }, tr({
      id: `…dan ${list.length - 6} lagi`,
      en: `…and ${list.length - 6} more`,
      zh: `…还有 ${list.length - 6} 行`,
    })) : null,
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
    toast({
      id: 'Gagal simpan ke server: ' + (e.message || e),
      en: 'Failed to save to server: ' + (e.message || e),
      zh: '保存到服务器失败：' + (e.message || e),
    });
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
  toast({
    id: `${res.stats.imported} SKU tersimpan`,
    en: `${res.stats.imported} SKU saved`,
    zh: `${res.stats.imported} 个 SKU 已保存`,
  });
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
      searchInput({
        id: 'ls-q',
        placeholder: tr({ id: 'Cari spec / market / ERP…', en: 'Search spec / market / ERP…', zh: '搜索规格 / 市场 / ERP…' }),
        value: st.ui.lsQ || '', onChange: v => setUI({ lsQ: v }),
      }),
      // Option VALUES stay the stored strings — only the visible label is translated.
      selectEl(['Semua', ...STATUSES].map(s => ({
        value: s,
        label: s === 'Semua' ? tr({ id: 'Semua', en: 'All', zh: '全部' }) : statusLabel(s),
      })), { value: st.ui.lsStatus || 'Semua', onChange: v => setUI({ lsStatus: v }) }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${rows.length} dari ${(st.labelStock || []).length} SKU`,
        en: `${rows.length} of ${(st.labelStock || []).length} SKU`,
        zh: `${(st.labelStock || []).length} 个 SKU 中的 ${rows.length} 个`,
      })),
      h('div.mla.row.gap8', [
        isConfigured() ? btn(tr({ id: 'Refresh dari server', en: 'Refresh from Server', zh: '从服务器刷新' }), { sm: true, iconName: 'clock', onClick: () => refreshLabelStock() }) : null,
        btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportRows(rows) }),
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
      h('div.mla', btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportRows(rows) })),
    ]),
    stockTable(rows, false),
  ]);
}

function stockTable(rows, showAll) {
  if (!rows.length) {
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
      id: 'Belum ada data. Upload file Label Inventory Tracker di atas.',
      en: 'No data yet. Upload the Label Inventory Tracker file above.',
      zh: '暂无数据。请在上方上传标签库存跟踪表。',
    }))]);
  }
  const head = [
    tr({ id: 'Spec', en: 'Spec', zh: '规格' }),
    tr({ id: 'Market', en: 'Market', zh: '市场' }),
    tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }),
    tr({ id: 'Stok', en: 'Stock', zh: '库存' }),
    tr({ id: 'Rencana Produksi', en: 'Planned Production', zh: '生产计划' }),
    tr({ id: 'Buffer', en: 'Buffer', zh: '缓冲量' }),
    tr({ id: 'Kebutuhan', en: 'Requirement', zh: '需求量' }),
    tr({ id: 'Surplus / (Kurang)', en: 'Surplus / (Shortage)', zh: '盈余 /（短缺）' }),
    tr({ id: 'Status', en: 'Status', zh: '状态' }),
    tr({ id: 'Saran Order', en: 'Suggested Order', zh: '建议订购量' }),
  ];
  return h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', head.map((c, i) => h('th' + (i >= 3 && i !== 8 ? '.r' : ''), c)))),
    h('tbody', rows.slice(0, 400).map(r => h('tr', {
      style: r.missing ? { opacity: '.55' } : {},
    }, [
      h('td.cell-strong', { style: { maxWidth: '300px' } }, [
        r.spec,
        r.hasMismatch ? h('span', { style: { marginLeft: '6px' } }, badge(tr({ id: 'rumus?', en: 'formula?', zh: '公式？' }), 'amber')) : null,
        r.missing ? h('span', { style: { marginLeft: '6px' } }, badge(tr({
          id: 'tidak di upload terakhir', en: 'not in last upload', zh: '不在最近一次上传中',
        }), 'gray')) : null,
      ]),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, r.market),
      h('td.mono', { style: { fontSize: '10.5px' } }, r.erp || h('span', { style: { color: 'var(--text-3)' } }, '—')),
      h('td.mono.r', num(r.stock)),
      h('td.mono.r', num(r.production)),
      h('td.mono.r', `${Math.round((r.buffer || 0) * 100)}%`),
      h('td.mono.r', num(r.requirement)),
      h('td.mono.r', { style: { fontWeight: 700, color: r.surplus < 0 ? 'var(--st-red-tx)' : 'var(--text)' } }, num(r.surplus)),
      h('td', badge(r.status ? statusLabel(r.status) : '—', TONE[r.status] || 'gray')),
      h('td.mono.r', { style: { fontWeight: r.suggestedQty ? 700 : 400 } }, r.suggestedQty ? num(r.suggestedQty) : '—'),
    ]))),
  ])), rows.length > 400 ? h('div', { style: { padding: '10px 16px', fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
    id: `Menampilkan 400 dari ${num(rows.length)} baris — pakai pencarian atau filter status untuk mempersempit. Export Excel tetap berisi semuanya.`,
    en: `Showing 400 of ${num(rows.length)} rows — use search or the status filter to narrow it down. The Excel export still contains everything.`,
    zh: `显示 ${num(rows.length)} 行中的 400 行 — 请使用搜索或状态筛选缩小范围。导出的 Excel 仍包含全部内容。`,
  })) : null);
}

function uploadsTab(st) {
  const list = st.labelUploads || [];
  if (!list.length) return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
    id: 'Belum ada riwayat upload.', en: 'No upload history yet.', zh: '暂无上传记录。',
  }))]);
  return h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', [
      tr({ id: 'Waktu', en: 'Time', zh: '时间' }),
      tr({ id: 'Oleh', en: 'By', zh: '操作人' }),
      tr({ id: 'File', en: 'File', zh: '文件' }),
      tr({ id: 'Sheet', en: 'Sheet', zh: '工作表' }),
      tr({ id: 'Dibaca', en: 'Read', zh: '已读取' }),
      tr({ id: 'Masuk', en: 'Imported', zh: '已导入' }),
      tr({ id: 'Dobel', en: 'Duplicate', zh: '重复' }),
      tr({ id: 'Rumus?', en: 'Formula?', zh: '公式？' }),
    ].map((c, i) => h('th' + (i >= 4 ? '.r' : ''), c)))),
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
  toast({ id: 'Export Excel diunduh', en: 'Excel export downloaded', zh: 'Excel 导出已下载' });
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
    badge(tr({ id: `${summary.open} order jalan`, en: `${summary.open} open orders`, zh: `${summary.open} 个订单进行中` }), 'amber'),
    badge(tr({ id: `${summary.overdue} telat`, en: `${summary.overdue} late`, zh: `${summary.overdue} 个延误` }), summary.overdue ? 'red' : 'gray'),
    badge(tr({ id: `${summary.received} diterima`, en: `${summary.received} received`, zh: `${summary.received} 个已收货` }), 'green'),
    summary.doubles ? badge(tr({
      id: `${summary.doubles} DOBEL ORDER`, en: `${summary.doubles} DOUBLE ORDERS`, zh: `${summary.doubles} 个重复下单`,
    }), 'red', { iconName: 'warn' }) : null,
    summary.unlinked ? badge(tr({
      id: `${summary.unlinked} belum kecocok ke SKU`,
      en: `${summary.unlinked} not matched to a SKU`,
      zh: `${summary.unlinked} 个尚未匹配到 SKU`,
    }), 'gray') : null,
    h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
      id: 'Semua kolom di sini dihitung dari PO + surat jalan — tidak ada yang diinput manual.',
      en: 'Every column here is derived from POs + Surat Jalan — nothing is entered by hand.',
      zh: '此处所有列均由采购单与送货单推算得出 — 无任何手工录入。',
    })),
  ]);

  if (!orders.length) {
    return h('div.stack', [chips, card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
      id: 'Belum ada order label. Order muncul di sini otomatis begitu PO label dibuat dan di-approve.',
      en: 'No label orders yet. Orders appear here automatically once a label PO is created and approved.',
      zh: '暂无标签订单。标签采购单创建并审批通过后，订单会自动出现在此处。',
    }))])]);
  }

  const dbl = orders.filter(o => o.doubleOrder);
  const dblBanner = dbl.length ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ' DOBEL ORDER — label yang sama dipesan lagi padahal order sebelumnya belum sampai:',
      en: ' DOUBLE ORDER — the same label was ordered again while the earlier order has not arrived:',
      zh: ' 重复下单 — 上一笔订单尚未到货，同一标签又被再次订购：',
    })]),
    ...[...new Set(dbl.map(o => o.erp))].slice(0, 8).map(e => {
      const g = dbl.filter(o => o.erp === e);
      return h('div', { style: { fontSize: '10.5px' } }, [
        h('span.mono', { style: { fontWeight: 700 } }, e || tr({ id: '(tanpa ERP)', en: '(no ERP)', zh: '（无 ERP）' })),
        ` — ${g.length}x: ${g.map(o => `${o.poNo} (${num(o.qtyOrdered)})`).join(', ')}`,
      ]);
    }),
  ]) : null;

  const head = [
    tr({ id: 'PO', en: 'PO', zh: '采购单' }),
    tr({ id: 'Tgl Order', en: 'Order Date', zh: '下单日期' }),
    tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }),
    tr({ id: 'Nama', en: 'Name', zh: '名称' }),
    tr({ id: 'Qty', en: 'Qty', zh: '数量' }),
    tr({ id: 'Diterima', en: 'Received', zh: '已收' }),
    tr({ id: 'Sisa', en: 'Outstanding', zh: '未收' }),
    tr({ id: 'Prioritas', en: 'Priority', zh: '优先级' }),
    tr({ id: 'Perkiraan Sampai', en: 'Expected Arrival', zh: '预计到货' }),
    tr({ id: 'Status', en: 'Status', zh: '状态' }),
    tr({ id: 'Umur', en: 'Age', zh: '时长' }),
  ];
  return h('div.stack', [chips, dblBanner, h('div.card', h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', head.map((c, i) => h('th' + ([4, 5, 6].includes(i) ? '.r' : ''), c)))),
    h('tbody', orders.slice(0, 300).map(o => h('tr', {
      style: o.doubleOrder ? { background: 'var(--st-red-bg)' } : {},
    }, [
      h('td.mono.cell-strong', { style: { fontSize: '11px' } }, o.poNo),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, fmtDate(o.orderDate)),
      h('td.mono', { style: { fontSize: '10.5px' } }, [
        o.erp || h('span', { style: { color: 'var(--text-3)' } }, '—'),
        !o.linked ? h('span', { style: { marginLeft: '5px' } }, badge(tr({ id: 'belum kecocok', en: 'not matched', zh: '未匹配' }), 'gray')) : null,
        o.doubleOrder ? h('span', { style: { marginLeft: '5px' } }, badge(tr({ id: 'DOBEL', en: 'DOUBLE', zh: '重复' }), 'red')) : null,
      ]),
      h('td', { style: { maxWidth: '240px', fontSize: '11px' } }, o.name),
      h('td.mono.r', num(o.qtyOrdered)),
      h('td.mono.r', num(o.qtyReceived)),
      h('td.mono.r', { style: { fontWeight: o.outstanding ? 700 : 400 } }, o.outstanding ? num(o.outstanding) : '—'),
      h('td', badge(priorityLabel(o.priority), o.priority === 'Super Urgent' ? 'red' : o.priority === 'Urgent' ? 'amber' : 'gray')),
      h('td.mono', { style: { fontSize: '10.5px' } }, o.expectedArrival ? fmtDate(o.expectedArrival) : '—'),
      h('td', h('div.row.gap8', [
        badge(alertLabel(o.alert), ALERT_TONE[o.alert] || 'gray'),
        o.daysLate ? h('span', { style: { fontSize: '10px', color: 'var(--st-red-tx)', fontWeight: 700 } }, tr({
          id: `+${o.daysLate}h`, en: `+${o.daysLate}d`, zh: `+${o.daysLate}天`,
        })) : null,
      ])),
      h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
        o.status === 'Received'
          ? (o.receivedAt ? fmtDate(o.receivedAt) : tr({ id: 'selesai', en: 'done', zh: '已完成' }))
          : tr({ id: `${o.daysOutstanding}h`, en: `${o.daysOutstanding}d`, zh: `${o.daysOutstanding}天` })),
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
      badge(tr({ id: `${matched} sudah kecocok`, en: `${matched} matched`, zh: `${matched} 个已匹配` }), matched ? 'green' : 'gray'),
      badge(tr({ id: `${unmatched.length} belum`, en: `${unmatched.length} left`, zh: `${unmatched.length} 个未匹配` }), unmatched.length ? 'amber' : 'green'),
      badge(tr({
        id: `${cands.length} kandidat ERP tersedia`,
        en: `${cands.length} ERP candidates available`,
        zh: `有 ${cands.length} 个 ERP 候选项`,
      }), cands.length ? 'blue' : 'red'),
    ]),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
      id: 'Kolom Material Code di Excel kosong semua, jadi portal harus tahu sendiri "nama panjang ini = kode barang mana". '
        + 'Tebakan diambil dari item master, design library, dan PO yang sudah pernah dibuat. '
        + 'Dicocokkan sekali saja — setelah itu Order Tracking bisa nyambungin order ke SKU.',
      en: 'The Material Code column in Excel is entirely empty, so the portal has to work out "this long name = which item code" on its own. '
        + 'Guesses come from the item master, the design library, and POs already created. '
        + 'Match once — after that Order Tracking can link orders to SKUs.',
      zh: 'Excel 中的 Material Code 列全部为空，因此门户必须自行判断"这个长名称对应哪个物料编码"。'
        + '推测结果来自物料主数据、设计库以及已创建的采购单。'
        + '只需匹配一次 — 之后订单跟踪即可将订单关联到 SKU。',
    })),
  ]);

  if (!cands.length) {
    return h('div.stack', [info, h('div.cfg-banner', { style: { display: 'block' } }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
        id: ' Belum ada sumber kode ERP sama sekali',
        en: ' No source of ERP codes at all yet',
        zh: ' 目前完全没有 ERP 编码来源',
      })]),
      h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
        id: 'Portal belum punya satu pun pasangan "kode ERP ↔ spec" untuk dijadikan tebakan. '
          + 'Sumbernya: Item Master di Master Data, Design Library, atau PO label yang sudah pernah dibuat. '
          + 'Isi salah satu dulu, atau ketik kode ERP-nya manual di tabel bawah.',
        en: 'The portal has not a single "ERP code ↔ spec" pair to guess from. '
          + 'The sources are: Item Master under Master Data, the Design Library, or label POs already created. '
          + 'Fill one of them first, or type the ERP code by hand in the table below.',
        zh: '门户目前没有任何"ERP 编码 ↔ 规格"对应关系可供推测。'
          + '可用来源：主数据中的物料主数据、设计库，或已创建的标签采购单。'
          + '请先填入其中之一，或在下方表格中手动输入 ERP 编码。',
      })),
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
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--st-green-tx)', fontWeight: 600 } }, tr({
      id: 'Semua SKU sudah punya kode ERP. Order Tracking bisa nyambungin order ke SKU.',
      en: 'Every SKU has an ERP code. Order Tracking can link orders to SKUs.',
      zh: '所有 SKU 均已有 ERP 编码。订单跟踪可将订单关联到 SKU。',
    }))]);
  }
  // Guess once per render for the visible slice only — guessErp scans every
  // candidate, so doing all 974 x N candidates on each keystroke would crawl.
  const shown = unmatched.slice(0, 60);
  const guesses = shown.map(r => guessErp(r, cands));

  return h('div.stack', [
    h('div.row.gap8', [
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `Menampilkan ${shown.length} dari ${unmatched.length} yang belum kecocok`,
        en: `Showing ${shown.length} of ${unmatched.length} still unmatched`,
        zh: `显示 ${unmatched.length} 条未匹配中的 ${shown.length} 条`,
      })),
      h('div.mla', canWrite
        ? btn(tr({
            id: `Terima semua tebakan yakin (skor ≥ 0.8)`,
            en: `Accept All Confident Guesses (score ≥ 0.8)`,
            zh: `接受全部高置信推测（评分 ≥ 0.8）`,
          }), {
            sm: true, variant: 'primary',
            disabled: !guesses.some(g => g && g.score >= 0.8),
            onClick: () => acceptConfident(shown, guesses),
          })
        : badge(tr({
            id: 'Read-only — pencocokan ERP dipegang purchasing',
            en: 'Read-only — ERP matching is purchasing\'s job',
            zh: '只读 — ERP 匹配由采购负责',
          }), 'gray', { iconName: 'eye' })),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'Spec (dari tracker)', en: 'Spec (from tracker)', zh: '规格（来自跟踪表）' }),
        tr({ id: 'Market', en: 'Market', zh: '市场' }),
        tr({ id: 'Tebakan ERP', en: 'ERP Guess', zh: 'ERP 推测' }),
        tr({ id: 'Spec kandidat', en: 'Candidate Spec', zh: '候选规格' }),
        tr({ id: 'Yakin', en: 'Confidence', zh: '置信度' }),
        tr({ id: 'Aksi', en: 'Action', zh: '操作' }),
      ].map(c => h('th', c)))),
      h('tbody', shown.map((r, i) => {
        const g = guesses[i];
        return h('tr', [
          h('td.cell-strong', { style: { maxWidth: '280px', fontSize: '11px' } }, r.spec),
          h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, r.market),
          h('td.mono', { style: { fontWeight: 700 } }, g ? g.erp : h('span', { style: { color: 'var(--text-3)', fontWeight: 400 } },
            tr({ id: 'tidak ketemu', en: 'no match', zh: '未找到' }))),
          h('td', { style: { fontSize: '10.5px', color: 'var(--text-3)', maxWidth: '240px' } }, g ? g.spec : '—'),
          h('td', g ? badge(`${Math.round(g.score * 100)}%`, g.score >= 0.8 ? 'green' : g.score >= 0.6 ? 'amber' : 'gray') : badge('—', 'gray')),
          h('td', canWrite ? h('div.row.gap8', [
            g ? btn(tr({ id: 'Terima', en: 'Accept', zh: '接受' }), { sm: true, variant: 'primary', onClick: () => acceptErp(r, g.erp) }) : null,
            btn(tr({ id: 'Ketik manual', en: 'Type Manually', zh: '手动输入' }), { sm: true, onClick: () => setUI({ lsManual: r.id }) }),
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
    title: tr({ id: 'Kode ERP manual', en: 'Manual ERP Code', zh: '手动输入 ERP 编码' }),
    subtitle: row.spec, width: 480,
    onClose: () => setUI({ lsManual: null }),
    body: [
      h('div', [h('div.field-label', tr({ id: 'Kode ERP', en: 'ERP Code', zh: 'ERP 编码' })), h('input.input.mono', {
        value: draft.erp, placeholder: tr({ id: 'mis. 1010203040', en: 'e.g. 1010203040', zh: '例如 1010203040' }),
        onInput: e => { draft.erp = e.target.value; },
      })]),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: 'Kosongkan lalu Simpan untuk melepas kecocokan yang salah.',
        en: 'Clear the field and Save to undo a wrong match.',
        zh: '清空该字段并保存，即可解除错误的匹配。',
      })),
    ],
    footer: [
      btn(tr({ id: 'Batal', en: 'Cancel', zh: '取消' }), { onClick: () => setUI({ lsManual: null }) }),
      btn(tr({ id: 'Simpan', en: 'Save', zh: '保存' }), { variant: 'primary', onClick: () => acceptErp(row, draft.erp.trim(), true) }),
    ],
  });
}

async function acceptErp(row, erp, closeModal) {
  if (blockWrite('cocokkan kode ERP')) return;
  try {
    await setLabelStockErp(row.id, erp);
  } catch (e) {
    console.error('setLabelStockErp failed', e);
    toast({
      id: 'Gagal simpan kode ERP: ' + (e.message || e),
      en: 'Failed to save ERP code: ' + (e.message || e),
      zh: '保存 ERP 编码失败：' + (e.message || e),
    });
    return;
  }
  row.erp = erp; row.erpConfirmed = !!erp;
  logAudit({ entity: 'label_stock', target: row.spec, action: 'erp_match', detail: erp || '(dilepas)' });
  if (closeModal) setUI({ lsManual: null });
  else setState({});
  toast({
    id: erp ? `${row.spec.slice(0, 30)}… → ${erp}` : 'Kecocokan dilepas',
    en: erp ? `${row.spec.slice(0, 30)}… → ${erp}` : 'Match removed',
    zh: erp ? `${row.spec.slice(0, 30)}… → ${erp}` : '已解除匹配',
  });
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
  toast({
    id: fail ? `${ok} kecocokan disimpan, ${fail} gagal — cek console` : `${ok} kecocokan disimpan`,
    en: fail ? `${ok} matches saved, ${fail} failed — check console` : `${ok} matches saved`,
    zh: fail ? `已保存 ${ok} 条匹配，${fail} 条失败 — 请查看控制台` : `已保存 ${ok} 条匹配`,
  });
}
