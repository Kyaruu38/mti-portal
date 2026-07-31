// UI PREFERENCES ONLY — language and theme, nothing else, ever.
//
// The store's rule is that application data never leaves memory, and that rule
// is untouched here: no PO, supplier, invoice, PRF or PPKEK row is written to
// browser storage by this module or any other. What it holds is which of the
// three languages you last clicked and whether you had dark mode on — facts
// about the screen, not about the business.
//
// They live here because a page reload used to reset both. Restoring the
// session but handing it back in a language the user had switched away from
// ten minutes ago is a fix that still feels broken.
//
// sessionStorage, matching the auth token: tab-scoped, gone when the tab
// closes. Every call is guarded — storage disabled by policy or private mode
// must degrade to "preferences reset on reload", never to a crash.

const KEY = 'mti-portal-prefs';

function read() {
  try { return JSON.parse(window.sessionStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

export function getPref(name, fallback) {
  const v = read()[name];
  return v == null ? fallback : v;
}

export function setPref(name, value) {
  try {
    const all = read();
    all[name] = value;
    window.sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* preferences are a nicety; never let them break a click */ }
}
