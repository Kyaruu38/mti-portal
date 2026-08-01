// Google Drive upload wrapper. Uploads go through a Supabase Edge Function that
// holds the Google credentials server-side.
//
// EVERY UPLOAD IS STASHED BEFORE IT IS SENT (core/driveOutbox.js).
//
// The reason is a concrete five days. The refresh token expired on 27 July 2026;
// every upload from then until 1 August was refused by Google, and this function
// answered each one with a placeholder that the callers flattened to NULL. The
// screens said "saved". Nothing had been. And because the bytes had never been
// written anywhere but Drive, there was nothing left to retry — the files were
// simply gone.
//
// So now the file goes into Supabase Storage first and is deleted only once
// Drive has confirmed. A failed upload is no longer a lost file; it is a queued
// one, and core/driveOutbox.js#retryPending drains the queue on the next login
// without anyone re-picking anything.
//
// The return shape gained three fields and kept the old ones, so existing
// callers work unchanged:
//   { url, id, name, placeholder,   outboxId, stashed, reason }

import { DRIVE_UPLOAD_URL, DRIVE_ROOT_FOLDER_ID, FEATURES } from '../config.js';
import { getClient } from './supabase.js';
import { stash, markDone, markPending } from './driveOutbox.js';

export function driveConfigured() { return FEATURES.useDrive; }

// Upload a File/Blob to a logical folder path nested under a top-level Drive
// category (e.g. category "PPKEK", folderPath "2026/07/003576-26ID0022/").
// category is optional — omitted/unrecognized falls back to the Drive root.
// Returns { url, id, name, placeholder }.
export async function uploadToDrive(file, folderPath, filename, category) {
  const name = filename || file.name || 'document';
  // A Drive upload is the ONE write RLS cannot see, and three flows upload the
  // file before touching Postgres (payment proof, design library, surat jalan
  // archive). Without this, a read-only account whose database write is
  // correctly refused could still drop files into the company Drive.
  //
  // Returns the same placeholder shape as the unconfigured path instead of
  // throwing, so a caller that only wants a link keeps working and the business
  // action it belongs to fails on its own guard rather than on this one.
  const { blockWrite } = await import('./guard.js');
  if (blockWrite(`upload "${name}" ke Drive`)) {
    return { url: '', id: null, name, placeholder: true, blocked: true };
  }
  if (!driveConfigured()) {
    // Graceful placeholder — real link filled once Drive is configured.
    return {
      url: `drive-pending://${folderPath}${name}`,
      id: null,
      name,
      placeholder: true,
      reason: 'Drive belum dikonfigurasi',
    };
  }

  // SAFETY NET FIRST. Deliberately before the Drive call and deliberately
  // non-fatal: if the outbox is unavailable (migration not run, Storage full,
  // offline) the upload still proceeds exactly as it used to. A missing net is
  // worse than a net, and both are better than refusing to work.
  const entry = await stash(file, { fileName: name, folderPath, category });

  const up = await pushToDrive(file, folderPath, name, category);

  if (!up.placeholder) {
    // Link recorded, THEN the stashed copy is dropped — see driveOutbox.js for
    // why that order is not interchangeable.
    if (entry) await markDone(entry.id, up.url);
    return { ...up, outboxId: entry ? entry.id : null, stashed: !!entry };
  }

  if (entry) await markPending(entry.id, up.reason);
  return { ...up, outboxId: entry ? entry.id : null, stashed: !!entry };
}

/**
 * The raw POST, with no stashing. Used directly by the retry runner, which is
 * replaying a file that is ALREADY in the outbox — stashing it again would
 * queue a second copy of the same document on every attempt.
 */
export async function pushToDrive(file, folderPath, filename, category) {
  const name = filename || file.name || 'document';
  try {
    const form = new FormData();
    form.append('file', file, name);
    form.append('folderPath', folderPath || '');
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
    // The body carries the ACTUAL reason (invalid_grant, quota, folder not
    // found). Throwing away that text is what turned a five-day outage into an
    // hour of guessing, so it is read here and carried on `reason`.
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
    }
    const json = await res.json();
    // Expected: { id, webViewLink }
    return { url: json.webViewLink || json.url, id: json.id, name, placeholder: false };
  } catch (e) {
    const reason = String((e && e.message) || e);
    console.warn('Drive upload ditolak:', reason);
    return { url: `drive-error://${folderPath || ''}${name}`, id: null, name, placeholder: true, reason };
  }
}

// Build the PPKEK sub-path within the "PPKEK" category folder: {year}/{month}/{SPPB}-{shipment}/
export function ppkekFolder(year, month, sppb, shipment) {
  const mm = String(month).padStart(2, '0');
  return `${year}/${mm}/${sppb}-${shipment}/`;
}
