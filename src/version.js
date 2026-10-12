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

export const VERSION = 'v20.0';
export const VERSION_DATE = '12 Okt 2026';

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
      id: "DASHBOARD GUDANG — KARENA SELAMA INI MEREKA MENDARAT DI HALAMAN KOSONG. Peran gudang ditambahkan di v17.0, tapi tidak ada satu pun cabang di dashboard.js yang menyebutnya, jadi dia jatuh ke penangkap terakhir `else body = []`. Akibatnya wangyaqian dan warehousemti login, sampai di beranda, dan yang mereka lihat cuma judul 'Selamat datang' di atas halaman putih. Itu bukan keputusan desain, itu kelalaian — dan halaman kosong mengajari orang bahwa sistemnya rusak sebelum dia sempat dipakai sekali pun. Sekarang isinya empat angka dan dua daftar, semuanya dari data yang sudah ada di state waktu login, tanpa satu pun permintaan tambahan ke server. Empat angkanya: barang yang belum datang (total pcs, dengan jumlah baris dan jumlah PO sebagai keterangan), yang sudah ditandai sampai dalam tujuh hari terakhir, komplain yang masih terbuka se-gudang, dan komplain milik akun ini sendiri. Angka 'ditandai sampai' dibaca dari receivedDirectAt — cap waktu yang ditulis layar PO Outstanding — bukan dari audit_log, yang cuma menyimpan dua puluh baris terakhir SELURUH portal dan karena itu akan melaporkan nol pada hari yang ramai. Daftar pertama: delapan PO dengan sisa terbesar, barisnya bisa diklik dan langsung membuka layar PO Outstanding. Ini bukan daftar kerja — daftar kerjanya tetap di layar itu — tujuannya supaya orang gudang tahu apa yang paling ditunggu tanpa menggulir 856 baris. Daftar kedua: komplain milik akun ini beserta statusnya. Yang melapor TIDAK bisa menutup laporannya sendiri, jadi satu-satunya cara dia tahu laporannya sedang diurus adalah melihat statusnya berubah dari Terbuka ke Diproses — dan sampai rilis ini tidak ada tempat untuk melihatnya selain membuka layar komplain lalu menyaring sendiri. Tombol cepatnya dua: PO Outstanding dan Lapor Komplain, persis dua pekerjaan yang memang mereka punya. YANG SENGAJA TIDAK DIBUAT: kartu 'rencana datang 7 hari ke depan', walau itu yang paling sering diminta. ETA tidak disimpan di tabel pos sama sekali — tempatnya di Spreadsheet — jadi kartunya akan selalu menampilkan nol, dan kartu yang selalu nol lebih buruk daripada tidak ada kartu: dia mengajari orang untuk berhenti melihat. Kartunya dibuat begitu sync Spreadsheet jalan dan ETA punya rumah di basis data.",
      en: "A WAREHOUSE DASHBOARD — BECAUSE UNTIL NOW THEY LANDED ON A BLANK PAGE. The warehouse role was added in v17.0, but no branch in dashboard.js ever named it, so it fell through to the final catch-all `else body = []`. wangyaqian and warehousemti would sign in, arrive at the home screen, and see a 'Welcome' heading above an empty white page. That was not a design decision, it was an oversight — and a blank page teaches someone the system is broken before they have used it once. It now carries four figures and two lists, all from data already in state at login, with no extra server request. The four figures: goods not yet arrived (total pieces, with line and PO counts as the subtitle), what was marked arrived in the last seven days, open complaints across the warehouse, and this account's own complaints. The 'marked arrived' figure is read from receivedDirectAt — the timestamp the Outstanding PO screen writes — not from audit_log, which only holds the last twenty rows of the WHOLE portal and would therefore report zero on a busy day. First list: the eight POs with the largest balances, each row clickable straight through to the Outstanding PO screen. This is not a worklist — the worklist stays on that screen — its purpose is to let the warehouse see what is most awaited without scrolling 856 lines. Second list: this account's own complaints with their status. The reporter CANNOT close their own report, so the only way they learn it is being handled is to watch the status move from Open to In progress — and until this release there was nowhere to see that short of opening the complaints screen and filtering by hand. Two quick actions: Outstanding PO and Report a Complaint, exactly the two jobs they have. DELIBERATELY NOT BUILT: an 'arriving in the next 7 days' card, even though it is the most requested one. The ETA is not stored in the pos table at all — it lives in the Spreadsheet — so the card would permanently read zero, and a card that always reads zero is worse than no card: it teaches people to stop looking. It gets built once the Spreadsheet sync runs and the ETA has a home in the database.",
      zh: "仓库首页 — 此前他们登录后看到的是一片空白。仓库角色在 v17.0 加入，但 dashboard.js 中没有任何分支提到它，因而落入最后的兜底分支 `else body = []`。结果 wangyaqian 与 warehousemti 登录后进入首页，看到的只是一行「欢迎」标题和一片空白。这不是设计决定，而是疏漏 — 空白页面会在系统尚未被使用一次之前，就教会使用者「它坏了」。现在页面包含四个数字与两个列表，全部取自登录时已在 state 中的数据，不额外请求服务器。四个数字：尚未到货（总件数，副标题为行数与采购单数）、最近七天已标记到货、全仓待处理投诉、本账号自己的投诉。「已标记到货」取自 receivedDirectAt — 即未交采购单页面写入的时间戳 — 而非 audit_log，后者仅保留整个系统最近二十条记录，在繁忙的一天反而会显示为零。第一个列表：未交数量最多的八张采购单，每行可直接点击跳转至未交采购单页面。这不是待办清单 — 待办仍在该页面 — 其用途是让仓库无需滚动 856 行即可知道哪批货最被期待。第二个列表：本账号自己的投诉及其状态。上报人不能关闭自己的投诉，因此他唯一能知道投诉正在被处理的方式，就是看到状态从「待处理」变为「处理中」—而在本次发布之前，除了打开投诉页面手动筛选之外无处可看。两个快捷按钮：未交采购单与提交投诉，正好对应他们拥有的两项工作。有意未做：「未来 7 天到货计划」卡片，尽管这是呼声最高的一项。预计到货日根本未存储于 pos 表中 — 它在表格里 — 因此该卡片将永远显示为零，而永远显示为零的卡片比没有卡片更糟：它会教人不再去看。待表格同步启用、预计到货日在数据库中有了归属后再做。",
};
