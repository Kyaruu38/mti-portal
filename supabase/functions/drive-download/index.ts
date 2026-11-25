// =============================================================================
// Supabase Edge Function: drive-download
// -----------------------------------------------------------------------------
// Mengambil BYTE PDF artwork dari Google Drive dan mengembalikannya ke portal.
//
// KENAPA INI HARUS ADA DI SERVER.
// Drive memblokir CORS untuk byte PDF-nya. Diuji dari asal portal yang
// sebenarnya (https://kyaruu38.github.io): satu-satunya jalur yang lolos dari
// peramban mengembalikan PNG 1024 px — sekitar 88 dpi untuk lembar A4, tidak
// cukup untuk apa pun yang akan dicetak. Catatan lengkapnya ada di
// src/label/sulih.js. Di luar peramban batas itu tidak berlaku.
//
// Akibatnya selama ini jalur artwork MEMINTA BERKASNYA KE ORANGNYA, padahal
// basis data sudah TAHU berkas mana yang benar (designs.drive_url) dan bahkan
// menampilkan tautannya di layar. Yang diminta ke orangnya adalah sesuatu yang
// sudah diketahui mesinnya. Fungsi ini menutup jarak itu: sesudah ini tidak
// ada berkas yang perlu dipilih siapa pun.
//
// Deploy:
//   supabase functions deploy drive-download
// Rahasia: TIDAK ADA YANG BARU — memakai rahasia yang sama dengan drive-upload
//   (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) ditambah
//   SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY yang disediakan Supabase sendiri.
//
// -----------------------------------------------------------------------------
// YANG BOLEH DIUNDUH DIBATASI, DAN INI BAGIAN YANG PALING PENTING DI BERKAS INI.
//
// Refresh token di sini milik purchase.ptmti dan menjangkau SELURUH Drive
// departemen — PPKEK, Invoice, Bukti Bayar, Surat Jalan. Fungsi yang menerima
// fileId apa pun dari pemanggil akan berubah jadi pintu baca untuk semua itu,
// untuk SIAPA PUN yang bisa login ke portal. Sona perlu artwork label; dia
// tidak perlu, dan tidak boleh, bisa menarik bukti pembayaran.
//
// Jadi fileId yang diminta harus BENAR-BENAR DIRUJUK oleh designs.drive_url.
// Pemeriksaannya di server, dengan service role, bukan di peramban. Yang tidak
// terdaftar ditolak 403 tanpa menjelaskan apa pun — termasuk tanpa memberi
// tahu apakah berkasnya ada.
//
// Pembatasan ini bukan "kalau sempat". Tanpa itu fungsi ini melemahkan kontrol
// akses yang sudah dibangun di seluruh portal.
// =============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') || '';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://kyaruu38.github.io';

// Batas ukuran. Artwork terbesar yang terukur di pustaka ini 9,1 MB; 25 MB
// memberi ruang lega tanpa membuat satu permintaan bisa menghabiskan memori
// isolate-nya.
const BATAS_BYTE = 25 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

let cachedToken: { token: string; exp: number } | null = null;

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Sama persis dengan drive-upload: verify_jwt bawaan TIDAK cukup, karena anon
// key lolos di sana dan anon key itu tercetak di repo publik. Yang membedakan
// sesi sungguhan adalah klaim `sub`, dan itu diverifikasi ke server, bukan
// didekode sendiri.
async function penggunaSah(req: Request): Promise<boolean> {
  if (!SB_URL || !SB_ANON) return false;             // gagal TERTUTUP
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON },
    });
    if (!r.ok) return false;
    const u = await r.json();
    return Boolean(u && u.id);
  } catch {
    return false;
  }
}

