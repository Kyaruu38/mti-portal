import { setState, getState, toast } from '../core/store.js';
import { makeUser, usernameToEmail, allowedScreens } from './roles.js';
import { isConfigured, signIn, signOut, fetchMustChangePassword, currentSession } from '../core/supabase.js';
import { seedIfEmpty } from '../core/seed.js';
import { getPref } from '../core/prefs.js';
import { DEMO_PASSWORD } from '../config.js';
import { t } from '../i18n/index.js';
import { fetchSuratJalan } from '../core/suratJalanApi.js';
import { fetchPOs, UUID_RE } from '../core/posApi.js';
import { fetchSuppliers } from '../core/suppliersApi.js';
import { fetchAuditLog } from '../core/auditApi.js';
import { fetchDescDict } from '../core/descDictApi.js';
import { fetchItems } from '../core/itemsApi.js';
import { fetchBrandMap } from '../core/brandMapApi.js';
import { fetchDesigns } from '../core/designsApi.js';
import { fetchUnits } from '../core/unitsApi.js';
import { fetchInvoices } from '../core/invoicesApi.js';
import { fetchPrfs } from '../core/prfsApi.js';
import { fetchPayments } from '../core/paymentsApi.js';
import { fetchPpkek } from '../core/ppkekApi.js';
import { fetchLabelStock, fetchLabelUploads, fetchLabelSettings } from '../core/labelStockApi.js';

// Log in by username. Uses Supabase Auth when configured; otherwise a demo check.
export async function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  const user = makeUser(username);
  if (!user) { toast(t('login_bad')); return false; }

  if (isConfigured()) {
    try {
      await signIn(usernameToEmail(username), password);
    } catch (e) {
      console.warn(e);
      toast(t('login_bad'));
      return false;
    }
  } else {
    // Demo mode: accept the shared demo password.
    if (password !== DEMO_PASSWORD) { toast(t('login_bad')); return false; }
  }

  // Honour the screen in the URL here too. In production a reload restores the
  // session and never reaches this function — but when the token HAS expired,
  // the user lands on the login form and typing the password should still put
  // them back where they were, not on the Dashboard.
  return hydrate(user, username, wantedScreen());
}

// Pick up the session left behind by a page reload.
//
// Everything below hydrate() used to live inside login(), reachable only by
// typing a password — so a refresh could not get the data back even if the
// token had survived, and the app had no honest choice but the login screen.
// Split out, the same load runs for both doors.
//
// Returns false for anything unexpected (no session, an account no longer in
// roles.js, a failed load) and the caller falls through to the login screen.
// An auth path must fail towards asking for a password, never past it.
export async function restoreSession() {
  if (!isConfigured()) return false;
  const session = await currentSession();
  const email = session && session.user && session.user.email;
  if (!email) return false;
  const username = String(email).split('@')[0].toLowerCase();
  const user = makeUser(username);
  // Token still valid but the account has since been removed from roles.js.
  // Sign it out rather than leaving a token that keeps half-working.
  if (!user) { try { await signOut(); } catch { /* ignore */ } return false; }
  try {
    return await hydrate(user, username, wantedScreen(), prefLang());
  } catch (e) {
    console.warn('Session restore failed — falling back to login.', e);
    return false;
  }
}

// The screen named in the URL (#/ppkek), if any. The router writes it on every
// navigation, so a reload can land back where the work was — which is the whole
// point: being logged in again but dumped on the Dashboard is only half a fix.
function prefLang() { return getPref('lang', null); }

