// =============================================================================
// Supabase Edge Function: drive-upload
// -----------------------------------------------------------------------------
// Uploads a file to Google Drive under the purchase.ptmti@gmail.com account
// (architecture A — one shared department Drive) using OAuth2 **refresh token**
// auth, not a service account. The client secret and refresh token stay
// server-side as Supabase secrets — the browser never sees them.
//
// One-time setup (get the refresh token): see SETUP.md "Google Drive (OAuth,
// department account)" section — purchase.ptmti authorizes once, you paste the
// resulting refresh token into the secret below.
//
// Deploy:
//   supabase functions deploy drive-upload
// Secrets:
//   supabase secrets set GOOGLE_CLIENT_ID="..."
//   supabase secrets set GOOGLE_CLIENT_SECRET="..."
//   supabase secrets set GOOGLE_REFRESH_TOKEN="..."
//   supabase secrets set DRIVE_ROOT_FOLDER_ID="..."   (optional fallback; the
//     frontend also sends rootFolderId per-request from src/config.js)
//
// The frontend posts multipart/form-data: file, folderPath, rootFolderId, category.
// `category` ("PPKEK" / "Invoice" / "Bukti Bayar" / "Surat Jalan" / ...) is a
// top-level subfolder directly under root, auto-created and cached per warm
// isolate; empty/unrecognized category falls back to root, never errors.
// Returns JSON: { id, webViewLink }. Uploaded files are set to "anyone with
// the link can view".
// =============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') || '';
const DEFAULT_ROOT = Deno.env.get('DRIVE_ROOT_FOLDER_ID') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cached across warm invocations of the same isolate — avoids a token
// exchange round-trip on every upload. Falls back to a fresh exchange
// whenever it's missing/expired.
let cachedToken: { token: string; exp: number } | null = null;

// Cached top-level category subfolder ids ("PPKEK", "Invoice", "Bukti Bayar",
// "Surat Jalan", ...), keyed by `${rootFolderId}::${category}`. Avoids a
// list+maybe-create round-trip on every single upload; resets on cold start,
// which just costs one extra lookup, not a duplicate folder (ensureFolderPath
// itself is already idempotent — it looks up by name before creating).
const categoryFolderCache = new Map<string, string>();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    // Degrade gracefully — the frontend treats this as "not configured".
    return json({ error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN not set. See SETUP.md.' }, 501);
  }

  try {
    const form = await req.formData();
    const file = form.get('file') as File;
    const folderPath = String(form.get('folderPath') || '');
    const rootFolderId = String(form.get('rootFolderId') || DEFAULT_ROOT);
    const category = String(form.get('category') || '').trim();
    if (!file) return json({ error: 'file is required' }, 400);
    if (!rootFolderId) return json({ error: 'rootFolderId is required (set DRIVE_ROOT_FOLDER_ID or pass rootFolderId)' }, 400);

    const token = await getAccessToken();

    // Unrecognized/missing category falls back to the root itself — never errors.
    const categoryParentId = await resolveCategoryFolder(token, rootFolderId, category);

    // Ensure any further nested folder path exists under the category folder.
    const parentId = await ensureFolderPath(token, categoryParentId, folderPath);

    // Resumable/multipart upload of the file bytes.
    const meta = { name: file.name, parents: parentId ? [parentId] : undefined };
    const boundary = 'mti' + crypto.randomUUID();
    const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
    const post = `\r\n--${boundary}--`;
    const body = new Blob([pre, await file.arrayBuffer(), post]);

    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!up.ok) return json({ error: 'Drive upload failed', detail: await up.text() }, 502);
    const data = await up.json();

    // Anyone with the link can view — the whole point of this Drive layout.
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return json({ id: data.id, webViewLink: data.webViewLink });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// --- Google OAuth2 (refresh token -> access token) ---
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh error: ' + JSON.stringify(data));
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// Resolve (or create) the top-level category subfolder directly under root —
// e.g. "PPKEK", "Invoice", "Bukti Bayar", "Surat Jalan". Empty category means
// "no subfolder", i.e. upload straight into root (the pre-category behavior).
async function resolveCategoryFolder(token: string, rootId: string, category: string): Promise<string> {
  if (!category) return rootId;
  const key = `${rootId}::${category}`;
  const cached = categoryFolderCache.get(key);
  if (cached) return cached;
  const id = await ensureFolderPath(token, rootId, category);
  categoryFolderCache.set(key, id);
  return id;
}

// Create/resolve nested folders "A/B/C/" under rootFolderId; returns the leaf id.
async function ensureFolderPath(token: string, rootId: string, path: string): Promise<string> {
  let parent = rootId;
  const parts = path.split('/').map((p) => p.trim()).filter(Boolean);
  for (const name of parts) {
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${token}` } });
    const found = await list.json();
    if (found.files && found.files.length) { parent = found.files[0].id; continue; }
    const create = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
    });
    parent = (await create.json()).id;
  }
  return parent;
}
