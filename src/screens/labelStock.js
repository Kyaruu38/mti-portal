// Label Inventory Tracker — stock, buy/don't-buy lists, upload history.
//
// The Excel workbook stays the source of truth (owner's decision): every number
// shown here comes from the sheet unchanged. The portal ALSO recomputes each
// derived column and flags disagreements — see parsers/labelStock.js. It never
// substitutes its own figure.
//
// Tab names mirror the workbook (Master Tracker / BUY NOW / DO NOT BUY) so
// nobody has to learn a second vocabulary for the same job — but only in ID and
// EN, where the workbook's own wording IS the local wording. In Chinese the
// mirror stopped helping: the tab bar was the last strip of untranslated
// English on an otherwise Chinese screen, and "DO NOT BUY" is not a phrase a
// zh reader can guess. So zh gets real Chinese and the workbook link is carried
// by the numbers next to it, which are identical either way.
import { h, wireDrop } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit, uid } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, selectEl, pager, pageSlice, PAGE_DEFAULT, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { num, money, fmtDate, fmtDateTime } from '../core/format.js';
import { parseNumber, qtyInputText } from '../parsers/numbers.js';
import { readWorkbook, writeWorkbook } from '../core/xlsx.js';
import { parseLabelStockSheet, STATUSES, guessErp, requirementOf, suggestedQtyOf, statusOf } from '../parsers/labelStock.js';
import {
  fileHasKind, describeFile, planSheetName, planMonth,
  parseProductionPlan, parseSalesPlan, applyPlansToStock,
} from '../parsers/planFiles.js';
import { parseLabelSheet } from '../parsers/excelLabels.js';
import { petakanWorkbook, labelKategori } from '../parsers/labelSheetSet.js';
import { susunDaftarBeli, gabungDenganPortal, TANDA, bolehPilihSemua } from '../core/labelBuyList.js';
import { labelOrders, erpCandidates, recentOrdersFor, REORDER_WINDOW_DAYS } from '../core/labelOrders.js';
import { applyLabelStockUpload, fetchLabelStock, fetchLabelUploads, setLabelStockErp } from '../core/labelStockApi.js';
import { isConfigured } from '../core/supabase.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { insertLabelRequest } from '../core/labelRequestsApi.js';

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
    ['master', tr({
      id: `Master Tracker · ${rows.length}`,
      en: `Master Tracker · ${rows.length}`,
      zh: `主跟踪表 · ${rows.length}`,
    })],
    // Angka di tab BUY NOW menghitung daftar gabungan (diminta di file +
    // hitungan portal), bukan cuma hitungan portal. Kalau tidak, tab bertuliskan
    // 22 lalu terbuka berisi 150 baris — dan angka yang berbohong di tab bar
    // adalah angka yang membuat orang berhenti mempercayai tab bar.
    ['buy', tr({
      id: `BUY NOW · ${jumlahBeli(st)}`,
      en: `BUY NOW · ${jumlahBeli(st)}`,
      zh: `需采购 · ${jumlahBeli(st)}`,
    })],
    ['nobuy', tr({
      id: `DO NOT BUY · ${rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK').length}`,
      en: `DO NOT BUY · ${rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK').length}`,
      zh: `请勿采购 · ${rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK').length}`,
    })],
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
  // Pindah tab SELALU mengembalikan ketiga daftar berhalaman ke halaman 1.
  // lsjPage ikut sejak DO NOT BUY punya nomor halaman sendiri: kalau dia
  // ketinggalan di sini, orang yang meninggalkan DO NOT BUY di halaman 6 lalu
  // kembali setelah upload baru (yang biasanya memendekkan daftarnya) mendarat
  // di halaman kosong — dan halaman kosong terbaca persis seperti data hilang.
  const tabBar = h('div.row.gap8.wrap', tabs.map(([id, label]) =>
    h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ lsTab: id, lsPage: 1, lsjPage: 1, lsbPage: 1 }) }, label)));

  let body;
  if (tab === 'buy') body = buyNowTab(st);
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
// TIGA KOTAK TERPISAH, BUKAN SATU KOTAK PINTAR
// ---------------------------------------------------------------------------
// Satu kotak yang mengenali sendiri jenis filenya lebih sedikit kodenya dan
// lebih mengesankan. Tapi kotak seperti itu tidak punya tempat untuk menuliskan
// APA yang seharusnya masuk — dan ketika dia salah tebak, tidak ada yang tahu
// sampai angkanya sudah tersimpan.
//
// Tiga kotak bernomor menaruh instruksinya di layar, permanen, di sebelah
// tempat filenya dijatuhkan. Setiap kotak juga menolak file yang bukan haknya
// dan MENYEBUTKAN nomor kotak yang benar. Salah kotak adalah kesalahan yang
// paling mungkin terjadi di layar ini; ditangkap di sini, dia tidak pernah
// menjadi angka yang salah.
//
// Nomor 1 wajib. Nomor 2 dan 3 boleh kosong — kalau kosong, angka rencananya
// tetap seperti yang tertulis di Excel, persis seperti sebelum fitur ini ada.
//
// KOTAKNYA CUMA MENAMPILKAN NAMA FILENYA. TIDAK ADA PENJELASAN.
// ---------------------------------------------------------------------------
// Versi pertama menaruh satu baris keterangan di bawah tiap nama file —
// "Wajib · berisi sheet Master Tracker", "Dari PPIC · yang menentukan berapa
// label dibutuhkan". Niatnya membantu. Hasilnya tiga kotak yang masing-masing
// minta dibaca dulu sebelum bisa dipakai, di layar yang tugasnya cuma
// "taruh file di sini".
//
// Yang benar-benar dibutuhkan orang yang sedang memegang file cuma satu:
// NAMA FILENYA, supaya dia bisa mencocokkan dengan yang ada di tangannya.
// Sisanya sudah dijelaskan panduan, dan yang salah kotak toh ditolak sambil
// disebutkan kotak yang benar — jaring itu bekerja tanpa perlu dibaca lebih
// dulu.
const BOXES = [
  {
    n: 1, kind: 'tracker', required: true,
    title: { id: 'Stok Label', en: 'Label Stock', zh: '标签库存' },
    // Nama berkasnya TIDAK diterjemahkan — yang dipegang orangnya memang
    // bernama "Label Inventory Tracker.xlsx", dan nama Tionghoa yang cantik di
    // layar tidak akan pernah cocok dengan apa pun di Windows Explorer-nya.
    // Yang ditambahkan cuma artinya, di dalam kurung.
    file:  { id: 'Label Inventory Tracker.xlsx', en: 'Label Inventory Tracker.xlsx', zh: 'Label Inventory Tracker.xlsx（标签库存表）' },
  },
  {
    n: 2, kind: 'production', required: false,
    title: { id: 'Rencana Produksi', en: 'Production Plan', zh: '排产计划' },
    file:  { id: '…月份排产计划.xlsx', en: '…月份排产计划.xlsx', zh: '…月份排产计划.xlsx' },
  },
  {
    n: 3, kind: 'sales', required: false,
    title: { id: 'Rencana Penjualan', en: 'Sales Plan', zh: '销售需求表' },
    file:  { id: 'sheet 销售需求表', en: 'sheet 销售需求表', zh: '销售需求表' },
  },
];

const BOX_STATE = { tracker: 'lsBox1', production: 'lsBox2', sales: 'lsBox3' };

function boxTile(st, box) {
  const ui = st.ui;
  const loaded = ui[BOX_STATE[box.kind]];
  const numChip = h('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '20px', height: '20px', borderRadius: '999px', flex: '0 0 20px',
      fontSize: '11px', fontWeight: 800,
      background: loaded ? 'var(--st-green-tx)' : 'var(--text-3)', color: '#fff',
    },
  }, String(box.n));

  const head = h('div.row.gap8', { style: { alignItems: 'center', marginBottom: '6px' } }, [
    numChip,
    h('div', { style: { fontSize: '13px', fontWeight: 700 } }, tr(box.title)),
    box.required ? null : h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } },
      tr({ id: '(boleh dikosongkan)', en: '(may be left empty)', zh: '（可留空）' })),
  ]);

  const body = loaded
    ? h('div', {
        style: {
          border: '1px solid var(--st-green-tx)', background: 'var(--st-green-bg)',
          color: 'var(--st-green-tx)', borderRadius: '10px', padding: '14px',
          minHeight: '150px', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: '4px',
        },
      }, [
        h('div.row.gap8', { style: { alignItems: 'center' } }, [icon('check', 14),
          h('span', { style: { fontSize: '12px', fontWeight: 700 } }, tr({ id: 'Sudah masuk', en: 'Loaded', zh: '已载入' }))]),
        h('div.mono', { style: { fontSize: '10.5px', wordBreak: 'break-all' } }, loaded.fileName),
        h('div', { style: { fontSize: '10.5px', opacity: .85 } }, loaded.note || ''),
        h('div', { style: { marginTop: '6px' } }, [
          btn(tr({ id: 'Ganti', en: 'Replace', zh: '更换' }), {
            sm: true, iconName: 'x',
            onClick: () => clearBox(box.kind),
          }),
        ]),
      ])
    : dropzone({
        title: tr(box.file),
        accept: '.xlsx,.xls', iconName: 'upload', compact: true,
        onFiles: f => handleBoxFile(box, f[0]),
      });

  return h('div', [head, body]);
}

function uploadCard(st) {
  const ui = st.ui;
  if (!can(st.user.role, 'labelStockWrite')) return null;
  const ready = !!ui.lsSheets;

  const gabung = ui.lsMode === 'gabung';

  return card([h('div.card-pad', [
    // Dua cara memberi file, karena kenyataannya memang dua.
    //
    // Sona kadang sudah menyatukan stok, rencana produksi, dan rencana
    // penjualan dalam SATU workbook — dan memaksanya memecah file yang sudah
    // jadi cuma untuk memenuhi bentuk layar ini adalah pekerjaan tambahan yang
    // tidak menghasilkan apa-apa. Dua-duanya dibaca dengan parser yang sama
    // persis; yang berbeda cuma berapa berkas yang dijatuhkan.
    h('div.row.gap8', { style: { marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' } }, [
      h('span', { style: { fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 700 } }, tr({
        id: 'Cara unggah', en: 'Upload mode', zh: '上传方式',
      })),
      ...[
        { v: 'pisah',  l: { id: 'File terpisah', en: 'Separate files', zh: '分开的文件' } },
        { v: 'gabung', l: { id: '1 file, banyak sheet', en: 'One file, many sheets', zh: '一个文件，多个工作表' } },
      ].map(o => h('button.btn.btn-sm', {
        style: o.v === (ui.lsMode || 'pisah')
          ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', fontWeight: 700 }
          : {},
        // Ganti cara TIDAK membuang yang sudah diunggah. Orang yang salah pilih
        // lalu membetulkannya tidak boleh kehilangan file yang sudah masuk.
        onClick: () => setUI({ lsMode: o.v }),
      }, tr(o.l))),
    ]),

    h('div', { style: { fontSize: '12.5px', color: 'var(--text-2)', marginBottom: '10px' } }, gabung
      ? tr({
          id: 'Taruh satu workbook yang berisi semuanya. Portal membaca sheet mana yang ada, dan menyebut yang tidak ketemu.',
          en: 'Drop one workbook containing everything. The portal reads whichever sheets are there, and names the ones it cannot find.',
          zh: '放入一个包含全部内容的工作簿。系统会读取其中存在的工作表，并列出找不到的部分。',
        })
      : tr({
          id: 'Taruh tiap file di kotak bernomornya. Salah kotak pasti ditolak.',
          en: 'Drop each file in its numbered box. A file in the wrong box is always refused.',
          zh: '请将每个文件放入对应编号的方框。放错方框一定会被拒绝。',
        })),

    // Bukan .g3: kelas itu mengunci tiga kolom dan tidak ada satu pun media
    // query di seluruh stylesheet, jadi di layar sempit tiga kotak unggah
    // saling menghimpit sampai tulisannya tidak terbaca. auto-fit menumpuknya
    // sendiri tanpa menyentuh CSS global.
    gabung
      ? kotakGabung(st)
      : h('div', {
          style: {
            display: 'grid', gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          },
        }, BOXES.map(b => boxTile(st, b))),

    ready ? h('div.row.gap8.wrap', { style: { marginTop: '14px', alignItems: 'flex-end' } }, [
      h('div', [
        h('div.field-label', tr({ id: 'Sheet stok (kotak 1)', en: 'Stock sheet (box 1)', zh: '库存工作表（第 1 项）' })),
        selectEl(ui.lsSheets.map(s => ({
          value: s.name,
          label: tr({ id: `${s.name} (${s.count} baris)`, en: `${s.name} (${s.count} rows)`, zh: `${s.name}（${s.count} 行）` }),
        })), { value: ui.lsSheet, onChange: v => setUI({ lsSheet: v }) }),
      ]),
      btn(tr({ id: 'Baca & cek →', en: 'Read & check →', zh: '读取并核对 →' }), { variant: 'primary', onClick: () => parseSheet() }),
      btn(tr({ id: 'Batal', en: 'Cancel', zh: '取消' }), { onClick: () => clearAllBoxes() }),
    ]) : null,
  ])]);
}

// Satu kotak untuk workbook gabungan. Ringkasan di bawahnya menyebut apa yang
// KETEMU dan apa yang TIDAK — bukan cuma yang ketemu. File yang kurang satu
// sheet terlihat persis sama dengan file yang lengkap kalau yang dilaporkan
// hanya keberhasilan.
function kotakGabung(st) {
  const ui = st.ui;
  const isi = BOXES.map(b => ({ box: b, ada: !!ui[BOX_STATE[b.kind]] }));
  const adaIsi = isi.some(x => x.ada);

  const tile = h('div', {
    style: {
      border: '1.5px dashed var(--border-strong)', borderRadius: '12px',
      padding: '26px 18px', textAlign: 'center', cursor: 'pointer',
      background: adaIsi ? 'var(--st-green-bg)' : 'var(--surface2)',
      borderColor: adaIsi ? 'var(--st-green-tx)' : 'var(--border-strong)',
    },
  }, [
    h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '10px' } },
      icon('upload', 22, { stroke: adaIsi ? 'var(--st-green-tx)' : 'var(--accent)' })),
    h('div', { style: { fontWeight: 700, fontSize: '13px' } }, tr({
      id: 'Satu file berisi semuanya', en: 'One file with everything', zh: '包含全部内容的单一文件',
    })),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' } },
      'Master Tracker · 排产计划 · 销售需求'),
  ]);
  wireDrop(tile, { accept: '.xlsx,.xls', onFiles: f => handleCombinedFile(f[0]) });

  return h('div', [
    tile,
    adaIsi ? h('div', { style: { marginTop: '12px', display: 'grid', gap: '6px' } }, isi.map(x => h('div.row.gap8', {
      style: { fontSize: '12px', alignItems: 'center' },
    }, [
      icon(x.ada ? 'check' : 'x', 13, { stroke: x.ada ? 'var(--st-green-tx)' : 'var(--st-red-tx)' }),
      h('span', { style: { color: x.ada ? 'var(--text)' : 'var(--text-3)' } }, tr(x.box.title)),
      h('span.grow'),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } },
        x.ada ? (ui[BOX_STATE[x.box.kind]].note || '') : tr({ id: 'tidak ada di file', en: 'not in the file', zh: '文件中没有' })),
    ]))) : null,
    adaIsi ? h('div.row.gap8', { style: { marginTop: '10px' } }, [
      btn(tr({ id: 'Kosongkan', en: 'Clear', zh: '清空' }), { sm: true, onClick: () => clearAllBoxes() }),
    ]) : null,
  ]);
}

