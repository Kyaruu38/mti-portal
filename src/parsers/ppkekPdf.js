// Rule-based parser for the PPKEK (customs) PDF (text-based).
// Extracts: Nopen, PPKEK no/date, ETA, supplier+address, invoice/PL no, item lines
// (code/name/qty/unit/price/amount), kurs NDPBM, valuta, USD & IDR values,
// incoterm, pungutan negara, ASAL PEMASUKAN (LDP / TLDDP -> auto-tab).

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';

export async function parsePpkekPdf(file) {
  const pdf = await extractPdf(file);
  const text = pdf.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const out = {
    ok: !pdf.isScanned,
    scanned: pdf.isScanned,
    nopen: '',
    ppkekNo: '',
    ppkekDate: '',
    eta: '',
    supplier: '',
    address: '',
    invoiceNo: '',
    plNo: '',
    contractNo: '',
    kursNDPBM: 0,
    valuta: 'USD',
    valueForeign: 0,
    valueIDR: 0,
    incoterm: '',
    pungutan: 0,
    asal: 'LDP',       // LDP or TLDDP -> which register tab
    items: [],
    raw: text,
  };

  const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };

  out.nopen = grab(/Nomor Pendaftaran[^\d]*([\d\-]+)/i) || grab(/Nopen[^\d]*([\d\-]+)/i);
  // "NOMOR PENGAJUAN : 201039B6864D93107202600996" — the PPKEK No. column in the
  // register workbook. Parsed all along, just never captured.
  out.ppkekNo = grab(/Nomor\s*Pengajuan[^\w]*([A-Z0-9]{12,})/i) || '';
  // "d. Perkiraan Tanggal Tiba : 31-07-2026"
  out.eta = grab(/Perkiraan\s*Tanggal\s*Tiba[^\d]*(\d{2}-\d{2}-\d{4})/i) || out.eta;
  // FALLBACKS ONLY — the anchored "Nomor Pengajuan" match above is the real one
  // and must not be overwritten by these. This line used to be an unconditional
  // assignment placed AFTER it, so the working value was thrown away every time:
  // the first pattern matches the words "PPKEK PEMASUKAN" in the page title and
  // captures whatever follows.
  if (!out.ppkekNo) out.ppkekNo = grab(/\b(2010\d{3}[A-Z0-9]{10,})/) || '';
  out.ppkekDate = grab(/Tanggal[^\n]*?(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/);
  // Same trap: unconditional, and placed after the anchored match. On a form
  // that spells it "Perkiraan Tanggal Tiba" and never uses the word ETA, this
  // reliably replaced a correct date with an empty string.
  if (!out.eta) out.eta = grab(/ETA[^\d\n]*(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/i) || '';
  out.contractNo = grab(/(?:Contract|合同号|No\. Kontrak)[^\n]*?(CGDD\d{8,}|[A-Z]{2,}-?\d{4,}[A-Z0-9\-]*)/i);
  out.invoiceNo = grab(/Invoice[^\n]*?[:：]?\s*([A-Z0-9\/\-]+)/i);
  out.plNo = grab(/(?:Packing List|PL No)[^\n]*?[:：]?\s*([A-Z0-9\/\-]+)/i);

  // Supplier: often after "Pemasok" / "Supplier" / "Penjual".
  out.supplier = grab(/(?:Pemasok|Supplier|Penjual|Seller)[^\n:：]*[:：]?\s*([A-Z][A-Za-z0-9 .,&()\-]{3,})/);
  out.address = grab(/(?:Alamat|Address)[^\n:：]*[:：]?\s*([^\n]{6,})/i);

  // Kurs NDPBM
  const kurs = text.match(/NDPBM[^\d]*([\d.,]+)/i) || text.match(/Kurs[^\d]*([\d.,]+)/i);
  if (kurs) out.kursNDPBM = toNum(kurs[1]);

  // Valuta / currency
  const val = text.match(/\b(USD|CNY|EUR|SGD|JPY|IDR)\b/);
  if (val) out.valuta = val[1];

  // Foreign & IDR values (CIF).
  // ANCHORED TO THE FULL LABEL, on purpose.
  //
  // These used to be /CIF[^\d]*([\d.,]+)/ and /Nilai\s*(?:Pabean|IDR)[^\d]*([\d.,]+)/.
  // `[^\d]*` crosses newlines, so both walked from a label that carries NO
  // number of its own to whatever digit appeared next anywhere in the document:
  //
  //     1. Inconterm : CIF          <- regex matched "CIF" here...
  //     1. Pemenuhan Persyaratan    <- ...and captured this "1"
  //
  // Nilai Pabean came out as 1 and USD as 1 on every real document. Nothing
  // errored — the register just showed IDR 1 next to a genuine nopen and date,
  // which reads as "cheap shipment", not as "parser failure".
  //
  // The customs form always spells these two out in full, with the currency in
  // the label itself:
  //     7. Nilai Pabean - USD : 21.600,00
  //     8. Nilai Pabean - IDR : 387.439.200,00
  // so the currency is matched as part of the label and the number has to sit
  // on the same side of it. [^\d\n]* (no newline) keeps the match on one line.
  const usdVal = text.match(/Nilai\s*Pabean\s*[-–]?\s*USD[^\d\n]*([\d.,]+)/i);
  if (usdVal) out.valueForeign = toNum(usdVal[1]);
  else {
    // Fallback: FOB line, same shape. Some documents carry FOB but not CIF.
    const fob = text.match(/Nilai\s*[-–]?\s*FOB\s*USD[^\d\n]*([\d.,]+)/i);
    if (fob) out.valueForeign = toNum(fob[1]);
  }
  const idrVal = text.match(/Nilai\s*Pabean\s*[-–]?\s*IDR[^\d\n]*([\d.,]+)/i);
  if (idrVal) out.valueIDR = toNum(idrVal[1]);
  // Derived only as a last resort, and it must agree with the printed figure
  // when both exist — see the invariant check in the test harness.
  if (!out.valueIDR && out.valueForeign && out.kursNDPBM) out.valueIDR = Math.round(out.valueForeign * out.kursNDPBM);

  // Incoterm
  const inco = text.match(/\b(FOB|CIF|CFR|EXW|DDP|FCA)\b/);
  if (inco) out.incoterm = inco[1];

  // Pungutan negara (duties)
  const pn = text.match(/(?:Pungutan|Bea Masuk|Total Pungutan)[^\d]*([\d.,]+)/i);
  if (pn) out.pungutan = toNum(pn[1]);

  // ASAL PEMASUKAN -> LDP / TLDDP
  if (/TLDDP/i.test(text)) out.asal = 'TLDDP';
  else if (/LDP|Luar Daerah Pabean/i.test(text)) out.asal = 'LDP';

  // Item lines: code + name + numbers.
  const ERP = /^(MTI-[\w-]+|\d{6,}[A-Za-z]{0,3})\b/;
  for (const l of lines) {
    const m = l.match(ERP);
    if (!m) continue;
    const nums = (l.match(/[\d.,]+/g) || []).map(toNum);
    out.items.push({
      code: m[0],
      name: l.slice(m[0].length).replace(/[\d.,]+.*$/, '').trim(),
      qty: nums.slice(-3)[0] || 0,
      unit: (l.match(/KGM|PCE|张|条|SET|PC|ROLL/i) || [''])[0],
      price: nums.slice(-2)[0] || 0,
      amount: nums.slice(-1)[0] || 0,
    });
  }

  return out;
}

// PPKEK is a Bea Cukai (Indonesian customs) form — every monetary field and
// the NDPBM rate use dot-grouping with a comma decimal ("15.850,00",
// "45.362.500"). The old helper stripped commas but not dots, so the kurs came
// out as 15.85 and Nilai Pabean as 0, and those values are written straight
// into the register row (screens/ppkek.js). Locale is pinned to 'id' — this
// document is never English-formatted.
//
// Returns 0 for an unreadable value ONLY because these fields are all
// operator-editable in the register UI before save; a NaN would render as
// "NaN" in an input box. The zero is now a genuine "not found", not a parse
// failure masquerading as a number.
function toNum(v) {
  const n = parseNumber(v, 'id');
  return Number.isFinite(n) ? n : 0;
}


// ---------------------------------------------------------------------------
// SPPB — where the supplier name actually lives.
//
// The PPKEK form prints "Eksportir LN/Penjual" and "Pemasok" as two ADJACENT
// COLUMNS of a three-column block. Flattened to text that becomes:
//
//     2. Eksportir LN/Penjual        3. Pemasok        <- column HEADINGS
//     c. Nama : NIPPON SEIRO (THAILAND)  c. Nama :
//     CO., LTD. LTD.
//
// so any regex anchored on the word "Penjual" or "Pemasok" walks straight into
// the neighbouring HEADING and captures the literal word "Pemasok". That is what
// every row in the register says today. The real name is on the next line and
// split across two.
//
// The SPPB in the same bundle prints the same party in a plain single column:
//
//     2. PENGIRIM BARANG
//     b. Nama   : NIPPON SEIRO (THAILAND) CO., LTD.
//     c. Alamat : NO.700/15 MOO 7 TAMBON KHAOKHANSONG AMPHUR SRIRACHA...
//
// One label, one value, one line. Reading it from here instead of fighting the
// three-column form is not a workaround — it is the better source.
//
// Returns {} when the file isn't an SPPB or the block is missing, so the caller
// simply keeps whatever the PPKEK parse produced.
// ---------------------------------------------------------------------------
export async function parseSppbPdf(file) {
  let text = '';
  try {
    const pdf = await extractPdf(file);
    if (pdf.isScanned) return {};
    text = pdf.text || '';
  } catch (e) {
    console.warn('SPPB parse failed (non-fatal):', e);
    return {};
  }
  if (!/SURAT\s+PERSETUJUAN\s+PENGELUARAN\s+BARANG|SPPB/i.test(text)) return {};

  // Scoped to the PENGIRIM BARANG block: the same document also carries
  // PENERIMA BARANG (that is MTI itself), and matching "b. Nama" globally would
  // pick whichever came first.
  const block = text.split(/PENGIRIM\s+BARANG/i)[1];
  if (!block) return {};
  const stop = block.split(/PENERIMA\s+BARANG/i)[0];

  const out = {};
  const nama = stop.match(/b\.\s*Nama[^:：]*[:：]\s*([^\n]+)/i);
  if (nama) {
    const v = nama[1].trim();
    // "-" is how the form prints an empty field; never store it as a name.
    if (v && v !== '-') out.supplier = v;
  }
  const alamat = stop.match(/c\.\s*Alamat[^:：]*[:：]\s*([^\n]+)/i);
  if (alamat) {
    const v = alamat[1].trim();
    if (v && v !== '-') out.address = v;
  }
  return out;
}
