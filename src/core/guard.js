// Read-only account backstop.
//
// WHY THIS EXISTS
// ---------------
// Every write in this app is supposed to be gated twice: the button is hidden by
// a capability (auth/roles.js CAPS) and the write is refused by RLS. Adding the
// cenjc observer account showed that the first layer had a hole and the second
// has a blind spot:
//
//   * The hole. Until cenjc, every role that could SEE a screen could also write
//     on it, so most write buttons were gated by ACCESS alone. suratJalan.js,
//     ppkek.js and labelLibrary.js contained no capability check at all. Real
//     capabilities now exist for those (sjWrite / ppkekWrite / designWrite), but
//     per-button gating is exactly the kind of thing a future screen forgets.
//
//   * The blind spot. RLS cannot see a Google Drive upload. Three flows upload
//     the file BEFORE the database write — finance.js's payment proof,
//     labelLibrary.js's design, suratJalan.js's archive — so a read-only account
//     whose DB write is correctly refused could still push files into the
//     company Drive. Postgres has no say in that.
//
// So this is a third layer, at the one place every write must pass through. It
// is a BACKSTOP, not the primary control: a button that reaches it is a bug, and
// the console line says so. The user still gets a plain explanation instead of a
// stack trace, per the standing rule that a side feature must degrade rather
// than hard-fail.
//
// This is CLIENT-SIDE and therefore not a security boundary — anyone with a
// console can call past it. RLS remains the real boundary for everything that
// touches Postgres; see supabase_migration_cenjc.sql, which grants cenjc SELECT
// and nothing else, and adds them to neither is_purchasing() nor
// is_label_staff().

// DELIBERATELY NOT GUARDED — do not "fix" these:
//
//   core/supabase.js updatePassword / screens/changePassword.js
//       Every account is created with must_change_password = true and is forced
//       to set a new password on first login. Guarding this would lock a
//       read-only account out of the portal permanently, on its first visit.
//       Changing your own password is not a write against company data.
//
//   core/store.js logAudit -> insertAuditLog
//       If a write ever does slip past every gate, the audit row is the single
//       most valuable thing to have written. Blocking it would suppress exactly
//       the record needed to find the hole.
//
//   screens/labelRequest.js upsertItems
//       Local state only, and its sole caller (parseNow) is guarded — guarding
//       it too would fire a second toast for one refused action.
//
//   masterData.js brandsTab / dictTab / itemsTab / unitsTab
//       Render functions. They merely REFERENCE deleteXRow inside a
//       confirmDeleteBtn that is already behind `editable`, and every one of
//       those delete functions carries its own guard.

import { getState, toast } from './store.js';
import { isReadOnly } from '../auth/roles.js';

/**
 * True when the current account may not write. Safe before login (no user yet).
 */
export function readOnlySession() {
  const u = getState().user;
  return !!u && isReadOnly(u.role);
}

/**
 * Refuse an action for a read-only account.
 *
 * Returns true when the action was BLOCKED, so call sites read as an early exit:
 *
 *     if (blockWrite('buat surat jalan')) return;
 *
 * Deliberately does not throw: several call sites are event handlers with no
 * catch, and an exception there would take the screen down with it.
 *
 * @param {string} what  human description, shown in the toast
 * @returns {boolean}    true = blocked, caller must stop
 */
export function blockWrite(what) {
  if (!readOnlySession()) return false;
  const role = (getState().user || {}).role;
  // A reachable button is the bug worth finding, so name it loudly for whoever
  // is looking at the console — the toast alone would be invisible in a report.
  console.warn(`[guard] write blocked for read-only role "${role}": ${what}. A button for this should not have been reachable — gate it with a capability in auth/roles.js.`);
  toast(`Akun ${role} cuma bisa memantau — ${what} tidak dijalankan.`);
  return true;
}