function wantedScreen() {
  try { return String(location.hash || '').replace(/^#\/?/, '').trim(); }
  catch { return ''; }
}

// Everything a signed-in session needs in memory. Called by BOTH login() and
// restoreSession() — one load path, so a restored session can never quietly
// have less data than a typed-password one.
async function hydrate(user, username, preferScreen, preferLang) {
  // Seed fixtures are a DEMO MODE thing only — a real Supabase connection
  // means real (possibly still-empty) tables are the source of truth, and
  // showing fixture PO/supplier/activity data on top of that would just be
  // confusing fake data in a production portal. isConfigured() is the exact
  // same check FEATURES.useSupabase is derived from (config.js).
  if (!isConfigured()) {
    seedIfEmpty();
  }

  // Surat Jalan is wired to Supabase — pull the live, shared record set on
  // login so every user's session starts from server truth instead of
  // yesterday's seed data (fixed via A2 review).
  const sjFromServer = await fetchSuratJalan();
  if (sjFromServer) getState().suratJalan = sjFromServer;

  // POs (A3): server rows are the source of truth and get replaced wholesale
  // on every login. Seed fixtures and any PO whose insert failed to sync
  // (non-UUID id, see posApi.js UUID_RE) are local-only by definition and are
  // never touched here — they live in a disjoint id space from real server
  // rows, so an empty/misbehaving server can't wipe the demo fixtures and a
  // real PO can never be shadowed by a seed one. In production (no seed ever
  // ran) st.pos just starts as [], so this naturally yields "empty until
  // real POs exist."
  const posFromServer = await fetchPOs();
  if (posFromServer) {
    const st = getState();
    const localOnly = st.pos.filter(p => !UUID_RE.test(p.id));
    st.pos = [...posFromServer, ...localOnly];
  }

  // Suppliers: same wholesale-replace pattern. Master Data's saveSup() already
  // lazy-upserts against real Supabase ids (UUID_RE), so fetching here just
  // closes the same cross-session-visibility gap A3 closed for POs — a
  // supplier cania creates now shows up for wilbert in a separate session.
  const suppliersFromServer = await fetchSuppliers();
  if (suppliersFromServer) getState().suppliers = suppliersFromServer;

  // Batch 1 (Group A — light CRUD, no cross-module dependency): same
  // wholesale-replace fetch pattern as suppliers/pos above, now covering the
  // 4 remaining tables that already had both a schema table and RLS policies
  // ready (see the recon) — only the frontend wiring was missing.
  const descDictFromServer = await fetchDescDict();
  if (descDictFromServer) getState().descDict = descDictFromServer;

  const itemsFromServer = await fetchItems();
  if (itemsFromServer) getState().items = itemsFromServer;

  const brandMapFromServer = await fetchBrandMap();
  if (brandMapFromServer) getState().brandMap = brandMapFromServer;

  const designsFromServer = await fetchDesigns();
  if (designsFromServer) getState().designs = designsFromServer;

  const unitsFromServer = await fetchUnits();
  if (unitsFromServer) getState().units = unitsFromServer;

  // Batch 2 (Finance): invoices -> prfs -> payments, same wholesale-replace
  // fetch pattern. Dependency order matters for reasoning about the data
  // (a PRF references invoice numbers, a payment references a PRF), but the
  // fetches themselves are independent reads — order here doesn't matter
  // functionally, kept in the same order as the dependency for readability.
  const invoicesFromServer = await fetchInvoices();
  if (invoicesFromServer) getState().invoices = invoicesFromServer;

  const prfsFromServer = await fetchPrfs();
  if (prfsFromServer) getState().prfs = prfsFromServer;

  const paymentsFromServer = await fetchPayments();
  if (paymentsFromServer) getState().payments = paymentsFromServer;

  // Batch 3 (PPKEK): same wholesale-replace pattern. Only sekar/wilbert have
  // ppkek_rw, so this returns null (not []) for every other role and their
  // seeded/local st.ppkek is left untouched — consistent with fetchInvoices
  // et al returning null on any non-visible/failed fetch.
  const ppkekFromServer = await fetchPpkek();
  if (ppkekFromServer) getState().ppkek = ppkekFromServer;

  // Dashboard "Aktivitas Terbaru": pull the real, trigger-written audit_log
  // (item 4) instead of leaving it to seed fixtures. RLS scopes this per
  // role automatically (admin sees everyone, others see their own actions)
  // — same policy the Master Data audit drawer already relies on. Only
  // covers suppliers/prfs/pos (the 3 trigger-backed tables); other modules'
  // logAudit() calls still append locally on top of this during the session.
  const auditFromServer = await fetchAuditLog(null, null, 20);
  if (auditFromServer) {
    getState().audit = auditFromServer.map(a => ({
      id: a.id, at: a.at, user: a.username, entity: a.entity, target: a.target, action: a.action, detail: a.detail, status: a.status,
    }));
  }

  // Label Inventory Tracker. RLS scopes these to is_purchasing(), so for sekar
  // and financemti the fetches return null and their (empty) local arrays are
  // left alone — same null-means-couldn't-read contract as every fetch above.
  const labelFromServer = await fetchLabelStock();
  if (labelFromServer) getState().labelStock = labelFromServer;
  const labelUploadsFromServer = await fetchLabelUploads();
  if (labelUploadsFromServer) getState().labelUploads = labelUploadsFromServer;
  const labelSettingsFromServer = await fetchLabelSettings();
  if (labelSettingsFromServer) getState().labelSettings = labelSettingsFromServer;

  // Force-change-password gate: checked on every login, not cached anywhere
  // client-side — main.js's router reads user.mustChangePassword before
  // rendering ANY other screen, regardless of st.screen.
  user.mustChangePassword = await fetchMustChangePassword(username);

  const allowed = allowedScreens(username);
  const first = allowed[0] || 'dashboard';
  // A screen asked for by the URL only wins if this role is actually allowed
  // it — the hash is user-editable, so it is a request, never a grant.
  const screen = (preferScreen && allowed.includes(preferScreen)) ? preferScreen : first;
  setState({ user, screen, lang: preferLang || user.lang || 'id', menuOpen: false });
  return true;
}

// Pull server state again without reloading the page. Same load as login(),
// minus the auth — for the moment you want to see what someone else just
// entered and would otherwise hit F5 for.
export async function refreshData() {
  const st = getState();
  if (!st.user) return false;
  // Keep the language the user is actually reading in — a data refresh is
  // not a reason to snap back to the account default.
  return hydrate(st.user, st.user.username, st.screen, st.lang);
}

export async function logout() {
  try { await signOut(); } catch { /* ignore */ }
  // Module-level drafts live outside the store, so resetting state isn't enough
  // — a typed rejection reason survived logout into the next user's session.
  try { const m = await import('../screens/approval.js'); m.resetApprovalDrafts(); } catch { /* ignore */ }
  // Wipe EVERYTHING, not just the user.
  //
  // This used to clear only user/screen/menuOpen, leaving state.ui and every
  // domain array in memory for whoever logged in next on the same tab. Two real
  // consequences:
  //   * a half-finished modal survived the switch — financemti's finance-receive
  //     drawer re-rendered for wilbert, whose footer button is gated only on the
  //     4/4 checklist, letting him complete an action his role doesn't have;
  //   * ui.prfDraft.supplier holds a REFERENCE to a supplier object; after the
  //     next login fetchSuppliers() replaces st.suppliers with fresh objects, so
  //     a still-open PRF preview printed the previous, now-detached bank details
  //     and submitting it persisted a PRF with the old user in `by`.
  // login() re-fetches everything it needs, and a fetch that returns null now
  // finds an empty array rather than the previous user's rows.
  setState({
    user: null, screen: 'login', menuOpen: false, langOpen: false, toast: null,
    ui: {},
    suppliers: [], units: [], items: [], brandMap: [], designs: [], descDict: [],
    pos: [], labelBatches: [], ppkek: [], invoices: [], prfs: [], payments: [],
    audit: [], suratJalan: [],
    labelStock: [], labelUploads: [], labelSettings: null,
  });
}
