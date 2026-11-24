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

export const VERSION = 'v30.8';
export const VERSION_DATE = '24 Nov 2026';

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
  id: "PIKTOGRAM KENDARAAN 99 POLA DIPANEN DARI KATALOG TBR 2026, DAN POSISI PEMASANGANNYA SEKARANG IKUT DI PEDOMAN. Tiap halaman pola di katalog menandai poros mana yang MERAH (Recommendable) dan mana yang HIJAU (Available). Keterangan itu selama ini cuma ada di katalog cetak -- dan itu pula yang tercetak di artwork labelnya. Orang yang menyiapkan label harus membuka katalog di sebelahnya, atau menyalin dari label lain dan berharap polanya sama. LETAKNYA TIDAK DIKETIK TANGAN. Judul pola dan legendanya dua-duanya TEKS dengan koordinat di PDF katalognya, dan piktogramnya selalu duduk di antara keduanya -- jadi kotaknya dihitung dari dua jangkar itu lalu DIPANGKAS ke isinya yang sebenarnya, karena kotak tetap akan membawa ruang kosong yang berbeda tiap pola. Nama polanya dikenali dari satu sifat yang tidak ikut berubah: ia satu-satunya teks di halaman itu yang badannya lewat 30 pt. 45 halaman disapu, 99 pola ditemukan, NOL GAGAL. TITIKNYA DIGAMBAR ULANG DARI DATANYA di pedoman, bukan ditempel sebagai gambar katalog. Dua alasan: gambar katalognya milik pabrik dan tidak perlu ikut berkeliling, dan yang benar-benar dipakai orang itu POSISINYA, bukan lukisan truknya. Disimpan sebagai PECAHAN terhadap kotak piktogramnya sendiri, jadi tetap benar pada ukuran tampil berapa pun. YANG TIDAK DIKLAIM, DAN INI PENTING: nama poros. Satu blok katalog memuat dua sampai empat kendaraan bersebelahan, jadi x=0,2 berarti 'seperlima dari kiri BLOK', bukan 'poros kemudi'. Memetakannya jadi steer/drive/trailer butuh pemisahan per kendaraan, dan menebaknya berarti mencetak keterangan posisi yang salah -- persis jenis kesalahan yang tidak terlihat seperti kesalahan. Jadi yang dicetak jumlah dan letaknya, bukan namanya. AZ675 MUNCUL DUA KALI di katalog: halaman 22 (Regional) dan 40 (Urban). Rekomendasinya ternyata sama, tapi KEDUANYA disimpan dan ditandai kembar -- kalau suatu hari dua segmen berbeda rekomendasi, itu ketahuan, bukan hilang satu. Percobaan pertama menamai berkasnya dari kode polanya saja dan yang kedua menimpa yang pertama tanpa suara; ketahuan karena jumlah berkasnya 98 sementara indeksnya 99. supabase/sql/pola_truk.sql memuat tabel, policy-nya, dan 99 barisnya. Tabelnya dibaca semua yang login (sama seperti pola_foto) dan ditulis lewat is_internal() yang sudah ada -- bukan daftar peran baru yang harus diingat terpisah. GRANT ditulis sebelum policy, karena Postgres memeriksa grant lebih dulu dan tanpa itu policy yang benar tidak pernah sempat dievaluasi; itu persis yang pernah terjadi pada pola_foto. renderBanyak() ikut meneruskan datanya per baris, jadi satu Excel tetap keluar satu berkas dengan posisi pemasangan masing-masing. 34 berkas uji dijalankan, semuanya keluar bersih.",
  en: "VEHICLE PICTOGRAMS FOR 99 PATTERNS HARVESTED FROM THE TBR 2026 CATALOG, AND THEIR FITMENT POSITIONS NOW RIDE ON THE GUIDE. Every pattern page in the catalog marks which axles are RED (Recommendable) and which are GREEN (Available). That guidance has only ever existed in the printed catalog -- and it is also what gets printed on the label artwork. Whoever prepares a label has to keep the catalog open beside them, or copy from another label and hope the pattern matches. THE POSITION IS NOT TYPED IN BY HAND. The pattern title and its legend are both TEXT with coordinates in the catalog PDF, and the pictogram always sits between the two -- so the box is computed from those two anchors and then TRIMMED to its actual content, because a fixed box carries a different amount of white space on every pattern. The pattern name is recognised by one property that does not drift: it is the only text on the page taller than 30 pt. 45 pages swept, 99 patterns found, ZERO failures. THE DOTS ARE REDRAWN FROM THE DATA on the guide rather than pasted in as the catalog picture. Two reasons: the catalog artwork belongs to the manufacturer and does not need to travel, and what people actually use is the POSITION, not the drawing of the truck. Stored as FRACTIONS of the pictogram's own box, so they stay correct at any display size. WHAT IS NOT CLAIMED, AND THIS MATTERS: axle names. One catalog block holds two to four vehicles side by side, so x=0.2 means 'a fifth from the left of the BLOCK', not 'the steer axle'. Mapping that to steer/drive/trailer needs per-vehicle segmentation, and guessing it would print fitment guidance that is wrong -- exactly the kind of error that does not look like an error. So the count and the placement are printed; the names are not. AZ675 APPEARS TWICE in the catalog: page 22 (Regional) and page 40 (Urban). The guidance turns out to be identical, but BOTH are stored and flagged as duplicates -- if two segments ever differ, that shows up instead of one of them vanishing. The first attempt named files by pattern code alone and the second silently overwrote the first; it was caught because the file count was 98 while the index said 99. supabase/sql/pola_truk.sql carries the table, its policies and all 99 rows. The table is readable by anyone signed in (like pola_foto) and written through the existing is_internal(), not a new role list to remember separately. The GRANT is written before the policy, because Postgres checks grants first and without it a correct policy never gets evaluated at all; that is exactly what once happened to pola_foto. renderBanyak() passes the data through per row, so one Excel still produces one file with each row's own fitment positions. 34 test files run, all exit clean.",
  zh: "从 TBR 2026 产品目录中采集了 99 个花纹的车辆示意图，其装配位置现已随指引一同输出。目录中每一个花纹页都标注了哪些轴位为红色（Recommendable）、哪些为绿色（Available）。这项信息此前只存在于印刷版目录中——而它同样会印在标签图稿上。准备标签的人必须把目录摊在旁边，或者从另一张标签上照抄并指望花纹相同。位置不是手工输入的。花纹标题与图例在目录 PDF 中都是带坐标的文字，而示意图始终位于两者之间——因此方框由这两个锚点推算得出，然后按其实际内容进行裁剪，因为固定方框在每个花纹上带来的空白都不相同。花纹名称通过一个不会漂移的特征识别：它是该页上唯一高度超过 30 pt 的文字。扫描 45 页，找到 99 个花纹，零失败。指引上的圆点由数据重绘，而不是把目录图片贴上去。原因有二：目录图稿属于制造商，不必四处流转；而人们真正使用的是位置，而不是卡车的画。圆点以相对于示意图自身方框的比例存储，因此在任何显示尺寸下都保持正确。未作声称的部分，这一点很重要：轴位名称。一个目录区块中并排放着两到四辆车，因此 x=0.2 表示“从区块左侧起五分之一处”，而不是“转向轴”。要映射为 steer/drive/trailer 需要逐车分割，贸然猜测会印出错误的装配说明——而这正是那种看起来不像错误的错误。因此只打印数量与位置，不打印名称。AZ675 在目录中出现了两次：第 22 页（Regional）与第 40 页（Urban）。两处的建议实际相同，但两条记录都被保存并标记为重复——若某天两个细分市场的建议不同，就会显现出来，而不是其中之一悄悄消失。第一次尝试仅以花纹代号命名文件，第二个无声地覆盖了第一个；之所以被发现，是因为文件数为 98 而索引为 99。supabase/sql/pola_truk.sql 包含该表、其访问策略以及全部 99 行数据。该表对所有已登录用户可读（与 pola_foto 相同），写入通过既有的 is_internal() 控制，而不是另立一份需要单独记忆的角色清单。GRANT 写在策略之前，因为 Postgres 先检查授权，缺少它时正确的策略根本没有机会被求值；pola_foto 当初正是栽在这里。renderBanyak() 会逐行传递这些数据，因此一个 Excel 仍然产出一个文件，且每一行都带有各自的装配位置。已运行 34 个测试文件，全部干净退出。",
};
