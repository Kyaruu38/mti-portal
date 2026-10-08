// Supabase persistence for WAREHOUSE COMPLAINTS (仓库投诉).
//
// WHY THIS TABLE EXISTS
// -----------------------------------------------------------------------------
// Label problems are found by the people unpacking the cartons, and until now
// they were reported by chat message. A chat message is not a record: it cannot
// be counted, it cannot be filtered by supplier, and six months later nobody can
// answer "how many short shipments did WINS send this year". Worse, the person
// who finds the problem is not the person who can act on it, so the report has
// to survive a handover — and a chat message survives a handover for about a day.
//
// The same rows are ALSO edited from the Google Sheet the warehouse keeps open.
// That is the whole reason this is a table in Supabase rather than a tab in a
// spreadsheet: two windows, one record. If each side kept its own list they would
// disagree within a fortnight and there would be no way to tell which was right.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

// Dibiarkan sebagai teks bebas di basis data (bukan enum) supaya menambah jenis
// masalah tidak butuh migrasi. Daftar di bawah yang dipakai dropdown; nilai lama
// yang sudah terlanjur tersimpan tetap terbaca.
export const JENIS_KOMPLAIN = [
  'Wrong label / 标签错误',
  'Damaged / 破损',
  'Short qty / 数量不足',
  'Over qty / 数量超出',
  'Late delivery / 延迟到货',
  'Print quality / 印刷质量',
  'Wrong size / 尺寸错误',
  'Other / 其他',
];
export const STATUS_KOMPLAIN = ['Open', 'In progress', 'Closed'];

function fromRow(row) {
  return {
    id: row.id,
    poNo: row.po_no || '', erpId: row.erp_id || '',
    supplier: row.supplier || '', deskripsi: row.description || '',
    jenis: row.issue_type || '', qty: row.qty_affected,
    detail: row.details || '', foto: row.photo_url || '',
    by: row.reported_by || '', at: row.reported_at,
    status: row.status || 'Open',
    tindakan: row.action_taken || '',
    closedBy: row.closed_by || '', closedAt: row.closed_at || '',
    sumber: row.source || 'portal',
  };
}

function toRow(k) {
  return {
    po_no: k.poNo || null, erp_id: k.erpId || null,
    supplier: k.supplier || null, description: k.deskripsi || null,
    issue_type: k.jenis || null,
    qty_affected: (k.qty === '' || k.qty == null) ? null : Number(k.qty),
    details: k.detail || null, photo_url: k.foto || null,
    reported_by: k.by || null,
    status: k.status || 'Open',
    action_taken: k.tindakan || null,
    source: k.sumber || 'portal',
  };
}

export async function fetchComplaints() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('label_complaints').select('*').order('reported_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchComplaints failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertComplaint(k) {
  if (!isConfigured()) return k;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('label_complaints').insert(toRow(k)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Mengembalikan JUMLAH BARIS yang benar-benar berubah, bukan sekadar "tidak error".
// PostgREST menolak baris lewat RLS dengan HTTP 200, nol baris dan error null —
// jadi `if (error)` saja akan melaporkan sukses untuk penolakan izin.
export async function updateComplaint(id, patch) {
  if (!isConfigured()) return 1;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('label_complaints')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw error;
  return (data || []).length;
}
