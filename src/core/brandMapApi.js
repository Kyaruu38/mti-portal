// Supabase persistence for Brand Mapping (Master Data > Brand Mapping tab).
// Same shape as suppliersApi.js.
import { getClient, isConfigured } from './supabase.js';

function fromRow(row) { return { id: row.id, zh: row.zh, canonical: row.canonical }; }
function toRow(b) { return { zh: b.zh, canonical: b.canonical }; }

export async function fetchBrandMap() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('brand_map').select('*').order('zh', { ascending: true });
  if (error) { console.error('fetchBrandMap failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertBrandMap(b) {
  if (!isConfigured()) return b;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('brand_map').insert(toRow(b)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateBrandMap(id, b) {
  if (!isConfigured()) return b;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('brand_map').update(toRow(b)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteBrandMap(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('brand_map').delete().eq('id', id);
  if (error) throw error;
}
