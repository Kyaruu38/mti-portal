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

export const VERSION = 'v26.1';
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
  id: "PO BARU TIDAK PERNAH SAMPAI KE PEMASOKNYA, DAN TIDAK ADA SATU PESAN KESALAHAN PUN. Ketahuan dari layar: akun PT WINS TUNGGAL PERDANA menampilkan 49 PO dengan yang terbaru 26 Oktober, sementara layar purchasing memegang PO untuk pemasok yang sama tertanggal 6 November. Dihitung di basis data: November 36 PO dengan 26 supplier_id KOSONG, sementara Oktober 76, September 54 dan Agustus 38 semuanya NOL yang kosong. Nol di bulan-bulan lama itu bukan tanda jalurnya benar — pos_supplier_id.sql MENGISINYA SEKALI pada 5 November. Yang lahir sesudah itu lahir kosong: toRow() di posApi.js menulis nama pemasok tapi tidak pernah menulis supplier_id, dan policy pos_read_supplier mencocokkan lewat supplier_id, bukan nama. Jadi tiap PO baru tidak kelihatan oleh pemasoknya, diam-diam, dan yang akan menemukannya pemasok yang menunggu order yang menurut purchasing sudah dikirim. DIPERBAIKI DI BASIS DATA, BUKAN DI LAYAR. Trigger pos_isi_supplier_id_trg mengisi kolom itu pada setiap insert dan setiap perubahan nama pemasok — berlaku untuk SEMUA jalur termasuk yang belum ditulis, sementara tambalan di posApi.js cuma menutup satu jalur dan jalur berikutnya akan mengulang kesalahan yang sama. Pencocokannya tidak pernah menebak: nama persis dulu, bentuk tanpa tanda baca sebagai cadangan, dan kalau yang cocok lebih dari satu supplier_id dibiarkan KOSONG — arah yang aman, karena kosong berarti pemasok tidak melihat PO itu sedangkan tebakan yang salah berarti pemasok melihat PO MILIK PESAINGNYA. SATU BUG KETAHUAN WAKTU DIUJI, DAN KALAU TIDAK DIUJI AKIBATNYA FATAL. Versi pertama fungsi trigger-nya memakai min(s.id) atas kolom uuid. Postgres tidak punya min(uuid): fungsinya melempar galat 42883 pada SETIAP insert dan update ke tabel pos, artinya tidak akan ada satu pun PO yang bisa dibuat lagi. Yang menemukannya uji insert di dalam transaksi yang di-rollback, BUKAN pesan 'Success. No rows returned' yang muncul waktu fungsinya dipasang. Sesudah dibetulkan, diuji ulang dengan cara yang sama: supplier_id terisi dan ID-nya benar. Sesudah susulan dijalankan: November 36 PO, 0 kosong; seluruh bulan 0. Lima PO atas nama SAMATOR INDO GAS SENGAJA tetap kosong — nama itu tidak ada di master pemasok sama sekali, bukan pemasok label, tidak punya akun, jadi memang tidak ada siapa pun yang seharusnya melihatnya.",
  en: "NEW POs NEVER REACHED THEIR SUPPLIER, AND NOTHING REPORTED AN ERROR. Spotted from the screen: the PT WINS TUNGGAL PERDANA account showed 49 POs with the newest dated 26 October, while the purchasing screen held POs for the same supplier dated 6 November. Counted in the database: November had 36 POs with 26 supplier_id EMPTY, while October's 76, September's 54 and August's 38 were all ZERO empty. That zero in the older months is not a sign the path was right — pos_supplier_id.sql FILLED IT ONCE on 5 November. Everything born after that was born empty: toRow() in posApi.js writes the supplier's name but never supplier_id, and the pos_read_supplier policy matches on supplier_id, not on the name. So every new PO was invisible to its supplier, silently, and whoever would have found it is a supplier waiting for an order purchasing believes it already sent. FIXED IN THE DATABASE, NOT ON THE SCREEN. The pos_isi_supplier_id_trg trigger fills the column on every insert and on every supplier-name change — covering ALL paths including ones not yet written, whereas a patch in posApi.js closes one path and the next path repeats the same mistake. The matching never guesses: exact name first, punctuation-stripped form as a fallback, and if more than one matches, supplier_id is left EMPTY — the safe direction, because empty means the supplier does not see that PO, while a wrong guess means a supplier seeing a COMPETITOR'S PO. ONE BUG SURFACED UNDER TEST, AND UNTESTED IT WOULD HAVE BEEN FATAL. The first version of the trigger function used min(s.id) over a uuid column. Postgres has no min(uuid): the function raised 42883 on EVERY insert and update to the pos table, meaning not one PO could have been created again. What found it was a test insert inside a rolled-back transaction, NOT the 'Success. No rows returned' shown when the function was installed. After the fix it was retested the same way: supplier_id filled, and the id correct. After the backfill: November 36 POs, 0 empty; every month 0. Five POs under SAMATOR INDO GAS are DELIBERATELY left empty — that name is not in the supplier master at all, is not a label supplier and has no account, so there is nobody who should be seeing them.",
  zh: "新采购单从未送达其供应商，且没有任何错误提示。从界面发现：PT WINS TUNGGAL PERDANA 账号显示 49 张采购单，最新为 10 月 26 日，而采购界面持有同一供应商 11 月 6 日的采购单。数据库统计：11 月 36 张采购单中有 26 张 supplier_id 为空，而 10 月 76 张、9 月 54 张、8 月 38 张均为零条为空。旧月份的零并不表示路径正确 — pos_supplier_id.sql 于 11 月 5 日一次性填充过。此后诞生的均为空：posApi.js 中的 toRow() 写入供应商名称却从不写入 supplier_id，而 pos_read_supplier 策略按 supplier_id 匹配而非名称。因此每一张新采购单对其供应商都是不可见的，悄无声息，而最终会发现它的是一位在等待采购方认为已发出的订单的供应商。在数据库而非界面修复。触发器 pos_isi_supplier_id_trg 在每次插入以及每次供应商名称变更时填充该列 —覆盖所有路径，包括尚未写出的路径；而在 posApi.js 打补丁只能堵住一条路径，下一条路径会重犯同样的错误。匹配绝不猜测：先精确匹配名称，再以去除标点的形式作为备选；若匹配到多个，则将 supplier_id 留空 —这是安全方向，因为留空意味着供应商看不到该采购单，而错误的猜测意味着供应商看到竞争对手的采购单。测试中暴露出一个缺陷，若未测试后果将是致命的。触发器函数的第一个版本对 uuid 列使用了 min(s.id)。Postgres 没有 min(uuid)：该函数在对 pos 表的每一次插入与更新时都会抛出 42883 错误，意味着将再也无法创建任何采购单。发现它的是一次在回滚事务中执行的测试插入，而不是安装函数时显示的「Success. No rows returned」。修复后以同样方式复测：supplier_id 已填充且 id 正确。回填之后：11 月 36 张采购单，0 条为空；所有月份均为 0。SAMATOR INDO GAS 名下的 5 张采购单被有意留空 —该名称根本不在供应商主数据中，并非标签供应商，也没有账号，因此本就不应有任何人看到它们。",
};
