// ---------------------------------------------------------------------------
// ARTWORK DASAR: artwork sumber yang DIINGAT, supaya tidak dipilih berulang.
//
// MASALAHNYA BUKAN TEKNIS, TAPI JUMLAH LANGKAH. Jalur sulih butuh artwork
// yang sudah ada -- logo, warna, tanda SNI, QR dan blok peringatan semuanya
// VEKTOR di artworknya dan tidak ada di kolom mana pun, jadi tidak bisa
// dirakit dari data. Tapi artwork sumber untuk MEREK dan KELUARGA yang sama
// SELALU berkas yang itu-itu juga. Meminta berkasnya tiap kode ERP berarti
// meminta hal yang sama ratusan kali, dan itulah yang membuat "bikin artwork
// dari data" terasa muter-muter padahal jalurnya sudah jalan.
//
// Jadi berkasnya disimpan sekali per (pasar/konstruksi + merek), dan sesudah
// itu: ketik ERP -> artwork keluar.
//
// KUNCINYA HARUS IKUT MEREK, DAN INI BUKAN KEHATI-HATIAN BERLEBIHAN. Kalau
// kuncinya cuma 'SNI/TBR', artwork dasar GOODRIDE akan dipakai untuk YARTU --
// dan yang keluar adalah label YARTU dengan LOGO GOODRIDE. Datanya semua
// benar, ukurannya benar, NPB-nya benar; yang salah cuma mereknya, dan itu
// satu-satunya kesalahan di daftar ini yang TIDAK terlihat seperti kesalahan.
//
// TIGA SUMBER, DIPAKAI BERURUTAN, DAN URUTANNYA PUNYA ALASAN.
//
//   1. IndexedDB peramban ini. Paling cepat, dan satu-satunya yang menyimpan
//      berkas yang dipilih tangan.
//   2. Artwork milik ERP-nya SENDIRI (designs.drive_url), ditarik lewat fungsi
//      tepi drive-download. Ini yang PALING TEPAT kalau ada: artwork ERP itu
//      sendiri, bukan wakil keluarganya.
//   3. Wakil keluarga dari src/label/dasarPeta.js, juga lewat drive-download.
//      Untuk ERP BARU yang belum punya design sama sekali -- dan itu justru
//      yang paling sering butuh artwork dibuatkan.
//
// KENAPA DULU CUMA PERAMBAN, DAN KENAPA ITU BERUBAH. Dulu tidak ada jalur
// unduh dari Drive sama sekali: Drive memblokir CORS untuk byte PDF-nya, dan
// src/core/drive.js memang cuma punya endpoint unggah. Jadi harganya dibayar
// pemakainya -- komputer lain mulai dari kosong, dan Kyaru bertanya kenapa dia
// harus mengunduh berkas dasar sama sekali kalau datanya sudah ada di Excel.
// Pertanyaannya benar. Yang menahan bukan datanya, tapi tidak adanya jalur
// ambil. Sekarang jalur itu ada (supabase/functions/drive-download), dan
// IndexedDB turun pangkat jadi SINGGAHAN, bukan satu-satunya tempat.
//
// KALAU FUNGSI TEPINYA BELUM DI-DEPLOY, sumber 2 dan 3 mengembalikan null
// dengan sebab, dan layarnya kembali meminta berkas seperti dulu. Tidak ada
// yang rusak kalau deploy-nya belum jalan.
// ---------------------------------------------------------------------------
import { ejaanResmi } from '../parsers/brandMap.js';
import { lihatPeta } from './dasarPeta.js';

const DB = 'mti-artwork-dasar';
const TOKO = 'dasar';
const VERSI = 1;

function buka() {
  return new Promise((selesai, gagal) => {
    if (typeof indexedDB === 'undefined') return gagal(new Error('peramban ini tidak punya IndexedDB'));
    const r = indexedDB.open(DB, VERSI);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(TOKO)) db.createObjectStore(TOKO, { keyPath: 'kunci' });
    };
    r.onsuccess = () => selesai(r.result);
    r.onerror = () => gagal(r.error || new Error('IndexedDB tidak bisa dibuka'));
  });
}

