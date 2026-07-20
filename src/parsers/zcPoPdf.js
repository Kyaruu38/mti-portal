// Rule-based parser for the ZC ERP Purchase Order / Purchase Contract PDF
// (text-based; scans are rejected upstream via pdf.isScanned).
// Grounded in the BSN purchase contract layout (CGDD2509220096) and CGDD samples:
//   采购合同 / Purchase Contract, seller block, table: ERP Code | Description |
//   Quantity | Unit(张/PC · 条) | Price | Amount, totals: 共计(不含税)/PPN 11%/费用总计,
//   terms clause referencing the PO number (合同号 / CGDD…).

import { extractPdf } from './pdf.js';
import { englishFirst } from './itemName.js';

export async function parseZcPo(file) {
  const pdf = await extractPdf(file);
  if (pdf.isScanned) {
    return { ok: false, scanned: true, error: 'PDF hasil scan — gunakan PDF berbasis teks (text-based).' };
  }
  const text = pdf.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const out = {
    ok: true,
    cgdd: '',           // CGDD… document number
    contractNo: '',     // 合同号 (may equal CGDD, editable)
    supplierZh: '',
    supplierEn: '',
    supplierAddress: '',
    date: '',
    currency: 'IDR',
    incoterm: '',
    paymentText: '',
    ppnPresent: false,
    ppnSuspended: false,
    items: [],
    subtotal: 0,
    ppn: 0,
    total: 0,
    raw: text,
  };

  // Document / contract number: CGDD########## anywhere.
  const cgdd = text.match(/CGDD\d{8,}/i);
  if (cgdd) { out.cgdd = cgdd[0].toUpperCase(); out.contractNo = out.cgdd; }
  // 合同号 explicit
  const hth = text.match(/合同号[:：]?\s*([A-Z0-9\-\/]+)/i);
  if (hth) out.contractNo = hth[1];

  // Seller block: "The seller/卖方: <name>" then Address/地址 ...
  const seller = text.match(/(?:seller|卖方)[^\n:：]*[:：]\s*([^\n]+)/i);
  if (seller) out.supplierEn = seller[1].trim();
  const zh = text.match(/([\u4e00-\u9fff（）()·\s]{2,}(?:有限公司|公司|厂))/);
  if (zh) out.supplierZh = zh[1].trim();
  const addr = text.match(/(?:Address|地址)[^\n:：]*[:：]\s*([^\n]+)/i);
  if (addr) out.supplierAddress = addr[1].trim();

  // Currency detection
  if (/USD|美元|\$/.test(text)) out.currency = 'USD';
  else if (/IDR|Rp|印尼盾|Rupiah/i.test(text)) out.currency = 'IDR';

  // Incoterm
  const inco = text.match(/\b(FOB|CIF|CFR|EXW|DDP|FCA)\b[^\n,;]*/i);
  if (inco) out.incoterm = inco[0].trim();

  // Payment terms clause (Indonesian/English/Chinese)
  const pay = text.match(/(?:付款条件|Payment|收到发票后)[^\n]*/i);
  if (pay) out.paymentText = pay[0].trim();

  // PPN presence: line with 增值税 / PPN 11%
  const ppnLine = lines.find(l => /增值税|PPN/i.test(l));
  if (ppnLine) {
    out.ppnPresent = true;
    const amt = ppnLine.match(/([\d.,]+)\s*$/);
    out.ppn = amt ? toNum(amt[1]) : 0;
    if (out.ppn === 0) out.ppnSuspended = true;
  }

  // Item rows: start with an ERP code (long digits + ID, or MTI-…).
  // Handle 2-line wrapped descriptions by merging continuation lines.
  const ERP = /^(\d{6,}[A-Za-z]{0,3}|MTI-[\w-]+)\b/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ERP);
    if (!m) continue;
    let rest = lines[i].slice(m[0].length).trim();
    // Pull trailing numbers: qty, unit, price, amount (best-effort).
    // Merge a wrapped description line if the next line has no leading numbers.
    if (i + 1 < lines.length && !/\d/.test(lines[i + 1].slice(0, 3)) && !ERP.test(lines[i + 1]) && !/总|共计|合计|PPN|增值税/.test(lines[i + 1])) {
      rest += ' ' + lines[i + 1];
    }
    const nums = rest.match(/[\d.,]+/g) || [];
    // Heuristic: last three numbers are price/amount, and qty earlier.
    const tail = nums.slice(-3).map(toNum);
    const unit = (rest.match(/张\/?PC|张|条|KGM|PCE|SET|ROLL|PC/i) || [''])[0];
    const desc = rest.replace(/\s+[\d.,]+(\s+[\d.,]+)*\s*$/, '').replace(unit, '').trim();
    let qty = 0, price = 0, amount = 0;
    if (tail.length === 3) { [qty, price, amount] = tail; }
    else if (tail.length === 2) { [qty, amount] = tail; price = amount && qty ? amount / qty : 0; }
    else if (tail.length === 1) { amount = tail[0]; }
    out.items.push({
      // No forced fallback here — PO Converter is used for goods generally,
      // not just tires, so guessing '条' when the source text has no
      // recognizable unit token would silently mislabel anything priced in
      // kg/roll/set/etc. Leave it empty; poConverter.js surfaces a picker
      // (backed by the units master) for the user to fill in instead.
      erp: m[0], desc, descEn: englishFirst(desc, desc), unit,
      qty, price, amount,
    });
  }

  // Totals
  const sub = text.match(/(?:共计.*?exclude PPN|In total.*?PPN|小计|Subtotal)[^\d]*([\d.,]+)/i);
  if (sub) out.subtotal = toNum(sub[1]);
  const tot = text.match(/(?:费用总计|Amount|总计|Total)[^\d]*([\d.,]+)/i);
  if (tot) out.total = toNum(tot[1]);
  if (!out.subtotal && out.items.length) out.subtotal = out.items.reduce((s, x) => s + (x.amount || 0), 0);
  if (!out.total) out.total = out.subtotal + (out.ppn || 0);

  return out;
}

function toNum(v) { return Number(String(v).replace(/[,\s]/g, '')) || 0; }
