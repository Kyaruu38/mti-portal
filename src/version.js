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

export const VERSION = 'v20.5';
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
  id: "BERKAS YANG TIDAK PERNAH SAMPAI KE DRIVE TERNYATA TIDAK DITOLAK SIAPA PUN — BALASANNYA MEMANG TIDAK PERNAH ADA. Enam berkas duduk di antrean dengan satu kalimat yang sama: Failed to fetch. Bukan 4xx, bukan 5xx, bukan pesan dari Google. Tidak ada apa-apa. Pembacaan ulang drive-upload menjawab kenapa: SELURUH error di dalam fungsi itu sudah dibungkus try/catch dan dibalas sebagai JSON lengkap dengan header CORS, termasuk yang 500. Kalau fungsinya error, portal PASTI menerima status dan sebabnya. Jadi Failed to fetch cuma bisa berarti satu hal: fungsinya mati sebelum sempat membalas. DAN BARIS YANG MEMATIKANNYA KETEMU. Isi berkasnya disalin ke memori tiga kali: sekali oleh req.formData() waktu menerima unggahan, sekali lagi oleh await file.arrayBuffer(), dan sekali lagi waktu dibungkus new Blob([...]). Edge Function punya jatah memori; begitu jebol, worker-nya dimatikan tanpa membalas apa pun. Itu menjelaskan gejala yang paling aneh dari seluruh kasus ini: satu berkas gagal 82 kali dengan kalimat yang sama persis sementara 2.023 berkas lain pada rentang yang sama lolos. Jaringan yang putus tidak bekerja begitu — jaringan itu acak, kena siapa saja, kadang lolos. Yang deterministik per berkas berarti penyebabnya ada pada berkas ITU, dan variabel yang paling masuk akal adalah ukurannya. Lima dari enam yang nyangkut sekarang adalah desain label — artwork cetak, jenis berkas yang memang paling besar. SATU SALINAN DIHILANGKAN: Blob menerima File sebagai bagian apa adanya, tanpa dibaca dulu. Ini meringankan, bukan menyembuhkan — req.formData() masih menampung berkasnya, jadi yang benar-benar besar tetap bisa jebol. DAN DI SINI VERSI INI BERHENTI MENEBAK. Batas ukuran TIDAK dipasang, karena memasang angka yang dikarang cuma memindahkan masalahnya: unggahan yang sebenarnya baik-baik saja jadi ditolak, dan yang ditolak itu tidak kelihatan sebagai kerugian sampai ada yang mencarinya. Yang dipasang adalah alat ukurnya. Ukuran berkas sekarang ditempelkan ke pesan kegagalan — [34.2 MB] — jadi kegagalan BERIKUTNYA menjawab pertanyaannya sendiri, langsung di spanduk, tanpa perlu membuka basis data. Kalau yang gagal ternyata semuanya besar dan yang lolos semuanya kecil, dugaannya terbukti dan obat tuntasnya jelas: resumable upload yang mengalirkan datanya tanpa ditampung sama sekali. Kalau ternyata tidak ada hubungannya dengan ukuran, kita baru saja menghemat satu perbaikan yang salah sasaran. CATATAN YANG TIDAK BOLEH HILANG: perubahan pada Edge Function TIDAK ikut aktif lewat git push. Fungsinya harus di-deploy terpisah. Sampai itu dilakukan, yang berubah cuma catatan ukurannya di sisi browser. Dan enam baris yang sedang nyangkut tidak dibereskan oleh rilis ini: lima desain label perlu dicek dulu di Drive sebelum diunggah ulang, dan bukti bayar #118 memang tidak bisa sembuh sejak 29 September karena record pembayarannya tidak pernah terbentuk — ulangi langkah Bukti Bayar dari layar Payment, lalu tutup barisnya.",
  en: "FILES THAT NEVER REACHED DRIVE WERE NOT REJECTED BY ANYONE — THE REPLY SIMPLY NEVER EXISTED. Six files sat in the queue carrying one identical sentence: Failed to fetch. Not a 4xx, not a 5xx, not a message from Google. Nothing at all. Re-reading drive-upload answered why: EVERY error inside that function is already wrapped in try/catch and returned as JSON with CORS headers, including the 500s. If the function errors, the portal is GUARANTEED to receive a status and a reason. So Failed to fetch can only mean one thing: the function died before it could answer. AND THE LINE THAT KILLS IT WAS FOUND. The file's bytes are copied into memory three times: once by req.formData() on receipt, again by await file.arrayBuffer(), and again when wrapped in new Blob([...]). An Edge Function has a memory budget; once it is exceeded the worker is killed without answering anything. That explains the strangest symptom of the whole case: one file failed 82 times with the identical message while 2,023 other files in the same window went through. A dropping network does not behave like that — a network drop is random, it hits anyone, and sometimes it gets through. Something deterministic per file means the cause lives in THAT file, and the most plausible variable is its size. Five of the six currently stuck are label designs — print artwork, precisely the kind of file that is largest. ONE COPY IS REMOVED: Blob accepts a File as a part as-is, without reading it first. This lightens the load, it does not cure it — req.formData() still buffers the file, so a genuinely huge one can still blow the budget. AND THIS IS WHERE THIS RELEASE STOPS GUESSING. No size limit is imposed, because an invented number only moves the problem: uploads that were perfectly fine start being refused, and a refused upload does not look like a loss until someone goes looking for it. What is added is the instrument. The file size is now appended to the failure message — [34.2 MB] — so the NEXT failure answers its own question, right there on the banner, with no database to open. If the failures are all large and the successes all small, the hypothesis is proven and the real cure is clear: a resumable upload that streams the bytes without buffering them at all. If size turns out to be irrelevant, we have just saved ourselves one fix aimed at the wrong thing. A NOTE THAT MUST NOT GET LOST: the Edge Function change does NOT go live through git push. The function has to be deployed separately. Until that is done, the only thing that changes is the size note on the browser side. And the six rows stuck right now are not cleared by this release: the five label designs must be checked in Drive before any re-upload, and payment proof #118 genuinely cannot heal — it has been stuck since 29 September because its payment record was never created. Redo the Bukti Bayar step from the Payment screen, then close the row.",
  zh: "从未送达 Drive 的文件并非被谁拒绝 — 而是根本不存在任何回复。六个文件停留在队列中，带着同一句话：Failed to fetch。不是 4xx，不是 5xx，也不是来自 Google 的消息。什么都没有。重读 drive-upload 给出了答案：该函数内部的所有错误都已包在 try/catch 中，并以带 CORS 头的 JSON 返回，包括 500。若函数出错，门户必定会收到状态码和原因。因此 Failed to fetch 只可能意味着一件事：函数在来得及回复之前就死了。而杀死它的那一行已经找到。文件字节被复制进内存三次：req.formData() 接收时一次，await file.arrayBuffer() 再一次，包进 new Blob([...]) 时又一次。Edge Function 有内存配额；一旦超出，worker 会被终止，不返回任何内容。这解释了整个案件中最奇怪的症状：一个文件以完全相同的报错失败 82 次，而同期另有 2,023 个文件顺利通过。断网不会这样表现 — 断网是随机的，谁都可能中招，有时也能通过。按文件确定性复现，说明原因就在那个文件本身，而最合理的变量是它的大小。目前卡住的六个中有五个是标签设计 — 印刷图稿，正是体积最大的那类文件。去掉了一次复制：Blob 可以直接把 File 作为组成部分，无需先读取。这是减负，不是根治 — req.formData() 仍会缓冲文件，真正巨大的文件依然可能超限。而本次发布到此为止，不再猜测。没有设置大小上限，因为凭空设定的数字只会转移问题：本来正常的上传开始被拒绝，而被拒绝的上传在有人去找之前看起来并不像损失。加上的是测量工具。文件大小现在会附加到失败信息中 — [34.2 MB] — 于是下一次失败会在横幅上直接回答自己的问题，无需打开数据库。若失败的全是大文件、成功的全是小文件，假设即被证实，根治之道也很明确：改用流式的 resumable upload，完全不缓冲。若与大小无关，我们也刚好省下一次打错靶的修复。一条绝不能遗漏的说明：Edge Function 的改动不会随 git push 生效，函数必须单独部署。在此之前，变化的只有浏览器侧的大小记录。另外，本次发布并不会清掉当前卡住的六行：五个标签设计必须先在 Drive 中查找后再决定是否重新上传；而付款凭证 #118 确实无法自愈 — 自 9 月 29 日起卡住，因为其付款记录从未创建。请在付款页面重做付款凭证步骤，然后关闭该行。",
};
