import { h, mount, svg } from './core/dom.js';
import { ICONS } from './core/icons.js';
import { getState, subscribe, setState } from './core/store.js';
import { appShell } from './ui/layout.js';
import { allowedScreens } from './auth/roles.js';
import { isConfigured } from './core/supabase.js';
import { t } from './i18n/index.js';

import { loginScreen } from './screens/login.js';
import { changePasswordScreen } from './screens/changePassword.js';
import { dashboardScreen } from './screens/dashboard.js';
import { labelRequestScreen } from './screens/labelRequest.js';
import { labelLibraryScreen } from './screens/labelLibrary.js';
import { suratJalanScreen } from './screens/suratJalan.js';
import { poConverterScreen } from './screens/poConverter.js';
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
  'surat-jalan': suratJalanScreen,
  'po-converter': poConverterScreen,
  approval: approvalScreen,
  ppkek: ppkekScreen,
  payment: paymentScreen,
  finance: financeScreen,
  'master-data': masterDataScreen,
  reports: reportsScreen,
};

const root = document.getElementById('app');

function render() {
  const st = getState();
  document.documentElement.setAttribute('data-theme', st.theme);
  document.documentElement.setAttribute('data-density', st.density);

  let view;
  if (!st.user) {
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
    // Guard against redirect storms: only redirect when we actually have a valid target.
    if (allowed.length && !allowed.includes(st.screen)) { setState({ screen: allowed[0] }); return; }
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

function demoBanner() {
  return h('div.cfg-banner', { style: { marginBottom: '14px' } }, [
    svgIcon('warn'), h('span', t('demo_mode')),
  ]);
}
function svgIcon(name) { return svg(ICONS[name], 14); }

function toastEl(msg) {
  return h('div.toast', [svg(ICONS.check, 15, { stroke: '#4ADE80', strokeWidth: 2.5 }), h('span', msg)]);
}

function errorBox(e) {
  return h('div.card', { style: { padding: '20px' } }, [
    h('div', { style: { fontWeight: 700, color: 'var(--st-red-tx)' } }, 'Terjadi kesalahan di layar ini'),
    h('pre', { style: { fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'pre-wrap' } }, String(e && e.stack || e)),
  ]);
}

subscribe(render);
render();

// Expose a tiny debug handle (no localStorage; in-memory only).
window.__MTI__ = { getState };
