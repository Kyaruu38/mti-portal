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

export const VERSION = 'v23.3';
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
  id: "TOMBOL \"BUKA\" DI HASIL PENCARIAN TIDAK PERNAH MENDARAT — BUG YANG SAMA PERSIS DENGAN DROPDOWN PEMASOK DI v23.2, DI BERKAS YANG LAIN. Yang terlihat di layar: ketik satu nomor, hasilnya muncul benar — PO, Invoice, Design, Label Stock — lalu tombol Buka-nya diklik dan TIDAK TERJADI APA-APA. SEBABNYA SATU BARIS YANG MEMANG SUDAH TAHU DIRINYA RAPUH. Kotak pencariannya punya onBlur yang menutup dropdown, dan penutup itu diberi penundaan 150 ms dengan komentar yang jujur menyebut alasannya: \"supaya klik Buka/Drive sempat mendarat\". Tapi penundaan bukan penjaga, dia cuma memperkecil peluang kalah. Urutan event sebuah klik tetikus adalah mousedown -> blur -> mouseup -> click, dan 'click' HANYA menyala kalau tombolnya masih terpasang di dokumen saat mouseup. Menekan tombol sedikit lebih lama dari 150 ms — hal yang justru biasa di trackpad dan pada klik yang disengaja — berarti clear(dropdown) sudah membuang tombolnya lebih dulu. Klik yang mendarat di udara kosong. KENAPA BARU SEKARANG. Sampai v22.0 pencarian hanya menemukan PO, Invoice, PRF, Surat Jalan dan PPKEK; sesudahnya Design dan Label Stock ikut, jadi daftar hasilnya jadi lebih panjang dan orang mulai benar-benar memakai tombolnya, bukan menekan Enter dan pergi. PERBAIKANNYA DUA, DAN KEDUANYA MENYERANG LOMBA ITU, BUKAN MEMPERPANJANG WAKTUNYA. Pertama, tombol Buka pindah dari onClick ke onMousedown dengan preventDefault() — pola yang sama persis yang dipakai pilihCari() di components.js sejak v22.1. preventDefault() menahan perpindahan fokusnya sekalian, jadi blur-nya tidak pernah menyala dan tidak ada lomba yang perlu dimenangkan. btn() diberi jalan masuk onMousedown untuk itu; prop yang undefined diabaikan h(), jadi setiap tombol lain di seluruh aplikasi tidak berubah sedikit pun. Kedua, \"Drive ↗\" tetap <a> biasa yang memang baru bekerja saat 'click', jadi untuk dia yang diubah BUKAN waktunya melainkan SYARATNYA: mousedown yang jatuh DI DALAM dropdown menandai bahwa orangnya sedang memakai dropdown itu, dan penutupnya dilewati. Fokus dikembalikan ke kotak ketiknya supaya klik BERIKUTNYA di luar tetap punya blur untuk menutupnya. DIUJI DI DOM SUNGGUHAN LEWAT JSDOM, DAN UJINYA DITULIS SUPAYA VERSI LAMA GAGAL DI SITU. Ujinya menembakkan urutan event yang sebenarnya — mousedown, blur, mouseup, lalu click HANYA kalau tombolnya masih terpasang — bukan menembak 'click' langsung seperti uji yang meloloskan bug ini. Dijalankan pada kode v23.2: tombolnya tidak memanggil apa pun dan sudah lepas dari dokumen sebelum click, persis seperti di layar. Pada kode baru: 6 pemeriksaan lolos, termasuk bahwa blur dari LUAR tetap menutup dropdown seperti semula. Tidak ada perilaku lain yang berubah.",
  en: "THE \"OPEN\" BUTTON IN SEARCH RESULTS NEVER LANDED — THE SAME BUG AS THE SUPPLIER DROPDOWN IN v23.2, IN A DIFFERENT FILE. What the screen showed: type a number, the right results appear — PO, Invoice, Design, Label Stock — then Open is clicked and NOTHING HAPPENS. THE CAUSE IS ONE LINE THAT ALREADY KNEW IT WAS FRAGILE. The search input has an onBlur that closes the dropdown, and that close was given a 150 ms delay with a comment honestly stating why: \"so a click on Buka/Drive can land\". But a delay is not a guard, it only narrows the odds of losing. A mouse click fires mousedown -> blur -> mouseup -> click, and 'click' fires ONLY if the button is still attached to the document at mouseup. Holding the button a little longer than 150 ms — ordinary on a trackpad and on any deliberate click — means clear(dropdown) has already thrown the button away. The click lands on nothing. WHY NOW. Until v22.0 search only found POs, Invoices, PRFs, Surat Jalan and PPKEK; after it Design and Label Stock joined, the result list grew, and people started actually using the button instead of pressing Enter and moving on. TWO FIXES, BOTH ATTACKING THE RACE RATHER THAN LENGTHENING IT. First, the Open button moves from onClick to onMousedown with preventDefault() — exactly the pattern pilihCari() in components.js has used since v22.1. preventDefault() also suppresses the focus shift, so the blur never fires and there is no race left to win. btn() gained an onMousedown passthrough for this; h() ignores undefined props, so every other button in the app is untouched. Second, \"Drive ↗\" stays a plain <a> that genuinely only works on 'click', so for it the change is not the timing but the CONDITION: a mousedown landing INSIDE the dropdown marks that the person is using the dropdown, and the close is skipped. Focus returns to the input so the NEXT outside click still has a blur to close it with. TESTED AGAINST A REAL DOM THROUGH JSDOM, AND THE TEST WAS WRITTEN SO THE OLD CODE FAILS IT. It dispatches the real event sequence — mousedown, blur, mouseup, then click ONLY if the button is still attached — rather than firing 'click' directly the way the tests that let this through did. Run against v23.2 code: the button calls nothing and is already detached before click, exactly as on screen. Against the new code: 6 assertions pass, including that a blur from OUTSIDE still closes the dropdown as before. No other behaviour changed.",
  zh: "搜索结果中的「打开」按钮从未生效 — 与 v23.2 中供应商下拉框完全相同的缺陷，只是在另一个文件里。屏幕上的表现：输入一个编号，结果正确出现 — 采购单、发票、设计、标签库存 — 然后点击「打开」，什么也没发生。成因是一行早已自知脆弱的代码。搜索框的 onBlur 会关闭下拉框，而该关闭被加上了 150 毫秒的延迟，注释还诚实地写明了原因：「让打开/Drive 的点击来得及生效」。但延迟不是守卫，它只是缩小了输掉的概率。鼠标点击的事件顺序是 mousedown -> blur -> mouseup -> click，而 click 仅在 mouseup 时按钮仍附着于文档上才会触发。按得比 150 毫秒稍长一点 — 在触控板上和任何有意的点击中都再常见不过 — clear(dropdown) 就已经把按钮丢弃了。点击落在了空处。为何是现在。v22.0 之前，搜索只找得到采购单、发票、付款申请单、送货单与 PPKEK；此后设计与标签库存也加入，结果列表变长，人们才真正开始使用那个按钮。两处修复，都是直接消除竞争，而不是把时间拉长。其一，「打开」按钮从 onClick 改为 onMousedown 并调用 preventDefault() — 自 v22.1 起 components.js 中的 pilihCari() 用的就是这个模式。preventDefault() 一并阻止了焦点转移，因此 blur 根本不会触发，也就不存在需要赢下的竞争。btn() 为此增加了 onMousedown 的透传；h() 会忽略 undefined 的属性，所以全应用的其他按钮毫无变化。其二，「Drive ↗」仍是普通的 <a>，确实只在 click 时生效，因此对它改变的不是时机而是条件：落在下拉框内部的 mousedown 表明使用者正在使用该下拉框，于是跳过关闭。焦点被送回输入框，以便下一次外部点击仍有 blur 可用来关闭它。已通过 jsdom 在真实 DOM 上验证，且测试的写法使旧代码必定失败。它派发真实的事件序列 — mousedown、blur、mouseup，然后仅当按钮仍附着时才派发 click — 而不是像放过这个缺陷的测试那样直接派发 click。在 v23.2 的代码上运行：按钮什么也没调用，且在 click 之前已脱离文档，与屏幕上完全一致。在新代码上：6 项断言全部通过，包括来自外部的 blur 仍照常关闭下拉框。没有其他行为发生变化。",
};
