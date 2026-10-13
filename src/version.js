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

export const VERSION = 'v20.1';
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
      id: "DESAIN DI SURAT JALAN VERIFIKASI BERHENTI DIPOTONG, DAN UKURANNYA SEKARANG MENGIKUTI BENTUK DESAINNYA SENDIRI. Bingkai gambarnya 110x150 — tegak — dengan object-fit:cover. cover MENGISI kotak lalu membuang sisanya, jadi setiap desain yang bentuknya melebar kehilangan sisi kiri dan kanannya seluruhnya. Yang terbuang justru ujung-ujung label: ukuran ban, kode, dan barcode. Di PC/SJ/X/003-1 hal itu terjadi pada OMNIMAX (tiga item), IRONMAN, dan setiap label PCR di lembar itu — yang tersisa cuma pita tengahnya. Lembar ini SATU-SATUNYA acuan gudang untuk mencocokkan desain yang datang dengan desain yang disetujui, dan di bawah tiap gambar ada checklist lima butir yang menanyakan warna, posisi tulisan, dan ukuran. Desain yang terpotong membuat kelima pertanyaan itu tidak bisa dijawab — jadi checklist-nya ditandatangani berdasarkan ingatan, yang persis kebalikan dari gunanya. MENGGANTI cover JADI contain SAJA TIDAK CUKUP, dan itu dicoba dulu sebelum sampai ke bentuk sekarang. Kotak persegi 200x200 dengan contain memang menghentikan pemotongan, tapi ukurannya tetap dipaksakan: label melebar 900x320 cuma terpakai 190x68 di dalamnya, dan sisa 130 piksel tingginya jadi ruang kosong yang TETAP DIPESAN di setiap kartu. Gambarnya utuh tapi kecil, dan halamannya penuh udara. Sekarang tidak ada kotak sama sekali — yang ada cuma BATAS ATAS. Gambarnya boleh sebesar apa pun asal tidak lewat 330px lebar dan 260px tinggi, lalu bingkainya menyusut mengikuti hasilnya (inline-flex, width auto). Label melebar memakai seluruh 330px; label tegak 79x254 mm memakai seluruh 260px tinggi. Masing-masing dapat batas yang relevan untuk bentuknya sendiri, dan tidak ada satu piksel pun yang dipesan untuk bentuk yang bukan dirinya. Diukur di Chromium: desain melebar naik dari 190x68 menjadi 330x117, desain tegak dari 60x190 menjadi 82x260. Kartu untuk desain melebar juga jadi lebih pendek, karena tinggi kosongnya tidak lagi dipesan — gambarnya lebih besar DAN halamannya lebih padat sekaligus. Lebarnya berhenti di 330px karena kolom teks di sebelahnya butuh sisa halaman: di situ ada kode ERP 17 digit dan nama barang yang panjang, dan dua-duanya tidak boleh terbungkus jadi empat baris. HALAMAN TETAP A4 TEGAK dengan alasan yang sama — memutar kertas melebarkan gambar tapi menjepit kolom yang justru dibaca gudang. Kotak ukuran tetap tetap dipakai untuk item yang BELUM punya desain: di situ tidak ada gambar yang bisa diukur, dan placeholder yang menyusut jadi segaris tidak terbaca sebagai 'desainnya belum ada'. Kesalahan cover yang sama sudah pernah diperbaiki di Design Library pada v14.x dengan alasan yang sama persis, tapi lembar Surat Jalan ini terlewat — object-fit:cover tidak pernah memberi tanda bahwa ia sedang membuang sesuatu, dan itulah kenapa ia bertahan selama ini. Diverifikasi dengan render Chromium memakai dua gambar uji yang tiap tepinya diberi penanda: dengan cover keempat penanda desain melebar hilang; dengan bingkai baru keempatnya utuh pada desain melebar maupun tegak.",
      en: "DESIGNS ON THE VERIFICATION DELIVERY NOTE STOP BEING CROPPED, AND NOW SIZE THEMSELVES TO THE SHAPE OF THE DESIGN. The image frame was 110x150 — portrait — with object-fit:cover. cover FILLS the box and discards the rest, so every design shaped wider than tall lost its left and right edges entirely. What was discarded was precisely the ends of the label: the tyre size, the code and the barcode. On PC/SJ/X/003-1 this hit OMNIMAX (three items), IRONMAN, and every PCR label on the sheet — only the middle band survived. This sheet is the warehouse's ONLY reference for matching an arriving design against the approved one, and under each image sits a five-point checklist asking about colour, text position and size. A cropped design makes all five unanswerable — so the checklist gets signed from memory, which is the exact opposite of its purpose. SWAPPING cover FOR contain WAS NOT ENOUGH, and it was tried before arriving at the present shape. A 200x200 square with contain does stop the cropping, but the size stays imposed: a 900x320 landscape label only used 190x68 inside it, and the remaining 130 pixels of height became empty space RESERVED on every card. The image was intact but small, and the page was full of air. There is now no box at all — only an UPPER BOUND. The image may be any size as long as it stays within 330px wide and 260px tall, and the frame shrinks to whatever results (inline-flex, width auto). A landscape label uses the full 330px; a 79x254 mm portrait label uses the full 260px of height. Each gets the bound that is relevant to its own shape, and not one pixel is reserved for a shape it is not. Measured in Chromium: the landscape design went from 190x68 to 330x117, the portrait one from 60x190 to 82x260. The card for a landscape design also got shorter, because its empty height is no longer reserved — the image is bigger AND the page is denser at the same time. The width stops at 330px because the text column beside it needs the rest of the page: it carries a 17-digit ERP code and a long item name, and neither may wrap to four lines. THE PAGE STAYS A4 PORTRAIT for the same reason — turning the paper widens the image but squeezes the very column the warehouse reads. A fixed box is still used for items with NO design yet: there is no image to measure, and a placeholder shrunk to a sliver does not read as 'the design is missing'. The same cover mistake was fixed in the Design Library in v14.x for exactly this reason, but this Delivery Note sheet was missed — object-fit:cover never signals that it is throwing something away, which is why it survived. Verified with a Chromium render using two test images marked at every edge: under cover all four markers of the landscape design were gone; under the new frame all four survive on both the landscape and the portrait design.",
      zh: "核对送货单上的设计图不再被裁切，且尺寸现在随设计本身的形状而定。图片框原为 110x150（竖版），使用 object-fit:cover。cover 会填满方框并丢弃其余部分，因此任何宽大于高的设计都会完全失去左右两端。被丢掉的恰恰是标签的两端：轮胎规格、编码与条码。在 PC/SJ/X/003-1 中，OMNIMAX（三个品项）、IRONMAN 以及该表上所有 PCR 标签都是如此 — 只剩中间一条。这张表是仓库核对到货设计与批准样的唯一依据，而每张图下方都有五项核对：颜色、文字位置、尺寸。被裁切的设计使这五项都无法回答 — 于是核对表只能凭记忆签署，这与其用途正好相反。仅把 cover 换成 contain 并不够，在得到现在的方案之前已先试过。200x200 的正方形配 contain 确实能停止裁切，但尺寸仍是强加的：900x320 的横版标签在其中只用到 190x68，余下 130 像素的高度成为每张卡片都要预留的空白。图是完整的，但很小，页面充满空气。现在完全没有方框 — 只有上限。图片可以是任意尺寸，只要不超过 330px 宽与 260px 高，边框随结果收缩（inline-flex，width 为 auto）。横版标签用满 330px；79x254 毫米的竖版标签用满 260px 高度。各自获得与自身形状相关的限制，不会为不属于自己的形状预留一个像素。在 Chromium 中实测：横版设计从 190x68 增至 330x117，竖版从 60x190 增至 82x260。横版设计的卡片也变矮了，因为不再预留空白高度 — 图更大，同时页面更紧凑。宽度止于 330px，是因为旁边的文字栏需要页面其余部分：那里有 17 位 ERP 编码和很长的品名，二者都不能折成四行。页面仍为 A4 竖版，理由相同 — 转为横版会放大图片，却会压缩仓库真正要读的那一栏。尚无设计图的品项仍使用固定方框：那里没有可测量的图片，而缩成一条的占位符不会被读作「设计图尚缺」。同样的 cover 错误曾在 v14.x 中以完全相同的理由在设计库中修正，但这张送货单漏掉了 —object-fit:cover 从不提示它正在丢弃内容，这正是它得以长期存在的原因。已用 Chromium 渲染验证，测试图在四边均做了标记：使用 cover 时横版设计的四个标记全部消失；使用新边框时，横版与竖版设计的四个标记均完整保留。",
};
