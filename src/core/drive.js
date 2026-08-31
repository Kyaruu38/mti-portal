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
import { toast } from './store.js';
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

  // JARINGNYA TIDAK TERPASANG, DAN ITU HARUS BERBUNYI.
  //
  // stash() sengaja tidak melempar: kalau tabel outbox atau bucket-nya tidak
  // bisa dipakai, unggahannya tetap jalan seperti sebelum modul ini ada. Itu
  // keputusan yang masih benar — jaring yang hilang lebih baik daripada tombol
  // yang menolak bekerja.
  //
  // Yang SALAH adalah diamnya. Sampai v15.22 keadaan ini persis sama rupanya
  // dengan unggahan biasa: tidak ada satu pun tulisan di layar, dan orangnya
  // menekan tombol berikutnya tanpa tahu bahwa untuk berkas ini tidak ada
  // salinan cadangan sama sekali. Kalau Drive lalu menolak, berkasnya lenyap
  // tanpa masuk antrean, tanpa masuk spanduk, tanpa jejak di mana pun.
  //
  // Itu satu-satunya jalur yang masih bisa menghilangkan berkas tanpa bunyi,
  // dan sekarang ia berbunyi.
  if (!entry) {
    toast({
      id: `"${name}" diunggah TANPA salinan cadangan — antrean pengamannya tidak bisa dipakai. Kalau gagal, filenya tidak bisa dicoba ulang otomatis.`,
      en: `"${name}" is being uploaded with NO backup copy — the safety queue is unavailable. If it fails, the file cannot be retried automatically.`,
      zh: `"${name}" 正在上传，但没有备份副本 — 安全队列不可用。若失败，该文件无法自动重试。`,
    });
  }

  const up = await pushToDrive(file, folderPath, name, category);

  if (!up.placeholder) {
    // Link recorded, THEN the stashed copy is dropped — see driveOutbox.js for
    // why that order is not interchangeable.
    if (entry) await markDone(entry.id, up.url);
    return { ...up, outboxId: entry ? entry.id : null, stashed: !!entry };
  }

  if (entry) {
    await markPending(entry.id, up.reason, { ragu: !!up.tidakDiketahui });
  } else {
    // TIDAK ADA JARING, DAN JATUH. Ini satu-satunya cabang di seluruh modul ini
    // yang berarti berkasnya benar-benar tidak ada di mana pun — bukan di Drive,
    // bukan di Storage, bukan di antrean. Tidak ada yang bisa memperbaikinya
    // selain orang yang masih memegang berkasnya di layar sebelah, dan dia cuma
    // punya beberapa detik untuk tahu.
    console.error('Drive: unggahan gagal DAN tidak ada salinan antrean —', name, up.reason);
    toast({
      id: `GAGAL: "${name}" tidak sampai ke Drive dan tidak tersimpan di mana pun. Ulangi unggahnya sekarang selagi filenya masih ada. (${up.reason || 'sebab tidak diketahui'})`,
      en: `FAILED: "${name}" did not reach Drive and was not saved anywhere. Upload it again now, while you still have the file. (${up.reason || 'reason unknown'})`,
      zh: `失败："${name}" 未送达 Drive，也未保存在任何地方。请趁文件还在手边立即重新上传。（${up.reason || '原因未知'}）`,
    });
  }
  return { ...up, outboxId: entry ? entry.id : null, stashed: !!entry, tanpaJaring: !entry };
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

    // Sampai di sini fetch() belum dipanggil. Apa pun yang meledak SESUDAH
    // baris ini adalah balasan yang kita TERIMA; apa pun yang meledak PADA
    // baris ini adalah balasan yang tidak pernah datang. Bedanya besar sekali,
    // dan lihat catatan di blok catch di bawah.
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
    // "GAGAL" DAN "TIDAK TAHU" ADALAH DUA HAL YANG BERBEDA, DAN MENYAMAKANNYA
    // SUDAH MELAHIRKAN DUPLIKAT DI DRIVE.
    //
    // Kalau server MENJAWAB dengan 4xx/5xx, kita tahu berkasnya tidak ditulis —
    // mengulanginya aman. Tapi kalau fetch() sendiri yang meledak ("Failed to
    // fetch", koneksi putus, tab ditutup di tengah jalan), yang hilang adalah
    // BALASANNYA, bukan unggahannya. POST-nya bisa saja sudah mendarat dengan
    // sempurna dan berkasnya sudah ada di Drive.
    //
    // Yang lama memperlakukan keduanya sama, jadi login berikutnya mengunggah
    // ulang berkas yang sebenarnya sudah ada di sana. Itulah asal-usul pasangan
    // kembar di folder 010220-26ID0641 dan 009851-SHIP: BL, PPKEK, SPPB, BC 1.1
    // dan CEK HS CODE semuanya ada DUA, tanggalnya sama persis.
    //
    // TypeError dari fetch() adalah kegagalan jaringan — respons tidak pernah
    // ada. Error yang lain di blok ini datang SESUDAH respons diterima, jadi
    // hasilnya diketahui.
    const tidakDiketahui = (e instanceof TypeError) || /failed to fetch|network|load failed/i.test(reason);
    console.warn('Drive upload ' + (tidakDiketahui ? 'HASILNYA TIDAK DIKETAHUI' : 'ditolak') + ':', reason);
    return { url: `drive-error://${folderPath || ''}${name}`, id: null, name, placeholder: true, reason, tidakDiketahui };
  }
}

// Build the PPKEK sub-path within the "PPKEK" category folder: {year}/{month}/{SPPB}-{shipment}/
export function ppkekFolder(year, month, sppb, shipment) {
  const mm = String(month).padStart(2, '0');
  return `${year}/${mm}/${sppb}-${shipment}/`;
}
