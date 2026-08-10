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

export const VERSION = 'v15.3';
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
      id: 'Harga label BERHENTI DIKARANG PORTAL, dan sekarang diingat. Sejak layar ini ada, harga tiap baris PO label adalah `r.unitPrice || 1000` dengan komentar `// demo price` yang tidak pernah dicabut. `unitPrice` tidak pernah diisi oleh apa pun — grep seluruh src hanya menemukannya di baris itu sendiri — jadi SETIAP PO label yang pernah keluar dari portal berharga Rp 1.000/pcs, dan totalnya karangan. Dua PO sudah terlanjur lahir begitu: TN-WL-PT-0801 senilai Rp 4.300.000 yang sudah berstatus Approved, dan ARISUN-ST-0810 senilai Rp 2.000.000. Keduanya belum punya invoice, jadi belum ada uang yang berjalan lawan angka bohong — tapi PDF-nya sudah bisa dikirim ke pemasok sebagai penawaran. SEKARANG HARGANYA DIKETIK, di kolom HARGA baru di Preview & Assign, dengan kolom JUMLAH dan SUBTOTAL yang ikut hidup di sebelahnya. TIDAK ADA ANGKA CADANGAN: baris tanpa harga MENAHAN Generate PO alih-alih dikarang jadi nol atau seribu, dan subtotal yang salah satu barisnya kosong bernilai null — bukan jumlah dari yang ada. Menjumlahkan yang ada dan diam soal yang kosong menghasilkan angka yang kelihatan benar dan kurang, bentuk kesalahan paling mahal karena tidak ada yang curiga padanya. HARGANYA DIINGAT PER (KODE ERP, PEMASOK) di tabel baru label_prices, lalu mengisi sendiri kali berikutnya, dan kalau yang diketik berbeda dari yang diingat barisnya menyela dengan harga lama, harga baru, dan persentasenya — tapi tidak pernah menolak, karena harga label memang naik dan yang mengetik tahu hasil negonya. Kuncinya (ERP, pemasok) dan BUKAN satu kolom di items: harga label ditentukan tukang cetaknya, dan kalau harga ditempel ke item maka setiap ganti pemasok memicu peringatan palsu — peringatan yang selalu berbunyi sama saja dengan tidak ada peringatan. SATU HITUNGAN UNTUK SEMUA: sel tabel, subtotal, tombol, dan penulis PO semuanya membaca ringkasHarga() yang sama, karena dua salinan aturan uang adalah dua salinan yang suatu hari beda pendapat dan yang kalah adalah angka yang sudah tercetak. genPO() menghitung ULANG dari state, bukan dari subtotal yang dibekukan saat jendela dibuka, dan menolak kalau centangnya berubah di belakang jendela. PPN DI PDF BERHENTI BERBOHONG: PO KEK dulu mencetak "PPN 11%: 0" — nol di bawah label tarif 11% terbaca sebagai PPN senilai nol, bukan PPN yang tidak dipungut. Sekarang berbunyi "Ditangguhkan (KEK)", kata yang sama dengan yang sudah dipakai layar portal sejak awal. Butuh supabase_label_prices.sql; tanpa berkas itu kolom HARGA tetap jalan dan PO tetap benar, cuma tidak mengisi sendiri. Aturan harganya diuji 33 kasus memakai angka asli PO ARISUN-ST-0810 — termasuk 0, negatif, dan NaN yang harus dibaca sebagai belum ada harga, bukan gratis.',
      en: 'Label prices STOP BEING INVENTED BY THE PORTAL, and are now remembered. For as long as this screen has existed, every label PO line was priced `r.unitPrice || 1000` under a `// demo price` comment that was never removed. Nothing ever set `unitPrice` — grepping the whole of src finds it only on that line — so EVERY label PO the portal has ever produced was Rp 1,000/pc with a fabricated total. Two already exist: TN-WL-PT-0801 at Rp 4,300,000, already Approved, and ARISUN-ST-0810 at Rp 2,000,000. Neither has an invoice yet, so no money has moved against a false figure — but the PDF was already sendable to a supplier as an offer. PRICES ARE NOW TYPED, in a new PRICE column in Preview & Assign, with live AMOUNT and SUBTOTAL beside it. THERE IS NO FALLBACK NUMBER: a row without a price HOLDS BACK Generate PO instead of being invented as zero or a thousand, and a subtotal with any empty row is null rather than the sum of what happens to be filled in. Summing what is there and staying quiet about what is missing produces a number that looks right and is short — the most expensive kind of error, because nobody suspects it. PRICES ARE REMEMBERED PER (ERP CODE, SUPPLIER) in a new label_prices table, prefill the column next time, and when a typed price differs from the remembered one the row interrupts with the old price, the new price and the percentage — but never refuses, because label prices do go up and the person typing knows how the negotiation went. Keyed on (ERP, supplier) and NOT a column on items: a label\'s price is set by its printer, and pinning it to the item would fire a false warning on every supplier change — a warning that always sounds is the same as no warning. ONE CALCULATION FOR ALL OF IT: table cells, subtotal, button and the PO writer all read the same ringkasHarga(), because two copies of a money rule are two copies that will one day disagree, and the loser is the figure already printed. genPO() recomputes from state rather than trusting the subtotal frozen when the dialog opened, and refuses if the tick boxes changed behind it. THE PDF\'s PPN LINE STOPS LYING: a KEK PO used to print "PPN 11%: 0" — a zero under an 11% rate label reads as VAT worth nothing, not VAT that is not levied. It now reads "Ditangguhkan (KEK)", the same words the portal screen has always used. Requires supabase_label_prices.sql; without it the PRICE column still works and POs are still correct, it just does not prefill. The pricing rule is tested across 33 cases using the real figures from PO ARISUN-ST-0810 — including 0, negative and NaN, which must read as no-price-yet rather than free.',
      zh: '标签单价不再由门户凭空生成，并且现在会被记住。自本页面存在以来，标签采购单每一行的单价都是 `r.unitPrice || 1000`，上面挂着一句从未删除的 `// demo price` 注释。从来没有任何地方给 `unitPrice` 赋过值——在整个 src 中检索只能在那一行找到它——因此门户开出的每一张标签采购单单价都是 Rp 1.000/张，总额是编造的。已经产生了两张：TN-WL-PT-0801 金额 Rp 4.300.000，已批准；ARISUN-ST-0810 金额 Rp 2.000.000。两者都还没有发票，因此还没有资金依据虚假金额流动——但 PDF 已经可以作为报价发给供应商。现在单价需要手工填写，在 Preview & Assign 新增的单价列中填写，旁边是实时的金额列与小计。没有任何兜底数字：未填单价的行会阻止生成采购单，而不是被编造成零或一千；只要有一行为空，小计即为 null，而不是已填部分之和。把已有的加起来、对缺失的保持沉默，会得出一个看起来正确却偏少的数字——这是最昂贵的一类错误，因为没有人会怀疑它。单价按（ERP 编码，供应商）记忆，存放在新表 label_prices 中，下次自动填入；当填写的价格与记住的不同时，该行会提示旧价、新价与百分比——但绝不阻止，因为标签价格确实会上涨，而填写的人才知道谈判结果。以（ERP，供应商）为键而不是在 items 上加一列：标签的价格由印刷厂决定，若把价格绑在物料上，每次更换供应商都会触发虚假警告——总是响的警告等于没有警告。所有金额出自同一处计算：表格单元、小计、按钮以及采购单写入方都读取同一个 ringkasHarga()，因为一条金额规则的两份副本终有一天会各执一词，而输的那一方是已经印出去的数字。genPO() 会从状态重新计算，而不是信任对话框打开时冻结的小计，并在其背后勾选发生变化时拒绝继续。PDF 上的增值税行不再说谎：KEK 采购单此前打印 “PPN 11%: 0”——11% 税率标签下的零读起来像是税额为零，而不是不予征收。现在写作 “Ditangguhkan (KEK)”，与门户页面一直使用的措辞一致。需要 supabase_label_prices.sql；没有它，单价列照常工作、采购单依然正确，只是不会自动填入。定价规则已用 PO ARISUN-ST-0810 的真实数字覆盖 33 个用例测试——包括 0、负数和 NaN，它们必须被读作尚未定价，而不是免费。',
};
