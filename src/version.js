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

export const VERSION = 'v19.0';
export const VERSION_DATE = '12 Okt 2026';

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
      id: "KOTAK JUMLAH DI LAYAR PO OUTSTANDING: KIRIMAN SEBAGIAN AKHIRNYA BISA DICATAT. Sampai v18.0 tombol Tandai sudah sampai selalu menutup SELURUH sisa baris — tidak ada kolom qty, dan receivedDirect ditambah persis sebesar outstanding-nya. Akibatnya kiriman 8.000 dari 10.000 tidak punya cara dicatat sama sekali: mencentang barisnya menutup PO-nya penuh padahal 2.000 masih di jalan, jadi satu-satunya jalan keluar adalah TIDAK mencentangnya — dan kedatangan 8.000 itu lenyap, tidak tercatat di mana pun, sementara Purchasing tetap menagih sepuluh ribu. Panduan gudang dan SOP terpaksa menuliskan akal-akalan: kiriman sebagian jangan dicentang, tulis angkanya di Spreadsheet, lalu lapor komplain Short qty. Itu bukan prosedur, itu menambal lubang di layar dengan pekerjaan manusia. Sekarang tiap baris yang dicentang memunculkan kotak angka berisi sisa penuhnya sebagai nilai awal, jadi kiriman penuh TETAP satu klik dan yang berubah cuma: angkanya bisa dikurangi. Yang disimpan adalah angka yang diketik, sisanya tetap outstanding dan muncul lagi besok. ANGKANYA DISIMPAN DI Map BIASA, BUKAN DI ui STATE, dan itu bukan selera. mount() di core/dom.js tidak punya diffing: setiap setUI membongkar seluruh pohon dan membangunnya lagi, jadi kotak yang isinya didorong lewat state akan kehilangan fokus di digit PERTAMA — orangnya mengetik 8, layar dibangun ulang, dan 000 berikutnya jatuh entah ke mana. Kotaknya karena itu tidak dikendalikan state sama sekali; yang diperbarui saat mengetik cuma dua simpul teks di bilah bawah, lewat id, tanpa satu pun render ulang. Pola yang sama dipakai poNoField dan form komplain. ANGKANYA DIJEPIT KE 1..SISA. Lebih dari sisa tidak boleh diketik di sini: di MTI tidak ada toleransi, dan kelebihan kiriman jalurnya komplain Over qty, bukan angka penerimaan yang dibesarkan diam-diam. Baris yang angkanya dikosongkan DITOLAK di depan dengan menyebut kode ERP-nya, karena menyimpan nol diam-diam akan terbaca sebagai sudah dicek, memang tidak ada yang datang — padahal yang terjadi cuma kotaknya belum diisi. Angka ketikan dibuang begitu barisnya dilepas, supaya baris yang dicentang lagi besok tidak membawa angka kemarin. Jejak auditnya sekarang menyebut PARSIAL atau lengkap beserta angkanya: enam bulan lagi, '3 baris ditandai sampai' tidak bisa dibedakan antara kiriman penuh dan kiriman separuh, dan itu justru bedanya yang dicari orang. Bilah bawah memunculkan peringatan kuning begitu ada satu baris yang angkanya di bawah sisa, supaya penerimaan parsial tidak pernah terkirim tanpa disadari. Perataan kolom tabelnya juga diperbaiki: versi lama menentukan kolom mana yang rata kanan lewat rentang indeks (i >= 3 && i <= 5), jadi menyisipkan satu kolom menggeser diam-diam kolom yang salah. Sekarang tiap kolom membawa penandanya sendiri. TIDAK ADA SQL BARU: pos_guard_approved memang sudah mengizinkan receivedDirect untuk peran gudang, dan angka yang lebih kecil tetap angka yang sama kolomnya.",
      en: "A QUANTITY BOX ON THE OUTSTANDING PO SCREEN: PARTIAL DELIVERIES CAN FINALLY BE RECORDED. Until v18.0 the Mark as arrived button always closed the WHOLE remaining balance of a line — there was no qty field, and receivedDirect was incremented by exactly the outstanding figure. So a delivery of 8,000 against 10,000 had no way of being recorded at all: ticking the line closed the PO in full while 2,000 was still in transit, so the only way out was NOT to tick it — and those 8,000 vanished, recorded nowhere, while Purchasing went on chasing ten thousand. The warehouse guide and the SOP had to write down the workaround: don't tick a partial delivery, write the number in the Spreadsheet, then file a Short qty complaint. That is not a procedure, it is patching a hole in the screen with human labour. Now every ticked line shows a number box pre-filled with its full outstanding figure, so a complete delivery is STILL one click and the only thing that changed is that the number can be reduced. What gets saved is what was typed; the remainder stays outstanding and comes back tomorrow. THE NUMBER LIVES IN A PLAIN Map, NOT IN ui STATE, and that is not taste. mount() in core/dom.js has no diffing: every setUI tears the tree down and rebuilds it, so a box driven from state loses focus on the FIRST digit — the person types 8, the screen rebuilds, and the following 000 lands nowhere. The box is therefore not state-controlled at all; typing updates only two text nodes in the bottom bar, by id, with no re-render. poNoField and the complaint form use the same pattern. THE NUMBER IS CLAMPED TO 1..OUTSTANDING. More than the balance cannot be typed here: MTI has no tolerance, and an over-delivery belongs in an Over qty complaint rather than in a receipt figure quietly inflated. A line left blank is refused up front, naming its ERP code, because silently saving a zero reads as 'checked, nothing arrived' when all that happened is the box was not filled in. The typed number is discarded when the line is unticked, so a line ticked again tomorrow does not carry yesterday's figure. The audit trail now says PARTIAL or complete along with the number: in six months '3 lines marked arrived' cannot be told apart from a half delivery, and that difference is exactly what someone will be looking for. The bottom bar raises an amber warning as soon as any line is below its balance, so a partial receipt is never submitted unnoticed. Column alignment was fixed too: the old code decided which columns were right-aligned from an index range (i >= 3 && i <= 5), so inserting a column silently shifted the wrong ones. Each column now carries its own flag. NO NEW SQL: pos_guard_approved already permits receivedDirect for the warehouse role, and a smaller number is still the same column.",
      zh: "未结采购单页面新增数量输入框：部分到货终于可以记录。在 v18.0 之前，「标记为已到货」按钮总是结清整行余量 — 没有数量字段，receivedDirect 直接加上全部未交数。因此 10,000 中到货 8,000 根本无法记录：勾选该行会把采购单全额结清，而实际上还有 2,000 在途，于是唯一的办法就是不勾选 — 这 8,000 的到货便无处留痕，而采购部仍在催剩下的一万。仓库指南与作业流程不得不写下变通做法：部分到货不要勾选，把数字填到表格里，再提交「数量不足」投诉。那不是流程，那是用人力去堵页面上的漏洞。现在每个勾选的行都会出现一个数量框，预填该行的全部未交数，因此整批到货仍然只需一次点击，改变的只是：这个数字可以调小。保存的是填写的数字，余量仍为未交，明天会再次出现。数字保存在普通 Map 中，而不是 ui state，这并非偏好问题。core/dom.js 的 mount() 没有差分更新：每次 setUI 都会拆除并重建整棵树，因此由 state 驱动的输入框会在第一个数字时失去焦点 —输入 8，页面重建，随后的 000 不知落到何处。因此该输入框完全不受 state 控制；输入时仅通过 id 更新底部栏的两个文本节点，不触发任何重新渲染。poNoField 与投诉表单采用同一模式。数字被限制在 1 至未交数之间。超出余量的数字不允许在此填写：MTI 没有容差，超量到货应走「数量超出」投诉，而不是悄悄放大收货数字。留空的行会在提交前被拒绝并指出其 ERP 编码，因为默默保存零会被读作「已核查，确实没有到货」，而事实只是数量框尚未填写。取消勾选时填写的数字即被丢弃，以免次日重新勾选时带入昨天的数字。审计记录现在会注明「部分」或「齐套」并附上数量：六个月后，「3 行已标记到货」无法与半批到货区分，而这恰恰是人们要查的差别。只要有任一行低于其余量，底部栏即显示黄色提示，使部分收货不会在无人察觉中提交。表格列对齐也一并修正：旧代码以索引区间（i >= 3 && i <= 5）决定哪些列右对齐，插入一列便会悄悄错位。现在每一列各自携带对齐标记。无需执行新的 SQL：pos_guard_approved 本就允许仓库角色写入 receivedDirect，更小的数字仍然是同一列。",
};
