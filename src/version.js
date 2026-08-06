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

export const VERSION = 'v14.3';
export const VERSION_DATE = '5 Agu 2026';

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
      id: 'Tombol kirim PRF sekarang kebal pencetan ganda. Tanggal 5 Agustus dua PRF lahir dua kali dengan invoice dan nominal yang sama persis — yang satu berjarak 1,97 detik, yang satu 0,179 detik. Itu bukan orang yang berubah pikiran, itu tombol yang terpencit dua kali atau layar yang belum bergerak sehingga diklik lagi. Penyebabnya: fungsi kirim menunggu beberapa panggilan jaringan sebelum menyimpan, dan selama jeda itu tidak ada yang menahan klik kedua. Sekarang klik kedua diabaikan sampai yang pertama selesai. Ini lapisan pertama, bukan jaminan — browser bisa mengirim ulang sendiri dan dua tab tidak saling tahu, jadi ada SQL terpisah untuk mengunci nomor PRF di sisi server.',
      en: 'The submit-PRF button is now immune to double presses. On 5 August two PRFs were created twice with identical invoices and amounts — one pair 1.97 seconds apart, the other 0.179 seconds. That is not someone changing their mind; it is a button pressed twice, or a screen that had not moved yet. The cause: the submit function awaits several network calls before saving, and nothing held back a second click during that gap. A second click is now ignored until the first finishes. This is the first layer, not a guarantee — a browser can retry on its own and two tabs do not know about each other, so a separate SQL locks the PRF number server-side.',
      zh: '提交付款申请单的按钮现在不再受重复点击影响。8月5日有两张付款申请单被重复创建，发票与金额完全相同 — 一组相隔1.97秒，另一组相隔0.179秒。这不是有人改变主意，而是按钮被点了两次，或界面尚未响应而再次点击。原因：提交函数在保存前需等待若干次网络调用，而这段间隙内没有任何机制拦住第二次点击。现在第二次点击会被忽略，直到第一次完成。这只是第一层防护，并非保证 — 浏览器可能自行重试，两个标签页之间也互不知情，因此另有 SQL 在服务端锁定付款申请单编号。',
};
