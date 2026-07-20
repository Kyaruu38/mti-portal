// Read-only access to the trigger-populated audit_log table (see item 4:
// writes are DB-trigger-only now, nothing in the frontend inserts here).
import { getClient, isConfigured } from './supabase.js';

export async function fetchAuditLog(entity, target, limit) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  let q = c.from('audit_log').select('*').order('at', { ascending: false });
  if (entity) q = q.eq('entity', entity);
  if (target) q = q.eq('target', target);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) { console.error('fetchAuditLog failed:', error); return null; }
  return data;
}
