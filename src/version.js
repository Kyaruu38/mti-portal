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

export const VERSION = 'v21.2';
export const VERSION_DATE = '4 Nov 2026';

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
  id: "ANGKA 'DITERIMA' YANG TIDAK PERNAH PUNYA SURAT JALAN AKHIRNYA MENYEBUTKAN DARI MANA ASALNYA — DAN PENJAGA DI SERVER BERHENTI MENGABAIKAN SEPARUH PENERIMAAN. Yang terlihat di layar Surat Jalan Internal: satu baris OMNIMAX tertulis diterima 270 dari 9.700, padahal tidak seorang pun pernah membuat surat jalan untuknya. Jejaknya ketemu di audit log: 22 Okt 2026 pukul 07:22, wangyaqian menandai 270 dari sisa 9.700 lewat tombol 'sudah sampai' di layar PO Outstanding. Lewat surat jalan: NOL. PENERIMAAN MEMANG PUNYA DUA PINTU, dan itu disengaja sejak awal: surat jalan untuk jalur label, dan penandaan langsung untuk PO yang tidak butuh lembar verifikasi. Keduanya dijumlahkan di core/outstanding.js. Yang tidak disengaja: layar ini cuma menampilkan hasil penjumlahannya. Satu angka tanpa asal-usul, dan yang membacanya menyimpulkan portalnya salah hitung — kesimpulan yang sepenuhnya wajar. receivedBreakdown() sudah ditulis sejak lama persis untuk pertanyaan ini, lengkap dengan catatannya sendiri: 'Diterima 100 tanpa keterangan dari mana membuat orang tidak bisa menyanggah angkanya; 80 lewat surat jalan, 20 ditandai manual oleh cania bisa.' Yang belum ada cuma pemakaiannya di layar ini. Sekarang kolomnya menyebut pecahannya, dan tooltip-nya menyebut pintunya. TAPI YANG DITEMUKAN DI BALIKNYA LEBIH BERAT, DAN ITU LUBANG DI SERVER. create_surat_jalan() menolak kelebihan kirim dengan membandingkan jumlah terkirim terhadap jumlah dipesan — dan 'jumlah terkirim' itu dijumlahkan HANYA dari tabel surat_jalan. receivedDirect tidak pernah ikut dihitung. Untuk baris OMNIMAX tadi artinya: browser tahu sisanya 9.430, server mengira sisanya masih 9.700 penuh. Satu-satunya yang mencegah kelebihan 270 adalah clamp di browser — padahal seluruh alasan create_surat_jalan() dibuat adalah karena cek di browser TIDAK cukup: dua orang di layar yang sama bisa sama-sama lolos cek versi masing-masing lalu sama-sama menyimpan. Sekarang jatahnya dikurangi yang sudah ditandai manual, di create_surat_jalan() maupun di amend_surat_jalan() yang baru lahir kemarin dengan lubang yang sama persis. Penambalannya tidak menulis ulang fungsinya: yang diganti cuma ekspresi pengambilan jumlah pesanan, lewat replace pada definisi fungsinya sendiri. Menulis ulang fungsi yang tidak terbaca utuh adalah cara melahirkan bug kedua sambil menambal yang pertama. Penjaganya jadi lebih KETAT, bukan lebih longgar: semua yang hari ini lolos lewat layar tetap lolos, karena clamp di browser memang sudah memakai angka yang benar sejak awal.",
  en: "A 'RECEIVED' FIGURE THAT NEVER HAD A DELIVERY NOTE FINALLY SAYS WHERE IT CAME FROM — AND THE SERVER-SIDE GUARD STOPS IGNORING HALF OF ALL RECEIPTS. What the Internal Delivery Note screen showed: one OMNIMAX line reading 270 received out of 9,700, although nobody had ever created a delivery note for it. The audit log had it: 22 Oct 2026 at 07:22, wangyaqian marked 270 of the outstanding 9,700 through the 'arrived' button on the Outstanding PO screen. Via delivery note: ZERO. RECEIPTS GENUINELY HAVE TWO DOORS, and that was deliberate from the start: delivery notes for the label flow, and direct marking for POs that need no verification sheet. Both are summed in core/outstanding.js. What was not deliberate: this screen only ever showed the sum. One number with no origin, and the person reading it concludes the portal miscounted — an entirely reasonable conclusion. receivedBreakdown() was written long ago for exactly this question, carrying its own note: 'Received 100 with no indication of where from leaves nobody able to dispute it; 80 via delivery note, 20 marked manually by cania can be disputed.' All that was missing was its use on this screen. The column now names the split, and the tooltip names the door. BUT WHAT SAT BEHIND IT IS HEAVIER, AND IT IS A HOLE IN THE SERVER. create_surat_jalan() refuses over-delivery by comparing shipped against ordered — and 'shipped' is summed ONLY from the surat_jalan table. receivedDirect was never counted. For that OMNIMAX line this means: the browser knows 9,430 remain, the server believes the full 9,700 are still available. The only thing preventing a 270 over-receipt was the browser-side clamp — while the entire reason create_surat_jalan() exists is that a browser-side check is NOT enough: two people on the same screen can each pass their own check and both save. The allowance is now reduced by whatever was marked manually, in create_surat_jalan() and in amend_surat_jalan(), which was born yesterday carrying the identical hole. The patch does not rewrite the function: only the expression that reads the ordered quantity is replaced, through a replace on the function's own definition. Rewriting a function one has not read in full is how a second bug is born while patching the first. The guard becomes STRICTER, not looser: everything that passes through the screen today still passes, because the browser clamp was already using the correct number all along.",
  zh: "一个从未有过送货单的「已收」数字，终于说出了它的来处 — 而服务端守卫也不再忽略一半的收货。内部送货核对单界面显示：某条 OMNIMAX 明细记为 9,700 中已收 270，然而从未有人为它开过送货单。审计日志给出了答案：2026 年 10 月 22 日 07:22，wangyaqian 通过未结采购单界面的「已到货」按钮，在未结的 9,700 中标记了 270。经由送货单的数量：零。收货确实有两道门，这从一开始就是有意为之：标签流程走送货单，无需核对表的采购单走直接标记。两者在 core/outstanding.js 中相加。并非有意的是：本界面只显示了相加的结果。一个没有来处的数字，读到它的人会断定门户算错了 — 这个结论完全合理。receivedBreakdown() 很早就是为这个问题而写的，并带着自己的注释：「已收 100 而不说明来自何处，就没人能对它提出异议；而『80 经送货单、20 由 cania 手动标记』则可以。」缺的只是在本界面使用它。现在该列会标明构成，悬停提示会标明来源。但其背后的问题更重，那是服务端的一个漏洞。create_surat_jalan() 通过比较已发货量与订购量来拒绝超量发货 — 而「已发货量」仅从 surat_jalan 表中汇总，receivedDirect 从未被计入。对那条 OMNIMAX 明细而言：浏览器知道还剩 9,430，服务器却认为完整的 9,700 仍可使用。唯一阻止超收 270 的，是浏览器端的钳制 — 而 create_surat_jalan() 存在的全部理由，正是浏览器端的校验并不足够：同一界面上的两个人可以各自通过自己的校验并同时保存。现在额度会扣除已手动标记的数量，create_surat_jalan() 与昨天刚诞生、带着完全相同漏洞的 amend_surat_jalan() 都已修正。该补丁并未重写函数：只替换了读取订购量的那个表达式，通过对函数自身定义做字符串替换完成。重写一个未曾完整读过的函数，正是在修补第一个缺陷的同时诞生第二个缺陷的方式。守卫变得更严格，而非更宽松：今天经由界面通过的一切仍会通过，因为浏览器端的钳制从一开始用的就是正确的数字。",
};
