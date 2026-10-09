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

export const VERSION = 'v18.0';
export const VERSION_DATE = '09 Okt 2026';

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
      id: "LOG HAPUS PO, DAN SPANDUK DRIVE YANG AKHIRNYA MENYEBUT NAMA BERKASNYA. Catatan penghapusan PO sebenarnya SUDAH ADA sejak lama: keempat jalurnya menulis barisnya ke audit_log (delete_own_pending, request_delete, approve_delete, reject_delete), dan hari ini tabelnya sudah memuat 39 baris. Yang tidak ada adalah tempat membacanya. Satu-satunya jalan sebelum rilis ini: kartu Aktivitas Terbaru di Dashboard yang cuma menampung enam baris terakhir dari SEMUA jenis kejadian, sehingga satu penghapusan terdorong keluar layar oleh enam kali ganti status; tab Audit di dalam ekspor Excel Reports, yang baru terbaca sesudah diunduh dan dibuka, dan tidak ada yang mengunduh laporan untuk memeriksa satu PO; serta drawer audit di Master Data yang cuma melayani supplier. Jadi pertanyaan siapa yang menghapus PO ini, kapan, dan kenapa tidak punya jawaban yang bisa dibuka dalam sepuluh detik. Sekarang punya: satu layar, disaring per jenis aksi, bisa dicari per nomor PO, per user, atau per kata di alasannya, dan bisa diekspor ke Excel. Layarnya MEMBACA SAJA — tidak ada satu pun tombol yang mengubah baris audit, dan memang tidak boleh ada: catatan yang bisa disunting oleh orang yang catatannya sedang diperiksa bukan catatan. HAKNYA SUPERVISOR DAN MANAJER SAJA, dan penjaganya tiga lapis yang sudah ada semua. ACCESS menyembunyikan menunya; can(auditHapus) menolak layarnya sendiri, karena sebuah id layar bisa sampai ke render() lewat tab tersimpan, notifikasi, atau hasil pencarian global, bukan cuma lewat klik di menu; dan yang sesungguhnya menegakkan ada di basis data — policy audit_read berbunyi is_admin() OR username = current_username() OR is_observer(), dengan is_admin() = peran wilbert (jadi kevin ikut, lewat alias) dan is_observer() = cenjc. TIDAK ADA SQL BARU yang perlu dijalankan: policy-nya sudah persis memberi kedua kelompok itu seluruh jejaknya, sementara peran lain tetap cuma melihat barisnya sendiri. Dua baris audit juga diperbaiki supaya layar ini tidak menampilkan kalimat kosong: approve_delete dan reject_delete dulu dicatat TANPA detail, jadi yang terbaca enam bulan lagi cuma 'wilbert menyetujui penghapusan' tanpa satu kata pun tentang kenapa. Sekarang alasan dari permintaannya ikut tercatat, dan untuk reject_delete alasannya dibaca SEBELUM po.deleteReason dikosongkan. SPANDUK DRIVE KUNING SEKARANG MENYEBUT NAMA BERKASNYA. Spanduk merah di atasnya sudah menyebut nama satu per satu sejak v15.20, tapi yang kuning cuma menyebut jumlahnya — padahal dua-duanya dibaca orang yang sama, berurutan, dan pertanyaan pertamanya persis sama: berkas yang mana. Tanpa namanya, satu-satunya cara menjawabnya adalah membuka Supabase. Yang mau diketahui orangnya juga bukan sekadar 'ada dua yang tertahan', tapi 'apakah PUNYAKU yang tertahan', dan itu tidak bisa dijawab oleh angka. Namanya ditampilkan sebagai TEKS, bukan tombol: baris pending memang tidak butuh tindakan apa pun, dan tombol di sebelah kalimat 'tidak perlu upload ulang' cuma mengundang orang menekannya. Dua belas nama pertama ditampilkan, sisanya dihitung.",
      en: "A PO DELETION LOG, AND A DRIVE BANNER THAT FINALLY NAMES ITS FILES. The deletion record already existed: all four paths write their row to audit_log (delete_own_pending, request_delete, approve_delete, reject_delete), and the table already holds 39 of them. What did not exist was anywhere to read it. Before this release there were three ways, and none of them worked: the Recent Activity card on the Dashboard holds six rows of EVERY kind of event, so one deletion is pushed off screen by six status changes; the Audit tab inside the Reports Excel export, which is only legible after it has been downloaded and opened, and nobody downloads a report to check one PO; and the audit drawer in Master Data, which only serves suppliers. So 'who deleted this PO, when, and why' had no answer anyone could open in ten seconds. Now it does: one screen, filtered by action, searchable by PO number, by user, or by a word in the reason, and exportable to Excel. The screen is READ-ONLY — not one button changes an audit row, and none may ever: a record that can be edited by the person whose record is being examined is not a record. SUPERVISOR AND MANAGER ONLY, with three layers of gate that all already existed. ACCESS hides the menu; can(auditHapus) refuses the screen itself, because a screen id can reach render() through a restored tab, a notification, or a global search result, not only through a click in the menu; and the real enforcement is in the database — the audit_read policy reads is_admin() OR username = current_username() OR is_observer(), where is_admin() is the wilbert role (so kevin is included through his alias) and is_observer() is cenjc. NO NEW SQL is needed: the policy already grants exactly those two groups the whole trail, while every other role still sees only its own rows. Two audit rows were also fixed so this screen does not display a blank sentence: approve_delete and reject_delete were recorded with NO detail, so what reads back in six months was 'wilbert approved the deletion' with not one word about why. The reason from the request now travels with them, and for reject_delete it is read BEFORE po.deleteReason is cleared. THE YELLOW DRIVE BANNER NOW NAMES ITS FILES. The red banner above it has named them one by one since v15.20, but the yellow one gave only a count — though the same person reads both, in sequence, and asks the same first question: which files. Without the names the only way to answer it was to open Supabase. What the person wants to know is not 'two are held up' but 'is MINE held up', and a number cannot answer that. The names are rendered as TEXT, not buttons: a pending row needs no action at all, and a button next to the sentence 'no need to re-upload' only invites someone to press it. The first twelve are listed and the rest are counted.",
      zh: "采购单删除记录页面，以及终于会列出文件名的 Drive 横幅。删除记录其实早已存在：四条路径都会向 audit_log 写入记录（delete_own_pending、request_delete、approve_delete、reject_delete），目前表中已有 39 条。缺的是查看它的地方。本次发布之前只有三条路，且都不好用：首页的「最近活动」卡片只保留全部类型事件中的最近六条，一次删除会被六次状态变更挤出屏幕；报表 Excel 导出中的审计页，必须下载并打开后才能阅读，而没有人会为了查一张采购单去下载报表；以及主数据中的审计抽屉，只服务于供应商。因此「这张采购单是谁删的、什么时候、为什么」没有一个十秒内能打开的答案。现在有了：一个页面，可按操作类型筛选，可按采购单号、用户或原因中的关键词搜索，并可导出 Excel。本页面只读 — 没有任何按钮能修改审计记录，也绝不应该有：能被受审查者本人编辑的记录不是记录。仅限主管与经理，三层防护且均已存在。ACCESS 隐藏菜单；can(auditHapus) 在页面本身拒绝，因为页面 id 可能通过恢复的标签页、通知或全局搜索结果到达 render()，而不仅仅是菜单点击；真正的强制在数据库 — audit_read 策略为 is_admin() OR username = current_username() OR is_observer()，其中 is_admin() 为 wilbert 角色（kevin 通过别名包含在内），is_observer() 为 cenjc。无需执行任何新的 SQL：该策略已恰好向这两类人授予完整记录，其他角色仍只能看到自己的记录。另修正两类审计记录，以免本页显示空白说明：approve_delete 与 reject_delete 此前不记录 detail，六个月后读到的只有「wilbert 批准了删除」，却没有一个字说明原因。现在申请中的原因会一并记录，且 reject_delete 的原因在 po.deleteReason 被清空之前读取。黄色 Drive 横幅现在会列出文件名。其上方的红色横幅自 v15.20 起就逐个列出文件名，而黄色横幅只给出数量 — 但两者由同一个人先后阅读，第一个问题完全相同：是哪些文件。没有文件名，唯一的回答方式是打开 Supabase。人们想知道的不是「有两个被卡住」，而是「卡住的是不是我的」，数字无法回答这一点。文件名以文本呈现，而非按钮：待处理的记录本就不需要任何操作，而在「无需重新上传」这句话旁边放一个按钮只会诱使人去点它。列出前十二个，其余计数显示。",
};
