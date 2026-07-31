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
    // `usd` is the column's name, not its meaning: it holds the value in the
    // document's own currency, and `valuta` says which. A row written before
    // that column existed reads back as USD, which is what it was.
    usd: row.usd || 0, idr: row.idr || 0, kurs: row.kurs || 0,
    valuta: row.valuta || 'USD',
    jalur: row.jalur || 'LDP', so: row.so || '', jo: row.jo || '', costing: row.costing || '',
    poErpIna: row.po_erp_ina || '', status: row.status || 'Open', receivedDate: row.received_date || '',
    ppkekNo: row.ppkek_no || '', items: row.items || [],
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
// Exported so the SCREEN can normalise before it stores a date in memory, not
// just before it sends one. A row built straight from a parse held the raw
// customs string '24-07-2026'; fmtDate cannot read that, so those rows printed
// the raw string while every other row printed '24 Jul 2026' — visible on the
// two re-imported rows in the register and nowhere else, which made it look
// like a re-import bug rather than a formatting one.
export function toIsoDate(v) {
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
    valuta: r.valuta || 'USD',
    jalur: r.jalur === 'TLDDP' ? 'TLDDP' : 'LDP',
    so: r.so || '', jo: r.jo || '', costing: r.costing || '', po_erp_ina: r.poErpIna || '',
    status: r.status || 'Open', received_date: toIsoDate(r.receivedDate),
    ppkek_no: r.ppkekNo || null, items: r.items || [],
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

// Columns this app writes that a not-yet-migrated database may not have. Each
// one is ADDITIVE: losing it costs a field, not the row.
const OPTIONAL_COLUMNS = ['valuta'];

// PostgREST answers an unknown column with PGRST204 / "could not find the
// 'valuta' column of 'ppkek' in the schema cache" and rejects the WHOLE insert.
// So shipping a column before its migration has run does not degrade the
// feature — it stops every PPKEK import dead, archive extracted, files in
// Drive, no register row. That is the exact shape of the ETA bug, and it was
// silent from outside.
function missingColumn(e) {
  const msg = `${(e && e.message) || ''} ${(e && e.details) || ''}`.toLowerCase();
  if (e && e.code === 'PGRST204') return true;
  return /could not find the .* column|column .* does not exist|schema cache/.test(msg);
}

export async function insertPpkek(r) {
  if (!isConfigured()) return r;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = toRow(r);
  let { data, error } = await c.from('ppkek').insert(row).select().single();
  if (error && missingColumn(error)) {
    // Retry without the optional columns. The document still lands in the
    // register — just without the currency code until the migration runs.
    console.warn('ppkek: kolom opsional belum ada di database, insert diulang tanpa itu.', error.message);
    const trimmed = { ...row };
    for (const k of OPTIONAL_COLUMNS) delete trimmed[k];
    ({ data, error } = await c.from('ppkek').insert(trimmed).select().single());
  }
  if (error) throw error;
  return fromRow(data);
}

// Partial update (inline-edit cells, status changes, import-apply) — pass
// only the changed fields.
// Field name -> column, for everything this app is allowed to update.
//
// THE PARSED FIELDS WERE MISSING FROM THIS MAP. updateRegisterRow() builds a
// patch containing the refreshed date, supplier, currency, values, kurs and
// item lines, applies it to the row in memory — and then this function quietly
// dropped all of it, forwarding only the hand-typed columns. The screen changed;
// the database did not. Re-import the same bundle to correct a bad parse, watch
// it correct itself on screen, refresh, and the wrong values are back.
//
// Which makes it worse than a cosmetic bug: re-dropping a bundle is exactly
// what someone does when the first parse looked wrong, and it looked like it
// worked every time.
const COLUMN = {
  // parsed from the document — refreshed on re-import
  date: 'ppkek_date', eta: 'eta', supplier: 'supplier', address: 'address',
  invoiceNo: 'invoice_no', plNo: 'pl_no', contractNo: 'contract_no',
  usd: 'usd', idr: 'idr', kurs: 'kurs', valuta: 'valuta',
  ppkekNo: 'ppkek_no', items: 'items', jalur: 'jalur',
  // typed by hand — never touched by a re-import (see updateRegisterRow)
  so: 'so', jo: 'jo', costing: 'costing', poErpIna: 'po_erp_ina',
  status: 'status', receivedDate: 'received_date',
  // attachments
  files: 'files', driveFolder: 'drive_folder',
};
const DATE_FIELDS = new Set(['date', 'eta', 'receivedDate']);

export async function updatePpkek(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  for (const k in patch) {
    const col = COLUMN[k];
    if (!col) continue;                       // unknown field: ignored, not sent
    // Same DD-MM-YYYY trap as the insert path — a raw customs date reaching a
    // Postgres date column rejects the whole statement.
    row[col] = DATE_FIELDS.has(k) ? toIsoDate(patch[k]) : patch[k];
  }
  if (!Object.keys(row).length) return;
  let { error } = await c.from('ppkek').update(row).eq('id', id);
  if (error && missingColumn(error)) {
    console.warn('ppkek: kolom opsional belum ada di database, update diulang tanpa itu.', error.message);
    const trimmed = { ...row };
    for (const k of OPTIONAL_COLUMNS) delete trimmed[k];
    if (!Object.keys(trimmed).length) return;
    ({ error } = await c.from('ppkek').update(trimmed).eq('id', id));
  }
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
