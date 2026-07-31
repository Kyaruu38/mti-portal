// Cross-module lookup for the top-bar Global Search (see ui/layout.js). Pure
// function over the in-memory store — no DOM, no state mutation — so it's
// safe to call on every keystroke. The dropdown that renders these results
// is direct-DOM (not mount()-based) precisely so typing never re-renders
// the input itself; see layout.js's header() for that half.
//
// PO/PRF are documents this app generates, not files it archives to Drive —
// drive is deliberately always null for those two, not a bug.
//
// ROLE FILTERING
// --------------
// This used to sweep every store array with NO role check at all, while
// layout.js rendered the search box for everyone. RLS covered most of it — a
// role that cannot fetch a table has an empty array to search — but not all:
// prfs_read includes cania and visca (they raise PRFs), yet their
// REPORT_MODULES is deliberately ['Label','PO'] with no PRF, because the owner
// decided on 30 Jul that they create PRFs and get no payment visibility. Search
// handed them PRF numbers and suppliers anyway, straight past that decision.
//
// One uniform rule does not work here, and trying to find one is how you break
// something legitimate:
//   * "must hold the screen that displays it" would cut PO search from
//     cania/visca, who create POs all day and have PO in their report modules —
//     they simply have no approval screen.
//   * "must have the report module" would cut Invoice from sekar, who OWNS
//     invoice intake, because her modules are ['PPKEK','PRF'].
// So each type carries its own predicate, written next to the reason for it.
//
// `screen` is also the click target used by layout.js navigateTo(), kept here so
// the thing that decides visibility and the thing that decides where "Buka"
// lands can never drift apart.
import { allowedScreens, allowedReportModules } from '../auth/roles.js';

const hasScreen = (role, id) => allowedScreens(role).includes(id);
const hasModule = (role, m) => allowedReportModules(role).includes(m);

// `screens` is an ORDERED preference list, not a single destination: the same
// document lives on different screens for different roles. A PRF is opened from
// Payment by sekar and from Finance by financemti, and financemti holds neither
// Payment nor Reports — a single fixed target left them with a result they could
// see and no way to reach.
export const SEARCH_TYPES = {
  // Anyone who reviews POs (approval) or reports on them. Covers cania/visca,
  // who generate POs but never see the approval queue.
  'PO': { screens: ['approval'], visible: r => hasScreen(r, 'approval') || hasModule(r, 'PO') },
  // Invoice intake lives on Payment (sekar); overdue invoices show on Finance.
  'Invoice': { screens: ['payment', 'finance'], visible: r => hasScreen(r, 'payment') || hasScreen(r, 'finance') },
  // Straightforward: the screen is the only place these are used.
  'Surat Jalan': { screens: ['surat-jalan'], visible: r => hasScreen(r, 'surat-jalan') },
  // THE ONE THAT WAS LEAKING. Report module, not screen access — cania/visca
  // hold the Payment screen in PRF-generate-only mode, so a screen check would
  // have left the leak exactly as it was.
  'PRF': { screens: ['payment', 'finance'], visible: r => hasModule(r, 'PRF') },
  'PPKEK': { screens: ['ppkek'], visible: r => hasScreen(r, 'ppkek') },
};

// The screen THIS role should be taken to for this type, or null if none of the
// candidates is available to them. sona could previously search a PO and click
// through to the approval screen she has no access to, landing on the
// "belum punya hak akses" box.
export function openTarget(role, type) {
  const cfg = SEARCH_TYPES[type];
  if (!cfg || !role) return null;
  return cfg.screens.find(id => hasScreen(role, id)) || null;
}

export function canOpen(role, type) { return !!openTarget(role, type); }

// True when this role can search for nothing at all (sona). layout.js hides the
// box entirely rather than offering a field that always answers "no results".
export function searchableTypes(role) {
  return Object.keys(SEARCH_TYPES).filter(k => SEARCH_TYPES[k].visible(role));
}

export function globalSearch(st, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return [];
  const hit = s => s != null && String(s).toLowerCase().includes(query);
  // A file/driveUrl is only worth linking to once it's a real webViewLink —
  // uploadToDrive() placeholders (`drive-pending://`, `drive-error://`) are
  // not openable, same guard ui/components.js's driveLink() already applies
  // everywhere else a Drive link is shown.
  const realUrl = u => (u && !String(u).startsWith('drive-')) ? u : null;

  // Role of the CURRENT session. A missing user (pre-login) can search nothing.
  const role = st.user ? st.user.role : null;
  const may = type => !!role && SEARCH_TYPES[type].visible(role);

  const results = [];

  if (may('PO')) for (const p of st.pos) {
    if (hit(p.no) || hit(p.contract) || hit(p.supplier) || hit(p.supplierZh)) {
      results.push({ type: 'PO', id: p.no, sub: p.supplier, ref: p, drive: null });
    }
  }
  if (may('Invoice')) for (const i of st.invoices) {
    if (hit(i.no) || hit(i.supplier) || hit(i.poRef)) {
      results.push({ type: 'Invoice', id: i.no, sub: i.supplier, ref: i, drive: realUrl(i.files && i.files[0] && i.files[0].url) });
    }
  }
  if (may('Surat Jalan')) for (const s of st.suratJalan) {
    if (hit(s.no) || hit(s.docNo) || hit(s.supplier) || hit(s.poNo)) {
      results.push({ type: 'Surat Jalan', id: s.no, sub: s.supplier, ref: s, drive: realUrl(s.driveUrl) });
    }
  }
  if (may('PRF')) for (const p of st.prfs) {
    if (hit(p.no) || hit(p.supplier)) {
      results.push({ type: 'PRF', id: p.no, sub: p.supplier, ref: p, drive: null });
    }
  }
  if (may('PPKEK')) for (const k of st.ppkek) {
    if (hit(k.nopen) || hit(k.supplier)) {
      results.push({ type: 'PPKEK', id: k.nopen, sub: k.supplier, ref: k, drive: realUrl(k.driveUrl) });
    }
  }

  return results.slice(0, 15);
}
