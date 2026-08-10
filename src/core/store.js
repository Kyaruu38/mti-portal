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
  // Versi yang terpasang di server, kalau berbeda dari yang sedang jalan
  // (core/updateCheck.js). updateDismissed menyimpan versi yang spanduknya
  // sudah ditutup manual — per nomor versi, supaya rilis berikutnya tetap
  // muncul.
  updateReady: null,
  updateDismissed: null,

  // domain data (seeded in core/seed.js). Kept flat & simple.
  suppliers: [],
  units: [],           // unit master (张/条/千克kg/set/…)
  items: [],           // item master (by ERP code)
  brandMap: [],        // { zh, canonical }
  designs: [],         // label design library
  descDict: [],        // learning bilingual description dictionary { en, zh }
  pos: [],             // purchase orders / contracts
  labelBatches: [],    // uploaded label requests
  labelRequests: [],   // sona's parsed requests awaiting a PO from purchasing
  ppkek: [],           // ppkek register rows
  invoices: [],        // incoming invoices
  prfs: [],            // payment request forms
  payments: [],        // payment history (proofs)
  audit: [],           // audit trail entries
  suratJalan: [],      // generated verification documents
  labelStock: [],      // Label Inventory Tracker: current stock per SKU
  labelUploads: [],    // upload history (who/when/counts/quarantined rows)
  labelSettings: null, // { moq, leadNormal, leadUrgent, leadSuper, overstockMultiple }
  labelTrend: [],      // total stock per upload day, for the dashboard chart
  // Ingatan harga label: { erp, supplier, harga, poNo, oleh, tanggal }, satu
  // baris per pasangan (ERP, pemasok). Mengisi kolom HARGA di Label Request
  // dan jadi pembanding untuk peringatan "harga berubah". BUKAN daftar harga
  // resmi dan tidak menahan apa pun — lihat core/labelPricesApi.js.
  labelPrices: [],

  // Sheet order (local / export / newitems / 加急优先下单) dari workbook yang
  // sama dengan tracker — APA YANG SONA MINTA DIBELI, mentah, sebelum diadu
  // dengan stok. Yang disimpan sengaja yang MENTAH, bukan hasil silangnya:
  // hasil silang bergantung pada stok, dan stok berubah tiap upload. Menyimpan
  // hasilnya berarti suatu hari layar menampilkan penilaian lama terhadap angka
  // baru. Disusun ulang tiap render dari core/labelBuyList.js — 129 baris lawan
  // dua Map, biayanya tidak terasa.
  //
  // HANYA BERTAHAN SELAMA SESI. Belum ada tabelnya di Supabase, dan menambah
  // tabel berarti SQL — yang bukan hak modul ini untuk menjalankan. Kalau tab
  // ditutup, sona mengunggah ulang berkas yang sama; tidak ada data yang rusak.
  labelBuyRaw: null,   // { fileName, at, bagian: [{ sheet, kategori, items }] }
  driveQueue: [],      // files stashed but not yet accepted by Drive (core/driveOutbox)

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
// Accepts a plain string OR a {id, en, zh} object.
//
// Objects are stored UNTRANSLATED and resolved at paint time (main.js toastEl
// -> tr()). Translating here would freeze the message into whatever language
// was active when the action fired: switch to English while a toast is up and
// it would sit there in Indonesian. Resolving on render means the language
// buttons re-word it in place, like everything else on screen.
export function toast(msg) {
  clearTimeout(toastTimer);
  setState({ toast: msg });
  toastTimer = setTimeout(() => setState({ toast: null }), 3600);
}

// Append an audit entry (who/when/what) — used across modules.
//
// Writes to BOTH the in-memory list (so the UI updates immediately) and the
// audit_log table (so the record survives a logout). It used to be memory-only:
// login() replaces state.audit with the server list, so every entry from an
// action that performed no DML — approving or rejecting a supplier bank change,
// deleting a supplier — silently disappeared on the next login.
//
// Deliberately NOT awaited: every call site is synchronous UI code. A failed
// write is logged to the console rather than thrown, so an audit outage can
// never abort the business action it was recording (same graceful-degradation
// rule as the Drive uploads).
export function logAudit(entry) {
  state.audit.unshift({
    id: uid('aud'),
    at: new Date().toISOString(),
    user: state.user ? state.user.username : 'system',
    ...entry,
  });
  if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  import('./auditApi.js')
    .then(m => m.insertAuditLog(entry))
    .catch(e => console.error('audit persist failed (non-fatal):', e));
}
