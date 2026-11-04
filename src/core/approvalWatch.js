// ===========================================================================
// PENGINTAI ANTREAN APPROVAL — MENYEGARKAN DATANYA, BUKAN HALAMANNYA.
//
// Yang diminta: kalau ada PO baru masuk antrean approval, portal tahu sendiri
// tanpa harus di-refresh manual. Yang TIDAK boleh terjadi: halaman tiba-tiba
// tergambar ulang waktu orangnya sedang mengerjakan hal lain.
//
// Dua syarat itu terdengar bertentangan, dan di portal ini memang begitu —
// karena mount() (core/dom.js) TIDAK punya diffing. Setiap setState() menghapus
// seluruh isi halaman lalu membangunnya ulang dari nol. Pemeriksaan latar yang
// memanggil setState tiap menit berarti: qty surat jalan yang baru separuh
// diketik hilang, fokus terlempar ke <body>, modal yang sedang dibuka tertutup.
// Catatan yang sama sudah ditulis di updateCheck.js dan di searchInput() —
// ini jebakan yang sudah dua kali menggigit berkas lain.
//
// Jadi penyegarannya dipecah jadi tiga tingkat, dari yang paling murah:
//
//   1. PROBE  — hitung saja. Satu query count, head-only, nol baris ditarik.
//               Kalau angkanya sama dengan yang sudah dipegang: berhenti di
//               sini. Ini yang terjadi di hampir setiap siklus.
//
//   2. DATA   — angkanya berubah, baru tarik daftar PO-nya dan tulis ke state
//               TANPA setState. Datanya sudah benar di memori, layarnya belum
//               tahu — dan memang belum perlu tahu.
//
//   3. LAYAR  — lencana di sidebar ditambal LANGSUNG ke DOM (satu textContent),
//               bukan lewat mount. Halaman tidak disentuh sama sekali.
//               Gambar ulang penuh HANYA kalau orangnya memang sedang menatap
//               layar approval DAN tidak sedang memegang apa pun.
//
// Hasilnya: di layar mana pun selain approval, pemberitahuannya cuma angka di
// sidebar yang berubah — nol risiko. Di layar approval, daftarnya ikut segar
// sendiri selama tangannya sedang tidak di atas sesuatu.
// ===========================================================================
import { getState, setState } from './store.js';
import { getClient, isConfigured } from './supabase.js';
import { fetchPOs } from './posApi.js';

const ANTRE = 'Menunggu Approval';
const JEDA_AWAL  = 20 * 1000;   // beri ruang untuk muat awal dulu
const JEDA_ULANG = 60 * 1000;

let jalan = false;
let sedangCek = false;
let terakhirDilihat = null;     // jumlah antrean hasil probe terakhir

function jumlahAntre(pos) {
  return (pos || []).filter(p => p.status === ANTRE).length;
}

// SEDANG MEMEGANG SESUATU?
//
// Diperiksa dari DOM, bukan dari daftar kunci state. Daftar kunci harus
// diperbarui setiap kali ada modal baru lahir, dan yang lupa diperbarui tidak
// menimbulkan error — cuma menggambar ulang halaman orang di saat yang salah,
// sekali, tanpa jejak. Satu kelas `.overlay` dipakai SEMUA modal (components.js
// modal()), jadi pertanyaannya bisa dijawab sekali untuk selamanya.
function sedangDipegang() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return true;
  if (a && a.isContentEditable) return true;
  if (document.querySelector('.overlay')) return true;
  return false;
}

// Tambalan lencana: satu simpul, satu properti. Tidak lewat mount().
function tambalLencana(n) {
  const el = document.querySelector('[data-badge="pendingApproval"]');
  if (!el) return;
  el.textContent = n ? String(n) : '';
  el.style.display = n ? '' : 'none';
}

async function hitungDiServer() {
  const c = await getClient();
  if (!c) return null;
  // head:true — server menjawab jumlahnya saja, nol baris dikirim.
  const { count, error } = await c.from('pos')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', ANTRE);
  if (error) throw error;
  return typeof count === 'number' ? count : null;
}

async function periksa() {
  if (sedangCek || !isConfigured()) return;
  const st = getState();
  if (!st.user) return;                       // belum login, tidak ada yang perlu diintai
  sedangCek = true;
  try {
    const diServer = await hitungDiServer();
    if (diServer == null) return;

    const diLayar = jumlahAntre(st.pos);
    if (diServer === diLayar && diServer === terakhirDilihat) return;
    terakhirDilihat = diServer;
    if (diServer === diLayar) return;         // sudah sinkron, tidak ada kerja

    // Angkanya berubah — BARU sekarang datanya ditarik.
    const pos = await fetchPOs();
    if (!pos) return;                         // gagal tarik: diam, coba lagi siklus berikutnya
    getState().pos = pos;

    const baru = jumlahAntre(pos);
    tambalLencana(baru);

    // Gambar ulang penuh hanya kalau orangnya memang sedang melihat antreannya
    // dan tangannya sedang tidak di atas apa pun. Di layar lain, daftar ini
    // tidak terlihat — menggambar ulang cuma mengambil risiko tanpa imbalan,
    // dan datanya toh sudah benar begitu tabnya dibuka.
    if (getState().screen === 'approval' && !sedangDipegang()) setState({});
  } catch (e) {
    // Sengaja diam, sama seperti updateCheck.js: pengintai latar tidak boleh
    // melempar toast tiap kali jaringan berkedip.
    console.debug('cek antrean approval gagal (diabaikan):', (e && e.message) || e);
  } finally {
    sedangCek = false;
  }
}

export function startApprovalWatch() {
  if (jalan) return;
  jalan = true;
  setTimeout(periksa, JEDA_AWAL);
  setInterval(periksa, JEDA_ULANG);
  // Tab yang baru dibuka lagi adalah saat paling mungkin ada yang tertinggal,
  // dan saat paling tidak mungkin orangnya sedang mengetik.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') periksa();
  });
}

// Dipanggil layar approval setelah ia selesai memproses sesuatu, supaya
// probe berikutnya tidak menganggap perubahan buatannya sendiri sebagai kabar
// baru dari orang lain.
export function catatJumlahSekarang() {
  terakhirDilihat = jumlahAntre(getState().pos);
}
