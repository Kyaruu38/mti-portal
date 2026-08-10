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

export const VERSION = 'v15.1';
export const VERSION_DATE = '8 Agu 2026';

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
      id: 'Artwork label sekarang bisa DIGANTI dari kartunya sendiri, dan versi lamanya disimpan. Label berubah karena SNI atau NPB diperbarui, dan sampai rilis ini jendela Edit desain menjawabnya dengan satu kalimat: "untuk mengganti gambarnya, upload desain baru". Yang menurutinya mendapat kartu KEDUA untuk kode ERP yang sama — bukan versi baru dari yang lama, melainkan desain kedua yang berdiri sejajar dengan yang pertama, dan tidak ada apa pun di layar yang menghubungkan keduanya. Sekarang ada tombol Ganti artwork di jendela yang sama, dengan pratinjau artwork yang berlaku di sebelahnya. Hak aksesnya designWrite, yang sudah dipegang wilbert, cania dan visca sejak awal — tidak ada peran yang berubah. NOMOR VERSINYA BERHENTI BISA DIKETIK. Dia naik sendiri tiap artwork diganti: v1 jadi v2, v9 jadi v10. Kotak yang bisa diketik berarti suatu hari ada dua artwork berbeda yang memakai nomor yang sama, dan riwayat yang dua barisnya sama-sama bernama v2 tidak bisa menjawab pertanyaan apa pun. Penomoran yang tidak berpola vN — misalnya ikut nomor revisi supplier — diberi akhiran .1 daripada ditebak. YANG LAMA DISIMPAN, TIDAK DITIMPA, dan ini alasan sebenarnya rilis ini ada. SNI dan NPB adalah kewajiban regulasi. Menimpa artwork di tempat membuat portal berhenti bisa menjawab "label versi mana yang berlaku waktu kiriman Juli dicetak" — dan itu justru pertanyaan yang muncul waktu ada audit atau barang tertahan di pabean. Berkas lamanya memang tidak pernah dihapus dari Drive, tapi tautannya di baris itu ikut tertimpa, jadi praktis tidak bisa ditemukan lagi kecuali ada yang ingat nama berkasnya. Tiap penggantian menyimpan versi, tautan Drive, gambar kecil, tanggal, dan siapa yang menggantinya ke kolom baru designs.riwayat — pola yang sama dengan ppkek.docs dan pos.items, satu kolom jsonb di baris yang sama, bukan tabel anak. Riwayatnya tampil sebagai deretan GAMBAR di bawah tombolnya, bukan daftar tautan: yang bertanya "SNI yang lama bentuknya bagaimana" sedang mencari gambar, dan nama berkas tidak menjawabnya. URUTAN KERJANYA DISENGAJA: unggah dulu, tulis basis data, baru ubah status di layar. Kalau unggahannya gagal tidak ada yang berubah sama sekali; kalau tulis basis datanya gagal kartunya masih menunjuk artwork LAMA — yang benar, karena penggantiannya memang tidak jadi, dan pesannya menyebutkan itu. Kebalikannya, menaikkan versi lebih dulu lalu mengunggah, menghasilkan kartu bertuliskan v2 yang gambarnya masih v1 dan tidak ada di layar yang membedakannya dari penggantian yang berhasil. Butuh supabase_designs_riwayat.sql. TANPA berkas itu penggantiannya tetap jalan dan versinya tetap naik — kolom yang tidak dikenal ditolak PostgREST, field riwayatnya dibuang, dan sisanya dikirim ulang; yang hilang cuma riwayatnya, bukan penggantiannya. Logika penomorannya diuji 10 kasus termasuk 50 penggantian berturut-turut: nol nomor berulang.',
      en: 'Label artwork can now be REPLACED from its own card, and the previous version is kept. Labels change because an SNI or NPB is updated, and until this release the Edit design dialog answered that with a single sentence: "to change the artwork, upload a new design". Anyone who followed it got a SECOND card for the same ERP code — not a new version of the old one, but a second design standing beside the first, with nothing on screen connecting them. There is now a Replace artwork button in that same dialog, with a preview of the artwork currently in force beside it. It is gated by designWrite, which wilbert, cania and visca have held all along — no role changes. THE VERSION NUMBER STOPS BEING TYPEABLE. It increments itself on every replacement: v1 to v2, v9 to v10. A typeable box means that one day two different artworks share a number, and a history with two rows both called v2 cannot answer anything. Numbering that does not follow the vN pattern — a supplier\'s own revision number, say — gets a .1 suffix rather than a guess. THE OLD ONE IS KEPT, NOT OVERWRITTEN, and this is the real reason the release exists. SNI and NPB are regulatory obligations. Overwriting artwork in place stops the portal being able to answer "which version of the label was in force when the July shipment was printed" — which is exactly the question that shows up during an audit or when goods are held at customs. The old file is never deleted from Drive, but its link on that row is overwritten too, so in practice it can no longer be found unless someone remembers the filename. Each replacement stores the version, Drive link, thumbnail, date and who did it into a new designs.riwayat column — the same pattern as ppkek.docs and pos.items, one jsonb column on the same row rather than a child table. The history renders as a strip of IMAGES below the button, not a list of links: someone asking "what did the old SNI look like" is looking for a picture, and a filename does not answer that. THE ORDER OF OPERATIONS IS DELIBERATE: upload, then write the database, then change anything on screen. If the upload fails nothing has changed at all; if the database write fails the card still points at the OLD artwork — which is correct, because the replacement did not happen, and the message says so. The reverse — bumping the version first and uploading after — produces a card reading v2 whose image is still v1, with nothing on screen to distinguish it from a replacement that worked. Requires supabase_designs_riwayat.sql. WITHOUT it the replacement still works and the version still increments — PostgREST rejects the unknown column, the history field is dropped, and the rest is re-sent; what is lost is the history, not the replacement. The numbering logic is tested across 10 cases including 50 consecutive replacements: no number repeats.',
      zh: '标签图稿现在可以直接从卡片上更换，且旧版本会被保留。标签会因 SNI 或 NPB 更新而变更，而在本次发布之前，编辑设计对话框对此只有一句话：“如需更换图稿，请上传新设计”。照做的人会为同一个 ERP 编码得到第二张卡片——不是旧设计的新版本，而是与第一张并列的第二个设计，页面上没有任何内容把两者关联起来。现在同一个对话框里有了更换图稿按钮，旁边显示当前生效图稿的预览。权限为 designWrite，wilbert、cania 和 visca 一直都持有——没有任何角色发生变化。版本号不再可手工输入。每次更换都会自动递增：v1 变 v2，v9 变 v10。可输入的文本框意味着总有一天两个不同的图稿会共用一个编号，而两行都叫 v2 的历史记录无法回答任何问题。不符合 vN 格式的编号（例如沿用供应商自己的修订号）会加上 .1 后缀，而不是靠猜测。旧版本会被保留而非覆盖，这才是本次发布真正的理由。SNI 与 NPB 是法规义务。就地覆盖图稿会让门户无法回答“七月那批货印刷时，生效的是哪个版本的标签”——而这恰恰是审计或货物在海关被扣时会被问到的问题。旧文件在 Drive 中从不删除，但该行上的链接同样会被覆盖，因此除非有人记得文件名，否则实际上再也找不到。每次更换都会把版本、Drive 链接、缩略图、日期和操作人记入新增的 designs.riwayat 列——与 ppkek.docs 和 pos.items 相同的模式，同一行上的一个 jsonb 列，而非子表。历史记录以图片条的形式显示在按钮下方，而不是链接列表：问“旧的 SNI 长什么样”的人要找的是图，而文件名回答不了。操作顺序是刻意安排的：先上传，再写入数据库，最后才改变页面上的任何内容。若上传失败，则什么都没有改变；若数据库写入失败，卡片仍指向旧图稿——这是正确的，因为更换并未发生，提示信息也会这么说。相反的顺序——先升版本再上传——会产生一张写着 v2 而图片仍是 v1 的卡片，且页面上无从与成功的更换区分。需要 supabase_designs_riwayat.sql。没有它，更换仍然可用，版本也仍会递增——PostgREST 会拒绝未知列，历史字段被剔除，其余内容重新提交；丢失的是历史记录，而不是这次更换。编号逻辑已通过 10 个用例测试，包括连续 50 次更换：没有重复编号。',
};
