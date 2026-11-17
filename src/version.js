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

export const VERSION = 'v30.1';
export const VERSION_DATE = '17 Nov 2026';

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
  id: "LAPISAN GERAK: SAMPAI v30.0 TIDAK ADA SATU PUN `transition` DI app.css. Setiap keadaan -- hover, tekan, menu terpilih, baris tersorot -- berganti seketika, jadi tombol yang sedang ditekan terlihat persis sama dengan tombol yang baru selesai ditekan, dan orang menekan dua kali. Yang ditambahkan satu berkas: src/styles/motion.css, hanya CSS, nol perubahan HTML/JS. Fisikanya tiga langkah: ditekan mengecil cepat (110ms, scale .955; .94 untuk tombol penuh warna karena tanpa garis tepi satu-satunya petunjuk kedalaman adalah skalanya), dilepas kembali dengan sedikit melewati batas (cubic-bezier .34,1.56,.64,1), dan warna/bayangan/cincin fokus ikut beranjak alih-alih berkedip. Sidebar: pita aksen 3px memanjang dari tengah dengan pegas, jadi pindah menu terbaca sebagai SATU gerakan bukan dua kedipan. Tabel: baris yang disorot mendapat garis aksen dari tepi kiri lewat inset box-shadow, BUKAN border, supaya lebar kolom tidak bergeser satu piksel pun. Modal, laci, dan toast pindah ke pegas halus (.3s) karena .18s terlalu pendek untuk terbaca sebagai gerakan. DUA HAL SENGAJA TIDAK DIPAKAI, dicatat supaya tidak ditambahkan lagi nanti tanpa alasan. Pertama, transparansi: portal ini dibaca di gudang dengan layar silau, dan teks di atas kaca buram adalah teks yang hilang -- yang diambil dari gaya 'liquid glass' hanya fisikanya, bukan kacanya. Kedua, transform pada .card: kartu memuat .card-head.lengket yang position:sticky, dan ancestor ber-transform merusak perhitungannya. Diuji terpisah sesudah lapisan ini dipasang: kepala kartu tetap mengunci di 58px setelah digulir 600px. Yang diukur: motion.css terbaca 38 aturan dengan nol galat parse, tombol bergerak diam -> hover translateY(-1px) -> tekan scale(.94). prefers-reduced-motion dihormati penuh, KECUALI pemintal: itu bukan hiasan, itu satu-satunya tanda portal sedang menunggu jawaban server. Membatalkan seluruhnya = hapus satu baris <link> di index.html.",
  en: "MOTION LAYER: THROUGH v30.0 THERE WAS NOT ONE `transition` IN app.css. Every state -- hover, press, selected menu, highlighted row -- swapped instantly, so a button being pressed looked exactly like a button that had just finished being pressed, and people pressed twice. One file added: src/styles/motion.css, CSS only, zero HTML/JS changes. The physics is three steps: press shrinks fast (110ms, scale .955; .94 for filled buttons because without a border the scale is the only depth cue), release springs back slightly past the mark (cubic-bezier .34,1.56,.64,1), and color/shadow/focus ring travel instead of blinking. Sidebar: the 3px accent bar grows from its centre on a spring, so switching menus reads as ONE movement rather than two blinks. Tables: a hovered row gets an accent line from the left edge via inset box-shadow, NOT a border, so no column shifts by even a pixel. Modal, drawer and toast move to a soft spring (.3s) because .18s is too short to read as motion at all. TWO THINGS DELIBERATELY LEFT OUT, recorded so they are not added back later without a reason. First, transparency: this portal is read in a warehouse under glare, and text over frosted glass is text that is gone -- what was taken from the 'liquid glass' style is the physics, not the glass. Second, transform on .card: cards contain .card-head.lengket which is position:sticky, and a transformed ancestor breaks its maths. Tested separately after this layer was installed: the card header still pins at 58px after scrolling 600px. Measured: motion.css parses to 38 rules with zero errors; a button moves rest -> hover translateY(-1px) -> press scale(.94). prefers-reduced-motion is fully honoured EXCEPT the spinner: that is not decoration, it is the only sign the portal is waiting on the server. Reverting the whole thing = delete one <link> line in index.html.",
  zh: "动效层：截至 v30.0，app.css 里没有任何一条 `transition`。每一种状态——悬停、按下、选中菜单、高亮行——都是瞬间切换，于是正在被按下的按钮和刚按完的按钮长得一模一样，人就会按两次。新增一个文件：src/styles/motion.css，纯 CSS，不改动任何 HTML/JS。物理分三步：按下快速缩小（110ms，scale .955；实心按钮用 .94，因为没有描边时缩放是唯一的深度线索），松开时带一点回弹越过终点（cubic-bezier .34,1.56,.64,1），颜色、阴影、焦点环随之推移而不是闪烁。侧栏：3px 的强调条以弹簧从中心伸展，切换菜单读起来是“一个动作”而不是两次闪烁。表格：悬停行从左边缘出现强调线，用的是 inset box-shadow 而不是 border，列宽一个像素都不会移动。弹窗、抽屉、提示条改用柔和弹簧（.3s），因为 .18s 短到根本读不出是运动。两件事是故意不做的，记录在此以免日后无缘无故加回来。其一，透明：这个门户是在仓库强光下阅读的，毛玻璃上的文字等于没有文字——从“液态玻璃”里取的是物理，不是玻璃。其二，不在 .card 上用 transform：卡片里含有 position:sticky 的 .card-head.lengket，祖先元素一旦有 transform 就会破坏它的计算。装好本层后单独验证：滚动 600px 后卡片头仍固定在 58px。实测：motion.css 解析出 38 条规则、零错误；按钮从静止 -> 悬停 translateY(-1px) -> 按下 scale(.94)。完全尊重 prefers-reduced-motion，唯独加载转圈除外：那不是装饰，那是门户正在等服务器回应的唯一信号。整体回退 = 删掉 index.html 里的一行 <link>。",
};
