import { setState, getState, toast } from '../core/store.js';
import { makeUser, usernameToEmail, allowedScreens } from './roles.js';
import { isConfigured, signIn, signOut, fetchMustChangePassword, currentSession } from '../core/supabase.js';
// seed.js diimpor DINAMIS di hydrate() — 15 KB fixture demo yang tidak pernah
// dipakai selama Supabase terhubung, dan itu berarti selalu, di produksi.
import { getPref, adoptServerPrefs } from '../core/prefs.js';
import { fetchProfilePrefs } from '../core/profilePrefsApi.js';
import { retryPending, pendingOutbox } from '../core/driveOutbox.js';
import { pushToDrive } from '../core/drive.js';
import { DEMO_PASSWORD } from '../config.js';
import { t } from '../i18n/index.js';
import { fetchSuratJalan } from '../core/suratJalanApi.js';
import { fetchPOs, UUID_RE } from '../core/posApi.js';
import { fetchSuppliers } from '../core/suppliersApi.js';
import { fetchAuditLog } from '../core/auditApi.js';
import { fetchDescDict } from '../core/descDictApi.js';
import { fetchItems } from '../core/itemsApi.js';
import { fetchBrandMap } from '../core/brandMapApi.js';
import { fetchDesigns } from '../core/designsApi.js';
import { fetchLabelRequests } from '../core/labelRequestsApi.js';
import { fetchUnits } from '../core/unitsApi.js';
import { fetchInvoices } from '../core/invoicesApi.js';
import { fetchLabelGudang, fetchLabelStockGudang } from '../core/labelStockApi.js';
import { fetchPrfs } from '../core/prfsApi.js';
import { fetchPayments } from '../core/paymentsApi.js';
import { fetchPpkek } from '../core/ppkekApi.js';
import { fetchLabelStock, fetchLabelUploads, fetchLabelSettings, fetchLabelStockTrend } from '../core/labelStockApi.js';
import { fetchLabelPrices } from '../core/labelPricesApi.js';
import { fetchErpTarikan } from '../core/erpTarikanApi.js';

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

  // Honour the screen in the URL here too. In production a reload restores the
  // session and never reaches this function — but when the token HAS expired,
  // the user lands on the login form and typing the password should still put
  // them back where they were, not on the Dashboard.
  return hydrate(user, username, wantedScreen());
}

// Pick up the session left behind by a page reload.
//
// Everything below hydrate() used to live inside login(), reachable only by
// typing a password — so a refresh could not get the data back even if the
// token had survived, and the app had no honest choice but the login screen.
// Split out, the same load runs for both doors.
//
// Returns false for anything unexpected (no session, an account no longer in
// roles.js, a failed load) and the caller falls through to the login screen.
// An auth path must fail towards asking for a password, never past it.
export async function restoreSession() {
  if (!isConfigured()) return false;
  const session = await currentSession();
  const email = session && session.user && session.user.email;
  if (!email) return false;
  const username = String(email).split('@')[0].toLowerCase();
  const user = makeUser(username);
  // Token still valid but the account has since been removed from roles.js.
  // Sign it out rather than leaving a token that keeps half-working.
  if (!user) { try { await signOut(); } catch { /* ignore */ } return false; }
  try {
    return await hydrate(user, username, wantedScreen(), prefLang());
  } catch (e) {
    console.warn('Session restore failed — falling back to login.', e);
    return false;
  }
}

// The screen named in the URL (#/ppkek), if any. The router writes it on every
// navigation, so a reload can land back where the work was — which is the whole
// point: being logged in again but dumped on the Dashboard is only half a fix.
function prefLang() { return getPref('lang', null); }

