// RIWAYAT RILIS LENGKAP.
//
// SENGAJA TIDAK DIIMPOR OLEH SIAPA PUN saat boot. Isinya 40 KB teks tiga bahasa,
// dan satu-satunya yang pernah ditampilkan adalah entri teratas — yang sudah
// disalin ke version.js sebagai LATEST. Mengimpor berkas ini dari mana pun akan
// mengembalikan 40 KB itu ke dalam unduhan pertama setiap orang.
//
// Ini catatan, bukan kode mati. Jangan dihapus: dia satu-satunya tempat yang
// menjawab "perubahan ini masuk di rilis mana".

export const CHANGELOG = [
  {
    v: 'v14.6', date: '7 Agu 2026',
    what: {
      id: 'Setiap klik di layar yang tabelnya panjang berhenti terasa berat. core/dom.js mount() tidak membandingkan apa pun: setiap perubahan membuang seluruh isi layar lalu membangunnya lagi dari nol — jadi ongkos SETIAP tombol sebanding dengan jumlah baris yang sedang tampil, bukan dengan besarnya perubahan. Diukur di Stok Label dengan 974 SKU asli: 400 baris tampil = 5.311 elemen = 291 ms per klik; 0 baris = 75 elemen = 30 ms. Garis lurus — tabelnya adalah SELURUH ongkosnya, dan lima kartu angka, tiga kotak unggah, enam tab, serta semua spanduk peringatan digabung cuma 30 ms. Batas 400 yang lama dipilih supaya "hampir semua muat"; yang benar-benar terjadi adalah hampir tidak ada yang menggulir sejauh itu sementara semua orang membayar ongkosnya di setiap klik, sepanjang hari. Sekarang sepuluh baris adalah bawaannya, dengan pilihan 10 / 20 / 50 / 100 / Semua dan tombol pindah halaman di kaki tiap tabel. Diukur ulang di data yang sama: klik tombol cara unggah 336 ms → 30 ms, ganti bahasa 265 ms → 34 ms. Sebelas kali lebih ringan. Ongkos besar tetap tersedia lewat "Semua" — tapi jadi keputusan orangnya, bukan pajak yang ditagihkan diam-diam ke semua orang. Dipasang di Stok Label (tabel stok dan daftar beli punya halaman sendiri-sendiri), Invoice Masuk, Progress PRF, dan Register PPKEK. Progress PRF juga berhenti memotong diam-diam di 25: PRF ke-26 dulu tidak ada di layar dan tidak ada satu pun tulisan yang menyebutkannya. Sekarang seluruhnya ada, dibuka per halaman, dan jumlah aslinya tertulis di kaki tabel. Tombol "Download semua · ZIP" dan hitungan centang "sudah diterima" tetap memakai SELURUH PRF, bukan halaman yang kebetulan sedang tampil — kalau tidak, isi ZIP-nya berubah-ubah tergantung halaman berapa yang dibuka, tanpa satu pun tanda di layar yang menjelaskan kenapa. Mengganti jumlah baris atau mengetik di kotak cari selalu kembali ke halaman 1: tanpa itu, orang di halaman 40 yang menyaring hasilnya menjadi tiga baris akan mendarat di halaman kosong dan menyimpulkan datanya hilang.',
      en: 'Every click on a screen with a long table stops feeling heavy. core/dom.js mount() compares nothing: every change throws away the entire screen and rebuilds it from scratch — so the cost of EVERY button is proportional to how many rows are currently on screen, not to the size of the change. Measured on Label Stock with the real 974 SKUs: 400 rows shown = 5,311 elements = 291 ms per click; 0 rows = 75 elements = 30 ms. A straight line — the table is the entire cost, and five stat cards, three drop zones, six tabs and every warning banner together come to just 30 ms. The old 400 cap was chosen so that "almost everything fits"; what actually happened is that almost nobody scrolled that far while everybody paid for it on every click, all day. Ten rows is now the default, with a 10 / 20 / 50 / 100 / All picker and page controls in every table\'s footer. Re-measured on the same data: the upload-mode button went 336 ms → 30 ms, switching language 265 ms → 34 ms. Eleven times lighter. The expensive option is still there under "All" — but as the person\'s own decision, not a tax quietly levied on everyone. Applied to Label Stock (the stock table and the buy list keep separate pages), Incoming Invoices, PRF Progress, and the PPKEK register. PRF Progress also stops truncating silently at 25: the 26th PRF simply was not on screen and nothing said so. All of them are there now, paged, with the real count in the footer. The "Download all · ZIP" button and the "mark as received" tick count still use EVERY PRF, not whichever page happens to be open — otherwise the ZIP\'s contents would change depending on the page, with nothing on screen explaining why. Changing the row count or typing in the search box always returns to page 1: without that, someone on page 40 who filters down to three rows lands on an empty page and concludes the data is gone.',
      zh: '在表格较长的页面上，每次点击都不再卡顿。core/dom.js 的 mount() 不做任何比较：每次变更都会清空整个页面并从零重建 — 因此每个按钮的开销取决于当前显示的行数，而非变更本身的大小。在标签库存页面用真实的 974 个 SKU 实测：显示 400 行 = 5,311 个元素 = 每次点击 291 毫秒；显示 0 行 = 75 个元素 = 30 毫秒。呈直线关系 — 表格就是全部开销，而五张数字卡片、三个上传区、六个标签页以及所有警告横幅加起来仅 30 毫秒。此前 400 行的上限是为了让"几乎全部都能显示"；实际发生的却是几乎没人滚动到那么远，而所有人却要为此在每次点击时付出代价，全天如此。现在默认显示十行，并提供 10 / 20 / 50 / 100 / 全部 选择器，每个表格底部都有翻页控件。在同一批数据上重测：上传方式按钮 336 毫秒 → 30 毫秒，切换语言 265 毫秒 → 34 毫秒。轻了十一倍。高开销选项仍保留在"全部"中 — 但这是使用者自己的选择，而不是悄悄向所有人征收的税。已应用于标签库存（库存表与采购清单各自独立分页）、进项发票、付款申请单进度以及 PPKEK 登记表。付款申请单进度也不再在第 25 条静默截断：此前第 26 张付款申请单根本不在页面上，且没有任何提示。现在全部都在，分页显示，底部标明真实数量。"全部下载 · ZIP"按钮与"标记已收到"的勾选计数仍基于全部付款申请单，而非恰好打开的那一页 — 否则 ZIP 的内容会随页码变化，而页面上没有任何说明。更改每页行数或在搜索框输入时总会回到第 1 页：否则位于第 40 页的人筛选出三行结果后会落在空白页，从而以为数据丢失了。',
    },
  },
  {
    v: 'v14.5', date: '6 Agu 2026',
    what: {
      id: 'Layar Stok Label sekarang ikut membaca DAFTAR BELI yang selama ini terlewat. Berkas bulanan sona berisi tiga hal, bukan dua: stok, rencana, dan sheet order (local / export / newitems / 加急优先下单) — yang ketiga tidak pernah dibaca, lalu disusun ulang dengan tangan di layar lain. Sheet order dikenali dari HEADER-nya, bukan namanya, karena nama sheet berubah tiap bulan sementara kolomnya tidak; diuji ke berkas Agustus, 4 sheet order lolos dan 10 sheet produksi ditolak, termasuk 排产计划 yang punya kolom 市场 dan tetap ditolak karena tidak punya ERP CODE. Tab BUY NOW jadi satu daftar gabungan: yang diminta di file DAN yang menurut hitungan portal kurang, barang yang muncul di dua-duanya jadi satu baris. Ada penyaring cari / market / brand / kategori / status. Yang paling penting, tiap baris diadu dengan stok dan diberi salah satu dari tiga tanda. ⛔ STOP untuk yang diminta padahal stoknya OVERSTOCK atau IDLE — di berkas Agustus ada 8, yang terparah minta 1.000 lembar untuk barang berstok 5.185 dengan kebutuhan 40, yaitu 130 kali kebutuhannya. Barisnya TIDAK dihapus dan TIDAK dikunci: jumlahnya dimulai dari nol dan "Pilih semua" melewatinya, jadi yang mau membelinya harus mencentang sendiri dan portal mencatat siapa. ⚠ TAK BISA DICEK untuk yang spec-nya belum ada di tracker — 115 dari 129 baris. Angka ini ditampilkan sebesar yang lain, justru supaya diam tidak dibaca sebagai lampu hijau. Pencocokan lewat kode ERP dulu, nama spec cuma cadangan, dan berapa baris yang terpaksa lewat nama ikut ditulis. Portal juga menolak menebak tiga hal yang ditemukan di berkas Agustus: satu kode ERP yang dipakai untuk dua spec berbeda (R14 dan R15 — salah satunya pasti salah ketik, dan kode ERP-lah yang menentukan barang apa yang dicetak), satu barang yang market-nya berbeda antar sheet setelah nama tujuan Tionghoa disamakan, dan nama tujuan di luar daftar yang sudah terbukti. Ketiganya ditandai, bukan diputuskan. Nama tujuan Tionghoa disamakan otomatis — 巴西/南美→BX, 美国/北美→PT, 亚/印尼→SNI — diuji ke 124 baris yang kode ERP-nya sama persis di dua sheet, cocok 100% tanpa satu pun pengecualian, dan hasilnya ditampilkan sebagai "PT ← 美国" supaya orangnya bisa melihat portal membacanya, bukan cuma mempercayainya. Mengirim dari BUY NOW sekarang memecah jadi satu permintaan PER KATEGORI, kategorinya ikut dari sheet asalnya, dan peringatan overstock ikut tersimpan sampai ke layar cania/visca — peringatan yang berhenti di layar orang pertama tidak menolong orang kedua, dan orang keduanyalah yang menerbitkan PO. Layar Label Request sekarang menunjukkan DUA jalan masuk di depan, karena jalur BUY NOW sudah lama ada tapi hidup di layar lain dan orang tidak pernah menemukannya. Daftar permintaan dapat kolom Sumber dan kolom Catatan portal. Jumlah di sheet yang sama TIDAK dijumlahkan diam-diam: menjumlah seluruh sheet berkas Agustus menghasilkan 784.880 lembar dari yang seharusnya 264.860.',
      en: 'The Label Stock screen now also reads the BUY LIST it had been skipping. Sona\'s monthly workbook holds three things, not two: stock, plans, and the order sheets (local / export / newitems / 加急优先下单) — the third was never read, then retyped by hand on another screen. Order sheets are recognised by their HEADER, not their name, because sheet names change every month while the columns do not; tested against the August file, 4 order sheets passed and 10 production sheets were refused, including 排产计划 which has a 市场 column and is still refused for having no ERP CODE. The BUY NOW tab is now one merged list: what the file requests AND what the portal\'s own figures say is short, with anything appearing in both shown as a single row. Filters for search / market / brand / category / status. Most importantly, every row is checked against stock and given one of three marks. ⛔ STOP for rows requested while stock is OVERSTOCK or IDLE — 8 in the August file, the worst asking for 1,000 sheets of an item holding 5,185 against a requirement of 40, which is 130x the requirement. The rows are NOT deleted and NOT locked: the quantity starts at zero and "Select all" skips them, so buying one takes a deliberate tick and the portal records who made it. ⚠ CANNOT CHECK for rows whose spec is not in the tracker yet — 115 of 129. That number is displayed as prominently as the others, precisely so the silence is not read as a green light. Matching goes through the ERP code first and the spec name only as a fallback, and how many rows had to fall back is stated on screen. The portal also refuses to guess about three things found in the August file: one ERP code used for two different specs (R14 and R15 — one must be a typo, and the ERP code is what decides what actually gets printed), one item whose market differs between sheets even after the Chinese destination names are normalised, and any destination name outside the proven list. All three are flagged, not decided. Chinese destination names are normalised automatically — 巴西/南美→BX, 美国/北美→PT, 亚/印尼→SNI — verified against the 124 rows whose ERP codes appear identically in two sheets, 100% consistent with no exceptions, and the result is shown as "PT ← 美国" so a person can see the portal reading it rather than merely trust it. Sending from BUY NOW now splits into one request PER CATEGORY, the category carried from the originating sheet, and the overstock warnings travel with it all the way to cania and visca — a warning that stops at the first person\'s screen does not help the second, and it is the second who raises the PO. The Label Request screen now shows BOTH entry points up front, because the BUY NOW route has existed for a while but lived on another screen and nobody found it. The request lists gain a Source column and a Portal notes column. Quantities across sheets are NOT silently summed: summing every sheet of the August file yields 784,880 sheets against a true 264,860.',
      zh: '标签库存页面现在也会读取此前一直被跳过的采购清单。Sona 的月度工作簿包含三样东西而非两样：库存、计划，以及订单工作表（local / export / newitems / 加急优先下单）— 第三样从未被读取，而是在另一个页面手工重新录入。订单工作表按表头识别，而非按名称，因为工作表名称每月都变而列不变；以八月文件测试，4 个订单工作表通过，10 个生产工作表被拒绝，其中包括含有 市场 列却因没有 ERP CODE 而仍被拒绝的 排产计划。需采购标签页现在是一份合并清单：文件中申请的，以及门户自身计算出短缺的，两者都出现的合并为一行。提供搜索 / 市场 / 品牌 / 类别 / 状态筛选。最重要的是，每一行都会与库存核对并标记三种状态之一。⛔ 停止 用于库存已过剩或呆滞却仍被申请的行 — 八月文件中有 8 行，最严重的一行申请 1,000 张，而该产品库存 5,185、需求仅 40，即需求量的 130 倍。这些行不会被删除也不会被锁定：数量从零开始，"全选"会跳过它们，因此购买需要主动勾选，且门户会记录决定人。⚠ 无法核对 用于规格尚未出现在跟踪表中的行 — 129 行中有 115 行。该数字与其他数字同样醒目地展示，正是为了避免把沉默当成放行。匹配优先使用 ERP 编码，规格名称仅作后备，并在界面上写明有多少行不得不使用后备方式。门户还拒绝对八月文件中发现的三件事作出推测：一个 ERP 编码被用于两个不同规格（R14 与 R15 — 必有一个是笔误，而 ERP 编码才决定实际印刷的产品）、一个产品在中文目的地名称统一之后市场仍在各工作表间不一致、以及任何不在已验证清单内的目的地名称。三者都被标记，而非替用户决定。中文目的地名称自动统一 — 巴西/南美→BX，美国/北美→PT，亚/印尼→SNI — 已对 124 行在两个工作表中 ERP 编码完全相同的数据验证，100% 一致、无一例外，并以 "PT ← 美国" 的形式显示，使人能看见门户的解读，而不仅仅是信任它。从需采购发送现在会按类别拆分为多份申请，类别沿用来源工作表，且库存过剩提示会一路传递到 cania 与 visca 的界面 — 停留在第一个人屏幕上的提示帮不了第二个人，而开立采购单的正是第二个人。标签申请页面现在在最前面展示两个入口，因为需采购这条路径早已存在，却位于另一个页面而无人发现。申请列表新增来源列与门户提示列。跨工作表的数量不会被静默相加：将八月文件的所有工作表相加会得到 784,880 张，而实际应为 264,860 张。',
    },
  },
  {
    v: 'v14.4', date: '6 Agu 2026',
    what: {
      id: 'Tiga hal. (1) Unggah stok label sekarang menerima SATU workbook yang berisi semuanya — stok, rencana produksi, rencana penjualan — bukan cuma tiga file terpisah. Sona kadang memang sudah menyatukannya, dan memaksanya memecah file yang sudah jadi adalah pekerjaan yang tidak menghasilkan apa-apa. Ada dua tombol di atas kotak unggah untuk memilih caranya; yang gabungan membaca workbook SEKALI lalu memakainya untuk semua jenis yang ada di dalamnya, dan melaporkan bagian mana yang KETEMU dan mana yang TIDAK — file kurang satu sheet terlihat persis sama dengan file lengkap kalau yang dilaporkan cuma keberhasilan. Dua cara unggah memakai satu jalur kode yang sama (terapkanKotak), supaya perbaikan di salah satunya tidak pernah gagal sampai ke yang lain. (2) Setiap kali portal diperbarui, muncul spanduk "versi baru tersedia" dengan tombol muat ulang. Portal mengambil ulang version.js sendiri — bukan berkas versi kedua yang suatu hari akan berbeda isinya — pada 30 detik pertama, lalu tiap 10 menit, lalu setiap kali tabnya kembali terlihat. Spanduknya menetap sampai dimuat ulang atau ditutup manual, dan ditutup PER NOMOR VERSI, jadi menutup pemberitahuan hari ini tidak membuat perbaikan minggu depan ikut diam. Gagal mengambil berkas selalu diam. (3) Tab Master Tracker / BUY NOW / DO NOT BUY akhirnya berbahasa Tionghoa juga; itu satu-satunya strip Inggris yang tersisa di layar yang selebihnya sudah diterjemahkan. Nama berkas di kotak 1 sengaja TIDAK diterjemahkan — yang dipegang orangnya memang bernama Label Inventory Tracker.xlsx.',
      en: 'Three things. (1) The label-stock upload now accepts ONE workbook containing everything — stock, production plan, sales plan — not only three separate files. Sona sometimes already merges them, and forcing her to split a finished file is work that produces nothing. Two buttons above the drop area pick the mode; the combined one reads the workbook ONCE and uses it for every kind inside it, then reports which parts were FOUND and which were NOT — a file missing one sheet looks exactly like a complete one when only successes are reported. Both modes run through one shared code path (terapkanKotak) so a fix to either can never fail to reach the other. (2) Whenever the portal is updated, a "new version available" banner appears with a reload button. The portal re-fetches version.js itself — not a second version file that would one day disagree with it — at 30 seconds, then every 10 minutes, then every time the tab becomes visible again. The banner persists until reloaded or dismissed, and it is dismissed PER VERSION NUMBER, so closing today\'s notice does not silence next week\'s fix. A failed fetch is always silent. (3) The Master Tracker / BUY NOW / DO NOT BUY tabs are finally in Chinese too; they were the last strip of English on an otherwise translated screen. The filename in box 1 is deliberately NOT translated — the file in her hand really is called Label Inventory Tracker.xlsx.',
      zh: '三项。(1) 标签库存上传现在接受包含全部内容的单一工作簿 — 库存、排产计划、销售需求 — 而不仅仅是三个独立文件。Sona 有时本来就已合并，强迫她拆分已完成的文件毫无产出。上传区上方有两个按钮用于选择方式；合并方式只读取工作簿一次，然后用于其中存在的所有类型，并报告哪些部分已找到、哪些没有 — 若只报告成功，缺少一个工作表的文件看起来与完整文件完全一样。两种方式共用同一段代码（terapkanKotak），因此对其中一种的修复绝不会漏掉另一种。(2) 每当门户更新时，会出现"有新版本可用"横幅及重新加载按钮。门户会重新获取 version.js 本身 — 而不是某个日后必然与之不一致的第二份版本文件 — 首次在 30 秒后，之后每 10 分钟一次，以及每次标签页重新可见时。横幅会一直显示，直到重新加载或手动关闭，且按版本号分别关闭，因此关闭今天的提示不会让下周的修复也沉默。获取失败始终静默处理。(3) 主跟踪表 / 需采购 / 请勿采购 标签页终于也有了中文；它们是这个已翻译界面上最后一片英文。第 1 框中的文件名刻意不翻译 — 她手上的文件确实叫 Label Inventory Tracker.xlsx。',
    },
  },
  {
    v: 'v14.3', date: '5 Agu 2026',
    what: {
      id: 'Tombol kirim PRF sekarang kebal pencetan ganda. Tanggal 5 Agustus dua PRF lahir dua kali dengan invoice dan nominal yang sama persis — yang satu berjarak 1,97 detik, yang satu 0,179 detik. Itu bukan orang yang berubah pikiran, itu tombol yang terpencit dua kali atau layar yang belum bergerak sehingga diklik lagi. Penyebabnya: fungsi kirim menunggu beberapa panggilan jaringan sebelum menyimpan, dan selama jeda itu tidak ada yang menahan klik kedua. Sekarang klik kedua diabaikan sampai yang pertama selesai. Ini lapisan pertama, bukan jaminan — browser bisa mengirim ulang sendiri dan dua tab tidak saling tahu, jadi ada SQL terpisah untuk mengunci nomor PRF di sisi server.',
      en: 'The submit-PRF button is now immune to double presses. On 5 August two PRFs were created twice with identical invoices and amounts — one pair 1.97 seconds apart, the other 0.179 seconds. That is not someone changing their mind; it is a button pressed twice, or a screen that had not moved yet. The cause: the submit function awaits several network calls before saving, and nothing held back a second click during that gap. A second click is now ignored until the first finishes. This is the first layer, not a guarantee — a browser can retry on its own and two tabs do not know about each other, so a separate SQL locks the PRF number server-side.',
      zh: '提交付款申请单的按钮现在不再受重复点击影响。8月5日有两张付款申请单被重复创建，发票与金额完全相同 — 一组相隔1.97秒，另一组相隔0.179秒。这不是有人改变主意，而是按钮被点了两次，或界面尚未响应而再次点击。原因：提交函数在保存前需等待若干次网络调用，而这段间隙内没有任何机制拦住第二次点击。现在第二次点击会被忽略，直到第一次完成。这只是第一层防护，并非保证 — 浏览器可能自行重试，两个标签页之间也互不知情，因此另有 SQL 在服务端锁定付款申请单编号。',
    },
  },
  {
    v: 'v14.2', date: '5 Agu 2026',
    what: {
      id: 'Tab browser akhirnya punya ikon MTI. Sebelumnya browser mencari /favicon.ico di akar domain — bukan di dalam folder portalnya — jadi selalu 404, dan itu satu-satunya error yang tersisa di console. Sekarang alamatnya ditulis eksplisit di index.html. Ikonnya dibuat dari logo resmi dalam empat ukuran (16/32/48/64) di atas latar transparan, jadi bentuknya tetap utuh di tab terang maupun gelap.',
      en: 'The browser tab finally has an MTI icon. The browser used to look for /favicon.ico at the domain root — not inside the portal folder — so it always 404ed, and that was the last error left in the console. The path is now written explicitly in index.html. The icon is built from the official logo at four sizes (16/32/48/64) on a transparent background, so it holds its shape on both light and dark tabs.',
      zh: '浏览器标签页终于有了 MTI 图标。此前浏览器会在域名根目录寻找 /favicon.ico — 而非门户所在文件夹 — 因此始终 404，那也是控制台中最后一个错误。现在路径已在 index.html 中明确写出。图标由官方标志生成，包含四种尺寸（16/32/48/64），背景透明，因此在浅色与深色标签页中都能保持形状。',
    },
  },
  {
    v: 'v14.1', date: '5 Agu 2026',
    what: {
      id: 'Portal jadi jauh lebih ringan dibuka, tanpa satu pun fitur berubah. Tiga belas layar sekarang diambil saat diklik, bukan saat boot — yang tidak pernah dibuka tidak pernah diunduh. Riwayat rilis lengkap (40 KB teks tiga bahasa) dipindah keluar dari berkas yang ikut terunduh pertama kali; sidebar cuma butuh entri terbaru. Fixture demo 15 KB juga baru diambil kalau Supabase tidak terhubung, dan di produksi itu berarti tidak pernah. Total yang terkirim saat membuka portal turun dari 452 KB ke 105 KB, dan jumlah berkasnya dari 72 jadi 38. Digabung dengan v13.10, tahap tarik data saat login juga sudah turun dari 3,0 detik ke 0,3 detik.',
      en: 'The portal opens far lighter, with no feature changed. Thirteen screens are now fetched when clicked rather than at boot — what nobody opens is never downloaded. The full release history (40 KB of trilingual text) moved out of the first-load bundle; the sidebar only needs the newest entry. The 15 KB demo fixtures are likewise fetched only when Supabase is absent, which in production means never. Bytes sent on opening the portal fell from 452 KB to 105 KB, and file count from 72 to 38. Together with v13.10, the login data-fetch stage is already down from 3.0 s to 0.3 s.',
      zh: '门户打开更轻快，功能毫无变动。十三个界面现在改为点击时才加载，而非启动时 — 无人打开的就从不下载。完整发布历史（四十 KB 三语文本）已移出首次加载；侧栏只需最新一条。演示数据（15 KB）同样只在未连接 Supabase 时才获取，在生产环境中即从不获取。打开门户时传输量从 452 KB 降至 105 KB，文件数从 72 降至 38。结合 v13.10，登录拉取数据阶段已从 3.0 秒降至 0.3 秒。',
    },
  },
  {
    v: 'v14.0', date: '5 Agu 2026',
    what: {
      id: 'PO label yang sudah disetujui sekarang bisa menerbitkan berkas impor 采购申请 untuk ERP grup \u2014 tombol "Template ERP" di sebelah Download PDF. Tidak ada lagi mengetik ulang kode material sepanjang enam belas karakter yang diawali nol. 需求日期 dihitung dari tanggal approve ditambah lead time prioritas PO (Super Urgent 3 hari, Urgent 7, Normal 14), diambil dari Label Settings. Kalau ada SATU saja SKU yang belum punya kode material ERP, berkasnya TIDAK dibuat sama sekali dan SKU-nya disebut satu per satu \u2014 membuang barisnya diam-diam berarti label yang tidak pernah dipesan, dan itu baru ketahuan waktu barangnya tidak datang. Formatnya .xls BIFF8, sudah diuji langsung masuk ke ERP-nya.',
      en: 'An approved label PO can now produce the 采购申请 import file for the group ERP \u2014 an "ERP template" button beside Download PDF. No more retyping sixteen-character material codes that begin with a zero. 需求日期 is the approval date plus the PO priority lead time (Super Urgent 3 days, Urgent 7, Normal 14), read from Label Settings. If even ONE SKU has no ERP material code the file is not created at all and the SKUs are named \u2014 dropping those rows silently means a label nobody ordered, discovered only when it fails to arrive. Format is .xls BIFF8, tested importing into the ERP itself.',
      zh: '\u5df2\u5ba1\u6279\u7684\u6807\u7b7e\u91c7\u8d2d\u5355\u73b0\u5728\u53ef\u4ee5\u751f\u6210\u96c6\u56e2 ERP \u7684\u91c7\u8d2d\u7533\u8bf7\u5bfc\u5165\u6587\u4ef6 \u2014 \u5728\u4e0b\u8f7d PDF \u65c1\u7684"ERP \u6a21\u677f"\u6309\u94ae\u3002\u4e0d\u518d\u9700\u8981\u624b\u5de5\u91cd\u8f93\u4ee5\u96f6\u5f00\u5934\u7684\u5341\u516d\u4f4d\u7269\u6599\u7f16\u53f7\u3002\u9700\u6c42\u65e5\u671f = \u5ba1\u6279\u65e5\u671f + \u4f18\u5148\u7ea7\u63d0\u524d\u671f\uff08\u7279\u6025 3 \u5929\u3001\u7d27\u6025 7 \u5929\u3001\u666e\u901a 14 \u5929\uff09\uff0c\u53d6\u81ea\u6807\u7b7e\u8bbe\u7f6e\u3002\u53ea\u8981\u6709\u4e00\u4e2a SKU \u7f3a\u5c11 ERP \u7269\u6599\u7f16\u53f7\uff0c\u5c31\u5b8c\u5168\u4e0d\u751f\u6210\u6587\u4ef6\uff0c\u5e76\u9010\u4e00\u5217\u51fa\u8be5 SKU \u2014 \u9759\u9ed8\u4e22\u5f03\u8fd9\u4e9b\u884c\u610f\u5473\u7740\u65e0\u4eba\u8ba2\u8d27\u7684\u6807\u7b7e\uff0c\u800c\u8fd9\u53ea\u4f1a\u5728\u8d27\u7269\u672a\u5230\u65f6\u624d\u88ab\u53d1\u73b0\u3002\u683c\u5f0f\u4e3a .xls BIFF8\uff0c\u5df2\u5b9e\u9645\u5bfc\u5165 ERP \u9a8c\u8bc1\u3002',
    },
  },
  {
    v: 'v13.11', date: '4 Agu 2026',
    what: {
      id: 'Dropdown Terms di Edit PO berhenti berbohong. Pilihannya selama ini cuma enam string baku, sedangkan yang tersimpan di PO berbentuk kalimat ("30 days after B/L \u2014 ref CGDD..."), jadi tidak ada satu pun yang cocok \u2014 dan HTML menampilkan opsi PERTAMA kalau tidak ada yang cocok. Akibatnya SETIAP PO tampil sebagai "Payment in Advance" di layar itu, berapa pun syarat aslinya, sementara dokumen cetaknya tetap benar. Lebih parah, mengklik opsi yang sudah tersorot tidak memicu apa-apa, jadi yang benar-benar ingin mengubahnya ke Payment in Advance tidak bisa sama sekali. Sekarang nilai asli PO ikut jadi pilihan, jadi dropdown menyebut apa adanya. Dan dua tulisan yang artinya sama ("TOP 30" vs "30 days after B/L") tidak lagi dihitung sebagai perubahan syarat pembayaran \u2014 sebelumnya itu akan mencabut approval PO yang sudah bercap tanpa ada yang berubah di kertasnya.',
      en: 'The Terms dropdown in Edit PO stops lying. Its options were six fixed strings, while a PO stores a sentence ("30 days after B/L \u2014 ref CGDD..."), so nothing ever matched \u2014 and HTML shows the FIRST option when nothing matches. Every PO therefore displayed as "Payment in Advance" on that screen whatever its real term, while the printed document stayed correct. Worse, clicking an already-highlighted option fires no event, so anyone who genuinely wanted Payment in Advance could not set it at all. The PO actual value is now offered as an option, so the dropdown states what is there. And two spellings that mean the same thing ("TOP 30" vs "30 days after B/L") no longer count as a change of payment terms \u2014 previously that would strip approval from a sealed PO with nothing changed on the paper.',
      zh: '\u7f16\u8f91\u91c7\u8d2d\u5355\u4e2d\u7684\u4ed8\u6b3e\u6761\u4ef6\u4e0b\u62c9\u6846\u4e0d\u518d\u8bef\u5bfc\u3002\u5b83\u53ea\u6709\u516d\u4e2a\u56fa\u5b9a\u9009\u9879\uff0c\u800c\u91c7\u8d2d\u5355\u5b9e\u9645\u5b58\u50a8\u7684\u662f\u4e00\u53e5\u8bdd\uff08"30 days after B/L \u2014 ref CGDD..."\uff09\uff0c\u56e0\u6b64\u4ece\u672a\u5339\u914d \u2014 \u800c HTML \u5728\u65e0\u5339\u914d\u65f6\u4f1a\u663e\u793a\u7b2c\u4e00\u4e2a\u9009\u9879\u3002\u4e8e\u662f\u6bcf\u5f20\u91c7\u8d2d\u5355\u5728\u8be5\u754c\u9762\u90fd\u663e\u793a\u4e3a"\u9884\u4ed8\u6b3e"\uff0c\u65e0\u8bba\u5b9e\u9645\u6761\u4ef6\u5982\u4f55\uff0c\u800c\u6253\u5370\u5355\u636e\u4e00\u76f4\u662f\u5bf9\u7684\u3002\u66f4\u7cdf\u7684\u662f\uff0c\u70b9\u51fb\u5df2\u9009\u4e2d\u7684\u9009\u9879\u4e0d\u4f1a\u89e6\u53d1\u4efb\u4f55\u4e8b\u4ef6\uff0c\u56e0\u6b64\u771f\u6b63\u60f3\u6539\u4e3a\u9884\u4ed8\u6b3e\u7684\u4eba\u6839\u672c\u6539\u4e0d\u4e86\u3002\u73b0\u5728\u91c7\u8d2d\u5355\u7684\u5b9e\u9645\u503c\u4e5f\u4f5c\u4e3a\u9009\u9879\u5217\u51fa\u3002\u53e6\u5916\uff0c\u4e24\u79cd\u542b\u4e49\u76f8\u540c\u7684\u5199\u6cd5\u4e0d\u518d\u88ab\u5f53\u4f5c\u4ed8\u6b3e\u6761\u4ef6\u53d8\u66f4 \u2014 \u6b64\u524d\u90a3\u4f1a\u4f7f\u5df2\u76d6\u7ae0\u7684\u91c7\u8d2d\u5355\u88ab\u64a4\u9500\u5ba1\u6279\uff0c\u800c\u5355\u636e\u4e0a\u4ec0\u4e48\u90fd\u6ca1\u53d8\u3002',
    },
  },
  {
    v: 'v13.10', date: '4 Agu 2026',
    what: {
      id: 'Portal jadi jauh lebih cepat dibuka, tanpa satu pun fitur berubah. Dua sebab yang diperbaiki. Pertama, cap perusahaan (129 KB) menumpang di file yang sama dengan logo, jadi setiap orang mengunduhnya cuma untuk melihat form login \u2014 sekarang dia baru diambil kalau ada dokumen yang benar-benar dicetak. Kedua, saat login portal menarik 21 data dari server satu per satu, masing-masing menunggu yang sebelumnya selesai; sekarang semuanya berangkat bersamaan. Dalam pengujian dengan latensi yang sama, tahap ini turun dari 3,0 detik ke 0,3 detik. Bonus: satu tabel yang gagal dibaca tidak lagi menggagalkan seluruh login \u2014 dulu satu kegagalan melempar orang kembali ke layar login tanpa penjelasan.',
      en: 'The portal now opens far faster, with no feature changed. Two causes fixed. First, the company chop (129 KB) shared a file with the logo, so everyone downloaded it merely to see the login form \u2014 it is now fetched only when a document is actually printed. Second, on login the portal pulled 21 datasets from the server one at a time, each waiting for the previous one; they now all leave together. Under identical simulated latency this stage fell from 3.0 s to 0.3 s. A bonus: one unreadable table no longer fails the entire login \u2014 previously a single failure bounced the user back to the login screen with no explanation.',
      zh: '\u95e8\u6237\u6253\u5f00\u901f\u5ea6\u5927\u5e45\u63d0\u5347\uff0c\u529f\u80fd\u6beb\u65e0\u53d8\u52a8\u3002\u4fee\u590d\u4e86\u4e24\u4e2a\u539f\u56e0\u3002\u5176\u4e00\uff0c\u516c\u53f8\u5370\u7ae0\uff08129 KB\uff09\u4e0e\u5546\u6807\u5171\u7528\u4e00\u4e2a\u6587\u4ef6\uff0c\u56e0\u6b64\u6bcf\u4e2a\u4eba\u4ec5\u4e3a\u67e5\u770b\u767b\u5f55\u9875\u5c31\u8981\u4e0b\u8f7d\u5b83 \u2014 \u73b0\u5728\u53ea\u6709\u771f\u6b63\u6253\u5370\u5355\u636e\u65f6\u624d\u83b7\u53d6\u3002\u5176\u4e8c\uff0c\u767b\u5f55\u65f6\u95e8\u6237\u9010\u4e2a\u62c9\u53d6 21 \u7ec4\u6570\u636e\uff0c\u6bcf\u4e00\u7ec4\u90fd\u5728\u7b49\u4e0a\u4e00\u7ec4\uff1b\u73b0\u5728\u5b83\u4eec\u540c\u65f6\u53d1\u51fa\u3002\u5728\u76f8\u540c\u5ef6\u8fdf\u7684\u6a21\u62df\u6d4b\u8bd5\u4e2d\uff0c\u6b64\u9636\u6bb5\u4ece 3.0 \u79d2\u964d\u81f3 0.3 \u79d2\u3002\u53e6\u5916\uff0c\u5355\u4e00\u8868\u8bfb\u53d6\u5931\u8d25\u4e0d\u518d\u5bfc\u81f4\u6574\u4e2a\u767b\u5f55\u5931\u8d25 \u2014 \u4ee5\u5f80\u4e00\u6b21\u5931\u8d25\u5c31\u4f1a\u628a\u4eba\u9000\u56de\u767b\u5f55\u9875\uff0c\u4e14\u6ca1\u6709\u4efb\u4f55\u8bf4\u660e\u3002',
    },
  },
  {
    v: 'v13.9', date: '3 Agu 2026',
    what: {
      id: 'BUY NOW sekarang memperingatkan kalau SKU yang dicentang SUDAH dipesan dalam 40 hari terakhir. Sebelumnya tidak ada: stok baru berubah setelah barangnya datang dan Excel diunggah lagi, jadi SKU yang PO-nya sedang jalan tetap muncul di daftar belanja dengan angka yang sama persis \u2014 dan tidak ada satu pun angka di layar yang terlihat aneh. Peringatan, bukan larangan, dan jejaknya ikut tersimpan ke Label Request supaya cania/visca ikut melihatnya. Nama jabatan: sona jadi "Label PIC", cenjc jadi 经营管理部经理 (hak aksesnya tidak berubah sedikit pun).',
      en: 'BUY NOW now warns when a ticked SKU was ALREADY ordered within the last 40 days. There was no such check before: stock only changes once the goods arrive and the Excel is re-uploaded, so a SKU with a PO in flight kept appearing in the shopping list with identical figures \u2014 and nothing on screen looked wrong. A warning, not a block, and the trace is carried into the Label Request so cania and visca see it too. Job titles: sona is now "Label PIC", cenjc is 经营管理部经理 (permissions entirely unchanged).',
      zh: '需采购页签现在会在勾选的 SKU 于过去 40 天内已订购时发出提醒。此前并无此项检查：库存要等货到并重新上传 Excel 后才变化，因此在途采购单对应的 SKU 会以完全相同的数值继续出现在采购清单中 \u2014 而屏幕上没有任何数字显得异常。这是提醒而非阻止，且记录会带入标签申请，供 cania 与 visca 一并查看。职务名称：sona 改为 "Label PIC"，cenjc 改为经营管理部经理（权限完全不变）。',
    },
  },
  {
    v: 'v13.8', date: '3 Agu 2026',
    what: {
      id: 'Menu akun: catatan "tersimpan di akun Anda" dihapus, dan ada Ganti Password sekarang \u2014 semua akun, kapan saja, tidak perlu menunggu dipaksa saat login pertama. Penerimaan barang oleh cania & visca dipersempit ke satu kolom saja: layar PO Outstanding tidak lagi mengirim seluruh baris PO (yang termasuk status) setiap kali menyimpan. Sisi server ditutup trigger \u2014 status PO cuma bisa diubah Supervisor, dari jalur mana pun, bukan cuma dari tombol.',
      en: 'Account menu: the "saved to your account" note is gone, and Change Password now lives there \u2014 every account, any time, without waiting to be forced at first login. Goods receipt by cania and visca is narrowed to one column: the Outstanding PO screen no longer sends the whole PO row (which included status) on every save. The server side is closed with a trigger \u2014 PO status can only be changed by the Supervisor, through any path, not merely by the button.',
      zh: '账户菜单：移除"已保存至您的账户"提示，并新增修改密码 \u2014 所有账号随时可用，无需等待首次登录强制修改。cania 与 visca 的收货操作收窄至单一字段：未交采购单页面不再在每次保存时提交整行采购单（其中含状态）。服务端以触发器封堵 \u2014 采购单状态仅主管可变更，适用于任何路径，而非仅靠按钮。',
    },
  },
  {
    v: 'v13.7', date: '3 Agu 2026',
    what: {
      id: 'Menu samping sekarang memisahkan Label dari Purchase Order, dan Surat Jalan berganti nama jadi "Surat Jalan Internal (Label)" \u2014 dari menunya sendiri sudah jelas itu lembar internal dan cuma untuk PO label. Dokumen cetaknya TIDAK berubah. Layar baru "PO Outstanding": semua PO yang masih menunggu barang, bisa dicentang per PO atau per baris, lalu ditandai sudah sampai. Stok TIDAK diubah \u2014 layar ini cuma menutup sisa PO.',
      en: 'The sidebar now separates Label from Purchase Order, and the Surat Jalan is renamed "Internal Delivery Note (Label)" \u2014 the menu itself now says it is an internal sheet for label POs only. The printed document is UNCHANGED. New screen "Outstanding PO": every PO still awaiting goods, tickable per PO or per line, then marked as arrived. Stock is NOT touched \u2014 this only closes the PO balance.',
      zh: '侧边栏现将标签与采购单分开，送货单更名为"内部送货核对单（标签）" \u2014 菜单本身即表明这是内部表单且仅适用于标签采购单。打印文件保持不变。新增"未交采购单"页面：列出所有待到货采购单，可按采购单或按行勾选并标记为已到货。不会改动库存 \u2014 仅结清采购单余量。',
    },
  },
  {
    v: 'v13.6', date: '3 Agu 2026',
    what: {
      id: 'Surat Jalan sekarang ditandai DOKUMEN INTERNAL \u2014 di dokumennya, di atas judul, merah. Ini bukan surat jalan pengiriman dan tidak untuk diserahkan ke supplier; ini lembar gudang MTI buat mencocokkan label yang datang. Layarnya juga cuma menampilkan PO LABEL sekarang: sebelumnya PO pelumas ikut muncul dan menawarkan pembuatan surat jalan, padahal checklistnya (warna, posisi tulisan, kerekatan) tidak berlaku untuk drum oli. PO non-label yang masih menunggu barang tetap disebut jumlahnya, tidak hilang diam-diam.',
      en: 'The Surat Jalan is now marked INTERNAL DOCUMENT \u2014 on the document itself, above the title, in red. It is not a shipping note and is not for the supplier; it is the MTI warehouse\u2019s sheet for checking incoming labels. The screen now shows LABEL POs only: a lubricants PO used to appear and offer a Surat Jalan, though the checklist (colour, text position, adhesion) means nothing for a drum of oil. Non-label POs still awaiting goods are still counted on screen, not silently dropped.',
      zh: '送货单现已标注为内部文件 \u2014 标注位于文件标题上方，红色。这不是发货单，也不提供给供应商；这是 MTI 仓库核对到货标签的表单。页面现在仅显示标签采购单：此前润滑油采购单也会出现并提供开单，但其核对项（颜色、文字位置、黏着力）对油桶毫无意义。仍在等待到货的非标签采购单仍会显示数量，不会被悄悄隐藏。',
    },
  },
  {
    v: 'v13.5', date: '3 Agu 2026',
    what: {
      id: 'Portal SEKARANG BILANG kalau ada spec yang diproduksi tapi tidak punya baris di tracker sama sekali. Pada rencana Agustus itu 140 spec, 345.400 pcs \u2014 40% dari rencana produksi \u2014 barang yang tidak akan pernah muncul di BUY NOW karena tidak ada yang menghitung labelnya. Spanduk merah di pratinjau unggah, lengkap dengan tombol export daftarnya. Juga: 8 SKU yang namanya di tracker punya imbuhan kode E-mark sekarang tercocokkan otomatis lewat awalan nama \u2014 hanya kalau kandidatnya cuma satu, dan selalu ditampilkan.',
      en: 'The portal now SAYS SO when a spec is in production but has no row in the tracker at all. On the August plan that is 140 specs, 345,400 pcs \u2014 40% of planned production \u2014 goods that can never reach BUY NOW because nothing counts their labels. A red banner in the upload preview, with a button to export the list. Also: 8 SKU whose tracker name carries an E-mark suffix now match automatically on the name prefix \u2014 only where exactly one candidate exists, and always shown.',
      zh: '当某规格已投产却在跟踪表中完全没有对应行时，门户现在会明确提示。八月计划中此类规格有 140 个、345,400 条 \u2014 占排产计划的 40% \u2014 这些货品永远无法进入需采购列表，因为没有任何行统计其标签。上传预览中以红色横幅提示，并提供导出列表按钮。此外：8 个跟踪表名称带 E-mark 后缀的 SKU 现可按名称前缀自动匹配 \u2014 仅在唯一候选时生效，且始终显示。',
    },
  },
  {
    v: 'v13.4', date: '3 Agu 2026',
    what: {
      id: 'Stok Label sekarang punya TIGA kotak unggah bernomor \u2014 stok, rencana produksi, rencana penjualan \u2014 dan file yang salah kotak ditolak sambil menyebut kotak yang benar. Angka rencana tidak diketik lagi: portal membacanya dari file 排产计划. Diadu ke data Juli & Agustus, angka yang selama ini diketik tangan meleset di 344 dari 344 SKU; 7 di antaranya seharusnya BUY NOW tapi tidak pernah muncul. Di tab BUY NOW, SKU sekarang bisa dicentang dan langsung dikirim jadi Label Request. PO Converter dapat daftar "PO Jalan". Dan PO cetak: kolom Amount tidak lagi terpotong di tepi kertas \u2014 "3,430,723,399" sempat tercetak "3,430,723,39".',
      en: 'Label Stock now has THREE numbered upload boxes \u2014 stock, production plan, sales plan \u2014 and a file in the wrong box is refused by name. Plan figures are no longer typed: the portal reads them from the 排产计划 file. Checked against July and August, the hand-typed figure was wrong for 344 of 344 SKU; 7 of them should have been BUY NOW and never showed. On the BUY NOW tab, SKUs can now be ticked and sent straight through as a Label Request. PO Converter gained a "POs in Flight" list. And the printed PO: the Amount column is no longer sliced at the paper edge \u2014 "3,430,723,399" was printing as "3,430,723,39".',
      zh: '标签库存现有三个编号上传框 \u2014 库存、排产计划、销售需求 \u2014 放错框会被拒绝并提示正确编号。计划数值不再手工录入：门户直接读取排产计划文件。以七月与八月数据核对，手工录入的数值 344 个 SKU 全部有误，其中 7 个本应为需采购却从未显示。在需采购页签可勾选 SKU 并直接发送为标签申请。PO 转换器新增"进行中的采购单"列表。打印版采购单：金额列不再被纸张边缘截断 \u2014 "3,430,723,399" 曾被打印为 "3,430,723,39"。',
    },
  },
  {
    v: 'v13.3', date: '1 Agu 2026',
    what: {
      id: 'cania & visca sekarang punya daftar PO mereka sendiri di Dashboard, dan bisa menarik PDF-nya kapan saja \u2014 termasuk sebelum di-approve, saat dokumennya memang belum bertanda tangan dan bercap. Dulu PO hilang dari layar mereka begitu tombol Generate ditekan, karena Approval Queue milik Supervisor.',
      en: 'cania and visca now have their own PO list on the Dashboard and can pull the PDF at any time \u2014 including before approval, when the document legitimately carries no signature or chop. A PO used to vanish from their screen the moment they pressed Generate, because the Approval Queue belongs to the Supervisor.',
      zh: 'cania 与 visca 现在在看板上有各自的采购单列表，随时可导出 PDF \u2014 包括审批前（此时文件本就无签章）。此前按下生成后采购单便从其界面消失，因为审批队列属于主管。',
    },
  },
  {
    v: 'v13.2', date: '1 Agu 2026',
    what: {
      id: 'Kalau ada file yang belum sampai Google Drive, portal SEKARANG BILANG \u2014 spanduk di Dashboard, lengkap dengan alasan aslinya dari Google. Selama lima hari bulan lalu setiap upload ditolak dan portal tetap menulis "tersimpan"; itu yang tidak boleh terulang.',
      en: 'If a file has not reached Google Drive the portal now SAYS SO \u2014 a Dashboard banner carrying Google\'s own error text. For five days last month every upload was refused while the portal kept saying "saved"; that is what this prevents.',
      zh: '若文件尚未送达 Google Drive，门户现在会明确提示 \u2014 看板横幅并附上 Google 返回的原始错误。上月连续五天所有上传均被拒绝，门户却始终显示"已保存"；此改动正为杜绝此事。',
    },
  },
  {
    v: 'v13.1', date: '1 Agu 2026',
    what: {
      id: 'Faktur pajak bisa diisi langsung di form Add Invoice, jadi invoice dan fakturnya yang datang sebarengan tidak perlu dipisah \u2014 dulu file kedua terbuang diam-diam. Pesan setelah PRF dibuat sekarang menyebut orang yang benar: cania/visca menyerahkan ke sekar, sekar meneruskan ke Supervisor. Dan dua nama label yang cuma beda spasi kini dikenali sebagai SATU barang.',
      en: 'The tax invoice can be entered straight from Add Invoice, so an invoice and its faktur arriving together no longer have to be split \u2014 the second file used to be discarded silently. The message after a PRF is raised now names the right person: cania/visca hand to sekar, sekar passes to the Supervisor. And two label names differing only in spacing are now recognised as ONE item.',
      zh: '税票可直接在"新增发票"中录入，同时送达的发票与税票无需分开处理 \u2014 此前第二个文件会被静默丢弃。生成付款申请单后的提示现指向正确的人：cania/visca 交给 sekar，再由 sekar 转交主管。仅空格不同的两个标签名称现在视为同一物料。',
    },
  },
  {
    v: 'v13.0', date: '1 Agu 2026',
    what: {
      id: 'File yang mau naik ke Drive sekarang disimpan dulu di server, dan baru dihapus setelah Drive mengkonfirmasi. Kalau Drive sedang mati, filenya TIDAK hilang \u2014 dia mengantre dan terkirim sendiri begitu Drive hidup lagi, tanpa siapa pun mengupload ulang. Kegagalan juga menyimpan alasannya, bukan menyimpan kosong.',
      en: 'A file bound for Drive is now stored on the server first and deleted only after Drive confirms. If Drive is down the file is NOT lost \u2014 it queues and goes up by itself once Drive returns, with nobody re-uploading anything. Failures now record their reason instead of recording nothing.',
      zh: '上传 Drive 的文件现先保存在服务器，待 Drive 确认后才删除。若 Drive 故障，文件不会丢失 \u2014 会自动排队，待恢复后自行上传，无需任何人重新上传。失败也会记录原因，而非留空。',
    },
  },
  {
    v: 'v12.2', date: '1 Agu 2026',
    what: {
      id: 'Faktur pajak bisa ditambahkan belakangan \u2014 klik tanda "Belum upload" di baris invoicenya, isi nomornya, lampirkan PDF-nya. Dan kolomnya berhenti menagih supplier luar negeri, yang memang tidak akan pernah menerbitkan faktur pajak Indonesia. Sebelumnya satu klik MENGARANG nomor faktur acak dan menampilkannya sebagai centang hijau.',
      en: 'A tax invoice can now be added after the fact \u2014 click the "Not uploaded" flag on the invoice row, enter the number, attach the PDF. And the column stops chasing overseas suppliers, who will never issue an Indonesian tax invoice. Previously one click INVENTED a random number and showed it as a green tick.',
      zh: '税票现在可后补 \u2014 点击发票行的"未上传"标记，录入编号并附上 PDF。该列不再向境外供应商催要税票 \u2014 他们本就不会开具印尼税票。此前点击一次会随机生成编号并显示为绿色对勾。',
    },
  },
  {
    v: 'v12.1', date: '1 Agu 2026',
    what: {
      id: 'Design Library: gambar desain akhirnya kelihatan oleh semua orang, bukan cuma yang mengupload \u2014 kartunya dulu menampilkan link sementara yang mati begitu pindah browser, padahal gambarnya tersimpan di database sejak awal. Klik kartunya untuk preview besar, dan cania/visca/Supervisor sekarang bisa edit dan hapus.',
      en: 'Design Library: artwork is finally visible to everyone, not only the person who uploaded it \u2014 the card rendered a temporary link that died outside that browser, while the real image had been in the database all along. Click a card for a full preview; cania/visca/Supervisor can now edit and delete.',
      zh: '设计库：图稿终于对所有人可见，而不再只有上传者能看到 \u2014 此前卡片渲染的是临时链接，换个浏览器即失效，而真正的图片一直存在数据库中。点击卡片可放大预览；cania/visca/主管现在可编辑与删除。',
    },
  },
  {
    v: 'v12.0', date: '1 Agu 2026',
    what: {
      id: 'cania & visca sekarang menginput invoice sendiri, bukan cuma membuat PRF. Dulu PRF Builder mereka selalu kosong: invoice baru muncul setelah lepas tahap 1, dan tombol yang memindahkannya ada di layar yang tidak mereka punya. Alurnya sekarang mengikuti kenyataannya — mereka menerima dan mengajukan, sekar mencetak dan mengejar, Supervisor menandatangani.',
      en: 'cania and visca now enter invoices themselves, not just build PRFs. Their PRF builder used to be permanently empty: an invoice only appears once it leaves stage 1, and the control that moves it sat on a screen they did not have. The flow now matches reality \u2014 they receive and raise, sekar prints and chases, the Supervisor signs.',
      zh: 'cania 与 visca 现在可自行录入发票，而非仅生成付款申请单。此前其付款申请单构建器始终为空：发票须先离开第 1 阶段才会出现，而推进阶段的按钮位于他们无权访问的界面。现在流程贴合实际 \u2014 由他们接收并提交，sekar 打印并跟进，主管签核。',
    },
  },
  {
    v: 'v11.1', date: '1 Agu 2026',
    what: {
      id: 'Bahasa dan tampilan pindah ke menu akun, dan sekarang tersimpan di akun — bukan di tab. Pilih sekali, ikut ke komputer mana pun. Halaman login juga bisa ganti bahasa sebelum masuk. Dashboard sona yang selama ini kosong sekarang berisi, dan angka cania/visca jadi milik masing-masing.',
      en: 'Language and theme moved into the account menu and are now stored on the account, not the tab. Choose once and it follows you to any computer. The login page can switch language before you sign in. sona\'s dashboard, empty until now, has content, and cania/visca each see their own figures.',
      zh: '语言与外观移入账户菜单，并保存至账户而非标签页 — 设置一次，在任何电脑上都生效。登录页也可在登录前切换语言。sona 此前空白的看板现已填充内容，cania 与 visca 各自查看本人的数据。',
    },
  },
  {
    v: 'v11.0', date: '31 Jul 2026',
    what: {
      id: 'Label Request dipisah: sona MEMINTA (parse lalu "Kirim ke Purchasing"), cania/visca yang assign supplier dan menerbitkan PO dari baris yang sona kirim. Permintaannya tersimpan utuh dan tersambung ke nomor PO-nya.',
      en: 'Label Request is split: sona ASKS (parse, then "Send to Purchasing"), and cania/visca assign the supplier and raise the PO from the rows she sent. The request is stored intact and linked to its PO number.',
      zh: '标签申请流程拆分：sona 提出申请（解析后"发送给采购"），由 cania/visca 指定供应商并依其提交的明细开具采购单。申请内容完整留存并与采购单号关联。',
    },
  },
  {
    v: 'v10.3', date: '31 Jul 2026',
    what: {
      id: 'Tombol Konfirmasi Lunas sekarang muncul untuk Supervisor juga. Database memang sudah mengizinkannya sejak awal — layarnya yang belum ikut, jadi izin itu ada tapi tidak kelihatan.',
      en: 'The Confirm Paid button now appears for the Supervisor too. The database had always permitted it — only the screen had not caught up, so the permission existed but was invisible.',
      zh: '"确认已付款"按钮现在对主管也可见。数据库本就允许该操作，只是界面未同步，导致权限存在却不可见。',
    },
  },
  {
    v: 'v10.2', date: '31 Jul 2026',
    what: {
      id: 'Label Request langkah 2 diperbaiki — dulu cuma menampilkan tulisan "[object Object]" dan mentok di situ, jadi upload label mingguan tidak pernah bisa dilanjutkan. Logo diganti versi resolusi tinggi tanpa latar putih, jadi bersih di dark mode.',
      en: 'Label Request step 2 fixed — it showed only the text "[object Object]" and dead-ended there, so the weekly label upload could never be completed. Logo replaced with a high-resolution version with no white background, so it reads cleanly in dark mode.',
      zh: '修复标签申请第 2 步 — 此前仅显示"[object Object]"且无法继续，导致每周标签上传始终无法完成。标志更换为无白底高分辨率版本，深色模式下更清晰。',
    },
  },
  {
    v: 'v10.1', date: '31 Jul 2026',
    what: {
      id: 'sekar dapat layar Finance Dashboard dan bisa memposting bukti transfer — Finance membagikan buktinya ke grup, bukan menginput satu per satu. Finance tetap yang menandatangani checklist 4 dokumen sebelum apa pun bisa dilunasi.',
      en: 'sekar gets the Finance Dashboard and can post transfer proofs — Finance shares them to a group chat rather than entering them one by one. Finance still signs the 4-document checklist before anything can be paid.',
      zh: 'sekar 获得财务看板权限，可录入转账凭证 — 财务将凭证发到群里，而非逐条录入。付款前仍须由财务签核四项单据清单。',
    },
  },
  {
    v: 'v10.0', date: '31 Jul 2026',
    what: {
      id: 'Alur PRF diubah mengikuti kenyataannya: nomor terbit pas Preview (jadi PDF bisa dicetak duluan, kertasnya sudah bernomor), PRF tersimpan di "Terbentuk", dan supervisor mencentang sendiri mana yang fisiknya sudah sampai di mejanya — sekaligus banyak.',
      en: 'The PRF flow now matches what actually happens: the number is issued at Preview (so the PDF can be printed first, already numbered), the PRF is saved as "Created", and the supervisor ticks off which ones have physically reached his desk — many at once.',
      zh: '付款申请单流程改为贴合实际：预览时生成编号（可先打印带号纸质单），保存为"已创建"，再由主管勾选实际已送达其桌面的单据 — 可批量确认。',
    },
  },
  {
    v: 'v9.1', date: '31 Jul 2026',
    what: {
      id: 'Invoice tahap 2 bisa "Kembalikan ke tahap 1" — jadi bisa diedit/dihapus lagi setelah PRF-nya dibatalkan. Tombol konfirmasi juga diperjelas: dulu "Cancel this PRF?" bersebelahan dengan "Cancel", dua tombol satu kata arti berlawanan.',
      en: 'A stage-2 invoice can go "Back to stage 1", so it can be edited or deleted again after its PRF is cancelled. Confirm buttons reworded too: "Cancel this PRF?" used to sit beside "Cancel" — one word, opposite meanings.',
      zh: '第 2 阶段发票可“退回第 1 阶段”，付款申请单作废后即可重新编辑或删除。确认按钮文案也已修正：此前“作废此单？”与“取消”并列，一词两义。',
    },
  },
  {
    v: 'v9.0', date: '31 Jul 2026',
    what: {
      id: 'PRF bisa dibatalkan selama belum sampai Finance — dan invoicenya langsung bisa dipakai lagi. Nomor PRF yang dibatalkan TIDAK dipakai ulang.',
      en: 'A PRF can be cancelled while Finance has not received it — and its invoices become available again immediately. A cancelled PRF number is never reused.',
      zh: '付款申请单在财务接收前可作废 — 其发票立即恢复可用。已作废的编号不会被重复使用。',
    },
  },
  {
    v: 'v8.1', date: '31 Jul 2026',
    what: {
      id: 'Semua tulisan "Wilbert" di layar diganti "Supervisor" — nama jabatan, bukan nama orang. Nilai yang tersimpan di database tidak diubah sama sekali, jadi History lama tetap nyambung.',
      en: 'Every on-screen "Wilbert" now reads "Supervisor" — the role, not the person. Nothing stored in the database changed, so old History still lines up.',
      zh: '界面上的“Wilbert”全部改为“主管” — 用职位而非人名。数据库中存储的值未做任何更改，历史记录仍然对得上。',
    },
  },
  {
    v: 'v8.0', date: '31 Jul 2026',
    what: {
      id: 'Invoice bisa dihapus dari portal — tapi hanya yang masih tahap 1, lewat konfirmasi dua langkah, ditolak kalau sudah dipakai di PRF, dan selalu tercatat di History lengkap dengan nominal & jatuh tempo.',
      en: 'Invoices can be deleted from the portal — only at stage 1, behind a two-step confirm, refused if a PRF already names it, and always recorded in History with the amount and due date.',
      zh: '可在门户中删除发票 — 仅限第 1 阶段，需两步确认，已被付款申请单引用者拒绝删除，并始终记入历史（含金额与到期日）。',
    },
  },
  {
    v: 'v7.0', date: '31 Jul 2026',
    what: {
      id: 'Nomor invoice kembar untuk supplier yang sama DITOLAK — invoice kembar bisa kebayar dua kali. Dan PRF untuk supplier import mencetak ZHANG PEI YAN sebagai pengaju; audit trail tetap mencatat user yang sebenarnya.',
      en: 'A duplicate invoice number for the same supplier is REJECTED — a duplicate can be paid twice. And an import PRF prints ZHANG PEI YAN as applicant; the audit trail still records the real user.',
      zh: '同一供应商的重复发票号将被拒绝 — 重复发票可能被支付两次。进口付款申请单以 ZHANG PEI YAN 为申请人；审计日志仍记录真实操作用户。',
    },
  },
  {
    v: 'v6.1', date: '31 Jul 2026',
    what: {
      id: 'Tombol "Sudah diserahkan ke Wilbert" jadi "Buat PRF" — dan sekarang benar-benar mengantar ke sana: invoice naik tahap, PRF Builder langsung tertuju ke supplier itu dengan invoicenya sudah tercentang.',
      en: '"Handed to Wilbert" is now "Create PRF" — and actually takes you there: the invoice advances, and the PRF builder opens on that supplier with the invoice already ticked.',
      zh: '“已转交 Wilbert”改为“开具付款申请单”，并真正带你过去：发票推进阶段，付款申请单构建器直接定位该供应商且已勾选该发票。',
    },
  },
  {
    v: 'v6.0', date: '31 Jul 2026',
    what: {
      id: 'Mata uang tagihan sekarang tersimpan di master supplier. Form Add Invoice langsung terbuka di mata uang supplier itu, dan PRF Builder berhenti menampilkan "IDR" untuk supplier yang tidak pernah ditagih rupiah.',
      en: 'Billing currency now lives on the supplier master. Add Invoice opens in that currency, and the PRF builder stops showing "IDR" for a supplier who is never billed in rupiah.',
      zh: '结算币种现存于供应商主数据。新增发票直接以该币种打开，付款申请单不再对从未以印尼盾计价的供应商显示 IDR。',
    },
  },
  {
    v: 'v5.2', date: '31 Jul 2026',
    what: {
      id: 'Jatuh tempo tidak lagi meleset satu hari. Perhitungan tanggal dulu memakai jam lokal lalu dikonversi ke UTC — di WIB (UTC+7) hasilnya mundur sehari: 90 hari dari 2 Sep tampil 30 Nov, seharusnya 1 Des.',
      en: 'Due dates are no longer a day early. Date arithmetic mixed local midnight with a UTC conversion — in WIB (UTC+7) that lost a day: 90 days from 2 Sep showed 30 Nov instead of 1 Dec.',
      zh: '到期日不再提前一天。日期计算此前以本地零点起算却按 UTC 转换，在 WIB（UTC+7）下少算一天：9 月 2 日起 90 天显示为 11 月 30 日，应为 12 月 1 日。',
    },
  },
  {
    v: 'v5.1', date: '31 Jul 2026',
    what: {
      id: 'Invoice PDF dibaca lengkap: No. Invoice, PO/kontrak, currency, nominal, tanggal, dan jatuh tempo. Nominal cuma diisi kalau kolom AMOUNT dan qty x harga cocok — kalau beda, dikosongkan.',
      en: 'Invoice PDFs are read in full: number, PO/contract, currency, amount, date and due date. The amount is filled only when the AMOUNT column and quantity x unit price agree — otherwise it is left blank.',
      zh: '完整读取发票 PDF：发票号、合同号、币种、金额、日期与到期日。仅当 AMOUNT 列与数量×单价一致时才填入金额，否则留空。',
    },
  },
  {
    v: 'v5.0', date: '31 Jul 2026',
    what: {
      id: 'Rekening supplier disimpan langsung — antrean approval supervisor dihapus. Ini juga yang bikin "Save Supplier" gagal total: kolom antreannya tidak ada di database, dan satu kolom asing bikin seluruh baris ditolak.',
      en: 'Supplier accounts save straight through — the supervisor approval queue is gone. That queue was also why "Save Supplier" failed outright: its columns were never created, and one unknown column rejects the whole row.',
      zh: '供应商账户直接保存 — 取消主管审批队列。该队列也正是“保存供应商”彻底失败的原因：其字段从未建立，而一个未知字段会导致整行被拒绝。',
    },
  },
  {
    v: 'v4.0', date: '31 Jul 2026',
    what: {
      id: 'Kolom SWIFT/BIC untuk supplier import — muncul kalau Import dinyalakan dan tercetak di PRF.',
      en: 'A SWIFT/BIC field for import suppliers — appears when Import is on, and prints on the PRF.',
      zh: '进口供应商新增 SWIFT/BIC 字段 — 开启“进口”后出现，并打印在付款申请单上。',
    },
  },
  {
    v: 'v3.9', date: '31 Jul 2026',
    what: {
      id: 'Supplier import punya tombolnya sendiri — pertanyaan PKP dilewati, dan portal berhenti menagih faktur pajak yang memang tidak akan pernah ada. TOP 90 hari ditambahkan.',
      en: 'Overseas suppliers get their own switch — the PKP question is skipped, and the portal stops chasing a tax invoice that will never exist. 90-day terms added.',
      zh: '境外供应商有了独立开关 — 跳过 PKP 问题，门户不再追讨永远不会存在的税票。新增 90 天账期。',
    },
  },
  {
    v: 'v3.8', date: '31 Jul 2026',
    what: {
      id: 'PDF invoice hasil scan diberitahu langsung lewat notifikasi, plus ringkasan "2 dari 3 file hasil scan" di akhir antrian.',
      en: 'A scanned invoice PDF now says so in a notification, plus a "2 of 3 files are scans" summary when the queue ends.',
      zh: '扫描件发票 PDF 会通过通知直接说明，队列结束时另有“3 个文件中 2 个为扫描件”的汇总。',
    },
  },
  {
    v: 'v3.7', date: '31 Jul 2026',
    what: {
      id: 'Form invoice keisi otomatis dari PDF yang teksnya kebaca (No. Invoice, jatuh tempo, nominal). Kalau tidak dikenali atau hasil scan: dibiarkan kosong, bukan diisi tebakan.',
      en: 'The invoice form fills itself from readable PDFs (number, due date, amount). Unrecognised or scanned: left blank rather than guessed.',
      zh: '可读 PDF 自动填写发票表单（发票号、到期日、金额）。无法识别或为扫描件时留空，绝不猜测。',
    },
  },
  {
    v: 'v3.6', date: '31 Jul 2026',
    what: {
      id: 'Download semua PRF sekaligus dalam satu ZIP, bukan satu-satu.',
      en: 'Download every PRF at once as a single ZIP instead of one at a time.',
      zh: '一次性打包下载全部付款申请单，无需逐张下载。',
    },
  },
  {
    v: 'v3.5', date: '31 Jul 2026',
    what: {
      id: 'Intake invoice terima banyak PDF sekaligus — modal jalan satu per satu dengan penanda "invoice 3 dari 7", ada tombol Lewati.',
      en: 'Invoice intake accepts many PDFs at once — the modal walks through them showing "invoice 3 of 7", with a Skip button.',
      zh: '发票录入支持一次拖入多个 PDF — 弹窗逐个处理并显示“第 3 / 7 张发票”，可跳过。',
    },
  },
  {
    v: 'v3.4', date: '31 Jul 2026',
    what: {
      id: 'Barang di LEMBAR LAMPIRAN ikut terbaca — dokumen yang isinya cuma "Terlampir" tidak lagi kosong. 17 bundel asli: 24 baris barang, 6 dokumen lebih dari satu barang.',
      en: 'Goods on the ATTACHMENT SHEET are read too — documents that only said "Terlampir" are no longer blank. 17 real bundles: 24 goods lines, 6 documents with more than one item.',
      zh: '附页货物明细现已读取 — 仅标注“Terlampir”的单据不再为空。17 个真实压缩包：24 条货物明细，其中 6 份为多项货物。',
    },
  },
  {
    v: 'v3.3', date: '31 Jul 2026',
    what: {
      id: 'Tiap barang di PPKEK tercatat satu baris utuh (kode, uraian, qty, harga). Export: kolom Valuta + Kurs, nama file "LIST PPKEK ...". Import Excel dibaca per NAMA kolom.',
      en: 'Every PPKEK goods line is recorded as one complete row (code, description, qty, price). Export: Currency + Rate columns, filename "LIST PPKEK ...". Excel import reads columns BY NAME.',
      zh: 'PPKEK 每项货物完整记录为一行（编码、品名、数量、单价）。导出新增币种与汇率列，文件名 "LIST PPKEK ..."。Excel 导入按列名读取。',
    },
  },
  {
    v: 'v3.2', date: '31 Jul 2026',
    what: {
      id: 'PPKEK mencatat mata uang dokumen (CNY/EUR/USD/IDR/…), bukan cuma USD. Re-import kini benar-benar tersimpan ke server.',
      en: 'PPKEK records the document currency (CNY/EUR/USD/IDR/…), not just USD. Re-imports now actually save to the server.',
      zh: 'PPKEK 记录单据币种（CNY/EUR/USD/IDR/…），不再只认美元。重新导入现在会真正写入服务器。',
    },
  },
  {
    v: 'v3.1', date: '31 Jul 2026',
    what: {
      id: 'Semua label layar ikut ganti bahasa (ID/EN/中). Nomor versi tampil di sidebar.',
      en: 'Every screen label follows the language switch (ID/EN/中). Version shown in the sidebar.',
      zh: '所有界面文字随语言切换（ID/EN/中）。侧栏显示版本号。',
    },
  },
  {
    v: 'v3.0', date: '31 Jul 2026',
    what: {
      id: 'PPKEK terima banyak RAR/ZIP sekaligus. Refresh tidak melempar ke login. Semua notifikasi trilingual.',
      en: 'PPKEK accepts many RAR/ZIP at once. Refresh no longer bounces to login. All notifications trilingual.',
      zh: 'PPKEK 支持一次导入多个 RAR/ZIP。刷新不再退回登录页。所有通知支持三语。',
    },
  },
  {
    v: 'v2.0', date: 'Jul 2026',
    what: {
      id: 'Portal v2 — PO Converter, Surat Jalan, PRF, Stok Label, PPKEK, Reports.',
      en: 'Portal v2 — PO Converter, Delivery Note, PRF, Label Stock, PPKEK, Reports.',
      zh: '门户 v2 — 采购单转换、送货单、付款申请单、标签库存、报关、报表。',
    },
  },
];
