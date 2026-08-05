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

export const VERSION = 'v14.1';
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
      id: 'Portal jadi jauh lebih ringan dibuka, tanpa satu pun fitur berubah. Tiga belas layar sekarang diambil saat diklik, bukan saat boot — yang tidak pernah dibuka tidak pernah diunduh. Riwayat rilis lengkap (40 KB teks tiga bahasa) dipindah keluar dari berkas yang ikut terunduh pertama kali; sidebar cuma butuh entri terbaru. Fixture demo 15 KB juga baru diambil kalau Supabase tidak terhubung, dan di produksi itu berarti tidak pernah. Total yang terkirim saat membuka portal turun dari 452 KB ke 105 KB, dan jumlah berkasnya dari 72 jadi 38. Digabung dengan v13.10, tahap tarik data saat login juga sudah turun dari 3,0 detik ke 0,3 detik.',
      en: 'The portal opens far lighter, with no feature changed. Thirteen screens are now fetched when clicked rather than at boot — what nobody opens is never downloaded. The full release history (40 KB of trilingual text) moved out of the first-load bundle; the sidebar only needs the newest entry. The 15 KB demo fixtures are likewise fetched only when Supabase is absent, which in production means never. Bytes sent on opening the portal fell from 452 KB to 105 KB, and file count from 72 to 38. Together with v13.10, the login data-fetch stage is already down from 3.0 s to 0.3 s.',
      zh: '门户打开更轻快，功能毫无变动。十三个界面现在改为点击时才加载，而非启动时 — 无人打开的就从不下载。完整发布历史（四十 KB 三语文本）已移出首次加载；侧栏只需最新一条。演示数据（15 KB）同样只在未连接 Supabase 时才获取，在生产环境中即从不获取。打开门户时传输量从 452 KB 降至 105 KB，文件数从 72 降至 38。结合 v13.10，登录拉取数据阶段已从 3.0 秒降至 0.3 秒。',
};
