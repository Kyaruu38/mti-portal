import { h, svg, clear } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { getState, setState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { LANGS } from '../i18n/index.js';
import { allowedScreens, USERS } from '../auth/roles.js';
import { logout, refreshData } from '../auth/session.js';
import { setPref } from '../core/prefs.js';
import { icon, iconBtn, badge, btn } from './components.js';
import { COMPANY } from '../config.js';
import { VERSION, VERSION_DATE, CHANGELOG } from '../version.js';
import { LOGO_MTI } from '../assets/images.js';
import { notificationsFor, unreadCount, notifTargetScreen, notifMessage } from '../core/notifications.js';
import { fmtDateTime } from '../core/format.js';
import { globalSearch, openTarget, canOpen, searchableTypes } from '../core/globalSearch.js';

const NAV = [
  { label: 'nav_overview', items: [
    { id: 'dashboard', t: 's_dashboard', ic: 'grid' },
    { id: 'approval', t: 's_approval', ic: 'clip', badgeKey: 'pendingApproval' },
  ] },
  // LABEL DAN PO BIASA DIPISAH.
  // ---------------------------------------------------------------------------
  // Dulu keduanya satu grup "Label & PO", dan Surat Jalan duduk di tengahnya
  // dengan nama "Delivery Note". Dari menu, tidak ada apa pun yang memberi tahu
  // bahwa layar itu cuma berlaku untuk PO label — jadi wajar kalau orang
  // membukanya untuk PO pelumas dan menganggap dokumennya kurang cocok saja.
  //
  // Sekarang namanya menyebut dirinya sendiri dan dia duduk di grup Label,
  // sementara PO biasa punya grupnya sendiri. Yang membedakan bukan lagi
  // pengetahuan orangnya, tapi tempat tombolnya.
  { label: 'nav_labelpo', items: [
    { id: 'label-request', t: 's_label', ic: 'tag' },
    { id: 'label-library', t: 's_library', ic: 'layers' },
    { id: 'label-stock', t: 's_labelstock', ic: 'box' },
    { id: 'surat-jalan', t: 's_surat', ic: 'file' },
  ] },
  { label: 'nav_po', items: [
    { id: 'po-converter', t: 's_converter', ic: 'rep' },
    { id: 'outstanding-po', t: 's_outstanding', ic: 'box' },
  ] },
  { label: 'nav_compliance', items: [{ id: 'ppkek', t: 's_ppkek', ic: 'box' }] },
  { label: 'nav_finance', items: [
    { id: 'payment', t: 's_payment', ic: 'card' },
    { id: 'finance', t: 's_finance', ic: 'dollar' },
  ] },
  { label: 'nav_system', items: [
    { id: 'master-data', t: 's_master', ic: 'db' },
    { id: 'reports', t: 's_reports', ic: 'chart' },
  ] },
];

const TITLES = {
  dashboard: 's_dashboard', approval: 's_approval', 'label-request': 's_label',
  'label-library': 's_library', 'label-stock': 's_labelstock', 'surat-jalan': 's_surat', 'po-converter': 's_converter', 'outstanding-po': 's_outstanding',
  ppkek: 's_ppkek', payment: 's_payment', finance: 's_finance', 'master-data': 's_master', reports: 's_reports',
};

function badges(st) {
  return { pendingApproval: st.pos.filter(p => p.status === 'Menunggu Approval').length };
}

function brandMark() {
  // No white chip any more. It existed only because the logo asset had a white
  // rectangle baked into it — a white block on a navy sidebar looks like a
  // mistake, so it was dressed up as a deliberate chip. The artwork is now
  // transparent, so the mark sits straight on the sidebar in both themes and
  // the workaround can go.
  return h('div', { style: { display: 'inline-flex', alignItems: 'center' } }, [
    h('img', { src: LOGO_MTI, style: { height: '30px', display: 'block' } }),
  ]);
}

function sidebar(st) {
  const bd = badges(st);
  const allowed = allowedScreens(st.user.role);
  const groups = NAV.map(g => ({
    label: g.label,
    items: g.items.filter(i => allowed.includes(i.id)),
  })).filter(g => g.items.length);

  return h('aside.sidebar', [
    h('div.sidebar-brand', [
      brandMark(),
      h('div', { style: { fontSize: '9px', fontWeight: 700, letterSpacing: '.22em', color: 'var(--sb-group)', marginTop: '7px' } }, tr({
        id: 'PURCHASING PORTAL', en: 'PURCHASING PORTAL', zh: '采购门户',
      })),
    ]),
    h('nav.sidebar-nav', groups.map(g => h('div', [
      h('div.nav-group-label', t(g.label)),
      ...g.items.map(i => {
        const active = i.id === st.screen;
        const bcount = i.badgeKey ? bd[i.badgeKey] : 0;
        return h('div.nav-item' + (active ? '.active' : ''), { onClick: () => setState({ screen: i.id }) }, [
          h('span.bar'),
          icon(i.ic, 15),
          h('span.grow', t(i.t)),
          bcount ? h('span.nav-badge', String(bcount)) : null,
        ]);
      }),
    ]))),
    h('div.sidebar-foot', [
      h('div', { style: { fontSize: '11px', fontWeight: 700, color: '#E8EDF6' } }, COMPANY.name),
      h('div', { style: { fontSize: '10px', color: 'var(--sb-group)', marginTop: '2px' } }, tr({
        id: 'Kawasan Ekonomi Khusus',
        en: 'Special Economic Zone',
        zh: '经济特区',
      })),
      // Version + the date it shipped. This is the fastest way to answer "am I
      // looking at the new build or a cached old one" — if the number has not
      // moved after a push, the deploy or the cache is the problem, not the
      // code. Hover shows what that release changed.
      h('div.mono', {
        style: { fontSize: '9.5px', color: 'var(--sb-group)', marginTop: '8px' },
        title: `${VERSION} · ${VERSION_DATE}\n${tr(CHANGELOG[0].what)}`,
      }, `${VERSION} · ${VERSION_DATE}`),
    ]),
  ]);
}

export function langSwitch(st) {
  return h('div.lang-switch', LANGS.map(l => h('button', {
    class: st.lang === l.code ? 'on' : '', title: l.name,
    // Remembered across a reload — see core/prefs.js. Picking English and then
    // refreshing used to hand the app back in Indonesian.
    onClick: () => { setPref('lang', l.code); setState({ lang: l.code }); },
  }, l.label)));
}

// Two labelled buttons, not the old single moon/sun toggle. A toggle only tells
// you what it will do next, never which mode you are in — and read wrong, one
// click puts you in the mode you were trying to leave. Here the current one is
// simply lit.
export function themeSwitch(st) {
  const opts = [
    ['light', 'sun', tr({ id: 'Terang', en: 'Light', zh: '浅色' })],
    ['dark', 'moon', tr({ id: 'Gelap', en: 'Dark', zh: '深色' })],
  ];
  return h('div.lang-switch', opts.map(([code, ic, label]) => h('button', {
    class: st.theme === code ? 'on' : '', title: label,
    style: { display: 'inline-flex', alignItems: 'center', gap: '5px' },
    onClick: () => { setPref('theme', code); setState({ theme: code }); },
  }, [icon(ic, 12), label])));
}

// Reload the DATA without reloading the PAGE.
//
// The store is in memory and only fills up at login, so anything a colleague
// entered five minutes ago is invisible until you sign in again. That made F5
// the only refresh button in the app — and F5 used to mean logging back in.
// This runs the same load login() does, minus the password.
function refreshBtn(st) {
  const busy = !!st.ui.refreshing;
  return iconBtn('refresh', {
    title: t('refresh_data'),
    // Spun by CSS while it runs, because on a slow connection the whole load is
    // several seconds of a screen that looks completely unchanged.
    class: busy ? 'spin' : '',
    onClick: async () => {
      if (getState().ui.refreshing) return;
      setUI({ refreshing: true });
      try { await refreshData(); toast({ id: 'Data diperbarui dari server', en: 'Data refreshed from server', zh: '数据已从服务器刷新' }); }
      catch (e) { console.error(e); toast({ id: 'Gagal menarik data terbaru: ' + (e.message || e), en: 'Could not fetch the latest data: ' + (e.message || e), zh: '无法获取最新数据：' + (e.message || e) }); }
      finally { setUI({ refreshing: false }); }
    },
  });
}

// Global search: input stays a single, never-replaced DOM node — the
// dropdown is built/torn down via direct DOM writes on every keystroke, NOT
// via setState()/setUI(). mount() has no diffing (main.js's render() rebuilds
// the WHOLE app tree on every store change), so calling setState() per
// keystroke here would replace this very input out from under the user's
// cursor and drop keyboard focus after every character typed — the same bug
// class documented in suratJalan.js's qtyInput and approval.js's poEditModal.
// setState()/setUI() only ever fire from here inside navigateTo(), i.e. on
// an explicit "Buka"/"Drive ↗" click, never from the input's own oninput.
function globalSearchBox() {
  const dropdown = h('div', {
    style: {
      display: 'none', position: 'absolute', top: '38px', left: 0, right: 0,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      boxShadow: 'var(--paper-shadow)', zIndex: 60, maxHeight: '360px', overflowY: 'auto',
    },
  });

  const close = () => { clear(dropdown); dropdown.style.display = 'none'; };

  const navigateTo = (r) => {
    // Target screen comes from SEARCH_TYPES so visibility and destination can
    // never drift apart. Screen ids per main.js's SCREENS map — 'surat-jalan'
    // (hyphenated), not camelCase; getting this wrong silently falls back to
    // the dashboard instead of erroring.
    const role = getState().user ? getState().user.role : null;
    // Belt and braces: "Buka" is not rendered when this is false, so reaching
    // here means something else called it. Refuse rather than dumping the user
    // on the "belum punya hak akses" box, which is what used to happen when
    // sona clicked a PO result.
    const target = openTarget(role, r.type);
    if (!target) { close(); return; }
    setState({ screen: target });
    if (r.type === 'PO') setUI({ selPO: r.ref.id });
    else if (r.type === 'PPKEK') {
      setUI({ pkExtract: { name: r.ref.name || `PPKEK ${r.ref.nopen}`, files: r.ref.files || [] }, pkParsed: r.ref });
    }
    input.value = '';
    close();
  };

  const resultRow = (r) => h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', borderTop: '1px solid var(--border)' },
  }, [
    badge(r.type, 'gray'),
    h('div.grow', { style: { minWidth: 0 } }, [
      h('div.mono', { style: { fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.id),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.sub || '—'),
    ]),
    r.drive ? h('a.link', { href: r.drive, target: '_blank', style: { fontSize: '11px', fontWeight: 600, flexShrink: 0 } }, 'Drive ↗') : h('span'),
    // A role can legitimately SEE a document without holding the screen that
    // displays it — cania/visca report on POs but have no approval queue. Show
    // the hit, drop the button, instead of offering a dead end.
    canOpen((getState().user || {}).role, r.type)
      ? btn(tr({ id: 'Buka', en: 'Open', zh: '打开' }), { sm: true, onClick: () => navigateTo(r) })
      : h('span', { style: { fontSize: '10px', color: 'var(--text-3)', flexShrink: 0 } }, tr({
          id: 'lihat di Reports', en: 'view in Reports', zh: '在报表中查看',
        })),
  ]);

  const renderResults = (q) => {
    const results = globalSearch(getState(), q);
    clear(dropdown);
    if (!q.trim()) { dropdown.style.display = 'none'; return; }
    if (!results.length) {
      dropdown.appendChild(h('div', { style: { padding: '12px', fontSize: '11.5px', color: 'var(--text-3)' } }, tr({
        id: 'Tidak ada hasil', en: 'No results', zh: '无结果',
      })));
    } else {
      results.forEach(r => dropdown.appendChild(resultRow(r)));
    }
    dropdown.style.display = 'block';
  };

  const input = h('input.input', {
    placeholder: t('search_ph'),
    style: { padding: '8px 12px 8px 32px', fontSize: '12.5px' },
    onInput: e => renderResults(e.target.value),
    onKeydown: e => { if (e.key === 'Escape') { e.target.value = ''; close(); e.target.blur(); } },
    // Delay lets a click on "Buka"/"Drive ↗" (which fires blur first) land
    // before the dropdown disappears out from under it.
    onBlur: () => setTimeout(close, 150),
  });

  return h('div', { style: { flex: 1, maxWidth: '430px', marginLeft: 'auto', position: 'relative' } }, [
    h('span', { style: { position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 } }, icon('search', 14, { stroke: 'var(--text-3)' })),
    input,
    dropdown,
  ]);
}