function jalan(mode, fn) {
  return buka().then(db => new Promise((selesai, gagal) => {
    const tx = db.transaction(TOKO, mode);
    const permintaan = fn(tx.objectStore(TOKO));
    tx.oncomplete = () => { db.close(); selesai(permintaan && permintaan.result); };
    tx.onerror = () => { db.close(); gagal(tx.error); };
    tx.onabort = () => { db.close(); gagal(tx.error); };
  }));
}

/**
 * Kunci penyimpanan. Merek dinormalkan supaya 'Goodride' dan 'GOODRIDE '
 * tidak jadi dua artwork dasar yang berbeda untuk ban yang sama.
 */
export function kunciDasar(kunciTemplat, merek) {
  const mentah = String(merek || '').trim();
  if (!kunciTemplat) return '';
  // Merek kosong TIDAK dijadikan kunci umum. Artwork dasar tanpa merek akan
  // dipakai untuk merek apa pun di keluarga itu, dan itu persis kesalahan
  // yang kunci ini ada untuk mencegahnya.
  if (!mentah) return '';
  // EJAAN RESMI, BUKAN SEKADAR HURUF BESAR. 'GOLDENCROWN' dan 'GOLDEN CROWN'
  // dua-duanya ada di tabel designs untuk ban yang sama dari pemasok yang sama
  // (prefiks ID-JG-TBR-SNI di dua-duanya), dan dengan huruf-besar saja mereka
  // jadi DUA artwork dasar -- satu di antaranya artwork yang hurufnya sudah
  // jadi kurva dan tidak bisa dipakai. Orangnya tidak akan pernah tahu kenapa
  // merek yang sama kadang jadi kadang tidak. brandMap.js sudah menyimpan
  // pemetaannya sejak lama; yang kurang cuma dipakai di sini.
  const m = ejaanResmi(mentah) || mentah.toUpperCase().replace(/\s+/g, ' ');
  return kunciTemplat + '|' + m;
}

/**
 * Artwork dasar untuk satu keluarga + merek.
 *
 * @param {string} kunciTemplat  mis. 'PT/TBR'
 * @param {string} merek
 * @param {Object} [opsi]
 * @param {string} [opsi.driveUrl]  artwork milik ERP-nya sendiri, kalau ada.
 *   Didahulukan di atas wakil keluarga -- artwork ERP itu sendiri selalu lebih
 *   tepat daripada artwork saudaranya.
 * @param {Function} [opsi.unduh]  (urlAtauId) => { ok, bytes } | { ok:false, sebab }.
 *   Disuntikkan dari luar, bukan diimpor, supaya modul ini tetap bisa diuji
 *   tanpa jaringan dan tanpa sesi.
 * @returns {Promise<{kunci,nama,erpAsal,tanggal,bytes:ArrayBuffer,asal:string}|null>}
 */
export async function cari(kunciTemplat, merek, opsi = {}) {
  const semua = await cariCalon(kunciTemplat, merek, opsi);
  return semua.length ? semua[0] : null;
}

// UMUR SINGGAHAN DARI DRIVE. Yang dipilih tangan tidak pernah kedaluwarsa --
// itu keputusan orangnya. Yang ditarik dari Drive BOLEH basi: artwork di Drive
// bisa diganti vendor, dan singgahan tanpa umur berarti portal memakai versi
// lama selamanya tanpa ada yang tahu. Enam jam cukup untuk menahan rentetan
// permintaan satu lembar Excel, dan cukup pendek supaya penggantian artwork
// tidak tertahan berhari-hari.
const UMUR_DRIVE_MS = 6 * 60 * 60 * 1000;

/**
 * SEMUA calon artwork dasar, berurutan dari yang paling tepat.
 *
 * KENAPA DAFTAR, BUKAN SATU. Versi sebelumnya mengembalikan calon PERTAMA yang
 * berhasil DIUNDUH, dan pemanggilnya tidak punya jalan mundur kalau calon itu
 * ternyata tidak bisa DISULIH. Terukur pada MASTERTRACK PT/TBR: artwork milik
 * ERP-nya sendiri gagal, sementara wakil keluarganya berhasil -- dan barisnya
 * tetap dilaporkan gagal karena wakil itu tidak pernah dicoba.
 *
 * Berhasil diunduh dan berhasil dipakai adalah dua hal yang berbeda, dan yang
 * memutuskan ada di pemanggilnya, bukan di sini.
 */
