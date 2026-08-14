// Formatting helpers: currency, numbers, dates, roman months.

export function num(n, dp = 0) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// SEMUA MATA UANG DICETAK DUA DESIMAL, TERMASUK RUPIAH, TERMASUK KALAU NOL.
//
// Sampai 14 Agu 2026 rupiah dipatok NOL desimal, dan itu bukan sekadar gaya —
// itu menyembunyikan sen. `935.383.680,50` tercetak `935,383,681`, dan yang
// membacanya tidak punya cara tahu ada yang hilang. Kwitansi pemasok sendiri
// menulis "RUPIAH KOMA NOL SENT": rupiah PUNYA sen di dokumen yang kita bayar,
// jadi berpura-pura tidak punya adalah kita yang salah, bukan dokumennya.
//
// `,00` sengaja tetap dicetak walau nol. Permintaan Kyaru, dan alasannya benar:
// kalau desimal cuma muncul kadang-kadang, ketiadaannya jadi ambigu — pembaca
// tidak bisa membedakan "memang bulat" dari "desimalnya disembunyikan". Angka
// yang selalu berbentuk sama bisa dibandingkan sekilas; angka yang bentuknya
// berubah-ubah harus dibaca dua kali.
export const CURRENCIES = ['IDR', 'USD', 'EUR', 'CNY'];
export function ccyDecimals() { return 2; }
// Badge colour per currency. Lives here rather than inside payment.js because
// Master Data shows the same badge and two copies would drift apart.
export function ccyTone(c) { return { USD: 'accent', EUR: 'blue', CNY: 'amber', IDR: 'navy' }[c] || 'gray'; }

// ---------------------------------------------------------------------------
// PPN — single source of truth.
//
// There are TWO vocabularies in this codebase and mixing them up silently
// zeroes the tax:
//   FORM values   : 'bayar' | 'kek'        <- radio/select in the PO modals
//   DOMAIN values : 'paid'  | 'suspended'  <- what's stored on po.ppnMode and
//                                             in the pos.ppn_mode column
// Producers normalise form -> domain at creation (labelRequest/poConverter).
// Anything reading po.ppnMode must compare against the DOMAIN values, and
// should call this helper instead of re-implementing the comparison.
//
// Regression this guards: approval.js's computeTotals() used to test
// `ppnMode === 'bayar'`, which is never true for a stored PO, so every PO
// edit rewrote ppn to 0 while the printed document (which recomputed the
// tax correctly from 'paid') still showed the full amount.
// ---------------------------------------------------------------------------
export const PPN_RATE = 0.11;

// PPN TIDAK DIBULATKAN KE RUPIAH PENUH LAGI.
//
// Dulu `Math.round(subtotal * 0.11)`, jadi setiap PO ber-PPN menyimpan angka
// yang berbeda dari invoice pemasoknya hingga setengah rupiah — dan yang
// dibayar harus PERSIS sama dengan yang ditagih. Sekarang dibulatkan ke SEN,
// bukan ke rupiah: itu bukan pembulatan uang, itu membuang derau float.
// `842.688.000 * 0.11` di IEEE-754 menghasilkan ekor seperti
// `92695680.00000001`, dan ekor itu kalau ditumpuk lewat penjumlahan akan
// muncul sebagai selisih satu sen yang tidak dimiliki siapa pun. Dua desimal
// adalah presisi yang dipakai dokumennya, jadi itu presisi yang kita simpan.
export function ppnFor(subtotal, ppnMode) {
  if (ppnMode !== 'paid') return 0;
  const n = (Number(subtotal) || 0) * PPN_RATE;
  return Math.round(n * 100) / 100;
}
// Convert the form value to the stored domain value. Use at creation time.
export function ppnModeFromForm(formValue) { return formValue === 'bayar' ? 'paid' : 'suspended'; }

// Currency amount. Never mixes currencies in one sum.
export function money(amount, ccy = 'IDR') {
  if (amount == null || isNaN(amount)) return '—';
  return `${ccy} ${num(amount, ccyDecimals(ccy))}`;
}

// Sum `amountKey` per currency across records — never merges currencies into one number.
export function sumByCurrency(records, amountKey = 'amount', ccyKey = 'currency') {
  const totals = {};
  for (const r of records || []) {
    const ccy = r[ccyKey] || 'IDR';
    totals[ccy] = (totals[ccy] || 0) + (r[amountKey] || 0);
  }
  return totals;
}