function header(st) {
  const u = st.user;
  const bd = badges(st);
  return h('header.topbar', [
    h('div', { style: { minWidth: '200px' } }, [
      h('div', { style: { fontSize: '15.5px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 } }, t(TITLES[st.screen] || 's_dashboard')),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, `${COMPANY.name} · ${u.tag}`),
    ]),
    // Hidden entirely for a role that can search nothing (sona), rather than
    // offering a field that always answers "Tidak ada hasil". A search box that
    // is permanently empty reads as broken software, not as a permission.
    searchableTypes(u.role).length ? globalSearchBox() : h('div.grow'),
    // Language and theme USED to sit here as well as in the account menu — the
    // same two controls twice on one bar. They are settings you touch once and
    // then never again, so they now live in one place only: the account menu,
    // next to the name they belong to. What stays on the bar is what you press
    // repeatedly: refresh and notifications.
    refreshBtn(st),
    bellMenu(st),
    h('div', { style: { width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 } }),
    userMenu(st),
  ]);
}

function bellMenu(st) {
  const wrap = h('div', { style: { position: 'relative', flexShrink: 0 } });
  const items = notificationsFor(st, st.user);
  const count = unreadCount(st, st.user);
  const close = () => setUI({ bellOpen: false, notifReadAt: new Date().toISOString() });
  const open = () => setUI({ bellOpen: !st.ui.bellOpen, ...(st.ui.bellOpen ? { notifReadAt: new Date().toISOString() } : {}) });

  wrap.appendChild(iconBtn('bell', { badge: count || null, onClick: open }));

  if (st.ui.bellOpen) {
    wrap.appendChild(h('div', { style: { position: 'fixed', inset: 0, zIndex: 49 }, onClick: close }));
    wrap.appendChild(h('div', {
      style: { position: 'absolute', right: 0, top: '44px', width: '320px', maxHeight: '400px', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--paper-shadow)', zIndex: 50, animation: 'mtiPop .16s ease' },
    }, [
      h('div', { style: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '12px 14px 8px' } }, t('notif_title')),
      items.length ? h('div', items.map(n => h('div', {
        style: { padding: '9px 14px', borderTop: '1px solid var(--border)', cursor: 'pointer' },
        onClick: () => { const scr = notifTargetScreen(n, st.user); close(); if (scr) setState({ screen: scr }); },
      }, [
        h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 } }, notifMessage(n)),
        h('div', { style: { fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' } }, fmtDateTime(n.at)),
      ]))) : h('div', { style: { padding: '18px 14px', fontSize: '12px', color: 'var(--text-3)' } }, t('notif_empty')),
    ]));
  }
  return wrap;
}

function userMenu(st) {
  const u = st.user;
  const wrap = h('div', { style: { position: 'relative', flexShrink: 0 } });
  const trigger = h('div.row.gap8', {
    style: { cursor: 'pointer', padding: '4px 6px', borderRadius: '9px' },
    onClick: () => setState({ menuOpen: !st.menuOpen }),
  }, [
    h('span.avatar', { style: { width: '30px', height: '30px', background: u.color, fontSize: '10.5px' } }, u.init),
    h('span', [
      h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 } }, u.name),
      h('span', { style: { display: 'block', fontSize: '10px', color: 'var(--text-3)' } }, u.tag),
    ]),
    icon('chevD', 13, { stroke: 'var(--text-3)' }),
  ]);
  wrap.appendChild(trigger);

  if (st.menuOpen) {
    wrap.appendChild(h('div', { style: { position: 'fixed', inset: 0, zIndex: 49 }, onClick: () => setState({ menuOpen: false }) }));
    wrap.appendChild(h('div', {
      style: { position: 'absolute', right: 0, top: '44px', width: '250px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--paper-shadow)', zIndex: 50, padding: '6px', animation: 'mtiPop .16s ease' },
    }, [
      h('div', { style: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '8px 10px 4px' } }, t('language')),
      h('div', { style: { padding: '2px 8px 8px' } }, langSwitch(st)),
      h('div', { style: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '2px 10px 4px' } }, t('theme')),
      h('div', { style: { padding: '2px 8px 8px' } }, themeSwitch(st)),
      h('div', { style: { fontSize: '10px', color: 'var(--text-3)', padding: '0 10px 8px', lineHeight: 1.45 } }, t('pref_note')),
      h('div.divider', { style: { margin: '6px 4px' } }),
      h('div', {
        style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: 'var(--st-red-tx)' },
        onClick: () => logout(),
      }, [icon('logout', 14), h('span', { style: { fontSize: '12px', fontWeight: 600 } }, t('logout'))]),
    ]));
  }
  return wrap;
}

// Compose the shell around a screen element.
export function appShell(st, screenEl) {
  return h('div.app-shell', [
    sidebar(st),
    h('div.main-col', [
      header(st),
      h('main.content', screenEl),
    ]),
  ]);
}
