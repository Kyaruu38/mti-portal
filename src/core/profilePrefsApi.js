// Language and theme, stored on the account row so they follow the person and
// not the computer. See core/prefs.js for why there are two places at all.
//
// THE ONE RULE HERE: this module is allowed to fail.
//
// A preference is the least important thing in this app. It must never block a
// click, never throw into a handler, and never take a screen down with it — so
// every path returns quietly instead of raising, and a database that has not
// been migrated yet behaves exactly like a preference that was never set.
import { getClient, isConfigured } from './supabase.js';

// PostgREST rejects an ENTIRE write over one unknown column (PGRST204). Before
// supabase_profile_prefs.sql runs, `lang` and `theme` do not exist — so the
// update fails, and it must fail QUIETLY. This is the same column-drop guard
// used in suppliersApi/ppkekApi, kept deliberately small: there are only two
// columns, and dropping both leaves nothing to write.
const MISSING_COL = /could not find the '?([a-z0-9_]+)'? column|column "?([a-z0-9_]+)"? .* does not exist|PGRST204/i;

function isMissingColumn(e) {
  const s = `${(e && e.code) || ''} ${(e && e.message) || ''} ${(e && e.details) || ''}`;
  return MISSING_COL.test(s);
}

// Read the signed-in account's stored preference. Returns null for every
// "couldn't read" case — same contract as every other fetch* in core/: null
// means leave what you have alone, it does NOT mean "no preference set".
export async function fetchProfilePrefs() {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    if (!c) return null;
    const { data: auth } = await c.auth.getUser();
    const uid = auth && auth.user && auth.user.id;
    if (!uid) return null;
    const { data, error } = await c.from('profiles').select('lang, theme').eq('id', uid).maybeSingle();
    if (error) {
      if (!isMissingColumn(error)) console.warn('fetchProfilePrefs failed:', error);
      return null;
    }
    if (!data) return null;
    return { lang: data.lang || null, theme: data.theme || null };
  } catch (e) {
    console.warn('fetchProfilePrefs failed:', e);
    return null;
  }
}

// Persist one or both. Resolves either way — the caller (setPref) has already
// written to localStorage and is not waiting on this.
export async function saveProfilePref(patch) {
  if (!isConfigured()) return;
  const row = {};
  // Whitelisted on purpose. This function is reachable from a UI click, and the
  // only two things a click may ever write to the account row are these.
  if (patch && patch.lang) row.lang = patch.lang;
  if (patch && patch.theme) row.theme = patch.theme;
  if (!Object.keys(row).length) return;

  const c = await getClient();
  if (!c) return;
  const { data: auth } = await c.auth.getUser();
  const uid = auth && auth.user && auth.user.id;
  if (!uid) return;

  const { error } = await c.from('profiles').update(row).eq('id', uid);
  if (!error) return;
  if (isMissingColumn(error)) {
    // Migration not run yet. The browser copy still holds, so the user sees
    // their choice honoured on this machine and simply does not get it on the
    // next one. Warn once per click, do not surface it.
    console.warn('profiles.lang/theme belum ada di database — preferensi cuma tersimpan di browser ini. Jalankan supabase_profile_prefs.sql.');
    return;
  }
  console.warn('saveProfilePref failed:', error);
}
