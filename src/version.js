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

export const VERSION = 'v30.5';
export const VERSION_DATE = '24 Nov 2026';

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
  id: "CAP 'LEMBAR PERIKSA DATA' BERHENTI MENUTUPI BARCODE, DAN UKURAN LEMBARNYA IKUT TERCETAK. Dilaporkan dari lembar periksa SNI: capnya menimpa batang barcode. Sebabnya capnya digambar DI DALAM lembar pada y=8 pt, dan di templat SNI tepat di situlah barcode duduk -- dua hal tercetak di tempat yang sama, dan yang tertutup kebetulan satu-satunya bagian yang dibaca mesin. Sekarang lembarnya DITAMBAH pita 13 mm di bawahnya, bukan dipakai bersama, dengan garis pemisah supaya pita itu tidak terbaca sebagai bagian bawah labelnya sendiri. Isi labelnya tidak bergeser satu medan pun: yPdf memetakan jarak-dari-atas, jadi tinggi tambahannya muncul di bawah dan seluruh koordinat terukurnya tetap. PITANYA CUMA ADA KALAU TANDANYA ADA -- dengan tandaiOtomatis:false keluarannya kembali persis seukuran lembar sebenarnya, karena berkas tanpa tanda berarti dipakai sebagai lembar sungguhan dan lembar sungguhan tidak boleh kelebihan 13 mm. UKURANNYA SEKARANG TERCETAK DI PITA ITU, dan dua angka, bukan satu: pada SNI labelnya memenuhi lembarnya (101x226 = 101x226) sedangkan BX dan PT meletakkan bloknya di lembar A4 yang lebih besar, jadi satu angka saja membuat orang mengira label BX seukuran A4. Kalau keduanya sama, yang tercetak 'label memenuhi lembar'. Nomor ERP ikut di baris yang sama. Uji ukurannya dipecah jadi tiga dan satu di antaranya baru: lebar harus persis templat, tinggi harus templat + pita, dan tanpa tanda otomatis harus kembali persis seukuran lembar -- yang terakhir itu yang menjaga supaya pita yang benar untuk proof tidak diam-diam ikut ke berkas yang akan dicetak. 34 berkas uji dijalankan, semuanya keluar bersih.",
  en: "THE 'DATA CHECK SHEET' STAMP STOPS COVERING THE BARCODE, AND THE SHEET SIZE IS NOW PRINTED. Reported from the SNI check sheet: the stamp sat on top of the barcode bars. It was drawn INSIDE the sheet at y=8 pt, and on the SNI template that is exactly where the barcode sits -- two things printed in the same place, and the one covered happened to be the only part a machine reads. The sheet now GAINS a 13 mm band below it rather than sharing space, with a separator line so the band does not read as the bottom of the label itself. Not one field moves: yPdf maps distance from the top, so the extra height appears below and every measured coordinate stays put. THE BAND EXISTS ONLY WHERE THE STAMP DOES -- with tandaiOtomatis:false the output returns to exactly the real sheet size, because an unmarked file is meant to be used as a real sheet and a real sheet must not carry 13 mm of extra paper. THE SIZE IS PRINTED IN THAT BAND, and as two numbers rather than one: on SNI the label fills its sheet (101x226 = 101x226) while BX and PT place their block on a larger A4 sheet, so a single number would let someone think a BX label is A4-sized. When the two match it prints 'label fills the sheet'. The ERP number rides on the same line. The size test is split into three, one of them new: width must equal the template exactly, height must equal template plus band, and with the automatic mark off the output must return to the exact sheet size -- that last one is what stops a band that is right for a proof from quietly reaching a file meant for printing. 34 test files run, all exit clean.",
  zh: "“数据核对页”印记不再遮挡条码，并且会打印出纸张尺寸。来自 SNI 核对页的反馈：印记压在条码条纹上。原因是它被画在纸张内部 y=8 pt 处，而在 SNI 模板中条码恰好就在那个位置——两样东西印在同一处，而被遮住的偏偏是唯一需要机器读取的部分。现在纸张在下方增加 13 mm 的说明条，而不是共用空间，并加上分隔线，以免说明条被当成标签本身的下缘。没有任何一个字段发生位移：yPdf 映射的是距顶部的距离，因此增加的高度出现在下方，所有实测坐标保持不变。只有存在印记时才有说明条——当 tandaiOtomatis 为 false 时，输出会恢复为真实纸张尺寸，因为没有印记的文件意味着会被当作真正的纸张使用，而真正的纸张不该多出 13 mm。尺寸现在打印在该说明条中，并且是两个数字而不是一个：在 SNI 上标签占满整张纸（101x226 = 101x226），而 BX 与 PT 把版块放在更大的 A4 纸上，只给一个数字会让人误以为 BX 标签是 A4 大小。两者相同时则打印“标签占满纸张”。ERP 编号也在同一行。尺寸测试拆成三项，其中一项是新增的：宽度必须与模板完全一致，高度必须等于模板加说明条，而关闭自动标记后输出必须恢复为精确的纸张尺寸——最后这一项正是为了防止适用于校样的说明条悄悄进入将要付印的文件。已运行 34 个测试文件，全部干净退出。",
};
