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

export const VERSION = 'v3.1';
export const VERSION_DATE = '31 Jul 2026';

// Newest first. Kept short on purpose: this is the "did my thing land?" list,
// not a changelog. The commit messages carry the reasoning.
export const CHANGELOG = [
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
