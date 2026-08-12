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

export const VERSION = 'v15.8';
export const VERSION_DATE = '12 Agu 2026';

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
      id: 'KOTAK JUMLAH BERHENTI MERUSAK ANGKA INDONESIA — SURAT JALAN DAN LABEL STOCK. Lanjutan v15.7. Review lebar rilis itu menemukan dua kotak lagi yang masih memakai pola yang dilarang repo ini, dan dua-duanya menggerakkan angka yang berujung ke uang. SURAT JALAN: jumlah terkirim dibaca Number(e.target.value) || 0, jadi "1.200" bernilai 1,2 dan "1,200" bernilai NaN lalu jatuh ke NOL. Angka itu menulis qtyShipped dan received, jadi ia menggerakkan PO Outstanding DAN kas label: "1.200 lembar terkirim" yang tercatat 1 membuat PO-nya terus terbaca kurang kirim dan menawarkan pengiriman ulang, sementara yang tercatat 0 karena koma tidak mengubah apa pun dan tidak mengeluh. Sekarang dibaca aturan Indonesia, dibulatkan per lembar, tidak pernah negatif, dan tetap dijepit ke sisa yang benar-benar ada. LABEL STOCK: kotak Pesan di BUY NOW dan di DO NOT BUY memakai input type="number", dan atribut itu memaksa pembacaan en-US di tingkat DOM sebelum kode sempat berpendapat — "12.500" jadi 12,5. Lebih buruk untuk koma: type="number" menolaknya sehingga nilai DOM menjadi string kosong, cabang v !== \'\' gagal, dan qtyPesan diam-diam jatuh ke ANGKA SARAN PORTAL sementara kotaknya masih MENAMPILKAN angka yang diketik sona. Layar satu angka, label request angka lain, dan yang tidak terlihat yang menang — bentuk yang sama persis dengan nominal invoice v15.7 dan harga label v15.3. Angka ini dikalikan harga label jadi nominal PO. type="number" dibuang di kedua kotaknya dan pembacaannya pindah ke aturan Indonesia. KEDUA LAYAR SEKARANG MEMANTULKAN BALIK. onBlur menormalkan nilainya ke dalam state dan menulis bentuk kanoniknya kembali ke kotak, jadi angka yang terbaca di layar adalah angka yang akan dikirim. Sebelumnya Label Stock menyimpan teks mentah hasil ketikan dan baru menerjemahkannya saat dikirim — layar dan angka kirim bisa berbeda sampai detik terakhir. Ditulis langsung ke node tanpa setUI dan tanpa toast: keduanya memicu render ulang di microtask yang menguras antara mousedown dan click, dan tombol Kirim akan kehilangan kliknya tanpa suara. SATU CACAT DALAM PERBAIKAN INI DITANGKAP SEBELUM DIKIRIM: percobaan pertama menggambar kotak Label Stock dengan qtyInputText() begitu saja, padahal ui.lsQty menyimpan STRING mentah dan fungsi itu mengembalikan kosong untuk apa pun yang bukan angka — setiap kotak yang sudah pernah diketik akan lahir KOSONG pada gambar ulang berikutnya dan angka pesanan sona lenyap dari layar tanpa suara. Sekarang bentuk kanoniknya digambar kalau bisa dibaca, dan teks aslinya kalau tidak, supaya yang tidak terbaca tetap kelihatan dan bisa dibetulkan. DIUJI 88 assertion di test-nominal-mata-uang.mjs, 16 di antaranya baru untuk rilis ini dan ditulis dari string yang persis memicu kedua bug. Yang TIDAK bisa dilihat assertion mana pun: penjepitan ke sisa outstanding, pembulatan, dan pantulan ke node — ketiganya tinggal di dalam berkas layar yang tidak bisa di-import dari Node tanpa build step, dan portal ini memang tanpa build step. Itu harus dilihat mata di layar.',
      en: 'QUANTITY BOXES STOP DESTROYING INDONESIAN NUMBERS — SURAT JALAN AND LABEL STOCK. A follow-on to v15.7, whose wide review found two more boxes still using the pattern this repo bans, both driving figures that end in money. SURAT JALAN: the shipped quantity was read with Number(e.target.value) || 0, so "1.200" became 1.2 and "1,200" became NaN and then ZERO. That figure writes qtyShipped and received, so it drives PO Outstanding AND the label balance: a shipment of 1,200 recorded as 1 leaves the PO reading under-delivered and offering to ship again, while one recorded as 0 changes nothing and never complains. It is now read the Indonesian way, rounded per sheet, never negative, still clamped to what actually remains. LABEL STOCK: the order-quantity boxes on BUY NOW and DO NOT BUY used input type="number", which forces en-US parsing at the DOM level before any code gets an opinion — "12.500" became 12.5. Worse for a comma: type="number" rejects it, so the DOM value became an empty string, the v !== \'\' branch failed, and qtyPesan silently fell back to the PORTAL SUGGESTION while the box still DISPLAYED what sona had typed. One number on screen, another in the label request, and the invisible one won — the same shape as the v15.7 invoice amount and the v15.3 label price. That quantity is multiplied by the label price to become a PO value. BOTH SCREENS NOW ECHO BACK: onBlur normalises the value into state and writes the canonical form back into the box, so what is on screen is what will be sent. One defect in this fix was caught before shipping: the first attempt drew the Label Stock boxes with qtyInputText() directly, but ui.lsQty holds the raw typed STRING and that function returns empty for anything that is not a number — every box already typed into would have been born EMPTY on the next repaint, and sona\'s order quantity would have vanished from the screen without a sound. TESTED with 88 assertions, 16 new for this release, written from the exact strings that trigger both bugs. What no assertion here can see: the clamping, the rounding and the echo to the node all live inside screen files that cannot be imported from Node without a build step, and this portal has none. Those need eyes on the screen.',
      zh: '数量输入框不再破坏印尼数字 — 送货单与标签库存。这是 v15.7 的后续：该版本的大范围评审又发现两个仍在使用本仓库明令禁止模式的输入框，且两者驱动的数字最终都会变成金额。送货单：已发数量使用 Number(e.target.value) || 0 读取，因此 "1.200" 变成 1.2，"1,200" 变成 NaN 进而变成零。该数字写入 qtyShipped 与 received，因此同时驱动未结采购单与标签额度：1,200 张被记成 1，会让采购单一直显示发货不足并提示再次发货；被记成 0 则什么也不改变，也不会报错。现在按印尼规则读取、按张取整、不为负，并仍然被钳制到真实剩余量。标签库存：BUY NOW 与 DO NOT BUY 的订购数量框使用 input type="number"，该属性在 DOM 层面强制按 en-US 解析，代码尚未表态就已生效 — "12.500" 变成 12.5。逗号的情况更糟：type="number" 拒绝它，DOM 值变为空字符串，v !== \'\' 分支失败，qtyPesan 悄悄回退到门户建议数量，而输入框仍显示 sona 输入的数字。屏幕一个数、标签申请另一个数，看不见的那个获胜 — 与 v15.7 的发票金额、v15.3 的标签价格形态完全相同。该数量会乘以标签单价成为采购单金额。两个页面现在都会回写：onBlur 将数值规范化写入状态，并把规范形式写回输入框，屏幕所见即将发送之值。本修复中有一处缺陷在发布前被抓住：初版直接用 qtyInputText() 绘制标签库存输入框，但 ui.lsQty 保存的是原始输入字符串，而该函数对非数字返回空 — 任何已输入过的框都会在下次重绘时变为空白，sona 的订购数量将无声消失。共 88 项断言，其中 16 项为本次新增，取自触发这两个缺陷的确切字符串。任何断言都无法覆盖的部分：钳制、取整与回写节点都位于页面文件中，而页面文件无法在没有构建步骤的情况下从 Node 导入，本门户正是无构建步骤。这些必须用眼睛在界面上验证。',
};
