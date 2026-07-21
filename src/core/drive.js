// Google Drive upload wrapper. Uploads go through a Supabase Edge Function that
// holds the service-account JSON server-side. Degrades gracefully when unconfigured:
// returns a placeholder link so the rest of the app keeps working.

import { DRIVE_UPLOAD_URL, DRIVE_ROOT_FOLDER_ID, FEATURES } from '../config.js';
import { getClient } from './supabase.js';

export function driveConfigured() { return FEATURES.useDrive; }

// Upload a File/Blob to a logical folder path nested under a top-level Drive
// category (e.g. category "PPKEK", folderPath "2026/07/003576-26ID0022/").
// category is optional — omitted/unrecognized falls back to the Drive root.
// Returns { url, id, name, placeholder }.
export async function uploadToDrive(file, folderPath, filename, category) {
  const name = filename || file.name || 'document';
  if (!driveConfigured()) {
    // Graceful placeholder — real link filled once Drive is configured.
    return {
      url: `drive-pending://${folderPath}${name}`,
      id: null,
      name,
      placeholder: true,
    };
  }
  try {
    const form = new FormData();
    form.append('file', file, name);
    form.append('folderPath', folderPath);
    form.append('rootFolderId', DRIVE_ROOT_FOLDER_ID);
    if (category) form.append('category', category);

    // Pass the Supabase access token if available (Edge Function verifies it).
    let headers = {};
    const c = await getClient();
    if (c) {
      const { data } = await c.auth.getSession();
      if (data && data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
    }

    const res = await fetch(DRIVE_UPLOAD_URL, { method: 'POST', body: form, headers });
    if (!res.ok) throw new Error(`Drive upload HTTP ${res.status}`);
    const json = await res.json();
    // Expected: { id, webViewLink }
    return { url: json.webViewLink || json.url, id: json.id, name, placeholder: false };
  } catch (e) {
    console.warn('Drive upload failed — using placeholder link.', e);
    return { url: `drive-error://${folderPath}${name}`, id: null, name, placeholder: true };
  }
}

// Build the PPKEK sub-path within the "PPKEK" category folder: {year}/{month}/{SPPB}-{shipment}/
export function ppkekFolder(year, month, sppb, shipment) {
  const mm = String(month).padStart(2, '0');
  return `${year}/${mm}/${sppb}-${shipment}/`;
}
