// Supabase persistence for POs. Server rows (real UUID id) are the source of
// truth for every session — see fetchPOs() and its use in auth/session.js
// login(), which merges fetched rows with local-only ones (seed fixtures +
// any PO whose insert failed to sync) by partitioning on UUID_RE: the two
// live in disjoint id spaces, so seed data can never be shadowed by a real
// PO and a real PO can never be wiped by an empty/failing fetch (A3).
import { getClient, isConfigured, UUID_RE, fetchAllPaged } from './supabase.js';

export { UUID_RE };

// ---------------------------------------------------------------------------
// Line identity.
//
// A lineId is the key surat-jalan rows use to attribute shipped quantity back
// to a specific PO line (core/outstanding.js receivedQty()). It MUST be opaque
// and permanent.
//
// It used to be `${poId}:${arrayIndex}`, assigned after the insert returned.
// Two things went wrong with that:
//   1. An array index is RECYCLED. Delete line C (index 2), add line D — D
//      lands on index 2 and inherits every shipment ever recorded against C.
//   2. New lines added through the Edit PO modal were saved with lineId '',
//      so two new lines in one edit collided on the same empty key: one
//      shipment counted against both.
// Opaque ids minted at creation time fix both, and let insertPO() be a single
// atomic write instead of insert-then-patch.
// ---------------------------------------------------------------------------
export function newLineId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `ln_${c.randomUUID()}`;
  // Fallback for any context without crypto.randomUUID (older/insecure origin).
  return `ln_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Defensive: give any line still missing an id a fresh opaque one. Never
// touches a line that already has one.
export function stampLineIds(items) {
  return (items || []).map(it => (it && it.lineId ? it : { ...it, lineId: newLineId() }));
}

function toRow(po) {
  return {
    no: po.no, contract: po.contract || null, supplier: po.supplier, supplier_zh: po.supplierZh || null,
    address: po.address || null, contact: po.contact || null, phone: po.phone || null,
    currency: po.currency, unit: po.unit || null,
    subtotal: po.subtotal || 0, ppn: po.ppn || 0, ppn_mode: po.ppnMode || 'suspended', total: po.total || 0,
    terms: po.terms || null, delivery: po.delivery || null, items: po.items || [],
    source: po.source || null, status: po.status, created_by: po.by,
    // Drives expected-arrival and overdue in Label Stock -> Order Tracking.
    // The column has a CHECK constraint, so an unexpected value is rejected by
    // Postgres rather than silently stored.
    priority: po.priority || 'Normal',
  };
}

function fromRow(row) {
  // LEGACY ONLY. Rows written before opaque ids carry `${row.id}:${idx}`
  // already, so recomputing the same value here is a no-op for them. Nothing
  // writes an empty lineId any more (see newLineId/stampLineIds above), so
  // this branch should never fire for new data — it exists so historical rows
  // keep resolving to the ids their surat-jalan rows already reference.
  const items = (row.items || []).map((it, idx) => ({ ...it, lineId: it.lineId || `${row.id}:${idx}` }));
  return {
    id: row.id, no: row.no, contract: row.contract || '', supplier: row.supplier, supplierZh: row.supplier_zh || '',
    address: row.address || '', contact: row.contact || '', phone: row.phone || '',
    currency: row.currency, unit: row.unit || null,
    subtotal: row.subtotal || 0, ppn: row.ppn || 0, ppnMode: row.ppn_mode || 'suspended', total: row.total || 0,
    terms: row.terms || null, delivery: row.delivery || null, items,
    source: row.source || null, status: row.status, by: row.created_by, createdAt: row.created_at,
    priority: row.priority || 'Normal',
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
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('pos').select('*').is('deleted_at', null).order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchPOs failed:', error); return null; }
  return data.map(fromRow);
}

// ONE write. This used to be insert-then-update: the INSERT committed, then a
// second round trip patched the lineIds. If that second call failed, insertPO
// threw — telling the caller "not saved" — while the first INSERT was already
// committed, leaving a server row whose every line shared an empty lineId, plus
// a duplicate local copy of the same PO on the next login.
//
// lineIds no longer depend on the server-assigned id, so there is nothing to
// patch afterwards and the whole failure mode is gone: the insert either
// commits complete or it doesn't commit at all.
export async function insertPO(po) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  po.items = stampLineIds(po.items);            // keep the local copy in sync
  const { data, error } = await c.from('pos').insert(toRow(po)).select('id').single();
  if (error) throw error;
  return data.id;
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
  // Lines added through the Edit PO modal must never reach Postgres without an
  // id — an empty lineId falls through to fromRow()'s positional fallback on
  // the next fetch and adopts a deleted line's shipment history.
  po.items = stampLineIds(po.items);
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

// ---------------------------------------------------------------------------
// Is this insert failure PERMANENT, i.e. will retrying the exact same PO fail
// the exact same way?
//
// Both PO screens wrap insertPO() in a try/catch that keeps the PO in local
// state and warns "tersimpan lokal, tapi gagal sync ke server". That is the
// right call for a dropped connection — the document is real, the network
// wasn't. It is the WRONG call for a rejection the server will repeat forever:
// the PO shows up in the list as if it were created, and quietly disappears on
// the next login.
//
// The unique index on pos(no) where deleted_at is null (added 31 Jul, after
// CGDD2607200143 was found recorded five times) turns a duplicate PO number
// into exactly that kind of permanent rejection. Postgres reports it as SQLSTATE
// 23505; the raw message reads
//   duplicate key value violates unique constraint "pos_no_unik"
// which means nothing to whoever typed the number.
//
// Matching on the SQLSTATE first and the text only as a fallback, because the
// message wording is a Postgres implementation detail and the code is not.
// ---------------------------------------------------------------------------
export function duplicatePoNumber(e) {
  if (!e) return false;
  if (e.code === '23505') return true;
  return /duplicate key value|pos_no_unik|already exists/i.test(String(e.message || e));
}
