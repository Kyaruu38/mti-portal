// Supabase persistence for POs. Server rows (real UUID id) are the source of
// truth for every session — see fetchPOs() and its use in auth/session.js
// login(), which merges fetched rows with local-only ones (seed fixtures +
// any PO whose insert failed to sync) by partitioning on UUID_RE: the two
// live in disjoint id spaces, so seed data can never be shadowed by a real
// PO and a real PO can never be wiped by an empty/failing fetch (A3).
import { getClient, isConfigured, UUID_RE } from './supabase.js';

export { UUID_RE };

function toRow(po) {
  return {
    no: po.no, contract: po.contract || null, supplier: po.supplier, supplier_zh: po.supplierZh || null,
    address: po.address || null, contact: po.contact || null, phone: po.phone || null,
    currency: po.currency, unit: po.unit || null,
    subtotal: po.subtotal || 0, ppn: po.ppn || 0, ppn_mode: po.ppnMode || 'suspended', total: po.total || 0,
    terms: po.terms || null, delivery: po.delivery || null, items: po.items || [],
    source: po.source || null, status: po.status, created_by: po.by,
  };
}

function fromRow(row) {
  const items = (row.items || []).map((it, idx) => ({ ...it, lineId: it.lineId || `${row.id}:${idx}` }));
  return {
    id: row.id, no: row.no, contract: row.contract || '', supplier: row.supplier, supplierZh: row.supplier_zh || '',
    address: row.address || '', contact: row.contact || '', phone: row.phone || '',
    currency: row.currency, unit: row.unit || null,
    subtotal: row.subtotal || 0, ppn: row.ppn || 0, ppnMode: row.ppn_mode || 'suspended', total: row.total || 0,
    terms: row.terms || null, delivery: row.delivery || null, items,
    source: row.source || null, status: row.status, by: row.created_by, createdAt: row.created_at,
    approvedBy: row.approved_by || null, approvedAt: row.approved_at || null, rejectNote: row.reject_note || null,
    deleteRequested: !!row.delete_requested, deleteReason: row.delete_reason || null, deletedAt: row.deleted_at || null,
  };
}

// Every non-deleted PO visible to the current user (pos_read: open to any
// authenticated user, minus soft-deleted rows — filtered here explicitly too,
// on top of RLS, so an admin fetch never resurrects a deleted PO into the
// working list; RLS still lets wilbert reach it directly for audit if ever
// needed). Returns null on failure/demo-mode — caller must not treat that as
// "no POs", same contract as fetchSuratJalan.
export async function fetchPOs() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('pos').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) { console.error('fetchPOs failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertPO(po) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('pos').insert(toRow(po)).select('id').single();
  if (error) throw error;
  const id = data.id;
  // lineId is `${po.id}:${idx}` — unknowable until the insert above returns
  // the real id, so the row above was inserted with whatever placeholder
  // lineId the caller had (usually ''). Patch it now so the PERSISTED copy
  // matches what every other session will compute for this PO's items —
  // otherwise outstanding-qty tracking silently breaks for anyone who didn't
  // create the PO themselves (all items collapse onto one empty-string key).
  const items = (po.items || []).map((it, idx) => ({ ...it, lineId: `${id}:${idx}` }));
  const { error: fixErr } = await c.from('pos').update({ items }).eq('id', id);
  if (fixErr) throw fixErr;
  return id;
}

// Approve/reject a PO (the ordinary approval workflow, not the delete-request
// workflow). Uses a plain UPDATE — RLS's pos_update policy (untouched by any
// of this migration) governs who's allowed to do this, same as before.
// Only meaningful for POs that have a real Supabase row (UUID id).
export async function updatePoStatus(poId, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('status' in patch) row.status = patch.status;
  if ('approvedBy' in patch) row.approved_by = patch.approvedBy;
  if ('approvedAt' in patch) row.approved_at = patch.approvedAt;
  if ('rejectNote' in patch) row.reject_note = patch.rejectNote;
  const { error } = await c.from('pos').update(row).eq('id', poId);
  if (error) throw error;
}

// Full in-place edit (Edit PO feature) — overwrites every editable column via
// the same toRow() shape used on insert. Status is whatever the caller's `po`
// object already has (screens/approval.js's savePoEdit() never touches it) —
// this is a content edit, not a workflow transition, so it must never ride
// along and flip status as a side effect. Same RLS path as updatePoStatus
// (pos_update), no new policy needed.
export async function updatePO(poId, po) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('pos').update(toRow(po)).eq('id', poId);
  if (error) throw error;
}

export async function requestPoDelete(poId, reason) {
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.rpc('request_po_delete', { p_po_id: poId, p_reason: reason });
  if (error) throw error;
}

export async function approvePoDelete(poId) {
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.rpc('approve_po_delete', { p_po_id: poId });
  if (error) throw error;
}

export async function rejectPoDelete(poId) {
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.rpc('reject_po_delete', { p_po_id: poId });
  if (error) throw error;
}
