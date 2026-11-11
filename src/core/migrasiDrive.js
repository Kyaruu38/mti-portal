// =============================================================================
// MIGRASI DESIGN KE DRIVE PUSAT
// -----------------------------------------------------------------------------
// MASALAHNYA, dan kenapa dia tidak bisa diselesaikan dari dalam portal sendiri:
//
// 635 berkas design dimiliki akun pribadi (canianazhiraadlin@gmail.com),
// sementara arsitektur portal ini menyebut SATU Drive departemen sebagai
// tempatnya -- purchase.ptmti@gmail.com, lewat refresh token yang disimpan
// sebagai secret Supabase (lihat supabase/functions/drive-upload/index.ts,
// "architecture A"). Berkas yang diunggah LEWAT portal sudah benar sejak awal:
// fungsi itu menyetel izinnya 'reader'. Yang 635 itu warisan, di-share tangan,
// dan izinnya 'writer' -- siapa pun yang punya link bisa MENIMPA berkas cetak.
//
// Berkasnya tidak bisa ditarik oleh peramban: Drive tidak mengirim header CORS
// untuk unduhan, jadi fetch() dari halaman portal akan ditolak sebelum satu
// bita pun sampai. Jadi sumbernya HARUS berkas di tangan orangnya -- unduh
// foldernya dari Drive (satu ZIP), buka, lalu serahkan berkasnya ke layar ini.
//
// Sesudah itu jalurnya jalur portal sendiri: uploadToDrive() -> drive-upload ->
// Drive departemen, izin 'reader', dan barisnya di-repoint. Tidak ada token
// yang berpindah tangan dan tidak ada yang perlu login sebagai siapa pun.
//
// YANG TIDAK DILAKUKAN DI SINI, dan itu disengaja:
//
//   1. VERSI TIDAK DINAIKKAN. Ini berkas yang SAMA pindah rumah, bukan artwork
//      baru. gantiArtwork() menaikkan v1->v2 karena di situ gambarnya memang
//      berubah; memakai jalur itu untuk migrasi akan membuat 635 design naik
//      satu versi tanpa satu pun gambarnya berubah, dan sesudahnya tidak ada
//      yang bisa membedakan "versi 2 karena direvisi" dari "versi 2 karena
//      dipindah".
//   2. URL LAMA TIDAK DIHAPUS. Dia masuk riwayat beserta penanda sebabnya.
//      Kalau unggahannya ternyata berkas yang salah, satu-satunya jalan pulang
//      adalah alamat yang lama -- dan membuangnya berarti memotong jalan itu.
//   3. BERKAS LAMA DI DRIVE CANIA TIDAK DISENTUH. Menghapus sumber sebelum
//      yang baru diperiksa orangnya adalah urutan yang salah. Dihapus nanti,
//      oleh pemiliknya, sesudah dia sendiri melihat hasilnya.
// =============================================================================

import { padatkan } from './cariDesain.js';

export const SEBAB_PINDAH = 'pindah ke Drive pusat';

// Sudah pernah dipindah? Dibaca dari riwayat, BUKAN dari kolom baru.
//
// Penandanya ditaruh di riwayat karena riwayat memang sudah menyimpan "alamat
// mana yang dulu dipakai", dan itu tepat yang dibutuhkan untuk menjawab
// pertanyaan ini. Kolom tambahan berarti perubahan skema untuk satu boolean
// yang bisa disimpulkan dari data yang sudah ada.
export function sudahPindah(d) {
  return (d && d.riwayat || []).some(r => r && r.sebab === SEBAB_PINDAH);
}