// Satu workbook, sekali baca, semua jenis yang ada di dalamnya dipakai.
//
// Dibaca SEKALI lalu dipakai berkali-kali — bukan dibaca ulang per jenis.
// Workbook stok label itu ratusan ribu sel; membacanya tiga kali membekukan
// tab selama beberapa detik tanpa alasan.
async function handleCombinedFile(file) {
  if (blockWrite('upload file stok label')) return;
  if (!file) return;
  toast({ id: 'Membaca file…', en: 'Reading file…', zh: '正在读取文件…' });

  let wb;
  try {
    wb = await readWorkbook(file);
  } catch (e) {
    console.error(e);
    toast({
      id: 'Gagal membaca Excel: ' + (e.message || e),
      en: 'Failed to read Excel: ' + (e.message || e),
      zh: '读取 Excel 失败：' + (e.message || e),
    });
    return;
  }

  const jenis = BOXES.map(b => b.kind).filter(k => fileHasKind(wb.sheetNames, k));
  if (!jenis.length) {
    toast({
      id: 'File ini tidak berisi satu pun sheet yang dikenali (Master Tracker / 排产计划 / 销售需求).',
      en: 'This file contains none of the expected sheets (Master Tracker / 排产计划 / 销售需求).',
      zh: '此文件不包含任何可识别的工作表（Master Tracker / 排产计划 / 销售需求）。',
    });
    return;
  }

  clearAllBoxes();
  const gagal = [];
  for (const kind of jenis) {
    const err = await terapkanKotak(kind, wb, file.name);
    if (err) gagal.push(`${tr(BOX_OF_KIND(kind).title)}: ${typeof err === 'string' ? err : tr(err)}`);
  }

  const dapat = jenis.filter(k => !gagal.some(g => g.startsWith(tr(BOX_OF_KIND(k).title))));
  const kurang = BOXES.map(b => b.kind).filter(k => !dapat.includes(k));
  toast({
    id: `${dapat.length} bagian terbaca${kurang.length ? ` · tidak ada: ${kurang.map(k => tr(BOX_OF_KIND(k).title)).join(', ')}` : ''}`,
    en: `${dapat.length} part(s) read${kurang.length ? ` · missing: ${kurang.map(k => tr(BOX_OF_KIND(k).title)).join(', ')}` : ''}`,
    zh: `已读取 ${dapat.length} 部分${kurang.length ? ` · 缺少：${kurang.map(k => tr(BOX_OF_KIND(k).title)).join('、')}` : ''}`,
  });
  if (gagal.length) console.warn('bagian yang gagal dibaca:', gagal);
}

// Nama kotak untuk pesan penolakan. Menyebut nomornya, bukan cuma namanya:
// nomornya yang tercetak besar di layar.
const BOX_OF_KIND = k => BOXES.find(b => b.kind === k);

function boxName(kind) {
  const b = BOX_OF_KIND(kind);
  return b ? `${b.n} (${tr(b.title)})` : '?';
}

async function handleBoxFile(box, file) {
  if (blockWrite('upload file stok label')) return;
  if (!file) return;
  toast({ id: 'Membaca file…', en: 'Reading file…', zh: '正在读取文件…' });

  let wb;
  try {
    wb = await readWorkbook(file);
  } catch (e) {
    console.error(e);
    toast({
      id: 'Gagal membaca Excel: ' + (e.message || e),
      en: 'Failed to read Excel: ' + (e.message || e),
      zh: '读取 Excel 失败：' + (e.message || e),
    });
    return;
  }

  // Penolakan salah kotak. Ditanya "file ini punya yang kotak ini butuh?",
  // bukan "file ini jenis apa" — file contoh berisi rencana produksi DAN
  // penjualan dalam satu workbook, jadi file yang sama sah untuk kotak 2 dan 3.
  if (!fileHasKind(wb.sheetNames, box.kind)) {
    const actual = describeFile(wb.sheetNames);
    toast(actual
      ? {
          id: `Salah kotak. Ini file ${tr(BOX_OF_KIND(actual).title)} — taruh di kotak ${boxName(actual)}.`,
          en: `Wrong box. This is the ${tr(BOX_OF_KIND(actual).title)} file — drop it in box ${boxName(actual)}.`,
          zh: `方框有误。这是${tr(BOX_OF_KIND(actual).title)}文件 — 请放入第 ${boxName(actual)} 框。`,
        }
      : {
          id: `File ini tidak dikenali. Kotak ${box.n} butuh ${tr(box.file)}.`,
          en: `This file is not recognised. Box ${box.n} needs ${tr(box.file)}.`,
          zh: `无法识别此文件。第 ${box.n} 框需要 ${tr(box.file)}。`,
        });
    return;
  }

  const err = await terapkanKotak(box.kind, wb, file.name);
  if (err) toast(err);
}

// SATU JALUR, DIPAKAI DUA CARA UNGGAH
// ---------------------------------------------------------------------------
// Baik tiga kotak terpisah maupun satu workbook gabungan berakhir di sini.
// Kalau masing-masing punya salinan logikanya sendiri, perbaikan di salah satu
// diam-diam tidak sampai ke yang lain — dan yang paling mungkin lupa diperbarui
// justru jalur gabungan, yang lebih jarang dipakai sehingga lebih jarang
// ketahuan salah.
//
// Mengembalikan pesan kesalahan (objek tr) atau null kalau berhasil. TIDAK
// memanggil toast sendiri: pemanggil gabungan mengumpulkan beberapa kegagalan
// sekaligus, dan tiga toast berturut-turut saling menimpa sampai yang terbaca
// cuma yang terakhir.
async function terapkanKotak(kind, wb, fileName) {
  if (kind === 'tracker') {
    const sheets = wb.sheetNames.map(n => ({ name: n, count: wb.countRows(n) }));
    const pref = sheets.find(s => /master\s*tracker/i.test(s.name)) || sheets[0];
    setUI({
      lsWb: wb, lsSheets: sheets, lsSheet: (pref || {}).name, lsFile: fileName,
      lsBox1: { fileName, note: tr({ id: `${sheets.length} sheet`, en: `${sheets.length} sheets`, zh: `${sheets.length} 个工作表` }) },
      // Workbook yang sama biasanya juga membawa daftar belinya. Dibaca di sini,
      // disimpan mentah, dan baru diadu dengan stok SETELAH stoknya tersimpan —
      // lihat catatan di applyUpload().
      lsOrder: bacaSheetOrder(wb, fileName),
    });
    return null;
  }

  // Rencana: langsung dibaca. Tidak ada pilihan sheet — nama sheetnya sendiri
  // yang menentukan, dan itu sudah diverifikasi ke file Juli maupun Agustus.
  const sheetName = planSheetName(wb.sheetNames, kind);
  const parse = kind === 'production' ? parseProductionPlan : parseSalesPlan;
  let res;
  try {
    res = parse(wb.rows(sheetName));
  } catch (e) {
    console.error(e);
    return { id: 'Gagal baca rencana: ' + (e.message || e), en: 'Failed to read the plan: ' + (e.message || e), zh: '读取计划失败：' + (e.message || e) };
  }
  if (!res.ok) return res.error;

  const month = planMonth(sheetName);
  setUI({
    [BOX_STATE[kind]]: {
      fileName,
      sheetName,
      month,
      plan: res,
      note: tr({
        id: `${num(res.stats.specs)} spec · ${num(res.stats.total)} pcs${month ? ` · bulan ${month}` : ''}`,
        en: `${num(res.stats.specs)} specs · ${num(res.stats.total)} pcs${month ? ` · month ${month}` : ''}`,
        zh: `${num(res.stats.specs)} 个规格 · ${num(res.stats.total)} 条${month ? ` · ${month} 月` : ''}`,
      }),
    },
  });
  return null;
}

// DAFTAR BELI IKUT DIBACA DARI WORKBOOK YANG SAMA
// ---------------------------------------------------------------------------
// Berkas bulanan sona berisi tiga hal, bukan dua: stok, rencana, DAN daftar
// yang mau dibeli (sheet local / export / newitems / 加急优先下单). Selama ini
// yang ketiga dilewati, lalu disusun ulang dengan tangan di layar lain.
//
// Sheet order dikenali dari HEADER-nya, bukan namanya — nama sheet berubah tiap
// bulan dan tiap orang, kolomnya tidak. Diuji ke berkas Agustus: 4 sheet order
// lolos, 10 sheet produksi (排产计划, 轮胎重量, 硫化工艺, …) semuanya ditolak,
// termasuk 排产计划 yang punya kolom 市场 dan tetap ditolak karena tidak punya
// ERP CODE.
//
// Sheet yang gagal diparse TIDAK menjatuhkan sisanya — dia dicatat di `gagal`
// dan yang lain jalan terus. Ini fitur pinggiran; unggah stok tidak boleh mati
// karenanya.
function bacaSheetOrder(wb, fileName) {
  let peta;
  try {
    peta = petakanWorkbook(wb.sheetNames, n => wb.headRows(n, 8));
  } catch (e) {
    console.warn('deteksi sheet order gagal (tidak fatal):', e);
    return null;
  }
  if (!peta.order.length) return null;

  const st = getState();
  const knownErps = new Set((st.items || []).map(i => i.erp).filter(Boolean));
  const bagian = [], gagal = [];
  for (const o of peta.order) {
    try {
      const res = parseLabelSheet(wb.rows(o.nama), { brandMap: st.brandMap || [], knownErps });
      if (!res.ok) { gagal.push({ sheet: o.nama, alasan: tr(res.error) }); continue; }
      bagian.push({ sheet: o.nama, kategori: o.kategori, items: res.items });
    } catch (e) {
      console.warn('sheet order gagal diparse:', o.nama, e);
      gagal.push({ sheet: o.nama, alasan: String((e && e.message) || e) });
    }
  }
  if (!bagian.length) return null;
  return { fileName, at: new Date().toISOString(), bagian, gagal, bukan: peta.bukan };
}

function clearBox(kind) {
  if (kind === 'tracker') { setUI({ lsBox1: null, lsWb: null, lsSheets: null, lsSheet: null, lsFile: null }); return; }
  setUI({ [BOX_STATE[kind]]: null });
}

function clearAllBoxes() {
  setUI({ lsBox1: null, lsBox2: null, lsBox3: null, lsWb: null, lsSheets: null, lsSheet: null, lsFile: null });
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

  // Rencana ditimpakan SEBELUM diff dihitung, supaya yang dilihat orang di
  // preview persis yang akan tersimpan — bukan angka Excel yang beberapa detik
  // kemudian diam-diam diganti.
  const prod  = ui.lsBox2 && ui.lsBox2.plan;
  const sales = ui.lsBox3 && ui.lsBox3.plan;
  let plan = null;
  if (prod || sales) {
    try {
      plan = applyPlansToStock(res.items, prod, sales, {
        calc: { requirementOf, suggestedQtyOf, statusOf },
        moq: (st.labelSettings || {}).moq || 500,
        overstockMultiple: (st.labelSettings || {}).overstockMultiple || 2,
      });
      res = { ...res, items: plan.items };
    } catch (e) {
      // Aturan yang sudah berlaku di seluruh portal: fitur pinggiran tidak
      // boleh menjatuhkan fitur inti. Unggah stok tetap jalan tanpa rencana.
      console.error('overlay rencana gagal (tidak fatal):', e);
      plan = null;
      toast({
        id: 'Rencana gagal diterapkan — unggahan stok tetap dilanjutkan tanpa itu.',
        en: 'The plan could not be applied — the stock upload continues without it.',
        zh: '计划应用失败 — 库存上传将在不含计划的情况下继续。',
      });
    }
  }

  setUI({
    lsPreview: {
      res, plan,
      planMeta: {
        production: ui.lsBox2 ? { fileName: ui.lsBox2.fileName, month: ui.lsBox2.month, stats: ui.lsBox2.plan.stats } : null,
        sales:      ui.lsBox3 ? { fileName: ui.lsBox3.fileName, month: ui.lsBox3.month, stats: ui.lsBox3.plan.stats } : null,
      },
      diff: buildDiff(st.labelStock || [], res.items),
      fileName: ui.lsFile, sheetName: ui.lsSheet,
    },
  });
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

// Apa yang berubah karena file rencana. Ditaruh DI ATAS ringkasan stok karena
// inilah bagian yang baru dan yang paling mungkin mengagetkan: status BUY NOW
// bisa berubah untuk ratusan SKU sekaligus, dan itu harus terlihat sebelum
// disimpan, bukan sesudah.
function planBlock(plan, meta) {
  const s = plan.stats;
  const line = (label, v, tone) => h('div.row.gap8', { style: { justifyContent: 'space-between', fontSize: '12px' } }, [
    h('span', label),
    h('span.mono', { style: { fontWeight: 700, color: tone ? `var(--st-${tone}-tx)` : 'var(--text)' } }, num(v)),
  ]);

  const src = [
    meta.production ? tr({
      id: `Produksi: ${meta.production.fileName}${meta.production.month ? ` (bulan ${meta.production.month})` : ''} — ${num(meta.production.stats.specs)} spec`,
      en: `Production: ${meta.production.fileName}${meta.production.month ? ` (month ${meta.production.month})` : ''} — ${num(meta.production.stats.specs)} specs`,
      zh: `排产：${meta.production.fileName}${meta.production.month ? `（${meta.production.month} 月）` : ''} — ${num(meta.production.stats.specs)} 个规格`,
    }) : null,
    meta.sales ? tr({
      id: `Penjualan: ${meta.sales.fileName} — ${num(meta.sales.stats.specs)} spec`,
      en: `Sales: ${meta.sales.fileName} — ${num(meta.sales.stats.specs)} specs`,
      zh: `销售：${meta.sales.fileName} — ${num(meta.sales.stats.specs)} 个规格`,
    }) : null,
  ].filter(Boolean);

  return card([h('div.card-pad', [
    h('div.card-title', { style: { marginBottom: '6px' } },
      tr({ id: 'Angka rencana diambil dari file, bukan dari Excel stok', en: 'Plan figures taken from the plan files, not from the stock sheet', zh: '计划数值取自计划文件，而非库存表' })),
    ...src.map(t => h('div.mono', { style: { fontSize: '10px', color: 'var(--text-3)' } }, t)),
    h('div.stack', { style: { gap: '3px', marginTop: '8px' } }, [
      line(tr({ id: 'SKU angkanya dikoreksi', en: 'SKU with a corrected figure', zh: '数值被修正的 SKU' }), s.touched, 'blue'),
      line(tr({ id: '  · rencana naik', en: '  · plan higher', zh: '  · 计划上调' }), s.raised),
      line(tr({ id: '  · rencana turun', en: '  · plan lower', zh: '  · 计划下调' }), s.lowered),
      line(tr({ id: 'Jadi BUY NOW (tadinya bukan)', en: 'Now BUY NOW (was not)', zh: '变为需采购（此前不是）' }), s.toBuyNow, s.toBuyNow ? 'red' : null),
      line(tr({ id: 'Keluar dari BUY NOW', en: 'No longer BUY NOW', zh: '不再需采购' }), s.leftBuyNow, s.leftBuyNow ? 'green' : null),
      line(tr({ id: 'Tidak ada di rencana — dibiarkan', en: 'Not in the plan — left alone', zh: '不在计划中 — 保持原样' }), s.unplanned, 'amber'),
    ]),
    s.viaPrefix ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '6px' } }, [
      h('span', { style: { fontWeight: 700 } }, tr({
        id: `${s.viaPrefix} SKU dicocokkan lewat awalan nama`,
        en: `${s.viaPrefix} SKU matched on a name prefix`,
        zh: `${s.viaPrefix} 个 SKU 按名称前缀匹配`,
      })),
      ' ',
      tr({
        id: '— nama di tracker punya imbuhan kode E-mark yang tidak ada di file rencana. Hanya diterima kalau cuma ada satu kandidat.',
        en: '— the tracker name carries an E-mark suffix the plan file omits. Accepted only where exactly one candidate exists.',
        zh: '— 跟踪表名称带有计划文件中没有的 E-mark 后缀。仅在唯一候选时接受。',
      }),
      ...(plan.viaPrefix || []).slice(0, 3).map(v => h('div.mono', { style: { fontSize: '9.5px' } }, `• ${v.rencana.slice(0, 40)} → ${v.tracker.slice(0, 40)}`)),
    ]) : null,
    s.unplanned ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '6px' } }, tr({
      id: `${num(s.unplanned)} SKU tidak ketemu di file rencana. Angkanya TIDAK dinolkan — nama spec belum cocok 100%, dan menandai mereka nganggur berarti menyuruh orang berhenti pesan label untuk barang yang mungkin sedang jalan.`,
      en: `${num(s.unplanned)} SKU were not found in the plan files. Their figures are NOT zeroed — spec names do not match 100% yet, and marking them idle would tell people to stop ordering labels for goods that may be running.`,
      zh: `${num(s.unplanned)} 个 SKU 未在计划文件中找到。其数值不会归零 — 规格名称尚未 100% 匹配，将其标记为呆滞会导致停止为在产品订购标签。`,
    })) : null,
    plan.changed.length ? h('div', { style: { marginTop: '8px' } }, [
      h('div', { style: { fontSize: '11px', fontWeight: 700, marginBottom: '3px' } },
        tr({ id: 'Koreksi terbesar', en: 'Largest corrections', zh: '最大修正' })),
      ...plan.changed.slice(0, 6).map(c => h('div.mono', { style: { fontSize: '10px' } },
        `• ${c.spec.slice(0, 42)} — ${num(c.before)} → ${num(c.after)}${c.statusBefore !== c.statusAfter ? `  (${c.statusBefore} → ${c.statusAfter})` : ''}`)),
      plan.changed.length > 6 ? h('div', { style: { fontSize: '10px', color: 'var(--text-3)' } }, tr({
        id: `…dan ${plan.changed.length - 6} lagi`,
        en: `…and ${plan.changed.length - 6} more`,
        zh: `…还有 ${plan.changed.length - 6} 个`,
      })) : null,
    ]) : null,
  ])]);
}

