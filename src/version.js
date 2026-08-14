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

export const VERSION = 'v15.14';
export const VERSION_DATE = '14 Agu 2026';

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
      id: "KOTAK DIALOG BAWAAN BROWSER DICABUT, ANTREAN APPROVAL BERHALAMAN, DAN RINGKASAN REPORTS DIRAPIKAN. TIGA prompt() DIGANTI DIALOG PORTAL SENDIRI. Alasan hapus PO — dua jalur, hapus sendiri dan ajukan hapus — plus kode ERP di Design Library masih memakai prompt() bawaan browser. Kotak itu digambar Chrome, bukan portal: ia berbunyi \"kyaruu38.github.io says\", memakai tipografi dan tombol sistem, tidak tahu apa-apa soal tema gelap, dan tidak bisa memuat penjelasan sepanjang kalimat \"barisnya hilang dari semua layar dan dari Reports\" tanpa menjejalkannya ke dalam satu baris judul. Sekarang dialognya milik portal: judul, penjelasan, kotak isian berlabel, dan tombol yang menyebut tindakannya (\"Hapus PO\", \"Ajukan\"), tiga bahasa penuh, warna merah untuk yang menghapus. Dibangun langsung ke DOM dan bukan lewat state, dengan alasan yang sama seperti kotak nominal invoice: mount() tidak punya diffing, jadi dialog yang hidup di dalam state akan kehilangan fokus setiap kali ada yang menyentuh state di latar. Esc membatalkan, Enter mengirim, Ctrl+Enter mengirim dari kotak banyak baris, klik di luar membatalkan, dan alasan yang isinya cuma spasi ditolak di tempat — prompt() dulu meloloskannya dan yang menyaring cuma satu .trim() di pemanggilnya. ANTREAN APPROVAL BERHALAMAN SEPULUH. 24 PO hari ini, dan setiap barisnya digambar ulang dari nol pada setiap setState — bareng satu lembar dokumen PO penuh di panel kanan. Yang TIDAK ikut dipotong halaman: pilihan approve massal, hitungan \"pilih semua yang menunggu\", dan label tombolnya. Ketiganya tetap bekerja atas daftar TERSARING, seluruh halaman. Mencentang delapan PO lalu pindah ke halaman dua tidak boleh membuat centangannya terlihat hilang — alasan yang sama persis dengan tickedCount di layar PRF. Sifat aman yang dipasang v15.9 tetap utuh, dan sifat itu bukan \"cuma yang tergambar\" melainkan ANGKA DI TOMBOL DAN YANG DITEMBAK ADALAH DAFTAR YANG SAMA; halaman tidak menyentuhnya, dan menyaring tetap membuang pilihan yang tersaring keluar. RINGKASAN REPORTS. Nominalnya berhenti dirangkai jadi satu baris \"USD 20.178.189,20 + IDR 27.253.436.530,00\". Tanda + di antara dua mata uang membaca seperti penjumlahan, padahal justru dua angka itu yang tidak boleh dijumlahkan; sekarang satu baris per mata uang, kode mata uangnya berdiri di kolom tetap sebelah kiri supaya angkanya sejajar. Kedua grafik — rincian per pemasok dan perbandingan bulan ke bulan — sekarang TERTUTUP dari awal dan dibuka dengan mengklik kepalanya. Keduanya jawaban atas pertanyaan yang tidak dibawa orang setiap kali membuka Reports, dan layar yang membuka semuanya sekaligus memaksa semua orang menggulung melewati jawaban yang tidak dicarinya. Tanda pisah panjang dicabut dari teks yang terlihat di kartu ini, atas permintaan Kyaru.",
      en: "NATIVE BROWSER DIALOGS REMOVED, THE APPROVAL QUEUE IS PAGED, AND THE REPORTS SUMMARY IS TIDIED. THREE prompt() CALLS REPLACED WITH THE PORTAL'S OWN DIALOG. The PO delete reason — both routes, delete-your-own and request-deletion — plus the ERP code in the Design Library still used the browser's prompt(). That box is drawn by Chrome, not by the portal: it says \"kyaruu38.github.io says\", uses system type and buttons, knows nothing about the dark theme, and cannot carry a sentence as long as \"the row disappears from every screen and from Reports\" without cramming it into a title line. The dialog is now the portal's own: a title, an explanation, a labelled input, and a button that names the act (\"Delete PO\", \"Submit request\"), in all three languages, red for the destructive one. Built straight into the DOM rather than through state, for the same reason as the invoice amount box: mount() has no diffing, so a dialog living in state loses focus every time anything touches state in the background. Esc cancels, Enter submits, Ctrl+Enter submits from the multi-line box, clicking outside cancels, and a reason made only of spaces is refused on the spot — prompt() let it through and the only thing filtering it was a .trim() at the call site. THE APPROVAL QUEUE PAGES BY TEN. 24 POs today, and every row was rebuilt from scratch on every setState, alongside a full PO document in the right panel. What is NOT paged: the bulk-approve selection, the \"select all awaiting\" count, and the button label. All three still work over the FILTERED list, every page. Ticking eight POs and turning to page two must not make those ticks look lost — the same reasoning as tickedCount on the PRF screen. The safety property added in v15.9 is intact, and that property was never \"only what is drawn\" but THE NUMBER ON THE BUTTON AND WHAT IT FIRES AT ARE THE SAME LIST; paging does not touch it, and filtering still discards selections that filter out. REPORTS SUMMARY. The figures stop being strung into one line reading \"USD 20,178,189.20 + IDR 27,253,436,530.00\". A plus sign between two currencies reads as addition, and those are precisely the two figures that must not be added; now one line per currency, with the currency code in a fixed left column so the numbers line up. Both charts — the per-supplier breakdown and the month-to-month comparison — now start CLOSED and open on clicking their header. Both answer questions nobody brings every time they open Reports, and a screen that opens everything at once forces everyone to scroll past the answers they were not looking for. Em dashes removed from the visible text on this card, at Kyaru's request.",
      zh: "移除浏览器原生对话框，审批队列分页，报表汇总排版调整。三处 prompt() 已替换为门户自有对话框。删除采购单的原因（自行删除与申请删除两条路径），以及设计库中的 ERP 编码，此前仍使用浏览器的 prompt()。那个框由 Chrome 绘制而非门户：它显示 \"kyaruu38.github.io says\"，使用系统字体与按钮，对深色主题一无所知，也无法容纳\"该行将从所有页面和报表中消失\"这样长度的说明，除非把它硬塞进标题行。现在的对话框属于门户自身：标题、说明、带标签的输入框，以及写明动作的按钮（\"删除采购单\"、\"提交申请\"），三语齐全，破坏性操作用红色。它直接构建到 DOM 而非经由 state，理由与发票金额输入框相同：mount() 没有 diff，因此存活于 state 中的对话框，只要后台有任何操作触碰 state 就会丢失焦点。Esc 取消，Enter 提交，多行框用 Ctrl+Enter 提交，点击外部取消，仅由空格组成的原因当场被拒 — prompt() 会放行，唯一的过滤只是调用处的一个 .trim()。审批队列每页十条。今天 24 张采购单，且每一行都在每次 setState 时从零重建，同时右侧还有一整张采购单文档。不参与分页的是：批量批准的勾选、\"全选待批准\"的计数，以及按钮标签。三者仍作用于整个筛选结果，跨所有页。勾选八张后翻到第二页，不能让这些勾看起来消失了 — 与付款申请单页面的 tickedCount 同理。v15.9 加入的安全属性完好无损，而该属性从来不是\"仅限已渲染的\"，而是按钮上的数字与它所触发的对象是同一份列表；分页不会改变这一点，筛选仍会丢弃被筛出的勾选。报表汇总。金额不再被串成一行 \"USD 20,178,189.20 + IDR 27,253,436,530.00\"。两个币种之间的加号读起来像是相加，而这恰恰是两个绝不能相加的数字；现在每个币种一行，币种代码位于固定的左列，使数字对齐。两个图表 — 按供应商明细与逐月对比 — 现在默认折叠，点击标题展开。它们回答的都不是人们每次打开报表时带来的问题，而一个把所有内容一次性铺开的页面，会迫使所有人滚动越过自己并不寻找的答案。应 Kyaru 要求，本卡片可见文本中的长破折号已移除。",
};
