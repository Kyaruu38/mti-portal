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
// EVERY SUPPLIER'S LAYOUT IS DIFFERENT
// -----------------------------------------------------------------------------
// That is the design constraint, not an edge case. In Kyaru's own samples:
//
//   Haichao (new)   one item line, NO total row anywhere on the page
//   Haichao (old)   same house style, different column x positions
//   Britz Malaysia  SALES ORDER NO., a real "TOTAL USD" row at the foot
//   Zhongce         no Latin total row at all — the total row says 汇总
//   R1 Singapore    "VALUE OF GOODS" and "TOTAL", and a letterhead postcode
//                   that looks exactly like a purchase-order number
//
// Nothing here may assume a fixed position, a fixed label, or that a total row
// exists. What every one of them DOES have is a column of money under a header
// that says AMOUNT — so that is what this reads.
//
// WHY THIS READS GEOMETRY AND NOT FLATTENED TEXT
// -----------------------------------------------------------------------------
// The first version matched patterns against pdf.js's flattened text and filled
// almost nothing on a real Haichao invoice. The document itself said why:
//
//     y=300  x=222  "HC-TSLT-ZCYN20260112GZ-1"
//     y=299  x=77   "CONTRACT NO:"
//
// A label and its value one y-unit apart, emitted as two separate lines — with
// the VALUE first, because the flattener sorts by descending y. Every anchored
// pattern looked on the label's line and found an empty tail. Payment terms did
// the same thing (y=253 label, y=252 value), which is why "T/T 90 DAYS AFTER
// INVOICE DATE" never produced a due date.
//
// And the invoice number arrives in pieces:
//
//     x=363 "IN-"   x=381 "HC-"   x=402 "TSLT-ZCYN20260112GZ-4"
//
// Three text runs of one field. Joined with spaces they read "IN- HC- TSLT-…",
// which matched nothing; joined with nothing they read IN-HC-TSLT-ZCYN…-4,
// which is the number printed on the paper.
//
// So: BAND rows by y (a few units of tolerance), sort by x inside the band, and
// rejoin fragments that a trailing hyphen shows were split mid-token. This is
// the same correction the PPKEK attachment-sheet parser needed, for the same
// reason — a PDF has no rows, only ink at coordinates.
//
// TWO KINDS OF PDF
// -----------------------------------------------------------------------------
// Of the seventeen invoices in Kyaru's PPKEK bundles, NINE contain zero
// characters — photographs of paper, which no amount of pattern matching
// reaches inside. Those return { scanned: true } and fill nothing.

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';

// Rows within this many PDF units of each other are the same visual line. Wide
// enough for the 1-unit label/value split above and for baseline jitter between
// fonts on one row; far narrower than the ~15-unit gap between real rows in
// every sample document.
const BAND = 4;

// A number sitting this far from a column header still belongs to that column.
// Headers are centred over their data, so a value is rarely more than a cell
// away; the tightest column pair in the samples (UNIT PRICE at x=436 vs AMOUNT
// at x=507) is 71 apart, so 55 cannot reach from one into the other.
const COL = 55;

const CCY = { USD: 'USD', CNY: 'CNY', RMB: 'CNY', EUR: 'EUR', IDR: 'IDR', SGD: 'SGD', JPY: 'JPY' };

// "TOTAL" in the languages these suppliers actually print. 汇总 / 合计 are
// Zhongce's — their invoice has no Latin total row at all, so without these the
// only readable figure on a five-million document would be an item line.
const TOTAL_WORD = /\b(?:GRAND\s*TOTAL|TOTAL\s*AMOUNT|AMOUNT\s*DUE|TOTAL|VALUE\s*OF\s*GOODS)\b|汇总|合计|总计/i;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// Group a page's text runs into visual rows. Returns [{ y, parts:[{str,x}] }]
// top-down, each row's parts left-to-right.
function bandRows(page) {
  const items = [];
  for (const line of page.lines || []) {
    for (const p of line.parts || []) {
      const s = String(p.str || '');
      if (!s.trim()) continue;
      items.push({ str: s, x: p.x, y: line.y });
    }
  }
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of items) {
    const row = rows.find(r => Math.abs(r.y - it.y) <= BAND);
    if (row) row.parts.push(it);
    else rows.push({ y: it.y, parts: [it] });
  }
  for (const r of rows) r.parts.sort((a, b) => a.x - b.x);
  return rows;
}