export async function cariCalon(kunciTemplat, merek, opsi = {}) {
  const k = kunciDasar(kunciTemplat, merek);
  if (!k) return [];
  const out = [];

  // 1. Singgahan peramban ini.
  try {
    const baris = await jalan('readonly', t => t.get(k));
    if (baris) {
      const basi = baris.dariDrive && baris.tanggal
        && (Date.now() - Date.parse(baris.tanggal)) > UMUR_DRIVE_MS;
      if (!basi) out.push({ ...baris, asal: baris.nama || 'peramban ini' });
    }
  } catch { /* lanjut ke sumber berikutnya, bukan menyerah */ }

  const { driveUrl = '', unduh = null } = opsi;
  if (typeof unduh !== 'function') return out;

  // 2. Artwork milik ERP-nya sendiri. 3. Wakil keluarga dari peta.
  const peta = lihatPeta(kunciTemplat, merek);
  const sumber = [];
  if (driveUrl) sumber.push({ sumber: driveUrl, asal: 'artwork ERP ini di Drive' });
  if (peta && peta.driveId) sumber.push({ sumber: peta.driveId, asal: 'wakil ' + k + ' di Drive' });

  for (const c of sumber) {
    let r;
    try { r = await unduh(c.sumber); } catch (e) { r = { ok: false, sebab: String(e.message || e) }; }
    if (!r || !r.ok) continue;
    const salinan = r.bytes instanceof ArrayBuffer ? r.bytes.slice(0) : new Uint8Array(r.bytes).slice().buffer;
    if (out.some(x => x.bytes && x.bytes.byteLength === salinan.byteLength)) continue;  // sama dengan singgahan
    out.push({ kunci: k, nama: c.asal, erpAsal: '', tanggal: new Date().toISOString(),
               bytes: salinan, asal: c.asal, dariDrive: true });
  }
  return out;
}

/** Menyinggahkan calon yang TERBUKTI berhasil dipakai, bukan yang berhasil diunduh. */
export async function singgahkan(kunciTemplat, merek, calon) {
  const k = kunciDasar(kunciTemplat, merek);
  if (!k || !calon || !calon.bytes) return;
  try {
    await jalan('readwrite', t => t.put({
      kunci: k, nama: calon.asal || calon.nama || '', erpAsal: '',
      tanggal: new Date().toISOString(),
      bytes: calon.bytes.slice(0), dariDrive: !!calon.dariDrive,
    }));
  } catch { /* singgahan gagal bukan alasan menggagalkan apa pun */ }
}

export async function simpan(kunciTemplat, merek, { bytes, nama, erpAsal }) {
  const k = kunciDasar(kunciTemplat, merek);
  if (!k) throw new Error('merek kosong — artwork dasar tidak bisa disimpan tanpa merek');
  const salinan = bytes instanceof ArrayBuffer ? bytes.slice(0) : new Uint8Array(bytes).slice().buffer;
  await jalan('readwrite', t => t.put({
    kunci: k, nama: String(nama || ''), erpAsal: String(erpAsal || ''),
    tanggal: new Date().toISOString(), bytes: salinan,
  }));
  return k;
}

export async function hapus(kunciTemplat, merek) {
  const k = kunciDasar(kunciTemplat, merek);
  if (!k) return;
  try { await jalan('readwrite', t => t.delete(k)); } catch { /* sudah tidak ada */ }
}

/** Semua yang tersimpan, tanpa byte-nya — untuk daftar di layar. */
export async function daftar() {
  try {
    const semua = await jalan('readonly', t => t.getAll());
    return (semua || []).map(({ kunci, nama, erpAsal, tanggal, bytes }) => ({
      kunci, nama, erpAsal, tanggal, ukuran: bytes ? bytes.byteLength : 0,
    }));
  } catch { return []; }
}
