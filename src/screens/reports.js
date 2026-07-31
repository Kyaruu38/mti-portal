import { h } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, driveLink, selectEl } from '../ui/components.js';
import { money, num, fmtDate } from '../core/format.js';
import { statusText } from '../core/statusText.js';
import { writeWorkbook } from '../core/xlsx.js';
import { outstandingPOs } from '../core/outstanding.js';
import { allowedReportModules } from '../auth/roles.js';
// NOTE: buildRows() filtering alone was not enough — outstandingCard() and the
// audit sheet in exportReport() each read state directly and bypassed it.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Flatten the modules THIS ROLE may see into a unified report dataset.
// Filtering here (not just in the dropdown) is what actually keeps finance data
// out of a purchasing role's Excel export — the dropdown alone would still let
// "All" include it.
function buildRows(st) {
  const allowed = new Set(allowedReportModules(st.user.role));
  const rows = [];
  if (allowed.has('PO')) st.pos.forEach(p => rows.push({ date: p.createdAt, module: 'PO', doc: p.no, supplier: p.supplier, value: p.total, currency: p.currency, status: p.status, driveUrl: p.driveUrl || '' }));
  if (allowed.has('PPKEK')) st.ppkek.forEach(p => rows.push({ date: p.date, module: 'PPKEK', doc: p.nopen, supplier: p.supplier, value: p.idr, currency: 'IDR', status: p.status, driveUrl: p.driveUrl || '' }));
  if (allowed.has('PRF')) st.prfs.forEach(p => rows.push({ date: p.createdAt, module: 'PRF', doc: p.no, supplier: p.supplier, value: p.amount, currency: p.currency, status: p.stage, driveUrl: p.driveUrl || '' }));
  if (allowed.has('Label')) st.labelBatches.forEach(b => rows.push({ date: b.at, module: 'Label', doc: `${b.file} · ${b.count} rows`, supplier: 'Multi', value: 0, currency: 'IDR', status: 'draft', driveUrl: '' }));
  if (allowed.has('Payment')) st.payments.forEach(p => rows.push({ date: p.date, module: 'Payment', doc: p.prf, supplier: p.supplier, value: p.amount, currency: p.currency, status: 'Paid', driveUrl: p.driveUrl || '' }));
  return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function reportsScreen() {
  const st = getState(); const ui = st.ui;
  const f = ui.rpFilter || { module: t('all'), month: MONTHS[new Date().getMonth()], year: String(new Date().getFullYear()), status: t('all'), supplier: t('all'), currency: t('all') };
  const set = patch => setUI({ rpFilter: { ...f, ...patch } });

  let rows = buildRows(st);
  rows = rows.filter(r =>
    (f.module === t('all') || r.module === f.module) &&
    (f.status === t('all') || r.status === f.status) &&
    (f.supplier === t('all') || r.supplier === f.supplier) &&
    (f.currency === t('all') || r.currency === f.currency) &&
    (MONTHS[new Date(r.date).getMonth()] === f.month) &&
    (String(new Date(r.date).getFullYear()) === f.year));

  const suppliers = [t('all'), ...new Set(st.suppliers.map(s => s.name))];
  // value = the STORED status string (compared with === above and matched
  // against Postgres rows); label = display only. Never swap the two.
  const statuses = [t('all'),
    { value: 'Approved', label: tr({ id: 'Approved', en: 'Approved', zh: '已批准' }) },
    { value: 'Menunggu Approval', label: tr({ id: 'Menunggu Approval', en: 'Awaiting Approval', zh: '待审批' }) },
    { value: 'Paid', label: tr({ id: 'Paid', en: 'Paid', zh: '已付款' }) },
    { value: 'Open', label: tr({ id: 'Open', en: 'Open', zh: '未结' }) },
    { value: 'Costed', label: tr({ id: 'Costed', en: 'Costed', zh: '已核算成本' }) },
    { value: 'Closed', label: tr({ id: 'Closed', en: 'Closed', zh: '已关闭' }) },
    { value: 'Diterima Finance', label: tr({ id: 'Diterima Finance', en: 'Received by Finance', zh: '财务已接收' }) },
  ];

  const filterBar = h('div.card', { style: { display: 'flex', alignItems: 'flex-end', gap: '10px', padding: '14px 18px', flexWrap: 'wrap' } }, [
    filt(t('rp_module'), [t('all'), ...allowedReportModules(st.user.role)], f.module, v => set({ module: v })),
    filt(t('rp_month'), MONTHS, f.month, v => set({ month: v })),
    filt(t('rp_year'), ['2025', '2026'], f.year, v => set({ year: v })),
    filt(t('rp_status'), statuses, f.status, v => set({ status: v })),
    filt(t('col_supplier'), suppliers, f.supplier, v => set({ supplier: v })),
    filt(t('rp_currency'), [t('all'), 'IDR', 'USD', 'EUR', 'CNY'], f.currency, v => set({ currency: v })),
    btn(t('rp_run'), { variant: 'navy', onClick: () => { setUI({}); toast({ id: `Report: ${rows.length} baris`, en: `Report: ${rows.length} rows`, zh: `报表：${rows.length} 行` }); } }),
  ]);

  const tableCard = h('div.card', [
    h('div.card-head', [
      h('span', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, [h('span.mono', { style: { fontWeight: 600, color: 'var(--text-2)' } }, String(rows.length)), ` ${t('rp_rows')}`]),
      badge(t('rp_drive_note'), 'navy'),
      h('div.mla', btn(t('pk_export'), { variant: 'primary', iconName: 'download', onClick: () => exportReport(rows, f) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_date'), t('rp_module'), t('rp_col_doc'), t('col_supplier'), t('rp_col_value'), t('col_status'), t('rp_col_link')].map((c, i) => h('th' + (i === 4 ? '.r' : ''), c)))),
      h('tbody', rows.length ? rows.map(r => h('tr', [
        h('td.mono', fmtDate(r.date)),
        h('td', badge(r.module, moduleTone(r.module))),
        h('td.mono.cell-strong', r.doc),
        h('td', r.supplier),
        h('td.mono.r', r.value ? money(r.value, r.currency) : '—'),
        // Translated for the eye only — statusToneRp and the filter above both
        // still read the STORED value (see the filter's value/label split).
        h('td', badge(statusText(r.status), statusToneRp(r.status))),
        h('td', driveLink(r.driveUrl)),
      ])) : h('tr', h('td', { colspan: 7, style: { textAlign: 'center', padding: '24px', color: 'var(--text-3)' } }, tr({
        id: 'Tidak ada data untuk filter ini',
        en: 'No data for this filter',
        zh: '此筛选条件下没有数据',
      })))),
    ])),
  ]);

  // outstandingCard reads st.pos DIRECTLY and has its OWN Excel export, so the
  // buildRows() role filter never touched it — sekar (PPKEK/PRF only) still saw
  // every outstanding PO with supplier names and values, and could export them.
  const canSeePO = allowedReportModules(st.user.role).includes('PO');
  return h('div.stack', [filterBar, tableCard, canSeePO ? outstandingCard(st) : null]);
}

// Outstanding POs (goods not yet fully shipped via Surat Jalan). This is a
// current-state snapshot, not a dated event, so it's NOT subject to the
// month/year filter above — it always shows the live picture.
function outstandingCard(st) {
  const rows = outstandingPOs(st);
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', tr({
        id: 'PO Outstanding (barang belum terkirim penuh)',
        en: 'Outstanding POs (goods not yet fully shipped)',
        zh: '未结采购单（货物尚未全部发出）',
      })),
      badge(String(rows.length), rows.length ? 'amber' : 'gray'),
      h('div.mla', btn(t('pk_export'), { iconName: 'download', onClick: () => exportOutstanding(rows) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
        t('col_supplier'),
        tr({ id: 'Baris Outstanding', en: 'Outstanding Lines', zh: '未结行数' }),
        tr({ id: 'Total Qty Outstanding', en: 'Total Outstanding Qty', zh: '未结总数量' }),
      ].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', rows.length ? rows.map(r => h('tr', [
        h('td.mono.cell-strong', r.po.contract || r.po.no), h('td', r.po.supplier),
        h('td.mono', String(r.lines.filter(l => l.outstanding > 0).length)),
        h('td.mono.r', num(r.totalOutstanding)),
      ])) : h('tr', h('td', { colspan: 4, style: { textAlign: 'center', padding: '24px', color: 'var(--text-3)' } }, tr({
        id: 'Semua PO sudah terkirim penuh',
        en: 'Every PO has been fully shipped',
        zh: '所有采购单均已全部发出',
      })))),
    ])),
  ]);
}

