// Riwayat tarikan 采购申请 per baris PO. Kas dihitung dari sini — lihat
// core/kasLabel.js untuk alasan kenapa tidak ada kolom saldo di mana pun.
//
// Tabelnya SENGAJA tanpa policy UPDATE dan tanpa policy DELETE (lihat
// supabase_erp_tarikan.sql). Ini catatan peristiwa: berkas yang sudah diunduh
// dan diunggah ke ERP tidak bisa ditarik balik dengan menghapus barisnya di
// sini. Karena itu modul ini hanya punya baca dan tulis — tidak ada ubah, tidak
// ada hapus, dan itu bukan kelalaian.
import { getClient, isConfigured, fetchAllPaged, assertWrote } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id,
    poId: row.po_id,
    lineId: row.line_id,
    tahap: Number(row.tahap) || 0,
    qty: Number(row.qty) || 0,
    tanggal: row.tanggal || null,
    penanda: row.penanda || '',
    oleh: row.oleh || '',
    createdAt: row.created_at || null,
  };
}

// Semua tarikan yang boleh dilihat akun ini. Mengembalikan null pada
// kegagalan/mode demo — pemanggil TIDAK boleh membacanya sebagai "belum ada
// tarikan", kontrak yang sama dengan fetchPOs dan fetchSuratJalan.
//
// Membaca null sebagai nol di sini akibatnya khusus dan mahal: kas terlihat
// PENUH lagi, orangnya menarik excel tahap 2 berisi 3000, dan 采购申请 ganda
// masuk ke ERP untuk barang yang sudah diminta sekali.
export async function fetchErpTarikan() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST diam-diam memotong select tanpa batas di 1000 baris, dan
  // tabel ini tumbuh satu baris per SKU per tahap — lebih cepat penuh daripada
  // yang diperkirakan orang.
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('erp_tarikan').select('*').order('created_at', { ascending: true }).range(a, b));
  if (error) { console.error('fetchErpTarikan failed:', error); return null; }
  return data.map(fromRow);
}

// Catat satu tahap. SATU panggilan untuk SEMUA baris yang ikut di berkas itu.
//
// Ditulis sekaligus dengan sengaja: satu berkas excel adalah satu peristiwa,
// dan menulisnya baris per baris membuka keadaan yang tidak bisa dijelaskan —
// berkas berisi lima SKU, tiga barisnya tercatat, koneksi putus, dan kas dua
// SKU sisanya tetap penuh untuk barang yang sudah diminta ke ERP. Satu insert
// dengan banyak baris itu atomik di Postgres: semua masuk atau tidak sama
// sekali.
//
// MELEMPAR kalau server menolak. Pemanggil di jendela ERP menulis DULU baru
// mengunduh berkasnya — urutan itu bukan selera. Kalau diunduh dulu lalu
// pencatatannya gagal, berkasnya sudah ada di tangan orangnya sementara kasnya
// masih penuh, dan tahap berikutnya akan menarik jumlah yang sama lagi.
export async function catatTarikan(rows) {
  if (!rows || !rows.length) return [];
  if (!isConfigured()) return rows;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const payload = rows.map(r => ({
    po_id: r.poId,
    line_id: r.lineId,
    tahap: r.tahap,
    qty: r.qty,
    tanggal: r.tanggal || null,
    penanda: r.penanda,
    oleh: r.oleh,
  }));
  // assertWrote: PostgREST membalas 204 tanpa error kalau RLS menyaring habis
  // semua baris — penolakan terbaca sebagai keberhasilan, dan kasnya tidak
  // pernah turun.
  const data = assertWrote(
    await c.from('erp_tarikan').insert(payload).select(),
    'catat tarikan 采购申请',
  );
  return data.map(fromRow);
}

// Tahap yang SAMA ditulis dua kali untuk baris yang sama ditolak oleh
// `unique (po_id, line_id, tahap)`. Itu jaring pengaman terakhir kalau dua tab
// menarik bersamaan — tanpanya keduanya lolos dan kas turun dua kali untuk satu
// berkas. Postgres melaporkannya sebagai 23505; pesan mentahnya menyebut nama
// constraint dan tidak berarti apa-apa buat yang membacanya.
export function tahapKembar(e) {
  if (!e) return false;
  if (e.code === '23505') return true;
  return /duplicate key value|erp_tarikan_po_id_line_id_tahap_key/i.test(String(e.message || e));
}
