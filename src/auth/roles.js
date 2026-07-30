// Roles, users, and screen access control.
// Menu items outside a role's scope are hidden (here) AND blocked by RLS
// (see supabase_schema.sql). Login is by username; usernames map to internal emails.

import { EMAIL_DOMAIN } from '../config.js';

// The 6 accounts. Passwords live in Supabase Auth, not here.
// Display name === username (no invented full names). Role captions kept in `tag`.
export const USERS = {
  wilbert:    { name: 'wilbert',    tag: 'Purchasing Supervisor',  init: 'WI', color: '#F26722', lang: 'id' },
  cania:      { name: 'cania',      tag: 'Purchasing — Label & PO', init: 'CA', color: '#2E5EA8', lang: 'id' },
  visca:      { name: 'visca',      tag: 'Purchasing — Label & PO', init: 'VI', color: '#7C5CBF', lang: 'id' },
  sekar:      { name: 'sekar',      tag: 'PPKEK & Payment',         init: 'SE', color: '#1F8A4C', lang: 'id' },
  financemti: { name: 'financemti', tag: 'Finance Department',      init: 'FM', color: '#B48A1F', lang: 'en' },
  sona:       { name: 'sona',       tag: 'Label Stock & Request',   init: 'SO', color: '#0E7C86', lang: 'id' },
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
  sekar:   ['dashboard', 'ppkek', 'payment', 'reports'],
  financemti: ['dashboard', 'finance'],
  // sona owns the weekly label-stock routine (the workbook's own Instructions
  // sheet says as much) and raises label requests. Nothing else — deliberately
  // NOT in is_purchasing() server-side, so she has no write access to suppliers,
  // designs or surat jalan even though those menus are simply absent here.
  sona:    ['dashboard', 'label-request', 'label-stock'],
};

// Fine-grained capabilities (used to hide buttons + enforced by RLS).
//  labelStockWrite = upload a new Label Inventory Tracker sheet. Read access to
//                 the screen is granted by ACCESS above; this gates the upload
//                 card, because overwriting 984 rows is not a read.
//  paymentWrite = purchasing-side INTAKE half of the Payment screen
//                 (add invoice, upload faktur, hand invoice to Wilbert).
//  prfCreate    = PRF builder + preview + "Kirim ke Wilbert".
//                 Split out from paymentWrite so cania/visca can generate a
//                 PRF without owning invoice intake or stage tracking.
export const CAPS = {
  wilbert:    { approve: true, markPaid: false, financeReceive: false, editMaster: true, labelStockWrite: true, paymentWrite: true, prfCreate: true, paymentReadonly: false },
  cania:      { approve: false, markPaid: false, financeReceive: false, editMaster: true, labelStockWrite: true, paymentWrite: false, prfCreate: true, paymentReadonly: false },
  visca:      { approve: false, markPaid: false, financeReceive: false, editMaster: true, labelStockWrite: true, paymentWrite: false, prfCreate: true, paymentReadonly: false },
  // sekar: purchasing-side payment + PPKEK; payment STATUS is read-only for sekar.
  sekar:      { approve: false, markPaid: false, financeReceive: false, editMaster: false, labelStockWrite: false, paymentWrite: true, prfCreate: true, paymentReadonly: true },
  // finance: only mark paid / receive; cannot approve POs or raise a PRF.
  financemti: { approve: false, markPaid: true, financeReceive: true, editMaster: false, labelStockWrite: false, paymentWrite: false, prfCreate: false, paymentReadonly: false },
  // sona: the ONLY capability she holds is the label-stock upload.
  sona:       { approve: false, markPaid: false, financeReceive: false, editMaster: false, labelStockWrite: true, paymentWrite: false, prfCreate: false, paymentReadonly: false },
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
};
export function allowedReportModules(role) { return REPORT_MODULES[role] || []; }

export function allowedScreens(role) { return ACCESS[role] || []; }
export function can(role, cap) { return !!(CAPS[role] && CAPS[role][cap]); }
export function usernameToEmail(username) { return `${username}@${EMAIL_DOMAIN}`; }
export function emailToUsername(email) { return String(email || '').split('@')[0]; }

export function makeUser(username) {
  const u = USERS[username];
  if (!u) return null;
  // role === username for the built-in accounts.
  return { username, role: username, email: usernameToEmail(username), ...u };
}
