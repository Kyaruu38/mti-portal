// =============================================================================
// Supabase Edge Function: drive-upload
// -----------------------------------------------------------------------------
// Uploads a file to Google Drive using a SERVICE ACCOUNT. The private key stays
// server-side (as a Supabase secret) — the browser never sees it.
//
// Deploy:
//   supabase functions deploy drive-upload
// Secrets (see SETUP.md):
//   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
//   supabase secrets set DRIVE_ROOT_FOLDER_ID="<folder id shared with the SA>"
//
// The frontend posts multipart/form-data: file, folderPath, rootFolderId.
// Returns JSON: { id, webViewLink }.
// =============================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// TODO(you): store the FULL service-account JSON as the secret below.
// It must be a Drive-enabled service account, and the target Drive folder must be
// SHARED with the service-account email (Editor).
const SA_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '';
const DEFAULT_ROOT = Deno.env.get('DRIVE_ROOT_FOLDER_ID') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!SA_JSON) {
    // Degrade gracefully — the frontend treats this as "not configured".
    return json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set. See SETUP.md.' }, 501);
  }

  try {
    const form = await req.formData();
    const file = form.get('file') as File;
    const folderPath = String(form.get('folderPath') || '');
    const rootFolderId = String(form.get('rootFolderId') || DEFAULT_ROOT);
    if (!file) return json({ error: 'file is required' }, 400);

    const sa = JSON.parse(SA_JSON);
    const token = await getAccessToken(sa);

    // Ensure nested folder path exists (creates missing folders under the root).
    const parentId = await ensureFolderPath(token, rootFolderId, folderPath);

    // Resumable/multipart upload of the file bytes.
    const meta = { name: file.name, parents: parentId ? [parentId] : undefined };
    const boundary = 'mti' + crypto.randomUUID();
    const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
    const post = `\r\n--${boundary}--`;
    const body = new Blob([pre, await file.arrayBuffer(), post]);

    const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!up.ok) return json({ error: 'Drive upload failed', detail: await up.text() }, 502);
    const data = await up.json();
    return json({ id: data.id, webViewLink: data.webViewLink });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// --- Google OAuth2 (JWT bearer) for the service account ---
async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  };
  const enc = (o: any) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function importPrivateKey(pem: string) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create/resolve nested folders "A/B/C/" under rootFolderId; returns the leaf id.
async function ensureFolderPath(token: string, rootId: string, path: string): Promise<string> {
  let parent = rootId;
  const parts = path.split('/').map((p) => p.trim()).filter(Boolean);
  for (const name of parts) {
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    const found = await list.json();
    if (found.files && found.files.length) { parent = found.files[0].id; continue; }
    const create = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
    });
    parent = (await create.json()).id;
  }
  return parent;
}
