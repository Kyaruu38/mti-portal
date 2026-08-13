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

export const VERSION = 'v15.10';
export const VERSION_DATE = '13 Agu 2026';

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
      id: 'LAYAR STOK LABEL MENERIMA BERKAS EKSPOR ERP — DAN BERHENTI MENGAMBIL KOLOM YANG SALAH. Sona mulai mengunggah ekspor stok dari ERP/WPS berheader Mandarin, bukan Label Inventory Tracker yang parser ini dibangun untuknya. Kedua berkas memakai 物料名称 untuk nama barang, alias yang tidak dikenal, jadi header tidak terdeteksi sama sekali dan layar menolak berkasnya tanpa menyebut kolom apa yang kurang. PERBAIKAN YANG TAMPAK JELAS JUSTRU YANG BERBAHAYA, dan itu hampir dikirim: menambahkan 物料名称 ke alias nama barang saja akan membuat parser BERHASIL, lalu mengambil kolom 库存数量 sebagai stok karena kolom itu sudah cocok dengan alias lama. Nol error, nol peringatan, layar penuh angka — dan angkanya salah. Kata sona sendiri: 库存数量 di berkas itu ekspor mentah dari ERP dan TIDAK akurat; yang benar adalah 旧 + 新. Pada satu baris nyata ERP menyebut 2.313 sementara jumlah yang benar 720. ATURANNYA SEKARANG: kalau pasangan kolom lama/baru LENGKAP, stok dihitung dari jumlah keduanya dan 库存数量 DIABAIKAN — pengabaian itu dilaporkan di layar, tidak dilakukan diam-diam. Kalau pasangannya cuma separuh, kolom Stock dipakai apa adanya dan orangnya diberi tahu; separuh pasangan bukan "新 + 旧", dan angka yang bukan keduanya adalah angka yang tidak dimiliki siapa pun. BARIS YANG STOKNYA TIDAK BISA DIPASTIKAN DIKARANTINA, TIDAK DIANGGAP NOL. Kolom lama/baru di berkas itu diisi TANGAN di atas ekspor 666 baris, jadi baris yang belum terisi adalah keadaan normal. Kalau baris seperti itu masuk sebagai stok nol sementara 库存数量 jelas menyebut angka, portal menandainya BUY NOW dengan saran beli sebesar kebutuhan penuh — memesan label untuk barang yang sedang menumpuk di gudang. Baris itu sekarang tidak diimpor, dan jumlah serta nomor barisnya disebut. Hanya dikarantina kalau ada bukti tandingan; tanpa itu, dua kolom kosong memang berarti nol. SEL YANG TERISI TAPI TIDAK TERBACA BERHENTI JADI NOL DIAM-DIAM. Satu #REF! di kolom lama pada ekspor 666 baris dulu memotong stok SKU itu tanpa satu pun tanda — pola silent-zero yang parsers/numbers.js ditulis untuk membasmi, duduk persis di kolom yang jadi satu-satunya sumber stok. Sekarang dicatat dan dilaporkan dengan nomor barisnya. BARIS CAPTION DI ATAS HEADER TIDAK BISA LAGI MENANG. Dengan alias yang bertambah, band ringkasan seperti 规格|库存|旧|新 mencetak skor LEBIH TINGGI daripada header aslinya dan ikut terimpor sebagai SKU bernilai 46.241 — berkas yang dulu ditolak berisik berubah jadi berkas yang diterima membawa sampah. Header yang menang sekarang yang PALING DEKAT DI ATAS DATA, bukan yang skornya tertinggi, dengan tiga syarat kesahihan supaya sebuah baris data tidak bisa menang cuma karena nama specnya memuat kata 规格. PERINGATAN PARSER AKHIRNYA DIGAMBAR. Berkas layar ini tidak pernah sekali pun membaca res.warnings — nol referensi di seluruh berkas — padahal parser sudah lama mengisinya. Peringatan yang tidak pernah digambar bukan peringatan. Sekarang muncul sebagai blok di jendela "Cek dulu sebelum disimpan", TIGA BAHASA, dengan yang mengubah angka ditebalkan dan yang menahan baris diberi warna merah. Tiga bahasa bukan kosmetik: yang mengunggah berkas ini sona, dan peringatan yang paling mengubah angka justru yang paling tidak bisa dia baca kalau isinya cuma bahasa Indonesia. Pesan penolakan header juga berhenti berbunyi "header tidak terdeteksi" dan mulai menyebut kolom mana yang tidak ketemu. buildDiff berhenti memakai kunci sendiri dan memakai skuKey yang sama dengan parser; dua aturan kunci di satu layar adalah dua aturan yang suatu hari berbeda pendapat, dan yang kalah membuat satu SKU terbaca sebagai "hilang" plus "baru" untuk baris yang cuma berubah stoknya. DIUJI 22 assertion memakai baris asli kedua berkas sona, ditambah kasus yang dibangun dari temuan review. TUJUH dari delapan cacat yang ditutup rilis ini ditemukan reviewer, bukan penulisnya, dan tiga di antaranya ditangkap oleh pengujiannya sendiri sesudah perbaikan pertama dianggap selesai.',
      en: 'THE LABEL STOCK SCREEN ACCEPTS ERP EXPORTS — AND STOPS READING THE WRONG COLUMN. Sona began uploading ERP/WPS stock exports with Chinese headers instead of the Label Inventory Tracker this parser was built for. Both files use 物料名称 for the item name, an alias it did not know, so the header was not detected at all and the file was refused without naming the missing column. THE OBVIOUS FIX WAS THE DANGEROUS ONE, and it was nearly shipped: teaching the parser 物料名称 alone would have made it SUCCEED and then take 库存数量 as the stock, because that column already matched the old alias. No error, no warning, a screen full of numbers — and the numbers wrong. In sona\'s own words, 库存数量 in those files is a raw ERP export and is NOT accurate; the correct value is 旧 + 新. On one real row ERP says 2,313 while the correct sum is 720. THE RULE NOW: when the old/new pair is COMPLETE, stock is their sum and 库存数量 is IGNORED — and that is reported on screen, not done silently. A half pair falls back to the Stock column with a notice. ROWS WHOSE STOCK CANNOT BE ESTABLISHED ARE QUARANTINED, NOT TREATED AS ZERO: those columns are hand-filled on top of a 666-row export, so unfilled rows are normal, and a false zero makes the portal order labels for goods sitting in the warehouse. FILLED-BUT-UNREADABLE CELLS stop becoming a silent zero — one #REF! used to halve a SKU with no sign. A CAPTION BAND ABOVE THE HEADER can no longer outscore it and be imported as a 46,241-unit SKU; the winning header is now the one CLOSEST ABOVE THE DATA. PARSER WARNINGS ARE FINALLY RENDERED — this screen never read res.warnings once, zero references in the whole file. They now appear in the "check before saving" dialog, in THREE LANGUAGES, because the person uploading these files is sona and the warning that most changes the number was the one she could not read. TESTED with 22 assertions from the real rows of both files. SEVEN of the eight defects closed here were found by a reviewer, not the author.',
      zh: '标签库存页面现已接受 ERP 导出文件 — 并且不再读取错误的列。Sona 开始上传带中文表头的 ERP/WPS 库存导出文件，而非本解析器最初针对的 Label Inventory Tracker。两个文件都用 物料名称 表示品名，而这是解析器不认识的别名，因此表头完全无法识别，文件被拒绝且未说明缺少哪一列。看似显而易见的修复恰恰是危险的那个，而且差点就发布了：仅仅让解析器认识 物料名称，它就会解析"成功"，然后把 库存数量 当作库存 — 因为该列早已匹配旧的别名。没有报错，没有警告，页面上满是数字 — 而这些数字是错的。用 sona 自己的话说：这些文件中的 库存数量 是 ERP 直接导出的，并不准确，正确的是 旧 + 新。在一行真实数据中，ERP 显示 2,313，而正确的合计是 720。现行规则：当新旧两列齐全时，库存按两者之和计算，库存数量 被忽略 — 并且该忽略会显示在页面上，而不是悄悄进行。只找到其中一列时，回退使用 Stock 列并给出提示。无法确定库存的行会被隔离，而不是按零处理：这两列是在 666 行导出之上手工填写的，未填写是常态，而错误的零会让系统为仍在仓库的货物下单采购标签。有内容但无法识别的单元格不再静默归零 — 此前一个 #REF! 会无声地腰斩某个 SKU 的库存。表头上方的标题带不再能以更高得分胜出并被当作 46,241 件的 SKU 导入；现在胜出的是最接近数据的那一行表头。解析器警告终于被绘制出来 — 此前该页面从未读取过 res.warnings，整个文件零引用。现在它们出现在"保存前请先核对"对话框中，并提供三种语言，因为上传这些文件的人是 sona，而最影响数字的那条警告恰恰是她读不懂的。共 22 项断言，取自两个文件的真实数据行。本次修复的八个缺陷中有七个由评审发现，而非作者本人。',
};
