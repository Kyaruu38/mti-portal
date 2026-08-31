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

export const VERSION = 'v15.24';
export const VERSION_DATE = '31 Agu 2026';

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
      id: "ADA JALAN KETIGA SEBUAH BERKAS SELESAI, DAN PORTAL BUTA TERHADAPNYA. Spanduk merah menawarkan satu tindakan: tempel link Drive-nya. Tapi orangnya menemukan jalan lain duluan — MENGUNGGAH ULANG dokumennya lewat layar PPKEK. Itu sah, dan sesudahnya pekerjaannya memang sudah selesai: unggahan barunya berhasil dan dokumennya menempel di record-nya. Yang tidak terjadi adalah baris LAMA ikut tertutup, karena unggah ulang membuat baris antrean BARU dan dua baris itu tidak saling kenal. Tidak ada apa pun yang menghubungkan \"dokumen ini sudah diunggah ulang\" dengan \"baris lama ini boleh ditutup\". Jadi sesudah dua bundel PPKEK diunggah ulang — 010395 tiga belas dokumen, 009969 dua belas dokumen — spanduknya tetap berbunyi sebelas, persis seperti sebelumnya, dan terlihat seperti tidak ada yang terjadi. Spanduk yang menuntut pekerjaan yang SUDAH dikerjakan akan diabaikan orang, dan spanduk yang diabaikan tidak menyelamatkan berkas berikutnya. Itu kerusakan yang lebih pelan daripada spanduk hantu di v15.21 dan berakhir di tempat yang sama. Sekarang tiap entri punya dua tombol: NAMANYA untuk menempelkan link, dan tanda silang di sebelahnya untuk MENUTUP barisnya karena urusannya selesai di tempat lain. Alasannya WAJIB diisi, dan itu bukan basa-basi konfirmasi: baris yang ditutup tanpa keterangan tidak bisa dibedakan enam bulan lagi dari baris yang ditutup karena orangnya capek melihatnya — yang satu catatan, yang satu lubang. Isian alasannya sudah terisi awal \"sudah diunggah ulang\" karena itu yang paling sering, tapi tetap bisa diganti. drive_url sengaja DIBIARKAN KOSONG untuk baris yang ditutup begini: ia ditutup karena urusannya beres di tempat lain, bukan karena link-nya ketemu, dan mengarang link di situ akan membuat baris yang berbohong tentang dirinya sendiri. Toast penutupnya juga tidak berpura-pura: ia menyebut bahwa barisnya ditutup TANPA link dan menyuruh mengecek lagi kalau ternyata dokumennya belum menempel di record-nya. Menempel link tetap jalan yang lebih baik kalau berkasnya memang ada di Drive — yang itu meninggalkan link yang bisa dibuka, yang ini cuma meninggalkan keterangan.",
      en: "THERE IS A THIRD WAY A FILE GETS FINISHED, AND THE PORTAL WAS BLIND TO IT. The red banner offered one action: paste the Drive link. But the person found another route first — RE-UPLOADING the document through the PPKEK screen. That is legitimate, and afterwards the work really is done: the new upload succeeded and the document is attached to its record. What did not happen is the OLD row closing too, because a re-upload creates a NEW queue row and the two rows do not know each other. Nothing connects \"this document has been re-uploaded\" to \"this old row may be closed\". So after two PPKEK bundles were re-uploaded — 010395 with thirteen documents, 009969 with twelve — the banner still read eleven, exactly as before, and looked as though nothing had happened. A banner that demands work ALREADY done gets ignored, and an ignored banner saves no future file. That failure is slower than the ghost banner of v15.21 and ends in the same place. Each entry now has two buttons: ITS NAME to paste a link, and a cross beside it to CLOSE the row because the matter was settled elsewhere. A reason is REQUIRED, and not as a confirmation nicety: a row closed with no explanation cannot be told apart, six months later, from a row closed because someone was tired of looking at it — one is a record, the other is a hole. The reason field is pre-filled with \"already re-uploaded\" because that is the common case, but it stays editable. drive_url is deliberately LEFT EMPTY for rows closed this way: the row closes because the matter is settled elsewhere, not because the link was found, and inventing a link there would make a row that lies about itself. The closing toast does not pretend either: it says the row was closed with NO link and to check again if the document turns out not to be on its record. Pasting a link remains the better route when the file really is in Drive — that one leaves a link someone can open, this one only leaves an explanation.",
      zh: "文件完成其实还有第三条路，而门户对此视而不见。红色横幅只提供一个操作：粘贴 Drive 链接。但使用者先找到了另一条路 — 通过 PPKEK 页面重新上传文件。这是合理的，而且之后工作确实已经完成：新的上传成功了，文件也已挂到对应单据上。没有发生的是旧记录随之关闭，因为重新上传会创建一条新的队列记录，而这两条记录彼此并不认识。没有任何东西把「此文件已重新上传」与「这条旧记录可以关闭」联系起来。因此在两个 PPKEK 批次重新上传之后 — 010395 十三份文件、009969 十二份文件 — 横幅仍然显示十一，与之前完全一样，看起来就像什么都没发生。一个要求人们去做已经做完的事的横幅会被忽略，而被忽略的横幅救不了下一个文件。这种失效比 v15.21 的幽灵横幅更缓慢，却通向同一个终点。现在每一项都有两个按钮：文件名用于粘贴链接，旁边的叉号用于关闭该条，因为事情已在别处了结。原因是必填的，这不是确认时的客套：一条没有说明就被关闭的记录，六个月后无法与「有人看烦了就关掉」的记录区分开 — 一个是记录，另一个是漏洞。原因栏预填了「已重新上传」，因为这是最常见的情况，但仍可修改。以这种方式关闭的记录，drive_url 会被有意留空：它之所以关闭是因为事情已在别处了结，而不是因为找到了链接，在那里编造一个链接会让这条记录对自己撒谎。关闭时的提示也不假装：它会说明该条是在没有链接的情况下关闭的，并提示若文件其实未挂在单据上请再确认。当文件确实在 Drive 中时，粘贴链接仍是更好的路径 — 那条路留下的是可以打开的链接，这条路只留下一段说明。",
};