function previewModal(st) {
  const { res, diff, fileName, sheetName, plan, planMeta } = st.ui.lsPreview;
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

      plan ? planBlock(plan, planMeta) : null,
      plan && plan.stats.takAdaBarisnya ? noRowBanner(plan) : null,

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
  const { res, fileName, sheetName, plan, planMeta } = p;

  // Nama file rencana ikut tersimpan di Riwayat Upload. Tanpa ini, angka
  // produksi yang berubah tidak punya jejak: enam bulan lagi tidak ada yang
  // bisa menjawab "angka 27.000 ini dari mana".
  const planNote = plan
    ? ' · rencana: ' + [
        planMeta.production ? `produksi ${planMeta.production.fileName}` : null,
        planMeta.sales ? `penjualan ${planMeta.sales.fileName}` : null,
      ].filter(Boolean).join(' + ')
    : '';

  try {
    await applyLabelStockUpload({
      fileName: fileName + planNote, sheetName,
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

  // Daftar beli dipasang SETELAH stok baru masuk, bukan sebelumnya.
  //
  // Silangnya ("spec ini sudah overstock, jangan dibeli lagi") harus diadu ke
  // stok TERBARU — yaitu stok yang baru saja diunggah dalam berkas yang sama.
  // Memasangnya lebih awal berarti menilai daftar beli bulan ini dengan angka
  // stok bulan lalu, dan itu justru jenis kesalahan yang fitur ini ada untuk
  // mencegahnya.
  const ord = st.ui.lsOrder;
  if (ord && ord.bagian && ord.bagian.length) {
    getState().labelBuyRaw = ord;
    logAudit({
      entity: 'label_stock', target: ord.fileName, action: 'buylist',
      detail: `${ord.bagian.length} sheet order dibaca: ` +
        ord.bagian.map(b => `${b.sheet} (${b.items.length})`).join(', '),
    });
  }

  logAudit({
    entity: 'label_stock', target: fileName || sheetName, action: 'upload',
    detail: `${res.stats.imported} SKU masuk · ${res.stats.duplicated} dobel dilewati · ${res.stats.mismatched} rumus tidak cocok`
      + (plan ? ` · ${plan.stats.touched} angka rencana dikoreksi dari file (${plan.stats.toBuyNow} jadi BUY NOW)` : ''),
  });
  // lsQty DAN lsPick ikut dibuang — dulu tertinggal, dan kuncinya (ERP##SPEC)
  // stabil antar unggahan, jadi keduanya bertahan melewati berkas baru.
  //
  // Akibatnya: angka yang diedit tangan bulan lalu MENIMPA angka bulan ini —
  // qtyPesan() dan kotak Pesan sama-sama mendahulukan ui.lsQty — dan di layar
  // tidak bisa dibedakan dari usulan portal. Centangan yang belum sempat dikirim
  // juga ikut hidup terus dan tetap dihitung oleh tombol kirim.
  //
  // Unggahan baru berarti angka baru. Apa pun yang diketik terhadap angka LAMA
  // tidak punya arti lagi terhadap yang baru.
  setUI({ lsPreview: null, lsWb: null, lsSheets: null, lsSheet: null, lsFile: null, lsBox1: null, lsBox2: null, lsBox3: null, lsOrder: null, lsQty: {}, lsPick: {} });
  toast(plan && plan.stats.touched
    ? {
        id: `${res.stats.imported} SKU tersimpan · ${plan.stats.touched} angka rencana dikoreksi dari file`,
        en: `${res.stats.imported} SKU saved · ${plan.stats.touched} plan figures corrected from the plan files`,
        zh: `${res.stats.imported} 个 SKU 已保存 · ${plan.stats.touched} 项计划数值已按计划文件修正`,
      }
    : {
        id: `${res.stats.imported} SKU tersimpan`,
        en: `${res.stats.imported} SKU saved`,
        zh: `${res.stats.imported} 个 SKU 已保存`,
      });
  setState({});
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
// Kotak-kotak jendela saring untuk KEDUA tabel stok (Master Tracker dan
// DO NOT BUY) — dua daftar, satu bentuk tabel, jadi satu daftar medan.
//
// Isinya mengikuti kolom yang benar-benar tampil di stockTable(). Menyaring
// lewat kolom yang tidak kelihatan membuat baris menghilang tanpa ada yang bisa
// menunjuk sebabnya, dan yang paling sering kena adalah orang yang membuka
// daftar ini besoknya dan lupa saringan kemarin masih menyala.
//
// Market memang sebuah pilihan, bukan kotak ketik: kodenya pendek dan salah
// ketik satu huruf ('PT ' dengan spasi, 'pt') menghasilkan nol baris tanpa satu
// pun tanda bahwa yang salah cuma ejaannya.
//
// Status DIBATASI pada yang benar-benar ada di daftar yang bersangkutan,
// bukan seluruh STATUSES. Urutannya tetap urutan STATUSES supaya dua daftar
// tidak menyusun dropdown-nya dengan urutan berbeda — tapi di DO NOT BUY,
// menawarkan 'BUY NOW' berarti menawarkan pilihan yang SELALU menghasilkan nol
// baris, dan dropdown yang setiap pilihannya bisa jadi jalan buntu adalah
// dropdown yang berhenti dipercaya.
const MEDAN_STOK = (semua) => {
  const adaStatus = new Set((semua || []).map(r => r.status).filter(Boolean));
  return [
    { kunci: 'spec', label: tr({ id: 'Spec', en: 'Spec', zh: '规格' }), tipe: 'teks', ambil: r => r.spec },
    {
      kunci: 'market', label: tr({ id: 'Market', en: 'Market', zh: '市场' }), tipe: 'pilih',
      opsi: [...new Set((semua || []).map(r => r.market).filter(Boolean))].sort(), ambil: r => r.market,
    },
    { kunci: 'erp', label: tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }), tipe: 'teks', mono: true, ambil: r => r.erp },
    // Opsi status memakai teks yang TERBACA di kolom Status, bukan kode
    // simpanannya. Yang memilih di sini sedang menunjuk lencana yang dia lihat;
    // kalau isinya kode mentah, dropdown dan tabel bicara dua bahasa berbeda.
    {
      kunci: 'status', label: tr({ id: 'Status', en: 'Status', zh: '状态' }), tipe: 'pilih',
      opsi: STATUSES.filter(s => adaStatus.has(s)).map(statusLabel), ambil: r => statusLabel(r.status),
    },
  ];
};

function masterTab(st) {
  const semua = st.labelStock || [];
  const medan = MEDAN_STOK(semua);
  const nilai = nilaiFilter('ls-master');
  const tersaring = saring(semua, medan, nilai);
  return h('div.stack', [
    h('div.row.gap8.wrap', { style: { alignItems: 'center' } }, [
      hitunganSaring(tersaring.length, semua.length, { id: 'SKU', en: 'SKU', zh: '个 SKU' }),
      tombolFilter({
        id: 'ls-master', medan, kunciHalaman: 'lsPage',
        judul: tr({ id: 'Saring Master Tracker', en: 'Filter Master Tracker', zh: '筛选主跟踪表' }),
      }),
      h('div.mla.row.gap8', [
        isConfigured() ? btn(tr({ id: 'Refresh dari server', en: 'Refresh from Server', zh: '从服务器刷新' }), { sm: true, iconName: 'clock', onClick: () => refreshLabelStock() }) : null,
        // Export mengikuti yang TERSARING, bukan seluruh tracker — sama seperti
        // sebelumnya waktu penyaringnya masih berupa kotak cari. Yang menyaring
        // dulu lalu menekan Export sedang meminta hasil saringannya.
        btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportRows(tersaring) }),
      ]),
    ]),
    stockTable(tersaring, true, {
      idFilter: 'ls-master', kunciHal: 'lsPage', kunciUkur: 'lsSize',
      adaFilter: jumlahFilterAktif(nilai) > 0, jumlahAsli: semua.length,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// BUY NOW -> LABEL REQUEST
//
// Daftar belanjanya sudah dihitung di layar ini. Sebelumnya sona harus membuka
// Excel lain, menyusun ulang baris yang sama dengan tangan, lalu mengunggahnya
// di layar Label Request — mengetik ulang angka yang portal sendiri baru saja
// hitung, dengan semua risiko yang menyertai pengetikan ulang.
//
// Sekarang baris yang dicentang di sini menjadi request itu sendiri. Yang di
// hilir tidak berubah sama sekali: request masuk ke antrean yang sama, dibuka
// cania/visca lewat tombol yang sama, dan menjadi PO lewat langkah yang sama.
// Jalur Excel-nya tetap ada — spec baru yang belum pernah masuk tracker tidak
// punya baris untuk dicentang, dan itu justru kejadian yang paling butuh
// jalur manual.
// ---------------------------------------------------------------------------
const pickKey = r => `${String(r.spec).trim().toUpperCase()}||${String(r.market || '').trim().toUpperCase()}`;
// ===========================================================================
// BUY NOW
// ===========================================================================
// Dulu tab ini cuma menampilkan hasil hitungan portal: baris yang stoknya di
// bawah kebutuhan. Itu menjawab "apa yang menurut angka kurang" — dan tidak
// menjawab "apa yang sona minta dibeli", yang selama ini hidup di sheet order
// di dalam berkas yang sama dan tidak pernah dibaca.
//
// Sekarang dua-duanya di satu layar, sebagai SATU daftar. Barang yang muncul
// di dua-duanya jadi satu baris, bukan dua — dua baris untuk barang yang sama
// adalah cara paling rapi untuk memesannya dua kali.
//
// Tiga hal yang layar ini WAJIB tunjukkan, dan yang ketiga paling sering lupa
// dibuat orang:
//   1. yang diminta padahal stoknya sudah berlebih  → ⛔ STOP
//   2. yang portal setujui                          → ✓
//   3. YANG PORTAL TIDAK BISA CEK SAMA SEKALI       → ⚠
// Nomor 3 itu 114 dari 129 baris di berkas Agustus. Kalau layar cuma menulis
// "8 overstock", orang membacanya sebagai "sisanya aman" — padahal untuk 114
// baris portal tidak tahu apa-apa. Diam bukan berarti aman, jadi angkanya
// dipasang sama besar dengan yang lain.
// ---------------------------------------------------------------------------
// Paginasi dipakai lewat ui/components.js — alasan lengkapnya (termasuk angka
// hasil pengukurannya) ada di sana. Ringkasnya: mount() membangun ulang seluruh
// layar setiap klik, jadi jumlah baris yang tampil menentukan ongkos SETIAP
// tombol di halaman ini, bukan cuma ongkos menggulir tabelnya.
//
// Dua tabel di layar ini punya halaman SENDIRI-SENDIRI (lsPage/lsSize untuk
// stok, lsbPage/lsbSize untuk daftar beli). Berbagi satu nomor halaman berarti
// pindah tab bisa mendarat di halaman 7 dari daftar yang cuma punya 2.
function halaman(rows, st, kunciHal, kunciUkur) {
  const size = st.ui[kunciUkur] === 0 ? 0 : (Number(st.ui[kunciUkur]) || PAGE_DEFAULT);
  const info = pageSlice(rows, st.ui[kunciHal] || 1, size);
  info.size = size;
  return info;
}
function barisPager(info, kunciHal, kunciUkur) {
  return pager(info, {
    onPage: n => setUI({ [kunciHal]: n }),
    // Ganti jumlah baris SELALU kembali ke halaman 1. Tanpa ini, orang yang di
    // halaman 40 lalu memilih "100" mendarat di halaman kosong dan menyimpulkan
    // datanya hilang.
    onSize: n => setUI({ [kunciUkur]: n, [kunciHal]: 1 }),
  });
}

const TANDA_UI = {
  [TANDA.STOP]: { tone: 'red',   label: { id: '⛔ stop', en: '⛔ stop', zh: '⛔ 停止' } },
  [TANDA.CEK]:  { tone: 'amber', label: { id: '⚠ tak bisa dicek', en: '⚠ cannot check', zh: '⚠ 无法核对' } },
  [TANDA.OK]:   { tone: 'green', label: { id: '✓ aman', en: '✓ clear', zh: '✓ 可采购' } },
};

// SIAPA YANG MENARUH BARIS INI DI SINI.
//
// BUY NOW menjawab DUA pertanyaan sekaligus — "apa yang sona minta" dan "apa
// yang menurut angka kurang" — dan sampai v15.0 keduanya tampil identik: badge
// hijau ✓ aman yang sama, kolom Pesan yang sama-sama terisi, dan ikut tercentang
// oleh "Pilih semua yang aman" yang sama. Satu-satunya pembeda adalah dua kolom
// teks abu-abu kecil.
//
// Ketahuan waktu Kyaru bertanya mana dari 22 baris yang sudah disetujui sona.
// Jawabannya NOL, dan tidak ada satu pun elemen di layar yang mengatakannya.
// Layar ini dipakai untuk memutuskan pengeluaran; sumber sebuah baris adalah hal
// PERTAMA yang harus terbaca, bukan yang terakhir.
//
// Hijau "✓ aman" pada baris portal juga pernyataan yang KELIRU: hijau berarti
// "file dan portal sepakat", dan pada baris portal tidak ada file yang bisa
// diajak sepakat.
const SUMBER_UI = {
  file:   { tone: 'blue', label: { id: 'SONA',   en: 'SONA',   zh: '索娜' } },
  portal: { tone: 'gray', label: { id: 'PORTAL', en: 'PORTAL', zh: '门户' } },
};
const sumberDari = r => (r.asal === 'portal' ? 'portal' : 'file');

// Menggantikan hijau "✓ aman" pada baris portal. Bukan karena barisnya
// bermasalah — tapi karena belum ada yang memintanya, dan itu fakta yang
// berbeda dari "aman untuk dibeli".
const USULAN_PORTAL = { id: 'usulan portal — belum diminta', en: 'portal suggestion — not requested', zh: '门户建议 — 尚未申请' };

// Disusun ulang tiap render dari data mentah — lihat catatan labelBuyRaw di
// core/store.js. Tanpa berkas order, hasilnya persis daftar lama: baris BUY NOW
// hitungan portal, tidak lebih dan tidak kurang.
export function daftarBeliSekarang(st) {
  const raw = st.labelBuyRaw;
  const daftar = raw && raw.bagian && raw.bagian.length
    ? susunDaftarBeli(st, raw.bagian)
    : { rows: [], kodeGanda: [], stats: hitungKosong() };
  return { daftar, rows: gabungDenganPortal(st, daftar) };
}
const hitungKosong = () => ({ total: 0, stop: 0, cek: 0, ok: 0, mintaTotal: 0, marketAsing: 0, lewatSpec: 0, kodeGanda: 0 });

// Untuk label tab. Dibungkus try/catch karena dia dipanggil saat MENGGAMBAR
// KERANGKA layar — kalau dia melempar, seluruh layar Stok Label mati, termasuk
// tab-tab yang tidak ada hubungannya. Aturan yang sudah berlaku di portal ini:
// fitur pinggiran tidak boleh menjatuhkan fitur inti.
function jumlahBeli(st) {
  try { return daftarBeliSekarang(st).rows.length; }
  catch (e) {
    console.warn('daftar beli gagal disusun (tidak fatal):', e);
    return (st.labelStock || []).filter(r => r.status === 'BUY NOW').length;
  }
}

// Kotak-kotak jendela saring daftar beli. Market, brand, dan kategori diambil
// dari isinya sendiri, bukan daftar tetap — daftar tetap akan ketinggalan
// begitu ada brand baru masuk lewat berkas order, dan brand yang tidak ada di
// dropdown adalah brand yang tidak bisa dicari sama sekali.
//
// Kategori cuma muncul kalau daftarnya memang punya kategori. Baris hitungan
// portal tidak punya kategori sama sekali (portal tidak tahu barang itu untuk
// lokal atau ekspor), jadi tanpa berkas order dropdown-nya akan kosong
// melompong — kotak yang tidak punya satu pun pilihan cuma menambah tinggi
// jendela tanpa pernah bisa dipakai.
//
// Tanda dan Status dua kotak terpisah walaupun duduk di satu kolom Status.
// Keduanya menjawab pertanyaan berbeda: tanda itu putusan portal atas
// permintaannya (⛔/⚠/✓), status itu keadaan stoknya. Menggabungkannya jadi
// satu dropdown memaksa orang memilih salah satu pertanyaan.
const MEDAN_BELI = (semua) => {
  const unik = (ambil) => [...new Set((semua || []).map(ambil).filter(Boolean))].sort();
  const kategori = unik(r => r.kategori);
  const status = STATUSES.filter(s => (semua || []).some(r => r.status === s));
  return [
    { kunci: 'spec', label: tr({ id: 'Spec', en: 'Spec', zh: '规格' }), tipe: 'teks', ambil: r => r.spec },
    { kunci: 'erp', label: tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }), tipe: 'teks', mono: true, ambil: r => r.erp },
    { kunci: 'market', label: tr({ id: 'Market', en: 'Market', zh: '市场' }), tipe: 'pilih', opsi: unik(r => r.market), ambil: r => r.market },
    { kunci: 'brand', label: tr({ id: 'Brand', en: 'Brand', zh: '品牌' }), tipe: 'pilih', opsi: unik(r => r.brand), ambil: r => r.brand },
    // Menyaring ke PORTAL saja adalah cara tercepat menjawab "apa yang belum
    // diminta siapa pun" — pertanyaan yang sebelumnya cuma bisa dijawab dengan
    // membuka tiap halaman dan membaca kolom Kategori satu per satu.
    {
      kunci: 'sumber', label: tr({ id: 'Sumber', en: 'Source', zh: '来源' }), tipe: 'pilih',
      opsi: ['file', 'portal'].filter(k => (semua || []).some(r => sumberDari(r) === k)).map(k => tr(SUMBER_UI[k].label)),
      ambil: r => tr(SUMBER_UI[sumberDari(r)].label),
    },
    kategori.length ? {
      kunci: 'kategori', label: tr({ id: 'Kategori', en: 'Category', zh: '类别' }), tipe: 'pilih',
      // Opsi DAN isi yang dibandingkan sama-sama teks terjemahannya, persis
      // seperti yang tertulis di lencana kolom Kategori. Kalau opsinya kode
      // mentah ('newitems') sementara kolomnya sudah diterjemahkan, dropdown
      // dan tabel bicara dua bahasa dan tidak ada yang bisa menebak
      // pasangannya.
      opsi: kategori.map(k => tr(labelKategori(k))),
      ambil: r => (r.kategori ? tr(labelKategori(r.kategori)) : ''),
    } : null,
    {
      kunci: 'tanda', label: tr({ id: 'Tanda portal', en: 'Portal verdict', zh: '门户判定' }), tipe: 'pilih',
      opsi: [TANDA.STOP, TANDA.CEK, TANDA.OK].map(k => tr(TANDA_UI[k].label)),
      ambil: r => (TANDA_UI[r.tanda] ? tr(TANDA_UI[r.tanda].label) : ''),
    },
    status.length ? {
      kunci: 'status', label: tr({ id: 'Status stok', en: 'Stock status', zh: '库存状态' }), tipe: 'pilih',
      opsi: status.map(statusLabel), ambil: r => (r.status ? statusLabel(r.status) : ''),
    } : null,
  ].filter(Boolean);
};

function buyNowTab(st) {
  const { daftar, rows: semua } = daftarBeliSekarang(st);
  const medan = MEDAN_BELI(semua);
  const nilai = nilaiFilter('ls-beli');
  const rows = saring(semua, medan, nilai);
  const dariFile = semua.filter(r => r.asal === 'file').length;
  const dariPortal = semua.filter(r => r.asal === 'portal').length;
  const s = daftar.stats;

  const tile = (label, value, sub, tone) => h('div.card', { style: { padding: '13px 16px', flex: '1', minWidth: '140px' } }, [
    h('div', { style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em' } }, label),
    h('div.mono', { style: { fontSize: '19px', fontWeight: 800, marginTop: '4px', color: tone ? `var(--st-${tone}-tx)` : 'var(--text)' } }, value),
    sub ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' } }, sub) : null,
  ]);

  // KARTUNYA SELALU TAMPIL, TERMASUK WAKTU NOL.
  //
  // Dulu seluruh deretan ini disembunyikan kalau `dariFile === 0`, jadi layarnya
  // paling diam justru pada satu keadaan yang paling perlu diucapkan: sona belum
  // mengunggah apa pun, dan setiap baris di bawah adalah usulan portal yang
  // tidak diminta siapa pun. Yang membukanya melihat daftar hijau rapi dan
  // menyimpulkan daftar itu sudah disetujui.
  //
  // "DIMINTA SONA: 0" adalah kalimat. Kartu yang hilang bukan apa-apa.
  const nSheet = ((st.labelBuyRaw || {}).bagian || []).length;
  return h('div.stack', [
    h('div.row.gap8.wrap', [
      tile(tr({ id: 'DIMINTA SONA', en: 'REQUESTED BY SONA', zh: '索娜申请' }), num(dariFile),
        nSheet
          ? tr({ id: `${nSheet} sheet order`, en: `${nSheet} order sheets`, zh: `${nSheet} 个订单工作表` })
          : tr({ id: 'belum ada berkas order', en: 'no order file yet', zh: '尚无订单文件' }),
        dariFile ? 'blue' : null),
      tile(tr({ id: 'PORTAL: HARUS BELI', en: 'PORTAL: MUST BUY', zh: '门户：需采购' }), num(dariPortal),
        tr({ id: 'belum diminta siapa pun', en: 'not requested by anyone', zh: '无人申请' }), dariPortal ? 'red' : null),
      tile(tr({ id: '⛔ STOP', en: '⛔ STOP', zh: '⛔ 停止' }), num(s.stop),
        tr({ id: 'diminta tapi stok berlebih', en: 'requested but overstocked', zh: '已申请但库存过剩' }), s.stop ? 'red' : null),
      tile(tr({ id: 'TAK BISA DICEK', en: 'CANNOT CHECK', zh: '无法核对' }), num(s.cek),
        tr({ id: 'belum ada di tracker', en: 'not in the tracker yet', zh: '跟踪表中尚无' }), s.cek ? 'amber' : null),
      // s.ok saja, TANPA dariPortal. Angka ini berarti "diminta sona DAN portal
      // setuju"; menambahkan baris yang tidak ada di file mana pun ke dalamnya
      // membuat satu-satunya angka hijau di layar menghitung barang yang belum
      // diminta siapa pun.
      tile(tr({ id: 'AMAN', en: 'CLEAR', zh: '可采购' }), num(s.ok),
        tr({ id: 'diminta sona & portal setuju', en: 'requested by sona, portal agrees', zh: '索娜已申请且门户认可' }), s.ok ? 'green' : null),
    ]),

    // Spanduknya terpisah dari kartunya, dan sengaja: angka 0 masih bisa
    // terlewat oleh mata yang sedang mencari daftar belanja. Kalimat tidak.
    !dariFile && dariPortal ? h('div.cfg-banner', {
      style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' },
    }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
        id: ` Sona belum mengunggah berkas order bulan ini — belum ada satu baris pun yang diminta.`,
        en: ` Sona has not uploaded this month's order file — not one row here has been requested.`,
        zh: ` 索娜尚未上传本月订单文件 — 此处没有任何一行是被申请的。`,
      })]),
      h('div', { style: { fontSize: '11.5px', marginTop: '4px', fontWeight: 400 } }, tr({
        id: `Seluruh ${dariPortal} baris di bawah adalah hitungan portal: stok di bawah kebutuhan menurut rencana produksi. Berguna sebagai peringatan, tapi belum tentu perlu dibeli sekarang — angkanya belum dilihat orang yang memegang labelnya. "Pilih semua" sengaja melewatinya.`,
        en: `All ${dariPortal} rows below are the portal's own arithmetic: stock below requirement according to the production plan. Useful as a warning, but not necessarily something to buy today — nobody who handles the labels has looked at these numbers yet. "Select all" deliberately skips them.`,
        zh: `下方全部 ${dariPortal} 行均为门户自身的计算：按生产计划，库存低于需求量。可作为提醒，但未必现在就需要采购 — 负责标签的人尚未看过这些数字。“全选”会有意跳过它们。`,
      })),
    ]) : null,

    s.stop ? bannerStop(semua) : null,
    daftar.kodeGanda.length ? bannerKodeGanda(daftar.kodeGanda) : null,
    s.cek ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
        id: ` ${s.cek} baris tidak bisa diadu dengan stok — spec-nya belum ada di tracker`,
        en: ` ${s.cek} rows cannot be checked against stock — the spec is not in the tracker yet`,
        zh: ` ${s.cek} 行无法与库存核对 — 该规格尚未出现在跟踪表中`,
      })]),
      h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
        id: 'Portal tidak punya angka stoknya, jadi dia tidak bilang apa-apa soal baris ini. TIDAK ADA PERINGATAN BUKAN BERARTI AMAN — angka ini ditulis di sini justru supaya tidak dibaca sebagai lampu hijau.',
        en: 'The portal has no stock figure for these, so it says nothing about them. NO WARNING DOES NOT MEAN SAFE — this number is printed here precisely so the silence is not read as a green light.',
        zh: '门户没有这些行的库存数据，因此无法作出判断。没有警告不等于安全 — 此数字在此列出，正是为了避免把沉默当成放行。',
      })),
      s.lewatSpec ? h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
        id: `${s.lewatSpec} baris dicocokkan lewat NAMA SPEC, bukan kode ERP — lebih rawan meleset.`,
        en: `${s.lewatSpec} rows were matched on the SPEC NAME, not the ERP code — more prone to error.`,
        zh: `${s.lewatSpec} 行按规格名称匹配，而非 ERP 编码 — 更容易出错。`,
      })) : null,
    ]) : null,
    s.marketBeda ? h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
        id: ` ${s.marketBeda} barang market-nya berbeda antar sheet — salah satunya pasti salah`,
        en: ` ${s.marketBeda} items have a different market in different sheets — one of them must be wrong`,
        zh: ` ${s.marketBeda} 个产品在不同工作表中的市场不一致 — 其中必有一个是错的`,
      })]),
      h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
        id: 'Dibandingkan SETELAH nama tujuan Tionghoa disamakan (印尼 dan SNI dianggap sama), jadi yang tersisa memang beda pasar sungguhan. Portal tidak memilih — lihat kolom Market, lawannya disebut di sana.',
        en: 'Compared AFTER the Chinese destination names are normalised (印尼 and SNI count as the same), so what remains is a genuine market difference. The portal does not pick — see the Market column, the alternative is named there.',
        zh: '比较是在中文目的地名称统一之后进行的（印尼 与 SNI 视为相同），因此剩下的是真正的市场差异。门户不作选择 — 请查看市场列，其中已列出另一个值。',
      })),
    ]) : null,
    s.marketAsing ? h('div.cfg-banner', [icon('warn', 14), tr({
      id: ` ${s.marketAsing} baris market-nya tidak dikenal — dibiarkan apa adanya, tidak ditebak`,
      en: ` ${s.marketAsing} rows have an unrecognised market — left as-is, not guessed`,
      zh: ` ${s.marketAsing} 行的市场无法识别 — 保持原样，不作推测`,
    })]) : null,

    h('div.card', { style: { padding: '11px 14px' } }, h('div.row.gap8.wrap', { style: { alignItems: 'center' } }, [
      hitunganSaring(rows.length, semua.length, { id: 'baris', en: 'rows', zh: '行' }),
      tombolFilter({
        id: 'ls-beli', medan, kunciHalaman: 'lsbPage',
        judul: tr({ id: 'Saring Daftar Beli', en: 'Filter Buy List', zh: '筛选采购清单' }),
      }),
      h('div.mla.row.gap8', [
        // Export mengikuti yang TERSARING. Yang menyaring dulu lalu menekan
        // Export sedang meminta hasil saringannya — dan angkanya tertulis
        // persis di sebelah tombolnya, jadi tidak ada tebak-tebakan soal
        // berapa baris yang akan ikut.
        btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportBeli(rows) }),
      ]),
    ])),

    barKirim(st, rows, semua),
    tabelBeli(st, rows, semua, jumlahFilterAktif(nilai) > 0),
  ]);
}

