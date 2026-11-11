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

export const VERSION = 'v24.9';
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
  id: "KAMUS MEREK MANDARIN DIPERBAIKI, DAN TERNYATA SELAMA INI TIDAK PERNAH DIPAKAI SAMA SEKALI. 好运 tertulis GOODLUCK di bibit brandMap.js. Yang membantahnya data kerja sendiri: dipanen dari daftar produksi Sona, stok WH Indo dan jadwal kirim WH China, 35 baris memasangkan 好运 dengan kode ERP (ID-GR-...), dan baris Sona bahkan menuliskannya terang-terangan sebagai ‘GOODRIDE(好运)’ — sementara tidak ada SATU pun baris GOODLUCK di ketiga berkas itu. 路诚 jadi TRUST TRACK, 天力 TIANLI dan 欧耐特 ORNATE ditambahkan; 拜森 dan 前进 sengaja belum. TAPI YANG LEBIH BESAR DITEMUKAN WAKTU MEMERIKSA AKIBATNYA. Nilai bawaan parameter di JavaScript hanya berlaku untuk `undefined`, dan SELURUH pemanggil mengoper st.brandMap apa adanya — yang isinya [] selama tabel brand_map di basis data masih kosong. Dan tabel itu memang kosong: 0 baris, diperiksa langsung. Jadi [] menang atas bawaannya, pencarian dilakukan di daftar kosong, dan kedelapan bibit di berkas itu TIDAK PERNAH terbaca sekali pun di produksi. Berkas yang hari ini diperbaiki selama ini kode mati. ITU JUGA YANG MENJELASKAN KENAPA SALAHNYA BELUM MENIMBULKAN KERUSAKAN: tidak ada satu pun item bermerek GOODLUCK di basis data — bukan karena petanya benar, melainkan karena petanya tidak pernah dibaca. Yang tertinggal jejaknya 57 dari 1.583 item dengan kolom merek KOSONG. Diperbaiki dua-duanya: canonicalBrand() sekarang memperlakukan daftar kosong sama dengan tidak diisi sehingga bibitnya kembali hidup, dan sembilan pasangan hasil panen dimasukkan ke tabel brand_map supaya jalur produksinya memakai data, bukan bibit. Panennya sendiri memakai satu aturan: pasangan hanya diambil dari baris yang MENULIS keduanya sekaligus — token Mandarin dan kode ERP di baris yang sama. Cara lain sempat dicoba dan dibuang: mencocokkan lewat ukuran + kode pattern menghasilkan 威狮=ARISUN dan 朝阳=GOODRIDE, karena satu spec ban dijual di banyak merek sehingga ukuran dan pattern tidak bisa menentukan merek. 美国, 印尼 dan 巴拉圭 juga dibuang — itu nama negara, dan sebagai merek akan membuat label buatan Amerika bermerek ‘美国’.",
  en: "THE MANDARIN BRAND MAP IS FIXED, AND IT TURNS OUT IT WAS NEVER READ AT ALL. 好运 was seeded as GOODLUCK in brandMap.js. The work data itself contradicts it: harvested from Sona's production list, the Indonesian warehouse stock and the Chinese warehouse schedule, 35 rows pair 好运 with the ERP code (ID-GR-...), and Sona's own rows spell it out as ‘GOODRIDE(好运)’ — while not ONE row anywhere says GOODLUCK. 路诚 becomes TRUST TRACK, 天力 TIANLI and 欧耐特 ORNATE are added; 拜森 and 前进 deliberately are not. BUT THE BIGGER THING SURFACED WHILE CHECKING THE DAMAGE. A JavaScript default parameter applies only to `undefined`, and EVERY caller passes st.brandMap as it is — which is [] while the brand_map table is empty. And it is empty: 0 rows, checked directly. So [] beats the default, the lookup runs against an empty list, and the eight seeds in that file have NEVER been read once in production. The file fixed today was dead code. That also explains why the error had done no damage: there is no item branded GOODLUCK in the database — not because the map was right, but because the map was never read. What it did leave behind is 57 of 1,583 items with an EMPTY brand column. Both are fixed: canonicalBrand() now treats an empty list the same as an unset one, bringing the seed back to life, and nine harvested pairs are inserted into brand_map so the production path uses data rather than seed. The harvest followed one rule: a pair is taken only from a row that WRITES both — the Mandarin token and the ERP code on the same line. Another method was tried and discarded: matching through size + pattern code produced 威狮=ARISUN and 朝阳=GOODRIDE, because one tyre spec is sold under many brands, so size and pattern cannot determine the brand. 美国, 印尼 and 巴拉圭 were discarded too — those are country names, and as brands they would leave a tyre made in America branded ‘美国’.",
  zh: "中文品牌对照表已修正，而且发现它此前根本从未被读取过。brandMap.js 的种子把 好运 写成 GOODLUCK。工作数据本身否定了这一点：从 Sona 的排产表、印尼仓库存与中国仓发货计划中采集，有 35 行将 好运 与 ERP 代码 (ID-GR-...) 配对，Sona 自己的行甚至直接写作「GOODRIDE(好运)」—— 而三份文件中没有任何一行出现 GOODLUCK。路诚 改为 TRUST TRACK，新增 天力 TIANLI 与 欧耐特 ORNATE；拜森 与 前进 暂不加入。但在核查其影响时发现了更大的问题。JavaScript 的参数默认值仅对 `undefined` 生效，而所有调用方都原样传入 st.brandMap —— 在 brand_map 表为空时其值为 []。而该表确实是空的：0 行，已直接核验。于是 [] 覆盖了默认值，查找在空列表上进行，该文件中的八条种子在生产环境中从未被读取过一次。今天修复的这个文件此前一直是死代码。这也解释了为何该错误尚未造成损害：数据库中没有任何品牌为 GOODLUCK 的物料 —— 不是因为对照表正确，而是因为它从未被读取。它留下的痕迹是 1,583 个物料中有 57 个品牌列为空。两处均已修复：canonicalBrand() 现在将空列表视同未传入，使种子重新生效；同时将采集到的九对写入 brand_map 表，使生产路径使用数据而非种子。采集只遵循一条规则：仅从同时写明两者的行中取配对 —— 中文词与 ERP 代码出现在同一行。另一种方法已被试过并弃用：通过尺寸 + 花纹代码匹配会得出 威狮=ARISUN 与 朝阳=GOODRIDE，因为同一轮胎规格会以多个品牌销售，尺寸与花纹无法决定品牌。美国、印尼、巴拉圭 也被剔除 —— 那是国名，若作为品牌，美国制造的轮胎就会被标上「美国」品牌。",
};
