// Supabase persistence for the Label Design Library. Only fetch + insert —
// labelLibrary.js's UI has no edit/delete for designs today (upload-only),
// same reasoning suppliersApi.js has no delete (masterData.js's supplier
// delete button was never actually wired to it either — flagged separately,
// out of scope for this batch).
//
// NOT persisted: `color` (not a schema column — labelLibrary.js's brandTone()
// already derives a swatch color from `brand` when there's no real image) and
// `designUrl` (a local blob: URL from URL.createObjectURL(), browser-session-
// only by nature — can't be persisted or shared across sessions). A design
// fetched into a different session shows the color-swatch fallback for
// designUrl; the real file is still reachable via the Drive link (`driveUrl`).
// `thumb` IS persisted — a small base64 JPEG rendered client-side at upload
// time (parsers/pdf.js renderThumb(), see labelLibrary.js's uploadDesign())
// that DOES survive across sessions, unlike designUrl. It's what Surat Jalan
// pulls into the per-item design box (screens/suratJalan.js).
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return { id: row.id, erp: row.erp, spec: row.spec, brand: row.brand, market: row.market, ver: row.ver, updated: row.updated, driveUrl: row.drive_url, thumb: row.thumb || '', status: row.status, riwayat: row.riwayat || [] };
}
function toRow(d) {
  return { erp: d.erp || null, spec: d.spec || null, brand: d.brand || null, market: d.market || null, ver: d.ver || null, updated: d.updated || null, drive_url: d.driveUrl || null, thumb: d.thumb || null, status: d.status || 'active', riwayat: d.riwayat || [] };
}

export async function fetchDesigns() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('designs').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchDesigns failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertDesign(d) {
  if (!isConfigured()) return d;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('designs').insert(toRow(d)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Partial edit of the four typed fields. Deliberately CANNOT touch `thumb` or
// `drive_url`: both are produced by an upload, and letting a text form rewrite
// them would leave a card naming a file nobody can open.
export async function updateDesign(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('erp' in patch) row.erp = patch.erp;
  if ('spec' in patch) row.spec = patch.spec;
  if ('brand' in patch) row.brand = patch.brand;
  if ('market' in patch) row.market = patch.market;
  if ('ver' in patch) row.ver = patch.ver;
  if (!Object.keys(row).length) return;
  const { error } = await c.from('designs').update(row).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// MENGGANTI ARTWORK — satu-satunya jalan yang boleh menyentuh thumb + drive_url.
//
// updateDesign() di atas SENGAJA tidak bisa, dan itu tetap benar: form teks yang
// bisa menulis ulang dua kolom itu menghasilkan kartu yang menyebut berkas yang
// tidak bisa dibuka siapa pun. Yang berubah di sini bukan aturannya — tapi
// sumbernya: nilai-nilai ini datang dari UNGGAHAN, sama persis seperti waktu
// desainnya pertama kali masuk.
//
// KENAPA VERSI LAMA DISIMPAN, BUKAN DITIMPA
// SNI dan NPB adalah kewajiban regulasi, dan artwork yang berlaku bulan lalu
// bisa berbeda dari yang berlaku sekarang. Menimpa di tempat membuat portal
// berhenti bisa menjawab "label versi mana yang berlaku waktu kiriman Juli
// dicetak" — dan itu justru pertanyaan yang muncul waktu ada audit atau barang
// tertahan. Berkas lamanya memang tidak pernah dihapus dari Drive, tapi
// tautannya di baris ini ikut tertimpa, jadi praktis tidak bisa ditemukan lagi.
//
// riwayat[] menyimpan {ver, driveUrl, thumb, tanggal, oleh} tiap versi
// sebelumnya. Pola yang sama dengan ppkek.docs dan pos.items: kolom jsonb di
// baris yang sama, bukan tabel anak — datanya tidak pernah ditanya sendirian dan
// selalu dibaca bersama desain yang memilikinya.
//
// Butuh supabase_designs_riwayat.sql. TANPA kolom itu penggantian artwork tetap
// jalan dan versinya tetap naik; yang hilang cuma riwayatnya — PostgREST menolak
// kolom yang tidak dikenal, jadi kirim ulang tanpa field itu daripada
// menggagalkan seluruh penggantiannya.
export async function replaceArtwork(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {
    drive_url: patch.driveUrl || null,
    thumb: patch.thumb || null,
    ver: patch.ver,
    updated: patch.updated || null,
    riwayat: patch.riwayat || [],
  };
  let { error } = await c.from('designs').update(row).eq('id', id);
  if (error && /riwayat/i.test(error.message || '')) {
    console.warn('Kolom designs.riwayat belum ada — artwork tetap diganti, riwayat tidak tersimpan. Jalankan supabase_designs_riwayat.sql.');
    delete row.riwayat;
    ({ error } = await c.from('designs').update(row).eq('id', id));
  }
  if (error) throw error;
}

// Deleting the ROW does not delete the file in Drive — the artwork stays where
// it was uploaded. Intentional: this library is an INDEX, and losing an index
// entry should never destroy the original.
export async function deleteDesign(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('designs').delete().eq('id', id);
  if (error) throw error;
}