// Jumlah yang benar-benar dipesan untuk satu baris. Kotak isian menang atas
// angka bawaan — sona yang tahu hal-hal yang tidak ada di sheet mana pun: sisa
// gulungan di gudang, order yang sudah jalan tapi belum tercatat.
// JUMLAH PESAN DIBACA ATURAN INDONESIA, bukan Number().
//
// Dulu `Number(v)`, dan kotaknya `<input type="number">`. Dua-duanya en-US:
//   "12.500" -> Number -> 12,5
//   "12,500" -> nilai DOM jadi STRING KOSONG (type=number menolak koma),
//               jadi cabang `v !== ''` gagal dan qtyPesan diam-diam jatuh ke
//               r.pesan — ANGKA SARAN PORTAL — sementara kotaknya masih
//               MENAMPILKAN "12,500" yang diketik sona. Layar satu angka,
//               label request angka lain, dan yang tidak terlihat yang menang.
// Angka ini dikalikan harga label jadi nominal PO. Kelas cacat yang sama
// dengan nominal invoice v15.7, ditemukan pada review lebar rilis itu.
//
// `type="number"` dibuang di kedua kotaknya: atribut itu yang memaksa
// pembacaan en-US di tingkat DOM, sebelum kode ini sempat berpendapat.
function bacaQtyPesan(v) {
  const n = parseNumber(v, 'id');
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN;
}

