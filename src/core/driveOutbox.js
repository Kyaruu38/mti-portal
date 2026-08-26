// DRIVE OUTBOX — the file survives first, Drive comes second.
//
// WHY THIS EXISTS
// -----------------------------------------------------------------------------
// The Google refresh token died on 27 July 2026 and nobody noticed until
// 1 August. For five days every upload failed, and what was lost was not the
// link — it was the FILE.
//
// The old path was: file into browser memory -> POST to Drive -> done. What
// went into Postgres was only what had been READ out of the file (invoice
// number, amount, nopen). The bytes themselves never landed anywhere but
// Drive. So when Drive refused, there was nothing left to retry with. A
// "retry" button would have posted an empty hand.
//
// Now the bytes go to Supabase Storage BEFORE Drive is contacted, and the
// Storage copy is deleted only after Drive has confirmed. The order is the
// whole design:
//
//     stash -> push -> record link -> delete stash
//
// Never delete-then-record. That leaves a window, however short, in which the
// file is gone and the link is not yet written; a tab closed inside that window
// loses the file permanently. Deleting last means the worst case is a duplicate
// in Storage, which costs a few kilobytes and is fixed by the next retry.
//
// Requires supabase_drive_outbox.sql. Without it every function here degrades
// to "no safety net" — the upload still works exactly as it did before, and the
// console says why. A missing migration must never block a click.
import { getClient, isConfigured } from './supabase.js';

const BUCKET = 'drive-outbox';

// Same contract as every other module here: a missing table/bucket is a warning,
// never a throw. The business action this belongs to has its own guard.
function warn(what, e) {
  console.warn(`drive outbox: ${what} —`, (e && e.message) || e);
}

// A stable, collision-proof path. Not derived from the filename alone: two
// people uploading "invoice.pdf" in the same minute must not overwrite each
// other, and the second one silently replacing the first is exactly the kind of
// quiet loss this module exists to prevent.
function storagePath(name) {
  const safe = String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
  return `${crypto.randomUUID()}/${safe}`;
}

/**
 * Put the bytes somewhere safe and open a queue entry.
 * Returns { id, path } or null when the outbox is unavailable — the caller then
 * behaves exactly as it did before this module existed.
 */
export async function stash(file, meta) {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    if (!c) return null;
    const path = storagePath(meta && meta.fileName);
    const up = await c.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (up.error) { warn('gagal menyimpan file ke Storage', up.error); return null; }

    const { data, error } = await c.from('drive_outbox').insert({
      storage_path: path,
      file_name: (meta && meta.fileName) || 'file',
      folder_path: (meta && meta.folderPath) || '',
      category: (meta && meta.category) || '',
      created_by: (meta && meta.by) || null,
      status: 'pending',
    }).select('id').single();
    if (error) {
      // The row failed but the object is up there. Remove it rather than leave
      // an orphan nobody will ever look for.
      await c.storage.from(BUCKET).remove([path]).catch(() => {});
      warn('gagal mencatat antrean', error);
      return null;
    }
    return { id: data.id, path };
  } catch (e) {
    warn('stash gagal', e);
    return null;
  }
}

// Drive accepted it. Record the link FIRST, then drop the stashed copy.
export async function markDone(outboxId, driveUrl) {
  if (!outboxId || !isConfigured()) return;
  try {
    const c = await getClient();
    if (!c) return;
    const { data, error } = await c.from('drive_outbox')
      .update({ status: 'done', drive_url: driveUrl, last_error: null, done_at: new Date().toISOString() })
      .eq('id', outboxId).select('storage_path').single();
    // If the link could not be recorded, KEEP the file. An orphaned object is a
    // few kilobytes; an unrecorded deletion is a document nobody can produce.
    if (error) { warn('gagal menandai selesai — file sengaja TIDAK dihapus', error); return; }
    if (data && data.storage_path) {
      const rm = await c.storage.from(BUCKET).remove([data.storage_path]);
      if (rm.error) warn('file terkirim tapi salinan antrean gagal dihapus (tidak fatal)', rm.error);
    }
  } catch (e) {
    warn('markDone gagal', e);
  }
}

export async function markPending(outboxId, err) {
  if (!outboxId || !isConfigured()) return;
  try {
    const c = await getClient();
    if (!c) return;
    // Read-then-write for attempts: there is no atomic increment through
    // PostgREST, and an approximate count is fine — this number is read by a
    // human deciding whether something is stuck, not by any logic.
    const { data } = await c.from('drive_outbox').select('attempts').eq('id', outboxId).maybeSingle();
    await c.from('drive_outbox').update({
      status: 'pending',
      attempts: ((data && data.attempts) || 0) + 1,
      last_error: String((err && err.message) || err || '').slice(0, 500),
    }).eq('id', outboxId);
  } catch (e) {
    warn('markPending gagal', e);
  }
}