// Render a per-currency totals map (from sumByCurrency) as "IDR 1,000 + USD 50.00".
export function moneyMulti(totals) {
  const parts = Object.keys(totals).filter(c => totals[c]).map(c => money(totals[c], c));
  return parts.length ? parts.join(' + ') : money(0, 'IDR');
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function romanMonth(d = new Date()) { return ROMAN[d.getMonth()]; }

// Next sequence number for a monthly-resetting doc number scheme, e.g.
// "PRF/PC/VII/003" or "PC/SJ/VII/012" — scans `records` (must have `.no` and
// `.createdAt`) for entries whose `no` starts with `prefix` (which already
// embeds the current roman month) AND whose createdAt falls in the current
// calendar year, takes the max existing trailing seq, and adds 1. Falls back
// to 1 when none exist yet this month — this is what makes numbering actually
// reset at the start of each month instead of running off array length.
export function nextMonthlySeq(records, prefix, d = new Date()) {
  const year = d.getFullYear();
  let max = 0;
  for (const r of records || []) {
    if (!r || !r.no || !String(r.no).startsWith(prefix)) continue;
    const created = new Date(r.createdAt);
    if (isNaN(created) || created.getFullYear() !== year) continue;
    const m = String(r.no).slice(prefix.length).match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')} ${MONTHS_ID[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtDateTime(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${fmtDate(dt)} ${hh}:${mm}`;
}

// Days until (negative = overdue).
export function daysUntil(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const ms = dt.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function addDays(d, days) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

// Supplier default-TOP options — single source of truth (Master Data's
// supplier form is the only place this list is used; keep it that way rather
// than retyping it anywhere else that might need a TOP value).
// 90 days was missing, and it is the term most of Kyaru's overseas suppliers
// actually use — "PAYMENT TERMS: T/T 90 DAYS AFTER INVOICE DATE" appears on
// five of the eight readable invoices. Without it the closest choice was 60,
// which puts every one of those invoices a month early in the due-date column.
export const TOP_OPTIONS = ['Bayar di muka', '3 hari', '14 hari', '30 hari', '45 hari', '60 hari', '90 hari', 'T/T 45 days B/L'];

// Parse a TOP string ("30 hari", "45 days", "T/T 45 days B/L", "60") -> integer days.
// Only used for the SUPPLIER master's `top` field, whose values all come from
// TOP_OPTIONS above, so the loose "first number anywhere" match is safe here.
export function topDays(top) {
  if (top == null) return 30;
  // "Bayar di muka" is paid BEFORE the goods move, so it is zero days — not the
  // 30-day default it used to fall through to, which dated every advance-payment
  // invoice a month late and put it in the wrong week of the due-date report.
  // poTermDays() below already treats the same phrase as "not a day count";
  // this is the supplier-master half of the same fact.
  if (/bayar\s*di\s*muka|in\s*advance|prepaid|cash\s*in\s*advance|^cia$/i.test(String(top).trim())) return 0;
  const m = String(top).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

// ---------------------------------------------------------------------------
// Payment term for a PO -> integer days, or null when the term isn't a day
// count at all ("Payment in Advance" / "Bayar di muka").
//
// Deliberately anchored to the START of the string. po.terms is FREE TEXT that
// embeds the contract number, e.g.
//     "45 days after B/L — ref CGDD2509220096"
// A loose /(\d+)/ match on a term with no leading day count would skip past
// the words and return 2509220096 — the contract number — which then printed
// on the sealed Purchase Contract as "2509220096 days after Invoice".
// Returning null (instead of defaulting to 30) forces the caller to render the
// real clause rather than inventing a term nobody agreed to.
// ---------------------------------------------------------------------------
// Accepted shapes (all anchored at the start):
//   "45 days after B/L — ref CGDD2509220096"  -> 45   (PO Converter)
//   "30 hari setelah invoice"                 -> 30   (Label Request)
//   "TOP 45"                                  -> 45   (Edit PO modal)
//   "Payment in Advance — ref CGDD…"          -> null
//   "Bayar di muka"                           -> null
export function poTermDays(terms) {
  const raw = String(terms == null ? '' : terms).trim();
  // "T/T 45 days after B/L date" is a first-class shape here — it's in
  // TOP_OPTIONS and in seed.js. Anchoring without allowing the T/T prefix made
  // every existing T/T contract fall through to null, and documents.js then
  // printed "Payment in Advance" on a chopped 45-day contract.
  const m = raw.match(/^(?:TOP|T\/T)?\s*(\d{1,3})\s*(?:hari|days?)?\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Is this term explicitly a prepayment? Separate from poTermDays() returning
// null, which only means "no day count found" — those are NOT the same thing
// and collapsing them printed prepayment terms onto legacy contracts.
export function isAdvanceTerm(terms) {
  return /^\s*(payment\s+in\s+advance|bayar\s+di\s+muka|prepay(ment)?|advance\s+payment)\b/i
    .test(String(terms == null ? '' : terms));
}

// Fuzzy-ish string similarity (0..1), used for payee matching.
export function similarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / Math.max(ta.size, tb.size);
}

export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/\b(PT|CV|CO|LTD|LIMITED|TBK|PERSERO|COMPANY|INC)\b/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * TOTAL SEKUMPULAN DOKUMEN, DIPISAH PER MATA UANG.
 *
 * Dipakai label tombol Approve massal. Menjumlahkan IDR dan USD jadi satu angka
 * menghasilkan bilangan yang terbaca meyakinkan dan tidak berarti apa pun —
 * kesalahan sekelas menggabungkan tiga hitungan sisa di Kas Label. Antrean
 * approval memang bisa memuat PO dengan mata uang berbeda.
 *
 * Nol baris -> string kosong, bukan "IDR 0": nol yang diberi label mata uang
 * terbaca sebagai jumlah yang benar-benar nol rupiah.
 */
export function totalPerMataUang(rows) {
  const per = {};
  (rows || []).forEach(r => {
    const c = (r && r.currency) || 'IDR';
    const n = Number(r && r.total);
    per[c] = (per[c] || 0) + (Number.isFinite(n) ? n : 0);
  });
  return Object.keys(per).sort().map(c => money(per[c], c)).join(' · ');
}
