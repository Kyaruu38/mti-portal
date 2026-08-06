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

export const VERSION = 'v14.5';
export const VERSION_DATE = '6 Agu 2026';

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
      id: 'Layar Stok Label sekarang ikut membaca DAFTAR BELI yang selama ini terlewat. Berkas bulanan sona berisi tiga hal, bukan dua: stok, rencana, dan sheet order (local / export / newitems / 加急优先下单) — yang ketiga tidak pernah dibaca, lalu disusun ulang dengan tangan di layar lain. Sheet order dikenali dari HEADER-nya, bukan namanya, karena nama sheet berubah tiap bulan sementara kolomnya tidak; diuji ke berkas Agustus, 4 sheet order lolos dan 10 sheet produksi ditolak, termasuk 排产计划 yang punya kolom 市场 dan tetap ditolak karena tidak punya ERP CODE. Tab BUY NOW jadi satu daftar gabungan: yang diminta di file DAN yang menurut hitungan portal kurang, barang yang muncul di dua-duanya jadi satu baris. Ada penyaring cari / market / brand / kategori / status. Yang paling penting, tiap baris diadu dengan stok dan diberi salah satu dari tiga tanda. ⛔ STOP untuk yang diminta padahal stoknya OVERSTOCK atau IDLE — di berkas Agustus ada 8, yang terparah minta 1.000 lembar untuk barang berstok 5.185 dengan kebutuhan 40, yaitu 130 kali kebutuhannya. Barisnya TIDAK dihapus dan TIDAK dikunci: jumlahnya dimulai dari nol dan "Pilih semua" melewatinya, jadi yang mau membelinya harus mencentang sendiri dan portal mencatat siapa. ⚠ TAK BISA DICEK untuk yang spec-nya belum ada di tracker — 115 dari 129 baris. Angka ini ditampilkan sebesar yang lain, justru supaya diam tidak dibaca sebagai lampu hijau. Pencocokan lewat kode ERP dulu, nama spec cuma cadangan, dan berapa baris yang terpaksa lewat nama ikut ditulis. Portal juga menolak menebak tiga hal yang ditemukan di berkas Agustus: satu kode ERP yang dipakai untuk dua spec berbeda (R14 dan R15 — salah satunya pasti salah ketik, dan kode ERP-lah yang menentukan barang apa yang dicetak), satu barang yang market-nya berbeda antar sheet setelah nama tujuan Tionghoa disamakan, dan nama tujuan di luar daftar yang sudah terbukti. Ketiganya ditandai, bukan diputuskan. Nama tujuan Tionghoa disamakan otomatis — 巴西/南美→BX, 美国/北美→PT, 亚/印尼→SNI — diuji ke 124 baris yang kode ERP-nya sama persis di dua sheet, cocok 100% tanpa satu pun pengecualian, dan hasilnya ditampilkan sebagai "PT ← 美国" supaya orangnya bisa melihat portal membacanya, bukan cuma mempercayainya. Mengirim dari BUY NOW sekarang memecah jadi satu permintaan PER KATEGORI, kategorinya ikut dari sheet asalnya, dan peringatan overstock ikut tersimpan sampai ke layar cania/visca — peringatan yang berhenti di layar orang pertama tidak menolong orang kedua, dan orang keduanyalah yang menerbitkan PO. Layar Label Request sekarang menunjukkan DUA jalan masuk di depan, karena jalur BUY NOW sudah lama ada tapi hidup di layar lain dan orang tidak pernah menemukannya. Daftar permintaan dapat kolom Sumber dan kolom Catatan portal. Jumlah di sheet yang sama TIDAK dijumlahkan diam-diam: menjumlah seluruh sheet berkas Agustus menghasilkan 784.880 lembar dari yang seharusnya 264.860.',
      en: 'The Label Stock screen now also reads the BUY LIST it had been skipping. Sona\'s monthly workbook holds three things, not two: stock, plans, and the order sheets (local / export / newitems / 加急优先下单) — the third was never read, then retyped by hand on another screen. Order sheets are recognised by their HEADER, not their name, because sheet names change every month while the columns do not; tested against the August file, 4 order sheets passed and 10 production sheets were refused, including 排产计划 which has a 市场 column and is still refused for having no ERP CODE. The BUY NOW tab is now one merged list: what the file requests AND what the portal\'s own figures say is short, with anything appearing in both shown as a single row. Filters for search / market / brand / category / status. Most importantly, every row is checked against stock and given one of three marks. ⛔ STOP for rows requested while stock is OVERSTOCK or IDLE — 8 in the August file, the worst asking for 1,000 sheets of an item holding 5,185 against a requirement of 40, which is 130x the requirement. The rows are NOT deleted and NOT locked: the quantity starts at zero and "Select all" skips them, so buying one takes a deliberate tick and the portal records who made it. ⚠ CANNOT CHECK for rows whose spec is not in the tracker yet — 115 of 129. That number is displayed as prominently as the others, precisely so the silence is not read as a green light. Matching goes through the ERP code first and the spec name only as a fallback, and how many rows had to fall back is stated on screen. The portal also refuses to guess about three things found in the August file: one ERP code used for two different specs (R14 and R15 — one must be a typo, and the ERP code is what decides what actually gets printed), one item whose market differs between sheets even after the Chinese destination names are normalised, and any destination name outside the proven list. All three are flagged, not decided. Chinese destination names are normalised automatically — 巴西/南美→BX, 美国/北美→PT, 亚/印尼→SNI — verified against the 124 rows whose ERP codes appear identically in two sheets, 100% consistent with no exceptions, and the result is shown as "PT ← 美国" so a person can see the portal reading it rather than merely trust it. Sending from BUY NOW now splits into one request PER CATEGORY, the category carried from the originating sheet, and the overstock warnings travel with it all the way to cania and visca — a warning that stops at the first person\'s screen does not help the second, and it is the second who raises the PO. The Label Request screen now shows BOTH entry points up front, because the BUY NOW route has existed for a while but lived on another screen and nobody found it. The request lists gain a Source column and a Portal notes column. Quantities across sheets are NOT silently summed: summing every sheet of the August file yields 784,880 sheets against a true 264,860.',
      zh: '标签库存页面现在也会读取此前一直被跳过的采购清单。Sona 的月度工作簿包含三样东西而非两样：库存、计划，以及订单工作表（local / export / newitems / 加急优先下单）— 第三样从未被读取，而是在另一个页面手工重新录入。订单工作表按表头识别，而非按名称，因为工作表名称每月都变而列不变；以八月文件测试，4 个订单工作表通过，10 个生产工作表被拒绝，其中包括含有 市场 列却因没有 ERP CODE 而仍被拒绝的 排产计划。需采购标签页现在是一份合并清单：文件中申请的，以及门户自身计算出短缺的，两者都出现的合并为一行。提供搜索 / 市场 / 品牌 / 类别 / 状态筛选。最重要的是，每一行都会与库存核对并标记三种状态之一。⛔ 停止 用于库存已过剩或呆滞却仍被申请的行 — 八月文件中有 8 行，最严重的一行申请 1,000 张，而该产品库存 5,185、需求仅 40，即需求量的 130 倍。这些行不会被删除也不会被锁定：数量从零开始，"全选"会跳过它们，因此购买需要主动勾选，且门户会记录决定人。⚠ 无法核对 用于规格尚未出现在跟踪表中的行 — 129 行中有 115 行。该数字与其他数字同样醒目地展示，正是为了避免把沉默当成放行。匹配优先使用 ERP 编码，规格名称仅作后备，并在界面上写明有多少行不得不使用后备方式。门户还拒绝对八月文件中发现的三件事作出推测：一个 ERP 编码被用于两个不同规格（R14 与 R15 — 必有一个是笔误，而 ERP 编码才决定实际印刷的产品）、一个产品在中文目的地名称统一之后市场仍在各工作表间不一致、以及任何不在已验证清单内的目的地名称。三者都被标记，而非替用户决定。中文目的地名称自动统一 — 巴西/南美→BX，美国/北美→PT，亚/印尼→SNI — 已对 124 行在两个工作表中 ERP 编码完全相同的数据验证，100% 一致、无一例外，并以 "PT ← 美国" 的形式显示，使人能看见门户的解读，而不仅仅是信任它。从需采购发送现在会按类别拆分为多份申请，类别沿用来源工作表，且库存过剩提示会一路传递到 cania 与 visca 的界面 — 停留在第一个人屏幕上的提示帮不了第二个人，而开立采购单的正是第二个人。标签申请页面现在在最前面展示两个入口，因为需采购这条路径早已存在，却位于另一个页面而无人发现。申请列表新增来源列与门户提示列。跨工作表的数量不会被静默相加：将八月文件的所有工作表相加会得到 784,880 张，而实际应为 264,860 张。',
};
