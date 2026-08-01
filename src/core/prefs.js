// UI PREFERENCES ONLY — language and theme, nothing else, ever.
//
// The store's rule is that application data never leaves memory, and that rule
// is untouched here: no PO, supplier, invoice, PRF or PPKEK row is written to
// browser storage by this module or any other. What it holds is which of the
// three languages you last clicked and whether you had dark mode on — facts
// about the screen, not about the business.
//
// WHERE A PREFERENCE ACTUALLY LIVES
// -----------------------------------------------------------------------------
// Two places, and the split is deliberate:
//
//   profiles.lang / profiles.theme   the real preference. It belongs to the
//                                    PERSON, so sona setting Chinese on the
//                                    warehouse PC still gets Chinese on a
//                                    borrowed laptop.
//
//   localStorage                     a cache, and the ONLY thing the login
//                                    screen can read — before sign-in there is
//                                    no account to look the preference up on.
//                                    Also what keeps the screen from flashing
//                                    the wrong language for the half second the
//                                    profile row takes to arrive.
//
// This used to be sessionStorage, which is tab-scoped: closing the tab reset
// both. That is a setting, not a preference — you chose English, came back
// tomorrow, and the app had forgotten. localStorage survives that; the profile
// row survives changing computers.
//
// Every call is guarded. Storage disabled by policy or private mode, a profiles
// column that does not exist yet, a dead network — all of them must degrade to
// "preference not remembered", never to a crash and never to a blocked click.

import { saveProfilePref } from './profilePrefsApi.js';

const KEY = 'mti-portal-prefs';

function read() {
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

function write(all) {
  try { window.localStorage.setItem(KEY, JSON.stringify(all)); }
  catch { /* preferences are a nicety; never let them break a click */ }
}

// One-time carry-over so nobody's current choice is thrown away by the move
// from sessionStorage. Runs once, then the old key is dropped.
(function migrateFromSession() {
  try {
    const old = window.sessionStorage.getItem(KEY);
    if (!old) return;
    if (!window.localStorage.getItem(KEY)) window.localStorage.setItem(KEY, old);
    window.sessionStorage.removeItem(KEY);
  } catch { /* nothing to carry over, or storage is unavailable — fine either way */ }
})();

export function getPref(name, fallback) {
  const v = read()[name];
  return v == null ? fallback : v;
}

// Write locally FIRST, then tell the server. The order matters: the click must
// feel instant and must still work with Supabase unreachable. The server write
// is fire-and-forget by design — a failed preference save is a warning in the
// console, never a toast and never a thrown error in a click handler.
export function setPref(name, value) {
  const all = read();
  all[name] = value;
  write(all);
  Promise.resolve(saveProfilePref({ [name]: value })).catch(e =>
    console.warn(`preferensi '${name}' tidak tersimpan ke server (tetap tersimpan di browser ini):`, e && e.message ? e.message : e));
}

// Called by auth/session after the profile row arrives: the account's stored
// preference wins over whatever this browser happened to remember, and is
// cached locally so the next login renders correctly on the first frame.
export function adoptServerPrefs(prefs) {
  if (!prefs) return;
  const all = read();
  if (prefs.lang) all.lang = prefs.lang;
  if (prefs.theme) all.theme = prefs.theme;
  write(all);
}
