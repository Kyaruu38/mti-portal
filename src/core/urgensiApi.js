// =============================================================================
// Persistensi daftar urgensi label. Dua tabel, dua pekerjaan berbeda.
//
//   label_urgensi            koreksi manusia atas angka berkas
//   label_urgensi_snapshot   keadaan ETA tiap unggahan, untuk melacak geseran
//
// DAFTAR GABUNGANNYA SENDIRI TIDAK DISIMPAN. Dia hasil hitungan dari tiga
// berkas yang diunggah tiap periode; menyimpan hasilnya berarti punya dua
// sumber kebenaran yang suatu hari berbeda — dan yang salah justru yang akan
// dipakai membeli, karena dia yang tersimpan. Lihat supabase/sql/urgensi_label.sql.
// =============================================================================

import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return {
    kunci: row.kunci,
    fisik: row.fisik == null ? null : Number(row.fisik),
    butuh: row.butuh == null ? null : Number(row.butuh),
    catatan: row.catatan || '',
    oleh: row.oleh || '',
    pada: row.pada || '',
    riwayat: row.riwayat || [],
  };
}

/** Semua koreksi, sebagai objek berkunci `kunci` — bentuk yang dipakai gabungkan(). */
export async function fetchKoreksi() {
  if (!isConfigured()) return {};
  const c = await getClient();
  if (!c) return {};
  const rows = await fetchAllPaged((from, to) =>
    c.from('label_urgensi').select('*').order('kunci', { ascending: true }).range(from, to));
  const out = {};
  for (const r of rows) out[r.kunci] = fromRow(r);
  return out;
}

/**
 * Menyimpan satu koreksi.
 *
 * `medan` menyebut medan mana yang IKUT DIKIRIM, terpisah dari nilainya. Itu
 * bukan kerumitan yang bisa dihemat: null di sini adalah nilai yang SAH
 * ("batalkan koreksi, pakai angka berkas"), jadi dia tidak bisa sekaligus
 * berarti "jangan diubah". Tanpa pemisahan ini, mengoreksi `fisik` saja akan
 * menghapus koreksi `butuh` yang sudah ada.
 */
export async function simpanKoreksi({ kunci, medan, fisik, butuh, catatan, oleh }) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.rpc('label_urgensi_koreksi', {
    p_kunci: kunci,
    p_medan: medan,
    p_fisik: fisik == null ? null : Number(fisik),
    p_butuh: butuh == null ? null : Number(butuh),
    p_catatan: catatan == null ? null : String(catatan),
    p_oleh: oleh || null,
  });
  if (error) throw error;
  return data;
}

/** Dua snapshot terakhir — itu yang dibutuhkan untuk menghitung pergerakan. */
export async function fetchSnapshotTerakhir(n = 2) {
  if (!isConfigured()) return [];
  const c = await getClient();
  if (!c) return [];
  const { data, error } = await c.from('label_urgensi_snapshot')
    .select('id, at, oleh, berkas, eta, ringkasan')
    .order('at', { ascending: false }).limit(n);
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, at: r.at, oleh: r.oleh || '', berkas: r.berkas || '', eta: r.eta || {}, ringkasan: r.ringkasan || null }));
}

/**
 * Menyimpan snapshot ETA.
 *
 * Dipanggil SESUDAH penggabungan berhasil, bukan saat berkasnya diunggah.
 * Snapshot dari penggabungan yang gagal adalah catatan keadaan yang tidak
 * pernah ada, dan dia akan jadi pembanding untuk unggahan berikutnya.
 */
export async function simpanSnapshot({ eta, ringkasan, berkas, oleh }) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('label_urgensi_snapshot')
    .insert({ eta, ringkasan: ringkasan || null, berkas: berkas || null, oleh: oleh || null })
    .select('id, at').single();
  if (error) throw error;
  return data;
}