async function exportOutstanding(rows) {
  const header = ['No. PO', 'Supplier', 'Baris Outstanding', 'Total Qty Outstanding'];
  const aoa = [header, ...rows.map(r => [r.po.contract || r.po.no, r.po.supplier, r.lines.filter(l => l.outstanding > 0).length, r.totalOutstanding])];
  await writeWorkbook('MTI_PO_Outstanding.xlsx', [{ name: 'Outstanding', aoa }], []);
  toast({
    id: 'Export PO Outstanding — Excel',
    en: 'Outstanding PO export — Excel',
    zh: '未结采购单导出 — Excel',
  });
}

function filt(label, opts, value, onChange) {
  return h('div', [h('div.field-label', label), selectEl(opts, { value, onChange })]);
}
function moduleTone(m) { return { PO: 'accent', PPKEK: 'blue', PRF: 'navy', Label: 'green', Payment: 'green' }[m] || 'gray'; }
function statusToneRp(s) { return /Paid|Approved|Closed/.test(s) ? 'green' : /Menunggu|Open|Awaiting/.test(s) ? 'amber' : 'blue'; }

async function exportReport(rows, f) {
  const header = ['Tanggal', 'Module', 'Dokumen', 'Supplier', 'Currency', 'Nilai', 'Status', 'Drive Link'];
  const aoa = [header, ...rows.map(r => [fmtDate(r.date), r.module, r.doc, r.supplier, r.currency, r.value || '', r.status, r.driveUrl && !r.driveUrl.startsWith('drive-') ? 'Drive' : ''])];
  const hyperlinks = [];
  rows.forEach((r, i) => { if (r.driveUrl && !r.driveUrl.startsWith('drive-')) hyperlinks.push({ sheet: 'Report', cell: `H${i + 2}`, url: r.driveUrl, text: 'Drive' }); });
  // Audit trail tab.
  const st = getState();
  // The audit sheet bypassed the role filter too: it wrote the WHOLE trail,
  // including PRF and payment activity, into a purchasing role's workbook.
  // (RLS already scopes what audit rows a user can fetch, so this is defence in
  // depth rather than the only control — but the export shouldn't widen it.)
  const auditEntities = new Set(allowedReportModules(st.user.role).map(m => ({ PO: 'po', PRF: 'prf', Payment: 'payment', PPKEK: 'ppkek', Label: 'label' }[m])));
  // `|| a.entity === 'supplier'` used to be unconditional, so even a role with
  // NO audit modules received every supplier row — and supplier audit detail
  // spells out proposed bank accounts verbatim (masterData.js logs
  // `usulan {bank} {acct}`).
  //
  // The first attempt tied this to auditEntities.has('po') and that was wrong.
  // It silently stripped the supplier trail from sekar and financemti, and
  // finance is precisely who needs it: they execute the transfer, so "this
  // supplier's bank account was just changed" is their single most useful
  // anti-fraud signal. Narrowing it there traded a theoretical leak for a real
  // loss of oversight.
  //
  // Condition is now simply "this role has some audit scope at all", which
  // restores every role that actually holds the Reports screen while still
  // refusing a zero-module role.
  const seesSuppliers = auditEntities.size > 0;
  const auditRows = st.audit.filter(a => auditEntities.has(a.entity) || (seesSuppliers && a.entity === 'supplier'));
  const auditAoa = [['Waktu', 'User', 'Entity', 'Target', 'Aksi', 'Detail'], ...auditRows.map(a => [fmtDate(a.at), a.user, a.entity, a.target || '', a.action, a.detail || ''])];
  await writeWorkbook(`MTI_Report_${f.module}_${f.month}_${f.year}.xlsx`.replace(/\s/g, ''), [
    { name: 'Report', aoa }, { name: 'Audit Trail', aoa: auditAoa },
  ], hyperlinks);
  toast({
    id: 'Export Excel — hyperlink Drive aktif + tab Audit Trail',
    en: 'Excel export — live Drive hyperlinks + Audit Trail tab',
    zh: 'Excel 导出 — Drive 超链接有效 + 审计日志页',
  });
}
