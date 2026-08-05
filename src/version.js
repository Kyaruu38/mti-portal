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

export const VERSION = 'v14.2';
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
      id: 'Tab browser akhirnya punya ikon MTI. Sebelumnya browser mencari /favicon.ico di akar domain — bukan di dalam folder portalnya — jadi selalu 404, dan itu satu-satunya error yang tersisa di console. Sekarang alamatnya ditulis eksplisit di index.html. Ikonnya dibuat dari logo resmi dalam empat ukuran (16/32/48/64) di atas latar transparan, jadi bentuknya tetap utuh di tab terang maupun gelap.',
      en: 'The browser tab finally has an MTI icon. The browser used to look for /favicon.ico at the domain root — not inside the portal folder — so it always 404ed, and that was the last error left in the console. The path is now written explicitly in index.html. The icon is built from the official logo at four sizes (16/32/48/64) on a transparent background, so it holds its shape on both light and dark tabs.',
      zh: '浏览器标签页终于有了 MTI 图标。此前浏览器会在域名根目录寻找 /favicon.ico — 而非门户所在文件夹 — 因此始终 404，那也是控制台中最后一个错误。现在路径已在 index.html 中明确写出。图标由官方标志生成，包含四种尺寸（16/32/48/64），背景透明，因此在浅色与深色标签页中都能保持形状。',
};
