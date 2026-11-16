// Pemasok mana yang PUNYA AKUN PORTAL — dan tidak lebih dari itu.
//
// Layar Approval perlu tahu ini supaya bisa memperingatkan: PO label yang
// pemasoknya tidak punya akun TIDAK AKAN PERNAH terlihat olehnya, karena
// policy pos_read_supplier mencocokkan lewat supplier_id milik akun.
// Terukur waktu dipasang: 4 PO label PT GAOHE STIKER INDONESIA (11 Nov)
// sudah Approved dan tidak bisa dilihat siapa pun di sisi pemasok.
//
// profiles TIDAK bisa dibaca langsung: policy-nya cuma mengizinkan baris
// sendiri. Jadi fungsinya SECURITY DEFINER dan mengembalikan DAFTAR UUID
// saja — tidak ada nama, peran, atau apa pun tentang orangnya.
//
// GAGAL BERARTI null, BUKAN []. Daftar kosong berarti "tidak ada pemasok
// yang punya akun", dan itu akan menyalakan peringatan di SETIAP baris —
// peringatan yang selalu menyala persis sama tidak bergunanya dengan
// peringatan yang tidak pernah menyala. null berarti "tidak tahu", dan
// yang tidak tahu tidak memperingatkan apa pun.
import { getClient, isConfigured } from './supabase.js';

export async function fetchPemasokBerakun() {
  if (!isConfigured()) return null;
  try {
    const { data, error } = await getClient().rpc('pemasok_punya_akun');
    if (error) throw error;
    if (!Array.isArray(data)) return null;
    // PostgREST mengembalikan skalar set-returning sebagai array string ATAU
    // array objek satu medan, tergantung versi. Dua-duanya diterima.
    return data
      .map(r => (r && typeof r === 'object' ? Object.values(r)[0] : r))
      .filter(x => typeof x === 'string' && x);
  } catch (e) {
    console.warn('pemasok_punya_akun gagal:', e && e.message);
    return null;
  }
}
