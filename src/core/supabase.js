// Supabase client wrapper with graceful DEMO-MODE fallback.
// When SUPABASE_URL/KEY are empty, isConfigured() is false and the app runs
// purely in-memory (seeded). No network calls are made.

import { SUPABASE_URL, SUPABASE_ANON_KEY, FEATURES } from '../config.js';

let client = null;
let initTried = false;

export function isConfigured() { return FEATURES.useSupabase; }

// Shared test for "this id came from a real Supabase row" vs. a local-only
// placeholder (uid() prefix_timestamp_seq, or a seed literal like po_seed_xxx)
// — used by every *Api.js module's lazy-upsert (INSERT if not yet a UUID,
// UPDATE if it already is) and by fetch-on-login merges (A3's pattern).
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getClient() {
  if (!isConfigured()) return null;
  if (client || initTried) return client;
  initTried = true;
  try {
    // Loaded from CDN via importmap (see index.html).
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }, // no localStorage; keep session in memory
    });
    return client;
  } catch (e) {
    console.warn('Supabase init failed — staying in demo mode.', e);
    return null;
  }
}

// Auth: sign in with email/password (email derived from username upstream).
export async function signIn(email, password) {
  const c = await getClient();
  if (!c) return { demo: true };
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
}

// Force-change-password gate. Fails CLOSED: if the read errors, or the
// profiles row is missing, this returns true (force the change screen)
// rather than silently letting a temp-password account through — the worst
// case is a user who already changed their password sees the screen once
// more, which is harmless (see changePassword.js's retry path).
export async function fetchMustChangePassword(username) {
  if (!isConfigured()) return false; // demo mode: no real Auth passwords to rotate
  const c = await getClient();
  if (!c) return true;
  const { data, error } = await c.from('profiles').select('must_change_password').eq('username', username).maybeSingle();
  if (error) { console.error('fetchMustChangePassword failed — forcing change screen', error); return true; }
  if (!data) { console.warn('No profiles row for', username, '— forcing change screen'); return true; }
  return !!data.must_change_password;
}

// Real Supabase Auth password change — never a manual hash write.
export async function updatePassword(newPassword) {
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Only door that can clear must_change_password (see the RPC's own comment
// in supabase_migration_force_password_change.sql for the trust boundary).
// Callers must invoke this ONLY after updatePassword() has already resolved.
export async function clearMustChangePassword() {
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.rpc('clear_must_change_password');
  if (error) throw error;
}
