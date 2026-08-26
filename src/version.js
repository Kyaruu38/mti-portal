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

export const VERSION = 'v15.21';
export const VERSION_DATE = '26 Agu 2026';

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
      id: "SPANDUK DRIVE MENENANGKAN ORANG TENTANG BERKAS YANG SUDAH HILANG, DAN DUA BELAS DOKUMEN PPKEK LENYAP DARI LAYAR TANPA SATU KALIMAT PUN. Yang terlihat di dasbor: \"1 file belum sampai Google Drive — filenya AMAN, tersimpan di server dan akan dikirim otomatis\". Di basis data, jumlah yang benar-benar mengantre NOL. Spanduk itu hantu, dan penyebabnya satu baris di session.js: driveQueue dikosongkan di memori, tapi setState() yang menggambar ulang layar duduk DI DALAM if (r.sent). Kalau percobaan ulang tidak berhasil mengirim apa pun, layarnya tidak pernah diberi tahu — dan mount() tidak punya diffing, jadi spanduk lama bertahan seumur sesi lengkap dengan jumlah dan pesan error dari sebelum percobaan itu berjalan. Sekarang layarnya digambar ulang SELALU, berhasil maupun tidak. TAPI YANG DITEMUKAN DI BALIKNYA JAUH LEBIH BERAT. driveQueueBanner cuma menghitung baris berstatus pending. Begitu sebuah berkas divonis failed, ia LENYAP dari seluruh portal — tidak ada layar, tidak ada lencana, tidak ada hitungan yang pernah menyebutnya lagi. Dari 5.816 berkas, 12 sudah divonis begitu: semuanya PPKEK, semuanya antara 7 dan 21 Agustus 2026, dan tidak ada satu pun yang pernah muncul di mana pun. Yang tampil di layar justru kalimat \"filenya AMAN\" — tentang berkas yang persis sudah dinyatakan tidak bisa diselamatkan. Kalimat menenangkan tentang berkas yang hilang lebih berbahaya daripada diam. Sekarang yang gagal punya spanduknya sendiri: MERAH, menyebut nama berkasnya satu per satu karena angka tanpa nama tidak bisa ditindaklanjuti, dan mengatakan terus terang bahwa portal tidak bisa berbuat apa-apa lagi. VONISNYA SENDIRI TERNYATA TERLALU MUDAH DIJATUHKAN, DAN INI AKAR MASALAHNYA. retryPending memperlakukan SETIAP kegagalan mengunduh salinan antrean sebagai bukti bahwa berkasnya sudah tidak ada, lalu MENIMPA pesan aslinya dengan kalimat \"file tidak ada lagi di Storage — tidak bisa dicoba ulang\". Proyek Supabase yang sedang di-pause, policy Storage yang berubah, jaringan yang putus sedetik: ketiganya sementara, ketiganya masuk ke jalur yang sama, dan ketiganya menghasilkan vonis PERMANEN dengan buktinya dibuang. Itu persis kesalahan yang dulu membuat pushToDrive mulai membaca teks balasan Google — menebak antara dua sebab jauh lebih mahal daripada menyimpan satu kalimat. Sekarang keberadaan objeknya ditanyakan TERPISAH lewat list() yang cuma membaca metadata, dan cuma jawaban TEGAS \"tidak ada\" yang boleh memvonis; ragu-ragu tetap mengantre dengan pesan aslinya utuh. DAN YANG SUDAH TERLANJUR DIVONIS DIPERIKSA ULANG SETIAP LOGIN. Kalau objeknya ternyata masih ada di Storage, vonisnya dicabut dan berkasnya kembali mengantre sendiri — pemeriksaannya dijalankan SEBELUM antrean dikerjakan, jadi yang baru dibangkitkan ikut terkirim di login yang sama, bukan menunggu login berikutnya. Kalau memang tidak ada, ia dibiarkan gagal, dan sekarang layar menyebutnya. Urutan stash-push-catat-hapus tidak disentuh sama sekali: salinan di Storage tetap dihapus hanya setelah Drive konfirmasi dan link-nya tercatat.",
      en: "THE DRIVE BANNER WAS REASSURING PEOPLE ABOUT FILES THAT WERE ALREADY GONE, AND TWELVE PPKEK DOCUMENTS HAD VANISHED FROM EVERY SCREEN WITHOUT A WORD. What the dashboard showed: \"1 file has not reached Google Drive — it is SAFE on the server and will be sent automatically\". In the database the number actually queued was ZERO. That banner was a ghost, and the cause is one line in session.js: driveQueue is emptied in memory, but the setState() that redraws the screen sat INSIDE if (r.sent). When the retry sent nothing, the screen was never told — and mount() has no diffing, so the old banner survived the whole session, still showing the count and error message from before the retry ran. It now redraws ALWAYS, whether anything was sent or not. BUT WHAT WAS BEHIND IT IS FAR WORSE. driveQueueBanner only ever counted rows with status pending. The moment a file is marked failed it DISAPPEARS from the entire portal — no screen, no badge, no count ever mentions it again. Of 5,816 files, 12 had been marked that way: all PPKEK, all between 7 and 21 August 2026, and not one of them ever surfaced anywhere. What did appear on screen was the sentence \"the file is SAFE\" — about precisely the files already declared unsalvageable. A reassuring sentence about a lost file is more dangerous than silence. Failed files now have their own banner: RED, naming each file, because a number without names cannot be acted on, and saying plainly that the portal can do nothing more. THE VERDICT ITSELF TURNED OUT TO BE FAR TOO EASY TO REACH, AND THAT IS THE ROOT CAUSE. retryPending treated EVERY failure to download the queued copy as proof the file was gone, then OVERWROTE the real error with \"the file is no longer in Storage — cannot be retried\". A paused Supabase project, a changed Storage policy, a network drop lasting one second: all three are temporary, all three took that same path, and all three produced a PERMANENT verdict with the evidence discarded. It is exactly the mistake that made pushToDrive start reading Google's response body — guessing between two causes costs far more than keeping one sentence. Existence is now asked separately via list(), which reads only metadata, and only a definite \"not there\" may condemn a file; uncertainty stays queued with the original error intact. AND EVERYTHING ALREADY CONDEMNED IS RE-EXAMINED ON EVERY LOGIN. If the object turns out to still be in Storage the verdict is lifted and the file rejoins the queue by itself — the check runs BEFORE the queue is worked, so a revived file is sent in the same login rather than waiting for the next one. If it really is gone it stays failed, and now the screen says so. The stash-push-record-delete order is untouched: the Storage copy is still dropped only after Drive confirms and the link is recorded.",
      zh: "云端硬盘横幅在为早已丢失的文件说着安心话，而十二份 PPKEK 文件已从所有界面上消失，且没有任何提示。仪表板显示的是：「1 个文件尚未送达 Google Drive — 文件已安全保存在服务器，Drive 恢复后将自动上传」。而数据库中真正在排队的数量是零。该横幅是个幽灵，原因是 session.js 中的一行：driveQueue 在内存中被清空，但负责重绘界面的 setState() 却位于 if (r.sent) 内部。当重试没有成功发送任何内容时，界面从未被通知 — 而 mount() 没有差异比对，因此旧横幅会存活整个会话，显示的仍是重试运行之前的数量与错误信息。现在无论是否发送成功，界面都会重绘。但其背后的问题严重得多。driveQueueBanner 只统计状态为 pending 的行。一旦某个文件被判定为 failed，它就会从整个门户中消失 — 没有任何界面、徽章或计数会再提及它。在 5,816 个文件中，有 12 个已被如此判定：全部是 PPKEK，全部发生在 2026 年 8 月 7 日至 21 日之间，且从未在任何地方出现过。而屏幕上显示的偏偏是「文件已安全保存」— 说的正是那些已被宣告无法挽救的文件。对丢失文件说安心话，比沉默更危险。现在失败的文件有了自己的横幅：红色，逐一列出文件名，因为没有名字的数字无法据以行动，并直白说明门户已无能为力。而这个判定本身原来太容易做出，这才是根本原因。retryPending 把每一次下载队列副本失败都当作文件已丢失的证据，然后用「文件已不在 Storage 中 — 无法重试」覆盖掉真实错误。暂停中的 Supabase 项目、变更过的 Storage 策略、断开一秒的网络：三者都是暂时的，三者都走同一条路径，三者都产生了永久性判定，且证据被丢弃。这正是当初促使 pushToDrive 开始读取 Google 响应正文的同一个错误 — 在两个原因之间猜测的代价，远高于保留一句话。现在通过只读取元数据的 list() 单独查询对象是否存在，只有明确的「不存在」才可以判定；不确定时仍保留在队列中，并完整保留原始错误。并且所有已被判定的记录会在每次登录时重新检查。若对象其实仍在 Storage 中，判定会被撤销，文件自动重新排队 — 该检查在处理队列之前运行，因此恢复的文件会在同一次登录中发送，而不必等待下一次。若确实已丢失，则保持失败状态，而现在界面会明确指出。stash-push-记录-删除的顺序完全未动：Storage 副本仍然只在 Drive 确认且链接已记录之后才删除。",
};