// Join a row's fragments back into readable text. A fragment ending in "-" was
// split mid-token by the PDF writer ("IN-" + "HC-" + "TSLT-…"), so it takes no
// separator; everything else takes a space.
function rowText(parts) {
  let out = '';
  for (const p of parts) {
    const s = p.str.trim();
    if (!s) continue;
    if (!out) { out = s; continue; }
    out += (/-$/.test(out) ? '' : ' ') + s;
  }
  return out.replace(/\s+/g, ' ').trim();
}

const NUM_RE = /^[\d][\d.,]*$/;

// EVERY plausible numeric reading of one printed token, because "0.612" has
// two of them.
//
// parseNumber(_, 'auto') reads a dot followed by exactly three digits as an
// Indonesian THOUSANDS separator — correct on the customs forms it was written
// for, and wrong on a supplier's unit price. It turned 0.612 USD/KG into 612,
// which made 41600 x price disagree with the printed 25459.20, so the
// cross-check refused the whole amount. It refused correctly: two readings
// disagreed. The mistake was upstream, in insisting on ONE reading of a token
// that genuinely has two.
//
// So the cross-check is given both and passes if EITHER agrees. That is not a
// weaker check — the amount still has to be confirmed by an independent
// quantity x price. It just stops a formatting convention from deciding it.
function readings(s) {
  const t = String(s).trim();
  const out = [];
  const push = (n) => { if (Number.isFinite(n) && !out.includes(n)) out.push(n); };
  push(parseNumber(t, 'auto'));
  // Dot-as-decimal, comma-as-thousands: what every sample invoice actually
  // uses (64,960.00 / 1,160.00 / 443,520.00).
  if (!/,\d{1,2}$/.test(t)) push(Number(t.replace(/,/g, '')));
  return out;
}

// Numeric cells of a row, with the x they were printed at. `n` is the primary
// reading; `all` keeps the alternatives for the cross-check.
function numbersIn(row) {
  return row.parts
    .filter(p => NUM_RE.test(p.str.trim()))
    .map(p => ({ x: p.x, raw: p.str.trim(), all: readings(p.str) }))
    .filter(c => c.all.length)
    .map(c => ({ ...c, n: c.all[0] }));
}

// ---------------------------------------------------------------------------
// Field patterns. Loose about punctuation (half- and full-width colons both
// appear, and several suppliers use none), strict about the anchor word.
// ---------------------------------------------------------------------------

const NO_RE = /\b(?:INVOICE|FAKTUR)\s*(?:NO|NUMBER|NUM)\b\.?\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,})/i;
const NO_RE_ALT = /\bNO\.?\s*(?:INVOICE|FAKTUR)\b\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,})/i;

// PO / contract reference. The NO token is REQUIRED and the value must contain
// a digit, because without both this reads an address: R1's letterhead ends
// "Singapore 048693", and a looser pattern took that postcode for a purchase
// order. Haichao's street address ends "NORTH POINT HK", where a bare "PO"
// matched inside the word POINT.
const PO_RE = /\b(?:CONTRACT|SALES\s*ORDER|PURCHASE\s*ORDER|ORDER|P\/?O|S\/C)\s*(?:NO|NUMBER)\b\.?\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,})/i;

const DATE_RE = /\b(?:DATE|TANGGAL|TGL)\b\s*[:：]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-\s]?[A-Za-z]{3,}[-\s]?\d{2,4})/i;

// Terms, now that the label and its value land on one banded row:
//     PAYMENT TERMS: T/T 90 DAYS AFTER INVOICE DATE
//     PAYMENT TERM : D/A 30 DAYS AFTER BL DATE
const TERM_RE = /(?:PAYMENT\s*TERMS?|TOP|TERMIN)\b[^\n]{0,48}?(\d{1,3})\s*(?:DAYS?|HARI)([^\n]{0,32})/i;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };

