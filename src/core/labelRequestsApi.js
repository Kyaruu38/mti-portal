// Supabase persistence for LABEL REQUESTS.
//
// WHY THIS TABLE EXISTS
// -----------------------------------------------------------------------------
// sona owns the weekly label workbook; cania and visca own suppliers and
// purchase orders. Until now the screen collapsed those two jobs into one
// button: whoever parsed the sheet also assigned the supplier and generated the
// PO. sona had that button, so she was doing purchasing work — or, if it were
// simply taken away from her, the two of them would have to re-upload and
// re-parse the same file, and nothing would record what she had actually asked
// for.
//
// That gap is the point. With only a PO on file, "was this the label she
// requested?" has no answer — the request left no trace. A mis-set label is
// found weeks later on a pallet, and by then the only evidence is a PO that
// somebody typed.
//
// So the request itself is stored: who asked, when, from which file and sheet,
// and exactly which parsed rows. The PO is then raised FROM that record, and
// the two are linked by po_no.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

// Diminta   -> sona has submitted it, purchasing has not picked it up
// PO Terbit -> a PO was generated from it (po_no holds which)
// Ditolak   -> purchasing declined it, `note` says why
export const LR_STAGES = ['Diminta', 'PO Terbit', 'Ditolak'];

function fromRow(row) {
  return {
    id: row.id, file: row.file, sheet: row.sheet,
    rows: row.rows || [],
    by: row.requested_by, at: row.requested_at,
    status: row.status || 'Diminta',
    supplier: row.assigned_supplier || '',
    poNo: row.po_no || '',
    handledBy: row.handled_by || '', handledAt: row.handled_at || '',
    note: row.note || '',
  };
}

function toRow(r) {
  return {
    file: r.file || null, sheet: r.sheet || null,
    rows: r.rows || [],
    requested_by: r.by || null,
    status: r.status || 'Diminta',
    assigned_supplier: r.supplier || null,
    po_no: r.poNo || null,
    handled_by: r.handledBy || null,
    note: r.note || null,
  };
}

export async function fetchLabelRequests() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('label_requests').select('*').order('requested_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchLabelRequests failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertLabelRequest(r) {
  if (!isConfigured()) return r;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('label_requests').insert(toRow(r)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Partial update — resolving a request (PO issued or declined). Deliberately
// cannot touch `rows`: what was asked for is not editable by the person
// fulfilling it, which is the only reason storing it is worth anything.
export async function updateLabelRequest(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('status' in patch) row.status = patch.status;
  if ('supplier' in patch) row.assigned_supplier = patch.supplier;
  if ('poNo' in patch) row.po_no = patch.poNo;
  if ('handledBy' in patch) row.handled_by = patch.handledBy;
  if ('handledAt' in patch) row.handled_at = patch.handledAt;
  if ('note' in patch) row.note = patch.note;
  if (!Object.keys(row).length) return;
  const { error } = await c.from('label_requests').update(row).eq('id', id);
  if (error) throw error;
}
