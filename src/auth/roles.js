// Roles, users, and screen access control.
// Menu items outside a role's scope are hidden (here) AND blocked by RLS
// (see supabase_schema.sql). Login is by username; usernames map to internal emails.

import { EMAIL_DOMAIN } from '../config.js';

// The 7 accounts. Passwords live in Supabase Auth, not here.
// Display name === username (no invented full names). Role captions kept in `tag`.
export const USERS = {
  wilbert:    { name: 'wilbert',    tag: 'Purchasing Supervisor',  init: 'WI', color: '#F26722', lang: 'id' },
  cania:      { name: 'cania',      tag: 'Purchasing — Label & PO', init: 'CA', color: '#2E5EA8', lang: 'id' },
  visca:      { name: 'visca',      tag: 'Purchasing — Label & PO', init: 'VI', color: '#7C5CBF', lang: 'id' },
  sekar:      { name: 'sekar',      tag: 'PPKEK & Payment',         init: 'SE', color: '#1F8A4C', lang: 'id' },
  financemti: { name: 'financemti', tag: 'Finance Department',      init: 'FM', color: '#B48A1F', lang: 'en' },
  sona:       { name: 'sona',       tag: 'Label Stock & Request',   init: 'SO', color: '#0E7C86', lang: 'id' },
  // Slate grey on purpose. The avatar is the one element visible on every
  // screen, so an observer account should not look like an operator account.
  cenjc:      { name: 'cenjc',      tag: 'Monitoring — Read Only',  init: 'CE', color: '#5C6470', lang: 'id' },
};

// Screen access per role (menus hidden + RLS enforced).
//  wilbert    = full access + approval queue
//  cania/visca= Label + PO Converter + Master data (+ their label sub-screens)
//               + Payment screen in PRF-GENERATE-ONLY mode (no invoice intake,
//               no stage tracking) - see paymentScreen()'s canIntake branch
//  sekar      = PPKEK + Payment(purchasing) + payment-status READ-ONLY
//  financemti = Finance dashboard only
//  sona       = Label Request + Label Stock (weekly Excel upload) only
export const ACCESS = {
  wilbert: ['dashboard', 'approval', 'label-request', 'label-library', 'label-stock', 'surat-jalan', 'po-converter', 'ppkek', 'payment', 'finance', 'master-data', 'reports'],
  cania:   ['dashboard', 'label-request', 'label-library', 'label-stock', 'surat-jalan', 'po-converter', 'payment', 'master-data', 'reports'],
  visca:   ['dashboard', 'label-request', 'label-library', 'label-stock', 'surat-jalan', 'po-converter', 'payment', 'master-data', 'reports'],
  // 'finance' added 31 Jul 2026 so sekar can post the transfer proof. Finance
  // shares proofs into a group chat rather than entering them one by one, so
  // the person who actually transcribes them is sekar. She gets the SCREEN, not
  // finance's decisions: financeReceive stays finance-only, so nothing can be
  // paid until finance has signed off the 4-point document checklist.
  sekar:   ['dashboard', 'ppkek', 'payment', 'finance', 'reports'],
  financemti: ['dashboard', 'finance'],
  // sona owns the weekly label-stock routine (the workbook's own Instructions
  // sheet says as much) and raises label requests. Nothing else — deliberately
  // NOT in is_purchasing() server-side, so she has no write access to suppliers,
  // designs or surat jalan even though those menus are simply absent here.
  sona:    ['dashboard', 'label-request', 'label-stock'],
  // cenjc WATCHES the whole pipeline and changes nothing. Same screen list as
  // wilbert, zero write capabilities (see CAPS below).
  //
  // Screen presence was never a write boundary in this app — until cenjc every
  // role that could SEE a screen could also write on it, so most write buttons
  // were gated by ACCESS alone. Granting all 12 screens to a read-only role is
  // what forced the real gates to exist (sjWrite / ppkekWrite / poCreate /
  // designWrite / labelParse below), and those gates now protect every role,
  // not just this one.
  cenjc:   ['dashboard', 'approval', 'label-request', 'label-library', 'label-stock', 'surat-jalan', 'po-converter', 'ppkek', 'payment', 'finance', 'master-data', 'reports'],
};

