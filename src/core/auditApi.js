// audit_log access.
//
// READS come from the trigger-populated table. WRITES were previously
// DB-trigger-only, which meant any audited action that performs NO DML left no
// durable record at all — the bank-change approve/reject decision and the
// supplier delete are all in-memory-only, and session.js's login() then
// OVERWRITES state.audit with the server list, so those entries vanished on the
// next login. The audit_insert RLS policy already allows any authenticated user
// to append, so no schema change is needed to fix this.
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

// Append an entry. Complements (does not replace) the DB triggers: triggers
// cover suppliers/prfs/pos DML, this covers decisions and non-DML actions.
export async function insertAuditLog(entry) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('audit_log').insert({
    entity: entry.entity || null,
    target: entry.target || null,
    action: entry.action || null,
    detail: entry.detail || null,
    status: entry.status || null,
  }).select('id').single();
  // `username` and `at` default server-side (current_username() / now()), so a
  // client clock or a spoofed username can't influence the record.
  if (error) { console.error('insertAuditLog failed:', error); return null; }
  return data.id;
}
