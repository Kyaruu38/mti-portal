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
// KENAPA DI PERAMBAN, BUKAN DI SERVER. Supaya tidak ada yang perlu dipasang
// atau di-deploy dulu: berkasnya tersimpan di IndexedDB peramban ini. Harganya
// jujur dan harus dikatakan ke pemakainya -- komputer lain mulai dari kosong.
// Menaruhnya di Supabase Storage (sekali unggah, semua komputer) jalur yang
// benar berikutnya, dan modul ini sengaja dibuat supaya sumber lain tinggal
// ditambahkan di belakang cari().
// ---------------------------------------------------------------------------

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
  const m = String(merek || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!kunciTemplat) return '';
  // Merek kosong TIDAK dijadikan kunci umum. Artwork dasar tanpa merek akan
  // dipakai untuk merek apa pun di keluarga itu, dan itu persis kesalahan
  // yang kunci ini ada untuk mencegahnya.
  if (!m) return '';
  return kunciTemplat + '|' + m;
}

/** @returns {Promise<{kunci,nama,erpAsal,tanggal,bytes:ArrayBuffer}|null>} */
export async function cari(kunciTemplat, merek) {
  const k = kunciDasar(kunciTemplat, merek);
  if (!k) return null;
  try {
    const baris = await jalan('readonly', t => t.get(k));
    return baris || null;
  } catch { return null; }
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
