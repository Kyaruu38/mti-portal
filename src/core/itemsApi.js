// Supabase persistence for Item Master (Master Data > Item Master tab).
// Same shape as suppliersApi.js. `erp` is unique in the schema — a duplicate
// save surfaces as a real Postgres error, caught and toasted by the caller
// like every other module, not silently handled here.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id, erp: row.erp, spec: row.spec, brand: row.brand, market: row.market, unit: row.unit,
    ms: row.ms, rr: row.rr, noise: row.noise, ean: row.ean, nameEn: row.name_en, nameZh: row.name_zh,
    // MEDAN SPESIFIKASI LABEL. Dipanen dari lembar order (lihat
    // label_master_panen di supabase/sql/label_master.sql) — lembar itu memang
    // satu-satunya tempat angka-angka ini pernah dituliskan, dan sampai
    // sekarang ikut terbuang tiap kali ordernya selesai.
    size: row.size || '', pattern: row.pattern || '', loadSpeed: row.load_speed || '',
    ply: row.ply || '', ttTl: row.tt_tl || '', snowPos: row.snow_pos || '',
    npb1: row.npb1 || '', npb3: row.npb3 || '', barcode: row.barcode || '',
    sniNo: row.sni_no || '', country: row.country || '', noiseClass: row.noise_class || '',
    // wet_grip (W1.24t) BARU: huruf A..E yang tercetak di label INMETRO/BX
    // persis di sebelah RR. Sampai 9 Nov 2026 kolomnya tidak ada dan
    // aliasnya juga tidak ada di parser, jadi satu-satunya tempat huruf itu
    // pernah dituliskan — lembar order — ikut terbuang tiap order selesai.
    // label_size BUKAN dimensi ban: isinya ukuran KERTAS ('254X79mm').
    wetGrip: row.wet_grip || '', plyBlock: row.ply_block || '', labelSize: row.label_size || '',
    punyaTemplate: row.punya_template === true,
    riwayat: row.riwayat || [], terakhirDari: row.terakhir_dari || '',
  };
}
function toRow(it) {
  return {
    erp: it.erp, spec: it.spec || null, brand: it.brand || null, market: it.market || null, unit: it.unit || '张',
    ms: it.ms || null, rr: it.rr || null, noise: it.noise || null, ean: it.ean || null,
    name_en: it.nameEn || null, name_zh: it.nameZh || null,
  };
}

export async function fetchItems() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('items').select('*').order('erp', { ascending: true }).range(a, b));
  if (error) { console.error('fetchItems failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertItem(it) {
  if (!isConfigured()) return it;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('items').insert(toRow(it)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateItem(id, it) {
  if (!isConfigured()) return it;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('items').update(toRow(it)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteItem(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('items').delete().eq('id', id);
  if (error) throw error;
}


// PANEN MASTER LABEL DARI LEMBAR ORDER.
//
// Dipanggil sesudah PO-nya betul-betul terbit, bukan saat lembarnya diurai.
// Alasannya dua. Pertama, `asal` jadi punya arti: nomor PO yang bisa
// ditelusuri, bukan "entah berkas apa jam berapa". Kedua, pratinjau diurai
// berkali-kali sementara PO cuma terbit sekali — memanen saat parse berarti
// menulis master label tiap kali orang membuka layarnya, termasuk untuk
// lembar yang akhirnya dibatalkan.
//
// Kegagalannya SENGAJA tidak menggagalkan apa pun. PO sudah terbit di titik
// ini; melempar error cuma akan membuat orangnya mengira PO-nya batal, lalu
// membuat PO kedua. Yang hilang kalau ini gagal adalah data yang bisa dipanen
// lagi dari lembar berikutnya.
export async function panenLabelMaster(rows, asal) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const bersih = (rows || []).filter(r => r && String(r.erp || '').trim());
  if (!bersih.length) return null;
  const { data, error } = await c.rpc('label_master_panen', { p_rows: bersih, p_asal: asal || null });
  if (error) { console.warn('panenLabelMaster gagal (PO tetap terbit):', error.message); return null; }
  return data;
}
