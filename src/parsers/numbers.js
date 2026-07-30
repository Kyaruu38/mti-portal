// Locale-aware numeric parsing for scraped document text.
//
// WHY THIS EXISTS
// ---------------
// Both bankProof.js and ppkekPdf.js used to numify with:
//     Number(String(v).replace(/[,\s]/g, '')) || 0
// which strips commas and spaces but NOT dots. Every document those two
// parsers read is Indonesian-formatted (dot = thousands, comma = decimal), so:
//     "2.862.720.000,00"  ->  Number("2.862.720.000,00")  ->  NaN  ->  0
//     "15.850,00"         ->  15.85          (kurs off by 1000x)
//     "45.362.500"        ->  0
// The `|| 0` turned every failure into a silent, plausible-looking zero.
//
// Rules here are deliberately explicit, and failure returns NaN — never 0 —
// so callers must decide what to do rather than shipping a wrong number into
// a payment record or a customs register.

// Detect which character is the DECIMAL separator.
//   both present  -> whichever appears last
//   only ','      -> thousands iff it forms strict 3-digit groups, else decimal
//   only '.'      -> thousands iff it forms strict 3-digit groups, else decimal
// The strict-group test is what disambiguates "17,000" (=17000, grouped) from
// "16,50" (=16.5, decimal) and "45.362.500" (=45362500) from "1.234567".
function decimalSepOf(s) {
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) return lastComma > lastDot ? ',' : '.';
  if (lastComma >= 0) return /^\d{1,3}(,\d{3})+$/.test(s) ? null : ',';
  if (lastDot >= 0) return /^\d{1,3}(\.\d{3})+$/.test(s) ? null : '.';
  return null;
}

/**
 * Parse a number out of scraped text.
 * @param {*} value        raw string (may carry currency words, spaces, sign)
 * @param {string} locale  'auto' (default) | 'id' | 'en'
 * @returns {number}       the value, or NaN if nothing parseable was found
 */
export function parseNumber(value, locale = 'auto') {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;

  // Keep digits, separators and a leading sign. Strips "IDR", "Rp", spaces,
  // non-breaking spaces and any stray letters the PDF text layer picked up.
  let s = String(value).replace(/[\s  ]/g, '');
  // Normalise the Unicode dashes a PDF text layer routinely emits (U+2212 MINUS
  // and friends), and accept a TRAILING sign — Indonesian bank and ERP
  // statements print "1.000-". Both used to survive the [^\d.,] strip below and
  // silently yield a POSITIVE number.
  s = s.replace(/[−‒–—―]/g, '-');
  const negative = /^-/.test(s) || /-$/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;

  let dec;
  if (locale === 'id') dec = s.includes(',') ? ',' : null;
  else if (locale === 'en') dec = s.includes('.') ? '.' : null;
  else dec = decimalSepOf(s);

  let out;
  if (dec === null) {
    out = s.replace(/[.,]/g, '');                 // pure grouping
  } else {
    const group = dec === ',' ? '.' : ',';
    out = s.split(group).join('').replace(dec, '.');
    // A second decimal separator means the string was malformed; bail loudly
    // rather than silently truncating.
    if ((out.match(/\./g) || []).length > 1) return NaN;
  }

  const n = Number(out);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/**
 * Same parse, but returns `fallback` instead of NaN. Use ONLY where a missing
 * value is genuinely harmless (an optional display field) — never for money.
 */
export function parseNumberOr(value, fallback = 0, locale = 'auto') {
  const n = parseNumber(value, locale);
  return Number.isNaN(n) ? fallback : n;
}
