import { setState, getState, toast } from '../core/store.js';
import { makeUser, usernameToEmail, allowedScreens } from './roles.js';
import { isConfigured, signIn, signOut, fetchMustChangePassword } from '../core/supabase.js';
import { seedIfEmpty } from '../core/seed.js';
import { DEMO_PASSWORD } from '../config.js';
import { t } from '../i18n/index.js';
import { fetchSuratJalan } from '../core/suratJalanApi.js';
import { fetchPOs, UUID_RE } from '../core/posApi.js';

// Log in by username. Uses Supabase Auth when configured; otherwise a demo check.
export async function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  const user = makeUser(username);
  if (!user) { toast(t('login_bad')); return false; }

  if (isConfigured()) {
    try {
      await signIn(usernameToEmail(username), password);
    } catch (e) {
      console.warn(e);
      toast(t('login_bad'));
      return false;
    }
  } else {
    // Demo mode: accept the shared demo password.
    if (password !== DEMO_PASSWORD) { toast(t('login_bad')); return false; }
  }

  seedIfEmpty();
  // Surat Jalan is the one module wired to Supabase — pull the live,
  // shared record set on login so every user's session starts from server
  // truth instead of yesterday's seed data (fixed via A2 review).
  const sjFromServer = await fetchSuratJalan();
  if (sjFromServer) getState().suratJalan = sjFromServer;

  // POs (A3): server rows are the source of truth and get replaced wholesale
  // on every login. Seed fixtures and any PO whose insert failed to sync
  // (non-UUID id, see posApi.js UUID_RE) are local-only by definition and are
  // never touched here — they live in a disjoint id space from real server
  // rows, so an empty/misbehaving server can't wipe the demo fixtures and a
  // real PO can never be shadowed by a seed one.
  const posFromServer = await fetchPOs();
  if (posFromServer) {
    const st = getState();
    const localOnly = st.pos.filter(p => !UUID_RE.test(p.id));
    st.pos = [...posFromServer, ...localOnly];
  }

  // Force-change-password gate: checked on every login, not cached anywhere
  // client-side — main.js's router reads user.mustChangePassword before
  // rendering ANY other screen, regardless of st.screen.
  user.mustChangePassword = await fetchMustChangePassword(username);

  const first = allowedScreens(username)[0] || 'dashboard';
  setState({ user, screen: first, lang: user.lang || 'id', menuOpen: false });
  return true;
}

export async function logout() {
  try { await signOut(); } catch { /* ignore */ }
  setState({ user: null, screen: 'login', menuOpen: false });
}
