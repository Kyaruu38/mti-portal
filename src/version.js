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

export const VERSION = 'v11.1';
export const VERSION_DATE = '1 Agu 2026';

// Newest first. Kept short on purpose: this is the "did my thing land?" list,
// not a changelog. The commit messages carry the reasoning.
export const CHANGELOG = [
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
