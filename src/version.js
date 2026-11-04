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

export const VERSION = 'v21.1';
export const VERSION_DATE = '4 Nov 2026';

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
  id: "ANTREAN APPROVAL MEMBERI KABAR SENDIRI, TANPA HALAMANNYA DIGAMBAR ULANG. Sebelum ini satu-satunya cara tahu ada PO baru menunggu approval adalah menekan refresh — dan menekan refresh berarti kehilangan apa pun yang sedang dikerjakan di layar lain. PERSOALANNYA BUKAN 'BAGAIMANA MENYEGARKAN', TAPI 'APA YANG BOLEH DISENTUH'. mount() di core/dom.js tidak punya diffing: setiap setState() menghapus seluruh isi halaman lalu membangunnya ulang dari nol. Pemeriksaan latar yang memanggil setState tiap menit berarti qty surat jalan yang baru separuh diketik hilang, fokus terlempar ke body, dan modal yang sedang dibuka tertutup sendiri — tepat yang diminta untuk TIDAK terjadi. Catatan yang sama sudah tertulis di updateCheck.js dan di searchInput(); ini jebakan yang sudah dua kali menggigit berkas lain. JADI PENYEGARANNYA DIPECAH TIGA TINGKAT, dari yang paling murah. Pertama PROBE: satu query count head-only, nol baris ditarik dari server. Kalau angkanya sama dengan yang sudah dipegang, siklusnya berhenti di sini — dan itu yang terjadi hampir setiap kali. Kedua DATA: angkanya berubah, baru daftar PO ditarik dan ditulis ke state TANPA setState. Datanya sudah benar di memori; layarnya belum tahu, dan memang belum perlu tahu. Ketiga LAYAR: lencana di sidebar ditambal LANGSUNG ke DOM lewat satu textContent, bukan lewat mount — halaman tidak disentuh sama sekali. Gambar ulang penuh hanya terjadi kalau orangnya memang sedang menatap layar approval DAN tangannya sedang tidak di atas apa pun. PERTANYAAN 'SEDANG MEMEGANG SESUATU?' DIJAWAB DARI DOM, BUKAN DARI DAFTAR KUNCI STATE. Daftar kunci harus diperbarui setiap kali ada modal baru lahir, dan yang lupa diperbarui tidak menimbulkan error — ia cuma menggambar ulang halaman orang di saat yang salah, sekali, tanpa meninggalkan jejak. Semua modal memakai satu kelas .overlay yang sama dari components.js, jadi pertanyaannya bisa dijawab sekali untuk selamanya: ada input yang sedang fokus, atau ada overlay terbuka, berarti tahan. LENCANANYA SEKARANG SELALU ADA DI DOM, cuma disembunyikan waktu nol. Simpul yang baru lahir kalau angkanya di atas nol berarti tambalan pertama — justru yang paling penting, dari nol jadi satu — tidak punya apa pun untuk ditambal, dan kabar pertama itulah yang hilang. Cakupannya sengaja approval saja dulu. Satu sumber, satu hitungan, satu tempat yang bisa salah — bukan waktunya menambah permukaan baru di portal yang sedang dibereskan bugnya.",
  en: "THE APPROVAL QUEUE ANNOUNCES ITSELF, WITHOUT THE PAGE BEING REDRAWN. Until now the only way to learn that a PO was waiting for approval was to hit refresh — and hitting refresh meant losing whatever was being typed on another screen. THE QUESTION IS NOT 'HOW TO REFRESH' BUT 'WHAT MAY BE TOUCHED'. mount() in core/dom.js has no diffing: every setState() clears the whole page and rebuilds it from nothing. A background check calling setState every minute means a half-typed Surat Jalan quantity is gone, focus is thrown to body, and an open modal closes itself — precisely what was asked not to happen. The same note is already written in updateCheck.js and in searchInput(); this trap has bitten two other files already. SO THE REFRESH IS SPLIT INTO THREE TIERS, cheapest first. First the PROBE: one head-only count query, zero rows pulled from the server. If the number matches what is already held, the cycle stops there — and that is what happens almost every time. Second the DATA: the number changed, so the PO list is fetched and written into state WITHOUT setState. The data is now correct in memory; the screen does not know yet, and does not need to. Third the SCREEN: the sidebar badge is patched DIRECTLY into the DOM through one textContent, not through mount — the page is not touched at all. A full redraw happens only when the person is actually looking at the approval screen AND their hands are not on anything. THE QUESTION 'ARE THEY HOLDING SOMETHING?' IS ANSWERED FROM THE DOM, NOT FROM A LIST OF STATE KEYS. A key list has to be updated every time a new modal is born, and forgetting to update it raises no error — it simply redraws someone's page at the wrong moment, once, leaving no trace. Every modal shares the one .overlay class from components.js, so the question can be answered once and for all: an input has focus, or an overlay is open, therefore hold. THE BADGE NOW ALWAYS EXISTS IN THE DOM, merely hidden at zero. A node that is only born when the count exceeds zero means the first patch — the most important one, zero to one — has nothing to patch, and that first piece of news is exactly the one that goes missing. The scope is deliberately approvals only for now. One source, one count, one place that can be wrong — this is not the moment to add new surface to a portal whose bugs are still being cleared.",
  zh: "审批队列会自己通报，而页面不会被重绘。在此之前，得知有采购单等待审批的唯一方式就是手动刷新 — 而刷新意味着丢失在其他界面上正在输入的一切。问题不是「如何刷新」，而是「什么可以被触碰」。core/dom.js 中的 mount() 没有差异比对：每次 setState() 都会清空整个页面并从零重建。每分钟调用一次 setState 的后台检查，意味着刚输入一半的送货单数量消失、焦点被抛回 body、已打开的模态框自行关闭 — 正是被要求不要发生的事。同样的提醒早已写在 updateCheck.js 和 searchInput() 中；这个陷阱已经咬过另外两个文件。因此刷新被拆成三层，从最廉价的开始。第一层探测：一次 head-only 的计数查询，服务器不返回任何行。若数字与已持有的一致，本轮到此为止 — 而这几乎是每一次的情形。第二层数据：数字变了，才拉取采购单列表并写入 state，且不调用 setState。数据此刻在内存中已经正确；界面尚不知情，也无需知情。第三层界面：侧边栏徽章通过一次 textContent 直接打补丁进 DOM，而非经由 mount — 页面完全不被触碰。只有当用户确实正注视审批界面、且双手并未停留在任何控件上时，才会进行完整重绘。「用户是否正握着什么？」这个问题由 DOM 回答，而非由一份 state 键名清单回答。键名清单每诞生一个新模态框就得更新一次，而忘记更新不会报错 — 它只会在错误的时刻重绘别人的页面，一次，且不留痕迹。所有模态框共用 components.js 中同一个 .overlay 类，因此这个问题可以一劳永逸地回答：有输入框获得焦点，或有遮罩层打开，就按住不动。徽章现在始终存在于 DOM 中，仅在为零时隐藏。一个只在计数大于零时才诞生的节点，意味着第一次打补丁 — 恰恰是最重要的那次，从零到一 — 无物可补，而丢失的正是这第一条消息。范围刻意先限定为审批。一个来源、一个计数、一处可能出错的地方 — 现在不是给一个仍在清理缺陷的门户增加新表面的时候。",
};
