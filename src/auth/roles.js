// Roles, users, and screen access control.
// Menu items outside a role's scope are hidden (here) AND blocked by RLS
// (see supabase_schema.sql). Login is by username; usernames map to internal emails.

import { EMAIL_DOMAIN } from '../config.js';

// The 5 accounts. Passwords (88888888) live in Supabase Auth, not here.
// Display name === username (no invented full names). Role captions kept in `tag`.
export const USERS = {
  wilbert:    { name: 'wilbert',    tag: 'Purchasing Supervisor',  init: 'WI', color: '#F26722', lang: 'id' },
  cania:      { name: 'cania',      tag: 'Purchasing — Label & PO', init: 'CA', color: '#2E5EA8', lang: 'id' },
  visca:      { name: 'visca',      tag: 'Purchasing — Label & PO', init: 'VI', color: '#7C5CBF', lang: 'id' },
  sekar:      { name: 'sekar',      tag: 'PPKEK & Payment',         init: 'SE', color: '#1F8A4C', lang: 'id' },
  financemti: { name: 'financemti', tag: 'Finance Department',      init: 'FM', color: '#B48A1F', lang: 'en' },
};

// Screen access per role (menus hidden + RLS enforced).
//  wilbert    = full access + approval queue
//  cania/visca= Label + PO Converter + Master data (+ their label sub-screens)
//  sekar      = PPKEK + Payment(purchasing) + payment-status READ-ONLY
//  financemti = Finance dashboard only
export const ACCESS = {
  wilbert: ['dashboard', 'approval', 'label-request', 'label-library', 'surat-jalan', 'po-converter', 'ppkek', 'payment', 'finance', 'master-data', 'reports'],
  cania:   ['dashboard', 'label-request', 'label-library', 'surat-jalan', 'po-converter', 'master-data', 'reports'],
  visca:   ['dashboard', 'label-request', 'label-library', 'surat-jalan', 'po-converter', 'master-data', 'reports'],
  sekar:   ['dashboard', 'ppkek', 'payment', 'reports'],
  financemti: ['dashboard', 'finance'],
};

// Fine-grained capabilities (used to hide buttons + enforced by RLS).
export const CAPS = {
  wilbert:    { approve: true, markPaid: false, financeReceive: false, editMaster: true, paymentWrite: true, paymentReadonly: false },
  cania:      { approve: false, markPaid: false, financeReceive: false, editMaster: true, paymentWrite: false, paymentReadonly: false },
  visca:      { approve: false, markPaid: false, financeReceive: false, editMaster: true, paymentWrite: false, paymentReadonly: false },
  // sekar: purchasing-side payment + PPKEK; payment STATUS is read-only for sekar.
  sekar:      { approve: false, markPaid: false, financeReceive: false, editMaster: false, paymentWrite: true, paymentReadonly: true },
  // finance: only mark paid / receive; cannot approve POs.
  financemti: { approve: false, markPaid: true, financeReceive: true, editMaster: false, paymentWrite: false, paymentReadonly: false },
};

export function allowedScreens(role) { return ACCESS[role] || []; }
export function can(role, cap) { return !!(CAPS[role] && CAPS[role][cap]); }
export function usernameToEmail(username) { return `${username}@${EMAIL_DOMAIN}`; }
export function emailToUsername(email) { return String(email || '').split('@')[0]; }

export function makeUser(username) {
  const u = USERS[username];
  if (!u) return null;
  // role === username for the 5 built-in accounts.
  return { username, role: username, email: usernameToEmail(username), ...u };
}