// Apakah fileId ini memang artwork sebuah design? Dicocokkan ke designs.drive_url
// dengan service role, karena RLS tidak boleh jadi penentu di sini — yang
// menentukan adalah "berkas ini terdaftar sebagai artwork", bukan "pemanggil
// kebetulan bisa melihat barisnya".
async function artworkTerdaftar(fileId: string, tokenPemanggil: string): Promise<boolean> {
  if (!SB_URL) return false;                         // gagal TERTUTUP

  // DUA CARA MEMERIKSA, DAN YANG KEDUA BUKAN PELEMAHAN.
  //
  // Service role melihat seluruh tabel designs, jadi pemeriksaannya murni
  // "berkas ini terdaftar sebagai artwork". Tapi SUPABASE_SERVICE_ROLE_KEY
  // tidak selalu ikut tersuntik ke isolate-nya, dan waktu itu terjadi versi
  // pertama fungsi ini menolak SEMUANYA dengan 403 tanpa menyebut sebab --
  // terlihat persis seperti "berkasnya tidak terdaftar", padahal barisnya
  // ada dan polanya cocok. Satu jam habis mencari yang salah di tempat yang
  // benar.
  //
  // Cadangannya memakai anon key + TOKEN PEMANGGIL, jadi RLS ikut berlaku:
  // yang lolos hanya artwork yang baris designs-nya memang boleh dilihat
  // pemanggil itu. Itu batas yang LEBIH KETAT daripada service role, bukan
  // lebih longgar -- jadi memakainya sebagai cadangan aman.
  const coba = async (apikey: string, bearer: string) => {
    try {
      const u = `${SB_URL}/rest/v1/designs?select=id&drive_url=like.*${encodeURIComponent(fileId)}*&limit=1`;
      const r = await fetch(u, { headers: { apikey, Authorization: `Bearer ${bearer}` } });
      if (!r.ok) return false;
      const baris = await r.json();
      return Array.isArray(baris) && baris.length > 0;
    } catch {
      return false;
    }
  };

  if (SB_SERVICE_KEY && await coba(SB_SERVICE_KEY, SB_SERVICE_KEY)) return true;
  if (SB_ANON && tokenPemanggil && await coba(SB_ANON, tokenPemanggil)) return true;
  return false;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh error');
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// Id Drive boleh huruf, angka, '-' dan '_'. Apa pun di luar itu bukan id, dan
// menolaknya lebih awal menjaga agar nilai pemanggil tidak pernah ikut masuk
// ke URL yang dibangun di bawah.
const ID_SAH = /^[A-Za-z0-9_-]{10,200}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const tokenPemanggil = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await penggunaSah(req))) return json({ error: 'Forbidden' }, 403);

  // PEMERIKSAAN KESEHATAN. Hanya ADA / TIDAK ADA, tidak pernah nilainya.
  // Ada karena menebak-nebak sebab 403 berarti satu deploy per tebakan, dan
  // deploy itu bukan punya orang yang sedang mencari tahu.
  try {
    const cek = await req.clone().json();
    if (cek && cek.periksa === true) {
      return json({ env: {
        SUPABASE_URL: !!SB_URL, SUPABASE_ANON_KEY: !!SB_ANON,
        SUPABASE_SERVICE_ROLE_KEY: !!SB_SERVICE_KEY,
        GOOGLE_CLIENT_ID: !!CLIENT_ID, GOOGLE_CLIENT_SECRET: !!CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN: !!REFRESH_TOKEN,
      } });
    }
  } catch { /* bukan JSON -> bukan permintaan periksa */ }

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return json({ error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN belum diset. Lihat SETUP.md.' }, 501);
  }

  let fileId = '';
  try {
    const body = await req.json();
    // Terima id mentah ATAU tautan Drive utuh — layar portal memegang
    // drive_url, bukan id-nya, dan memaksanya mengurai sendiri cuma
    // memindahkan penguraian yang sama ke tempat yang lebih mudah salah.
    const mentah = String((body && (body.fileId || body.driveUrl)) || '').trim();
    const dariTautan = mentah.match(/\/d\/([A-Za-z0-9_-]+)/) || mentah.match(/[?&]id=([A-Za-z0-9_-]+)/);
    fileId = dariTautan ? dariTautan[1] : mentah;
  } catch {
    return json({ error: 'body harus JSON { fileId } atau { driveUrl }' }, 400);
  }
  if (!ID_SAH.test(fileId)) return json({ error: 'fileId tidak berbentuk id Drive' }, 400);

  // Pembatasan. Ditaruh SEBELUM token Google disentuh.
  if (!(await artworkTerdaftar(fileId, tokenPemanggil))) return json({ error: 'Forbidden' }, 403);

  try {
    const token = await getAccessToken();
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return json({ error: 'Drive menolak: ' + r.status }, 502);

    const panjang = Number(r.headers.get('content-length') || 0);
    if (panjang && panjang > BATAS_BYTE) {
      return json({ error: `berkasnya ${Math.round(panjang / 1048576)} MB, batasnya ${BATAS_BYTE / 1048576} MB` }, 413);
    }

    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength > BATAS_BYTE) {
      return json({ error: `berkasnya ${Math.round(buf.byteLength / 1048576)} MB, batasnya ${BATAS_BYTE / 1048576} MB` }, 413);
    }

    return new Response(buf, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': r.headers.get('content-type') || 'application/pdf',
        'Content-Length': String(buf.byteLength),
        // Artworknya memang jarang berubah, tapi KALAU diganti, yang dipakai
        // harus yang baru. Lima menit cukup untuk menahan rentetan permintaan
        // saat satu Excel berisi puluhan baris merek yang sama, dan cukup
        // pendek supaya penggantian artwork tidak tertahan seharian.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
