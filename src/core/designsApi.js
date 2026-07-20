// Supabase persistence for the Label Design Library. Only fetch + insert —
// labelLibrary.js's UI has no edit/delete for designs today (upload-only),
// same reasoning suppliersApi.js has no delete (masterData.js's supplier
// delete button was never actually wired to it either — flagged separately,
// out of scope for this batch).
//
// NOT persisted: `color` (not a schema column — labelLibrary.js's brandTone()
// already derives a swatch color from `brand` when there's no real image) and
// `designUrl` (a local blob: URL from URL.createObjectURL(), browser-session-
// only by nature — can't be persisted or shared across sessions). A design
// fetched into a different session shows the color-swatch fallback instead of
// the actual artwork; the real file is still reachable via the Drive link
// (`driveUrl`), just not inline. Flagging this as a known gap, not fixing
// Drive-thumbnail rendering here — out of scope for CRUD wiring.
import { getClient, isConfigured } from './supabase.js';

function fromRow(row) {
  return { id: row.id, erp: row.erp, spec: row.spec, brand: row.brand, market: row.market, ver: row.ver, updated: row.updated, driveUrl: row.drive_url, status: row.status };
}
function toRow(d) {
  return { erp: d.erp || null, spec: d.spec || null, brand: d.brand || null, market: d.market || null, ver: d.ver || null, updated: d.updated || null, drive_url: d.driveUrl || null, status: d.status || 'active' };
}

export async function fetchDesigns() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('designs').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchDesigns failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertDesign(d) {
  if (!isConfigured()) return d;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('designs').insert(toRow(d)).select().single();
  if (error) throw error;
  return fromRow(data);
}
