// Supabase persistence for Item Master (Master Data > Item Master tab).
// Same shape as suppliersApi.js. `erp` is unique in the schema — a duplicate
// save surfaces as a real Postgres error, caught and toasted by the caller
// like every other module, not silently handled here.
import { getClient, isConfigured } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id, erp: row.erp, spec: row.spec, brand: row.brand, market: row.market, unit: row.unit,
    ms: row.ms, rr: row.rr, noise: row.noise, ean: row.ean, nameEn: row.name_en, nameZh: row.name_zh,
  };
}
function toRow(it) {
  return {
    erp: it.erp, spec: it.spec || null, brand: it.brand || null, market: it.market || null, unit: it.unit || '张',
    ms: it.ms || null, rr: it.rr || null, noise: it.noise || null, ean: it.ean || null,
    name_en: it.nameEn || null, name_zh: it.nameZh || null,
  };
}

export async function fetchItems() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('items').select('*').order('erp', { ascending: true });
  if (error) { console.error('fetchItems failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertItem(it) {
  if (!isConfigured()) return it;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('items').insert(toRow(it)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateItem(id, it) {
  if (!isConfigured()) return it;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('items').update(toRow(it)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteItem(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('items').delete().eq('id', id);
  if (error) throw error;
}