// Teks yang digambar ke dalam kotak. `qtyInputText()` saja TIDAK cukup di sini
// dan percobaan pertama memakainya begitu saja: `ui.lsQty` menyimpan STRING
// mentah hasil ketikan (onInput sengaja tidak memicu render supaya fokus tidak
// hilang), sedangkan qtyInputText mengembalikan '' untuk apa pun yang bukan
// angka — jadi setiap kotak yang sudah pernah diketik akan LAHIR KOSONG pada
// gambar ulang berikutnya, dan angka pesanan sona lenyap dari layar tanpa
// suara. Ditangkap sebelum dikirim, oleh pemeriksaan satu baris di Node.
//
// Yang benar: gambar bentuk KANONIKnya kalau bisa dibaca, dan teks aslinya
// kalau tidak — supaya yang tidak terbaca tetap kelihatan dan bisa dibetulkan,
// bukan hilang.
function tampilQty(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = bacaQtyPesan(v);
  return Number.isFinite(n) ? qtyInputText(n) : String(v);
}

function qtyPesan(st, r) {
  const v = (st.ui.lsQty || {})[r.kunci];
  if (v !== undefined && v !== '') {
    const n = bacaQtyPesan(v);
    if (Number.isFinite(n)) return n;
  }
  const bawaan = parseNumber(r.pesan, 'id');
  return Number.isFinite(bawaan) ? Math.max(0, Math.round(bawaan)) : 0;
}

// rows = yang LOLOS saringan (yang kelihatan di tabel), semua = seluruh daftar
// beli. Perbedaan keduanya adalah seluruh isi catatan panjang di bawah ini.
function barKirim(st, rows, semua) {
  // SELURUH BARIS AKSI HILANG UNTUK YANG TIDAK BISA MENGIRIM.
  //
  // "Kirim ke Label Request" sudah lama dijaga `labelRequestAsk`, dan cuma sona
  // yang punya — jadi pembagiannya sudah benar sejak v14.5: sona yang meminta,
  // purchasing yang menjadikannya PO. Yang tertinggal adalah SISA layarnya.
  //
  // wilbert, cania, visca, sekar dan cenjc tetap melihat "Pilih semua yang
  // aman", tetap bisa mencentang 22 baris, tetap bisa mengubah angka di kolom
  // Pesan — lalu tidak menemukan tombol apa pun untuk mengirimkannya. Kontrol
  // yang tidak menuju ke mana-mana bukan sekadar berantakan; dia mengajarkan
  // bahwa mencentang di layar ini berarti sesuatu, padahal tidak.
  if (!can(st.user.role, 'labelRequestAsk')) return null;
  const sel = st.ui.lsPick || {};
  // DIHITUNG DARI SELURUH DAFTAR, BUKAN DARI YANG TAMPIL.
  //
  // Yang dikirim kirimDaftarBeli() adalah seluruh centangan, jadi angka di
  // tombol kirim harus menghitung hal yang sama. Menghitungnya dari `rows`
  // akan membuat tombol bertuliskan "3 SKU dipilih" lalu mengirim 27 — dan
  // yang menekannya baru tahu setelah 27 baris itu jadi permintaan di meja
  // cania.
  const dipilih = semua.filter(r => sel[r.kunci]);
  const total = dipilih.reduce((s, r) => s + qtyPesan(st, r), 0);
  const nolan = dipilih.filter(r => qtyPesan(st, r) <= 0);
  const stopDipilih = dipilih.filter(r => r.tanda === TANDA.STOP);
  // Centangan yang sedang DISEMBUNYIKAN saringan. Centangannya sengaja TIDAK
  // dihapus waktu saringan menyala: saringan itu alat melihat, bukan alat
  // membatalkan, dan orang yang menyaring untuk mengecek satu brand tidak
  // sedang meminta pilihannya yang lain dibuang. Tapi centangan yang ikut
  // terkirim tanpa terlihat di layar adalah persis jenis kejutan yang layar
  // ini ada untuk mencegahnya — jadi jumlahnya ditulis, dengan jalan keluarnya
  // (bersihkan saringan) tepat di sebelahnya.
  const tampak = new Set(rows.map(r => r.kunci));
  const tersembunyi = dipilih.filter(r => !tampak.has(r.kunci));
  const bisa = rows.filter(bolehPilihSemua);
  const semuaOn = bisa.length > 0 && bisa.every(r => sel[r.kunci]);
  const mayAsk = can(st.user.role, 'labelRequestAsk');

  return h('div.card', { style: { padding: '12px 16px' } }, h('div.row.gap12.wrap', { style: { alignItems: 'center' } }, [
    h('label.row.gap8', { style: { alignItems: 'center', cursor: 'pointer', fontSize: '12px' } }, [
      h('input', {
        type: 'checkbox', checked: semuaOn,
        style: { accentColor: 'var(--accent)', cursor: 'pointer' },
        // "Pilih semua" TIDAK PERNAH mencentang baris STOP, dan itu inti
        // seluruh fitur ini. Sekali dia ikut tercentang, seluruh peringatannya
        // jadi hiasan — orang mencentang semua, mengirim, dan peringatan yang
        // sudah dihitung dengan susah payah tidak mengubah apa pun.
        //
        // "Semua" berarti SEMUA YANG KELIHATAN, jadi loop-nya jalan di `rows`
        // (hasil saringan), bukan di `semua`. Kotak ini duduk di atas tabel
        // yang sedang tersaring; mencentang baris yang tidak ada di tabel itu
        // berarti tombolnya melakukan hal yang tidak bisa dilihat siapa pun.
        // Konsekuensinya melepasnya juga cuma melepas yang kelihatan — dan itu
        // memang yang benar: centangan di luar saringan bukan milik klik ini.
        onChange: e => {
          const s = { ...(getState().ui.lsPick || {}) };
          for (const r of rows) {
            if (e.target.checked && bolehPilihSemua(r)) s[r.kunci] = true;
            else delete s[r.kunci];
          }
          setUI({ lsPick: s });
        },
      }),
      tr({ id: 'Pilih semua yang aman', en: 'Select all that are clear', zh: '全选可采购项' }),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: '(baris ⛔ stop dilewati)', en: '(⛔ stop rows are skipped)', zh: '（跳过 ⛔ 停止行）',
      })),
    ]),
    dipilih.length
      ? h('span', { style: { fontSize: '12px' } }, [
          h('b', tr({ id: `${dipilih.length} SKU dipilih`, en: `${dipilih.length} SKU selected`, zh: `已选择 ${dipilih.length} 个 SKU` })),
          h('span', { style: { color: 'var(--text-3)' } }, tr({
            id: ` · total ${num(total)} lembar`, en: ` · ${num(total)} sheets in total`, zh: ` · 共 ${num(total)} 张`,
          })),
        ])
      : h('span', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, tr({
          id: 'Centang yang mau dipesan. Jumlahnya sudah terisi — boleh diubah.',
          en: 'Tick what to order. The quantities are pre-filled — editable.',
          zh: '勾选要订购的项目。数量已预填 — 可修改。',
        })),
    stopDipilih.length ? badge(tr({
      id: `${stopDipilih.length} baris ⛔ stop ikut dicentang`,
      en: `${stopDipilih.length} ⛔ stop rows are ticked`,
      zh: `已勾选 ${stopDipilih.length} 个 ⛔ 停止行`,
    }), 'red', { iconName: 'warn' }) : null,
    nolan.length ? badge(tr({
      id: `${nolan.length} baris jumlahnya 0`, en: `${nolan.length} rows have qty 0`, zh: `${nolan.length} 行数量为 0`,
    }), 'amber') : null,
    // Disebut, bukan didiamkan dan bukan dihapus. Tombol bersihkannya ikut,
    // supaya "tunjukkan yang mana" cuma satu klik — tanpa itu orang harus
    // menebak sendiri kotak saringan mana yang menyembunyikannya.
    tersembunyi.length ? h('span.row.gap8', { style: { alignItems: 'center' } }, [
      badge(tr({
        id: `${tersembunyi.length} centangan disembunyikan saringan — tetap ikut terkirim`,
        en: `${tersembunyi.length} ticked rows are hidden by the filter — they will still be sent`,
        zh: `${tersembunyi.length} 个已勾选行被筛选隐藏 — 仍会一并发送`,
      }), 'amber', { iconName: 'warn' }),
      h('button.btn.btn-sm', {
        onClick: () => {
          const f = { ...(getState().ui.filters || {}) };
          delete f['ls-beli'];
          setUI({ filters: f, lsbPage: 1 });
        },
      }, tr({ id: 'Bersihkan saringan', en: 'Clear filter', zh: '清除筛选' })),
    ]) : null,
    h('div.mla.row.gap8', [
      mayAsk ? btn(tr({ id: 'Kirim ke Label Request →', en: 'Send to Label Request →', zh: '发送至标签申请 →' }), {
        variant: 'primary', disabled: !dipilih.length, onClick: () => kirimDaftarBeli(),
      }) : null,
    ]),
  ]));
}

// Satu kiriman = satu permintaan PER KATEGORI.
//
// Kategorinya ikut dari sheet asalnya (local / export / newitems / 加急), jadi
// sona tidak perlu memilihnya lagi. Cania membuka "Export", membuat PO, tutup —
// bukan satu gumpalan yang harus dia pilah sendiri.
//
// Baris yang datang dari hitungan portal tidak punya kategori: dia masuk ke
// permintaannya sendiri, dan itu jujur — portal memang tidak tahu barang itu
// untuk lokal atau ekspor.
async function kirimDaftarBeli() {
  if (blockWrite('kirim request label')) return;
  const st = getState();
  const sel = st.ui.lsPick || {};
  const { rows: semua } = daftarBeliSekarang(st);
  const dipilih = semua.filter(r => sel[r.kunci]);
  if (!dipilih.length) {
    toast({ id: 'Centang dulu yang mau dipesan', en: 'Tick what to order first', zh: '请先勾选要订购的项目' });
    return;
  }
  const nolan = dipilih.filter(r => qtyPesan(st, r) <= 0);
  if (nolan.length) {
    toast({
      id: `${nolan.length} baris jumlahnya 0 — isi dulu, atau lepas centangnya.`,
      en: `${nolan.length} rows have qty 0 — fill it in, or untick them.`,
      zh: `${nolan.length} 行数量为 0 — 请填写数量或取消勾选。`,
    });
    return;
  }

  const grup = new Map();
  for (const r of dipilih) {
    const k = r.kategori || 'portal';
    if (!grup.has(k)) grup.set(k, []);
    grup.get(k).push(r);
  }

  const berhasil = [], gagal = [];
  for (const [kat, baris] of grup) {
    const items = barisPermintaan(st, baris);
    const local = {
      file: kat === 'portal'
        ? tr({ id: 'Stok Label — hitungan portal', en: 'Label Stock — portal calculation', zh: '标签库存 — 门户计算' })
        : tr({ id: `Stok Label — ${tr(labelKategori(kat))}`, en: `Label Stock — ${tr(labelKategori(kat))}`, zh: `标签库存 — ${tr(labelKategori(kat))}` }),
      sheet: `${kat === 'portal' ? 'BUY NOW' : kat} · ${fmtDate(new Date())}`,
      rows: items,
      by: st.user.username, at: new Date().toISOString(), status: 'Diminta',
    };
    try {
      const saved = await insertLabelRequest(local);
      st.labelRequests.unshift(saved && saved.id ? saved : { ...local, id: uid('lr') });
      berhasil.push({ kat, n: items.length });
    } catch (e) {
      console.error('insertLabelRequest gagal untuk kategori', kat, e);
      gagal.push(kat);
    }
  }

  if (!berhasil.length) {
    toast({
      id: 'Gagal kirim request — centangan tidak dihapus, coba lagi.',
      en: 'Failed to send the request — the ticks are kept, try again.',
      zh: '发送申请失败 — 勾选保留，请重试。',
    });
    return;
  }

  // Yang berhasil DIHAPUS centangnya, yang gagal DIBIARKAN. Menghapus semuanya
  // berarti kategori yang gagal hilang tanpa jejak dan sona mengira sudah
  // terkirim; membiarkan semuanya berarti dia mengirim ulang yang sudah masuk.
  const katBerhasil = new Set(berhasil.map(b => b.kat));
  const sisa = { ...sel };
  for (const r of dipilih) if (katBerhasil.has(r.kategori || 'portal')) delete sisa[r.kunci];
  setUI({ lsPick: sisa });

  const totalBaris = berhasil.reduce((s, b) => s + b.n, 0);
  const stopIkut = dipilih.filter(r => r.tanda === TANDA.STOP && katBerhasil.has(r.kategori || 'portal')).length;
  logAudit({
    entity: 'label_request', target: `${totalBaris} SKU`, action: 'request',
    detail: `dari BUY NOW · ${berhasil.length} permintaan (${berhasil.map(b => b.kat).join(', ')})`
      + (stopIkut ? ` · ${stopIkut} baris OVERSTOCK sengaja diikutkan` : ''),
  });
  toast(gagal.length
    ? {
        id: `${berhasil.length} permintaan terkirim · ${gagal.length} gagal (${gagal.join(', ')}) — centangannya masih ada.`,
        en: `${berhasil.length} requests sent · ${gagal.length} failed (${gagal.join(', ')}) — their ticks are kept.`,
        zh: `已发送 ${berhasil.length} 份申请 · ${gagal.length} 份失败（${gagal.join('、')}）— 其勾选已保留。`,
      }
    : {
        id: `${berhasil.length} permintaan · ${totalBaris} SKU dikirim — cania & visca yang lanjutkan jadi PO.`,
        en: `${berhasil.length} requests · ${totalBaris} SKU sent — cania & visca take it on to a PO.`,
        zh: `${berhasil.length} 份申请 · ${totalBaris} 个 SKU 已发送 — 由 cania 与 visca 继续开立采购单。`,
      });
  setState({});
}