// DAY FIRST. Not a coin flip — it is what every unambiguous sample says. Britz
// prints 14/07/2026 (14 cannot be a month), Zhongce prints "3-Jul-26" against
// its own invoice number 20260703, and Haichao's 02-06-2026 sits six days
// before the 20260608 inside its own invoice number. Not one document in the
// corpus is month-first.
//
// A date like 2/9/2026 still cannot be PROVEN either way from the page alone,
// so `dateAmbiguous` is reported and the screen says so out loud. With 90-day
// terms, reading 2 September as 9 February moves a payment by seven months.
function toIso(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
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

// True when BOTH readings of a numeric date are real dates, so the page alone
// cannot settle it. 14/07 is unambiguous; 2/9 is not; 5/5 does not matter.
function ambiguousDate(raw) {
  const m = String(raw || '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/);
  return !!m && Number(m[1]) <= 12 && Number(m[2]) <= 12 && m[1] !== m[2];
}

function addDaysIso(iso, days) {
  if (!iso || !days) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The money. Read from the AMOUNT COLUMN, and trusted only when a second,
// independent reading of the same page agrees with it.
// ---------------------------------------------------------------------------
//
// Anchoring on the word "TOTAL" is not enough on its own: Zhongce's total row
// is Chinese, and the new Haichao layout has no total row at all — one item
// line and nothing else. Anchoring on the column works on both, and gives the
// cross-check for free, because QUANTITY and UNIT PRICE are columns on the
// same page.
//
// The cross-check is the safety property. A figure is filled only when the
// AMOUNT column and quantity x unit price agree. When they disagree the field
// is left BLANK — a disagreement means one of the two readings is wrong and
// there is no way to tell which, so filling either is a coin flip with money.
function readAmount(rows) {
  const out = { amount: 0, currency: '', how: '' };
  const isAmountCell = (s) => /^\(?AMOUNT\)?$/i.test(s.trim()) || /金\s*额/.test(s);

  const hIdx = rows.findIndex(r => r.parts.some(p => isAmountCell(p.str)));
  // Not every invoice is a table. R1's reads as a form — "VALUE OF GOODS" and
  // "TOTAL" as labels with a figure beside each, no AMOUNT column anywhere.
  // Falling back to the total rows is what makes that layout readable, and the
  // two rows agreeing with each other is its own cross-check.
  if (hIdx < 0) return totalRowsOnly(rows);
  const header = rows[hIdx];
  const amtX = header.parts.find(p => isAmountCell(p.str)).x;

  // Column headers can wrap onto the next row ("UNIT PRICE" above, "(USD/KG)"
  // below), so look a couple of rows past the AMOUNT header too.
  const colOf = (re) => {
    for (const r of rows.slice(Math.max(0, hIdx - 2), hIdx + 3)) {
      const p = r.parts.find(q => re.test(q.str.trim()));
      if (p) return p.x;
    }
    return null;
  };
  const qtyX = colOf(/^QUANTITY$|^QTY$|数\s*量/i);
  const priceX = colOf(/^(?:CIF\s*)?UNIT\s*PRICE$|^PRICE$|单\s*价/i);

  // Currency: printed under or beside the AMOUNT header — "(USD)", or a bare
  // "USD" on the total row. NEVER taken from elsewhere on the page: these
  // documents print the supplier's own bank currency further down
  // ("ACC NO.1202021109016209761 (RMB)"), and reading that would label a USD
  // invoice as CNY.
  for (const r of rows.slice(hIdx)) {
    const p = r.parts.find(q => Math.abs(q.x - amtX) <= COL && /\(?\b(?:USD|CNY|RMB|EUR|IDR|SGD|JPY)\b/.test(q.str.toUpperCase()));
    if (p) { out.currency = CCY[p.str.toUpperCase().match(/\b(USD|CNY|RMB|EUR|IDR|SGD|JPY)\b/)[1]]; break; }
  }

  const below = rows.slice(hIdx + 1);

  // 1) An explicit total row wins — it is the supplier's own arithmetic.
  for (const r of below) {
    if (!TOTAL_WORD.test(rowText(r.parts))) continue;
    const cell = numbersIn(r).filter(c => Math.abs(c.x - amtX) <= COL).pop();
    if (cell && cell.n > 0) { out.amount = cell.n; out.how = 'total'; return out; }
  }

  // 2) No total row: add up the item lines in the AMOUNT column, verifying each
  //    against its own quantity x unit price.
  let sum = 0, checked = 0, mismatch = false;
  for (const r of below) {
    const nums = numbersIn(r);
    const amt = nums.filter(c => Math.abs(c.x - amtX) <= COL).pop();
    if (!amt || !(amt.n > 0)) continue;
    sum += amt.n;
    if (qtyX != null && priceX != null) {
      const q = nums.find(c => Math.abs(c.x - qtyX) <= COL);
      const pr = nums.find(c => Math.abs(c.x - priceX) <= COL);
      if (q && pr) {
        checked++;
        // Printed unit prices are rounded to 4 decimals, so the product carries
        // that rounding multiplied by the quantity.
        const tol = Math.abs(q.n) * 0.00005 + 0.005;
        const agrees = q.all.some(qn => pr.all.some(pn => Math.abs(qn * pn - amt.n) <= tol));
        if (!agrees) mismatch = true;
      }
    }
  }
  if (mismatch || !(sum > 0)) return { amount: 0, currency: out.currency, how: mismatch ? 'mismatch' : '' };
  return { amount: sum, currency: out.currency, how: checked ? 'items+check' : 'items' };
}

// Layouts with no AMOUNT column: read the labelled total rows instead. Two or
// more that disagree means the page has not been understood, so nothing is
// filled — same rule as everywhere else here.
function totalRowsOnly(rows) {
  const out = { amount: 0, currency: '', how: '' };
  const seen = [];
  for (const r of rows) {
    const txt = rowText(r.parts);
    if (!TOTAL_WORD.test(txt)) continue;
    const cell = numbersIn(r).pop();
    if (cell && cell.n > 0) {
      seen.push(cell.n);
      const m = txt.toUpperCase().match(/\b(USD|CNY|RMB|EUR|IDR|SGD|JPY)\b/);
      if (m && !out.currency) out.currency = CCY[m[1]];
    }
  }
  if (!seen.length) return out;
  if (seen.some(v => Math.abs(v - seen[0]) > 0.02)) return { ...out, how: 'mismatch' };
  return { amount: seen[0], currency: out.currency, how: `total-rows(${seen.length})` };
}

/**
 * @param {File} file        the dropped PDF
 * @param {Array} suppliers  master supplier list, for name matching
 * @returns {{scanned:boolean, no:string, poRef:string, date:string, due:string,
 *            termDays:number, currency:string, amount:number, supplierId:string,
 *            dateAmbiguous:boolean, found:string[]}}
 *          `found` lists which fields came from the PDF — the screen uses it to
 *          mark them, so nothing filled here can pass as something a person typed.
 */
export async function parseInvoicePdf(file, suppliers = []) {
  const out = {
    scanned: false, no: '', poRef: '', date: '', due: '', termDays: 0,
    currency: '', amount: 0, supplierId: '', dateAmbiguous: false, found: [],
  };
  let pdf;
  try {
    pdf = await extractPdf(file);
  } catch (e) {
    console.warn('invoice parse skipped:', e);
    return out;
  }

  if ((pdf.text || '').replace(/\s/g, '').length < 40) { out.scanned = true; return out; }

  // Re-read the page as ROWS. Everything below works on this, never on pdf.text.
  const rows = [];
  for (const page of pdf.pages || []) rows.push(...bandRows(page));
  const text = rows.map(r => rowText(r.parts)).join('\n');

  for (const re of [NO_RE, NO_RE_ALT]) {
    const m = text.match(re);
    // "INVOICE" and "NO" both appear in prose ("THIS INVOICE IS FOR CUSTOMS
    // DECLARATION PURPOSE ONLY"), so reject a capture that is a plain word.
    if (m && !/^[A-Za-z]+$/.test(m[1])) { out.no = m[1].replace(/[.,;]+$/, ''); out.found.push('no'); break; }
  }

  const po = text.match(PO_RE);
  if (po && /\d/.test(po[1])) { out.poRef = po[1].replace(/[.,;]+$/, ''); out.found.push('poRef'); }

  const dm = text.match(DATE_RE);
  if (dm) {
    const iso = toIso(dm[1]);
    if (iso) { out.date = iso; out.dateAmbiguous = ambiguousDate(dm[1]); out.found.push('date'); }
  }

  const term = text.match(TERM_RE);
  if (term) {
    // "90 DAYS AFTER BL DATE" counts from the bill of lading, which this
    // document does not carry — deriving a due date from it would be a guess.
    const tail = (term[2] || '').toUpperCase();
    if (!/\bB\/?L\b|BILL\s*OF\s*LADING/.test(tail)) { out.termDays = Number(term[1]) || 0; out.found.push('termDays'); }
  }
  if (out.date && out.termDays) { out.due = addDaysIso(out.date, out.termDays); if (out.due) out.found.push('due'); }

  const money = readAmount(rows);
  if (money.amount > 0) { out.amount = money.amount; out.found.push('amount'); }
  if (money.currency) { out.currency = money.currency; out.found.push('currency'); }

  // Supplier, only when the answer is unambiguous. A master name that appears
  // in the text identifies the sender; TWO matching names means the document
  // mentions someone else as well (a forwarder, a notify party) and the guess
  // is dropped rather than resolved by picking one.
  const up = text.toUpperCase();
  const hits = suppliers.filter(s => s.name && s.name.length > 6 && up.includes(String(s.name).toUpperCase()));
  if (hits.length === 1) { out.supplierId = hits[0].id; out.found.push('supplier'); }

  return out;
}
