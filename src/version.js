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

export const VERSION = 'v30.2';
export const VERSION_DATE = '23 Nov 2026';

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
  id: "BARIS PO YANG HARGANYA PANJANG BERHENTI DIBUANG DIAM-DIAM, DAN qty x harga SEKARANG DIADU DENGAN amount. Dilaporkan sebagai satu baris yang hilang: PO INCLUSION CGDD2611230045 (23 Nov 2026) memuat 0107010007ID dengan harga 8.643.712,873874 -- enam desimal, tidak muat selebar kolomnya. pdf.js memberi angka itu BARIS-Y SENDIRI di atas baris deskripsi (y=594 harga, y=593 deskripsi, y=590 jangkar), sementara jaring pengaman 'band' di zcPoPdf.js mulai TEPAT satu baris di atas jangkar. Jadi harganya jatuh satu baris di luar jangkauan, barisnya keluar dengan 'harga tidak terbaca', dan PO-nya terbit kurang satu item. Pagar atas band sekarang cuma header tabel dan jangkar item sebelumnya -- dua-duanya tetap mencegahnya menjangkau blok Payment terms maupun item tetangga. DAN YANG LEBIH PENTING DARIPADA BARIS YANG HILANG: TIDAK ADA SATU PUN PEMERIKSAAN yang pernah membandingkan qty, harga, dan amount. Selama token-nya berbentuk angka, berapa pun isinya diterima -- dan amount diambil langsung dari PDF, jadi subtotal PO tetap cocok dengan dokumen aslinya. PO-nya terlihat benar di layar dan di cetakan; yang salah cuma qty atau harga satuannya, tanpa satu tanda pun. Sekarang qty x harga diadu dengan amount (ambang 0,1%, bukan nol, karena harga yang DICETAK kerap sudah dibulatkan sementara amount dihitung dari angka penuh). Kalau meleset jauh, pecahan angka yang terpotong baris disambung dulu dari seluruh band, dan sambungan itu MENGUJI DIRINYA SENDIRI: hanya diterima kalau hasil kalinya jadi cocok dengan amount. Kalau tidak ada yang cocok, barisnya dikeluarkan dengan ketiga angkanya disebut -- bukan diterima diam-diam. DIBUKTIKAN LAWAN DATA PRODUKSI, bukan angka karangan: pada PO SAMATOR CGDD2611230050 qty terbaca 1.200 (aslinya '1,200,' + '000' di dua baris) dan perbaikannya menghasilkan 1.200.000; pada WINAR CGDD2611230056 terbaca 10.000 dan perbaikannya menghasilkan 100.000. Baris pos di database untuk kedua PO itu berisi PERSIS 1.200.000 dan 100.000. REGRESI: 10 PDF PO diparse sebelum dan sesudah -- jumlah item dan setiap angka qty/harga/amount identik, kecuali tiga perubahan yang memang dituju. 31 berkas uji dijalankan, semuanya keluar bersih. SATU HAL YANG TIDAK DIPERBAIKI, dicatat supaya tidak dikira sudah beres: digit terakhir harga INCLUSION ('4' yang nyangkut di baris paling bawah) tetap hilang, jadi harga satuannya terbaca 8.643.712,87387 -- lima dari enam desimal. Selisihnya 0,003 rupiah pada amount 1,5 miliar, di bawah ambang, dan amount untuk total PO tetap diambil dari PDF sehingga totalnya persis.",
  en: "PO LINES WITH LONG PRICES STOP BEING DROPPED IN SILENCE, AND qty x price IS NOW CHECKED AGAINST amount. Reported as one missing line: PO INCLUSION CGDD2611230045 (23 Nov 2026) carries 0107010007ID at 8,643,712.873874 -- six decimals, too wide for its column. pdf.js gave that number a Y-ROW OF ITS OWN above the description row (y=594 price, y=593 description, y=590 anchor), while the 'band' safety net in zcPoPdf.js started EXACTLY one row above the anchor. So the price fell one row outside its reach, the line left with 'harga tidak terbaca', and the PO was issued one item short. The band's upper fence is now only the table header and the previous item's anchor -- both still stop it reaching the Payment terms block or a neighbouring item. AND MORE IMPORTANT THAN THE MISSING LINE: NOTHING HAD EVER compared qty, price and amount. As long as a token looked like a number, any value was accepted -- and amount is read straight from the PDF, so the PO subtotal still matched the source document. The PO looked right on screen and in print; only the quantity or the unit price was wrong, with nothing marking it. Now qty x price is checked against amount (0.1% tolerance, not zero, because the PRINTED price is often already rounded while amount is computed from the full figure). On a gross mismatch, digit fragments split across rows are joined from the whole band first, and that repair VALIDATES ITSELF: it is accepted only if the product then matches the amount. If nothing matches, the line is dropped with all three figures named -- not accepted in silence. PROVEN AGAINST PRODUCTION DATA, not invented numbers: on PO SAMATOR CGDD2611230050 the quantity read 1,200 (really '1,200,' + '000' across two rows) and the repair produced 1,200,000; on WINAR CGDD2611230056 it read 10,000 and the repair produced 100,000. The pos rows in the database for those two POs hold EXACTLY 1,200,000 and 100,000. REGRESSION: 10 PO PDFs parsed before and after -- item counts and every qty/price/amount identical, except the three intended changes. 31 test scripts run, all exit clean. ONE THING NOT FIXED, recorded so it is not assumed done: the last digit of the INCLUSION price (the '4' stranded on the bottom row) is still lost, so the unit price reads 8,643,712.87387 -- five of six decimals. That is 0.003 rupiah on a 1.5 billion amount, below the tolerance, and the PO total still uses the amount from the PDF, so the total is exact.",
  zh: "长单价的采购单行不再被悄悄丢弃，并且 qty x 单价 现在会与 amount 对账。报告来自丢失的一行：INCLUSION 采购单 CGDD2611230045（2026年11月23日）中 0107010007ID 单价 8,643,712.873874 —— 六位小数，超出列宽。pdf.js 给这个数字单独分配了一个 Y 行，位于描述行之上（y=594 单价、y=593 描述、y=590 锚点），而 zcPoPdf.js 里的 band 兜底恰好只从锚点上方一行开始。于是单价正好落在范围之外一行，该行以“harga tidak terbaca”被剔除，采购单少发了一个物料。现在 band 的上界只剩表头和上一个物料的锚点——两者仍然阻止它伸进 Payment terms 区块或相邻物料。比丢失一行更重要的是：此前从来没有任何一处把 qty、单价和 amount 放在一起核对。只要 token 长得像数字，任何值都会被接受——而 amount 直接取自 PDF，所以采购单小计仍然与原始单据吻合。采购单在屏幕上和打印件上都看着对，错的只是数量或单价，而且没有任何标记。现在 qty x 单价 会与 amount 对账（容差 0.1%，不是零，因为打印出来的单价常常已经四舍五入，而 amount 由完整数字算出）。一旦严重不符，先从整个 band 里把被换行切断的数字碎片接回去，而且这个修复会自我验证：只有乘积随之与 amount 吻合才被采纳。若都不吻合，该行连同三个数字一起被剔除并说明——而不是悄悄接受。用生产数据验证，不是编造的数字：SAMATOR 采购单 CGDD2611230050 的数量读成 1,200（实际是两行上的 '1,200,' + '000'），修复后得出 1,200,000；WINAR CGDD2611230056 读成 10,000，修复后得出 100,000。数据库中这两张采购单的 pos 行正好是 1,200,000 和 100,000。回归：10 份采购单 PDF 前后各解析一次——物料数量以及每一个 qty/单价/amount 完全一致，除了三处本就要改的地方。31 个测试脚本全部干净退出。有一处没有修，记录在此以免被当成已完成：INCLUSION 单价的最后一位（滞留在最底行的 '4'）仍然丢失，所以单价读作 8,643,712.87387 —— 六位里的五位。在 15 亿的金额上这是 0.003 卢比，低于容差，而采购单总额仍取自 PDF 的 amount，因此总额精确。",
};
