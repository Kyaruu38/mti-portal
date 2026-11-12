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

// -----------------------------------------------------------------------------
// VARIAN — sudut pandang lain dari pola yang sama.
//
// Tabel terpisah (pola_foto_varian), bukan baris tambahan di pola_foto. Alasan
// lengkapnya ada di supabase/sql/pola_foto_varian.sql; ringkasnya: artwork
// v27.0 memutuskan "cocok" atau "ambigu" dari JUMLAH baris pola_foto yang pas,
// jadi menambah baris per sudut ke sana membuat setiap kode mendadak ambigu
// dan artwork yang tadinya benar berhenti memilih.
// -----------------------------------------------------------------------------
export function fromRowVarian(row) {
  return {
    kode: row.kode,
    bentuk: row.bentuk,
    driveId: row.drive_id,
    urlLihat: row.url_lihat,
    urlGambar: row.url_gambar,
    // Varian TIDAK ikut dicocokkan oleh cariPola(): yang dicari orang kodenya,
    // dan kodenya sama dengan foto utamanya. Bentuk-bentuk padat di sini cuma
    // supaya objeknya seragam kalau nanti ada yang melewatkannya ke sana.
    kodeKetat: padatKetat(row.kode),
    kodePlus: padatPola(row.kode),
    kodePolos: padatPolos(row.kode),
  };
}

export async function fetchPolaFotoVarian() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('pola_foto_varian').select('kode,bentuk,drive_id,url_lihat,url_gambar')
      .order('kode').order('bentuk').range(a, b));
  // null = tidak terbaca, sama seperti fetchPolaFoto(). Tabelnya baru ada
  // sejak v28.0 dan basis data yang belum dimigrasi harus tetap bisa login.
  if (error) { console.error('fetchPolaFotoVarian gagal:', error); return null; }
  return data.map(fromRowVarian);
}
