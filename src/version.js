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

export const VERSION = 'v17.0';
export const VERSION_DATE = '08 Okt 2026';

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
      id: "LAYAR KOMPLAIN GUDANG, DAN DUA AKUN YANG MEMAKAINYA. Masalah label ditemukan oleh orang yang membongkar kardus, dan sampai rilis ini laporannya lewat pesan chat. Pesan chat bukan catatan: tidak bisa dihitung, tidak bisa disaring per pemasok, dan enam bulan lagi tidak ada yang bisa menjawab berapa kali WINS mengirim kurang tahun ini. Lebih buruk lagi, yang menemukan masalahnya bukan yang bisa menindaklanjutinya — jadi laporannya harus selamat melewati serah terima, dan pesan chat selamat melewati serah terima kira-kira sehari. Tabel label_complaints menyimpan: PO mana, ERP mana, jenis masalahnya, qty yang bermasalah, keterangan, link foto, siapa yang melapor, dan daur hidupnya (Open → In progress → Closed). Yang melapor TIDAK bisa menutup laporannya sendiri — alasannya sama persis dengan prfReceive: pelapor yang menutup laporannya sendiri tidak mengkonfirmasi apa pun. DI FORMNYA, PO DAN ERP ITU PILIHAN, BUKAN KETIKAN. Yang mengisi orang gudang dan kode ERP-nya tujuh belas digit. Mengetik ulang kode tujuh belas digit dari kardus ke layar adalah cara paling pasti menghasilkan laporan yang tidak bisa dicocokkan ke barangnya, dan laporan yang tidak bisa dicocokkan sama saja dengan tidak ada laporan. Memilih PO menyaring daftar ERP-nya; supplier dan nama barang ikut tersimpan sendiri dari PO yang dipilih. Formnya juga sengaja TIDAK memakai setUI per ketikan. mount() di core/dom.js tidak punya diffing: setiap setUI membongkar seluruh pohon dan membangunnya lagi, jadi input yang isinya didorong lewat state akan kehilangan fokus di huruf pertama. Elemen formnya dipegang di variabel lokal dan dibaca .value-nya saat Kirim ditekan. DUA AKUN GUDANG: warehousemti dan wangyaqian, keduanya berbahasa Mandarin. wangyaqian dialias ke peran warehousemti dengan mekanisme yang sama seperti kevin di v16.0 — nama pemakainya sendiri, haknya menumpang satu peran. Menambah orang gudang berikutnya cukup satu baris di USERS plus satu baris di profiles. Haknya tiga layar: Dashboard, PO Outstanding, Komplain. Mereka BISA menandai barang sudah sampai, dan itu disengaja — merekalah yang pertama tahu barang datang dan berapa banyak, jadi membiarkan purchasing mengetik ulang angka yang sudah dihitung orang lain cuma menambah satu kesempatan salah ketik. Satu-satunya tulisan mereka ke tabel pos adalah angka penerimaan: trigger pos_guard_approved tetap membekukan setiap kolom lain dari PO yang sudah disetujui untuk siapa pun selain wilbert, jadi mereka tidak bisa menyentuh isi kontraknya. Tidak ada Reports, tidak ada harga, tidak ada Payment. updateComplaint mengembalikan JUMLAH BARIS yang berubah, bukan sekadar 'tidak error'. PostgREST menolak baris lewat RLS dengan HTTP 200, nol baris dan error null — jadi memeriksa error saja akan melaporkan sukses untuk penolakan izin, dan layarnya akan berbohong bahwa statusnya sudah berubah. BUTUH BERKAS SQL-nya DULU. Tanpa tabel label_complaints dan policy-nya, layar ini akan tampil kosong dan tombol Kirim akan gagal.",
      en: "A WAREHOUSE COMPLAINTS SCREEN, AND THE TWO ACCOUNTS THAT USE IT. Label problems are found by the people unpacking the cartons, and until this release they were reported by chat message. A chat message is not a record: it cannot be counted, it cannot be filtered by supplier, and in six months nobody can answer how many short shipments WINS sent this year. Worse, the person who finds the problem is not the person who can act on it, so the report has to survive a handover — and a chat message survives a handover for about a day. The label_complaints table stores which PO, which ERP, the issue type, the affected quantity, details, a photo link, who reported it, and its lifecycle (Open → In progress → Closed). The reporter CANNOT close their own report, for exactly the reason prfReceive exists: a maker who ticks their own delivery confirms nothing. ON THE FORM, PO AND ERP ARE PICKED, NOT TYPED. The people filling this in work in the warehouse and the ERP code is seventeen digits. Re-typing a seventeen-digit code from a carton into a screen is the surest way to produce a report that cannot be matched to its goods, and a report that cannot be matched is the same as no report. Picking the PO narrows the ERP list; supplier and item name are saved automatically from the PO chosen. The form also deliberately does NOT use setUI per keystroke. mount() in core/dom.js has no diffing: every setUI tears the tree down and rebuilds it, so an input driven from state loses focus on the first character. The form elements are held in local variables and read at submit time. TWO WAREHOUSE ACCOUNTS: warehousemti and wangyaqian, both in Chinese. wangyaqian is aliased to the warehousemti role by the same mechanism kevin uses in v16.0 — its own username, its rights borrowed from one role. Adding the next warehouse person costs one line in USERS plus one row in profiles. Three screens: Dashboard, Outstanding PO, Complaints. They CAN mark goods as arrived, and that is deliberate — they are the first to know what landed and how much, so making purchasing re-type a number somebody else already counted only adds one more chance to mistype it. Their only write to the pos table is the received figure: pos_guard_approved still freezes every other column of an approved PO for anyone but wilbert, so they cannot touch the contract. No Reports, no prices, no Payment. updateComplaint returns the NUMBER OF ROWS changed, not merely 'no error'. PostgREST refuses a row through RLS with HTTP 200, zero rows and a null error — so checking the error alone reports success for a permission refusal, and the screen would lie that the status changed. REQUIRES ITS SQL FILE FIRST. Without the label_complaints table and its policies the screen renders empty and Submit fails.",
      zh: "仓库投诉页面，以及使用它的两个账号。标签问题是由拆箱的人发现的，而在本次发布之前，这些问题通过聊天消息上报。聊天消息不是记录：无法统计、无法按供应商筛选，六个月后没有人能回答今年 WINS 少发了多少次。更糟的是，发现问题的人并不是能够处理问题的人，因此报告必须经受交接 — 而聊天消息大约只能经受一天。label_complaints 表记录：哪张采购单、哪个 ERP 编码、问题类型、问题数量、说明、照片链接、报告人，以及其生命周期（待处理 → 处理中 → 已解决）。报告人不能关闭自己的报告，理由与 prfReceive 完全相同。表单中采购单与 ERP 为下拉选择，而非手工输入。填写者是仓库人员，而 ERP 编码有十七位。把十七位编码从纸箱抄到屏幕上，是产生无法与货物对应的报告的最可靠方式，而无法对应的报告等同于没有报告。选择采购单后 ERP 列表随之缩小；供应商与品名由所选采购单自动带出。表单也有意不在每次击键时调用 setUI。core/dom.js 的 mount() 没有差分更新：每次 setUI 都会拆除并重建整棵树，因此由状态驱动的输入框会在第一个字符时失去焦点。表单元素保存在局部变量中，在提交时读取其值。两个仓库账号：warehousemti 与 wangyaqian，界面均为中文。wangyaqian 通过 v16.0 中 kevin 所用的同一机制别名到 warehousemti 角色 — 拥有自己的用户名，权限借自一个角色。三个页面：首页、未结采购单、投诉。他们可以标记货物已到，这是有意为之 — 他们最先知道到了什么、到了多少，让采购再抄一遍别人已经数好的数字只会多一次抄错的机会。他们对 pos 表的唯一写入是到货数量：pos_guard_approved 仍为 wilbert 之外的所有人冻结已批准采购单的其余每一列。没有报表、没有价格、没有付款。updateComplaint 返回实际变更的行数，而不只是「没有报错」。PostgREST 通过 RLS 拒绝某行时返回 HTTP 200、零行、error 为 null — 仅检查 error 会把权限拒绝报告为成功，页面就会谎称状态已更新。需要先执行其 SQL 文件。没有 label_complaints 表及其策略，本页面将为空且提交会失败。",
};
