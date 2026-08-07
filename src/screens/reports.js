import { h } from '../core/dom.js';
import { getState, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, driveLink, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { money, num, fmtDate } from '../core/format.js';
import { statusText } from '../core/statusText.js';
import { writeWorkbook } from '../core/xlsx.js';
import { outstandingPOs } from '../core/outstanding.js';
import { allowedReportModules } from '../auth/roles.js';
// NOTE: buildRows() filtering alone was not enough — outstandingCard() and the
// audit sheet in exportReport() each read state directly and bypassed it.

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

// Kotak penyaring Unified Report — satu per kolom yang benar-benar tampil.
//
// KENAPA DI BALIK SATU TOMBOL
// Enam dropdown ini dulu berdiri permanen di atas tabel: satu baris penuh
// tinggi layar, terpasang setiap hari, padahal yang benar-benar menyaring cuma
// sesekali. Sekarang ongkosnya satu klik, dan cuma dibayar yang memang sedang
// mencari. Yang ikut hilang bersama deretan itu: dua cara mencari hal yang sama
// di satu layar.
//
// KENAPA OPSINYA DARI DATA, BUKAN DAFTAR TETAP
// Dropdown bulan/tahun yang lama menawarkan periode yang belum tentu punya satu
// pun baris — memilih 'Feb 2025' di portal yang datanya mulai Juni menghasilkan
// tabel kosong yang terbaca persis seperti data hilang. Daftar yang isinya cuma
// nilai yang benar-benar ada tidak punya jalan buntu itu. Sumbernya juga sudah
// disaring peran lewat buildRows(), jadi opsinya tidak bisa membocorkan modul
// yang tidak boleh dilihat.
//
// Bulan + tahun sendiri diganti SATU rentang tanggal: pertanyaan yang dibawa
// orang ke sini jarang persis sebulan kalender ("sejak akhir Maret", "kuartal
// lalu"), dan dua dropdown yang harus cocok itu juga berarti tidak ada cara
// melihat lebih dari satu bulan sekaligus.
const MEDAN_REPORT = (semua) => {
  const unik = (ambil) => [...new Set((semua || []).map(ambil).filter(Boolean))].sort();
  return [
    { kunci: 'tgl', label: t('col_date'), tipe: 'tanggal', ambil: r => r.date },
    { kunci: 'module', label: t('rp_module'), tipe: 'pilih', opsi: unik(r => r.module), ambil: r => r.module },
    { kunci: 'doc', label: t('rp_col_doc'), tipe: 'teks', mono: true, ambil: r => r.doc },
    // Supplier jadi kotak teks, bukan dropdown. Daftarnya sepanjang master
    // supplier dan yang mencari biasanya sudah tahu namanya — mengetik tiga
    // huruf lebih pendek daripada menggulung daftar yang isinya ratusan.
    { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
    // Valuta menyaring kolom Value: yang tampil di sana adalah nilai BESERTA
    // valutanya, jadi kotak ini menyaring sesuatu yang memang terlihat.
    { kunci: 'ccy', label: t('rp_currency'), tipe: 'pilih', opsi: unik(r => r.currency), ambil: r => r.currency },
    // Opsi status memakai teks yang TERBACA di kolom Status, bukan nilai
    // simpanannya. Yang memilih di sini sedang menunjuk lencana yang dia lihat;
    // kalau isinya nilai mentah, satu daftar yang sama terlihat seperti dua.
    // Nilai simpanannya tidak ikut berubah — statusText() cuma satu arah.
    { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: unik(r => statusText(r.status)), ambil: r => statusText(r.status) },
  ];
};

export function reportsScreen() {
  const st = getState();

  const semua = buildRows(st);
  const medan = MEDAN_REPORT(semua);
  const nilai = nilaiFilter('rp');
  // Tanpa saringan, yang tampil SELURUHNYA. Dulu bulan+tahun dipaksa terisi
  // bulan berjalan, jadi layar ini selalu dibuka dalam keadaan tersaring tanpa
  // ada yang memintanya — dan awal bulan, ketika belum ada dokumen apa pun,
  // Reports terlihat seperti portal yang kehilangan seluruh isinya.
  const rows = saring(semua, medan, nilai);

  const tableCard = h('div.card', [
    h('div.card-head', [
      hitunganSaring(rows.length, semua.length, { id: 'baris', en: `row${semua.length === 1 ? '' : 's'}`, zh: '行' }),
      tombolFilter({ id: 'rp', medan, judul: tr({ id: 'Saring Unified Report', en: 'Filter Unified Report', zh: '筛选统一报表' }) }),
      badge(t('rp_drive_note'), 'navy'),
      h('div.mla', btn(t('pk_export'), { variant: 'primary', iconName: 'download', onClick: () => exportReport(rows, nilai) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_date'), t('rp_module'), t('rp_col_doc'), t('col_supplier'), t('rp_col_value'), t('col_status'), t('rp_col_link')].map((c, i) => h('th' + (i === 4 ? '.r' : ''), c)))),
      h('tbody', rows.length ? rows.map(r => h('tr', [
        h('td.mono', fmtDate(r.date)),
        h('td', badge(r.module, moduleTone(r.module))),
        h('td.mono.cell-strong', r.doc),
        h('td', r.supplier),
        h('td.mono.r', r.value ? money(r.value, r.currency) : '—'),
        // Translated for the eye only — statusToneRp still reads the STORED
        // value. Kotak status di jendela corong sengaja membandingkan hasil
        // statusText() di kedua sisi, jadi yang dipilih orang sama persis
        // dengan lencana yang dia tunjuk; tidak ada satu pun dari keduanya yang
        // menghasilkan nilai untuk disimpan.
        h('td', badge(statusText(r.status), statusToneRp(r.status))),
        h('td', driveLink(r.driveUrl)),
      ])) : barisTakCocok(7, { id: 'rp', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
  ]);

  // outstandingCard reads st.pos DIRECTLY and has its OWN Excel export, so the
  // buildRows() role filter never touched it — sekar (PPKEK/PRF only) still saw
  // every outstanding PO with supplier names and values, and could export them.
  const canSeePO = allowedReportModules(st.user.role).includes('PO');
  return h('div.stack', [tableCard, canSeePO ? outstandingCard(st) : null]);
}

// Daftar ini cuma punya dua kolom yang bisa dicari orang; dua sisanya angka
// hitungan, dan tidak ada yang datang ke sini mencari "PO dengan tepat 3 baris".
//
// Kotak No. PO menyapu nomor kontrak DAN nomor PO sekaligus walaupun kolomnya
// cuma menampilkan salah satu (kontrak kalau ada). Yang mengetik biasanya
// menyalin dari e-mail atau dari layar lain, dan tidak tahu — tidak perlu tahu
// — nomor mana yang kebetulan menang di kolom itu.
const MEDAN_RP_PO = () => [
  { kunci: 'po', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => `${r.po.contract || ''} ${r.po.no || ''}` },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.po.supplier },
];

// Outstanding POs (goods not yet fully shipped via Surat Jalan). This is a
// current-state snapshot, not a dated event, so it's NOT subject to the date
// range above — it always shows the live picture. Saringannya pun terpisah
// (id 'rp-po'), karena menyempitkan laporan ke satu supplier tidak berarti
// orangnya juga sedang menyempitkan daftar barang yang ditunggu.
function outstandingCard(st) {
  const semua = outstandingPOs(st);
  const medan = MEDAN_RP_PO();
  const nilai = nilaiFilter('rp-po');
  const rows = saring(semua, medan, nilai);
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', tr({
        id: 'PO Outstanding (barang belum terkirim penuh)',
        en: 'Outstanding POs (goods not yet fully shipped)',
        zh: '未结采购单（货物尚未全部发出）',
      })),
      // Menggantikan lencana angka yang lama. Lencana itu cuma tahu satu angka,
      // dan begitu ada saringan, satu angka tidak cukup: daftar yang tinggal 3
      // dari 41 terlihat persis seperti daftar yang memang cuma punya 3.
      hitunganSaring(rows.length, semua.length, { id: 'PO', en: 'PO', zh: '张采购单' }),
      tombolFilter({
        id: 'rp-po', medan,
        judul: tr({ id: 'Saring PO Outstanding', en: 'Filter Outstanding POs', zh: '筛选未结采购单' }),
      }),
      // Yang diekspor adalah yang TERLIHAT. Tombol ekspor yang diam-diam
      // mengambil lebih banyak daripada yang ada di layar menghasilkan berkas
      // yang isinya tidak bisa dijelaskan oleh orang yang mengirimnya.
      h('div.mla', btn(t('pk_export'), { iconName: 'download', onClick: () => exportOutstanding(rows) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
        t('col_supplier'),
        tr({ id: 'Baris Outstanding', en: 'Outstanding Lines', zh: '未结行数' }),
        tr({ id: 'Total Qty Outstanding', en: 'Total Outstanding Qty', zh: '未结总数量' }),
      ].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      // Kosong karena saringan dan kosong karena semuanya memang sudah terkirim
      // adalah dua kabar yang berbeda — yang kedua itu kabar BAIK, dan
      // menggantinya dengan "belum ada data" membuang satu-satunya kalimat di
      // kartu ini yang bilang pekerjaannya beres.
      h('tbody', rows.length ? rows.map(r => h('tr', [
        h('td.mono.cell-strong', r.po.contract || r.po.no), h('td', r.po.supplier),
        h('td.mono', String(r.lines.filter(l => l.outstanding > 0).length)),
        h('td.mono.r', num(r.totalOutstanding)),
      ])) : jumlahFilterAktif(nilai) > 0
        ? barisTakCocok(4, { id: 'rp-po', adaFilter: true })
        : h('tr', h('td', { colspan: 4, style: { textAlign: 'center', padding: '24px', color: 'var(--text-3)' } }, tr({
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

function moduleTone(m) { return { PO: 'accent', PPKEK: 'blue', PRF: 'navy', Label: 'green', Payment: 'green' }[m] || 'gray'; }
function statusToneRp(s) { return /Paid|Approved|Closed/.test(s) ? 'green' : /Menunggu|Open|Awaiting/.test(s) ? 'amber' : 'blue'; }

async function exportReport(rows, nilai) {
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
  // Nama berkasnya menyebutkan saringan yang menyala. Dulu selalu berisi
  // module_bulan_tahun karena ketiganya WAJIB terisi; sekarang kotaknya boleh
  // dikosongkan, jadi yang kosong tidak ikut disebut — dan dua ekspor berbeda
  // di hari yang sama tetap tidak saling menimpa di folder Download.
  const rentang = nilai && nilai.tgl ? [nilai.tgl.dari, nilai.tgl.sampai].filter(Boolean).join('-') : '';
  const nama = ['MTI_Report', (nilai || {}).module, (nilai || {}).ccy, (nilai || {}).status, rentang]
    .filter(Boolean).join('_').replace(/[\s/\\:*?"<>|]+/g, '');
  await writeWorkbook(`${nama}.xlsx`, [
    { name: 'Report', aoa }, { name: 'Audit Trail', aoa: auditAoa },
  ], hyperlinks);
  toast({
    id: 'Export Excel — hyperlink Drive aktif + tab Audit Trail',
    en: 'Excel export — live Drive hyperlinks + Audit Trail tab',
    zh: 'Excel 导出 — Drive 超链接有效 + 审计日志页',
  });
}
