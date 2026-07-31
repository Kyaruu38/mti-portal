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

// ---------------------------------------------------------------------------
// GUARDED CREATE — the database decides, not the browser.
//
// screens/suratJalan.js already refuses to ship more than a PO's outstanding
// quantity, but that check reads state this session fetched at login. Two people
// on the Surat Jalan screen at the same time both read a pre-shipment total,
// both pass their own check, and both insert — the PO ends up over-delivered
// with no error anywhere. Goods physically leave the warehouse on that document,
// so the arbiter cannot be a copy of the data held in a browser tab.
//
// create_surat_jalan() (supabase_migration_guards.sql) takes a row lock on every
// referenced PO, recomputes ordered-vs-shipped inside the transaction, and
// raises if the new document would exceed it. Concurrent calls serialize on the
// lock instead of racing.
//
// FALLBACK, and why it is narrow. Frontend deploys and SQL migrations are run
// separately here, so this code can reach production before the function exists.
// If it does, surat jalan creation must not stop dead — that is a core feature
// and the standing rule is degrade, never hard-fail. So a MISSING FUNCTION falls
// back to the plain insert with a loud console warning.
//
// Every other error is rethrown, and that distinction is the whole point: an
// over-delivery rejection, a permission denial, or a bad line id MUST reach the
// user. Swallowing those would turn the guard into decoration.
// ---------------------------------------------------------------------------
const FN_MISSING = /could not find the function|does not exist|schema cache/i;

export async function createSuratJalanGuarded(sj) {
  if (!isConfigured()) return sj;                 // demo mode: unchanged behaviour
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');

  const payload = {
    docNo: sj.docNo, no: sj.no, supplier: sj.supplier, poNo: sj.poNo,
    // The function reads poIds from the payload to know which rows to lock.
    // items alone would work for the arithmetic, but the lock has to be taken
    // BEFORE the totals are read, so the list is passed explicitly.
    poIds: sj.poIds || [],
    items: sj.items || [],
  };

  const { data, error } = await c.rpc('create_surat_jalan', { p_sj: payload });
  if (!error) return fromRow(data);

  if (FN_MISSING.test(String(error.message || '')) || error.code === 'PGRST202') {
    console.warn(
      '[surat jalan] create_surat_jalan() not found in the database — falling back to a plain INSERT. ' +
      'Over-delivery is then only checked in the browser, so two concurrent sessions can still exceed a PO. ' +
      'Run supabase_migration_surat_jalan_rpc.sql to close this.',
      error,
    );
    return insertSuratJalan(sj);
  }
  throw error;                                    // over-delivery, RLS, bad line
}
