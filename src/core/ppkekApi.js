// Supabase persistence for the PPKEK register. Same shape as invoicesApi.js/
// posApi.js. DATA (register rows: parse results, SO/JO/costing, status,
// tracking) is fully live here. FILE storage is not — Drive isn't wired yet
// (useDrive=false in config.js), so `files` just holds whatever
// uploadToDrive() returned (today: `drive-pending://...` placeholders, see
// core/drive.js). That keeps the file layer swappable: once Drive is
// configured, uploadToDrive() starts returning real links and this column
// starts holding those instead — nothing here or in ppkek.js's data flow
// needs to change.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  const files = row.files || [];
  const realFile = files.find(f => f.url && !String(f.url).startsWith('drive-'));
  return {
    id: row.id, nopen: row.nopen || '', date: row.ppkek_date, eta: row.eta || '',
    contractNo: row.contract_no || '', supplier: row.supplier || '', address: row.address || '',
    invoiceNo: row.invoice_no || '', plNo: row.pl_no || '',
    usd: row.usd || 0, idr: row.idr || 0, kurs: row.kurs || 0,
    jalur: row.jalur || 'LDP', so: row.so || '', jo: row.jo || '', costing: row.costing || '',
    poErpIna: row.po_erp_ina || '', status: row.status || 'Open', receivedDate: row.received_date || '',
    driveFolder: row.drive_folder || '', files,
    driveUrl: (realFile || files[0] || {}).url || '',
  };
}


// Postgres date columns want ISO (YYYY-MM-DD). Indonesian customs documents
// print DD-MM-YYYY, and that string is REJECTED outright — "31-07-2026" is read
// as month 31 and the whole INSERT fails with
//     date/time field value out of range: "31-07-2026"
//
// This bit until now only because the ETA was always empty: the parser's own
// ETA rule was being overwritten with '' further down the file, so `|| null`
// always fired and nothing invalid ever reached Postgres. The moment that
// overwrite was fixed and a real date started coming through, every PPKEK
// import began failing at the insert — the archive extracted, the files reached
// Drive, the parse card showed correct values, and no register row appeared.
//
// Normalising here rather than at the call sites because this module owns the
// database shape, and there are three separate places that build a row.
// Anything unparseable returns null instead of throwing: a missing date must
// never cost you the whole document.
function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s || s === '-') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);      // already ISO
  const m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/); // DD-MM-YYYY
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }
  const parsed = new Date(s);
  return isNaN(parsed) ? null : parsed.toISOString().slice(0, 10);
}

function toRow(r) {
  return {
    nopen: r.nopen || null, ppkek_date: toIsoDate(r.date), eta: toIsoDate(r.eta),
    contract_no: r.contractNo || null, supplier: r.supplier || null, address: r.address || null,
    invoice_no: r.invoiceNo || null, pl_no: r.plNo || null,
    usd: r.usd || 0, idr: r.idr || 0, kurs: r.kurs || 0,
    jalur: r.jalur === 'TLDDP' ? 'TLDDP' : 'LDP',
    so: r.so || '', jo: r.jo || '', costing: r.costing || '', po_erp_ina: r.poErpIna || '',
    status: r.status || 'Open', received_date: toIsoDate(r.receivedDate),
    drive_folder: r.driveFolder || null, files: r.files || [],
  };
}

export async function fetchPpkek() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('ppkek').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchPpkek failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertPpkek(r) {
  if (!isConfigured()) return r;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('ppkek').insert(toRow(r)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Partial update (inline-edit cells, status changes, import-apply) — pass
// only the changed fields.
export async function updatePpkek(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('so' in patch) row.so = patch.so;
  if ('jo' in patch) row.jo = patch.jo;
  if ('costing' in patch) row.costing = patch.costing;
  if ('poErpIna' in patch) row.po_erp_ina = patch.poErpIna;
  if ('status' in patch) row.status = patch.status;
  if ('receivedDate' in patch) row.received_date = patch.receivedDate;
  if ('files' in patch) row.files = patch.files;
  if ('driveFolder' in patch) row.drive_folder = patch.driveFolder;
  const { error } = await c.from('ppkek').update(row).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Duplicate nopen, rejected by the database.
//
// screens/ppkek.js already refuses to insert a nopen it can see in the register
// and updates that row instead. But it decides from state fetched at login, so
// two people importing the same bundle at the same moment both look, both see
// nothing, and both insert — the same race that let one surat jalan be recorded
// three times and one PO five times.
//
// The unique index in supabase_ppkek_unique_nopen.sql closes it for good. This
// tells a rejection caused by that index apart from a transient failure, so the
// screen can say "this document is already in the register" instead of showing
// a raw Postgres constraint string.
// ---------------------------------------------------------------------------
export function duplicateNopen(e) {
  if (!e) return false;
  if (e.code === '23505') return true;
  return /duplicate key value|ppkek_nopen_unik|already exists/i.test(String(e.message || e));
}
