// Supabase persistence for Invoices. Same shape as suppliersApi.js/posApi.js.
// No delete — no delete UI exists for invoices anywhere in the app.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return { id: row.id, no: row.no, supplier: row.supplier, poRef: row.po_ref, currency: row.currency, amount: row.amount, due: row.due, faktur: row.faktur, ppnPaid: row.ppn_paid, status: row.status, files: row.files || [] };
}
function toRow(inv) {
  return { no: inv.no, supplier: inv.supplier || null, po_ref: inv.poRef || null, currency: inv.currency || 'IDR', amount: inv.amount || 0, due: inv.due || null, faktur: inv.faktur || null, ppn_paid: !!inv.ppnPaid, status: inv.status || 'Diterima Purchasing', files: inv.files || [] };
}

export async function fetchInvoices() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('invoices').select('*').order('due', { ascending: true }).range(a, b));
  if (error) { console.error('fetchInvoices failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertInvoice(inv) {
  if (!isConfigured()) return inv;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('invoices').insert(toRow(inv)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Partial update (status / faktur changes) — pass only the changed fields.
export async function updateInvoice(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('status' in patch) row.status = patch.status;
  if ('faktur' in patch) row.faktur = patch.faktur;
  if ('files' in patch) row.files = patch.files;
  const { error } = await c.from('invoices').update(row).eq('id', id);
  if (error) throw error;
}
