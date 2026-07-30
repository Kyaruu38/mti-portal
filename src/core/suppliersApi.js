// Supabase persistence for Suppliers (needed so the item-4 audit trigger has
// something real to fire on — masterData.js previously only mutated
// st.suppliers in-memory). Same demo-mode-fallback shape as suratJalanApi.js.
import { getClient, isConfigured } from './supabase.js';

// ---------------------------------------------------------------------------
// bank / acct / bank_address  = the APPROVED account. This is the ONLY account
//                               ui/documents.js prfPaper() ever prints.
// pending_bank / pending_acct / pending_bank_address
//                             = an account change waiting for wilbert.
//
// Requires supabase_migration_bank_pending.sql (shipped with this change) to
// have been run. Before that migration the three pending_* columns don't
// exist and an edit that touches bank details will fail loudly at the UPDATE —
// which is the correct failure direction: refusing the edit is safe, silently
// dropping the staging and writing the new account live is not.
// ---------------------------------------------------------------------------
function fromRow(row) {
  return {
    id: row.id, name: row.name, nameZh: row.name_zh, city: row.city, address: row.address,
    contact: row.contact, phone: row.phone, bank: row.bank, acct: row.acct, bankAddress: row.bank_address,
    pkp: row.pkp, overseas: row.overseas, top: row.top, bankChangePending: row.bank_change_pending,
    pendingBank: row.pending_bank || '', pendingAcct: row.pending_acct || '', pendingBankAddress: row.pending_bank_address || '',
  };
}

function toRow(sup) {
  return {
    name: sup.name, name_zh: sup.nameZh || null, city: sup.city || null, address: sup.address || null,
    contact: sup.contact || null, phone: sup.phone || null, bank: sup.bank || null, acct: sup.acct || null,
    bank_address: sup.bankAddress || null, pkp: !!sup.pkp, overseas: !!sup.overseas, top: sup.top || '30 hari',
    bank_change_pending: !!sup.bankChangePending,
    // Only sent when something is actually staged. Emitting them
    // unconditionally meant that on a database where the migration hasn't run,
    // PostgREST rejected EVERY supplier write (PGRST204) — creating a supplier
    // or fixing a phone number failed identically to a bank edit, which is not
    // what the docstring above promises.
    ...(hasStaging(sup) ? {
      pending_bank: sup.pendingBank || null,
      pending_acct: sup.pendingAcct || null,
      pending_bank_address: sup.pendingBankAddress || null,
    } : {}),
  };
}

function hasStaging(sup) {
  return !!(sup.pendingBank || sup.pendingAcct || sup.pendingBankAddress || sup.bankChangePending);
}

export async function fetchSuppliers() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('suppliers').select('*').order('name', { ascending: true });
  if (error) { console.error('fetchSuppliers failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertSupplier(sup) {
  if (!isConfigured()) return sup;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('suppliers').insert(toRow(sup)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// `id` must be a real Supabase id (i.e. the supplier was fetched/inserted via
// Supabase, not a seed-only in-memory row) — callers should check before calling.
export async function updateSupplier(id, sup) {
  if (!isConfigured()) return sup;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('suppliers').update(toRow(sup)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}
