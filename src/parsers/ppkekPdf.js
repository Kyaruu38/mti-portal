// Rule-based parser for the PPKEK (customs) PDF (text-based).
// Extracts: Nopen, PPKEK no/date, ETA, supplier+address, invoice/PL no, item lines
// (code/name/qty/unit/price/amount), kurs NDPBM, valuta, USD & IDR values,
// incoterm, pungutan negara, ASAL PEMASUKAN (LDP / TLDDP -> auto-tab).

import { extractPdf } from './pdf.js';

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
  out.ppkekNo = grab(/PPKEK[^\n]*?No\.?[:：]?\s*([A-Z0-9\-]+)/i) || grab(/\b(2010\d{3}[A-Z0-9]{10,})/);
  out.ppkekDate = grab(/Tanggal[^\n]*?(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/);
  out.eta = grab(/ETA[^\d]*(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/i);
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
  const cif = text.match(/CIF[^\d]*([\d.,]+)/i);
  if (cif) out.valueForeign = toNum(cif[1]);
  const idr = text.match(/(?:Nilai\s*(?:Pabean|IDR|Rupiah))[^\d]*([\d.,]+)/i);
  if (idr) out.valueIDR = toNum(idr[1]);
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

function toNum(v) { return Number(String(v).replace(/[,\s]/g, '')) || 0; }
