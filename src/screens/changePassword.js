import { h } from '../core/dom.js';
import { getState, setState, toast } from '../core/store.js';
import { t } from '../i18n/index.js';
import { icon } from '../ui/components.js';
import { updatePassword, clearMustChangePassword } from '../core/supabase.js';
import { allowedScreens } from '../auth/roles.js';
import { COMPANY } from '../config.js';
import { LOGO_MTI } from '../assets/images.js';

// Forced gate — see main.js's router. Rendered instead of ANY other screen
// while st.user.mustChangePassword is true; nothing here can be reached or
// skipped via st.screen manipulation because the router checks the flag
// before it ever looks at st.screen.
//
// Errors render INLINE (not via toast()) on purpose: toast() schedules a
// setState 3.6s later to clear itself, which re-invokes this whole function
// and would wipe whatever the user has typed since (the same class of bug
// fixed once already for the surat jalan qty input). Password text also
// never touches st.ui/st — it only ever lives in these closure-local
// variables and in the direct Auth API call — st.ui is readable via the
// window.__MTI__ debug handle, so it's not a safe place to park it either.
// voluntary = dibuka sendiri dari menu akun, bukan gerbang paksa saat login
// pertama. Bedanya cuma tiga hal: ada tombol Batal, judulnya tidak berbunyi
// seperti peringatan, dan setelah berhasil dia kembali ke layar sebelumnya
// alih-alih melempar orang ke layar pertama yang boleh dia buka.
//
// Isi formulirnya SENGAJA sama persis — termasuk aturan tidak menaruh password
// di st.ui dan menampilkan error inline, bukan lewat toast. Menyalin ulang
// layar ini untuk mode kedua berarti dua tempat yang harus sama-sama benar,
// dan yang kedua pasti tertinggal.
export function changePasswordScreen({ voluntary = false } = {}) {
  let current = '', next = '', confirm = '';
  let busy = false;

  const errBox = h('div', { style: { fontSize: '11.5px', color: 'var(--st-red-tx, #B91C1C)', minHeight: '16px' } });
  const showError = (msg) => { errBox.textContent = msg; };

  const curInput = h('input.input', { type: 'password', placeholder: '••••••••', onInput: e => (current = e.target.value) });
  const newInput = h('input.input', { type: 'password', placeholder: '••••••••', onInput: e => (next = e.target.value) });
  const confirmInput = h('input.input', { type: 'password', placeholder: '••••••••', onInput: e => (confirm = e.target.value) });

  const submitBtn = h('button.btn.btn-primary', {
    style: { marginTop: '6px', justifyContent: 'center', padding: '11px' },
    onClick: () => submit(),
  }, t('cp_submit'));

  function setBusy(v) {
    busy = v;
    submitBtn.textContent = v ? t('loading') : t('cp_submit');
    submitBtn.disabled = v;
  }

  async function submit() {
    if (busy) return;
    showError('');
    if (!next || next.length < 8) { showError(t('cp_err_len')); return; }
    if (next !== confirm) { showError(t('cp_err_match')); return; }
    if (next === current) { showError(t('cp_err_same')); return; }

    setBusy(true);

    try {
      await updatePassword(next);
    } catch (e) {
      // Password NOT changed — flag untouched, user can just retry. Not locked.
      showError(t('cp_err_update') + (e.message || e));
      setBusy(false);
      return;
    }

    try {
      await clearMustChangePassword();
    } catch (e) {
      // Password WAS changed but the flag didn't clear — user stays on this
      // (always-reachable) screen and can retry; retrying just changes the
      // password again (harmless) and re-attempts the flag clear. Never locked out.
      console.error('clearMustChangePassword failed', e);
      showError(t('cp_err_flag'));
      setBusy(false);
      return;
    }

    const s = getState();
    s.user.mustChangePassword = false;
    toast(t('cp_success')); // safe here: setState({screen}) below navigates away immediately
    if (voluntary) setState({ screen: s.ui.pwBack || allowedScreens(s.user.role)[0] || 'dashboard' });
    else setState({ screen: allowedScreens(s.user.role)[0] || 'dashboard' });
  }

  [curInput, newInput, confirmInput].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));

  return h('div', { style: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' } }, [
    h('div', { style: { width: '400px', maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--paper-shadow)', padding: '36px 36px 30px', animation: 'mtiPop .3s ease' } }, [
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '22px' } }, [
        h('img', { src: LOGO_MTI, style: { height: '48px' } }),
        icon(voluntary ? 'lock' : 'warn', 20),
        h('div', { style: { fontSize: '15px', fontWeight: 800 } }, t(voluntary ? 'cp_title_self' : 'cp_title')),
        h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', textAlign: 'center' } }, t(voluntary ? 'cp_subtitle_self' : 'cp_subtitle')),
      ]),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
        h('div', [h('div.field-label', t('cp_current')), curInput]),
        h('div', [h('div.field-label', t('cp_new')), newInput]),
        h('div', [h('div.field-label', t('cp_confirm')), confirmInput]),
        errBox,
        submitBtn,
        voluntary ? h('button.btn', {
          style: { justifyContent: 'center', padding: '9px' },
          onClick: () => {
            const s = getState();
            setState({ screen: s.ui.pwBack || allowedScreens(s.user.role)[0] || 'dashboard' });
          },
        }, t('cancel')) : null,
      ]),
    ]),
    h('div', { style: { marginTop: '18px' } }, [
      h('div.mono', { style: { fontSize: '10px', color: 'var(--text-3)' } }, COMPANY.version),
    ]),
  ]);
}
