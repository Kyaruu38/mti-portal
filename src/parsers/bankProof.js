// Payment-proof parser REGISTRY.
// Each template has: id, label, detect(text) -> boolean fingerprint, parse(text) -> fields.
// Add more banks by pushing to REGISTRY (a clean slot for USD telegraphic transfer
// is included below). Unknown formats fall back to manual 3-field entry.

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';

// Amounts are parsed with parseNumber(), which understands BOTH Indonesian
// (1.234.567,89) and English (1,234,567.89) grouping and returns NaN — not 0 —
// when it can't read the value. The previous helper stripped commas but not
// dots, so every ICBC BI-FAST receipt (Indonesian format) parsed as 0 and the
// finance screen still offered a ~30%-confidence "match" on payee name alone.
// A NaN amount now means "unreadable": callers surface it instead of matching.
const toNum = v => parseNumber(v);

function firstMatch(text, res) {
  for (const re of res) { const m = text.match(re); if (m) return m; }
  return null;
}

// ---- Template 1: Standard Chartered "Payment Transaction Details" ----
// Grounded in the real sample (#006-WSR-CGDD… .pdf). Reads the CGDD PO no from
// the "Notes to Beneficiary" field for triple-match.
const STANDARD_CHARTERED = {
  id: 'sc',
  label: 'Standard Chartered — Payment Transaction Details',
  detect: (t) => /Payment Transaction Details/i.test(t),
  parse: (t) => {
    const amt = firstMatch(t, [
      /Credit Amount\s+(IDR|USD|SGD|CNY|EUR)\s+([\d.,]+)/i,
      // The decimals used to sit OUTSIDE the capture group (…([\d.,]+)\.\d{2}…),
      // so "USD 12,345.67 Debit Amount" captured "12,345" and the cents were
      // dropped — enough to break the <1 amount match on USD/CNY/EUR proofs.
      /(IDR|USD|SGD|CNY|EUR)\s+([\d.,]+\.\d{2})\s+Debit Amount/i,
      /(IDR|USD|SGD|CNY|EUR)\s+([\d.,]+)/i,
    ]);
    const currency = amt ? amt[1].toUpperCase() : 'IDR';
    const amount = amt ? toNum(amt[2]) : NaN;
    // Beneficiary: name line inside "Beneficiary Details".
    let beneficiary = '';
    const bd = t.split(/Beneficiary Details/i)[1] || t;
    const bm = bd.match(/\b(PT|CV)\s+[A-Z][A-Z .,&'-]{3,}/);
    if (bm) beneficiary = bm[0].replace(/\s*-\s*(IDR|USD).*/i, '').trim();
    const date = (t.match(/Value Date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                  t.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) || [])[1] || '';
    const po = (t.match(/CGDD\d{8,}/i) || [])[0] || '';
    const ref = (t.match(/End to End ID[^\n]*?\b([A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]{4,})\b/i) || [])[1] || '';
    return { currency, amount, beneficiary, date, poNo: po, reference: ref, method: 'Standard Chartered', confidence: 0.95 };
  },
};

// ---- Template 2: ICBC "Cek Status BI-FAST" ----
// Indonesian BI-FAST receipt. Fields: nominal / penerima / tanggal.
const ICBC_BIFAST = {
  id: 'icbc_bifast',
  label: 'ICBC — Cek Status BI-FAST',
  detect: (t) => /Cek Status BI-?FAST/i.test(t) || (/BI-?FAST/i.test(t) && /ICBC/i.test(t)),
  parse: (t) => {
    const amt = firstMatch(t, [
      /Nominal[^\d\n]*(?:IDR|Rp)?[^\d\n]*([\d.,]+)/i,
      /Jumlah[^\d\n]*(?:IDR|Rp)?[^\d\n]*([\d.,]+)/i,
      /(?:IDR|Rp)\s*([\d.,]+)/i,
    ]);
    // Indonesian receipt: "2.862.720.000,00". Explicit 'id' locale so a value
    // like "16,50" is never mistaken for English thousands grouping.
    const amount = amt ? parseNumber(amt[1], 'id') : NaN;
    const ben = firstMatch(t, [
      /Nama Penerima[^\n:：]*[:：]?\s*([A-Z][A-Za-z0-9 .,&'-]{3,})/i,
      /Rekening Tujuan[^\n]*\n?\s*([A-Z][A-Za-z0-9 .,&'-]{3,})/i,
      /Penerima[^\n:：]*[:：]?\s*([A-Z][A-Za-z0-9 .,&'-]{3,})/i,
    ]);
    const beneficiary = ben ? ben[1].trim() : '';
    const date = (t.match(/Tanggal[^\d\n]*(\d{1,2}[\/\- ][A-Za-z0-9]{2,}[\/\- ]\d{2,4})/i) || [])[1] || '';
    const ref = (t.match(/(?:No\.?\s*Referensi|Reference|Ref)[^\n]*?([A-Z0-9]{8,})/i) || [])[1] || '';
    const po = (t.match(/CGDD\d{8,}/i) || [])[0] || '';
    return { currency: 'IDR', amount, beneficiary, date, poNo: po, reference: ref, method: 'ICBC BI-FAST', confidence: 0.9 };
  },
};

// ---- Clean slot for additional banks (e.g. USD telegraphic transfer) ----
// TODO(you): add a template object like the ones above and push it into REGISTRY.
// const MANDIRI_TT_USD = { id:'mandiri_tt', label:'Mandiri — TT Valas (USD)',
//   detect:(t)=>/Telegraphic Transfer/i.test(t), parse:(t)=>({ ... }) };

export const REGISTRY = [STANDARD_CHARTERED, ICBC_BIFAST /*, MANDIRI_TT_USD */];

// Parse a payment-proof PDF. Returns { matchedTemplate, fields, manual, text }.
export async function parsePaymentProof(file) {
  const pdf = await extractPdf(file);
  const text = pdf.text;
  const tmpl = REGISTRY.find(x => x.detect(text));
  if (!tmpl) {
    return { matchedTemplate: null, manual: true, fields: { currency: 'IDR', amount: NaN, beneficiary: '', date: '', poNo: '' }, text };
  }
  const fields = tmpl.parse(text);
  // A template matched but the amount didn't parse -> degrade to the manual
  // path rather than letting a NaN (or a silent 0) reach the matcher. The
  // operator retypes one number instead of the system guessing a PRF.
  if (!Number.isFinite(fields.amount)) {
    return { matchedTemplate: tmpl.id, templateLabel: tmpl.label, manual: true, amountUnreadable: true, fields, text };
  }
  return { matchedTemplate: tmpl.id, templateLabel: tmpl.label, manual: false, fields, text };
}
