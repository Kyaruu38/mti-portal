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

export const VERSION = 'v23.7';
export const VERSION_DATE = '9 Nov 2026';

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
  id: "ARTWORK BUATAN MESIN SEKARANG TERLIHAT BUATAN MESIN, DAN PENANDANYA TIDAK BISA TERHAPUS OLEH PERUBAHAN STATUS. Permintaannya: artwork yang digenerate harus diberi status 'artwork otomatis', bukan artwork asli. Yang TIDAK dilakukan: menumpangkannya ke designs.status. Diperiksa dulu — seluruh 634 baris berstatus 'draft' dan bawaan kolomnya 'active', jadi status itu memegang DAUR HIDUP, bukan asal-usul. Kalau asal-usul ikut menumpang di sana, artwork hasil generate yang suatu hari naik jadi 'active' akan KEHILANGAN penandanya — dan artwork otomatis yang tidak lagi terlihat otomatis persis keadaan yang diminta untuk dicegah. Jadi medannya sendiri: asal_artwork, dengan penjaga yang cuma menerima 'asli' atau 'otomatis'. Penjaganya diuji, bukan sekadar dipasang: penyisipan bernilai 'entah' ditolak dan barisnya terbukti tidak mendarat. 634 baris yang ada semuanya buatan manusia, jadi bawaan 'asli' sudah benar dan tidak ada satu baris pun yang berubah artinya. PENANDANYA DI EMPAT TEMPAT, BUKAN SATU, KARENA BERKASNYA BISA LEPAS DARI BASIS DATANYA. Sebuah PDF yang diunduh, dikirim lewat chat, lalu disimpan ulang tidak membawa kolom apa pun. Yang tertinggal cuma berkasnya, dan di titik itu tidak ada yang membedakannya dari artwork asli kecuali apa yang tertulis DI DALAMNYA. Maka: kolom di basis data; tanda air ungu di kaki halaman yang menyebut sumbernya; metadata PDF — judul, subjek, kata kunci, pembuat — yang semuanya menyebut 'bukan artwork asli'; dan lencana di layar. Tiga yang pertama ikut ke mana pun berkasnya pergi. Dibuktikan dengan membaca ulang berkas hasilnya sendiri, bukan dengan melaporkan bahwa penulisannya berhasil. WARNANYA UNGU, SENGAJA BUKAN MERAH. Merah di layar Label Library sudah berarti 'ERP bentrok'. Dua sebab berbeda dengan warna yang sama membuat orang berhenti membedakan keduanya, dan yang hilang duluan selalu yang lebih jarang muncul. Di penandaKartu(), 'otomatis' DIPERIKSA DULUAN sebelum ERP ganda dan catatan: dari semua hal yang bisa salah pada sebuah kartu, cuma ini yang membuatnya tidak boleh dicetak apa pun keadaan lainnya. Kartu yang sekaligus bentrok ERP dan otomatis tetap menampilkan yang otomatis. ARAH KESALAHANNYA TIDAK SETARA, DAN UJINYA MENGIKUTI ITU. Artwork otomatis yang lolos sebagai asli berakhir di mesin cetak tanpa diperiksa; artwork asli yang salah ditandai otomatis cuma membuat orang memeriksa ulang sesuatu yang sudah benar. Jadi toRow() SENGAJA tidak mengirim medan itu kalau desainnya tidak menyebutnya — bawaan basis data yang berlaku, dan yang boleh menandai 'otomatis' hanyalah generatornya sendiri. fromRow() dan toRow() diekspor semata supaya aturan itu bisa diuji tanpa menyalakan basis data: salinan aturan di dalam berkas uji cuma akan membuktikan bahwa salinannya benar. test-asal-artwork.mjs: 10 pemeriksaan, termasuk bahwa baris lama tanpa kolom terbaca 'asli' dan bahwa status yang naik ke 'active' tidak menghapus tandanya. Delapan berkas uji di repo lulus semua.",
  en: "MACHINE-MADE ARTWORK NOW LOOKS MACHINE-MADE, AND THE MARKER CANNOT BE ERASED BY A STATUS CHANGE. The request: generated artwork must carry an 'automatic artwork' status rather than passing as original. What was NOT done: overloading designs.status. Checked first — all 634 rows are 'draft' and the column default is 'active', so status holds the LIFECYCLE, not the origin. Had origin ridden along there, a generated artwork later promoted to 'active' would LOSE its marker — and automatic artwork that no longer looks automatic is exactly the state this was meant to prevent. So it gets its own field, asal_artwork, with a guard accepting only 'asli' or 'otomatis'. The guard was tested, not merely installed: an insert with 'entah' was rejected and the row proven not to land. All 634 existing rows are human-made, so the 'asli' default is already correct and not one row changed meaning. THE MARKER LIVES IN FOUR PLACES, NOT ONE, BECAUSE THE FILE CAN BE SEPARATED FROM THE DATABASE. A PDF that is downloaded, sent through chat and saved again carries no columns. All that remains is the file, and at that point nothing distinguishes it from original artwork except what is written INSIDE it. So: the database column; a purple watermark in the page footer naming its source; PDF metadata — title, subject, keywords, author — all stating 'not original artwork'; and a badge on screen. The first three travel wherever the file goes. Proven by reading the produced file back, not by reporting that the write succeeded. THE COLOUR IS PURPLE, DELIBERATELY NOT RED. Red already means 'ERP conflict' on the Label Library screen. Two different causes sharing one colour make people stop distinguishing them, and the one that fades first is always the rarer one. In penandaKartu(), 'otomatis' is checked BEFORE duplicate ERPs and notes: of everything that can be wrong with a card, only this one makes it unprintable regardless of anything else. A card that is both ERP-conflicted and automatic still shows automatic. THE TWO ERROR DIRECTIONS ARE NOT EQUAL, AND THE TESTS FOLLOW THAT. Automatic artwork passing as original ends up on a printing press unchecked; original artwork wrongly marked automatic merely makes someone re-check something already correct. So toRow() deliberately omits the field when the design does not mention it — the database default applies, and only the generator itself may mark 'otomatis'. fromRow() and toRow() are exported purely so that rule can be tested without a database: a copy of the rule inside the test file would only prove the copy is right. test-asal-artwork.mjs: 10 assertions, including that an old row with no column reads as 'asli' and that a status promoted to 'active' does not erase the marker. All eight test files in the repo pass.",
  zh: "机器生成的图稿现在看起来就是机器生成的，而且该标记不会被状态变更抹掉。诉求是：生成的图稿必须带有「自动生成图稿」的状态，而不是冒充原始图稿。没有做的事：把它塞进 designs.status。先做了检查 — 全部 634 行的状态都是 draft，而该列的默认值是 active，因此 status 保存的是生命周期，不是来源。若来源也搭在那里，日后被提升为 active 的生成图稿就会丢失其标记 — 而看起来不再自动的自动图稿，正是本次要防止的状态。因此它有自己的字段 asal_artwork，并带有只接受 asli 或 otomatis 的约束。该约束经过测试而非仅仅安装：以 entah 插入被拒绝，并证明该行没有落地。现有 634 行全部为人工制作，因此 asli 的默认值本就正确，没有任何一行改变了含义。 标记存在于四个地方而非一个，因为文件可能与数据库分离。被下载、通过聊天发送、再次保存的 PDF 不携带任何列。剩下的只有文件本身，而在那一刻，除了写在它内部的内容之外，没有任何东西能把它与原始图稿区分开。于是：数据库列；页脚处注明来源的紫色水印；PDF 元数据 — 标题、主题、关键词、作者 — 全部声明「并非原始图稿」；以及屏幕上的徽标。前三者会随文件去往任何地方。通过回读生成的文件来证明，而不是报告写入成功。 颜色是紫色，刻意不用红色。在标签库界面上，红色已经表示「ERP 冲突」。两种不同原因共用一种颜色会让人不再区分它们，而最先被忽略的总是较少出现的那一个。在 penandaKartu() 中，otomatis 先于重复 ERP 与备注被检查：在一张卡片可能出错的所有事情中，只有这一项使它在任何其他情况下都不可印刷。既存在 ERP 冲突又是自动生成的卡片，仍然显示自动生成。 两个方向的错误并不对等，测试也据此编写。自动图稿冒充原始图稿会未经检查地进入印刷机；原始图稿被误标为自动，只是让人重新检查一件本来正确的事。因此 toRow() 在设计未提及该字段时刻意不发送它 — 以数据库默认值为准，而只有生成器自身才可标记 otomatis。fromRow() 与 toRow() 被导出，纯粹是为了让该规则可以在不启动数据库的情况下测试：把规则复制进测试文件只能证明副本是对的。test-asal-artwork.mjs：10 项断言，包括没有该列的旧行读作 asli，以及状态提升为 active 不会抹去标记。仓库中全部八个测试文件均通过。",
};
