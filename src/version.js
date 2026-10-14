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

export const VERSION = 'v20.3';
export const VERSION_DATE = '13 Okt 2026';

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
      id: "SPANDUK MERAH BERHENTI MENUDUH STORAGE MENGHILANGKAN BERKAS YANG SEBENARNYA SUDAH SAMPAI DI DRIVE. Pagi 13 Oktober pukul 01:43-01:59 muncul tujuh baris merah sekaligus, semuanya dengan kalimat yang sama: objek tidak ada di Storage, perlu diunggah ulang manual. Pemeriksaan basis data menjawabnya dalam satu query: KETUJUHNYA punya drive_url dan punya done_at, 5 sampai 13 detik sesudah barisnya dibuat. markDone sudah jalan, berkasnya sudah mendarat di Drive, dan salinan antreannya memang sudah dihapus - oleh portal ini sendiri, dengan benar. Tidak ada satu berkas pun yang hilang. Yang hilang cuma kepercayaan pada spanduknya, dan itu yang paling mahal: spanduk yang menuduh orang kehilangan dokumen akan membuat orang mengunggah ulang dokumen yang sudah ada, dan itulah yang terjadi - tiga dari tujuh nama itu adalah berkas yang sama diunggah berkali-kali. SEBABNYA SEBUAH DAFTAR YANG DIBACA SEKALI LALU DIPERCAYA TERLALU LAMA. retryPending membaca daftar antrean SEKALI, lalu mengerjakan isinya satu per satu - unduh, kirim, catat - dan satu baris bisa makan belasan detik. Selama itu orangnya di layar sebelah terus mengunggah, dan setiap unggahan baru lahir sebagai pending. Baris yang tadi terbaca masih mengantre bisa sudah selesai lewat jalur normal sebelum gilirannya tiba. markDone menulis status done DULU, baru menghapus objeknya - jadi pada detik objeknya hilang, statusnya sudah bukan pending. Retry yang datang terlambat cuma melihat objek yang tidak ada, lalu memvonis permanen. Enam belas ribu dua ratus tiga puluh tujuh unggahan sebelumnya tidak pernah kena, karena vonis ini butuh dua hal bertemu dalam hitungan detik: unggahan beruntun dan retry yang sedang berjalan. Pagi itu keduanya bertemu tujuh kali. SEKARANG STATUSNYA DIBACA ULANG PERSIS SEBELUM DISENTUH, bukan dipercaya dari daftar yang mungkin sudah basi semenit lalu, dan vonisnya dibuat BERSYARAT: kalau statusnya sudah bukan pending, update-nya mengenai NOL baris dan vonisnya batal sendiri. markPending ikut diberi syarat yang sama, supaya baris yang sudah selesai tidak bisa diseret balik jadi pending oleh percobaan yang sudah tidak relevan. Pembacaan ulang itu juga menutup separuh masalah lain yang belum sempat kelihatan: tanpa dia, retry bisa MENGUNGGAH ULANG berkas yang barusan sukses lewat jalur normal - satu dokumen jadi dua di Drive, dan tidak ada yang tahu yang mana yang dipakai. TUJUH BARIS YANG TERLANJUR DIVONIS SUDAH DIKEMBALIKAN JADI done langsung di basis data, karena ketujuhnya memang sudah selesai sejak detik pertama. Spanduk merahnya kosong lagi. Yang tersisa di antrean cuma satu baris lama dari 29 September - bukti bayar #118 - yang memang betul-betul macet dan sudah dijelaskan di v20.2: langkah Bukti Bayar-nya mati di tengah, ulangi dari layar Payment lalu tutup barisnya.",
      en: "THE RED BANNER STOPS ACCUSING STORAGE OF LOSING FILES THAT ARE ALREADY IN DRIVE. Between 01:43 and 01:59 on 13 October seven red rows appeared at once, every one carrying the same sentence: the object is not in Storage, it must be uploaded again by hand. One database query answered it: ALL SEVEN have a drive_url and a done_at, 5 to 13 seconds after the row was created. markDone had already run, the file had already landed in Drive, and the queued copy had indeed been deleted - by this portal itself, correctly. Not one file was lost. What was lost was trust in the banner, and that is the expensive part: a banner that tells people their documents are gone makes them upload documents that are already there, and that is exactly what happened - three of those seven names are the same file uploaded over and over. THE CAUSE WAS A LIST READ ONCE AND TRUSTED FOR TOO LONG. retryPending reads the queue ONCE, then works through it one row at a time - download, send, record - and a single row can take a dozen seconds. Meanwhile the person in the next window keeps uploading, and every new upload is born pending. A row that was still queued when the list was read can finish through the normal path before its turn arrives here. markDone writes status done FIRST and removes the object second - so by the moment the object disappears, the status is no longer pending. The late retry sees only an object that is not there, and condemns it permanently. Sixteen thousand two hundred and thirty-seven earlier uploads were never hit, because this verdict needs two things to meet within seconds: uploads in quick succession and a retry already running. That morning they met seven times. THE STATUS IS NOW RE-READ IMMEDIATELY BEFORE THE ROW IS TOUCHED, instead of being trusted from a list that may be a minute stale, and the verdict is CONDITIONAL: if the status is no longer pending the update hits ZERO rows and the verdict cancels itself. markPending gets the same condition, so a finished row cannot be dragged back to pending by an attempt that is no longer relevant. That re-read also closes the other half of the problem, which had not yet shown itself: without it the retry can RE-UPLOAD a file that just succeeded through the normal path - one document becomes two in Drive, and nobody knows which one is the real one. THE SEVEN CONDEMNED ROWS HAVE BEEN RESTORED TO done directly in the database, because all seven were finished from the first second. The red banner is empty again. All that is left in the queue is one old row from 29 September - payment proof #118 - which really is stuck and was already explained in v20.2: its Bukti Bayar step died halfway, redo it from the Payment screen and then close the row.",
      zh: "红色横幅不再指控 Storage 弄丢了其实已经送达 Drive 的文件。10 月 13 日 01:43 至 01:59 之间一次出现七条红色记录，每一条都写着同一句话：对象不在 Storage 中，需要手动重新上传。一条数据库查询就给出了答案：这七条全都有 drive_url，也都有 done_at，时间在记录创建后的 5 到 13 秒。markDone 已经执行，文件已经送达 Drive，队列副本也确实被删除了 — 由门户自己删除的，而且是正确的。没有任何一个文件丢失。丢失的是对横幅的信任，而这才是代价最高的部分：一个告诉人们文档已丢失的横幅，会让人重新上传本已存在的文档，而这正是实际发生的事 — 那七个名字中有三个是同一个文件被反复上传。原因是一份只读取一次、却被信任太久的列表。retryPending 只读取队列一次，然后逐条处理 — 下载、发送、记录 — 而一条记录可能耗时十几秒。与此同时，旁边窗口的人仍在持续上传，每一次新上传都以 pending 状态诞生。读取列表时仍在排队的记录，可能在轮到它之前就已经通过正常路径完成。markDone 先写入 done 状态，然后才删除对象 — 因此在对象消失的那一刻，状态早已不是 pending。迟到的重试只看到一个不存在的对象，于是作出永久判决。此前一万六千二百三十七次上传从未中招，因为这个判决需要两件事在数秒之内相遇：连续的上传，和正在运行的重试。那天早晨它们相遇了七次。现在状态会在触碰记录之前重新读取，而不是信任一份可能已过时一分钟的列表，并且判决是有条件的：若状态已不是 pending，该更新将命中零行，判决自行作废。markPending 也加上了同样的条件，使已完成的记录不会被一次早已无关的尝试拖回 pending。这次重新读取同时也堵上了另一半尚未显形的问题：若没有它，重试可能会重新上传一个刚刚通过正常路径成功的文件 — 一份文档在 Drive 中变成两份，而没人知道哪一份才是真的。那七条被误判的记录已直接在数据库中恢复为 done，因为它们从第一秒起就已经完成。红色横幅重新归空。队列中仅剩 9 月 29 日的一条旧记录 — 付款凭证 #118 — 它确实卡住了，并已在 v20.2 中说明：其付款凭证步骤中途中断，请在付款页面重做，然后关闭该记录。",
};
