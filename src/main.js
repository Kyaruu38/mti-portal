import { h, mount, svg } from './core/dom.js';
import { ICONS } from './core/icons.js';
import { getState, subscribe, setState } from './core/store.js';
import { appShell } from './ui/layout.js';
import { allowedScreens } from './auth/roles.js';
import { isConfigured } from './core/supabase.js';
import { restoreSession } from './auth/session.js';
import { getPref } from './core/prefs.js';
import { t, tr } from './i18n/index.js';

import { loginScreen } from './screens/login.js';
import { changePasswordScreen } from './screens/changePassword.js';
import { dashboardScreen } from './screens/dashboard.js';
import { labelRequestScreen } from './screens/labelRequest.js';
import { labelLibraryScreen } from './screens/labelLibrary.js';
import { labelStockScreen } from './screens/labelStock.js';
import { suratJalanScreen } from './screens/suratJalan.js';
import { poConverterScreen } from './screens/poConverter.js';
import { outstandingPoScreen } from './screens/outstandingPo.js';
import { approvalScreen } from './screens/approval.js';
import { ppkekScreen } from './screens/ppkek.js';
import { paymentScreen } from './screens/payment.js';
import { financeScreen } from './screens/finance.js';
import { masterDataScreen } from './screens/masterData.js';
import { reportsScreen } from './screens/reports.js';

const SCREENS = {
  dashboard: dashboardScreen,
  'label-request': labelRequestScreen,
  'label-library': labelLibraryScreen,
  'label-stock': labelStockScreen,
  'surat-jalan': suratJalanScreen,
  'po-converter': poConverterScreen,
  'outstanding-po': outstandingPoScreen,
  approval: approvalScreen,
  ppkek: ppkekScreen,
  payment: paymentScreen,
  finance: financeScreen,
  'master-data': masterDataScreen,
  reports: reportsScreen,
};

const root = document.getElementById('app');

