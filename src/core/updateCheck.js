// "Ada versi baru — muat ulang."
//
// MASALAHNYA
// -----------------------------------------------------------------------------
// Portal ini tidak pernah memuat ulang dirinya sendiri. Sekali seseorang membuka
// tabnya pagi hari, dia memakai kode pagi itu sampai tabnya ditutup — bisa
// berhari-hari. Setiap perbaikan yang dirilis siang hari tidak sampai ke dia,
// dan yang paling berbahaya bukan fiturnya tertinggal, tapi PERBAIKAN BUG-nya.
//
// Contoh nyata dari hari ini: penjaga klik-ganda PRF (v14.3) dirilis setelah
// tiga PRF terlanjur lahir dua kali. Orang yang tabnya belum pernah ditutup
// sejak pagi tetap menjalankan versi tanpa penjaga itu, dan tidak ada satu pun
// tanda di layarnya yang memberitahu.
//
// CARA KERJANYA
// -----------------------------------------------------------------------------
// Versi yang SEDANG BERJALAN sudah ada di memori (VERSION dari version.js, ikut
// terunduh waktu tab dibuka). Yang perlu dicari cuma versi yang sedang TERPASANG
// di server. Jadi berkas version.js diambil lagi apa adanya sebagai teks, dengan
// pemutus cache, lalu nomor versinya dibaca dengan regex.
//
// KENAPA BUKAN version.json TERSENDIRI
// Itu berarti dua tempat menyimpan nomor versi, dan suatu hari yang satu naik
// sementara yang lain tidak. Yang muncul kemudian adalah spanduk "versi baru"
// yang tidak pernah hilang walaupun sudah dimuat ulang, atau — lebih buruk —
// tidak pernah muncul sama sekali. Satu sumber kebenaran, dibaca dua kali.
//
// KAPAN DIPERIKSA
//   * sekali, 30 detik setelah portal dibuka (jangan menambah beban boot)
//   * setiap 10 menit
//   * setiap kali tab kembali terlihat — ini yang paling sering kena, karena
//     orang meninggalkan tab lalu balik lagi berjam-jam kemudian
//
// Kegagalan mengambil berkas SELALU diam. Jaringan kantor putus sebentar bukan
// alasan untuk memunculkan apa pun di layar orang yang sedang bekerja.
import { getState, setState } from './store.js';
import { VERSION } from '../version.js';

const URL_VERSI = './src/version.js';
const JEDA_AWAL = 30 * 1000;
const JEDA_ULANG = 10 * 60 * 1000;

let jalan = false;
let sedangCek = false;

async function versiDiServer() {
  // no-store DAN pemutus cache: satu saja tidak cukup. no-store mengurus cache
  // browser, query yang berubah mengurus perantara yang mengabaikannya.
  const res = await fetch(`${URL_VERSI}?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const teks = await res.text();
  const m = teks.match(/export\s+const\s+VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('nomor versi tidak ditemukan di version.js');
  return m[1];
}

async function periksa() {
  if (sedangCek) return;
  sedangCek = true;
  try {
    const server = await versiDiServer();
    if (server && server !== VERSION) {
      const st = getState();
      // Jangan menulis ulang state kalau tidak ada yang berubah — setiap
      // setState membangun ulang seluruh halaman (core/dom.js mount()), dan
      // pemeriksaan yang berjalan tiap 10 menit tidak boleh mengganggu orang
      // yang sedang mengetik.
      if (st.updateReady !== server) setState({ updateReady: server });
    }
  } catch (e) {
    // Sengaja diam. Lihat catatan di atas.
    console.debug('cek versi gagal (diabaikan):', (e && e.message) || e);
  } finally {
    sedangCek = false;
  }
}

export function startUpdateWatch() {
  if (jalan) return;
  jalan = true;
  setTimeout(periksa, JEDA_AWAL);
  setInterval(periksa, JEDA_ULANG);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') periksa();
  });
}

// Spanduknya tampil selama ada versi baru DAN versi itu belum ditutup manual.
// Ditutup per NOMOR VERSI, bukan sekali untuk selamanya: menutup pemberitahuan
// v14.4 tidak boleh membuat v14.5 ikut diam.
export function updateTersedia(st) {
  return !!st.updateReady && st.updateReady !== VERSION && st.updateDismissed !== st.updateReady;
}

export function tutupUpdate() {
  setState({ updateDismissed: getState().updateReady });
}

export function muatUlang() {
  try { location.reload(); } catch { window.location.href = window.location.href; }
}

export { VERSION as VERSI_BERJALAN };
