// Supabase persistence for Suppliers (needed so the item-4 audit trigger has
// something real to fire on — masterData.js previously only mutated
// st.suppliers in-memory). Same demo-mode-fallback shape as suratJalanApi.js.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

// ---------------------------------------------------------------------------
// bank / acct / bank_address / swift = the supplier's payment instruction, and
// the ONLY account ui/documents.js prfPaper() ever prints. Whoever edits the
// supplier writes it live — there is no staging layer any more.
//
// WHY THE STAGING IS GONE (Kyaru, 31 Jul 2026: "gausah spv yg isi atau
// persetujuan SPV, apus aja ketentuan itu"):
//
// A second pair of columns used to hold a PROPOSED account until a supervisor
// approved it. Two things killed it. The owner does not want the gate — in a
// team this size the person entering the account and the person approving it
// are the same person, and a rubber-stamp step is not a control, it is a
// delay that teaches everyone to click through. And the columns were never
// created on the live database, so every insert that carried them was rejected
// whole (PGRST204) and NO supplier could be saved at all — the review queue
// was blocking legitimate work while protecting nothing.
//
// What remains is the part that actually does the work: the PRF prints the
// account from THIS table and nowhere else, and every change is written to the
// audit trail with a name and a timestamp. Detection instead of prevention —
// which is what the old flow amounted to anyway, only slower.
// ---------------------------------------------------------------------------
function fromRow(row) {
  return {
    id: row.id, name: row.name, nameZh: row.name_zh, city: row.city, address: row.address,
    contact: row.contact, phone: row.phone, bank: row.bank, acct: row.acct, bankAddress: row.bank_address,
    pkp: row.pkp, overseas: row.overseas, top: row.top,
    swift: row.swift || '',
    // The currency this supplier bills in. Known from the agreement, not
    // guessed from whatever invoice happened to arrive first.
    currency: row.currency || 'IDR',
  };
}

function toRow(sup) {
  return {
    name: sup.name, name_zh: sup.nameZh || null, city: sup.city || null, address: sup.address || null,
    contact: sup.contact || null, phone: sup.phone || null, bank: sup.bank || null, acct: sup.acct || null,
    bank_address: sup.bankAddress || null, pkp: !!sup.pkp, overseas: !!sup.overseas, top: sup.top || '30 hari',
    swift: sup.swift || null,
    currency: sup.currency || 'IDR',
  };
}

// PostgREST rejects the WHOLE write over ONE column it does not know
// (PGRST204), so a portal deployed ahead of its migration could not save a
// supplier at all — not even a phone number.
//
// The old guard dropped a FIXED list of columns and so only ever survived the
// mistakes it already knew about: it stripped `swift`, the database was
// missing `pending_acct`, and the retry failed exactly like the first attempt.
// This one reads the column name out of the error and drops THAT, then tries
// again — up to a few times, since a stale schema is usually missing more than
// one column. Whatever the database does have still gets saved.
const COL_RE = /could not find the '?([a-z0-9_]+)'? column|column "?([a-z0-9_]+)"? .* does not exist/i;

function missingColumn(e) {
  const msg = `${(e && e.message) || ''} ${(e && e.details) || ''}`;
  if (e && e.code === 'PGRST204') return true;
  return /could not find the .* column|column .* does not exist|schema cache/i.test(msg);
}

// The column the server named, or null when it complained without naming one.
function namedColumn(e) {
  const m = `${(e && e.message) || ''} ${(e && e.details) || ''}`.match(COL_RE);
  return m ? (m[1] || m[2]) : null;
}

// Run `write(row)` and, each time the server rejects an unknown column, drop
// that column and retry. Returns the LAST error if it never succeeds, so a
// genuine failure (RLS, a constraint) still surfaces instead of being retried
// into silence.
async function writeTolerant(write, row) {
  let payload = { ...row };
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await write(payload);
    if (!error) return data;
    last = error;
    if (!missingColumn(error)) break;
    const col = namedColumn(error);
    if (!col || !(col in payload)) break;
    console.warn(`suppliers: kolom '${col}' belum ada di database — dilewati, sisanya tetap disimpan.`);
    delete payload[col];
  }
  throw last;
}

export async function fetchSuppliers() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) => c.from('suppliers').select('*').order('name', { ascending: true }).range(a, b));
  if (error) { console.error('fetchSuppliers failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertSupplier(sup) {
  if (!isConfigured()) return sup;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const data = await writeTolerant(p => c.from('suppliers').insert(p).select().single(), toRow(sup));
  return fromRow(data);
}

// `id` must be a real Supabase id (i.e. the supplier was fetched/inserted via
// Supabase, not a seed-only in-memory row) — callers should check before calling.
export async function updateSupplier(id, sup) {
  if (!isConfigured()) return sup;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const data = await writeTolerant(p => c.from('suppliers').update(p).eq('id', id).select().single(), toRow(sup));
  return fromRow(data);
}
