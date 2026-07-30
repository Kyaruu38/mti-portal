// Supabase persistence for Surat Jalan — this is the one domain table
// currently wired to Postgres (every other module stays in-memory; see
// CLAUDE.md for the full picture). Falls back to a no-op in DEMO MODE
// (Supabase not configured) so the screen keeps working exactly as before.
//
// Table (supabase_schema.sql): surat_jalan(id, doc_no, no, supplier, po_no,
// items jsonb, created_by, created_at). There's no separate po_ids column —
// each line inside `items` already carries its own `poId`, so the set of
// POs a document references is derived from that on read.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  const items = row.items || [];
  return {
    id: row.id,
    docNo: row.doc_no,
    no: row.no,
    date: row.created_at,
    supplier: row.supplier,
    poNo: row.po_no,
    poIds: [...new Set(items.map(it => it.poId).filter(Boolean))],
    by: row.created_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    items,
    driveUrl: row.drive_url || '',
  };
}

function toRow(sj) {
  return { doc_no: sj.docNo, no: sj.no, supplier: sj.supplier, po_no: sj.poNo, items: sj.items, created_by: sj.createdBy };
}

// Returns the full current list from Supabase, or null if unavailable
// (demo mode / client init failed / query error) — callers should leave
// local state untouched when they get null, not treat it as "empty".
export async function fetchSuratJalan() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('surat_jalan').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchSuratJalan failed:', error); return null; }
  return data.map(fromRow);
}

// Inserts one row and returns the server-confirmed record (real id/created_at).
// Throws on failure — callers must not fabricate a local-only success.
export async function insertSuratJalan(sj) {
  if (!isConfigured()) return sj;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('surat_jalan').insert(toRow(sj)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Sets the Drive archive link after the document is generated and uploaded
// (see createSuratJalan() in screens/suratJalan.js). No-ops in demo mode.
export async function updateSuratJalan(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('driveUrl' in patch) row.drive_url = patch.driveUrl;
  const { error } = await c.from('surat_jalan').update(row).eq('id', id);
  if (error) throw error;
}
