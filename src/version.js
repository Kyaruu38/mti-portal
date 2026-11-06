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

export const VERSION = 'v23.2';
export const VERSION_DATE = '6 Nov 2026';

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
  id: "DROPDOWN PEMASOK TIDAK BISA DIKLIK DAN TIDAK BISA DIGULIR — BUG YANG SAYA BUAT SENDIRI DI v22.1, DAN YANG LOLOS DARI 34 PEMERIKSAAN. Yang terlihat di layar: kotak pencariannya jalan, mengetik 'bsn' menyisakan satu hasil yang benar — lalu hasil itu tidak bisa diklik, dan daftarnya tidak bisa digulir. TIGA BARIS YANG MASING-MASING MASUK AKAL, DAN BERSAMA-SAMA MEMATIKAN DAFTARNYA. gambar() dipanggil dari onMouseenter supaya sorotan mengikuti kursor; gambar() diakhiri scrollIntoView() supaya baris yang tersorot selalu terlihat; dan window diberi penutup-karena-gulir supaya panel tidak menggantung di tempat yang salah saat halamannya bergeser. Rantainya: kursor melewati satu baris -> seluruh daftar dibangun ulang -> scrollIntoView() MENGGULIR -> menggulir menyalakan event 'scroll' -> penutupnya menangkapnya di window -> panel tertutup sebelum sempat diklik. Menggulir daftarnya sendiri melakukan hal yang persis sama. KENAPA BARU KETAHUAN DI LAYAR, BUKAN DI UJI. Daftar uji saya berisi 7 pemasok dan tidak pernah meluap, jadi scrollIntoView() tidak punya apa pun untuk digulir dan tidak menyalakan event apa pun. Di layar sungguhan daftarnya 46 pemasok, meluap, dan menggulir betulan. Lebih buruk lagi: jsdom tidak mengimplementasikan scrollIntoView SAMA SEKALI, jadi di sana baris itu tidak melakukan apa-apa — dan ujinya menembak mousedown langsung tanpa pernah melewati mouseenter. Dua lubang yang bertumpuk: skenario yang tidak dilewati kursor sungguhan, dan lingkungan uji yang diam-diam tidak punya fungsi yang jadi penyebabnya. PERBAIKANNYA TIGA, DAN KETIGANYA MENYERANG SEBAB YANG BERBEDA. Pertama, menyorot tidak lagi membangun ulang: barisnya disimpan dan yang berubah cuma warna latarnya, jadi node yang sedang di bawah kursor tidak pernah diganti di tengah interaksi. Kedua, scrollIntoView() hanya dipanggil atas permintaan PAPAN KETIK — dipanggil saat mouse bergerak, dia menggeser daftar di bawah kursor orangnya sendiri, yang salah bahkan kalau tidak ada penutup. Ketiga, penutup-karena-gulir sekarang mengabaikan gulir yang berasal DARI DALAM panel: menggulir halaman tetap menutup (posisinya memang jadi basi), menggulir daftarnya tidak. UJINYA DIPERBAIKI LEBIH DULU, BARU KODENYA. scrollIntoView dibuatkan tiruan yang MENYALAKAN event 'scroll' seperti di browser, lalu ditambahkan empat skenario yang melewati kursor dulu: hover lalu klik, hover lalu gulir lalu klik, ketik lalu hover lalu klik, dan papan ketik yang harus tetap bisa menggulir. Versi v22.1 dijalankan ulang di uji yang sama dan gagal di pemeriksaan KEDUA — dengan scrollIntoView yang jujur, panelnya tertutup pada saat dibuka. SATU LUBANG DI UJI ITU SENDIRI IKUT DITUTUP. Tulisan pertama uji baru ini memakai kata kunci yang tidak cocok ke satu pun data ujinya, sehingga yang tergambar adalah kalimat 'Tidak ada yang cocok' — dan kalimat itu juga anak langsung daftarnya. Ujinya 'lulus' sambil mengklik sebuah kalimat. Sekarang ada pemeriksaan tersendiri yang memastikan mengklik kalimat kosong TIDAK memilih apa pun. 47 pemeriksaan lolos; tidak ada perilaku lain yang berubah.",
  en: "THE SUPPLIER DROPDOWN COULD NOT BE CLICKED OR SCROLLED — A BUG I SHIPPED IN v22.1, AND ONE THAT 34 ASSERTIONS LET THROUGH. What the screen showed: the search box worked, typing 'bsn' narrowed to the one correct result — and then that result could not be clicked, and the list could not be scrolled. THREE LINES THAT EACH MADE SENSE, AND TOGETHER KILLED THE LIST. gambar() was called from onMouseenter so the highlight follows the cursor; gambar() ended with scrollIntoView() so the highlighted row stays visible; and window got a close-on-scroll so the panel never hangs in the wrong place when the page moves. The chain: the cursor passes over a row -> the whole list is rebuilt -> scrollIntoView() SCROLLS -> scrolling fires a 'scroll' event -> the closer catches it at window -> the panel closes before it can be clicked. Scrolling the list itself does exactly the same. WHY IT SURFACED ON SCREEN AND NOT IN TESTS. My fixture held 7 suppliers and never overflowed, so scrollIntoView() had nothing to scroll and fired nothing. The real screen holds 46, overflows, and genuinely scrolls. Worse: jsdom does not implement scrollIntoView AT ALL, so there that line did nothing — and the tests dispatched mousedown directly without ever passing through mouseenter. Two holes stacked: a path a real cursor takes that the test never did, and a test environment silently missing the very function that caused it. THREE FIXES, EACH ATTACKING A DIFFERENT CAUSE. First, highlighting no longer rebuilds: the rows are kept and only their background changes, so the node under the cursor is never replaced mid-interaction. Second, scrollIntoView() is called only on KEYBOARD navigation — called while the mouse moves, it slides the list out from under the person's own cursor, which is wrong even without a closer. Third, the scroll closer now ignores scrolls originating INSIDE the panel: scrolling the page still closes it (its position really is stale), scrolling the list does not. THE TESTS WERE FIXED FIRST, THEN THE CODE. scrollIntoView was given a stub that FIRES a 'scroll' event as a browser does, then four scenarios were added that go through the cursor first: hover then click, hover then scroll then click, type then hover then click, and keyboard navigation that must still scroll. v22.1 was re-run against the same tests and failed at the SECOND assertion — with an honest scrollIntoView, its panel closes the moment it opens. A HOLE IN THE NEW TEST ITSELF WAS ALSO CLOSED. Its first draft used a search term matching none of the fixture data, so what was drawn was the 'No match' sentence — which is also a direct child of the list. The test 'passed' while clicking a sentence. There is now a separate assertion that clicking the empty-state selects nothing. 47 assertions pass; no other behaviour changed.",
  zh: "供应商下拉框既无法点击也无法滚动 — 这是我在 v22.1 中引入的缺陷，而 34 项断言未能拦住它。屏幕上的表现：搜索框工作正常，输入 bsn 正确地缩小到唯一结果 — 然后那个结果点不动，列表也滚不动。三行各自合理的代码，合在一起让列表失效。gambar() 由 onMouseenter 调用，以便高亮跟随光标；gambar() 以 scrollIntoView() 收尾，以便高亮行始终可见；而 window 上挂了滚动即关闭，以免页面移动时面板悬在错误的位置。链条是：光标掠过某一行 -> 整个列表被重建 -> scrollIntoView() 发生滚动 -> 滚动触发 scroll 事件 -> 关闭器在 window 上捕获到它 -> 面板在可被点击之前就已关闭。滚动列表本身会导致完全相同的结果。为什么是在屏幕上而不是在测试中暴露。我的测试数据只有 7 家供应商，从不溢出，因此 scrollIntoView() 无物可滚，也不会触发任何事件。真实界面有 46 家，会溢出，并且确实发生滚动。更糟的是：jsdom 根本没有实现 scrollIntoView，因此在那里这一行什么也没做 — 而测试直接派发 mousedown，从未经过 mouseenter。两个漏洞叠加：真实光标会走而测试从未走过的路径，以及一个悄然缺失了罪魁函数的测试环境。三处修复，各自针对不同的成因。其一，高亮不再重建：行被保留，只改变其背景色，因此光标下的节点绝不会在交互中途被替换。其二，scrollIntoView() 仅在键盘导航时调用 — 在鼠标移动时调用它，会把列表从使用者自己的光标下方滑走，即便没有关闭器这也是错的。其三，滚动关闭器现在会忽略源自面板内部的滚动：滚动页面仍会关闭（其位置确实已失效），滚动列表则不会。先修测试，再修代码。为 scrollIntoView 编写了一个会像浏览器那样触发 scroll 事件的替身，然后新增四个必须先经过光标的情形：悬停后点击、悬停后滚动再点击、输入后悬停再点击，以及仍须能够滚动的键盘导航。v22.1 在同一组测试下重跑，在第二项断言处即失败 — 配上诚实的 scrollIntoView，它的面板在打开的那一刻就已关闭。新测试自身的一个漏洞也一并补上。它的初稿使用了与测试数据全不匹配的关键词，于是画出的是「无匹配」这句话 — 而这句话同样是列表的直接子节点。测试在点击一句话的同时「通过」了。现在有一项独立断言确保点击空状态不会选中任何东西。47 项断言通过；没有其他行为发生变化。",
};