// Kunci pencocokan berkas -> design.
//
// Nama berkas di Drive diturunkan dari spec-nya, dengan garis miring diganti
// spasi oleh Drive sendiri:
//   design.spec  'ID295/80R22.5-18PR(152/149L)[EZ573]WESTLAKE TL'
//   nama berkas  'ID295 80R22.5-18PR(152149L)[EZ573]WESTLAKE TL.pdf'
// padatkan() membuang semua yang bukan huruf/angka, jadi dua bentuk itu jadi
// satu teks yang sama. Itu sebabnya pencocokannya BUKAN cocok-sebagian dan
// bukan fuzzy: dua design yang berbeda bisa cuma beda satu huruf di kode pola,
// dan "yang paling mirip" di situ berarti menimpa artwork design yang salah.
export function kunciCocok(teks) {
  return padatkan(String(teks || '').replace(/\.(pdf|png|jpe?g|webp)$/i, ''));
}

// Kunci cadangan: ERP. Sebagian berkas dinamai kode ERP-nya, bukan spec-nya.
const kunciErp = (s) => padatkan(s);

/**
 * Mencocokkan daftar berkas ke daftar design.
 *
 * Mengembalikan { pasangan, takCocok, ganda, sudah }.
 *   pasangan  [{ file, design }]  -- cocok TUNGGAL dan belum dipindah
 *   sudah     [{ file, design }]  -- cocok tapi riwayatnya bilang sudah pindah
 *   ganda     [{ file, designs }] -- cocok ke LEBIH DARI SATU design
 *   takCocok  [file]              -- tidak cocok ke design mana pun
 *
 * `ganda` TIDAK diselesaikan dengan menebak. Dua design yang punya spec sama
 * padatnya memang ada (ERP berbeda, spec identik), dan memilih salah satunya
 * berarti satu design dapat artwork yang bukan miliknya sementara yang lain
 * tetap di Drive lama -- dua kerusakan dari satu tebakan. Yang begini dipindah
 * tangan, satu-satu, lewat tombol Ganti Artwork yang sudah ada.
 */
export function cocokkanBerkas(files, designs) {
  const perSpec = new Map();
  const perErp = new Map();
  const taruh = (peta, k, d) => { if (!k) return; const a = peta.get(k); if (a) a.push(d); else peta.set(k, [d]); };
  for (const d of (designs || [])) {
    taruh(perSpec, kunciCocok(d.spec), d);
    taruh(perErp, kunciErp(d.erp), d);
  }

  const pasangan = [], takCocok = [], ganda = [], sudah = [];
  for (const f of (files || [])) {
    const nama = (f && f.name) || '';
    const k = kunciCocok(nama);
    // Spec duluan, ERP cadangan. Bukan sebaliknya: kode ERP itu angka, dan
    // angka bisa muncul di dalam nama berkas yang sebenarnya spec.
    let kandidat = (k && perSpec.get(k)) || (k && perErp.get(k)) || [];
    if (!kandidat.length) { takCocok.push(f); continue; }
    if (kandidat.length > 1) { ganda.push({ file: f, designs: kandidat.slice() }); continue; }
    const d = kandidat[0];
    (sudahPindah(d) ? sudah : pasangan).push({ file: f, design: d });
  }
  return { pasangan, takCocok, ganda, sudah };
}

/**
 * Menyusun patch untuk satu design yang berkasnya sudah terunggah.
 * Dipisah dari unggahannya supaya bisa diuji tanpa jaringan.
 *
 * `ver` DIOPER APA ADANYA. Lihat catatan nomor 1 di kepala berkas ini.
 */
export function patchPindah(d, { url, thumb, oleh, tanggal }) {
  const riwayat = [...(d.riwayat || []), {
    ver: d.ver || 'v1',
    driveUrl: d.driveUrl || '',
    thumb: d.thumb || '',
    tanggal,
    oleh,
    sebab: SEBAB_PINDAH,
  }];
  return {
    driveUrl: url,
    // Thumb baru dipakai kalau berhasil dirender; kalau gagal, yang LAMA
    // dipertahankan. Mengosongkannya berarti kartu yang tadinya bergambar
    // jadi kosong gara-gara migrasi -- kemunduran yang kelihatan di layar
    // semua orang, demi medan yang bisa diisi ulang kapan saja.
    thumb: thumb || d.thumb || '',
    ver: d.ver,
    updated: tanggal,
    riwayat,
  };
}
