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

export const VERSION = 'v24.5';
export const VERSION_DATE = '9 Nov 2026';

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
  id: "\"GW KALO MAU CHECK AUTO CREATED ARTWORK NYA GMN?\" — DAN SAMPAI VERSI INI JAWABANNYA MEMANG TIDAK ADA. Begitu berkasnya jadi, dia langsung terunduh dan layarnya selesai bicara. Artinya memeriksa berarti membuka folder Unduhan, membuka artwork aslinya di Drive, lalu mencocokkan 13 medan dari ingatan di antara dua jendela. Tidak ada orang yang memeriksa dengan cara itu — yang terjadi berkasnya dipakai tanpa diperiksa, dan itu akibat dari rancangan layarnya, bukan kecerobohan orangnya. Sekarang hasilnya TIDAK langsung terunduh. Yang muncul: tombol ‘buka hasilnya’ dan ‘buka aslinya’ di dua tab terpisah — pembaca PDF bawaan browser jauh lebih baik buat memeriksa daripada apa pun yang bisa dibuat di layar ini, karena bisa dizoom dan teksnya bisa dicari — lalu dua gambar berdampingan SEBELUM dan SESUDAH, dan daftar tiap medan dengan nilai lamanya DICORET di sebelah nilai barunya. Gambar menangkap yang tidak ada di daftar mana pun (warna hilang, blok bergeser, tulisan menimpa tetangganya); daftar menangkap yang tidak kelihatan di gambar (nilainya mendarat, tapi apakah itu nilai yang dimaksud). Dua-duanya perlu. Mengunduh jadi tombol yang ditekan SESUDAH diperiksa, bukan akibat samping. TAUTAN MEMBUKA BERKASNYA DIBUAT SEBELUM PRATINJAUNYA, dan itu karena ujinya menemukan layar yang menyandera dirinya sendiri: waktu perender PDF menggantung — tidak berhasil, tidak juga gagal — yang tertinggal cuma tulisan ‘menggambar pratinjau…’ tanpa satu pun jalan membuka hasilnya. Cara memeriksa yang paling penting tidak boleh bergantung pada bagian yang paling mungkin gagal. Pratinjaunya juga diberi batas 25 detik dan sebab kegagalannya ikut ditulis, karena ‘menggambar pratinjau…’ yang tidak pernah berubah adalah layar yang berbohong tentang keadaannya sendiri. Diperiksa di Chromium sungguhan, bukan cuma di jsdom: pdf.js merender berkas hasil sulih dengan benar — kotak halamannya [0, −13, 286.3, 640.63], jadi pita tanda yang menjorok ke bawah garis potong memang terbaca browser dan tidak menggeser apa pun. Uji barunya (test-periksa-artwork.mjs, 19 pemeriksaan) menjalankan pemilih berkas layarnya SUNGGUHAN pada artwork SNI sungguhan dan menghitung apa yang muncul sesudahnya, termasuk bahwa tidak ada unduhan yang terpicu sendiri. 13 berkas uji, 260 pemeriksaan, semua lulus.",
  en: "\"HOW DO I CHECK THE AUTO-CREATED ARTWORK?\" — AND UNTIL THIS VERSION THERE WAS NO ANSWER. Once the file was built it downloaded immediately and the screen stopped talking. Checking therefore meant opening the Downloads folder, opening the original artwork on Drive, and reconciling 13 fields from memory across two windows. Nobody checks that way — what happens is the file gets used unchecked, and that follows from the screen's design, not from carelessness. Now the result does NOT download on its own. What appears: ‘open the result’ and ‘open the original’ in two separate tabs — the browser's own PDF reader is a far better checking tool than anything this screen could build, because it zooms and its text is searchable — then two images side by side, BEFORE and AFTER, and a list of every field with its old value STRUCK THROUGH beside the new one. The images catch what no list shows (colour gone, a block shifted, text landing on its neighbour); the list catches what the image cannot show (the value landed, but is it the intended value). Both are needed. Downloading becomes a button pressed AFTER checking, not a side effect. THE OPEN LINKS ARE BUILT BEFORE THE PREVIEW, because the test found a screen holding itself hostage: when the PDF renderer hung — neither succeeding nor failing — all that remained was ‘drawing preview…’ with no way at all to open the result. The most important way to check must not depend on the part most likely to fail. The preview also gets a 25-second limit and reports why it failed, because a ‘drawing preview…’ that never changes is a screen lying about its own state. Verified in real Chromium, not only in jsdom: pdf.js renders the substituted file correctly — page box [0, −13, 286.3, 640.63], so the mark band that extends below the die-cut line is read properly by the browser and shifts nothing. The new test (test-periksa-artwork.mjs, 19 assertions) drives the screen's REAL file picker against real SNI artwork and counts what appears afterwards, including that no download fires by itself. 13 test files, 260 assertions, all passing.",
  zh: "「我要怎么检查自动生成的图稿？」 — 而在这一版之前确实没有答案。文件一生成就立即下载，界面便不再说话。于是检查就意味着打开下载文件夹、在 Drive 上打开原始图稿，然后在两个窗口之间凭记忆核对 13 个字段。没有人会那样检查 — 实际发生的是文件未经检查就被使用，而这源于界面的设计，不是人的疏忽。现在结果不会自行下载。出现的是：「打开结果」和「打开原件」两个独立标签页 — 浏览器自带的 PDF 阅读器作为检查工具远胜于这个界面所能构建的任何东西，因为它可以缩放且文字可搜索 — 然后是并排的「之前」与「之后」两张图，以及每个字段的清单，旧值加删除线置于新值旁边。图像能捕捉清单显示不出的问题（颜色丢失、色块位移、文字压到邻位）；清单能捕捉图像看不出的问题（值落位了，但是否是预期的那个值）。两者缺一不可。下载变成检查之后才按的按钮，而不是附带结果。打开链接在预览之前构建，因为测试发现了一个把自己扣为人质的界面：当 PDF 渲染器挂起时 — 既不成功也不失败 — 屏幕上只剩「正在绘制预览…」，而完全没有打开结果的途径。最重要的检查方式不能依赖最可能失败的部分。预览还设了 25 秒上限并写明失败原因，因为永远不变的「正在绘制预览…」是在对自身状态撒谎。在真实的 Chromium 中验证过，而不仅是 jsdom：pdf.js 能正确渲染替换后的文件 — 页面框为 [0, −13, 286.3, 640.63]，因此伸出模切线之下的标记条带确实被浏览器正确读取，且没有移动任何内容。新测试（test-periksa-artwork.mjs，19 项断言）以界面真实的文件选择器处理真实 SNI 图稿，并清点其后出现的内容，包括没有任何下载被自行触发。13 个测试文件，260 项断言，全部通过。",
};