/**
 * Tell the queue where the link belongs once Drive accepts it.
 *
 * Called AFTER the owning row is inserted, because its id does not exist while
 * the file is being uploaded. An entry with no target is still worth keeping:
 * the file is safe and downloadable from the queue, which beats losing it.
 */
export async function linkOutbox(outboxId, table, rowId, kind) {
  if (!outboxId || !rowId || !isConfigured()) return;
  try {
    const c = await getClient();
    if (!c) return;
    await c.from('drive_outbox').update({
      target_table: table, target_id: rowId, target_kind: kind || 'url',
    }).eq('id', outboxId);
  } catch (e) {
    warn('linkOutbox gagal', e);
  }
}

export async function pendingOutbox() {
  if (!isConfigured()) return [];
  try {
    const c = await getClient();
    if (!c) return [];
    const { data, error } = await c.from('drive_outbox')
      .select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(100);
    if (error) { warn('gagal membaca antrean', error); return []; }
    return data || [];
  } catch (e) {
    warn('pendingOutbox gagal', e);
    return [];
  }
}

// YANG SUDAH DIVONIS GAGAL. Dibaca terpisah dari yang masih mengantre karena
// dua-duanya butuh kalimat yang berbeda: yang mengantre memang aman dan akan
// terkirim sendiri, yang gagal TIDAK — dan sampai v15.20 tidak ada satu layar
// pun yang menyebutnya. Dua belas dokumen PPKEK hilang dari layar begitu saja
// antara 7 dan 21 Agustus, dan yang tampil malah kalimat "filenya AMAN" untuk
// berkas yang justru sudah divonis tidak bisa diselamatkan.
export async function gagalOutbox() {
  if (!isConfigured()) return [];
  try {
    const c = await getClient();
    if (!c) return [];
    const { data, error } = await c.from('drive_outbox')
      .select('*').eq('status', 'failed').order('created_at', { ascending: true }).limit(100);
    if (error) { warn('gagal membaca daftar gagal', error); return []; }
    return data || [];
  } catch (e) {
    warn('gagalOutbox gagal', e);
    return [];
  }
}

// APAKAH OBJEKNYA MASIH ADA — tanpa mengunduhnya.
//
// list() dengan search cuma membaca metadata, jadi memeriksa dua belas berkas
// tidak menarik dua belas PDF melewati koneksi orangnya.
async function objekAda(c, path) {
  const potong = String(path || '').lastIndexOf('/');
  if (potong < 0) return false;
  const dir = path.slice(0, potong);
  const nama = path.slice(potong + 1);
  const { data, error } = await c.storage.from(BUCKET).list(dir, { search: nama, limit: 100 });
  if (error) return null;                     // null = TIDAK TAHU, bukan "tidak ada"
  return (data || []).some(x => x.name === nama);
}

// MEMBANGKITKAN VONIS YANG SALAH.
//
// retryPending() dulu memperlakukan SETIAP kegagalan download sebagai "filenya
// sudah tidak ada" dan menulis kalimat itu ke last_error — membuang pesan
// aslinya. Padahal download bisa gagal karena proyeknya sedang di-pause, karena
// policy Storage, karena jaringan putus sedetik. Ketiganya sementara; vonisnya
// permanen. Sekali sebuah baris jadi 'failed', tidak ada satu pun jalan di
// portal ini yang pernah melihatnya lagi.
//
// Jadi setiap login, baris yang divonis gagal DIPERIKSA ULANG: kalau objeknya
// ternyata masih ada di Storage, vonisnya dicabut dan ia kembali mengantre.
// Kalau memang tidak ada, ia dibiarkan gagal — dan sekarang layar menyebutnya.
export async function bangkitkanYangMasihAda() {
  if (!isConfigured()) return { diperiksa: 0, dibangkitkan: 0 };
  try {
    const c = await getClient();
    if (!c) return { diperiksa: 0, dibangkitkan: 0 };
    const rows = await gagalOutbox();
    if (!rows.length) return { diperiksa: 0, dibangkitkan: 0 };
    let hidup = 0;
    for (const row of rows) {
      const ada = await objekAda(c, row.storage_path);
      if (ada !== true) continue;             // false atau null: jangan diapa-apakan
      const { error } = await c.from('drive_outbox').update({
        status: 'pending',
        last_error: 'sempat divonis hilang, ternyata objeknya masih ada — dicoba ulang',
      }).eq('id', row.id);
      if (!error) hidup++;
    }
    return { diperiksa: rows.length, dibangkitkan: hidup };
  } catch (e) {
    warn('bangkitkanYangMasihAda gagal', e);
    return { diperiksa: 0, dibangkitkan: 0 };
  }
}

