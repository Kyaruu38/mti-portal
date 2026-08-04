// =============================================================================
// Supabase Edge Function: db-backup
// -----------------------------------------------------------------------------
// Menarik seluruh isi skema `public` lewat RPC backup_snapshot(), lalu
// mengunggahnya ke Google Drive sebagai satu file JSON.
//
// Dipanggil oleh pg_cron seminggu sekali (lihat supabase_backup_LANGKAH_3.sql).
// Bisa juga dipanggil manual untuk uji coba.
//
// KENAPA FUNGSI SENDIRI, BUKAN MENUMPANG drive-upload
// -----------------------------------------------------------------------------
// 1. drive-upload memberi izin `{ role: 'reader', type: 'anyone' }` ke setiap
//    file yang diunggahnya. Untuk desain label itu keputusan pemilik dan tidak
//    apa-apa. Untuk BACKUP SELURUH DATABASE — setiap PO, PRF, invoice, nama dan
//    alamat supplier, seluruh audit trail — itu bencana. Siapa pun yang
//    mendapat link-nya mendapat semuanya. Fungsi ini TIDAK memasang izin
//    publik sama sekali.
// 2. drive-upload menerima multipart/form-data. pg_cron mengirim lewat pg_net,
//    yang cuma nyaman mengirim JSON biasa.
//
// KEAMANAN
// -----------------------------------------------------------------------------
// URL Edge Function bisa ditebak. Jadi fungsi ini menolak setiap permintaan
// yang tidak membawa header X-Backup-Secret yang cocok dengan secret
// BACKUP_SECRET. Tanpa itu, siapa pun yang tahu URL-nya bisa menyuruh server
// mengirimkan seluruh database ke Drive kapan saja — dan setiap kali dia
// melakukannya, tidak ada satu pun yang terlihat aneh dari sisi portal.
//
// Deploy:
//   supabase functions deploy db-backup
// Secrets (yang tiga pertama sudah ada dari drive-upload):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   BACKUP_FOLDER_ID   -> id folder Drive KHUSUS backup (jangan folder kerja)
//   BACKUP_SECRET      -> string acak panjang, dipakai pg_cron
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  -> disediakan otomatis oleh Supabase
// =============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CLIENT_ID      = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const CLIENT_SECRET  = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REFRESH_TOKEN  = Deno.env.get('GOOGLE_REFRESH_TOKEN') || '';
const FOLDER_ID      = Deno.env.get('BACKUP_FOLDER_ID') || '';
const BACKUP_SECRET  = Deno.env.get('BACKUP_SECRET') || '';
const SB_URL         = Deno.env.get('SUPABASE_URL') || '';
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

// Perbandingan waktu-tetap. Perbandingan `!==` biasa berhenti di karakter
// pertama yang beda, dan selisih waktunya bisa dipakai menebak secret satu
// huruf demi satu huruf. Biayanya nol, jadi tidak ada alasan tidak memakainya.
function secretCocok(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!BACKUP_SECRET) return json({ error: 'BACKUP_SECRET belum diset' }, 500);
  if (!secretCocok(req.headers.get('x-backup-secret') || '', BACKUP_SECRET)) {
    // Sengaja tidak menjelaskan apa yang salah.
    return json({ error: 'Forbidden' }, 403);
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return json({ error: 'Kredensial Google belum lengkap' }, 500);
  }
  if (!FOLDER_ID) {
    // Sengaja GAGAL, bukan jatuh ke folder root. Backup yang mendarat di folder
    // kerja akan ikut terhapus waktu orang beres-beres, dan tidak ada yang tahu
    // sampai backupnya dibutuhkan.
    return json({ error: 'BACKUP_FOLDER_ID belum diset — folder backup harus eksplisit' }, 500);
  }

  const mulai = Date.now();

  // 1) Tarik isi database lewat RPC.
  let snapshot: any;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/backup_snapshot`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SB_SERVICE_KEY,
        authorization: `Bearer ${SB_SERVICE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `RPC backup_snapshot gagal: HTTP ${res.status} ${detail.slice(0, 300)}` }, 500);
    }
    snapshot = await res.json();
  } catch (e) {
    return json({ error: `RPC backup_snapshot error: ${String(e)}` }, 500);
  }

  // Penjaga isi. Snapshot yang KOSONG tetap "berhasil" secara teknis, dan
  // itu bentuk kegagalan yang paling berbahaya: file backup ada, ukurannya
  // wajar-wajar saja, dan isinya tidak ada apa-apa. Baru ketahuan saat
  // dibutuhkan.
  const totalBaris = Object.values(snapshot?.jumlah_baris || {})
    .reduce((s: number, n: any) => s + (Number(n) || 0), 0);
  if (!snapshot?.data || totalBaris === 0) {
    return json({ error: 'Snapshot kosong — backup DIBATALKAN, file lama tidak ditimpa' }, 500);
  }

  // 2) Token Google.
  let token = '';
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
      }),
    });
    const tj = await tr.json();
    if (!tr.ok || !tj.access_token) {
      return json({ error: `Token Google gagal: ${JSON.stringify(tj).slice(0, 300)}` }, 500);
    }
    token = tj.access_token;
  } catch (e) {
    return json({ error: `Token Google error: ${String(e)}` }, 500);
  }

  // 3) Unggah. Nama file memuat tanggal, jadi backup lama TIDAK tertimpa —
  //    backup yang saling menimpa cuma melindungi dari kerusakan yang ketahuan
  //    dalam seminggu. Kerusakan data biasanya baru ketahuan jauh lebih lama.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const nama = `mti-backup-${stamp}.json`;
  const isi = JSON.stringify(snapshot);

  try {
    const meta = { name: nama, parents: [FOLDER_ID], mimeType: 'application/json' };
    const batas = '-------mti-backup-boundary';
    const pre = `--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${batas}\r\nContent-Type: application/json\r\n\r\n`;
    const post = `\r\n--${batas}--`;
    const body = new Blob([pre, isi, post]);

    const up = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${batas}` },
        body,
      },
    );
    const uj = await up.json();
    if (!up.ok) return json({ error: `Upload Drive gagal: ${JSON.stringify(uj).slice(0, 300)}` }, 500);

    // SENGAJA TIDAK ADA pemberian izin "anyone with the link".
    // Bandingkan dengan drive-upload yang memang memberikannya.

    return json({
      ok: true,
      file: nama,
      id: uj.id,
      bytes: isi.length,
      tabel: snapshot.jumlah_tabel,
      baris: totalBaris,
      per_tabel: snapshot.jumlah_baris,
      durasi_ms: Date.now() - mulai,
    });
  } catch (e) {
    return json({ error: `Upload Drive error: ${String(e)}` }, 500);
  }
});
