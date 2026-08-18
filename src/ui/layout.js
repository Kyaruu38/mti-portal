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
import { VERSION, VERSION_DATE, LATEST } from '../version.js';
import { updateTersedia, tutupUpdate, muatUlang } from '../core/updateCheck.js';
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
    // PO Saya duduk di sini, BUKAN di Overview sebelah Approval Queue. Yang
    // memegangnya bukan yang menyetujui PO, tapi yang membuatnya — dan dia
    // mencarinya di tempat pekerjaan PO-nya, bukan di ringkasan.
    { id: 'po-saya', t: 's_po_saya', ic: 'clip' },
    { id: 'kas-label', t: 's_kas_label', ic: 'dollar' },
    { id: 'outstanding-po', t: 's_outstanding', ic: 'box' },
  ] },
  { label: 'nav_compliance', items: [{ id: 'ppkek', t: 's_ppkek', ic: 'box' }] },
  { label: 'nav_finance', items: [
    { id: 'payment', t: 's_payment', ic: 'card' },
    { id: 'prf', t: 's_prf', ic: 'file' },
    { id: 'finance', t: 's_finance', ic: 'dollar' },
  ] },
  { label: 'nav_system', items: [
    { id: 'master-data', t: 's_master', ic: 'db' },
    { id: 'reports', t: 's_reports', ic: 'chart' },
  ] },
];

// Peta id layar -> { t, ic } DARI NAV, bukan daftar kedua yang ditulis tangan.
// Sebuah id layar sudah dikunci di delapan tempat di repo ini; menambah daftar
// kesembilan yang isinya sama berarti menambah satu tempat lagi yang bisa
// ketinggalan diam-diam. TITLES di bawah dipertahankan sebagai cadangan.
const PETA_LAYAR = {};
NAV.forEach(g => g.items.forEach(i => { PETA_LAYAR[i.id] = i; }));

// ---------------------------------------------------------------------------
// BILAH TAB — satu jendela, banyak layar.
//
// Kyaru: "gw mau donk bisa multi tab kyk di ERP gw, jadi gausah buka 2 tab
// chrome gitu". Persis begitu bentuknya: mengklik menu MENAMBAH tab, bukan
// mengganti isi layar, dan tab yang sudah terbuka tinggal diklik.
//
// HANYA TAB AKTIF YANG DIGAMBAR, dan itu bukan penghematan — itu syarat.
// mount() tidak punya diffing: menggambar lima layar sekaligus berarti setiap
// setState membangun ulang kelimanya. Lebih berbahaya lagi, layar di repo ini
// memakai id DOM tetap (mis. 'inv-nominal' di Add Invoice) dan
// document.getElementById akan mengambil yang pertama ketemu — dua layar hidup
// bersamaan berarti angka yang diketik di satu tempat bisa terbaca dari tempat
// lain. Menggambar satu saja menutup seluruh kelas masalah itu sekaligus.
//
// Yang TIDAK ikut hidup di tab yang tidak aktif: posisi gulir, dan isi kotak
// yang belum sempat blur. Saringan, nomor halaman, dan pilihan tetap hidup
// karena semuanya tinggal di st.ui, bukan di DOM.
export function bukaTab(id) {
  const st = getState();
  const tabs = Array.isArray(st.tabs) ? st.tabs.slice() : [];
  if (!tabs.includes(id)) tabs.push(id);
  setState({ tabs, screen: id });
}

export function tutupTab(id) {
  const st = getState();
  const tabs = (Array.isArray(st.tabs) ? st.tabs : []).filter(x => x !== id);
  // Menutup tab yang sedang dibuka memindahkan fokus ke TETANGGA KIRI, bukan ke
  // Dashboard: yang menutup tab biasanya sedang kembali ke pekerjaan sebelumnya,
  // dan dilempar ke Dashboard berarti dia harus mencari jalannya lagi.
  let aktif = st.screen;
  if (id === st.screen) {
    const i = (st.tabs || []).indexOf(id);
    aktif = tabs[Math.max(0, i - 1)] || tabs[0] || '';
  }
  setState({ tabs, screen: aktif || st.screen });
}

