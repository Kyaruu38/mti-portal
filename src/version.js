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

export const VERSION = 'v29.1';
export const VERSION_DATE = '16 Nov 2026';

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
  id: "AKUN GAOHE DIBUAT DI SUPABASE, SEHAT SELURUHNYA, DAN TETAP TIDAK BISA MASUK — KARENA MEMBUAT KOTAK AKUN BUKAN MEMBUAT AKUN PORTAL. Cania melaporkannya apa adanya: gaohe@mti.co.id dengan password yang baru diset, dan layarnya menjawab \"username atau password salah\". Diperiksa langsung di basis data: email terkonfirmasi, akun tidak diblokir, password TIDAK kosong, profil role='supplier' dengan supplier_id terisi, must_change_password menyala, dan nol percobaan login tercatat. Nol percobaan itu yang menjawab semuanya: Supabase tidak pernah ditanya. login() memanggil makeUser(username) lebih dulu, dan username yang tidak ada di daftar USERS di src/auth/roles.js dibuang di situ juga -- sebelum satu pun permintaan jaringan dikirim -- dengan pesan yang sama persis seperti password salah. Pesan yang menyesatkan itu bukan hal baru: kasus bcl -> bintang@mti.co.id sudah menuliskannya di komentar berkas yang sama. Yang terulang bukan bug-nya, melainkan LANGKAHNYA: akun Auth dibuat, baris rosternya tidak. Daftar siapa yang boleh masuk hidup di RILIS, bukan di basis data. Barisnya sekarang ada (gaohe -> gaohe@mti.co.id, role supplier, bahasa Mandarin mengikuti PIC-nya, 余维柱), dan sampai rilis ini terbit di GitHub Pages, akunnya memang belum bisa dipakai -- tidak ada yang perlu disetel ulang di Supabase. Password sementara dan layar ganti-password wajibnya tidak berubah.",
  en: "THE GAOHE ACCOUNT WAS CREATED IN SUPABASE, IS ENTIRELY HEALTHY, AND STILL COULD NOT LOG IN — BECAUSE CREATING AN AUTH RECORD IS NOT CREATING A PORTAL ACCOUNT. Cania reported it exactly as it looked: gaohe@mti.co.id with the freshly set password, and the screen answering \"username or password is wrong\". Checked straight in the database: email confirmed, not banned, password NOT empty, profile role='supplier' with supplier_id filled, must_change_password on, and zero sign-in attempts recorded. Those zero attempts answer the whole thing: Supabase was never asked. login() calls makeUser(username) first, and a username absent from the USERS table in src/auth/roles.js is dropped right there -- before a single network request -- with the very same message as a wrong password. That misleading message is not new: the bcl -> bintang@mti.co.id case already wrote it down in a comment in the same file. What repeated is not the bug but the STEP: the Auth record was made, the roster line was not. The list of who may log in lives in a RELEASE, not in the database. The line now exists (gaohe -> gaohe@mti.co.id, role supplier, Chinese UI following its PIC, 余维柱), and until this release is live on GitHub Pages the account genuinely cannot be used -- nothing needs resetting in Supabase. The temporary password and the forced password-change screen are unchanged.",
  zh: "GAOHE 账号已在 Supabase 中创建、状态完全正常，却仍然无法登录 —— 因为创建认证记录并不等于创建门户账号。Cania 如实报告：使用 gaohe@mti.co.id 与刚设置的密码，界面回答「用户名或密码错误」。直接在数据库中核查：邮箱已确认、未被封禁、密码非空、档案 role='supplier' 且 supplier_id 已填、must_change_password 为开，并且登录尝试记录为零。这个「零」解释了一切：Supabase 从未被询问过。login() 先调用 makeUser(username)，而不在 src/auth/roles.js 的 USERS 名单中的用户名就在那里被丢弃 —— 在任何一次网络请求之前 —— 并给出与密码错误完全相同的提示。这条误导性提示并不新鲜：bcl -> bintang@mti.co.id 的案例早已写在同一个文件的注释里。重复的不是缺陷，而是那个步骤：认证记录建了，名册那一行没建。谁可以登录的名单活在发布里，而不在数据库里。该行现已存在（gaohe -> gaohe@mti.co.id，角色 supplier，界面语言按其联系人余维柱设为中文），并且在本次发布上线到 GitHub Pages 之前，该账号确实无法使用 —— Supabase 端不需要重设任何东西。临时密码与强制改密界面均无变化。",
};