// ---------------------------------------------------------------------------
// THE URL IS THE CURRENT SCREEN.
//
// Being logged in again after a refresh is only half of it — landing on the
// Dashboard when you were mid-way through PPKEK still costs you the click and
// the scroll. The screen is written to the hash on every navigation, so the
// reload has somewhere to read it back from, and Back/Forward start working as
// a side effect.
//
// Deliberately NOT stored: the hash is visible, editable, and shareable, and
// none of that matters because it is only ever a REQUEST. hydrate() and the
// guard below both re-check it against allowedScreens() for the actual role, so
// typing #/master-data as sona gets you sona's first allowed screen, exactly as
// clicking would.
// ---------------------------------------------------------------------------
function hashScreen() {
  try { return String(location.hash || '').replace(/^#\/?/, '').trim(); }
  catch { return ''; }
}
function syncHash(screen) {
  const want = '#/' + screen;
  // replaceState, not location.hash =, so navigating inside the app does not
  // stack a history entry per click AND does not re-fire hashchange below.
  if (location.hash !== want) {
    try { history.replaceState(null, '', want); } catch { location.hash = want; }
  }
}
window.addEventListener('hashchange', () => {
  const st = getState();
  if (!st.user || st.user.mustChangePassword) return;
  const want = hashScreen();
  if (want && want !== st.screen && allowedScreens(st.user.role).includes(want)) setState({ screen: want });
});

// True only while the app is asking Supabase whether a session survived the
// reload. Without it the login form paints for a beat and then vanishes, which
// looks exactly like being logged out and back in again.
let restoring = false;

function render() {
  const st = getState();
  document.documentElement.setAttribute('data-theme', st.theme);
  document.documentElement.setAttribute('data-density', st.density);

  let view;
  if (!st.user && restoring) {
    view = bootSplash();
  } else if (!st.user) {
    view = loginScreen();
  } else if (st.user.mustChangePassword) {
    // Hard gate, checked BEFORE st.screen is ever consulted — manipulating
    // st.screen (console, stale link, whatever) can't reach any other
    // screen while this is true. Only changePasswordScreen()'s own success
    // path (clearMustChangePassword(), see core/supabase.js) can clear it.
    view = changePasswordScreen();
  } else {
    // RLS-mirroring guard: if current screen not allowed for role, redirect.
    const allowed = allowedScreens(st.user.role);
    // FAIL CLOSED on an unknown role.
    //
    // This used to be `if (allowed.length && !allowed.includes(...))`, which
    // FAILS OPEN: a role missing from ACCESS produced an empty `allowed`, the
    // guard was skipped entirely, and that account got EVERY screen — approval,
    // master data, finance. It was unreachable while ACCESS covered all five
    // built-in accounts, but it is a one-character-class trap for whoever adds
    // the sixth. An account with no configured screens must get NOTHING, not
    // everything.
    if (!allowed.length) {
      console.error(`Role "${st.user.role}" tidak ada di ACCESS (auth/roles.js) — akses ditolak.`);
      view = errorBox(new Error(tr({
        id: `Akun "${st.user.username}" belum punya hak akses layar apa pun.\n` +
          `Role "${st.user.role}" belum didaftarkan di ACCESS. Hubungi wilbert.`,
        en: `Account "${st.user.username}" does not have access to any screen yet.\n` +
          `Role "${st.user.role}" is not registered in ACCESS. Contact wilbert.`,
        zh: `账号 "${st.user.username}" 尚未获得任何屏幕的访问权限。\n` +
          `角色 "${st.user.role}" 未在 ACCESS 中登记。请联系 wilbert。`,
      })));
      mount(root, view);
      return;
    }
    if (!allowed.includes(st.screen)) { setState({ screen: allowed[0] }); return; }
    syncHash(st.screen);
    let screenEl;
    try { screenEl = (SCREENS[st.screen] || dashboardScreen)(); }
    catch (e) { console.error('Screen render error:', e); screenEl = errorBox(e); }
    view = appShell(st, [
      isConfigured() ? null : demoBanner(),
      screenEl,
    ]);
  }

  mount(root, view, st.toast ? toastEl(st.toast) : null);
}

function bootSplash() {
  return h('div', { style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' } }, [
    h('div', { style: { fontSize: '15px', fontWeight: 800, color: 'var(--text)' } }, 'MTI PURCHASING PORTAL'),
    h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, t('restoring')),
  ]);
}

function demoBanner() {
  return h('div.cfg-banner', { style: { marginBottom: '14px' } }, [
    svgIcon('warn'), h('span', t('demo_mode')),
  ]);
}
function svgIcon(name) { return svg(ICONS[name], 14); }

function toastEl(msg) {
  // msg is either a string (legacy call sites) or {id, en, zh}. Resolved HERE,
  // on every render, so switching language re-words a toast that is already up.
  const text = (msg && typeof msg === 'object') ? tr(msg) : msg;
  return h('div.toast', [svg(ICONS.check, 15, { stroke: '#4ADE80', strokeWidth: 2.5 }), h('span', text)]);
}

function errorBox(e) {
  return h('div.card', { style: { padding: '20px' } }, [
    h('div', { style: { fontWeight: 700, color: 'var(--st-red-tx)' } }, tr({
      id: 'Terjadi kesalahan di layar ini',
      en: 'Something went wrong on this screen',
      zh: '此屏幕发生错误',
    })),
    h('pre', { style: { fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'pre-wrap' } }, String(e && e.stack || e)),
  ]);
}

subscribe(render);

// Preferences come back before the first paint, so the app never flashes light
// mode at someone who works in dark, or Indonesian at someone reading English.
setState({ theme: getPref('theme', getState().theme), lang: getPref('lang', getState().lang) });

// Boot: if a session survived the reload, pick it up before painting anything.
// Demo mode has no session to restore, so it goes straight to the login form.
restoring = isConfigured();
render();
if (restoring) {
  restoreSession()
    .catch(e => { console.warn('Session restore failed', e); return false; })
    .then(() => { restoring = false; setState({}); });
}

// Debug handle — READ-ONLY SNAPSHOT, and only on localhost.
//
// This used to be `window.__MTI__ = { getState }`, and getState() returns the
// LIVE state object. Any logged-in user could run
//     __MTI__.getState().user.role = 'wilbert'
// and get the full menu (Approval, Master Data, Finance) on the next render,
// then invoke those screens' handlers under their own JWT. RLS still decides
// whether a WRITE lands (current_role() reads the profiles table, not client
// state), but client-rendered artifacts — the PO chop, the PRF paper — are
// outside RLS's reach entirely, and any policy that forgets to constrain a
// value becomes reachable that way (see pos_insert / status).
//
// A shallow frozen copy keeps the handle useful for debugging while making
// `__MTI__.snapshot().user.role = …` a no-op on the real store.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.__MTI__ = { snapshot: () => Object.freeze({ ...getState() }) };
}