// Where a recovered link goes home to. Kept as data rather than as a switch
// buried in the retry loop, so adding a sixth upload path is one line here.
const TARGETS = {
  designs:     { kind: 'url',   column: 'drive_url' },
  surat_jalan: { kind: 'url',   column: 'drive_url' },
  payments:    { kind: 'url',   column: 'drive_url' },
  invoices:    { kind: 'files', column: 'files' },
  ppkek:       { kind: 'files', column: 'files' },
};

async function applyToTarget(c, row, driveUrl) {
  const spec = TARGETS[row.target_table];
  if (!spec || !row.target_id) return;

  if (spec.kind === 'url') {
    const { error } = await c.from(row.target_table)
      .update({ [spec.column]: driveUrl }).eq('id', row.target_id);
    if (error) warn(`gagal menempelkan link ke ${row.target_table}`, error);
    return;
  }

  // files: append, never replace. Another file may have been attached to the
  // same record while this one sat in the queue, and overwriting the array
  // would delete a link that is perfectly fine.
  const { data, error } = await c.from(row.target_table)
    .select(spec.column).eq('id', row.target_id).maybeSingle();
  if (error || !data) { warn(`gagal membaca ${row.target_table} untuk menempelkan link`, error); return; }
  const files = Array.isArray(data[spec.column]) ? data[spec.column].slice() : [];
  const already = files.some(f => f && f.url === driveUrl);
  if (!already) files.push({ name: row.file_name, url: driveUrl, placeholder: false, fromOutbox: true });
  const up = await c.from(row.target_table).update({ [spec.column]: files }).eq('id', row.target_id);
  if (up.error) warn(`gagal menempelkan link ke ${row.target_table}`, up.error);
}

/**
 * Work the queue. Safe to call on every login and from a button — it is a no-op
 * when nothing is pending, and it never throws.
 *
 * Returns { tried, sent, still } so the caller can say something true.
 */
export async function retryPending(pushFn) {
  const rows = await pendingOutbox();
  if (!rows.length) return { tried: 0, sent: 0, still: 0 };

  const c = await getClient();
  if (!c) return { tried: 0, sent: 0, still: rows.length };

  let sent = 0;
  for (const row of rows) {
    try {
      const dl = await c.storage.from(BUCKET).download(row.storage_path);
      if (dl.error || !dl.data) {
        // SEBUAH KEGAGALAN UNDUH BUKAN BUKTI FILENYA HILANG.
        //
        // Versi sebelumnya memvonis 'failed' pada setiap dl.error apa pun
        // sebabnya, lalu MENIMPA pesan aslinya dengan kalimat "file tidak ada
        // lagi di Storage". Proyek yang sedang di-pause, policy Storage yang
        // berubah, dan jaringan yang putus sedetik semuanya masuk ke sana —
        // tiga sebab sementara yang menghasilkan vonis permanen, dengan bukti
        // aslinya dibuang. Itu persis kesalahan yang membuat pushToDrive dulu
        // membaca teks balasan Google: menebak antara dua sebab jauh lebih
        // mahal daripada menyimpan satu kalimat.
        //
        // Sekarang keberadaannya ditanyakan terpisah, dan cuma jawaban TEGAS
        // "tidak ada" yang boleh memvonis. Ragu-ragu (null) tetap mengantre.
        const ada = await objekAda(c, row.storage_path);
        if (ada === false) {
          await c.from('drive_outbox').update({
            status: 'failed',
            last_error: 'objek tidak ada di Storage — tidak bisa dicoba ulang. Perlu diunggah ulang manual.',
          }).eq('id', row.id);
        } else {
          await markPending(row.id, (dl.error && dl.error.message) || dl.error
            || 'gagal mengunduh salinan antrean, sebabnya tidak jelas');
        }
        continue;
      }
      const file = new File([dl.data], row.file_name, { type: dl.data.type || 'application/octet-stream' });
      const up = await pushFn(file, row.folder_path, row.file_name, row.category);
      if (!up || up.placeholder) { await markPending(row.id, up && up.reason); continue; }

      await applyToTarget(c, row, up.url);
      await markDone(row.id, up.url);
      sent++;
    } catch (e) {
      await markPending(row.id, e);
    }
  }
  return { tried: rows.length, sent, still: rows.length - sent };
}
