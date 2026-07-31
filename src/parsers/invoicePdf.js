// Rule-based reader for supplier COMMERCIAL INVOICE PDFs.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT
// -----------------------------------------------------------------------------
// It pre-fills the Add Invoice form. It does not create invoices. Every field it
// produces is shown to a human who presses Save, because the number it fills
// eventually becomes a PRF and then a bank transfer — the one place in this
// portal where a confidently wrong figure costs real money.
//
// So the contract is: RECOGNISED -> fill and mark it as coming from the PDF.
// NOT RECOGNISED -> leave blank. There is no third behaviour. A blank field
// costs someone twenty seconds of typing; a plausible wrong one costs a payment.
//
// TWO KINDS OF PDF
// -----------------------------------------------------------------------------
// Of the seventeen real supplier invoices in Kyaru's PPKEK bundles, NINE contain
// zero characters — they are photographs of paper, and no amount of pattern
// matching reaches inside an image. Those return { scanned: true } and fill
// nothing. The other eight are readable, and no two suppliers write the same
// way:
//
//     R1 International   INVOICE NO. SGS-000016481B          (no colon)
//     Haichao            INVOICE NO.: IN-HC-90087765         (colon)
//     Britz Networks     INVOICE NO.   BN306031              (spaces)
//     Zhongce            INVOICE NO.：   20260703/ZCIN27298-1Z  (full-width colon)
//
// Hence the patterns below are deliberately loose about punctuation and tight
// about the ANCHOR WORD — per Kyaru: the colon does not matter, start reading at
// the number. "Faktur" is the same document in Indonesian and is matched too.

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';

// Anchor on "INVOICE NO" / "FAKTUR NO" / "NO. INVOICE", then take the next
// token. [:：] optional — full-width colon included, since half these suppliers
// type on a Chinese keyboard. The token must be at least 4 characters so a
// stray "1" or ":" can never become an invoice number.
const NO_PATTERNS = [
  /\b(?:INVOICE|FAKTUR)\s*(?:NO|NUMBER|NUMBER|NUM)\b\.?\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9\/\-_.]{3,})/i,
  /\bNO\.?\s*(?:INVOICE|FAKTUR)\b\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9\/\-_.]{3,})/i,
  /\b(?:INVOICE|FAKTUR)\s*[#]\s*([A-Za-z0-9][A-Za-z0-9\/\-_.]{3,})/i,
];

// Issue date. Only formats where the day, month and year are all present and
// unambiguous enough to place — a bare "07/2026" is not a date this will guess.
const DATE_PATTERNS = [
  /\b(?:DATE|TANGGAL|TGL)\b\s*[:：]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/i,
  /\b(?:DATE|TANGGAL|TGL)\b\s*[:：]?\s*(\d{1,2}[-\s]?[A-Za-z]{3,}[-\s]?\d{2,4})/i,
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };

// Payment terms, so the DUE date can be derived rather than typed:
//     PAYMENT TERMS: T/T 90 DAYS AFTER INVOICE DATE
//     PAYMENT TERM : D/A 30 DAYS AFTER BL DATE
// Only "after invoice date" is used. "After BL date" counts from the bill of
// lading, which is not in this document, so deriving from it would be a guess.
const TERM_RE = /(?:PAYMENT\s*TERMS?|TOP|TERMIN)\b[^\n]{0,40}?(\d{1,3})\s*(?:DAYS?|HARI)([^\n]{0,30})/i;

const CCY_RE = /\b(USD|CNY|RMB|EUR|IDR|SGD|JPY)\b/;

// The total. Anchored to the word, and the number must sit on the SAME line —
// an unanchored search finds the first number anywhere and calls it the total.
const TOTAL_RE = /\b(?:TOTAL|GRAND\s*TOTAL|AMOUNT\s*DUE)\b[^\d\n]{0,24}([\d][\d.,]{2,})/i;

function toIso(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (m) {
    // DD-MM-YYYY. Indonesian customs and every supplier here write day first;
    // a value above 12 in the first position confirms it, and none of the
    // sample documents use month-first.
    let [, d, mo, y] = m;
    if (Number(mo) > 12) [d, mo] = [mo, d];
    if (Number(d) > 31 || Number(mo) > 12) return '';
    y = y.length === 2 ? `20${y}` : y;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[-\s]?([A-Za-z]{3,})[-\s]?(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return '';
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

function addDaysIso(iso, days) {
  if (!iso || !days) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {File} file        the dropped PDF
 * @param {Array} suppliers  master supplier list, for name matching
 * @returns {{scanned:boolean, no:string, date:string, due:string, termDays:number,
 *            currency:string, amount:number, supplierId:string, found:string[]}}
 *          `found` lists which fields came from the PDF — the screen uses it to
 *          mark them, so nothing filled here can pass as something a person typed.
 */
export async function parseInvoicePdf(file, suppliers = []) {
  const out = { scanned: false, no: '', date: '', due: '', termDays: 0, currency: '', amount: 0, supplierId: '', found: [] };
  let text = '';
  try {
    const pdf = await extractPdf(file);
    text = pdf.text || '';
  } catch (e) {
    console.warn('invoice parse skipped:', e);
    return out;
  }

  // A page with no text layer is a scan. Not a failure, and worth saying so:
  // "this one cannot be read" is different information from "nothing matched".
  if (text.replace(/\s/g, '').length < 40) { out.scanned = true; return out; }

  for (const re of NO_PATTERNS) {
    const m = text.match(re);
    // "INVOICE" and "NO" both appear in prose ("THIS INVOICE IS FOR CUSTOMS
    // DECLARATION PURPOSE ONLY"), so reject a capture that is a plain word.
    if (m && !/^[A-Za-z]+$/.test(m[1])) { out.no = m[1].replace(/[.,;]+$/, ''); out.found.push('no'); break; }
  }

  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    const iso = m ? toIso(m[1]) : '';
    if (iso) { out.date = iso; break; }
  }

  const term = text.match(TERM_RE);
  if (term) {
    // "90 DAYS AFTER BL DATE" counts from a date this document does not carry.
    const tail = (term[2] || '').toUpperCase();
    if (!/\bB\/?L\b|BILL\s*OF\s*LADING/.test(tail)) out.termDays = Number(term[1]) || 0;
  }
  if (out.date && out.termDays) { out.due = addDaysIso(out.date, out.termDays); if (out.due) out.found.push('due'); }

  const total = text.match(TOTAL_RE);
  if (total) {
    const n = parseNumber(total[0].slice(total[0].search(/[\d]/)), 'auto');
    if (Number.isFinite(n) && n > 0) {
      out.amount = n;
      out.found.push('amount');
      // Currency from the SAME line as the total, never from anywhere on the
      // page: these documents print the supplier's own bank currency further
      // down ("ACC NO.:1202021109016209761 (RMB)") and reading that would
      // label a USD invoice as CNY.
      const line = (text.split('\n').find(l => l.includes(total[0].trim())) || total[0]);
      const c = line.toUpperCase().match(CCY_RE);
      if (c) { out.currency = c[1] === 'RMB' ? 'CNY' : c[1]; out.found.push('currency'); }
    }
  }

  // Supplier, only when the answer is unambiguous. A master name that appears
  // in the text identifies the sender; TWO matching names means the document
  // mentions someone else as well (a forwarder, a notify party) and the guess
  // is dropped rather than resolved by picking one.
  const up = text.toUpperCase();
  const hits = suppliers.filter(s => s.name && s.name.length > 6 && up.includes(String(s.name).toUpperCase()));
  if (hits.length === 1) { out.supplierId = hits[0].id; out.found.push('supplier'); }

  return out;
}
