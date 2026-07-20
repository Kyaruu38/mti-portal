// Atomic document numbering via Postgres RPC (next_doc_seq / next_sj_number
// in supabase_schema.sql) — closes the race where two users generating a
// PRF/Surat Jalan in the same instant could get the same number.
//
// In DEMO MODE (Supabase not configured) this falls back to the old
// local-cache scan (nextMonthlySeq) since there's no backend to be atomic
// against. When Supabase IS configured, a failed RPC call is NOT silently
// papered over with the local fallback — that would quietly reintroduce the
// exact race this module exists to close — callers must surface the error.
import { getClient, isConfigured } from './supabase.js';
import { nextMonthlySeq } from './format.js';

export async function nextPrfNo(existingPrfs, romanMonthStr, year, prefix) {
  if (isConfigured()) {
    const c = await getClient();
    if (!c) throw new Error('Supabase client unavailable');
    const bucket = `PRF-${romanMonthStr}-${year}`;
    const { data, error } = await c.rpc('next_doc_seq', { p_bucket: bucket });
    if (error) throw error;
    return `${prefix}${String(data).padStart(3, '0')}`;
  }
  const seq = nextMonthlySeq(existingPrfs, prefix);
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// Returns the full formatted number ("PC/SJ/VII/001-1"); caller supplies a
// local fallback formatter for demo mode since the base/suffix reuse logic
// already lives in suratJalan.js (existingBaseSeq) to avoid duplicating it.
export async function nextSjNo(poIds, romanMonthStr, year, prefix) {
  if (isConfigured()) {
    const c = await getClient();
    if (!c) throw new Error('Supabase client unavailable');
    const bucket = `${romanMonthStr}-${year}`;
    const { data, error } = await c.rpc('next_sj_number', { p_po_ids: poIds, p_bucket: bucket, p_month_prefix: prefix });
    if (error) throw error;
    return data;
  }
  return null; // signal "not configured" — caller uses its local fallback
}