function wantedScreen() {
  try { return String(location.hash || '').replace(/^#\/?/, '').trim(); }
  catch { return ''; }
}

// Everything a signed-in session needs in memory. Called by BOTH login() and
// restoreSession() — one load path, so a restored session can never quietly
// have less data than a typed-password one.
async function hydrate(user, username, preferScreen, preferLang) {
  // Seed fixtures are a DEMO MODE thing only — a real Supabase connection
  // means real (possibly still-empty) tables are the source of truth, and
  // showing fixture PO/supplier/activity data on top of that would just be
  // confusing fake data in a production portal. isConfigured() is the exact
  // same check FEATURES.useSupabase is derived from (config.js).
  if (!isConfigured()) {
    const { seedIfEmpty } = await import('../core/seed.js');
    seedIfEmpty();
  }

  // -------------------------------------------------------------------------
  // SATU GELOMBANG, BUKAN DUA PULUH ANTREAN.
  //
  // Blok ini dulunya 18 `await` berurutan. Tidak satu pun dari mereka memakai
  // hasil yang sebelumnya — semuanya pembacaan yang saling lepas — tapi setiap
  // baris tetap menunggu baris di atasnya selesai. Dengan latensi ~150 ms per
  // perjalanan ke Supabase, itu sekitar tiga detik layar kosong, setiap kali
  // portal dibuka DAN setiap kali di-refresh. Tidak ada cache yang bisa
  // menolong, karena ini bukan soal ukuran file.
  //
  // Sekarang semuanya berangkat bersamaan. Waktunya jadi selama yang PALING
  // LAMBAT, bukan jumlah semuanya.
  //
  // allSettled, BUKAN all.
  // Promise.all menolak begitu ada SATU yang gagal, dan sisanya terbuang
  // walaupun sudah berhasil — satu tabel yang RLS-nya rewel akan membuat
  // seluruh login gagal. allSettled menunggu semuanya, lalu setiap hasil
  // diperlakukan sendiri-sendiri: yang berhasil dipakai, yang gagal dicatat ke
  // console dan datanya dibiarkan seperti semula. Persis aturan yang sama
  // dengan sebelumnya ("null berarti tidak terbaca, jangan sentuh yang lokal"),
  // cuma sekarang juga berlaku untuk fetch yang melempar error.
  //
  // Urutan penulisan ke state TIDAK ikut acak: hasilnya dibongkar menurut
  // urutan array di bawah, sama persis seperti dulu.
  // -------------------------------------------------------------------------
  const TUGAS = [
    // Surat Jalan: catatan bersama, ditarik tiap login supaya sesi siapa pun
    // mulai dari kebenaran server, bukan dari sisa data kemarin (A2).
    ['suratJalan',    () => fetchSuratJalan()],
    // POs (A3): baris server adalah sumber kebenaran dan diganti seluruhnya.
    // Fixture seed dan PO yang insert-nya gagal sinkron (id bukan UUID, lihat
    // posApi.js UUID_RE) hidup di ruang id yang terpisah, jadi server yang
    // kosong atau bermasalah tidak bisa menghapus mereka.
    ['pos',           () => fetchPOs()],
    // Suppliers: pola ganti-seluruhnya yang sama. Menutup celah yang sama yang
    // A3 tutup untuk PO — supplier yang dibuat cania kelihatan oleh wilbert.
    ['suppliers',     () => fetchSuppliers()],
    ['descDict',      () => fetchDescDict()],
    ['items',         () => fetchItems()],
    ['brandMap',      () => fetchBrandMap()],
    ['labelRequests', () => fetchLabelRequests()],
    ['designs',       () => fetchDesigns()],
    ['units',         () => fetchUnits()],
    // Finance. Urutan invoices -> prfs -> payments dipertahankan supaya enak
    // dibaca (PRF menyebut nomor invoice, payment menyebut PRF), tapi ketiganya
    // pembacaan lepas — tidak ada yang menunggu siapa pun.
    ['invoices',      () => fetchInvoices()],
    ['prfs',          () => fetchPrfs()],
    ['payments',      () => fetchPayments()],
    // PPKEK: cuma sekar/wilbert yang punya ppkek_rw, jadi ini mengembalikan
    // null (bukan []) untuk peran lain dan st.ppkek lokal mereka tidak disentuh.
    ['ppkek',         () => fetchPpkek()],
    // Dashboard "Aktivitas Terbaru": audit_log asli yang ditulis trigger. RLS
    // menyaringnya per peran (admin melihat semua, yang lain melihat miliknya).
    ['audit',         () => fetchAuditLog(null, null, 20)],
    // Label Inventory Tracker. RLS membatasinya ke is_purchasing(), jadi untuk
    // sekar dan financemti keempatnya mengembalikan null dan array lokal
    // mereka dibiarkan.
    ['labelStock',    () => fetchLabelStock()],
    ['labelUploads',  () => fetchLabelUploads()],
    // Gudang: daftarnya dibaca siapa pun yang login; stok per gudang dibatasi
    // RLS ke staf label + purchasing, jadi untuk peran lain keduanya null dan
    // array lokalnya dibiarkan — pola yang sama dengan labelStock di atasnya.
    ['labelGudang',      () => fetchLabelGudang()],
    ['labelStockGudang', () => fetchLabelStockGudang()],
    ['labelSettings', () => fetchLabelSettings()],
    // Agregat untuk grafik stok. Null selama view-nya belum dibuat — grafiknya
    // menggambar keadaan kosong dan tidak ada yang lain yang peduli.
    ['labelTrend',    () => fetchLabelStockTrend()],
    // Ingatan harga label. RLS-nya membolehkan SELECT untuk semua yang login,
    // jadi ini terisi untuk semua peran — tapi yang bisa MENULIS cuma pemegang
    // poCreate. Kalau tabelnya belum dibuat, fetch-nya mengembalikan null dan
    // st.labelPrices lokal dibiarkan kosong: kolom HARGA cuma jadi tidak
    // mengisi sendiri, tidak ada yang lain yang rusak.
    ['labelPrices',   () => fetchLabelPrices()],
    // Riwayat tarikan 采购申请. Dari sinilah KAS dihitung — lihat
    // core/kasLabel.js. Kalau ini null, kas terlihat PENUH lagi, dan itu bukan
    // kegagalan yang boleh diam: orangnya akan menarik excel tahap berikutnya
    // berisi jumlah yang sudah pernah diminta ke ERP. Penanganannya ada di
    // bawah — st.erpTarikan TIDAK ditimpa kalau fetch-nya gagal.
    ['erpTarikan',    () => fetchErpTarikan()],
    // Preferensi akun. Sengaja ikut gelombang ini juga; dipakai di bawah.
    ['prefs',         () => fetchProfilePrefs()],
  ];

  const hasil = await Promise.allSettled(TUGAS.map(([, jalan]) => jalan()));
  const nilai = {};
  hasil.forEach((r, i) => {
    const nama = TUGAS[i][0];
    if (r.status === 'fulfilled') { nilai[nama] = r.value; return; }
    // Gagal satu tidak menjatuhkan yang lain, dan tidak menjatuhkan login.
    // Dicatat keras-keras ke console supaya tidak jadi kegagalan diam-diam.
    console.error(`Gagal memuat "${nama}" saat login — data lama dipakai apa adanya.`, r.reason);
    nilai[nama] = null;
  });

  const st = getState();
  if (nilai.suratJalan)    st.suratJalan    = nilai.suratJalan;
  if (nilai.pos) {
    const localOnly = st.pos.filter(p => !UUID_RE.test(p.id));
    st.pos = [...nilai.pos, ...localOnly];
  }
  if (nilai.suppliers)     st.suppliers     = nilai.suppliers;
  if (nilai.descDict)      st.descDict      = nilai.descDict;
  if (nilai.items)         st.items         = nilai.items;
  if (nilai.brandMap)      st.brandMap      = nilai.brandMap;
  if (nilai.labelRequests) st.labelRequests = nilai.labelRequests;
  if (nilai.designs)       st.designs       = nilai.designs;
  if (nilai.units)         st.units         = nilai.units;
  if (nilai.invoices)      st.invoices      = nilai.invoices;
  if (nilai.prfs)          st.prfs          = nilai.prfs;
  if (nilai.payments)      st.payments      = nilai.payments;
  if (nilai.ppkek)         st.ppkek         = nilai.ppkek;
  if (nilai.audit) {
    st.audit = nilai.audit.map(a => ({
      id: a.id, at: a.at, user: a.username, entity: a.entity, target: a.target,
      action: a.action, detail: a.detail, status: a.status,
    }));
  }
  if (nilai.labelStock)    st.labelStock    = nilai.labelStock;
  // Kas dihitung dari erpTarikan, jadi fetch yang GAGAL punya akibat khusus:
  // st.erpTarikan tetap [] (nilai awalnya di store.js), dan kas terlihat PENUH
  // untuk setiap PO. Orangnya menarik excel tahap 2 berisi jumlah yang sudah
  // pernah diminta, dan 采购申请 ganda masuk ke ERP.
  //
  // Menimpa dengan [] jelas salah — tapi TIDAK menimpanya saja juga tidak cukup,
  // karena pada login segar hasilnya tetap array kosong. Jadi kegagalannya
  // DITANDAI, dan layar Kas serta jendela tarikan menolak bekerja sampai
  // datanya benar-benar ada. Diam di sini adalah diam yang mahal.
  if (nilai.erpTarikan) { st.erpTarikan = nilai.erpTarikan; st.erpTarikanGagal = false; }
  else { st.erpTarikanGagal = true; }
  if (nilai.labelUploads)  st.labelUploads  = nilai.labelUploads;
  if (nilai.labelSettings) st.labelSettings = nilai.labelSettings;
  if (nilai.labelTrend)    st.labelTrend    = nilai.labelTrend;
  // null berarti "tidak bisa dibaca" (peran lain, atau tabelnya belum ada
  // karena migrasinya belum dijalankan), BUKAN "kosong". Array lokalnya
  // dibiarkan apa adanya — pola yang sama dengan labelStock di atas.
  if (nilai.labelGudang)      st.labelGudang      = nilai.labelGudang;
  if (nilai.labelStockGudang) st.labelStockGudang = nilai.labelStockGudang;
  if (nilai.labelPrices)   st.labelPrices   = nilai.labelPrices;

  // DRAIN THE DRIVE QUEUE. Anything that failed to reach Drive while it was
  // down goes up now, without anyone re-picking a file.
  //
  // Deliberately NOT awaited: this can be dozens of megabytes over a bad
  // connection, and nobody should stare at a login screen while last week's
  // backlog uploads. It reports itself when it finishes.
  pendingOutbox().then(q => { getState().driveQueue = q; if (q.length) setState({}); })
    .catch(() => {});
  retryPending(pushToDrive).then(async r => {
    getState().driveQueue = await pendingOutbox().catch(() => []);
    if (r.sent) {
      toast({
        id: `${r.sent} file yang tertunda berhasil dikirim ke Drive`,
        en: `${r.sent} queued file(s) reached Drive`,
        zh: `${r.sent} 个待传文件已送达 Drive`,
      });
      setState({});
    }
  }).catch(e => console.warn('drive outbox: retry gagal —', e));

  // Force-change-password gate: checked on every login, not cached anywhere
  // client-side — main.js's router reads user.mustChangePassword before
  // rendering ANY other screen, regardless of st.screen.
  user.mustChangePassword = await fetchMustChangePassword(username);

  const allowed = allowedScreens(username);
  const first = allowed[0] || 'dashboard';
  // A screen asked for by the URL only wins if this role is actually allowed
  // it — the hash is user-editable, so it is a request, never a grant.
  const screen = (preferScreen && allowed.includes(preferScreen)) ? preferScreen : first;

  // The ACCOUNT's stored language and theme win here, over whatever this
  // browser last cached. That is the whole point of moving them to profiles:
  // the preference belongs to the person, so signing in on a colleague's PC —
  // or a fresh incognito window — still lands in the language they chose.
  //
  // Deliberately last, and deliberately tolerant: a null means the column does
  // not exist yet or could not be read, and then nothing changes. This must
  // never be a reason a login fails.
  // Sudah ikut terambil di gelombang di atas — tidak ada perjalanan tambahan.
  const serverPrefs = nilai.prefs;
  adoptServerPrefs(serverPrefs);
  const lang = (serverPrefs && serverPrefs.lang) || preferLang || user.lang || 'id';
  const theme = (serverPrefs && serverPrefs.theme) || getPref('theme', getState().theme);

  setState({ user, screen, lang, theme, menuOpen: false });
  return true;
}

// Pull server state again without reloading the page. Same load as login(),
// minus the auth — for the moment you want to see what someone else just
// entered and would otherwise hit F5 for.
export async function refreshData() {
  const st = getState();
  if (!st.user) return false;
  // Keep the language the user is actually reading in — a data refresh is
  // not a reason to snap back to the account default.
  return hydrate(st.user, st.user.username, st.screen, st.lang);
}

export async function logout() {
  try { await signOut(); } catch { /* ignore */ }
  // Module-level drafts live outside the store, so resetting state isn't enough
  // — a typed rejection reason survived logout into the next user's session.
  // resetErpDraft ikut: draf tarikan 采购申请 juga hidup di tingkat modul, dan
  // dia lebih berbahaya daripada catatan reject. Draf yang tertinggal membuat
  // drafTarikan() melewati pengisian ulang (kunci per PO), jadi pengguna
  // BERIKUTNYA membuka Template ERP untuk PO yang sama dan menemukan jumlah dan
  // 需求日期 milik orang sebelumnya sudah terisi — lalu menekan Unduh, dan
  // angka itu masuk ke ERP atas namanya sendiri.
  try { const m = await import('../screens/approval.js'); m.resetApprovalDrafts(); m.resetErpDraft(); m.resetPilihApprove(); } catch { /* ignore */ }
  // Wipe EVERYTHING, not just the user.
  //
  // This used to clear only user/screen/menuOpen, leaving state.ui and every
  // domain array in memory for whoever logged in next on the same tab. Two real
  // consequences:
  //   * a half-finished modal survived the switch — financemti's finance-receive
  //     drawer re-rendered for wilbert, whose footer button is gated only on the
  //     4/4 checklist, letting him complete an action his role doesn't have;
  //   * ui.prfDraft.supplier holds a REFERENCE to a supplier object; after the
  //     next login fetchSuppliers() replaces st.suppliers with fresh objects, so
  //     a still-open PRF preview printed the previous, now-detached bank details
  //     and submitting it persisted a PRF with the old user in `by`.
  // login() re-fetches everything it needs, and a fetch that returns null now
  // finds an empty array rather than the previous user's rows.
  setState({
    user: null, screen: 'login', menuOpen: false, langOpen: false, toast: null,
    ui: {},
    suppliers: [], units: [], items: [], brandMap: [], designs: [], descDict: [],
    pos: [], labelBatches: [], ppkek: [], invoices: [], prfs: [], payments: [],
    audit: [], suratJalan: [],
    labelStock: [], labelUploads: [], labelSettings: null,
    // erpTarikan WAJIB ikut dibuang. Kas dihitung darinya, dan riwayat tarikan
    // pengguna sebelumnya yang tertinggal membuat kas terlihat lebih kecil dari
    // yang sebenarnya untuk pengguna berikutnya — atau, kalau PO-nya berbeda,
    // sama sekali tidak nyambung.
    erpTarikan: [], erpTarikanGagal: false,
  });
}
