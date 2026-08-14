// Supabase persistence for PRFs. RLS on this table is stage-gated (see
// supabase_schema.sql prfs_update) — this module doesn't change or work
// around that, it just calls plain insert/update and lets Postgres accept or
// reject based on the caller's role + the stage transition, same as every
// other module here.
import { getClient, isConfigured, fetchAllPaged, assertWrote } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id, no: row.no, supplier: row.supplier, currency: row.currency, amount: row.amount,
    invoices: row.invoices || [], lines: row.lines || [], stage: row.stage,
    receiveChecklist: row.receive_checklist || { a: false, b: false, c: false, d: false },
    by: row.created_by, createdAt: row.created_at, receivedAt: row.received_at, paidAt: row.paid_at,
  };
}
function toRow(prf) {
  return {
    no: prf.no, supplier: prf.supplier, currency: prf.currency || 'IDR', amount: prf.amount || 0,
    invoices: prf.invoices || [], lines: prf.lines || [], stage: prf.stage || 'Terbentuk',
    receive_checklist: prf.receiveChecklist || {}, created_by: prf.by,
  };
}

export async function fetchPrfs() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('prfs').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchPrfs failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertPrf(prf) {
  if (!isConfigured()) return prf;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('prfs').insert(toRow(prf)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Single-table stage advance (e.g. Diproses Wilbert -> Diterima Finance via
// the receive checklist). NOT used for the Paid transition — that's the
// atomic confirm_prf_paid RPC in paymentsApi.js, since it also has to touch
// invoices + payments in the same operation.
export async function updatePrfStage(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('stage' in patch) row.stage = patch.stage;
  if ('receivedAt' in patch) row.received_at = patch.receivedAt;
  if ('receiveChecklist' in patch) row.receive_checklist = patch.receiveChecklist;
  assertWrote(await c.from('prfs').update(row).eq('id', id).select('id'), 'ubah PRF');
}

// Delete a PRF. Only reachable before Finance has it — see payment.js.
//
// The NUMBER is not reclaimed, and that is deliberate. PRF numbers come from a
// sequence and end up on paper that leaves this building; reusing one means two
// different documents answer to the same reference, and no amount of tidiness
// is worth that. A gap in the sequence is a normal thing for a document series
// to have, and it is visible, which is the point.
export async function deletePrf(id) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  assertWrote(await c.from('prfs').delete().eq('id', id).select('id'), 'hapus PRF');
}

// ---------------------------------------------------------------------------
// REKONSILIASI PRF ↔ INVOICE
//
// KENAPA MODUL INI ADA
// 14 Agustus 2026. PRF/PC/VIII/083 memuat 935.363.680; invoice 1066/WTP/VII/26
// yang mendasarinya ternyata salah ketik dan dikoreksi ke 935.383.680. PRF-nya
// TIDAK ikut berubah, dan tidak ada satu pun tempat di portal yang menyebutkan
// bahwa keduanya sudah tidak sama lagi. Yang menemukan selisihnya FINANCE,
// berhari-hari kemudian, dari kertas.
//
// `prf.amount` TIDAK PERNAH DIKETIK MANUSIA — ia selalu lahir sebagai
// `chosen.reduce((s, x) => s + x.amount, 0)` di payment.js. Jadi satu-satunya
// cara PRF bisa berbeda dari invoicenya adalah invoicenya BERUBAH SESUDAH PRF
// dibuat. Itu bukan bug yang bisa dicegah dengan validasi saat membuat; itu
// keadaan yang harus TERUS diperiksa selama PRF itu masih hidup.
//
// KENAPA BUKAN DIHITUNG ULANG SAJA SETIAP KALI DIGAMBAR
// Karena PRF adalah dokumen yang keluar gedung dan ditandatangani. Dokumen yang
// diam-diam berubah isinya sesudah ditandatangani adalah masalah yang lebih
// besar daripada dokumen yang salah dan mengaku salah. Aturan yang sama baru
// saja dipasang untuk dokumen PO di ui/documents.js: cetak yang TERSIMPAN,
// laporkan kalau berbeda, jangan pernah menggeser sendiri.
//
// Jadi: snapshotnya dipertahankan, selisihnya DILAPORKAN, dan menyamakannya
// adalah tindakan sadar seseorang — bukan efek samping membuka layar.
// ---------------------------------------------------------------------------

/**
 * PETA INVOICE MILIK PRF INI — DIBATASI PEMASOK DAN MATA UANGNYA.
 *
 * Nomor invoice TIDAK unik di seluruh tabel, dan itu disengaja: dua pemasok
 * boleh sama-sama memakai "INV-001", dan menolaknya akan memblokir pekerjaan
 * nyata. Penjaga duplikat di saveInvoiceModal memang bercakup PEMASOK
 * (`i.supplier === supplier.name && key(i.no) === key(f.no)`), jadi tabrakan
 * nomor bukan kemungkinan teoretis — portal ini yang membuatnya.
 *
 * Mencari invoice cuma dari nomornya berarti PRF pemasok A bisa memungut
 * nominal invoice pemasok B, lalu MENULISKANNYA. Itu lebih buruk daripada
 * kotak isian: tidak ada satu pun angka di layar yang bisa dipakai orangnya
 * untuk menyadari yang barusan disalin bukan miliknya.
 *
 * Mata uang ikut dibatasi karena satu PRF selalu satu mata uang (openPrf
 * memisahkan per mata uang), jadi invoice USD tidak punya urusan apa pun
 * dengan PRF rupiah — dan menjumlahkannya menghasilkan angka yang bahkan
 * bukan uang.
 *
 * Invoice yang ada tapi milik pemasok/mata uang lain akan jatuh ke `hilang`,
 * yang sudah MENOLAK disamakan dan melaporkan namanya. Itu jawaban yang benar:
 * "aku tidak menemukan invoicemu" jauh lebih baik daripada "ini, ambil punya
 * orang lain".
 */
function petaInvoice(prf, semuaInvoice) {
  const pemasok = prf && prf.supplier;
  const mata = (prf && prf.currency) || 'IDR';
  const cocok = (semuaInvoice || []).filter(i =>
    i && i.supplier === pemasok && ((i.currency || 'IDR') === mata));
  return new Map(cocok.map(i => [String(i.no), i]));
}

// Nomor invoice yang DISEBUT PRF ini, dari kedua tempat ia menyebutnya.
//
// prf.invoices dan prf.lines dibangun dari pilihan yang sama (openPrf: `lines =
// chosen.map(...)`, `invoices: chosen.map(i => i.no)`), jadi hari ini keduanya
// selalu cocok. Tapi baris tabel ini SUDAH pernah disunting tangan langsung di
// Supabase — begitulah PRF/PC/VIII/083 diperbaiki — dan sesudah itu tidak ada
// lagi yang menjamin keduanya sama. Sebuah PRF dengan `invoices: []` tapi
// `lines` terisi akan lolos dari pemeriksa yang cuma melihat `invoices`, dan
// lolos diam-diam adalah persis cara PRF/PC/VIII/083 bertahan berhari-hari.
function nomorDisebut(prf) {
  const dari = Array.isArray(prf && prf.invoices) ? prf.invoices.map(String) : [];
  const baris = Array.isArray(prf && prf.lines) ? prf.lines.map(l => String(l && l.no)) : [];
  return [...new Set([...dari, ...baris].filter(x => x && x !== 'undefined' && x !== 'null'))];
}

/**
 * Membandingkan nominal PRF dengan jumlah invoice yang sekarang.
 * Mengembalikan { adaMasalah, sumInvoice, beda, hilang, tercatat }.
 *
 *   sumInvoice  jumlah amount invoice yang nomornya tercantum di PRF, HARI INI
 *   beda        prf.amount - sumInvoice (positif = PRF kelebihan)
 *   hilang      nomor invoice yang tercantum di PRF tapi tidak ada lagi
 *   tercatat    prf.amount apa adanya
 *
 * Invoice yang HILANG dilaporkan terpisah dan TIDAK dianggap nol. Sebuah
 * invoice yang lenyap membuat jumlahnya mengecil, dan selisih yang lahir dari
 * baris yang tidak ada lagi bukan selisih nominal — itu masalah yang berbeda,
 * dan menyamakan angkanya justru akan menyembunyikannya.
 */
export function selisihPrf(prf, semuaInvoice) {
  // DAFTAR INVOICE KOSONG BERARTI KITA TIDAK TAHU APA-APA, BUKAN BAHWA
  // SEMUANYA LENYAP.
  //
  // fetchInvoices() dipanggil sekali saat login lewat Promise.allSettled, dan
  // kalau ia gagal, st.invoices tetap array kosong sementara st.prfs terisi
  // penuh. Tanpa penjaga ini SETIAP PRF akan menyala merah dengan tulisan
  // "invoice tidak ada lagi" — layar penuh peringatan palsu, tepat pada layar
  // yang peringatan merahnya baru saja dibuat supaya dipercaya. Peringatan
  // yang pernah berbohong sekali berhenti dibaca selamanya.
  //
  // Tabel invoice yang benar-benar kosong sementara PRF-nya ada tidak mungkin
  // lahir dari portal ini: PRF dibangun dari invoice yang dicentang.
  if (!Array.isArray(semuaInvoice) || semuaInvoice.length === 0) {
    const t0 = Number(prf && prf.amount);
    return { adaMasalah: false, sumInvoice: 0, beda: 0, hilang: [], tercatat: Number.isFinite(t0) ? t0 : 0 };
  }
  const nomor = nomorDisebut(prf);
  const peta = petaInvoice(prf, semuaInvoice);
  const hilang = [];
  let sumInvoice = 0;
  // Dijumlahkan dari prf.invoices saja — itu daftar resminya. prf.lines cuma
  // ikut dipakai untuk MENCARI yang hilang, karena baris yang menyebut invoice
  // tak dikenal adalah kelainan yang harus terlihat, bukan angka yang harus
  // ikut dijumlahkan.
  const resmi = Array.isArray(prf && prf.invoices) ? prf.invoices.map(String) : [];
  for (const no of resmi) {
    const inv = peta.get(no);
    if (!inv) continue;
    const n = Number(inv.amount);
    sumInvoice += Number.isFinite(n) ? n : 0;
  }
  for (const no of nomor) if (!peta.has(no)) hilang.push(no);
  const tercatat = Number(prf && prf.amount);
  const beda = (Number.isFinite(tercatat) ? tercatat : 0) - sumInvoice;
  // Dibandingkan pada SEN, bukan pada bit. Dua angka yang berbeda 0,000001
  // karena float bukan perbedaan yang dimiliki siapa pun.
  const bedaNyata = Math.abs(Math.round(beda * 100)) > 0;
  return {
    adaMasalah: (nomor.length > 0) && (bedaNyata || hilang.length > 0),
    sumInvoice,
    beda,
    hilang,
    tercatat: Number.isFinite(tercatat) ? tercatat : 0,
  };
}

/**
 * Nilai PRF kalau ia disamakan dengan invoicenya HARI INI. Murni, tanpa
 * jaringan, tanpa efek samping.
 *
 * Dipisah supaya jalur server dan jalur lokal (portal tanpa Supabase) memanggil
 * SATU hitungan yang sama. Dua hitungan yang "kelihatannya sama" adalah cara
 * angka ketiga lahir, dan angka ketiga itu persis yang membuat modul ini ada.
 */
export function nilaiSamaDenganInvoice(prf, semuaInvoice) {
  const s = selisihPrf(prf, semuaInvoice);
  const peta = petaInvoice(prf, semuaInvoice);
  const lines = (Array.isArray(prf && prf.lines) ? prf.lines : []).map(l => {
    const inv = peta.get(String(l && l.no));
    return inv ? { ...l, amount: Number(inv.amount) } : l;
  });
  return { amount: s.sumInvoice, lines, sebelumnya: s.tercatat, cek: s };
}

// Total dan rincian harus menjumlah ke angka yang sama. Dilanggar berarti PRF
// yang tercetak meminta satu angka sementara baris-barisnya menjumlah ke angka
// lain — dan pembacanya, finance, akan menemukannya di kertas.
function barisMenjumlahKeTotal(nilai) {
  if (!Array.isArray(nilai.lines) || !nilai.lines.length) return true;
  const jml = nilai.lines.reduce((s, l) => s + (Number(l && l.amount) || 0), 0);
  return Math.round(jml * 100) === Math.round(nilai.amount * 100);
}

/**
 * Menyamakan PRF dengan invoicenya. TIDAK menerima angka dari pemanggil —
 * satu-satunya nilai yang bisa ditulisnya adalah jumlah invoice yang sekarang.
 *
 * Itu disengaja: sebuah kotak isian bisa melahirkan angka ketiga yang tidak
 * dimiliki invoice MAUPUN PRF, dan angka ketiga itu persis yang membuat kita
 * berada di sini. Fungsi ini cuma bisa membuat dua angka yang sudah ada
 * menjadi sama.
 */
export async function samakanPrfDenganInvoice(prf, semuaInvoice) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const s = selisihPrf(prf, semuaInvoice);
  if (!s.adaMasalah) return null;
  if (s.hilang.length) throw new Error(`invoice tidak ditemukan: ${s.hilang.join(', ')}`);

  const nilai = nilaiSamaDenganInvoice(prf, semuaInvoice);
  if (!barisMenjumlahKeTotal(nilai)) {
    throw new Error(`rincian tidak menjumlah ke total (${nilai.lines.length} baris) — tidak ditulis`);
  }
  assertWrote(
    await c.from('prfs').update({ amount: nilai.amount, lines: nilai.lines }).eq('id', prf.id).select('id'),
    'samakan PRF dengan invoice',
  );
  return { amount: nilai.amount, lines: nilai.lines, sebelumnya: nilai.sebelumnya };
}
