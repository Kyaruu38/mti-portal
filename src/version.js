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

export const VERSION = 'v24.3';
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
  id: "TOMBOL YANG SALAH TERPENCET DUA KALI, DAN ITU SALAH TATA LETAKNYA, BUKAN SALAH ORANGNYA. Kyaru menekan tombol paling atas, mendapat halaman teks hitam-putih tanpa logo dan tanpa warna, lalu bertanya kenapa. Dua kali. Yang dia cari — jalur yang benar-benar menghasilkan artwork — ada di kartu BAWAH yang tidak menonjol. Yang paling sering dibutuhkan harus paling mudah ditemukan, dan ini bukan soal selera tata letak melainkan soal orang yang pulang membawa berkas yang salah. Urutannya dibalik: BUAT ARTWORK di atas, dengan lencana hijau yang menyebut dirinya sendiri 'ini yang menghasilkan artwork' dan satu kalimat yang menjelaskan kenapa logo dan warnanya tetap utuh — karena tidak disentuh. Lembar periksa turun ke bawah, judulnya diredupkan, dan diberi lencana abu 'bukan artwork'. LEMBAR PERIKSA BERTANDA 'ARTWORK OTOMATIS', DAN ITU MENYESATKAN. Keluaran jalur templat bukan artwork dan tidak pernah berniat jadi artwork, tapi tanda airnya mengaku begitu — sehingga selembar teks hitam-putih tanpa logo terlihat seperti artwork yang GAGAL dibuat, bukan seperti alat periksa yang bekerja sebagaimana mestinya. Sekarang tanda airnya berbunyi 'LEMBAR PERIKSA DATA - BUKAN ARTWORK, TIDAK UNTUK DICETAK', judul berkasnya ikut, dan subjeknya menjelaskan SEBABNYA tidak ada logo: semuanya vektor di artwork aslinya. Berkas yang lepas dari portal harus bisa menjelaskan dirinya sendiri, karena di titik itu tidak ada lagi layar yang menerangkan. Uji render yang mengunci perilaku lama ikut diperbarui — dan itu memang perlu dikatakan: ujinya tadinya MEMBENARKAN tanda yang menyesatkan, jadi yang salah bukan cuma kodenya. Sekarang uji itu yang menjaga bahwa judulnya TIDAK boleh memuat kata 'ARTWORK' sama sekali. 30 pemeriksaan di uji render, seluruh berkas uji di repo lulus.",
  en: "THE WRONG BUTTON WAS PRESSED TWICE, AND THAT IS THE LAYOUT'S FAULT, NOT THE PERSON'S. Kyaru pressed the top button, got a black-and-white text page with no logo and no colour, and asked why. Twice. What he wanted — the path that actually produces artwork — sat in the LOWER card, unemphasised. The thing needed most often must be the easiest to find, and this is not a matter of layout taste but of someone walking away with the wrong file. The order is reversed: BUILD ARTWORK on top, with a green badge saying for itself 'this one produces artwork' and one line explaining why the logo and colours survive — because they are never touched. The check sheet moves below, its heading dimmed, with a grey 'not artwork' badge. THE CHECK SHEET WAS STAMPED 'AUTOMATIC ARTWORK', WHICH MISLEADS. The template path's output is not artwork and never intended to be, yet its watermark claimed otherwise — so a black-and-white text page with no logo looked like artwork that had FAILED rather than a checking tool working exactly as designed. The watermark now reads 'LEMBAR PERIKSA DATA - BUKAN ARTWORK, TIDAK UNTUK DICETAK', the file title follows, and the subject explains WHY there is no logo: all of it is vector in the original artwork. A file that leaves the portal must be able to explain itself, because at that point no screen is left to do it. The render test that locked the old behaviour was updated too — and that is worth saying plainly: the test had been ENDORSING the misleading stamp, so the code was not the only thing at fault. That test now guards that the title must not contain the word 'ARTWORK' at all. 30 assertions in the render test, every test file in the repo passes.",
  zh: "按错的按钮被按了两次，而那是版面的错，不是人的错。Kyaru 按了最上面的按钮，得到一页没有标志、没有颜色的黑白文字，然后问为什么。两次。他想要的 — 真正产出图稿的那条路径 — 位于下方那张不显眼的卡片里。最常被需要的东西必须最容易找到，这不是版面品味问题，而是有人带着错误的文件离开的问题。顺序被调换：「生成图稿」置顶，配以绿色徽标自述「此项产出图稿」，并用一句话说明为何标志与颜色得以保全 — 因为它们从未被触碰。核对表移至下方，标题变暗，并加上灰色的「非图稿」徽标。 核对表被盖上了「自动生成图稿」的印记，而这具有误导性。模板路径的输出不是图稿，也从未打算成为图稿，但它的水印却如此宣称 — 于是一页没有标志的黑白文字看上去像是失败的图稿，而不是一个正按设计工作的核对工具。水印现在写的是「LEMBAR PERIKSA DATA - BUKAN ARTWORK, TIDAK UNTUK DICETAK」，文件标题随之改变，主题则说明为何没有标志：那些在原始图稿中全都是矢量。离开门户的文件必须能够自我说明，因为在那一刻已没有界面可以代劳。 锁定旧行为的渲染测试也一并更新 — 这一点值得直说：那个测试此前一直在为误导性的印记背书，因此有错的不只是代码。该测试现在负责守住标题中绝不能出现「ARTWORK」一词。渲染测试含 30 项断言，仓库中所有测试文件均通过。",
};
