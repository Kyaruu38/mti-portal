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

export const VERSION = 'v15.25';
export const VERSION_DATE = '03 Sep 2026';

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
      id: "PRF MENCETAK KETERANGAN YANG BUKAN YANG DICENTANG ORANGNYA. Di PRF Builder, invoice BSNINVMT2608262 tertulis ASCENDO-BSN-SNI-1308 — dan itu benar, itu nomor PO yang tercetak di tujuh baris invoice aslinya. Tapi di dokumen PRF/PC/IX/019 yang keluar, baris itu berbunyi \"(ID-ASCENDO-BIAS-OEM)ID7.50-16-14PR[AB313]122/118G ASCENDO\": satu nama spec, dari famili yang bahkan berbeda — BIAS-OEM, sementara PO-nya SNI. Orang membaca teks di builder, mencentang barisnya, menekan Preview, dan yang keluar sesuatu yang lain. PRF ini dokumen yang ditandatangani tiga orang lalu dipakai membayar; yang ditandatangani harus sama dengan yang diperiksa. SEBABNYA: descFor() MENEBAK PO, LALU MENCETAK BARIS PERTAMANYA. Ia mencari PO dari poRef dengan pencocokan yang longgar DAN dua arah — klausa pertama menuntut ref MEMUAT nomor kontrak, klausa kedua menuntut nomor PO MEMUAT ref, jadi nomor yang kebetulan potongan dari yang lain sudah cukup untuk menang. Lalu, sesudah sebuah PO terpilih, yang diambil items[0].d: deskripsi BARIS PERTAMA PO itu. Invoice BSNINVMT2608262 memuat TUJUH baris; enam lainnya hilang tanpa jejak dan yang tersisa terbaca sangat meyakinkan. Baris pertama sebuah PO bukan keterangan pembayaran — memilih satu dari tujuh bukan meringkas, itu membuang enam sambil terlihat pasti. DAN BUKTINYA ADA DI DOKUMEN YANG SAMA: baris satunya, BSNINVMT2608311, mencetak poRef apa adanya (SMALL LABEL-BSN 0821) karena kebetulan tidak ada PO yang cocok untuknya. Dua baris, dua aturan, satu kertas. Sekarang yang dicetak poRef-nya sendiri, sama persis dengan yang tertulis di builder. Kamus deskripsi bilingual TIDAK dibuang — ia master data yang dirawat orang — tapi turun pangkat dari PENGGANTI jadi TAMBAHAN, dan cuma bagian Tionghoanya yang ditempel, karena bagian Inggrisnya justru yang dipakai mencocokkan dan sudah ada di dalam ref itu sendiri: SMALL LABEL-BSN 0821 jadi SMALL LABEL-BSN 0821 · 小标签, sementara ASCENDO-BSN-SNI-1308 tetap apa adanya. PERLU DIKETAHUI: PRF yang SUDAH terbentuk menyimpan keterangannya di dalam barisnya sendiri, jadi dokumen lama tetap mencetak teks lamanya. Itu disengaja — mengubah apa yang dicetak sebuah dokumen yang sudah terbit lebih berbahaya daripada meninggalkannya. PRF yang masih berstatus Terbentuk dan belum dikirim sebaiknya dihapus lalu dibuat ulang.",
      en: "THE PRF PRINTED A DESCRIPTION THAT WAS NOT THE ONE THE PERSON TICKED. In the PRF Builder, invoice BSNINVMT2608262 reads ASCENDO-BSN-SNI-1308 — and that is correct; it is the PO number printed on all seven lines of the actual invoice. But the PRF/PC/IX/019 document that came out reads \"(ID-ASCENDO-BIAS-OEM)ID7.50-16-14PR[AB313]122/118G ASCENDO\": a single spec name, from a different family altogether — BIAS-OEM, while the PO is SNI. Someone reads the builder, ticks the row, presses Preview, and something else comes out. This PRF is a document three people sign and then pay against; what gets signed must be what was checked. THE CAUSE: descFor() GUESSED A PO, THEN PRINTED ITS FIRST LINE. It looked the PO up from poRef with a match that is loose AND bidirectional — the first clause requires the ref to CONTAIN the contract number, the second requires the PO number to CONTAIN the ref, so a number that merely happens to be a fragment of another already wins. Then, once a PO was chosen, it took items[0].d: the description of that PO's FIRST LINE. Invoice BSNINVMT2608262 carries SEVEN lines; the other six vanished without trace and what remained read entirely convincing. A PO's first line is not a payment description — picking one of seven is not summarising, it is discarding six while looking certain. AND THE PROOF SITS IN THE SAME DOCUMENT: the other line, BSNINVMT2608311, printed its poRef verbatim (SMALL LABEL-BSN 0821) because no PO happened to match it. Two lines, two rules, one sheet of paper. What prints now is the poRef itself, identical to what the builder shows. The bilingual description dictionary is NOT discarded — it is master data someone maintains — but demoted from REPLACEMENT to ADDITION, and only its Chinese half is appended, because the English half is what did the matching and is already inside the ref: SMALL LABEL-BSN 0821 becomes SMALL LABEL-BSN 0821 · 小标签, while ASCENDO-BSN-SNI-1308 stays exactly as it is. WORTH KNOWING: a PRF that already exists stores its description inside its own lines, so older documents still print their old text. That is deliberate — changing what an already-issued document prints is more dangerous than leaving it. A PRF still at Terbentuk and not yet sent is better deleted and rebuilt.",
      zh: "付款申请单打印的说明并非操作者所勾选的内容。在 PRF Builder 中，发票 BSNINVMT2608262 显示为 ASCENDO-BSN-SNI-1308 — 这是正确的，那是原始发票七行上印着的采购单号。但导出的 PRF/PC/IX/019 文件却显示为「(ID-ASCENDO-BIAS-OEM)ID7.50-16-14PR[AB313]122/118G ASCENDO」：一个规格名称，且来自完全不同的系列 — BIAS-OEM，而采购单是 SNI。人们阅读构建器上的文字、勾选该行、按下预览，出来的却是另一样东西。这份付款申请单是三个人签字后据以付款的文件；被签字的必须就是被核对的。原因：descFor() 先猜采购单，再打印它的第一行。它用一个既宽松又双向的匹配从 poRef 查找采购单 — 第一个条件要求 ref 包含合同号，第二个条件要求采购单号包含 ref，因此一个恰好是另一个片段的编号就足以胜出。随后，一旦选中某个采购单，它取的是 items[0].d：该采购单第一行的描述。发票 BSNINVMT2608262 含有七行；其余六行无声消失，而留下的那一行读起来极为可信。采购单的第一行不是付款说明 — 从七行中挑一行不是概括，而是在看起来确凿的同时丢弃了六行。而证据就在同一份文件里：另一行 BSNINVMT2608311 原样打印了它的 poRef（SMALL LABEL-BSN 0821），因为恰好没有采购单与之匹配。两行，两套规则，同一张纸。现在打印的是 poRef 本身，与构建器显示的完全一致。双语描述词典并未被丢弃 — 它是有人维护的主数据 — 但从「替换」降级为「附加」，且只附加其中文部分，因为英文部分正是用来匹配的、本就已包含在 ref 之中：SMALL LABEL-BSN 0821 变为 SMALL LABEL-BSN 0821 · 小标签，而 ASCENDO-BSN-SNI-1308 保持原样。需要知道：已生成的付款申请单把说明保存在自身的行数据中，因此旧文件仍会打印旧文字。这是有意为之 — 改变一份已签发文件的打印内容，比保留它更危险。仍处于「已生成」且尚未发送的付款申请单，建议删除后重建。",
};