function bilahTab(st) {
  const tabs = (st.tabs || []).filter(id => PETA_LAYAR[id]);
  // Satu tab bukan "banyak tab". Bilahnya baru muncul waktu memang ada yang
  // bisa dipilih — sebaris kosong di atas setiap layar cuma memakan tinggi.
  if (tabs.length < 2) return null;
  return h('div.row', {
    style: {
      gap: '4px', alignItems: 'stretch', padding: '6px 18px 0', overflowX: 'auto',
      background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'nowrap',
    },
  }, tabs.map(id => {
    const info = PETA_LAYAR[id];
    const aktif = id === st.screen;
    return h('div.row', {
      style: {
        gap: '6px', alignItems: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        padding: '7px 10px', borderRadius: '6px 6px 0 0', fontSize: '11.5px', fontWeight: aktif ? 800 : 600,
        color: aktif ? 'var(--text)' : 'var(--text-3)',
        background: aktif ? 'var(--surface)' : 'transparent',
        border: '1px solid ' + (aktif ? 'var(--border)' : 'transparent'),
        borderBottom: aktif ? '1px solid var(--surface)' : '1px solid transparent',
        marginBottom: '-1px',
      },
      onClick: () => setState({ screen: id }),
    }, [
      icon(info.ic, 13),
      h('span', t(info.t)),
      h('span', {
        style: { marginLeft: '2px', padding: '0 3px', borderRadius: '3px', color: 'var(--text-3)', fontWeight: 700 },
        title: tr({ id: 'Tutup tab', en: 'Close tab', zh: '关闭标签页' }),
        // stopPropagation wajib: tanpa itu menutup tab ikut memindahkan layar ke
        // tab yang barusan ditutup sebelum ia hilang.
        onClick: (e) => { e.stopPropagation(); tutupTab(id); },
      }, '\u00d7'),
    ]);
  }));
}

