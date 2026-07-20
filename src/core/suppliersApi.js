// Supabase persistence for Suppliers (needed so the item-4 audit trigger has
// something real to fire on — masterData.js previously only mutated
// st.suppliers in-memory). Same demo-mode-fallback shape as suratJalanApi.js.
import { getClient, isConfigured } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id, name: row.name, nameZh: row.name_zh, city: row.city, address: row.address,
    contact: row.contact, phone: row.phone, bank: row.bank, acct: row.acct, bankAddress: row.bank_address,
    pkp: row.pkp, overseas: row.overseas, top: row.top, bankChangePending: row.bank_change_pending,
  };
}

function toRow(sup) {
  return {
    name: sup.name, name_zh: sup.nameZh || null, city: sup.city || null, address: sup.address || null,
    contact: sup.contact || null, phone: sup.phone || null, bank: sup.bank || null, acct: sup.acct || null,
    bank_address: sup.bankAddress || null, pkp: !!sup.pkp, overseas: !!sup.overseas, top: sup.top || '30 hari',
    bank_change_pending: !!sup.bankChangePending,
  };
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
