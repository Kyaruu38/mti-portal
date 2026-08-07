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

export const VERSION = 'v14.6';
export const VERSION_DATE = '7 Agu 2026';

// Newest first. Kept short on purpose: this is the "did my thing land?" list,
// not a changelog. The commit messages carry the reasoning.
// Ringkasan rilis TERBARU saja.
//
// layout.js cuma memakai CHANGELOG[0].what — satu entri — untuk tooltip nomor
// versi di sidebar. Tapi mengimpor CHANGELOG berarti menyeret SELURUH riwayat
// rilis, 40 KB teks tiga bahasa, ke dalam unduhan pertama setiap orang. Jadi
// entri teratas disalin ke sini, dan riwayat lengkapnya pindah ke changelog.js
// yang tidak diimpor siapa pun saat boot.
//
// Waktu menaikkan versi: perbarui VERSION, VERSION_DATE, LATEST di sini, dan
// tambahkan entri lengkapnya di changelog.js.
export const LATEST = {
      id: 'Setiap klik di layar yang tabelnya panjang berhenti terasa berat. core/dom.js mount() tidak membandingkan apa pun: setiap perubahan membuang seluruh isi layar lalu membangunnya lagi dari nol — jadi ongkos SETIAP tombol sebanding dengan jumlah baris yang sedang tampil, bukan dengan besarnya perubahan. Diukur di Stok Label dengan 974 SKU asli: 400 baris tampil = 5.311 elemen = 291 ms per klik; 0 baris = 75 elemen = 30 ms. Garis lurus — tabelnya adalah SELURUH ongkosnya, dan lima kartu angka, tiga kotak unggah, enam tab, serta semua spanduk peringatan digabung cuma 30 ms. Batas 400 yang lama dipilih supaya "hampir semua muat"; yang benar-benar terjadi adalah hampir tidak ada yang menggulir sejauh itu sementara semua orang membayar ongkosnya di setiap klik, sepanjang hari. Sekarang sepuluh baris adalah bawaannya, dengan pilihan 10 / 20 / 50 / 100 / Semua dan tombol pindah halaman di kaki tiap tabel. Diukur ulang di data yang sama: klik tombol cara unggah 336 ms → 30 ms, ganti bahasa 265 ms → 34 ms. Sebelas kali lebih ringan. Ongkos besar tetap tersedia lewat "Semua" — tapi jadi keputusan orangnya, bukan pajak yang ditagihkan diam-diam ke semua orang. Dipasang di Stok Label (tabel stok dan daftar beli punya halaman sendiri-sendiri), Invoice Masuk, Progress PRF, dan Register PPKEK. Progress PRF juga berhenti memotong diam-diam di 25: PRF ke-26 dulu tidak ada di layar dan tidak ada satu pun tulisan yang menyebutkannya. Sekarang seluruhnya ada, dibuka per halaman, dan jumlah aslinya tertulis di kaki tabel. Tombol "Download semua · ZIP" dan hitungan centang "sudah diterima" tetap memakai SELURUH PRF, bukan halaman yang kebetulan sedang tampil — kalau tidak, isi ZIP-nya berubah-ubah tergantung halaman berapa yang dibuka, tanpa satu pun tanda di layar yang menjelaskan kenapa. Mengganti jumlah baris atau mengetik di kotak cari selalu kembali ke halaman 1: tanpa itu, orang di halaman 40 yang menyaring hasilnya menjadi tiga baris akan mendarat di halaman kosong dan menyimpulkan datanya hilang. Layar Payment juga dipecah jadi dua tab: Invoice dan PRF. Dia menumpuk lima hal sekaligus — kotak jatuh invoice, bagan alur status, tabel Invoice Masuk 137 baris, PRF Builder, dan Progress PRF 136 baris — padahal itu dua pekerjaan berbeda, dan yang kedua bahkan tidak bisa dimulai sebelum yang pertama selesai. Dijadikan TAB, bukan dua menu di sidebar, karena orang yang mengerjakannya sama: cania, visca, sekar, dan wilbert semuanya punya kedua haknya. Menu terpisah baru berguna kalau dua pekerjaan itu dipegang dua orang berbeda. Peringatan faktur pajak sengaja tetap di luar tab dan selalu terlihat — dia soal dokumen yang hilang dengan tenggat yang jalan terus, dan menyembunyikannya di balik tab yang kebetulan tidak dibuka sama saja dengan meniadakannya.',
      en: 'Every click on a screen with a long table stops feeling heavy. core/dom.js mount() compares nothing: every change throws away the entire screen and rebuilds it from scratch — so the cost of EVERY button is proportional to how many rows are currently on screen, not to the size of the change. Measured on Label Stock with the real 974 SKUs: 400 rows shown = 5,311 elements = 291 ms per click; 0 rows = 75 elements = 30 ms. A straight line — the table is the entire cost, and five stat cards, three drop zones, six tabs and every warning banner together come to just 30 ms. The old 400 cap was chosen so that "almost everything fits"; what actually happened is that almost nobody scrolled that far while everybody paid for it on every click, all day. Ten rows is now the default, with a 10 / 20 / 50 / 100 / All picker and page controls in every table\'s footer. Re-measured on the same data: the upload-mode button went 336 ms → 30 ms, switching language 265 ms → 34 ms. Eleven times lighter. The expensive option is still there under "All" — but as the person\'s own decision, not a tax quietly levied on everyone. Applied to Label Stock (the stock table and the buy list keep separate pages), Incoming Invoices, PRF Progress, and the PPKEK register. PRF Progress also stops truncating silently at 25: the 26th PRF simply was not on screen and nothing said so. All of them are there now, paged, with the real count in the footer. The "Download all · ZIP" button and the "mark as received" tick count still use EVERY PRF, not whichever page happens to be open — otherwise the ZIP\'s contents would change depending on the page, with nothing on screen explaining why. Changing the row count or typing in the search box always returns to page 1: without that, someone on page 40 who filters down to three rows lands on an empty page and concludes the data is gone. The Payment screen is also split into two tabs: Invoices and PRF. It stacked five things at once — the invoice drop zone, the status-flow diagram, the 137-row Incoming Invoices table, the PRF Builder, and the 136-row PRF Progress list — when those are two different jobs, and the second cannot even start until the first is done. Made TABS rather than two sidebar menus because the same people do both: cania, visca, sekar and wilbert all hold both capabilities. Separate menus only pay off when two different people own the two jobs. The tax-invoice warning deliberately stays outside the tabs, always visible — it concerns a missing document whose deadline keeps running, and hiding it behind a tab that happens to be closed is the same as removing it.',
      zh: '在表格较长的页面上，每次点击都不再卡顿。core/dom.js 的 mount() 不做任何比较：每次变更都会清空整个页面并从零重建 — 因此每个按钮的开销取决于当前显示的行数，而非变更本身的大小。在标签库存页面用真实的 974 个 SKU 实测：显示 400 行 = 5,311 个元素 = 每次点击 291 毫秒；显示 0 行 = 75 个元素 = 30 毫秒。呈直线关系 — 表格就是全部开销，而五张数字卡片、三个上传区、六个标签页以及所有警告横幅加起来仅 30 毫秒。此前 400 行的上限是为了让"几乎全部都能显示"；实际发生的却是几乎没人滚动到那么远，而所有人却要为此在每次点击时付出代价，全天如此。现在默认显示十行，并提供 10 / 20 / 50 / 100 / 全部 选择器，每个表格底部都有翻页控件。在同一批数据上重测：上传方式按钮 336 毫秒 → 30 毫秒，切换语言 265 毫秒 → 34 毫秒。轻了十一倍。高开销选项仍保留在"全部"中 — 但这是使用者自己的选择，而不是悄悄向所有人征收的税。已应用于标签库存（库存表与采购清单各自独立分页）、进项发票、付款申请单进度以及 PPKEK 登记表。付款申请单进度也不再在第 25 条静默截断：此前第 26 张付款申请单根本不在页面上，且没有任何提示。现在全部都在，分页显示，底部标明真实数量。"全部下载 · ZIP"按钮与"标记已收到"的勾选计数仍基于全部付款申请单，而非恰好打开的那一页 — 否则 ZIP 的内容会随页码变化，而页面上没有任何说明。更改每页行数或在搜索框输入时总会回到第 1 页：否则位于第 40 页的人筛选出三行结果后会落在空白页，从而以为数据丢失了。 付款页面也拆分为两个标签页：发票与付款申请单。此前它同时堆叠五样内容 — 发票拖放区、状态流程图、137 行的进项发票表、付款申请单生成器，以及 136 行的付款申请单进度 — 而这实际上是两项不同的工作，且第二项在第一项完成前根本无法开始。采用标签页而非两个侧边栏菜单，是因为做这两件事的是同一批人：cania、visca、sekar 和 wilbert 都同时拥有这两项权限。只有当两项工作由不同的人负责时，独立菜单才有意义。税票提醒刻意保留在标签页之外并始终可见 — 它关乎一份期限仍在流逝的缺失单据，把它藏在恰好未打开的标签页后面，等同于将其取消。',
};
