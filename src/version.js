// =============================================================================
// VERSION — one number, bumped on every release, printed where you can see it.
//
// This exists because of a concrete afternoon: three finished commits sat
// unpushed, the live site kept serving the old build, and the only way to find
// out was reading raw.githubusercontent.com. The screen said "v2.0" both before
// and after, so it could not have told anyone.
//
// THE RULE (Kyaruu's):
//   MAJOR — the digit BEFORE the dot — goes up when the app can do something it
//           could not do before, or does something in a way that changes how you
//           work. New capability. New screen. A different answer to "what
//           happens when I do X".
//   MINOR — the digit AFTER the dot — goes up for everything else: bug fixes,
//           parser corrections, copy, layout, anything you would describe as
//           "same thing, but right this time".
//
// One bump per RELEASE, not per commit — a release is what you push, and it is
// the push that changes what anyone actually sees.
//
// HOW TO USE IT: after a push, wait for GitHub Pages to rebuild, hard-refresh
// (Ctrl+Shift+R), and read the number in the sidebar footer. If it has not
// moved, you are still looking at the old build — the browser cache or the
// deploy, not the code.
// =============================================================================

export const VERSION = 'v3.7';
export const VERSION_DATE = '31 Jul 2026';

// Newest first. Kept short on purpose: this is the "did my thing land?" list,
// not a changelog. The commit messages carry the reasoning.
export const CHANGELOG = [
  {
    v: 'v3.7', date: '31 Jul 2026',
    what: {
      id: 'Form invoice keisi otomatis dari PDF yang teksnya kebaca (No. Invoice, jatuh tempo, nominal). Kalau tidak dikenali atau hasil scan: dibiarkan kosong, bukan diisi tebakan.',
      en: 'The invoice form fills itself from readable PDFs (number, due date, amount). Unrecognised or scanned: left blank rather than guessed.',
      zh: '可读 PDF 自动填写发票表单（发票号、到期日、金额）。无法识别或为扫描件时留空，绝不猜测。',
    },
  },
  {
    v: 'v3.6', date: '31 Jul 2026',
    what: {
      id: 'Download semua PRF sekaligus dalam satu ZIP, bukan satu-satu.',
      en: 'Download every PRF at once as a single ZIP instead of one at a time.',
      zh: '一次性打包下载全部付款申请单，无需逐张下载。',
    },
  },
  {
    v: 'v3.5', date: '31 Jul 2026',
    what: {
      id: 'Intake invoice terima banyak PDF sekaligus — modal jalan satu per satu dengan penanda "invoice 3 dari 7", ada tombol Lewati.',
      en: 'Invoice intake accepts many PDFs at once — the modal walks through them showing "invoice 3 of 7", with a Skip button.',
      zh: '发票录入支持一次拖入多个 PDF — 弹窗逐个处理并显示“第 3 / 7 张发票”，可跳过。',
    },
  },
  {
    v: 'v3.4', date: '31 Jul 2026',
    what: {
      id: 'Barang di LEMBAR LAMPIRAN ikut terbaca — dokumen yang isinya cuma "Terlampir" tidak lagi kosong. 17 bundel asli: 24 baris barang, 6 dokumen lebih dari satu barang.',
      en: 'Goods on the ATTACHMENT SHEET are read too — documents that only said "Terlampir" are no longer blank. 17 real bundles: 24 goods lines, 6 documents with more than one item.',
      zh: '附页货物明细现已读取 — 仅标注“Terlampir”的单据不再为空。17 个真实压缩包：24 条货物明细，其中 6 份为多项货物。',
    },
  },
  {
    v: 'v3.3', date: '31 Jul 2026',
    what: {
      id: 'Tiap barang di PPKEK tercatat satu baris utuh (kode, uraian, qty, harga). Export: kolom Valuta + Kurs, nama file "LIST PPKEK ...". Import Excel dibaca per NAMA kolom.',
      en: 'Every PPKEK goods line is recorded as one complete row (code, description, qty, price). Export: Currency + Rate columns, filename "LIST PPKEK ...". Excel import reads columns BY NAME.',
      zh: 'PPKEK 每项货物完整记录为一行（编码、品名、数量、单价）。导出新增币种与汇率列，文件名 "LIST PPKEK ..."。Excel 导入按列名读取。',
    },
  },
  {
    v: 'v3.2', date: '31 Jul 2026',
    what: {
      id: 'PPKEK mencatat mata uang dokumen (CNY/EUR/USD/IDR/…), bukan cuma USD. Re-import kini benar-benar tersimpan ke server.',
      en: 'PPKEK records the document currency (CNY/EUR/USD/IDR/…), not just USD. Re-imports now actually save to the server.',
      zh: 'PPKEK 记录单据币种（CNY/EUR/USD/IDR/…），不再只认美元。重新导入现在会真正写入服务器。',
    },
  },
  {
    v: 'v3.1', date: '31 Jul 2026',
    what: {
      id: 'Semua label layar ikut ganti bahasa (ID/EN/中). Nomor versi tampil di sidebar.',
      en: 'Every screen label follows the language switch (ID/EN/中). Version shown in the sidebar.',
      zh: '所有界面文字随语言切换（ID/EN/中）。侧栏显示版本号。',
    },
  },
  {
    v: 'v3.0', date: '31 Jul 2026',
    what: {
      id: 'PPKEK terima banyak RAR/ZIP sekaligus. Refresh tidak melempar ke login. Semua notifikasi trilingual.',
      en: 'PPKEK accepts many RAR/ZIP at once. Refresh no longer bounces to login. All notifications trilingual.',
      zh: 'PPKEK 支持一次导入多个 RAR/ZIP。刷新不再退回登录页。所有通知支持三语。',
    },
  },
  {
    v: 'v2.0', date: 'Jul 2026',
    what: {
      id: 'Portal v2 — PO Converter, Surat Jalan, PRF, Stok Label, PPKEK, Reports.',
      en: 'Portal v2 — PO Converter, Delivery Note, PRF, Label Stock, PPKEK, Reports.',
      zh: '门户 v2 — 采购单转换、送货单、付款申请单、标签库存、报关、报表。',
    },
  },
];
