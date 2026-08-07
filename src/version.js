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

export const VERSION = 'v14.7';
export const VERSION_DATE = '7 Agu 2026';

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
      id: 'PRF naik jadi menu sendiri di sidebar, keluar dari layar Payment. Di v14.6 dia dipecah jadi tab di dalam Payment, dengan alasan orang yang mengerjakan keduanya sama. Alasan itu benar tapi ternyata tidak cukup: dua tombol kecil di pojok kiri atas TIDAK terbaca sebagai tab — Kyaru melihatnya sendiri dan bilang tidak terlalu kelihatan, dan itu bukti yang tidak dipunya waktu keputusannya diambil. Fitur yang tidak ditemukan sama saja dengan fitur yang tidak ada. Yang berubah bukan cuma letaknya. PRF itu TUJUAN — sekar datang ke portal untuk mengurus PRF, bukan untuk membuka Payment lalu mencari tab; sekarang menunya menyebut pekerjaannya dengan nama pekerjaannya. Lonceng pemberitahuan PRF juga mengantar ke layar PRF-nya sendiri, bukan ke layar yang PRF-nya ada di bagian bawah. Dan karena cuma satu paruh yang digambar tiap kali, dua-duanya jadi lebih ringan. Kedua layar saling menautkan: dari Invoice ada "Lanjut ke PRF", dari PRF ada "← Invoice Masuk", masing-masing membawa jumlahnya. PRF lahir dari invoice, jadi "kenapa invoice saya tidak muncul di sini" adalah pertanyaan yang pasti terjadi — dan jawabannya selalu ada di layar sebelah. Hak aksesnya mengikuti Payment: wilbert, cania, visca, sekar, dan cenjc dapat menunya; sona dan financemti tidak. Diuji satu per satu untuk kelima peran itu. Satu berkas, dua layar — disengaja. main.js memetakan Payment dan PRF ke modul yang sama, jadi berkasnya tetap terunduh sekali. Memecahnya jadi dua berkas berarti layar PRF harus mengimpor layar Payment, dan layar yang mengimpor layar lain adalah persis yang membuat satu berkas terunduh dua kali.',
      en: 'PRF is now its own sidebar menu, out of the Payment screen. In v14.6 it was split into a tab inside Payment, on the grounds that the same people do both jobs. That was true but not sufficient: two small buttons in the top-left corner do NOT read as tabs — Kyaru looked at them and said they were not noticeable, which is evidence that did not exist when the decision was made. A feature nobody finds is the same as a feature that is not there. More than the location changed. PRF is a DESTINATION — sekar comes to the portal to deal with PRFs, not to open Payment and hunt for a tab; the menu now calls the job by its name. PRF notifications also land on the PRF screen itself rather than on a screen with PRFs somewhere near the bottom. And because only one half is drawn at a time, both halves got lighter. The two screens link to each other: Invoices carries "On to PRF", PRF carries "← Incoming Invoices", each with its count. A PRF is born from an invoice, so "why is my invoice not here" is a question that will certainly be asked — and the answer is always on the screen next door. Access follows Payment: wilbert, cania, visca, sekar and cenjc get the menu; sona and financemti do not. Verified role by role for all five. One file, two screens — deliberately. main.js maps Payment and PRF to the same module, so the file is still downloaded once. Splitting it into two files would mean the PRF screen importing the Payment screen, and a screen importing another screen is exactly what makes one file download twice.',
      zh: '付款申请单现已成为侧边栏中的独立菜单，从付款页面中移出。在 v14.6 中它被拆分为付款页面内的一个标签页，理由是做这两件事的是同一批人。该理由成立，但并不充分：左上角的两个小按钮读起来不像标签页 — Kyaru 亲自查看后表示不够醒目，而这是做决定时并不掌握的证据。没人能发现的功能，等同于不存在的功能。改变的不只是位置。付款申请单是一个目的地 — sekar 来到门户是为了处理付款申请单，而不是打开付款页面再去找标签页；现在菜单直接以这项工作的名称命名。付款申请单的通知也会直接跳转到付款申请单页面，而不是跳到一个把它放在下方的页面。而且由于每次只绘制其中一半，两个页面都变得更轻。两个页面互相链接：发票页有"继续到付款申请单"，付款申请单页有"← 进项发票"，各自带有数量。付款申请单源自发票，因此"为什么我的发票不在这里"是必然会被问到的问题 — 而答案永远在隔壁页面。访问权限沿用付款页面：wilbert、cania、visca、sekar 和 cenjc 可见此菜单；sona 与 financemti 不可见。已对这五个角色逐一验证。一个文件，两个页面 — 这是刻意为之。main.js 将付款与付款申请单映射到同一个模块，因此文件仍只下载一次。若拆成两个文件，付款申请单页面就必须导入付款页面，而页面导入页面正是导致同一文件被下载两次的原因。',
};
