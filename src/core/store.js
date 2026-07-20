// In-memory reactive store. IMPORTANT: per spec, we NEVER use localStorage or
// sessionStorage. State lives here (in memory) and, when configured, in Supabase.

const state = {
  // session / ui
  user: null,          // { username, name, role, tag, init, color, email }
  screen: 'login',
  theme: 'light',
  density: 'compact',
  lang: 'id',          // id | en | zh (per-account preference, see auth/session)
  menuOpen: false,
  langOpen: false,
  toast: null,

  // domain data (seeded in core/seed.js). Kept flat & simple.
  suppliers: [],
  units: [],           // unit master (张/条/千克kg/set/…)
  items: [],           // item master (by ERP code)
  brandMap: [],        // { zh, canonical }
  designs: [],         // label design library
  descDict: [],        // learning bilingual description dictionary { en, zh }
  pos: [],             // purchase orders / contracts
  labelBatches: [],    // uploaded label requests
  ppkek: [],           // ppkek register rows
  invoices: [],        // incoming invoices
  prfs: [],            // payment request forms
  payments: [],        // payment history (proofs)
  audit: [],           // audit trail entries
  suratJalan: [],      // generated verification documents

  // transient module state
  ui: {},              // per-screen scratch space
};

let seq = 1;
export function uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`; }

const subs = new Set();
let scheduled = false;

export function getState() { return state; }

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

function flush() {
  scheduled = false;
  subs.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

// Merge a patch into state and notify subscribers (batched via microtask).
export function setState(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  if (!scheduled) { scheduled = true; queueMicrotask(flush); }
}

// Set a value inside state.ui without clobbering other scratch keys.
export function setUI(patch) {
  state.ui = { ...state.ui, ...patch };
  if (!scheduled) { scheduled = true; queueMicrotask(flush); }
}

// Toast helper (auto-dismiss).
let toastTimer = null;
export function toast(msg) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), 3600);
}

// Append an audit entry (who/when/what) — used across modules.
export function logAudit(entry) {
  state.audit.unshift({
    id: uid('aud'),
    at: new Date().toISOString(),
    user: state.user ? state.user.username : 'system',
    ...entry,
  });
}
