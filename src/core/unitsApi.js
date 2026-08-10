// Supabase persistence for Units (Master Data > Unit tab). Same shape as
// itemsApi.js/brandMapApi.js.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) { return { id: row.id, code: row.code, intl: row.code_intl, note: row.note }; }
function toRow(u) { return { code: u.code, code_intl: u.intl || null, note: u.note || null }; }

export async function fetchUnits() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) => c.from('units').select('*').order('code', { ascending: true }).range(a, b));
  if (error) { console.error('fetchUnits failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertUnit(u) {
  if (!isConfigured()) return u;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('units').insert(toRow(u)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateUnit(id, u) {
  if (!isConfigured()) return u;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('units').update(toRow(u)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteUnit(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('units').delete().eq('id', id);
  if (error) throw error;
}
