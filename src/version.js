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

export const VERSION = 'v20.4';
export const VERSION_DATE = '2 Nov 2026';

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
  id: "SATU BERKAS DUDUK DI DUA SPANDUK SEKALIGUS, DAN KEDUANYA MENGATAKAN HAL YANG BERTOLAK BELAKANG TENTANG BERKAS YANG SAMA. Di layar: spanduk MERAH menyebut enam berkas dengan kalimat salinannya sudah tidak ada di server, portal tidak bisa mencoba lagi, harus diunggah ulang manual. Tepat di bawahnya spanduk KUNING menyebut ENAM NAMA YANG SAMA PERSIS dengan kalimat filenya AMAN, tersimpan di server, akan dikirim otomatis. Dua-duanya tidak mungkin benar, dan orang yang membacanya berurutan tidak punya cara tahu yang mana. SEBABNYA DUA QUERY YANG BERIRISAN. pendingOutbox() mengambil SEMUA baris berstatus pending. gagalOutbox(), sejak v20.3, sengaja ikut mengambil baris pending yang bertanda RAGU — keputusan yang benar, karena baris ragu memang butuh mata manusia: hasilnya tidak diketahui, berkasnya besar kemungkinan SUDAH ada di Drive, dan yang dibutuhkan cuma menempelkan link-nya. Tapi tidak ada satu pun dari keduanya yang mengeluarkan baris itu dari daftar lawannya, jadi setiap baris ragu muncul DUA KALI di dasbor, satu per spanduk. Enam baris terbaca sebagai dua belas masalah. YANG LEBIH MAHAL BUKAN HITUNGANNYA, TAPI KALIMATNYA. Judul spanduk merah tidak pernah ikut diubah waktu baris ragu mulai masuk ke sana, jadi untuk baris ragu kalimat itu salah pada DUA hal sekaligus: salinannya MASIH ada di server, dan portal justru sengaja TIDAK mencoba ulang baris ragu. Spanduk itu menyuruh orang mengunggah ulang berkas yang besar kemungkinan sudah ada di Drive — persis kesalahan yang v20.3 dibangun untuk menghentikan, muncul lagi lewat pintu lain. Dan ongkosnya nyata: kuota Drive akun itu sudah 96% penuh, jadi tiap salinan kedua dibayar dengan ruang yang memang sudah habis. SEKARANG SATU BERKAS CUMA PUNYA SATU SPANDUK. pendingOutbox() membuang yang bertanda ragu, karena spanduk merah sudah mengurusnya; dua daftar itu tidak pernah lagi beririsan. Dan judul spanduk merah dihitung dari isinya: kalau semuanya benar-benar mati, kalimatnya seperti dulu; kalau semuanya ragu, kalimatnya mengatakan apa adanya — hasilnya tidak diketahui, salinannya MASIH aman tapi portal sengaja TIDAK mencoba ulang sendiri (retryPending memang MELEWATI baris ragu, supaya tidak lahir salinan kedua), jadi cek Drive dulu lalu tempel link-nya atau tutup barisnya; kalau campuran, dua-duanya disebut dengan jumlahnya masing-masing. Warnanya tetap merah untuk ketiganya, karena ragu memang tidak gawat tapi tetap butuh orang yang membuka Drive — dan itu persis tugas spanduk merah. Tombol nama dan tombol tutup tidak disentuh: untuk baris ragu, menempel link Drive memang tetap tindakan yang paling benar.",
  en: "ONE FILE SAT IN TWO BANNERS AT ONCE, AND THEY SAID OPPOSITE THINGS ABOUT THE SAME FILE. On screen: the RED banner named six files and said the server copy is gone, the portal cannot retry, these must be re-uploaded by hand. Directly below it the YELLOW banner named THE SAME SIX FILES and said they are SAFE on the server and will be sent automatically. Both cannot be true, and a person reading them in order has no way to tell which is. THE CAUSE IS TWO OVERLAPPING QUERIES. pendingOutbox() returns EVERY row with status pending. gagalOutbox(), since v20.3, deliberately also returns pending rows carrying the RAGU marker — the right call, because an uncertain row does need human eyes: the outcome is unknown, the file is most likely ALREADY in Drive, and all that is needed is pasting its link. But neither query excluded those rows from the other's list, so every uncertain row appeared TWICE on the dashboard, once per banner. Six rows read as twelve problems. THE EXPENSIVE PART IS NOT THE COUNT, IT IS THE SENTENCE. The red banner's headline was never updated when uncertain rows started landing there, so for those rows it is wrong on TWO counts at once: the server copy is STILL there, and the portal deliberately does NOT retry uncertain rows. That banner was telling people to re-upload files that are most likely already in Drive — precisely the mistake v20.3 was built to stop, returning through another door. And the cost is real: that account's Drive quota is already 96% full, so every second copy is paid for with space that has already run out. NOW ONE FILE HAS EXACTLY ONE BANNER. pendingOutbox() drops rows marked uncertain, because the red banner already handles them; the two lists never overlap again. And the red banner's headline is computed from what it holds: if everything is truly dead the wording is as before; if everything is uncertain it says so plainly — the outcome is unknown, the copy is STILL safe but the portal deliberately will NOT retry on its own (retryPending skips uncertain rows precisely so a second copy is never created), so check Drive, then paste the link or close the row; if it is a mix, both are named with their own counts. The colour stays red for all three, because uncertain is not an emergency but it still needs someone to open Drive — which is exactly what the red banner is for. The name buttons and the close button are untouched: for an uncertain row, pasting the Drive link is still the right action.",
  zh: "同一个文件同时出现在两条横幅中，而这两条横幅对同一个文件说着相反的话。屏幕上：红色横幅列出六个文件，写着服务器副本已不存在、门户无法重试、必须人工重新上传。紧挨其下的黄色横幅列出完全相同的六个文件，写着文件已安全保存在服务器，将自动上传。二者不可能同时为真，而按顺序阅读的人无从判断哪一条才对。原因是两个相互重叠的查询。pendingOutbox() 返回所有状态为 pending 的记录。自 v20.3 起，gagalOutbox() 有意同时返回带 RAGU 标记的 pending 记录 — 这个决定是对的，因为结果未知的记录确实需要人眼：结果未知，文件很可能已在 Drive 中，所需要做的只是粘贴链接。但两个查询都没有把这些记录从对方的列表中排除，于是每一条未知记录都在仪表板上出现两次，每条横幅各一次。六条记录被读成了十二个问题。代价最大的不是数量，而是措辞。当未知记录开始进入红色横幅时，其标题从未相应修改，因此对这些记录而言，那句话同时在两点上是错的：服务器副本仍然存在，而门户有意不会重试未知记录。那条横幅在让人们重新上传很可能已在 Drive 中的文件 — 正是 v20.3 所要制止的错误，从另一扇门回来了。而代价是实在的：该账号的 Drive 配额已占用 96%，因此每一份第二副本都要用本已耗尽的空间来支付。现在一个文件只对应一条横幅。pendingOutbox() 会剔除带未知标记的记录，因为红色横幅已经在处理它们；两份列表不再重叠。红色横幅的标题则依其内容计算：若全部确实已丢失，措辞照旧；若全部为未知，则如实说明 — 结果未知，副本仍然安全，但门户有意不会自行重试（retryPending 正是会跳过未知记录，以免产生第二个副本），请先查找 Drive，然后粘贴链接或关闭该记录；若为混合，则分别列出各自的数量。三种情况颜色都保持红色，因为未知虽不紧急，但仍需有人去打开 Drive — 而这正是红色横幅的职责。文件名按钮与关闭按钮未作改动：对于未知记录，粘贴 Drive 链接仍然是最正确的操作。",
};