const TITLES = {
  dashboard: 's_dashboard', approval: 's_approval', 'label-request': 's_label',
  'label-library': 's_library', 'label-stock': 's_labelstock', 'surat-jalan': 's_surat', 'po-converter': 's_converter', 'po-saya': 's_po_saya', 'kas-label': 's_kas_label', 'outstanding-po': 's_outstanding',
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
        return h('div.nav-item' + (active ? '.active' : ''), { onClick: () => bukaTab(i.id) }, [
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
        title: `${VERSION} · ${VERSION_DATE}\n${tr(LATEST)}`,
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
    bukaTab(target);
    // KEDUANYA disetel. Layar PO Saya membaca `poSayaSel || selPO`, jadi
    // pilihan lama yang masih tertinggal di poSayaSel akan MENGALAHKAN hasil
    // pencarian yang baru — orangnya mencari satu nomor PO dan dibukakan PO
    // lain yang kebetulan terakhir dia lihat, tanpa satu pun tanda bahwa itu
    // yang salah.
    if (r.type === 'PO') setUI({ selPO: r.ref.id, poSayaSel: r.ref.id });
    else if (r.type === 'PPKEK') {
      // BARIS REGISTER HARUS DITERJEMAHKAN, bukan dioper apa adanya.
      //
      // Panel PARSED membaca bentuk DOKUMEN HASIL PARSE; yang ada di st.ppkek
      // adalah bentuk BARIS REGISTER, dan nama medannya berbeda semua:
      // date/kurs/usd/idr/jalur lawan ppkekDate/kursNDPBM/valueForeign/
      // valueIDR/asal. Dioper mentah, panelnya menyala hijau "PARSED" dengan
      // nopen yang benar dan SETIAP angka statutori '—' — terbaca sebagai
      // "portal kehilangan catatan pabean ini", untuk satu jenis dokumen yang
      // angkanya diatur undang-undang.
      //
      // Penerjemahan yang sama sudah ada di screens/ppkek.js pada handler klik
      // barisnya; pencarian global melewatinya.
      const g = r.ref;
      setUI({
        pkExtract: { name: g.name || `PPKEK ${g.nopen}`, format: 'register', files: g.files || [] },
        pkParsed: {
          nopen: g.nopen, ppkekDate: g.date, eta: g.eta, supplier: g.supplier,
          address: g.address, contractNo: g.contractNo, kursNDPBM: g.kurs,
          valuta: g.valuta || 'USD', valueForeign: g.usd, valueIDR: g.idr, asal: g.jalur,
        },
      });
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
      h('div', { style: { fontSize: '15.5px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 } }, t((PETA_LAYAR[st.screen] && PETA_LAYAR[st.screen].t) || TITLES[st.screen] || 's_dashboard')),
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
        onClick: () => { const scr = notifTargetScreen(n, st.user); close(); if (scr) bukaTab(scr); },
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
      h('div.divider', { style: { margin: '6px 4px' } }),
      // Ganti password ada di sini, bukan di menu samping. Ini urusan akun,
      // bukan layar kerja — dan menaruhnya di daftar layar berarti dia ikut
      // dipertimbangkan setiap kali seseorang mencari menu pekerjaan.
      h('div', {
        style: { display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)' },
        onClick: () => {
          const cur = getState().screen;
          setUI({ pwBack: cur === 'change-password' ? null : cur });
          setState({ menuOpen: false, screen: 'change-password' });
        },
      }, [icon('lock', 14), h('span', { style: { fontSize: '12px', fontWeight: 600 } }, t('change_password'))]),
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
      updateTersedia(st) ? spandukUpdate(st) : null,
      bilahTab(st),
      h('main.content', screenEl),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// SPANDUK VERSI BARU.
//
// Sengaja BUKAN toast. Toast hilang sendiri setelah beberapa detik, dan orang
// yang sedang menatap Excel di monitor sebelah tidak akan pernah melihatnya.
// Ini menetap sampai salah satu dari dua hal terjadi: dimuat ulang, atau
// ditutup manual lewat tanda silang.
//
// Diletakkan di bawah header, bukan melayang di atas isi layar: yang melayang
// menutupi baris tabel, dan orang menutupnya karena menghalangi — bukan karena
// sudah membacanya.
// ---------------------------------------------------------------------------
function spandukUpdate(st) {
  return h('div.row.gap10', {
    style: {
      alignItems: 'center', padding: '10px 18px',
      background: 'var(--accent-soft)', borderBottom: '1px solid var(--accent)',
      color: 'var(--text)', fontSize: '12.5px',
    },
  }, [
    svg(ICONS.warn, 15, { stroke: 'var(--accent-tx)' }),
    h('div.grow', [
      h('span', { style: { fontWeight: 700 } }, tr({
        id: `Versi baru tersedia — ${st.updateReady}`,
        en: `A new version is available — ${st.updateReady}`,
        zh: `有新版本可用 — ${st.updateReady}`,
      })),
      h('span', { style: { color: 'var(--text-2)', marginLeft: '8px' } }, tr({
        id: `Anda memakai ${VERSION}. Muat ulang untuk memakai yang baru.`,
        en: `You are on ${VERSION}. Reload to switch to it.`,
        zh: `您正在使用 ${VERSION}。请重新加载以切换。`,
      })),
    ]),
    h('button.btn.btn-sm.btn-primary', { onClick: () => muatUlang() },
      tr({ id: 'Muat ulang', en: 'Reload', zh: '重新加载' })),
    h('button.x-btn', {
      onClick: () => tutupUpdate(),
      title: tr({ id: 'Tutup', en: 'Dismiss', zh: '关闭' }),
    }, icon('x', 14)),
  ]);
}
