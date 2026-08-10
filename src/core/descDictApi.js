// Supabase persistence for the Description Dictionary (Master Data > Description
// Dictionary tab). Same shape as suppliersApi.js: fromRow/toRow + fetch/insert/
// update/delete, matching the CRUD the existing UI (masterData.js dictTab)
// already exposes (edit + delete both present, so delete is wired here too).
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) { return { id: row.id, en: row.en, zh: row.zh }; }
function toRow(d) { return { en: d.en, zh: d.zh || null }; }

export async function fetchDescDict() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await fetchAllPaged((a, b) => c.from('desc_dict').select('*').order('en', { ascending: true }).range(a, b));
  if (error) { console.error('fetchDescDict failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertDescDict(d) {
  if (!isConfigured()) return d;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('desc_dict').insert(toRow(d)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateDescDict(id, d) {
  if (!isConfigured()) return d;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('desc_dict').update(toRow(d)).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteDescDict(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('desc_dict').delete().eq('id', id);
  if (error) throw error;
}
