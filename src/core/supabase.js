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

// ---------------------------------------------------------------------------
// WHERE THE AUTH TOKEN LIVES — sessionStorage, and ONLY the auth token.
//
// This was persistSession:false, which kept the token in a JS variable and
// nowhere else. Correct for secrecy, and the reason every F5 landed on the
// login screen: a page reload throws away the whole JS heap, so there was
// nothing left to prove who you were.
//
// sessionStorage, not localStorage, and the difference is the point:
//   * refresh (F5, Ctrl+F5, or the browser reloading the tab) KEEPS you in;
//   * closing the tab, or the window, ends the session — nothing is left on
//     the machine for the next person who opens the browser.
// localStorage would survive that too, which on a shared office PC is exactly
// what you do not want.
//
// The store's no-storage rule is unchanged: not one row of PO, supplier, PRF
// or PPKEK data is written here. What is stored is the same JWT + refresh
// token the browser would otherwise hold in memory, and it still buys nothing
// on its own — every read and write goes through RLS, which resolves the role
// from the profiles table server-side, not from anything in this token.
function authStorage() {
  try {
    const k = '__mti_probe__';
    window.sessionStorage.setItem(k, '1');
    window.sessionStorage.removeItem(k);
    return window.sessionStorage;
  } catch {
    // Private mode, storage disabled by policy, or an embedded webview. Fall
    // back to memory — the app then behaves exactly as it did before this
    // change (refresh logs you out) rather than failing to start.
    console.warn('sessionStorage unavailable — session will not survive refresh.');
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k),
    };
  }
}

export async function getClient() {
  if (!isConfigured()) return null;
  if (client || initTried) return client;
  initTried = true;
  try {
    // Loaded from CDN via importmap (see index.html).
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // No magic-link / OAuth flow in this app, so there is never a token in
        // the URL to detect — and leaving it on would make the router's own
        // #/screen hash something the auth library tries to interpret.
        detectSessionInUrl: false,
        storageKey: 'mti-portal-auth',
        storage: authStorage(),
      },
    });
    return client;
  } catch (e) {
    console.warn('Supabase init failed — staying in demo mode.', e);
    return null;
  }
}

// The session left over from before a page reload, or null. Never throws:
// a failure here must land on the login screen, not on a blank page.
export async function currentSession() {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    if (!c) return null;
    const { data, error } = await c.auth.getSession();
    if (error) { console.warn('getSession failed', error); return null; }
    return (data && data.session) || null;
  } catch (e) {
    console.warn('getSession threw', e);
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

// ---------------------------------------------------------------------------
// fetchAllPaged — read an ENTIRE table, not just its first page.
//
// PostgREST caps every response at the project's `max-rows` (Supabase's default
// is 1000) and returns HTTP 200 with NO error. The truncation is completely
// invisible to `if (error)`, and `grep -rn "\.range(\|\.limit("` over this repo
// found exactly one hit in the whole codebase — so every fetch* treated its
// first page as the complete table.
//
// The worst case was surat_jalan. receivedQty() (core/outstanding.js) derives
// shipped quantity SOLELY by summing st.suratJalan, and fetchSuratJalan orders
// by created_at DESC — so the rows silently dropped were the OLDEST, i.e.
// exactly the historical shipments the calculation needs. A PO ordered 1,000
// and fully shipped two years ago would read received 0 / outstanding 1,000 and
// reappear on the Surat Jalan screen as ready to ship again.
//
// Pass a factory that applies .range(from, to) to your query; this walks pages
// until a short one comes back.
// ---------------------------------------------------------------------------
export const PAGE_SIZE = 1000;

export async function fetchAllPaged(makeQuery, pageSize = PAGE_SIZE) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    // Runaway guard. If this ever trips, the table is far larger than this
    // app's in-memory store was designed for — log it rather than silently
    // truncating, which is the exact failure mode this helper exists to fix.
    if (out.length >= 100000) { console.error('fetchAllPaged: 100k row cap hit — result IS truncated'); break; }
  }
  return { data: out, error: null };
}
