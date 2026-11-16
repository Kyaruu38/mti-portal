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

export const VERSION = 'v28.3';
export const VERSION_DATE = '16 Nov 2026';

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
  id: "MEMBUKA LIBRARY POLA BAN MENGUNDUH 4,6 MB FOTO UNTUK MENGGAMBAR KARTU SETINGGI 150 PIKSEL. Ditanya apakah 24 kartu per halaman terlalu berat, dan jawabannya diukur, bukan ditebak: dua belas foto contoh diambil dan ditimbang lewat Performance API peramban. Semuanya 1600 piksel tinggi, 108 sampai 376 KB, rata-rata 194 KB. url_gambar tersimpan sebagai lh3.googleusercontent.com/d/<id> TANPA akhiran ukuran, dan tanpa akhiran lh3 melayani berkas ASLINYA. Kisinya menggambar tinggi 150 piksel. Jadi setiap kartu mengunduh gambar sebelas kali lebih besar daripada yang pernah terlihat, lalu peramban mengecilkannya -- pekerjaan yang hasilnya langsung dibuang. Dua puluh empat kartu = 4,6 MB sekali buka. YANG BERAT BUKAN JUMLAH KARTUNYA. Menurunkan bawaan ke 10 akan tetap mengunduh 1,9 MB, dan membuat orang menekan 'berikutnya' empat belas kali untuk 137 pola. Yang diperbaiki ukuran gambarnya: fotoUkuran() menempelkan =h300 -- dua kali tinggi kartu supaya tetap tajam di layar retina. Diukur ulang sesudahnya: 15 KB per gambar, 24 kartu jadi 0,35 MB. Tiga belas kali lebih ringan, gambar yang sama persis, dan bawaannya tetap 24. Dipakai HANYA untuk kisi. Jendela yang terbuka waktu kartunya diklik tetap memakai berkas aslinya, karena di situ orangnya memang sedang memandang fotonya. Akhiran yang sudah ada tidak ditempeli lagi -- dua akhiran menghasilkan alamat yang tidak dilayani siapa pun -- dan URL yang bukan lh3 tidak disentuh, karena aturan ukuran ini milik Google dan bukan milik semua alamat gambar. Ini TIDAK menyentuh kuota Supabase: fotonya dilayani Google, bukan basis data. Yang dihemat waktu buka dan kuota data orangnya, bukan tagihan egress. 10 pengujian baru di test-foto-ukuran.mjs, termasuk tiga bentuk akhiran yang sudah ada, URL bukan lh3, data URL, dan null/undefined yang tidak boleh berubah jadi 'undefined=h300'.",
  en: "OPENING THE TYRE PATTERN LIBRARY DOWNLOADED 4.6 MB OF PHOTOS TO DRAW CARDS 150 PIXELS TALL. Asked whether 24 cards per page is too heavy, and the answer was measured rather than guessed: twelve sample photos were fetched and weighed through the browser's Performance API. All 1600 pixels tall, 108 to 376 KB, averaging 194 KB. url_gambar is stored as lh3.googleusercontent.com/d/<id> with NO size suffix, and without one lh3 serves the ORIGINAL file. The grid draws them 150 pixels tall. So every card downloaded an image eleven times larger than anything ever seen, and the browser shrank it -- work whose result is thrown away immediately. Twenty-four cards = 4.6 MB per open. THE WEIGHT WAS NOT THE CARD COUNT. Dropping the default to 10 would still pull 1.9 MB, and would make someone press 'next' fourteen times to see 137 patterns. What was fixed is the image size: fotoUkuran() appends =h300 -- twice the card height so it stays sharp on retina screens. Re-measured afterwards: 15 KB per image, 24 cards for 0.35 MB. Thirteen times lighter, the same pictures, and the default stays at 24. Used for the GRID ONLY. The dialog that opens when a card is clicked still uses the original file, because there the person is actually looking at the photo. An existing suffix is not appended to again -- two suffixes produce an address nobody serves -- and non-lh3 URLs are left alone, because this sizing rule belongs to Google and not to every image address. This does NOT touch the Supabase quota: the photos are served by Google, not the database. What is saved is open time and the viewer's data, not the egress bill. 10 new assertions in test-foto-ukuran.mjs, covering three existing-suffix shapes, a non-lh3 URL, a data URL, and null/undefined which must not become 'undefined=h300'.",
  zh: "打开轮胎花纹库会下载 4.6 MB 照片，只为绘制 150 像素高的卡片。被问及每页 24 张卡片是否太重，答案是测量得出的，而非猜测：取十二张样本照片，通过浏览器 Performance API 称重。全部为 1600 像素高，108 至 376 KB，平均 194 KB。url_gambar 存储为 lh3.googleusercontent.com/d/<id>，没有尺寸后缀；没有后缀时 lh3 提供的是原始文件。而网格只绘制 150 像素高。因此每张卡片下载的图片比任何人看到的大十一倍，然后由浏览器缩小 —— 这项工作的成果被立即丢弃。二十四张卡片 = 单次打开 4.6 MB。重的不是卡片数量。把默认值降到 10 仍会拉取 1.9 MB，而且会让人为了看完 137 个花纹按十四次「下一页」。被修复的是图片尺寸：fotoUkuran() 追加 =h300 —— 卡片高度的两倍，以便在视网膜屏上保持清晰。事后重新测量：每张 15 KB，24 张卡片共 0.35 MB。轻了十三倍，图片完全相同，默认值仍为 24。仅用于网格。点击卡片后打开的弹窗仍使用原始文件，因为此时使用者确实在观看照片。已有后缀不会被再次追加 —— 两个后缀会生成无人提供的地址 —— 非 lh3 的 URL 也不会被触碰，因为该尺寸规则属于 Google，而不属于所有图片地址。这不涉及 Supabase 配额：照片由 Google 提供，而非数据库。节省的是打开时间与使用者的流量，而不是出口流量账单。test-foto-ukuran.mjs 新增 10 项断言，涵盖三种已有后缀形态、非 lh3 的 URL、data URL，以及不得变成「undefined=h300」的 null/undefined。",
};