// Baris permintaan dibentuk sama persis dengan hasil parseLabelSheet, supaya
// layar Label Request, modal PO, dan template ERP tidak perlu tahu permintaan
// ini datang dari mana.
function barisPermintaan(st, rows) {
  const byErp = new Map((st.items || []).map(i => [String(i.erp || '').trim(), i]));
  return rows.map((r, i) => {
    const it = byErp.get(String(r.erp || '').trim()) || {};
    return {
      market: r.market || it.market || '',
      spec: r.spec,
      erp: r.erp || '',
      ean: it.ean || '',
      brand: r.brand || it.brand || '',
      ttl: '', pr: '', ms: it.ms || '',
      qty: qtyPesan(st, r),
      unit: it.unit || '张',
      rr: it.rr || '', noise: it.noise || '',
      nameEn: it.nameEn || '', nameZh: it.nameZh || '',
      hasTemplate: (st.designs || []).some(d => d.erp && d.erp === r.erp),
      isNew: !r.erp,
      kategori: r.kategori || null,
      section: r.asal === 'file' ? (r.sheet || 'file') : 'buynow',
      _row: i + 1,
      // Jejak balik ke angka yang melahirkan permintaan ini. Kalau enam bulan
      // lagi ada yang bertanya "kenapa pesan 12.500?", jawabannya ada di baris
      // ini, bukan di ingatan orang.
      _from: { stock: r.stok, requirement: r.kebutuhan, status: r.status, minta: r.minta, sheet: r.sheet },
      // Peringatan IKUT TERSIMPAN, bukan berhenti di layar sona. Yang membuat
      // PO-nya cania/visca — merekalah yang bisa membatalkannya.
      _stop: r.tanda === TANDA.STOP ? { status: r.status, stok: r.stok, kebutuhan: r.kebutuhan } : null,
      _takBisaDicek: r.tanda === TANDA.CEK || undefined,
      _kodeGanda: (r.kodeGanda && r.kodeGanda.length) ? r.kodeGanda : undefined,
      _recentOrders: (recentOrdersFor(st, r) || []).slice(0, 3)
        .map(o => ({ poNo: o.poNo, umur: o.umur, qty: o.qty, outstanding: o.outstanding, status: o.status })),
    };
  });
}

async function exportBeli(rows) {
  const st = getState();
  const aoa = [[
    'Spec', 'ERP', 'Market', 'Market di file', 'Brand', 'Kategori', 'Sheet',
    'Stok', 'Kebutuhan', 'Status portal', 'Tanda', 'Minta', 'Pesan',
  ]];
  for (const r of rows) {
    aoa.push([
      r.spec, r.erp || '', r.market || '', r.marketAsal || '', r.brand || '',
      r.kategori ? tr(labelKategori(r.kategori)) : '', r.sheet || '',
      r.stok == null ? '' : r.stok, r.kebutuhan == null ? '' : r.kebutuhan,
      r.status || '', r.tanda, r.minta == null ? '' : r.minta, qtyPesan(st, r),
    ]);
  }
  await writeWorkbook(`Daftar Beli Label - ${fmtDate(new Date())}.xlsx`, [{
    name: 'Daftar Beli', aoa,
    cols: [{ wch: 46 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 14 },
           { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 8 }, { wch: 10 }, { wch: 10 }],
  }]);
}

function bannerStop(semua) {
  const stop = semua.filter(r => r.tanda === TANDA.STOP)
    .sort((a, b) => (b.stok / Math.max(b.kebutuhan, 1)) - (a.stok / Math.max(a.kebutuhan, 1)));
  const t = stop[0];
  return h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${stop.length} spec diminta di Excel padahal stoknya SUDAH BERLEBIH`,
      en: ` ${stop.length} specs are requested in the Excel even though stock is ALREADY OVER`,
      zh: ` ${stop.length} 个规格在 Excel 中被申请采购，但库存已经过剩`,
    })]),
    h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
      id: 'Barisnya TIDAK dihapus dan TIDAK dikunci — jumlahnya cuma dimulai dari nol, dan "Pilih semua" melewatinya. Kalau memang harus dibeli, centang sendiri; portal mencatat siapa yang memutuskan.',
      en: 'The rows are NOT deleted and NOT locked — the quantity simply starts at zero, and "Select all" skips them. If it genuinely must be bought, tick it yourself; the portal records who decided.',
      zh: '这些行不会被删除，也不会被锁定 — 数量从零开始，"全选"会跳过它们。若确实需要采购，请自行勾选；门户会记录决定人。',
    })),
    ...stop.slice(0, 4).map(r => h('div.mono', { style: { fontSize: '10px' } },
      `• ${String(r.spec).slice(0, 40)} — minta ${num(r.minta)}, stok ${num(r.stok)}, kebutuhan ${num(r.kebutuhan)}`
      + (r.kebutuhan > 0 ? ` (${Math.round(r.stok / r.kebutuhan)}× kebutuhan)` : ''))),
    // Menyebut nama kotaknya, bukan cuma "pakai filter": penyaringnya sekarang
    // ada di balik tombol corong, jadi yang tidak tahu namanya harus membuka
    // jendelanya dulu untuk menemukan kotak mana yang dimaksud.
    stop.length > 4 ? h('div', { style: { fontSize: '10px' } }, tr({
      id: `…dan ${stop.length - 4} lagi — buka corong saringan, kotak "Tanda portal" → "⛔ stop"`,
      en: `…and ${stop.length - 4} more — open the filter funnel, "Portal verdict" box → "⛔ stop"`,
      zh: `…还有 ${stop.length - 4} 个 — 打开筛选漏斗，"门户判定"选择"⛔ 停止"`,
    })) : null,
  ]);
}

// Satu kode ERP dipakai untuk dua spec berbeda. Ini bukan duplikat — ini salah
// ketik, dan yang paling mahal jenisnya: kode ERP-lah yang menentukan barang
// apa yang dicetak, nama spec cuma keterangan. Berkas 采购申请-nya akan lolos
// impor tanpa keluhan karena kodenya sendiri sah.
function bannerKodeGanda(list) {
  return h('div.cfg-banner', { style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${list.length} kode ERP dipakai untuk lebih dari satu spec — salah satunya pasti salah`,
      en: ` ${list.length} ERP codes are used for more than one spec — one of them must be wrong`,
      zh: ` ${list.length} 个 ERP 编码对应了多个规格 — 其中必有一个是错的`,
    })]),
    h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
      id: 'Kode ERP yang menentukan barang apa yang dicetak; nama spec cuma keterangan. Kedua barisnya tetap ada dan tidak digabung — portal tidak punya cara untuk tahu mana yang benar. Betulkan di Excel, lalu unggah ulang.',
      en: 'The ERP code decides what actually gets printed; the spec name is only a description. Both rows are kept and not merged — the portal has no way to know which is right. Fix it in the Excel and upload again.',
      zh: 'ERP 编码决定实际印刷的产品，规格名称仅为说明。两行都会保留且不会合并 — 门户无从判断哪个正确。请在 Excel 中更正后重新上传。',
    })),
    ...list.slice(0, 3).map(g => h('div', { style: { marginTop: '5px' } }, [
      h('div.mono', { style: { fontSize: '10.5px', fontWeight: 700 } }, g.erp),
      ...g.baris.map(b => h('div.mono', { style: { fontSize: '10px', paddingLeft: '10px' } },
        `↳ ${String(b.spec).slice(0, 46)} — ${num(b.minta)}`)),
    ])),
  ]);
}

// rows = hasil saringan, semua = seluruh daftar beli. Dipisah karena dua sebab
// kosong butuh dua kalimat: daftar beli yang memang belum ada (belum ada berkas
// order dan tidak ada satu pun baris BUY NOW) bukan hal yang bisa diperbaiki
// dengan membersihkan saringan, dan menawarkan tombol bersihkan di situ cuma
// mengirim orang ke jalan buntu.
function tabelBeli(st, rows, semua, adaFilter) {
  if (!(semua || rows).length) {
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
      id: 'Belum ada yang perlu dibeli. Daftar ini terisi dari sheet order di file tracker, dan dari baris yang stoknya di bawah kebutuhan.',
      en: 'Nothing to buy yet. This list fills from the order sheets in the tracker file, and from rows whose stock is below requirement.',
      zh: '暂无需采购项。此列表来自跟踪表文件中的订单工作表，以及库存低于需求量的行。',
    }))]);
  }
  const sel = st.ui.lsPick || {};
  // Kolom centang ikut hilang untuk yang tidak bisa mengirim — lihat barKirim().
  const bisaCentang = can(st.user.role, 'labelRequestAsk');
  const hal = halaman(rows, st, 'lsbPage', 'lsbSize');
  const head = [
    tr({ id: 'Spec', en: 'Spec', zh: '规格' }),
    tr({ id: 'Market', en: 'Market', zh: '市场' }),
    tr({ id: 'Brand', en: 'Brand', zh: '品牌' }),
    tr({ id: 'Sumber', en: 'Source', zh: '来源' }),
    tr({ id: 'Stok', en: 'Stock', zh: '库存' }),
    tr({ id: 'Kebutuhan', en: 'Requirement', zh: '需求量' }),
    tr({ id: 'Status', en: 'Status', zh: '状态' }),
    tr({ id: 'Minta', en: 'Requested', zh: '申请量' }),
    tr({ id: 'Pesan', en: 'Order', zh: '订购量' }),
  ];
  return h('div.card', [h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', [
      bisaCentang ? h('th', { style: { width: '34px' } }) : null,
      ...head.map((c, i) => h('th' + (i >= 4 && i !== 6 ? '.r' : ''), c)),
    ])),
    h('tbody', hal.items.length ? hal.items.map(r => {
      const t = TANDA_UI[r.tanda] || TANDA_UI[TANDA.OK];
      return h('tr', {
        // Latar merah tipis, bukan baris yang dicoret atau disembunyikan.
        // Yang harus terjadi di sini adalah orangnya BERHENTI dan MEMBACA —
        // bukan barisnya menghilang.
        style: r.tanda === TANDA.STOP ? { background: 'var(--st-red-bg)' } : {},
      }, [
        bisaCentang ? h('td', h('input', {
          type: 'checkbox', checked: !!sel[r.kunci],
          style: { accentColor: 'var(--accent)', cursor: 'pointer' },
          onChange: () => {
            const s = { ...(getState().ui.lsPick || {}) };
            if (s[r.kunci]) delete s[r.kunci]; else s[r.kunci] = true;
            setUI({ lsPick: s });
          },
        })) : null,
        h('td.cell-strong', { style: { maxWidth: '300px' } }, [
          r.spec,
          r.erp ? h('div.mono', { style: { fontSize: '9.5px', color: 'var(--text-3)' } }, r.erp) : null,
          r.kodeGanda && r.kodeGanda.length
            ? h('div', { style: { marginTop: '2px' } }, badge(tr({
                id: `kode dipakai juga oleh: ${r.kodeGanda.map(x => String(x.spec).slice(0, 26)).join(', ')}`,
                en: `code also used by: ${r.kodeGanda.map(x => String(x.spec).slice(0, 26)).join(', ')}`,
                zh: `此编码也用于：${r.kodeGanda.map(x => String(x.spec).slice(0, 26)).join('、')}`,
              }), 'red', { iconName: 'warn' }))
            : null,
          (() => {
            const rec = recentOrdersFor(getState(), r);
            if (!rec.length) return null;
            const o = rec[0];
            return h('span', { style: { marginLeft: '6px' }, title: rec.map(x => `${x.poNo} · ${x.umur} hari lalu · ${num(x.qty)}`).join('\n') },
              badge(tr({ id: `sudah dipesan ${o.umur} hr lalu`, en: `ordered ${o.umur}d ago`, zh: `${o.umur} 天前已订购` }), 'amber', { iconName: 'warn' }));
          })(),
        ]),
        // "PT ← 美国": orangnya harus bisa melihat portal mengerti, bukan cuma
        // mempercayainya.
        h('td.mono', { style: { fontSize: '10.5px' } }, [
          r.market || '—',
          r.marketAsal ? h('span', { style: { color: 'var(--text-3)' } }, ` ← ${r.marketAsal}`) : null,
          // Pasar yang berbeda untuk barang yang sama, antar sheet. Salah satu
          // pasti salah, dan portal tidak punya cara untuk tahu yang mana.
          r.marketBeda && r.marketBeda.length > 1
            ? h('div', { style: { marginTop: '2px' } }, badge(tr({
                id: `beda antar sheet: ${r.marketBeda.join(' / ')}`,
                en: `differs across sheets: ${r.marketBeda.join(' / ')}`,
                zh: `各工作表不一致：${r.marketBeda.join(' / ')}`,
              }), 'red', { iconName: 'warn' }))
            : null,
        ]),
        h('td', { style: { fontSize: '11px' } }, r.brand || '—'),
        // SUMBER dulu, kategori sesudahnya. Yang lama menaruh kategori di sini
        // dan menulis "dari portal" sebagai teks abu-abu 10.5px — terbaca
        // sebagai keterangan kaki, bukan sebagai jawaban atas "siapa yang minta
        // ini". Sekarang dua-duanya lencana, dan yang menjawab pertanyaan
        // terpenting berdiri di depan.
        h('td', [
          badge(tr(SUMBER_UI[sumberDari(r)].label), SUMBER_UI[sumberDari(r)].tone),
          r.kategori
            ? h('span', { style: { marginLeft: '4px' } },
                badge(tr(labelKategori(r.kategori)), r.kategori === 'urgent' ? 'red' : 'blue'))
            : null,
        ]),
        h('td.mono.r', { style: { color: 'var(--text-3)' } }, r.stok == null ? '—' : num(r.stok)),
        h('td.mono.r', { style: { color: 'var(--text-3)' } }, r.kebutuhan == null ? '—' : num(r.kebutuhan)),
        h('td', [
          // Baris portal TIDAK memakai hijau. Hijau di kolom ini berarti "file
          // dan portal sepakat", dan pada baris yang tidak ada di file mana pun
          // itu bukan penilaian yang lebih lunak — itu penilaian yang keliru.
          r.asal === 'portal'
            ? badge(tr(USULAN_PORTAL), 'gray')
            : badge(tr(t.label), t.tone),
          r.status ? h('span', { style: { marginLeft: '4px' } }, badge(statusLabel(r.status), TONE[r.status] || 'gray')) : null,
        ]),
        h('td.mono.r', { style: { color: 'var(--text-2)' } }, r.minta == null ? '—' : num(r.minta)),
        h('td.r', h('input.input.mono', {
          value: tampilQty((st.ui.lsQty || {})[r.kunci] ?? r.pesan ?? ''),
          style: {
            width: '92px', textAlign: 'right', padding: '4px 6px', fontSize: '11px',
            ...(r.tanda === TANDA.STOP ? { borderColor: 'var(--st-red-tx)', color: 'var(--st-red-tx)' } : {}),
          },
          // Ditulis langsung ke state tanpa setUI: setUI me-render ulang tabel
          // dan mengambil fokus dari kotak yang sedang diketik. Nilainya sudah
          // benar di DOM dan dibaca ulang saat dikirim. Pola yang sama dipakai
          // searchInput dan tabel stok lama.
          onInput: e => {
            const q = { ...(getState().ui.lsQty || {}) };
            q[r.kunci] = e.target.value;
            getState().ui.lsQty = q;
          },
          // onBlur MENORMALKAN. Tanpa ini `ui.lsQty` tetap memegang teks mentah
          // dan baru diterjemahkan saat dikirim — layar dan angka yang benar-
          // benar dipesan bisa berbeda sampai detik terakhir. Kotaknya juga
          // memantulkan balik bentuk kanoniknya, invarian yang sama dengan
          // kotak uang v15.7.
          //
          // Ditulis langsung ke node, TANPA setUI dan TANPA toast: dua-duanya
          // memicu render ulang di microtask yang menguras ANTARA mousedown dan
          // click, jadi tombol Kirim diganti di tengah gerakan dan kliknya
          // hilang tanpa suara. Sudah meledak tiga kali di repo ini.
          onBlur: e => {
            const n = bacaQtyPesan(e.target.value);
            const q = { ...(getState().ui.lsQty || {}) };
            if (Number.isFinite(n)) { q[r.kunci] = n; e.target.value = qtyInputText(n); }
            else if (String(e.target.value).trim() === '') { delete q[r.kunci]; }
            getState().ui.lsQty = q;
          },
        })),
      ]);
    // +1 hanya kalau kolom centangnya memang ada. Angka mati di sini membuat
    // baris "tidak ada yang cocok" melar satu kolom melewati tabelnya sendiri
    // untuk setiap peran selain sona.
    }) : barisTakCocok(head.length + (bisaCentang ? 1 : 0), { id: 'ls-beli', adaFilter })),
  ])),
  // Pager disembunyikan waktu tidak ada hasil: "Tampilkan 10 · kosong" di bawah
  // tabel yang sudah bilang tidak ada yang cocok cuma mengulang kabar buruk
  // dengan angka.
  rows.length ? barisPager(hal, 'lsbPage', 'lsbSize') : null]);
}

