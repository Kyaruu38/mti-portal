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

export const VERSION = 'v30.3';
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
  id: "AKUN SONA SEKARANG BISA MELIHAT DESIGN LIBRARY DAN TYRE PATTERNS. Diminta pemilik: sona menulis permintaan label yang menyebut kode ERP, tapi tidak punya satu pun layar untuk melihat artwork di balik kode itu. Dua layar ditambahkan ke daftar aksesnya: label-library dan pola-ban. LIHAT SAJA, DAN BUKAN KARENA DAFTAR INI YANG BILANG BEGITU. Diperiksa di pg_policies, bukan dikira-kira: designs_insert, designs_update dan designs_delete cuma menyebut wilbert, cania dan visca, jadi tulisan apa pun ditolak Postgres. Kapabilitas designWrite sengaja tidak diberikan, dan ITU yang menyembunyikan tombol Upload serta Pindah ke Drive pusat di layar pustaka -- layarnya memang menggerbangi tombol pada kapabilitas, bukan pada kehadiran layar. Di tempat tombol Upload muncul penanda Read-only; di jendela detail, tombol hapus diganti tulisan Hanya lihat dan tombol edit hilang. TIDAK ADA SATU BARIS SQL PUN YANG DIJALANKAN, dan itu temuan tersendiri: designs_read TERNYATA SUDAH memuat 'sona' sejak sebelum perubahan ini, dan pola_foto_baca syaratnya cuma `auth.uid() is not null` sementara pola_foto_varian_baca `true`. Jadi datanya memang sudah boleh dia baca selama ini; yang hilang cuma menunya. Satu akibat yang menenangkan: badge 'Design ada / tidak ada' di layar Label Request miliknya selama ini MEMANG jujur -- kalau designs_read tidak memuat dia, tiap baris akan tertulis 'tidak ada desain' padahal desainnya ada, dan dia akan meminta ulang desain yang sudah jadi. Layar Tyre Patterns tidak perlu digerbangi sama sekali: screens/polaBan.js tidak punya jalur tulis, dan polaFotoApi.js cuma mengekspor dua fungsi baca. YANG SENGAJA TIDAK IKUT: label-artwork, master-data, po-saya, surat-jalan, dan is_purchasing() di sisi server -- semuanya tetap tertutup. Ditambah harness uji baru test-akses-sona.mjs (16 pemeriksaan). Harness-nya ADA DI MESIN LOKAL SAJA, tidak ikut ter-push: polanya test-*.mjs sudah ada di .gitignore karena repo ini publik sementara harness memuat kode ERP dan nama pemasok sungguhan. Yang dikerjakannya MERENDER layar pustaka sebagai sona lalu sebagai wilbert dan membandingkan tombolnya, bukan membaca tabel CAPS. Bentuk ujinya disengaja: yang pernah salah di berkas ini bukan tabelnya melainkan sambungannya, dan labelLibrary.js dulu memang tidak punya pemeriksaan kapabilitas sama sekali. 32 berkas uji dijalankan, semuanya keluar bersih.",
  en: "THE SONA ACCOUNT CAN NOW SEE THE DESIGN LIBRARY AND TYRE PATTERNS. Asked for by the owner: sona writes the label requests that name ERP codes, yet had no screen on which to see the artwork behind those codes. Two screens were added to her access list: label-library and pola-ban. VIEW ONLY, AND NOT BECAUSE THIS LIST SAYS SO. Checked in pg_policies rather than assumed: designs_insert, designs_update and designs_delete name only wilbert, cania and visca, so any write is refused by Postgres. The designWrite capability is deliberately withheld, and THAT is what hides the Upload and 'Move to the central Drive' buttons on the library screen -- it gates its buttons on the capability, not on screen presence. A Read-only badge takes the Upload button's place; in the detail dialog the delete button becomes the words 'View only' and the edit button disappears. NOT ONE LINE OF SQL WAS RUN, and that is a finding in itself: designs_read ALREADY listed 'sona' before this change, while pola_foto_baca requires only `auth.uid() is not null` and pola_foto_varian_baca is `true`. The data was always hers to read; only the menu was missing. One reassuring consequence: the 'has design / no design' badge on her Label Request screen has been telling the truth all along -- had designs_read excluded her, every row would have read 'no design' while the design existed, and she would have re-requested artwork that was already finished. The Tyre Patterns screen needs no gate at all: screens/polaBan.js has no write path and polaFotoApi.js exports two read functions and nothing else. DELIBERATELY NOT INCLUDED: label-artwork, master-data, po-saya, surat-jalan, and is_purchasing() server-side -- all stay shut. Adds a new test harness, test-akses-sona.mjs (16 checks). It lives on the local machine only and is NOT pushed: test-*.mjs is already in .gitignore because this repository is public while the harnesses carry real ERP codes and supplier names. What it does is RENDER the library screen as sona and then as wilbert and compares the buttons, rather than reading the CAPS table. That shape is deliberate: what has gone wrong in this file before was the wiring, not the table, and labelLibrary.js once had no capability check at all. 32 test files run, all exit clean.",
  zh: "sona 账号现在可以查看标签设计库和轮胎花纹。应所有者要求：sona 负责撰写标注 ERP 编码的标签申请，却没有任何一个画面可以看到这些编码背后的图稿。现已向她的访问清单添加两个画面：label-library 与 pola-ban。仅可查看，而且这并不是因为这份清单这么写。已在 pg_policies 中核实而非臆测：designs_insert、designs_update 与 designs_delete 只列出 wilbert、cania 和 visca，因此任何写入都会被 Postgres 拒绝。designWrite 权限刻意不授予，而正是它隐藏了设计库画面上的“上传”和“迁移至中央云盘”按钮——该画面按权限而非按画面是否可见来控制按钮。“上传”按钮的位置改为“只读”标记；在详情对话框中，删除按钮变成“仅查看”字样，编辑按钮消失。没有执行任何一行 SQL，而这本身就是一项发现：designs_read 在此次改动之前就已经包含 'sona'，而 pola_foto_baca 的条件仅为 `auth.uid() is not null`，pola_foto_varian_baca 为 `true`。这些数据她一直有权读取，缺的只是菜单。一个令人安心的结果：她的标签申请画面上“有设计／无设计”的标记一直都是准确的——倘若 designs_read 当初不包含她，每一行都会显示“无设计”，而实际上设计是存在的，她会重复申请已经完成的图稿。轮胎花纹画面根本不需要设限：screens/polaBan.js 没有任何写入路径，polaFotoApi.js 只导出两个读取函数。刻意不包含的部分：label-artwork、master-data、po-saya、surat-jalan，以及服务端的 is_purchasing()——全部保持关闭。新增测试工具 test-akses-sona.mjs（16 项检查）。该文件仅存在于本地，不会被推送：test-*.mjs 早已列入 .gitignore，因为本仓库是公开的，而测试工具中含有真实的 ERP 编码与供应商名称。它会以 sona 身份、再以 wilbert 身份渲染设计库画面并比较按钮，而不是读取 CAPS 表。这种写法是刻意的：这个文件以往出错的是接线而非表格，而 labelLibrary.js 曾经完全没有权限检查。已运行 32 个测试文件，全部干净退出。",
};