// Fine-grained capabilities (used to hide buttons + enforced by RLS).
//
//  approve         PO approve / reject / edit, and the auto-approve status on a
//                  PO this role generates. wilbert only.
//  markPaid        move a PRF to Paid + attach the transfer proof. finance only.
//  financeReceive  move a PRF to Diterima Finance. finance only — and this is
//                  now the ONLY step in the payment chain that purchasing
//                  cannot perform. Everything either side of it (raise the PRF,
//                  confirm it paid) is reachable from the purchasing side, so
//                  this single checklist is what keeps a second pair of eyes in
//                  the chain at all. Worth remembering before it is ever
//                  granted more widely.
//  editMaster      add/edit/delete suppliers, items, brand map, dictionary, units.
//  labelStockWrite upload a new Label Inventory Tracker sheet AND confirm ERP
//                  matches. Read access to the screen comes from ACCESS; this
//                  gates the mutations, because overwriting 984 rows is not a read.
//  paymentWrite    purchasing-side INTAKE half of Payment (add invoice, upload
//                  faktur, hand invoice to Wilbert).
//  prfCreate       PRF builder + preview + "Kirim ke Wilbert". Split out from
//                  paymentWrite so cania/visca can generate a PRF without owning
//                  invoice intake or stage tracking.
//  paymentReadonly the FINANCE stage is read-only for this role (a badge + gate,
//                  not a permission to write anything).
//  prfReceive      tick off the printed PRFs that have physically arrived on the
//                  supervisor's desk, moving them from "Terbentuk" to
//                  "Diproses Supervisor". Deliberately NOT given to the roles
//                  that RAISE PRFs (cania/visca/sekar): the whole point of the
//                  step is that the supervisor confirms he is holding the paper,
//                  and a maker who can tick their own delivery confirms nothing.
//
// ADDED FOR THE OBSERVER ROLE — these five actions had NO capability at all and
// were reachable by anyone holding the screen. Each mirrors the RLS policy that
// already governs the same table, so the button and the database now agree:
//  sjWrite         create surat jalan / ship over-delivery / re-archive.  sj_rw
//  ppkekWrite      PPKEK register: dropzone, inline cell edit, import-apply. ppkek_rw
//  designWrite     upload to the design library.                        designs_write
//  poCreate        generate a PO (PO Converter + Label Request).         pos_insert
//  labelRequestAsk submit a parsed label sheet as a REQUEST, for purchasing to
//                  turn into a PO. sona's half of the split: she owns the
//                  weekly workbook and knows what needs printing; cania and
//                  visca own suppliers and purchase orders. Before this the
//                  screen collapsed both into one button and gave it to
//                  everyone who could parse — so sona was raising POs, and
//                  nothing recorded what she had actually asked for.
//  labelRequestFill pick up a submitted request and turn it into a PO.
//  labelParse      parse a label Excel into the item master.
//
//  readOnly        this account may not write ANYTHING. Powers the central guard
//                  in core/guard.js and the few gates that key off authorship
//                  rather than a capability (approval.js's request-delete).
//
// Granted capabilities are listed by name. Anything not listed is false, and
// can() already returns false for an unknown cap — so adding a new capability
// cannot silently grant it to a role that was written before the cap existed.
// (The previous shape was an explicit true/false per role, which had the
// opposite failure mode: a new cap had to be pasted into all seven rows, and
// missing one row read as a deliberate deny.)
const grant = (...names) => Object.fromEntries(names.join(' ').split(/\s+/).filter(Boolean).map(n => [n, true]));

export const CAPS = {
  wilbert:    grant('approve editMaster labelStockWrite paymentWrite prfCreate prfReceive markPaid sjWrite ppkekWrite designWrite poCreate labelParse labelRequestFill'),
  cania:      grant('editMaster labelStockWrite prfCreate sjWrite designWrite poCreate labelParse labelRequestFill'),
  visca:      grant('editMaster labelStockWrite prfCreate sjWrite designWrite poCreate labelParse labelRequestFill'),
  // sekar: purchasing-side payment + PPKEK; payment STATUS is read-only for sekar.
  sekar:      grant('paymentWrite prfCreate paymentReadonly ppkekWrite markPaid'),
  // finance: receive + mark paid; cannot approve POs or raise a PRF. Keeps
  // markPaid even though sekar now has it — finance posting its own proof must
  // not stop working just because someone else usually does it.
  financemti: grant('markPaid financeReceive'),
  // sona: label stock upload + ERP matching, label parse, and raising a label
  // request PO. Still NOT in is_purchasing() server-side — no sjWrite, no
  // designWrite, no editMaster.
  // sona ASKS, she does not raise the PO. poCreate removed on 31 Jul 2026 —
  // see labelRequestAsk above.
  sona:       grant('labelStockWrite labelParse labelRequestAsk'),
  // cenjc: nothing. Not one write capability, by design.
  cenjc:      grant('readOnly'),
};

// Which Reports modules a role may see.
//
// The Reports screen flattens PO + PPKEK + PRF + Label + Payment into one table
// with an Excel export, and login() fetches all of those tables for every role.
// Granting the screen therefore granted FINANCE data (PRF amounts, payment
// history) to purchasing roles whose scope doesn't include it.
//
// Per the owner's decision: sekar tracks PRF progress (read-only), cania/visca
// only CREATE PRFs and get no payment visibility at all.
export const REPORT_MODULES = {
  wilbert:    ['Label', 'PO', 'PPKEK', 'PRF', 'Payment'],
  cania:      ['Label', 'PO'],
  visca:      ['Label', 'PO'],
  sekar:      ['PPKEK', 'PRF'],
  financemti: ['PRF', 'Payment'],
  sona:       [],   // no Reports screen at all; listed so the lookup is explicit
  // Full visibility, per the owner's decision on 31 Jul. This is the whole point
  // of the account: one place to see where every document actually is.
  cenjc:      ['Label', 'PO', 'PPKEK', 'PRF', 'Payment'],
};
export function allowedReportModules(role) { return REPORT_MODULES[role] || []; }

export function allowedScreens(role) { return ACCESS[role] || []; }
export function can(role, cap) { return !!(CAPS[role] && CAPS[role][cap]); }

// A role that may not write anything. Kept separate from can(..., 'readOnly')
// only for readability at call sites, where the negation reads badly.
//
// Use this ONLY for gates that cannot be expressed as a capability — chiefly
// approval.js's request-delete, which is granted by AUTHORSHIP (po.by === me)
// rather than by a cap, and would therefore reopen for an observer the moment a
// PO carrying their username existed. For everything else gate on the specific
// capability, so the reason a button is hidden stays legible.
export function isReadOnly(role) { return can(role, 'readOnly'); }
export function usernameToEmail(username) { return `${username}@${EMAIL_DOMAIN}`; }
export function emailToUsername(email) { return String(email || '').split('@')[0]; }

export function makeUser(username) {
  const u = USERS[username];
  if (!u) return null;
  // role === username for the built-in accounts.
  return { username, role: username, email: usernameToEmail(username), ...u };
}
