// Supabase persistence for PRFs. RLS on this table is stage-gated (see
// supabase_schema.sql prfs_update) — this module doesn't change or work
// around that, it just calls plain insert/update and lets Postgres accept or
// reject based on the caller's role + the stage transition, same as every
// other module here.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id, no: row.no, supplier: row.supplier, currency: row.currency, amount: row.amount,
    invoices: row.invoices || [], lines: row.lines || [], stage: row.stage,
    receiveChecklist: row.receive_checklist || { a: false, b: false, c: false, d: false },
    by: row.created_by, createdAt: row.created_at, receivedAt: row.received_at, paidAt: row.paid_at,
  };
}
function toRow(prf) {
  return {
    no: prf.no, supplier: prf.supplier, currency: prf.currency || 'IDR', amount: prf.amount || 0,
    invoices: prf.invoices || [], lines: prf.lines || [], stage: prf.stage || 'Terbentuk',
    receive_checklist: prf.receiveChecklist || {}, created_by: prf.by,
  };
}

export async function fetchPrfs() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('prfs').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchPrfs failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertPrf(prf) {
  if (!isConfigured()) return prf;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('prfs').insert(toRow(prf)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Single-table stage advance (e.g. Diproses Wilbert -> Diterima Finance via
// the receive checklist). NOT used for the Paid transition — that's the
// atomic confirm_prf_paid RPC in paymentsApi.js, since it also has to touch
// invoices + payments in the same operation.
export async function updatePrfStage(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('stage' in patch) row.stage = patch.stage;
  if ('receivedAt' in patch) row.received_at = patch.receivedAt;
  if ('receiveChecklist' in patch) row.receive_checklist = patch.receiveChecklist;
  const { error } = await c.from('prfs').update(row).eq('id', id);
  if (error) throw error;
}

// Delete a PRF. Only reachable before Finance has it — see payment.js.
//
// The NUMBER is not reclaimed, and that is deliberate. PRF numbers come from a
// sequence and end up on paper that leaves this building; reusing one means two
// different documents answer to the same reference, and no amount of tidiness
// is worth that. A gap in the sequence is a normal thing for a document series
// to have, and it is visible, which is the point.
export async function deletePrf(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('prfs').delete().eq('id', id);
  if (error) throw error;
}
