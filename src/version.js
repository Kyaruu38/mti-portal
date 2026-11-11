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

export const VERSION = 'v24.10';
export const VERSION_DATE = '11 Nov 2026';

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
  id: "GAMBAR DESIGN YANG TIDAK MAU MUNCUL, DAN SEBABNYA BUKAN DI PORTAL. 240 dari 635 design menyimpan thumb-nya sebagai URL https://drive.google.com/thumbnail?id=...&sz=w400 — bukan gambar, melainkan alamat yang MENGALIHKAN ke tempat lain. Diuji di peramban: alamat itu berakhir di lh3.googleusercontent.com dengan ?authuser=0 menempel, artinya dia berhasil KARENA peramban yang membukanya sedang masuk sebagai pemilik berkasnya. Pemasok tidak masuk ke akun itu. Ditambah jalur thumbnail Drive memang dibatasi lajunya, dan itu menjelaskan kenapa gagalnya kadang-kadang, bukan selalu. Keduanya diganti ke lh3.googleusercontent.com/d/<id>=w400, yang langsung melayani gambarnya tanpa pengalihan — 240 baris, diperiksa ulang: nol sisa. TAPI YANG DILIHAT ORANGNYA BUKAN ITU, MELAINKAN IKON RUSAK. <img> yang src-nya gagal TIDAK diam: peramban menggambar ikon rusak beserta teks alt-nya, dan tidak ada satu pun <img> di portal ini yang punya penanganan gagal-muat. Di layar pemasok itu terbaca sebagai 'portalnya rusak', bukan 'gambarnya tidak ada' — dan yang membacanya begitu memuat ulang halaman, bukan memakai tautan berkas cetak yang ada tepat di bawah kotaknya. gambarAman() di ui/components.js sekarang mengganti gambar yang gagal dengan keterangan yang menyebut jalan keluarnya. Pembungkusnya <span>, bukan <img>, karena <img> tidak bisa memuat teks — dan itu juga yang membuatnya aman disimpan di cache elemen Design Library: yang tersimpan pembungkusnya, jadi kartu yang gagal tidak kembali jadi ikon rusak di render berikutnya. MASTER MEREK: 50 EJAAN RESMI, DAN SATU MEREK YANG SELAMA INI TERBELAH DUA. Diperiksa di basis data: GOLDEN CROWN tersimpan dalam dua ejaan sekaligus — 43 baris 'GOLDEN CROWN' dan 78 baris 'GOLDENCROWN'; HI-RUN 6 lawan HIRUN 32. Saringan 'semua GOLDEN CROWN' melewatkan 78 baris, dan harga label per merek terbelah jadi dua kelompok yang tidak pernah dijumlahkan. canonicalBrand() sekarang menyetel ejaannya ke daftar resmi, jadi GOLDENCROWN dan GOLDEN CROWN berhenti jadi dua merek. Daftar 23 merek dari pemiliknya diperiksa dulu sebelum dipakai: ketiganya dicari di daftar produksi Sona, stok WH Indo dan jadwal kirim WH China, dan NOL dari 23 punya token Mandarin di barisnya — jadi tidak satu pun diberi nama Mandarin karangan. Membandingkan daftar itu dengan isi items + designs memunculkan 17 merek yang dipakai tapi belum terdaftar, dipimpin TRAVELSTAR 85 baris dan MASTERTRACK 63. Juga empat nilai yang bukan merek sama sekali dan tetap tersimpan di kolom merek: tanda pisah '—' 26 baris, 'TBR' 8, 'ZC' 2, dan '95H CAPITOL' 1 — yang terakhir indeks beban yang bocor ke kolom merek, ragam kerusakan yang sudah dicatat sendiri oleh itemName.js.",
  en: "DESIGN IMAGES THAT WOULD NOT APPEAR, AND THE CAUSE WAS NOT IN THE PORTAL. 240 of 635 designs stored their thumb as https://drive.google.com/thumbnail?id=...&sz=w400 — not an image but an address that REDIRECTS elsewhere. Tested in the browser: it lands on lh3.googleusercontent.com with ?authuser=0 attached, meaning it succeeded BECAUSE the browser opening it was signed in as the file's owner. Suppliers are not signed into that account. Drive also rate-limits that thumbnail path, which explains why it failed sometimes rather than always. All 240 were rewritten to lh3.googleusercontent.com/d/<id>=w400, which serves the image directly with no redirect — re-checked: zero left. BUT WHAT PEOPLE SAW WAS A BROKEN-IMAGE ICON. An <img> whose src fails is NOT silent: the browser draws its broken icon together with the alt text, and not one <img> in this portal had any load-failure handling. On the supplier screen that reads as 'the portal is broken', not 'the image is missing' — and whoever reads it that way reloads the page instead of using the print-file link sitting right below the box. gambarAman() in ui/components.js now replaces a failed image with a line that names the way out. Its wrapper is a <span>, not an <img>, because an <img> cannot hold text — which is also what makes it safe in the Design Library's element cache: the wrapper is what gets cached, so a card that failed does not come back as a broken icon on the next render. BRAND MASTER: 50 OFFICIAL SPELLINGS, AND ONE BRAND THAT HAD BEEN SPLIT IN TWO. Checked in the database: GOLDEN CROWN is stored under two spellings at once — 43 rows 'GOLDEN CROWN' and 78 rows 'GOLDENCROWN'; HI-RUN 6 against HIRUN 32. A filter for 'all GOLDEN CROWN' misses 78 rows, and label prices per brand split into two groups that are never added together. canonicalBrand() now snaps spellings to the official list, so GOLDENCROWN and GOLDEN CROWN stop being two brands. The owner's list of 23 brands was checked before being used: each was searched across Sona's production list, the Indonesian warehouse stock and the Chinese warehouse schedule, and ZERO of the 23 carry a Mandarin token on their rows — so not one was given an invented Mandarin name. Comparing that list against items + designs surfaced 17 brands in use but unlisted, led by TRAVELSTAR at 85 rows and MASTERTRACK at 63. Also four values that are not brands at all and are sitting in the brand column: an em dash on 26 rows, 'TBR' on 8, 'ZC' on 2, and '95H CAPITOL' on 1 — the last a load index leaking into the brand field, a failure shape itemName.js already documents about itself.",
  zh: "无法显示的设计图，原因不在门户本身。635 个设计中有 240 个把缩略图存成 https://drive.google.com/thumbnail?id=...&sz=w400 — 那不是图片，而是一个会跳转的地址。在浏览器中实测：它最终落到 lh3.googleusercontent.com 并带上 ?authuser=0，说明它之所以成功，是因为打开它的浏览器正以文件所有者身份登录。供应商并未登录该账号。Drive 还对该缩略图路径做了限流，这解释了为何是时好时坏而非一直失败。240 条全部改写为 lh3.googleusercontent.com/d/<id>=w400，直接提供图片且不经跳转 — 复查结果：零条残留。但人们看到的是破图图标。src 加载失败的 <img> 并不会沉默：浏览器会画出破图图标并显示 alt 文本，而本门户没有任何一个 <img> 处理过加载失败。在供应商界面上，这被读作「门户坏了」，而不是「图片缺失」—— 如此理解的人会刷新页面，而不是使用就在框下方的印刷文件链接。ui/components.js 中的 gambarAman() 现在会把失败的图片替换为一行指明出路的说明。其外层是 <span> 而非 <img>，因为 <img> 无法容纳文字 —— 这也使它可以安全地放入设计库的元素缓存：被缓存的是外层容器，因此失败过的卡片不会在下次渲染时又变回破图图标。品牌主数据：50 个正式拼写，以及一个一直被拆成两半的品牌。数据库实测：GOLDEN CROWN 同时以两种拼写存在 — 「GOLDEN CROWN」43 行与「GOLDENCROWN」78 行；HI-RUN 6 行对 HIRUN 32 行。筛选「全部 GOLDEN CROWN」会漏掉 78 行，而按品牌统计的标签价格被拆成两组，永远不会相加。canonicalBrand() 现在会将拼写对齐到正式名单，因此 GOLDENCROWN 与 GOLDEN CROWN 不再是两个品牌。所有者提供的 23 个品牌在使用前先做了核查：逐一在 Sona 排产表、印尼仓库存与中国仓发货计划中检索，23 个中有零个在其所在行带有中文词 —— 因此没有为任何一个编造中文名。将该名单与 items + designs 比对，发现 17 个在用但未登记的品牌，其中 TRAVELSTAR 85 行、MASTERTRACK 63 行居首。另有四个根本不是品牌却存放在品牌列中的值：破折号 26 行、「TBR」8 行、「ZC」2 行、「95H CAPITOL」1 行 —— 最后一个是负荷指数渗入品牌列，而这种失效形态 itemName.js 早已自行记录在案。",
};
