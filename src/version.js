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

export const VERSION = 'v15.4';
export const VERSION_DATE = '10 Agu 2026';

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
      id: 'PO yang belum disetujui sekarang bisa dibenahi dan dibuang PEMBUATNYA SENDIRI, dan yang sudah disetujui benar-benar terkunci. Sebelum ini, salah ketik harga di PO yang belum disetujui butuh tiga langkah lewat orang lain: minta wilbert yang edit, atau Request Delete lalu tunggu approval lalu bikin ulang. Padahal basis datanya SUDAH mengizinkan sejak lama — pos_update USING berbunyi is_admin() OR (created_by = current_username() AND status = \'Menunggu Approval\'). Yang menahan cuma satu ternary isWilbert di approval.js. Sekarang pembuatnya melihat Edit dan Hapus selama PO-nya masih Menunggu Approval, dan Hapus meminta alasan — bukan basa-basi konfirmasi, tapi karena PO yang lenyap dari Reports tanpa jejak adalah lubang di catatan, dan enam bulan lagi yang menelusurinya perlu jawaban. Nomornya sendiri justru BEBAS dipakai lagi: pos_no_unik itu unique index parsial ON pos (no) WHERE deleted_at IS NULL. Alasannya tersimpan ke delete_reason DAN ke audit. Menghapusnya lewat RPC BARU delete_own_pending_po, bukan pelebaran approve_po_delete: yang lama jalur untuk PO yang sudah disetujui dan memang harus lewat supervisor, dan satu fungsi yang menjawab dua pertanyaan keamanan sekaligus selalu berakhir longgar di salah satu sisinya. Syaratnya diperiksa di dalam RPC terhadap baris yang sesungguhnya — kepemilikan DAN status — jadi memanggilnya dengan id PO orang lain tetap ditolak walau tombolnya diakali. DAN INI YANG SEBENARNYA MENDESAK: policy pos_receive memberi wilbert, cania dan visca hak UPDATE ke tabel pos TANPA BATASAN BARIS SAMA SEKALI. Policy PERMISSIVE di-OR, jadi policy itu MENELAN seluruh kehati-hatian pos_update — cania dan visca bisa mengubah items, subtotal, total, pemasok dan termin dari PO yang SUDAH DISETUJUI, lewat API, tanpa tombol. Yang dijaga trigger cuma status, bukan angkanya. Jadi kalimat kalau sudah saya approve hanya saya yang bisa selama ini benar untuk statusnya dan salah untuk uangnya. Dugaan asal-usulnya jalan pintas untuk menutup temuan audit 2.2 — cania dan visca tidak bisa menandai barang sampai karena pos_update mensyaratkan status Menunggu Approval sementara layar PO Outstanding hanya menampilkan yang Approved. Arah obatnya benar, dosisnya kelewat lebar. Sekarang pos_receive dipersempit ke status Approved dan belum terhapus — daftar perannya TIDAK diubah, jadi ini penyempitan murni yang tidak bisa mematikan apa pun yang selama ini sah. Dan karena RLS itu per-BARIS bukan per-KOLOM, penyempitan saja tidak cukup: trigger baru pos_guard_approved_trg membekukan setiap kolom PO yang sudah disetujui untuk siapa pun selain wilbert, KECUALI angka penerimaan barang. Di dalam items pun hanya receivedDirect yang boleh berubah — erp, qty, harga satuan, amount dan lineId adalah isi kontrak. Bentuknya sengaja meniru pos_guard_status_trg baris demi baris, termasuk auth.uid() is null yang membiarkan service-role dan migrasi lewat, dan errcode insufficient_privilege supaya penolakannya terbaca sebagai penolakan hak. Alur terima barang aman: setPoItems() cuma menyentuh satu kolom, dan komentarnya sendiri sudah menyebut kenapa ia BUKAN updatePO(). Butuh supabase_po_edit_hapus.sql; tanpa berkas itu tombol Hapus akan gagal dengan pesan RPC tidak ditemukan, dan lubang pos_receive masih terbuka.',
      en: 'A PO that has not been approved yet can now be fixed and discarded BY ITS OWN AUTHOR, and one that has been approved is genuinely frozen. Until now a mistyped price on an unapproved PO took three steps through someone else. The database had allowed it all along — pos_update USING reads is_admin() OR (created_by = current_username() AND status = \'Menunggu Approval\'); the only thing holding it back was one isWilbert ternary in approval.js. The author now sees Edit and Delete while the PO is still awaiting approval, and Delete asks for a reason — not as a confirmation nicety, but because a PO that vanishes from Reports leaving no trace is a hole in the record, and in six months whoever traces it needs an answer. The number itself becomes reusable: pos_no_unik is a PARTIAL unique index, ON pos (no) WHERE deleted_at IS NULL. Deletion goes through a NEW RPC, delete_own_pending_po, rather than widening approve_po_delete: that one is the path for an already-approved PO and must stay with the supervisor, and a single function answering two security questions always ends up loose on one of them. AND THIS IS THE URGENT PART: the pos_receive policy grants wilbert, cania and visca UPDATE on the pos table WITH NO ROW RESTRICTION AT ALL. PERMISSIVE policies are OR\'d, so it SWALLOWS everything pos_update was careful about — cania and visca can change items, subtotal, total, supplier and terms on an ALREADY-APPROVED PO, through the API, with no button. The trigger only guards the status, not the money. Its likely origin is a shortcut for audit finding 2.2. pos_receive is now narrowed to status Approved and not soft-deleted; the role list is UNCHANGED, so this is a pure narrowing that cannot break anything that legitimately worked. And because RLS is per-ROW, not per-COLUMN, narrowing alone is not enough: a new trigger, pos_guard_approved_trg, freezes every column of an approved PO for anyone but wilbert, EXCEPT the goods-received figures. Within items only receivedDirect may change — erp, qty, unit price, amount and lineId are the contract. The receiving flow is safe: setPoItems() touches exactly one column. Requires supabase_po_edit_hapus.sql; without it the Delete button fails with an RPC-not-found error and the pos_receive hole stays open.',
      zh: '尚未批准的采购单现在可以由创建者本人修改和删除，而已批准的采购单则被真正冻结。此前，未批准采购单上的一个错价需要经他人三步处理。而数据库其实一直允许——pos_update 的 USING 为 is_admin() OR (created_by = current_username() AND status = \'Menunggu Approval\')，唯一的阻碍是 approval.js 中的一个 isWilbert 三元表达式。现在只要采购单仍在等待审批，创建者就能看到编辑与删除，且删除会要求填写原因——因为无痕消失于报表的采购单会在记录上留下缺口，六个月后追查的人需要一个答案。编号本身反而可以再次使用：pos_no_unik 是部分唯一索引 ON pos (no) WHERE deleted_at IS NULL。删除通过新的 RPC delete_own_pending_po 完成，而不是放宽 approve_po_delete：后者是已批准采购单的路径，必须由主管把关。而真正紧迫的是：pos_receive 策略授予 wilbert、cania 和 visca 对 pos 表的 UPDATE 权限，且完全没有行限制。PERMISSIVE 策略之间是 OR 关系，因此它吞掉了 pos_update 的全部谨慎——cania 和 visca 可以通过 API、在没有任何按钮的情况下，修改已批准采购单的 items、subtotal、total、供应商和付款条件。触发器只守住状态，守不住金额。现在 pos_receive 被收窄为 status 为 Approved 且未被软删除；角色清单保持不变，因此这是一次纯粹的收窄。又因为 RLS 是按行而非按列的，仅收窄并不够：新触发器 pos_guard_approved_trg 会为 wilbert 以外的所有人冻结已批准采购单的每一列，唯独放行到货数量。在 items 内部也只有 receivedDirect 可以变动。收货流程是安全的：setPoItems() 只触及一列。需要 supabase_po_edit_hapus.sql。',
};
