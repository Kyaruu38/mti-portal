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

export const VERSION = 'v31.2';
export const VERSION_DATE = '25 Nov 2026';

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
  id: "PEDOMAN BERHENTI MENGKLAIM NILAI YANG TIDAK ADA DI LABELNYA — LUBANG KEDUA, LEWAT JALUR LAIN. v31.1 sudah menutup kasus 'medan ketemu tapi gagal disulih'. Diuji pada 12 baris NYATA dari master MTI, lubangnya ternyata masih terbuka lewat pintu yang berbeda: ERP 010504044ID menghasilkan artwork CHAOYANG yang mencetak pola EZ336 dan Load Range L, sementara pedomannya menuliskan pattern CR926 dan load_range G — tanpa satu pun tanda. SEBABNYA: daftar 'belum tersulih' hanya mengumpulkan medan yang KETEMU lalu gagal. Medan yang TIDAK KETEMU SAMA SEKALI tidak pernah masuk daftar — dan kalau jangkarnya tidak ketemu, daftar medan cocoknya KOSONG, sehingga loop pengumpul itu tidak berjalan satu putaran pun. Nama pola di artwork CHAOYANG adalah KURVA, jadi tidak pernah ketemu, jadi tidak pernah tercatat. Dokumen yang dipakai MEMERIKSA label kembali jadi dokumen yang membenarkan kesalahannya. Sekarang daftarnya dihitung dari SELURUH medan templat dengan definisi yang tidak punya celah: sebuah medan BELUM TERSULIH kalau nilainya datang dari baris data, nilainya ADA, dan medan itu tidak berakhir tertulis di artworknya — apa pun sebabnya, ketemu atau tidak. Ditambah: laporan sulih() ikut dibaca balik, karena penolakan 'kotaknya di luar halaman' dan 'tidak muat di kotaknya' terjadi SESUDAH penyusunan selesai dan sebelumnya tidak pernah disambungkan kembali. ARTWORK YANG SUDAH BENAR BERHENTI DILAPORKAN GAGAL. ERP 010504061ID dilaporkan 'tidak ada medan yang bisa disulih', padahal artwork dasar GOODRIDE SNI/TBR memang DIPANEN DARI ERP ITU SENDIRI — tujuh medannya sudah tepat dan tidak ada yang perlu disentuh. 'Tidak ada yang PERLU diganti' dan 'tidak ada yang BISA diganti' adalah dua keadaan yang berlawanan; tanpa membedakannya, yang pertama dilaporkan sebagai kegagalan dan orangnya mencari sebab yang tidak ada. Sekarang nol gantian hanya gagal kalau tidak ada medan yang ketemu sama sekali. DIUKUR PADA MASTER YANG SEBENARNYA, dan angkanya layak dilihat: dari 1.572 item bermerek, 513 siap dibuatkan artwork tapi hanya 111 yang datanya lengkap; 774 item ditolak karena nama barangnya tidak punya prefiks konstruksi seperti (ID-WL-TBR-PT). 661 di antaranya sebenarnya bisa ditebak dari bentuk ukurannya — dan atas keputusan Kyaru, portal TIDAK menebaknya. Menebak konstruksi yang salah menghasilkan templat yang salah, dan label yang terlihat benar. Prefiksnya diperbaiki di master, bukan dikarang di portal. 12 baris nyata, 12 artwork, nol gagal, 24 halaman. 37 berkas uji dijalankan, semuanya bersih.",
  en: "THE GUIDE PAGE STOPPED CLAIMING VALUES NOT ON THE LABEL — SECOND HOLE, DIFFERENT DOOR. v31.1 closed the 'field found but substitution failed' case. Tested on 12 REAL rows from the MTI master, the hole was still open through a different door: ERP 010504044ID produced a CHAOYANG artwork printing pattern EZ336 and Load Range L, while its guide page wrote pattern CR926 and load_range G — with no mark at all. THE CAUSE: the 'not substituted' list only collected fields that were FOUND and then failed. Fields NOT FOUND AT ALL never entered the list — and when the anchor is not found the match list is EMPTY, so that collecting loop never runs a single iteration. The pattern name in the CHAOYANG artwork is a CURVE, so it was never found, so it was never recorded. The document used to CHECK the label became, again, the document certifying its error. The list is now computed over EVERY template field with a definition that has no gap: a field is NOT SUBSTITUTED when its value comes from the data row, the value EXISTS, and the field did not end up written into the artwork — for any reason, found or not. Plus: sulih()'s own report is read back, because its 'box outside the page' and 'does not fit in its box' rejections happen AFTER assembly finishes and were never reconnected. ARTWORK THAT WAS ALREADY CORRECT STOPPED BEING REPORTED AS A FAILURE. ERP 010504061ID was reported as 'no field can be substituted', when the GOODRIDE SNI/TBR base artwork was HARVESTED FROM THAT VERY ERP — seven of its fields were already right and none needed touching. 'Nothing NEEDS changing' and 'nothing CAN be changed' are opposite states; without the distinction the first is reported as a failure and someone hunts for a cause that does not exist. Zero substitutions now fails only when no field was found at all. MEASURED ON THE REAL MASTER, and the numbers are worth seeing: of 1,572 branded items, 513 are ready for artwork but only 111 have complete data; 774 are refused because the item name has no construction prefix such as (ID-WL-TBR-PT). 661 of those could in fact be guessed from the shape of the size — and by Kyaru's decision, the portal does NOT guess. A wrongly guessed construction yields the wrong template and a label that looks right. The prefix gets fixed in the master, not invented in the portal. 12 real rows, 12 artworks, zero failures, 24 pages. 37 test files run, all clean.",
  zh: "指引页不再声称标签上没有的值 — 第二个漏洞，另一个入口。v31.1 已经堵上了「字段找到了但替换失败」这一情形。在 MTI 主数据的 12 条真实记录上测试后发现，漏洞仍从另一个入口敞开着：ERP 010504044ID 生成的朝阳图稿印着花纹 EZ336 与 Load Range L，而其指引页写的却是 pattern CR926 与 load_range G — 没有任何标记。原因：「未替换」清单只收集那些被找到、随后失败的字段。根本没被找到的字段从未进入清单 — 而当锚点找不到时匹配清单是空的，于是那个收集循环一次都不会执行。朝阳图稿中的花纹名是曲线，所以从未被找到，也就从未被记录。用来核对标签的文件，再一次成了为其错误背书的文件。现在该清单基于全部模板字段计算，采用没有缝隙的定义：当一个字段的值来自数据行、该值存在、且该字段最终未被写入图稿时，它就是未替换 — 无论什么原因，找到与否。此外：sulih() 自身的报告会被回读，因为它的「方框在页面之外」与「在方框内放不下」这两种拒绝发生在组装完成之后，而此前从未被重新接回。本已正确的图稿不再被报告为失败。ERP 010504061ID 曾被报告为「没有可替换的字段」，而 GOODRIDE SNI/TBR 的基础图稿正是从该 ERP 采集的 — 它的七个字段本就正确，无需改动。「无需改动」与「无法改动」是相反的两种状态；不加区分，前者就会被报告为失败，而有人会去寻找一个并不存在的原因。现在只有在完全没有找到任何字段时，零替换才算失败。在真实主数据上测得的数字值得一看：1,572 个有品牌的物料中，513 个已可生成图稿，但只有 111 个数据完整；774 个被拒，因为物料名称没有形如 (ID-WL-TBR-PT) 的构造前缀。其中 661 个其实可以从规格的形态推断 — 而按 Kyaru 的决定，门户不作推断。构造推断错误会导致模板错误，以及一张看起来正确的标签。前缀应在主数据中修正，而不是在门户中臆造。12 条真实记录，12 份图稿，零失败，24 页。已运行 37 个测试文件，全部干净。",
};
