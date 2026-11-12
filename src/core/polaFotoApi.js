// Pembacaan tabel `pola_foto` dari Supabase. Aturan pencocokannya ada di
// core/polaFoto.js dan sengaja tidak ada di sini — lihat catatan di sana.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';
import { padatKetat, padatPola, padatPolos } from './polaFoto.js';

export function fromRow(row) {
  return {
    kode: row.kode,
    driveId: row.drive_id,
    urlLihat: row.url_lihat,
    urlGambar: row.url_gambar,
    // Dihitung di klien, bukan dibaca dari kolom: kolomnya generated di
    // Postgres dan bisa saja belum ada di basis data yang tertinggal versi.
    kodeKetat: padatKetat(row.kode),
    kodePlus: padatPola(row.kode),
    kodePolos: padatPolos(row.kode),
  };
}

export async function fetchPolaFoto() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('pola_foto').select('kode,drive_id,url_lihat,url_gambar').order('kode').range(a, b));
  // Tabelnya mungkin belum dibuat di basis data yang belum dimigrasi. Itu
  // bukan kegagalan yang perlu menjatuhkan apa pun: null berarti "tidak
  // terbaca", dan st.polaFoto lokal dibiarkan seperti semula — pola yang sama
  // dengan labelTrend di session.js.
  if (error) { console.error('fetchPolaFoto gagal:', error); return null; }
  return data.map(fromRow);
}
