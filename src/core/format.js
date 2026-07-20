// Formatting helpers: currency, numbers, dates, roman months.

export function num(n, dp = 0) {
  if (n == null || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// Supported currencies. IDR shows no decimals; USD/EUR/CNY show 2.
export const CURRENCIES = ['IDR', 'USD', 'EUR', 'CNY'];
export function ccyDecimals(ccy) { return ccy === 'IDR' ? 0 : 2; }

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
export const TOP_OPTIONS = ['Bayar di muka', '3 hari', '14 hari', '30 hari', '45 hari', '60 hari', 'T/T 45 days B/L'];

// Parse a TOP string ("30 hari", "45 days", "T/T 45 days B/L", "60") -> integer days.
export function topDays(top) {
  if (top == null) return 30;
  const m = String(top).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
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
