import { h } from '../core/dom.js';
import { getState, setState } from '../core/store.js';
import { login } from '../auth/session.js';
import { t } from '../i18n/index.js';
import { icon } from '../ui/components.js';
import { isConfigured } from '../core/supabase.js';
import { COMPANY } from '../config.js';
import { LOGO_MTI } from '../assets/images.js';

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

  return h('div', { style: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '40px 20px' } }, [
    h('button.icon-btn', { style: { position: 'absolute', top: '20px', right: '24px' }, onClick: () => setState({ theme: st.theme === 'light' ? 'dark' : 'light' }) }, icon(st.theme === 'light' ? 'moon' : 'sun', 15)),
    h('div', { style: { width: '400px', maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--paper-shadow)', padding: '36px 36px 30px', animation: 'mtiPop .3s ease' } }, [
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
    h('div', { style: { marginTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' } }, [
      h('div.mono', { style: { fontSize: '10px', color: 'var(--text-3)' } }, `${COMPANY.version}${isConfigured() ? '' : ' · DEMO'}`),
    ]),
  ]);
}