// Sekarang cuma dipakai DO NOT BUY. Pencentangan sudah pindah seluruhnya ke
// buyNowTab(), dan DO NOT BUY memang tidak boleh punya tombol kirim: dia adalah
// daftar yang justru TIDAK boleh dipesan, dan memberinya tombol kirim
// mengundang persis kesalahan yang daftar itu ada untuk mencegahnya.
function listTab(st, pred, title, sub) {
  const semua = (st.labelStock || []).filter(pred).sort((a, b) => b.surplus - a.surplus);
  const medan = MEDAN_STOK(semua);
  const nilai = nilaiFilter('ls-jangan');
  const tersaring = saring(semua, medan, nilai);
  return h('div.stack', [
    h('div.row.gap8', { style: { alignItems: 'center' } }, [
      h('div.card-title', title),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, sub),
      hitunganSaring(tersaring.length, semua.length, { id: 'SKU', en: 'SKU', zh: '个 SKU' }),
      tombolFilter({
        id: 'ls-jangan', medan, kunciHalaman: 'lsjPage',
        judul: tr({ id: 'Saring DO NOT BUY', en: 'Filter DO NOT BUY', zh: '筛选请勿采购' }),
      }),
      h('div.mla', btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportRows(tersaring) })),
    ]),
    // DO NOT BUY akhirnya punya nomor halaman SENDIRI (lsjPage/lsjSize).
    //
    // Dulu dia meminjam lsPage/lsSize milik Master Tracker — sudah tercatat
    // sebagai kekurangan di catatan paginasi di atas, dan baru sekarang benar-
    // benar menggigit: Master Tracker berisi ratusan baris, DO NOT BUY biasanya
    // belasan. Berhenti di halaman 9 Master Tracker lalu pindah ke sini berarti
    // mendarat di halaman 9 dari daftar yang cuma punya 2 — tabel kosong, tanpa
    // satu pun keterangan, di layar yang isinya justru barang yang sedang
    // menumpuk di gudang. Nomor halamannya terpisah, jadi dua daftar bisa
    // berhenti di tempatnya masing-masing.
    stockTable(tersaring, false, {
      idFilter: 'ls-jangan', kunciHal: 'lsjPage', kunciUkur: 'lsjSize',
      adaFilter: jumlahFilterAktif(nilai) > 0, jumlahAsli: semua.length,
      // Tracker penuh tapi tidak ada satu pun spec berlebih itu KABAR BAIK,
      // bukan kekurangan data. Menyuruh orang mengupload ulang berkas yang
      // sudah ada di portal adalah jawaban yang salah untuk keadaan itu.
      pesanKosong: (st.labelStock || []).length ? tr({
        id: 'Tidak ada spec yang stoknya berlebih atau nganggur. Tidak ada yang perlu dihindari.',
        en: 'No spec is overstocked or idle. Nothing to avoid buying.',
        zh: '没有库存过剩或呆滞的规格。无需回避采购任何项目。',
      }) : null,
    }),
  ]);
}

// Satu bentuk tabel, dua daftar (Master Tracker dan DO NOT BUY).
//
// opts.kunciHal / opts.kunciUkur DIWAJIBKAN datang dari pemanggilnya, bukan
// dihardcode di sini. Selama nomor halamannya tertulis 'lsPage' di dalam fungsi
// ini, setiap daftar yang memakai tabel ini otomatis ikut berbagi satu nomor
// halaman dengan daftar lain — bug yang tidak pernah kelihatan waktu membaca
// kode pemanggilnya, karena pemanggilnya tidak menyebut halaman sama sekali.
function stockTable(rows, showAll, opts) {
  const o = opts || {};
  const idFilter = o.idFilter || null;
  const kunciHal = o.kunciHal || 'lsPage';
  const kunciUkur = o.kunciUkur || 'lsSize';
  const adaFilter = !!o.adaFilter;
  // Jumlah baris SEBELUM disaring. Dipakai untuk membedakan dua sebab kosong
  // yang tampilannya sama persis tapi jalan keluarnya berlawanan.
  const jumlahAsli = o.jumlahAsli == null ? rows.length : o.jumlahAsli;

  // DUA SEBAB KOSONG, DUA KALIMAT.
  //
  // Dulu tabel ini cuma punya satu: "Belum ada data, upload dulu". Begitu ada
  // penyaring, kalimat itu jadi jebakan — yang barusan mengetik saringan yang
  // terlalu sempit dibilang datanya belum ada, dan yang mempercayainya akan
  // mengunggah ulang berkas yang SUDAH ada di portal, minggu ini, olehnya
  // sendiri. Jadi ajakan upload cuma keluar kalau daftarnya memang belum
  // punya baris sama sekali; kosong karena saringan ditangani barisTakCocok()
  // di dalam tabelnya, lengkap dengan tombol bersihkannya.
  if (!jumlahAsli) {
    return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, o.pesanKosong || tr({
      id: 'Belum ada data. Upload file Label Inventory Tracker di atas.',
      en: 'No data yet. Upload the Label Inventory Tracker file above.',
      zh: '暂无数据。请在上方上传标签库存跟踪表。',
    }))]);
  }
  const pick = o.st ? o.st : null;
  const sel = pick ? (pick.ui.lsPick || {}) : null;
  const hal = halaman(rows, getState(), kunciHal, kunciUkur);

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
    pick
      ? tr({ id: 'Jumlah Pesan', en: 'Order Qty', zh: '订购数量' })
      : tr({ id: 'Saran Order', en: 'Suggested Order', zh: '建议订购量' }),
  ];
  const rShift = pick ? 1 : 0;
  return h('div.card', [h('div.tbl-wrap', h('table.tbl', [
    h('thead', h('tr', [
      pick ? h('th', { style: { width: '34px' } }) : null,
      ...head.map((c, i) => h('th' + (i >= 3 && i !== 8 ? '.r' : ''), c)),
    ])),
    h('tbody', hal.items.length ? hal.items.map(r => h('tr', {
      style: r.missing ? { opacity: '.55' } : {},
    }, [
      pick ? h('td', h('input', {
        type: 'checkbox',
        checked: !!sel[pickKey(r)],
        style: { accentColor: 'var(--accent)', cursor: 'pointer' },
        onChange: () => {
          const s = { ...(getState().ui.lsPick || {}) };
          const k = pickKey(r);
          if (s[k]) delete s[k]; else s[k] = true;
          setUI({ lsPick: s });
        },
      })) : null,
      h('td.cell-strong', { style: { maxWidth: '300px' } }, [
        r.spec,
        // Sudah dipesan belakangan ini? Ditempel di NAMANYA, bukan di kolom
        // terpisah di ujung kanan — tabel ini lebarnya sepuluh kolom dan yang
        // di ujung kanan tidak terbaca tanpa menggeser layar.
        (() => {
          if (!pick) return null;
          const rec = recentOrdersFor(getState(), r);
          if (!rec.length) return null;
          const t = rec[0];
          return h('span', { style: { marginLeft: '6px' }, title: rec.map(o => `${o.poNo} · ${o.umur} hari lalu · ${num(o.qty)}`).join('\n') },
            badge(tr({
              id: `sudah dipesan ${t.umur} hr lalu`,
              en: `ordered ${t.umur}d ago`,
              zh: `${t.umur} 天前已订购`,
            }), 'amber', { iconName: 'warn' }));
        })(),
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
      pick
        // Angka saran boleh diubah. Sona yang tahu hal-hal yang tidak ada di
        // sheet mana pun — sisa gulungan di gudang, order yang sudah jalan tapi
        // belum tercatat. Memaksanya memakai angka portal berarti memaksa dia
        // memesan angka yang dia tahu keliru.
        ? h('td.r', h('input.input.mono', {
            value: tampilQty((pick.ui.lsQty || {})[pickKey(r)] ?? (r.suggestedQty || '')),
            style: { width: '96px', textAlign: 'right', padding: '4px 6px', fontSize: '11px' },
            onInput: e => {
              const q = { ...(getState().ui.lsQty || {}) };
              q[pickKey(r)] = e.target.value;
              // setUI akan me-render ulang tabel dan mengambil fokus dari
              // kotak yang sedang diketik, jadi state disimpan tanpa memicu
              // render — nilainya sudah benar di DOM, dan dibaca ulang saat
              // dikirim. Pola yang sama dipakai searchInput.
              getState().ui.lsQty = q;
            },
            // Sama seperti kotak BUY NOW: normalkan di blur, pantulkan balik,
            // tanpa setUI dan tanpa toast.
            onBlur: e => {
              const n = bacaQtyPesan(e.target.value);
              const q = { ...(getState().ui.lsQty || {}) };
              if (Number.isFinite(n)) { q[pickKey(r)] = n; e.target.value = qtyInputText(n); }
              else if (String(e.target.value).trim() === '') { delete q[pickKey(r)]; }
              getState().ui.lsQty = q;
            },
          }))
        : h('td.mono.r', { style: { fontWeight: r.suggestedQty ? 700 : 400 } }, r.suggestedQty ? num(r.suggestedQty) : '—'),
    ])) : barisTakCocok(head.length + (pick ? 1 : 0), { id: idFilter, adaFilter })),
  ])),
  // Pager disembunyikan waktu tidak ada hasil: "Tampilkan 10 · kosong" di bawah
  // tabel yang sudah bilang tidak ada yang cocok cuma mengulang kabar buruk
  // dengan angka.
  rows.length ? barisPager(hal, kunciHal, kunciUkur) : null]);
}

// Riwayat upload dicari dengan pertanyaan yang bentuknya selalu sama: "siapa
// yang mengunggah minggu itu, dan file mana". Jadi kotaknya cuma empat: waktu,
// orangnya, nama file, nama sheet. Angka-angka di kanan (dibaca/masuk/dobel/
// rumus) sengaja TIDAK bisa disaring — tidak ada yang pernah mencari upload
// "yang dobelnya 3", yang dicari adalah upload yang dobelnya ADA, dan itu sudah
// terbaca dari warnanya tanpa perlu satu kotak pun.
const MEDAN_UPLOAD = (semua) => [
  { kunci: 'tgl', label: tr({ id: 'Waktu', en: 'Time', zh: '时间' }), tipe: 'tanggal', ambil: u => u.at },
  {
    kunci: 'by', label: tr({ id: 'Oleh', en: 'By', zh: '操作人' }), tipe: 'pilih',
    opsi: [...new Set((semua || []).map(u => u.by).filter(Boolean))].sort(), ambil: u => u.by,
  },
  { kunci: 'file', label: tr({ id: 'File', en: 'File', zh: '文件' }), tipe: 'teks', ambil: u => u.fileName },
  { kunci: 'sheet', label: tr({ id: 'Sheet', en: 'Sheet', zh: '工作表' }), tipe: 'teks', ambil: u => u.sheetName },
];

function uploadsTab(st) {
  const semua = st.labelUploads || [];
  if (!semua.length) return card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
    id: 'Belum ada riwayat upload.', en: 'No upload history yet.', zh: '暂无上传记录。',
  }))]);
  const medan = MEDAN_UPLOAD(semua);
  const nilai = nilaiFilter('ls-upload');
  const list = saring(semua, medan, nilai);
  const kepala = [
    tr({ id: 'Waktu', en: 'Time', zh: '时间' }),
    tr({ id: 'Oleh', en: 'By', zh: '操作人' }),
    tr({ id: 'File', en: 'File', zh: '文件' }),
    tr({ id: 'Sheet', en: 'Sheet', zh: '工作表' }),
    tr({ id: 'Dibaca', en: 'Read', zh: '已读取' }),
    tr({ id: 'Masuk', en: 'Imported', zh: '已导入' }),
    tr({ id: 'Dobel', en: 'Duplicate', zh: '重复' }),
    tr({ id: 'Rumus?', en: 'Formula?', zh: '公式？' }),
  ];
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', tr({ id: 'Riwayat Upload', en: 'Upload History', zh: '上传记录' })),
      hitunganSaring(list.length, semua.length, { id: 'upload', en: `upload${semua.length === 1 ? '' : 's'}`, zh: '次上传' }),
      tombolFilter({
        id: 'ls-upload', medan,
        judul: tr({ id: 'Saring Riwayat Upload', en: 'Filter Upload History', zh: '筛选上传记录' }),
      }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map((c, i) => h('th' + (i >= 4 ? '.r' : ''), c)))),
      h('tbody', list.length ? list.map(u => h('tr', [
        h('td.mono', { style: { fontSize: '10.5px' } }, fmtDateTime(u.at)),
        h('td', u.by || '—'),
        h('td', { style: { fontSize: '11px' } }, u.fileName || '—'),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, u.sheetName || '—'),
        h('td.mono.r', num(u.total)),
        h('td.mono.r', num(u.imported)),
        h('td.mono.r', { style: { color: u.duplicate ? 'var(--st-red-tx)' : 'var(--text-3)', fontWeight: u.duplicate ? 700 : 400 } }, num(u.duplicate)),
        h('td.mono.r', { style: { color: u.mismatch ? 'var(--st-amber-tx)' : 'var(--text-3)' } }, num(u.mismatch)),
      ])) : barisTakCocok(kepala.length, { id: 'ls-upload', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
  ]);
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

