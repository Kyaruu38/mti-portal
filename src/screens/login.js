import { h } from '../core/dom.js';
import { getState } from '../core/store.js';
import { login } from '../auth/session.js';
import { t } from '../i18n/index.js';
import { icon } from '../ui/components.js';
import { langSwitch, themeSwitch } from '../ui/layout.js';
import { isConfigured } from '../core/supabase.js';
import { COMPANY } from '../config.js';
import { VERSION, VERSION_DATE } from '../version.js';
import { LOGO_MTI } from '../assets/images.js';
import { BRANDS } from '../ui/brands.js';
import { LOGO } from '../assets/brandLogos.js';

// Pita merek di kaki halaman login. DIAM, tidak berjalan — dan itu bukan versi
// hemat dari pita layar boot, tapi keputusan yang berbeda untuk layar yang
// berbeda. Layar boot DITONTON sambil menunggu; halaman login DIKERJAKAN.
// Sesuatu yang bergerak beberapa sentimeter dari kolom yang sedang diketik akan
// menarik mata setiap kali dia lewat, dan orang yang salah ketik password tidak
// akan pernah menghubungkannya dengan hiasan di bawah layar.
//
// Isinya diulang sampai melebihi layar terlebar, lalu kedua ujungnya dibuat
// memudar. Tanpa itu, logo paling pinggir terpotong separuh persis di tepi
// layar dan terbaca seperti halaman yang belum selesai dimuat.
//
// Merek tanpa berkas logo dilewati, sama seperti di layar boot.
function pitaMerek() {
  const berlogo = BRANDS.filter(b => LOGO[b.nama]);
  if (!berlogo.length) return null;
  const isi = [];
  for (let u = 0; u < 6; u++) for (const b of berlogo) {
    const lg = LOGO[b.nama];
    isi.push(h('img', { src: lg.src, alt: b.nama, width: lg.w, height: lg.h, draggable: false }));
  }
  return h('div.pita-masuk', h('div.pita-masuk-baris', isi));
}

export function loginScreen() {
  const st = getState();
  let username = '';
  let password = '';

  let pwVisible = false;

  const uInput = h('input.input', { value: username, placeholder: 'username', onInput: e => (username = e.target.value) });
  const pInput = h('input.input', { type: 'password', value: password, placeholder: '••••••••', style: { paddingRight: '38px' }, onInput: e => (password = e.target.value) });
  const doLogin = () => login(username, password);
  uInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  pInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  const pwToggle = h('button', {
    type: 'button',
    style: { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', color: 'var(--text-3)' },
    onClick: () => { pwVisible = !pwVisible; pInput.type = pwVisible ? 'text' : 'password'; pwToggle.replaceChildren(icon(pwVisible ? 'eyeOff' : 'eye', 15)); },
  }, icon('eye', 15));
  const pWrap = h('div', { style: { position: 'relative' } }, [pInput, pwToggle]);

  return h('div', { style: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '40px 20px', overflow: 'hidden' } }, [
    // Digambar lebih dulu supaya dia di belakang; kartu dan baris versi di
    // bawahnya diberi position+zIndex sendiri, karena elemen tanpa position
    // selalu kalah dari elemen ber-z-index betapapun urutannya di DOM.
    pitaMerek(),
    // Language BEFORE sign-in, not just after. Someone who reads Chinese should
    // not have to work out which box is the username in a language they do not
    // read, in order to reach the switch that would have told them.
    //
    // These write to localStorage (core/prefs.js) rather than to the account:
    // there is no account yet. Once signed in, the profile's own setting takes
    // over — see auth/session.js.
    h('div', { style: { position: 'absolute', top: '20px', right: '24px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
      langSwitch(st),
      themeSwitch(st),
    ]),
    h('div', { style: { width: '400px', maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--paper-shadow)', padding: '36px 36px 30px', animation: 'mtiPop .3s ease', position: 'relative', zIndex: 2 } }, [
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '26px' } }, [
        h('img', { src: LOGO_MTI, style: { height: '54px' } }),
        h('div', { style: { fontSize: '10px', fontWeight: 700, letterSpacing: '.24em', color: 'var(--text-3)', marginTop: '4px' } }, 'PURCHASING PORTAL'),
        h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, t('app_tag')),
      ]),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
        h('div', [h('div.field-label', t('login_username')), uInput]),
        h('div', [h('div.field-label', t('login_password')), pWrap]),
        h('button.btn.btn-primary', { style: { marginTop: '6px', justifyContent: 'center', padding: '11px' }, onClick: doLogin }, t('login_signin')),
      ]),
    ]),
    h('div', { style: { marginTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', position: 'relative', zIndex: 2 } }, [
      // Also on the login screen, because the build you are about to sign into
      // is worth knowing before you start blaming a feature for being missing.
      h('div.mono', { style: { fontSize: '10px', color: 'var(--text-3)' } }, `${VERSION} · ${VERSION_DATE}${isConfigured() ? '' : ' · DEMO'}`),
    ]),
  ]);
}
