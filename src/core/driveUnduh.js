// ---------------------------------------------------------------------------
// MENGAMBIL BYTE ARTWORK DARI DRIVE — sisi peramban.
//
// drive.js cuma bisa MENGUNGGAH. Itu bukan kelalaian: dari peramban, Drive
// memblokir CORS untuk byte PDF-nya, jadi tidak ada yang bisa ditulis di sini
// yang akan berhasil. Satu-satunya jalur yang lolos mengembalikan PNG 1024 px
// — sekitar 88 dpi untuk lembar A4, tidak cukup untuk apa pun yang dicetak.
//
// Akibatnya jalur artwork selama ini MEMINTA BERKASNYA KE ORANGNYA, padahal
// designs.drive_url sudah menyimpan berkas mana yang benar dan layarnya malah
// menampilkan tautannya. Yang sudah diketahui mesin, ditanyakan ke manusia.
//
// Fungsi tepi drive-download menutup jarak itu: pengambilannya di server, di
// mana CORS tidak berlaku, dan hasilnya dikembalikan ke halaman ini.
//
// BELUM DI-DEPLOY = BUKAN GALAT. Kalau fungsinya belum ada, unduhan ini
// mengembalikan null dengan sebab, dan jalur artwork kembali ke pemilih berkas
// seperti sebelumnya. Tidak ada yang rusak; yang hilang cuma kenyamanannya.
// ---------------------------------------------------------------------------
import { SUPABASE_URL } from '../config.js';
import { getClient } from './supabase.js';

export const DRIVE_DOWNLOAD_URL = `${SUPABASE_URL}/functions/v1/drive-download`;

/** Id Drive dari tautan apa pun bentuknya, atau '' kalau bukan tautan Drive. */
export function idDrive(urlAtauId) {
  const s = String(urlAtauId || '').trim();
  if (!s) return '';
  const m = s.match(/\/d\/([A-Za-z0-9_-]+)/) || s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,200}$/.test(s) ? s : '';
}

/**
 * Mengambil byte PDF artwork dari Drive lewat fungsi tepi.
 * @returns {Promise<{ok:true,bytes:ArrayBuffer,byte:number}|{ok:false,sebab:string,belumDideploy?:boolean}>}
 */
export async function unduhArtwork(urlAtauId) {
  const fileId = idDrive(urlAtauId);
  if (!fileId) return { ok: false, sebab: 'bukan tautan Drive yang bisa dibaca' };

  let headers = { 'Content-Type': 'application/json' };
  try {
    const c = await getClient();
    if (c) {
      const { data } = await c.auth.getSession();
      if (data && data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch { /* tanpa token, fungsinya akan menolak 403 dan itu ditangani di bawah */ }

  let res;
  try {
    res = await fetch(DRIVE_DOWNLOAD_URL, { method: 'POST', headers, body: JSON.stringify({ fileId }) });
  } catch (e) {
    // Meledak PADA fetch() = balasannya tidak pernah datang. Beda dengan
    // balasan yang datang membawa galat, dan bedanya penting saat mencari tahu
    // kenapa: yang ini jaringan atau fungsinya tidak ada sama sekali.
    return { ok: false, sebab: 'tidak bisa menghubungi drive-download: ' + (e.message || e), belumDideploy: true };
  }

  if (res.status === 404) {
    return { ok: false, belumDideploy: true,
      sebab: 'fungsi drive-download belum di-deploy — jalankan: supabase functions deploy drive-download' };
  }
  if (!res.ok) {
    const teks = await res.text().catch(() => '');
    let sebab = `HTTP ${res.status}`;
    try { const j = JSON.parse(teks); if (j && j.error) sebab += ' — ' + j.error; }
    catch { if (teks) sebab += ' — ' + teks.slice(0, 200); }
    return { ok: false, sebab };
  }

  const bytes = await res.arrayBuffer();
  // Fungsinya membalas JSON saat galat dan PDF saat berhasil. Balasan 200 yang
  // isinya bukan PDF berarti ada yang salah di jalurnya — diperiksa di sini
  // supaya yang sampai ke pdf-lib bukan JSON yang menyamar jadi artwork.
  const kepala = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
  if (kepala !== '%PDF-') return { ok: false, sebab: 'yang kembali bukan berkas PDF' };

  return { ok: true, bytes, byte: bytes.byteLength };
}
