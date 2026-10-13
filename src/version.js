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

export const VERSION = 'v20.2';
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
      id: "ANTREAN DRIVE BERHENTI MENGULANG SESUATU YANG TIDAK AKAN PERNAH BERHASIL SENDIRI. Satu berkas bukti bayar sudah mencoba 82 kali selama dua minggu dengan pesan yang sama persis setiap kalinya — Failed to fetch — sementara 2.023 unggahan lain pada rentang yang sama berhasil. Delapan puluh dua percobaan yang gagal dengan sebab identik bukan sedang dicoba lagi, itu macet. Dan selama dia duduk di spanduk KUNING, yang dibaca orang justru kalimat filenya AMAN, akan dikirim otomatis begitu Drive bisa diakses. Spanduk yang menenangkan tentang sesuatu yang tidak akan pernah selesai sendiri lebih berbahaya daripada diam. SEBABNYA SATU BARIS YANG MEMBUANG PENANDA. pushToDrive sudah membedakan dua jenis kegagalan sejak v15.x: kalau server MENJAWAB 4xx/5xx kita tahu berkasnya tidak ditulis dan mengulanginya aman; tapi kalau fetch() sendiri yang meledak, yang hilang adalah BALASANnya, bukan unggahannya — POST-nya bisa saja sudah mendarat dan berkasnya sudah ada di Drive. Pembedaan itu dikembalikan sebagai up.tidakDiketahui, dan jalur unggahan pertama memakainya. Jalur RETRY tidak: dia memanggil markPending tanpa opsi apa pun, jadi penandanya dibuang dan seluruh mekanisme RAGU — yang dibangun persis untuk kasus ini — tidak pernah menyala di sana. Itu sebabnya satu baris bisa mengulang 82 kali: dia tidak pernah ditandai ragu, jadi retryPending tidak pernah melewatinya. Sekarang penandanya diteruskan. DITAMBAH BATAS PERCOBAAN, karena penanda saja belum cukup. Kegagalan yang DIJAWAB server (bukan TypeError) tetap diulang tanpa batas di versi lama. Sekarang setelah delapan kali gagal, apa pun sebabnya, barisnya diserahkan ke manusia — yang gagal delapan kali dengan pesan yang sama tidak akan sembuh pada percobaan kesembilan. Delapan dipilih supaya cukup longgar melewati gangguan jaringan beberapa hari (retry hanya jalan saat ada yang login) dan cukup ketat untuk tidak membiarkan yang macet berbulan-bulan. Baris yang diserahkan pindah dari spanduk kuning ke spanduk MERAH, yang sudah menyebut nama berkasnya satu per satu dan menawarkan dua tindakan yang memang cuma bisa diputuskan orang yang membuka Drive-nya: tempel link berkas yang ternyata sudah ada di sana, atau tutup barisnya dengan alasan. CATATAN UNTUK BERKAS YANG SEDANG MACET SEKARANG: barisnya tidak akan sembuh sendiri dan tidak juga oleh rilis ini. Pemeriksaan basis data menunjukkan target_table-nya NULL dan TIDAK ADA satu pun baris payments yang cocok, artinya langkah Bukti Bayar-nya mati di tengah: PDF-nya selamat ke Storage, tapi record pembayarannya tidak pernah terbentuk. Walau unggahannya berhasil besok, link-nya tidak punya tempat mendarat. Yang benar: ulangi langkah Bukti Bayar dari layar Payment, lalu tutup baris antreannya.",
      en: "THE DRIVE QUEUE STOPS RETRYING SOMETHING THAT WILL NEVER SUCCEED ON ITS OWN. One payment-proof file had attempted 82 times over two weeks with the identical message every single time — Failed to fetch — while 2,023 other uploads in the same window went through. Eighty-two failures with an identical cause is not being retried, it is stuck. And while it sat on the YELLOW banner, what people read was the sentence the file is SAFE and will be sent automatically once Drive is reachable. A reassuring banner about something that will never finish on its own is more dangerous than silence. THE CAUSE WAS ONE LINE THROWING AWAY A FLAG. pushToDrive has distinguished two kinds of failure since v15.x: if the server ANSWERS 4xx/5xx we know the file was not written and retrying is safe; but if fetch() itself throws, what was lost is the REPLY, not the upload — the POST may well have landed and the file may already be in Drive. That distinction comes back as up.tidakDiketahui, and the first-upload path uses it. The RETRY path did not: it called markPending with no options at all, so the flag was discarded and the whole RAGU mechanism — built for exactly this case — never fired there. That is why one row could repeat 82 times: it was never marked uncertain, so retryPending never skipped it. The flag is now passed through. PLUS AN ATTEMPT CAP, because the flag alone is not enough. Failures the server ANSWERED (not a TypeError) were still retried without limit. Now, after eight failures for any reason, the row is handed to a human — something that failed eight times with the same message will not heal on the ninth. Eight is loose enough to ride out a few days of network trouble (the retry only runs when someone signs in) and tight enough not to let a stuck row spin for months. A handed-over row moves from the yellow banner to the RED one, which already names its files one by one and offers the two actions only a person looking at Drive can decide: paste the link of a file that turns out to be there already, or close the row with a reason. A NOTE ON THE FILE STUCK RIGHT NOW: that row will not heal by itself, nor from this release. A database check shows its target_table is NULL and there is NO matching payments row at all, meaning its Bukti Bayar step died halfway: the PDF reached Storage safely, but the payment record was never created. Even if the upload succeeds tomorrow, the link has nowhere to land. The right move is to redo the Bukti Bayar step from the Payment screen, then close the queue row.",
      zh: "Drive 队列不再反复重试那些永远不会自行成功的任务。一个付款凭证文件在两周内已尝试 82 次，每一次的报错都完全相同 — Failed to fetch — 而同期另有 2,023 个上传成功。以相同原因失败 82 次不叫「正在重试」，而叫卡住。而在它停留于黄色横幅期间，人们读到的却是「文件已安全保存，Drive 恢复后将自动上传」。对一件永远不会自行完成的事给出安慰性提示，比沉默更危险。原因是一行代码丢弃了一个标记。自 v15.x 起，pushToDrive 就区分两类失败：若服务器返回 4xx/5xx，说明文件未被写入，重试是安全的；但若 fetch() 本身抛出异常，丢失的是响应而非上传 — POST 可能已经送达，文件可能已在 Drive 中。该区分以 up.tidakDiketahui 返回，首次上传路径使用了它。但重试路径没有：它调用 markPending 时未传任何选项，因此标记被丢弃，而专为此情形构建的 RAGU 机制在那里从未触发。这正是一行记录能重复 82 次的原因：它从未被标记为结果未知，于是 retryPending 从不跳过它。现在该标记会被传递下去。并增加尝试次数上限，因为仅有标记还不够。服务器已回应的失败（非 TypeError）在旧版中仍会无限重试。现在，无论何种原因，失败八次后该记录即交由人工处理 — 以相同报错失败八次的任务，不会在第九次痊愈。选择八次：足够宽松以熬过数天的网络波动（重试仅在有人登录时运行），也足够严格，不致让卡住的记录空转数月。被移交的记录会从黄色横幅转入红色横幅，后者已逐个列出文件名，并提供只有打开 Drive 的人才能决定的两项操作：为确实已在 Drive 中的文件粘贴链接，或注明原因关闭该记录。关于目前卡住的那个文件：该记录不会自行恢复，本次发布也无法修复它。数据库检查显示其 target_table 为 NULL，且完全没有匹配的 payments 记录，说明其付款凭证步骤中途中断：PDF 已安全存入 Storage，但付款记录从未创建。即便明天上传成功，链接也无处落地。正确做法是：在付款页面重做付款凭证步骤，然后关闭该队列记录。",
};