// Dua kotak tanggal, bukan satu. Tanggal order menjawab "apa saja yang dipesan
// bulan lalu"; perkiraan sampai menjawab "apa yang seharusnya sudah datang
// minggu ini" — dan yang kedua itulah pertanyaan yang membuat orang membuka
// tab ini. Satu kotak tanggal saja memaksa salah satu pertanyaan dijawab
// dengan menggulir.
//
// Prioritas dan Status memakai teks TERJEMAHANNYA, sama persis dengan lencana
// yang tampil di kolomnya. Kolomnya sudah lewat priorityLabel/alertLabel, jadi
// dropdown berisi kode mentah ('Super Urgent' vs '特急') akan jadi dropdown
// yang tidak cocok dengan apa pun yang terbaca di layar.
const MEDAN_ORDER = (semua) => [
  { kunci: 'po', label: tr({ id: 'No. PO', en: 'PO no.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: o => o.poNo },
  { kunci: 'erp', label: tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }), tipe: 'teks', mono: true, ambil: o => o.erp },
  { kunci: 'nama', label: tr({ id: 'Nama', en: 'Name', zh: '名称' }), tipe: 'teks', ambil: o => o.name },
  { kunci: 'tglOrder', label: tr({ id: 'Tgl Order', en: 'Order Date', zh: '下单日期' }), tipe: 'tanggal', ambil: o => o.orderDate },
  { kunci: 'tglSampai', label: tr({ id: 'Perkiraan Sampai', en: 'Expected Arrival', zh: '预计到货' }), tipe: 'tanggal', ambil: o => o.expectedArrival },
  {
    kunci: 'prioritas', label: tr({ id: 'Prioritas', en: 'Priority', zh: '优先级' }), tipe: 'pilih',
    opsi: [...new Set((semua || []).map(o => o.priority).filter(Boolean))].sort().map(priorityLabel),
    ambil: o => (o.priority ? priorityLabel(o.priority) : ''),
  },
  {
    kunci: 'status', label: tr({ id: 'Status', en: 'Status', zh: '状态' }), tipe: 'pilih',
    opsi: [...new Set((semua || []).map(o => o.alert).filter(Boolean))].sort().map(alertLabel),
    ambil: o => (o.alert ? alertLabel(o.alert) : ''),
  },
];

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
  const medan = MEDAN_ORDER(orders);
  const nilai = nilaiFilter('ls-order');
  const tersaring = saring(orders, medan, nilai);
  // POTONGNYA SESUDAH SARINGAN, BUKAN SEBELUMNYA.
  //
  // Dipotong lebih dulu berarti saringan cuma bekerja pada 300 order pertama:
  // mencari satu PO yang kebetulan nomor 340 menghasilkan "tidak ada yang
  // cocok" untuk order yang jelas-jelas ada di portal. Angka di sebelah judul
  // juga dihitung dari SEBELUM dipotong — kalau dari sesudah, "300 dari 300"
  // akan tertulis di layar yang sebenarnya menyembunyikan 40 baris.
  const tampil = tersaring.slice(0, 300);
  return h('div.stack', [chips, dblBanner, h('div.card', [
    h('div.card-head', [
      h('div.card-title', tr({ id: 'Order Tracking', en: 'Order Tracking', zh: '订单跟踪' })),
      hitunganSaring(tersaring.length, orders.length, { id: 'order', en: `order${orders.length === 1 ? '' : 's'}`, zh: '个订单' }),
      tombolFilter({
        id: 'ls-order', medan,
        judul: tr({ id: 'Saring Order Tracking', en: 'Filter Order Tracking', zh: '筛选订单跟踪' }),
      }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', head.map((c, i) => h('th' + ([4, 5, 6].includes(i) ? '.r' : ''), c)))),
      h('tbody', tampil.length ? tampil.map(o => h('tr', {
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
      ])) : barisTakCocok(head.length, { id: 'ls-order', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
    // Potongannya DISEBUT. Sebelumnya 300 baris pertama ditampilkan dan sisanya
    // hilang tanpa satu pun tulisan — daftar yang berhenti di tengah terlihat
    // persis seperti daftar yang memang habis di situ, dan yang mencari order
    // ke-301 menyimpulkan portal tidak mencatatnya.
    tersaring.length > tampil.length ? h('div', {
      style: { padding: '9px 14px', fontSize: '11px', color: 'var(--text-3)', borderTop: '1px solid var(--border)' },
    }, tr({
      id: `Menampilkan ${tampil.length} order teratas dari ${tersaring.length} — persempit dengan saringan untuk melihat sisanya.`,
      en: `Showing the top ${tampil.length} of ${tersaring.length} orders — narrow it with the filter to reach the rest.`,
      zh: `显示 ${tersaring.length} 个订单中的前 ${tampil.length} 个 — 请使用筛选缩小范围以查看其余部分。`,
    })) : null,
  ])]);
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

const kepalaCocok = () => [
  tr({ id: 'Spec (dari tracker)', en: 'Spec (from tracker)', zh: '规格（来自跟踪表）' }),
  tr({ id: 'Market', en: 'Market', zh: '市场' }),
  tr({ id: 'Tebakan ERP', en: 'ERP Guess', zh: 'ERP 推测' }),
  tr({ id: 'Spec kandidat', en: 'Candidate Spec', zh: '候选规格' }),
  tr({ id: 'Yakin', en: 'Confidence', zh: '置信度' }),
  tr({ id: 'Aksi', en: 'Action', zh: '操作' }),
];

// Cuma dua kotak, dan itu memang seluruh yang bisa disaring di sini.
//
// Kolom Tebakan ERP, Spec kandidat, dan Yakin TIDAK bisa jadi kotak saringan:
// ketiganya lahir dari guessErp(), yang cuma dijalankan untuk 60 baris yang
// tampil. Menyaring lewat kolom itu berarti memanggil guessErp() untuk seluruh
// 900-an baris di setiap render — pengorbanan yang catatan di bawah ini justru
// dibuat untuk menghindarinya, dan hasilnya layar yang macet tiap satu klik.
const MEDAN_COCOK = (semua) => [
  { kunci: 'spec', label: tr({ id: 'Spec (dari tracker)', en: 'Spec (from tracker)', zh: '规格（来自跟踪表）' }), tipe: 'teks', ambil: r => r.spec },
  {
    kunci: 'market', label: tr({ id: 'Market', en: 'Market', zh: '市场' }), tipe: 'pilih',
    opsi: [...new Set((semua || []).map(r => r.market).filter(Boolean))].sort(), ambil: r => r.market,
  },
];

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
  const medan = MEDAN_COCOK(unmatched);
  const nilai = nilaiFilter('ls-cocok');
  // Saring DULU, potong SESUDAHNYA. Sebaliknya, saringannya cuma berlaku pada
  // 60 nama pertama — dan tab ini justru dipakai dengan 900-an nama belum
  // kecocok, jadi hampir semua yang dicari orang duduk di luar 60 itu. Mencari
  // spec yang jelas ada dan mendapat "tidak ada yang cocok" adalah cara paling
  // cepat membuat orang berhenti memakai kotak carinya.
  const tersaring = saring(unmatched, medan, nilai);
  // Guess once per render for the visible slice only — guessErp scans every
  // candidate, so doing all 974 x N candidates on each keystroke would crawl.
  const shown = tersaring.slice(0, 60);
  const guesses = shown.map(r => guessErp(r, cands));

  return h('div.stack', [
    h('div.row.gap8', { style: { alignItems: 'center' } }, [
      hitunganSaring(tersaring.length, unmatched.length, {
        id: 'belum kecocok', en: 'still unmatched', zh: '条未匹配',
      }),
      tombolFilter({
        id: 'ls-cocok', medan,
        judul: tr({ id: 'Saring Cocokkan ERP', en: 'Filter Match ERP', zh: '筛选匹配 ERP' }),
      }),
      // Angka potongannya berdiri sendiri, terpisah dari hitungan saringan di
      // sebelahnya: "60 dari 940" dan "940 dari 974" itu dua kabar berbeda, dan
      // menggabungkannya jadi satu angka menyembunyikan salah satunya.
      tersaring.length > shown.length ? h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `· ${shown.length} teratas ditampilkan`,
        en: `· top ${shown.length} shown`,
        zh: `· 显示前 ${shown.length} 条`,
      })) : null,
      // "Terima semua" berarti semua YANG ADA DI TABEL INI — dia jalan di
      // `shown`, yaitu hasil saringan yang sudah dipotong 60. Ini tombol yang
      // MENULIS ke label_stock, jadi jangkauannya harus persis sama dengan apa
      // yang barusan dibaca orangnya: menerima tebakan untuk baris yang sedang
      // disembunyikan saringan berarti menulis kode ERP yang tidak sempat
      // dilihat siapa pun, dan kode ERP yang salah diam-diam menyeret kiriman
      // barang lain ke SKU ini.
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
      h('thead', h('tr', kepalaCocok().map(c => h('th', c)))),
      h('tbody', shown.length ? shown.map((r, i) => {
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
      }) : barisTakCocok(kepalaCocok().length, { id: 'ls-cocok', adaFilter: jumlahFilterAktif(nilai) > 0 })),
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

// SPEC YANG DIPRODUKSI TAPI TIDAK PUNYA BARIS LABEL
// ---------------------------------------------------------------------------
// Merah, dan di atas segalanya kecuali blok rencananya sendiri. Ini satu-satunya
// hal di layar ini yang berarti "daftar belanjanya TIDAK lengkap" — bukan salah
// hitung, tapi ada barang yang tidak pernah ikut dihitung sama sekali.
//
// Sengaja tidak bisa ditutup dan tidak memblokir simpan. Menutupnya berarti
// mengizinkan orang melupakannya; memblokir berarti rutinitas mingguan sona
// berhenti karena masalah yang bukan dia yang bisa selesaikan.
function noRowBanner(plan) {
  const s = plan.stats;
  return h('div.cfg-banner', {
    style: { display: 'block', background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' },
  }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${num(s.takAdaBarisnya)} spec di rencana TIDAK punya baris di tracker — ${num(s.volTakAdaBarisnya)} pcs (${s.pctVolTakAda}% dari rencana produksi)`,
      en: ` ${num(s.takAdaBarisnya)} specs in the plan have NO row in the tracker — ${num(s.volTakAdaBarisnya)} pcs (${s.pctVolTakAda}% of planned production)`,
      zh: ` 计划中有 ${num(s.takAdaBarisnya)} 个规格在跟踪表中没有对应行 — ${num(s.volTakAdaBarisnya)} 条（占排产计划的 ${s.pctVolTakAda}%）`,
    })]),
    h('div', { style: { fontSize: '10.5px', margin: '3px 0 6px' } }, tr({
      id: 'Barang ini dipastikan diproduksi, tapi tidak ada baris yang menghitung labelnya — jadi tidak akan pernah muncul di BUY NOW. Bukan salah hitung: memang tidak ikut dihitung. Tambahkan barisnya di Excel, lalu upload ulang.',
      en: 'These are confirmed for production but no row counts their labels, so they can never appear in BUY NOW. Not a miscalculation — simply never counted. Add the rows in Excel and upload again.',
      zh: '这些产品已确认投产，但没有任何行统计其标签，因此永远不会出现在需采购列表中。这不是计算错误 — 而是根本未被计入。请在 Excel 中补充行后重新上传。',
    })),
    ...plan.takAdaBarisnya.slice(0, 6).map(r => h('div.mono', { style: { fontSize: '10px' } }, `• ${r.spec.slice(0, 46)} — ${num(r.qty)}`)),
    plan.takAdaBarisnya.length > 6 ? h('div', { style: { fontSize: '10px' } }, tr({
      id: `…dan ${plan.takAdaBarisnya.length - 6} lagi`,
      en: `…and ${plan.takAdaBarisnya.length - 6} more`,
      zh: `…还有 ${plan.takAdaBarisnya.length - 6} 个`,
    })) : null,
    h('div', { style: { marginTop: '8px' } }, btn(tr({
      id: 'Export daftarnya ke Excel', en: 'Export the list to Excel', zh: '导出列表到 Excel',
    }), { sm: true, iconName: 'download', onClick: () => exportNoRow(plan) })),
  ]);
}

async function exportNoRow(plan) {
  const aoa = [
    ['Spec Name', 'Qty Rencana', 'Sumber', 'Current Label Stock', 'Planned Production (units)', 'Planned Sales (units)'],
    ...plan.takAdaBarisnya.map(r => [r.spec, r.qty, r.dari, '', r.dari === 'produksi' ? r.qty : '', r.dari === 'penjualan' ? r.qty : '']),
  ];
  try {
    await writeWorkbook(`Spec Tanpa Baris Label - ${fmtDate(new Date())}.xlsx`, [{
      name: 'Tambahkan ke Tracker',
      aoa,
      cols: [{ wch: 58 }, { wch: 13 }, { wch: 11 }, { wch: 19 }, { wch: 24 }, { wch: 20 }],
    }]);
  } catch (e) {
    console.error('export gagal', e);
    toast({ id: 'Export gagal: ' + (e.message || e), en: 'Export failed: ' + (e.message || e), zh: '导出失败：' + (e.message || e) });
  }
}
