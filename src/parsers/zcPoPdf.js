// Rule-based parser for the ZC ERP Purchase Order / Purchase Contract PDF
// (text-based; scans are rejected upstream via pdf.isScanned).
// Grounded in the BSN purchase contract layout (CGDD2509220096) and CGDD samples:
//   采购合同 / Purchase Contract, seller block, table: ERP Code | Description |
//   Quantity | Unit(张/PC · 条) | Price | Amount, totals: 共计(不含税)/PPN 11%/费用总计,
//   terms clause referencing the PO number (合同号 / CGDD…).
//
// Item rows are walked token-by-token (pdf.js text items per visual row, empty
// tokens filtered) rather than regex'd out of a joined string: price/amount are
// identified by their decimal-digit signature (price has 4-6 decimals, amount
// has 2), and the quantity+unit region is whatever sits between the description
// and the price token — whether the source PDF emits it as one merged token
// ("3,000 张PC") or split across two ("17,000" + "千克kg").

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';
import { englishFirst } from './itemName.js';

const ERP = /^(\d{6,}[A-Za-z]{0,3}|MTI-[\w-]+)$/;
// Price and amount are told apart by DECIMAL COUNT plus column position.
// Both regexes now accept an optional leading '-': ZC POs carry credit/return
// lines (negative qty and amount), and the old patterns rejected them, so those
// rows were dropped with no warning at all. `out.subtotal` then fell back to the
// sum of the SURVIVING items (see the end of parseZcPo), which made the
// converted PO internally consistent and therefore look perfectly correct while
// silently missing a line.
// Price widened to 2..6 decimals for the same reason — a supplier quoting a flat
// "1500.00" unit price had the whole row discarded.
const PRICE_RE = /^-?[\d,]+\.\d{2,6}$/;
const AMOUNT_RE = /^-?[\d,]+\.\d{2}$/;

export async function parseZcPo(file) {
  const pdf = await extractPdf(file);
  if (pdf.isScanned) {
    return { ok: false, scanned: true, error: 'PDF hasil scan — gunakan PDF berbasis teks (text-based).' };
  }
  const text = pdf.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const out = {
    ok: true,
    // Rows that LOOKED like item rows (valid ERP code + trailing amount) but
    // whose qty or price couldn't be read. Previously a bare `continue` dropped
    // them with no trace, and because out.subtotal falls back to the sum of the
    // surviving items, the converted PO stayed internally consistent and looked
    // correct while being short a line. poConverter.js surfaces this now.
    skippedRows: [],
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
  const cgdd = text.match(/CGDD\d+/i);
  if (cgdd) { out.cgdd = cgdd[0].toUpperCase(); out.contractNo = out.cgdd; }

  // Contract No/合同号 — find the row carrying the label, strip the label prefix.
  const contractLine = lines.find(l => /Contract No|合同号/i.test(l));
  if (contractLine) {
    const m = contractLine.match(/(?:Contract No[^:：]*|合同号)[:：]?\s*([A-Z0-9\-\/]+)/i);
    if (m) out.contractNo = m[1];
  }

  // Date: PO date is the only YYYY-MM-DD in the header block.
  const dateM = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (dateM) out.date = dateM[0];

  // Supplier Name/供应商名称: <name> — cut at the next known header label if
  // it shares the same visual row, otherwise take the rest of the row.
  // No trailing \b: CJK characters are non-word chars in JS regex, so a
  // boundary right after a slash into 号码/日期/etc. never matches.
  const NEXT_LABEL = /\s*(?:No\/|号码|Date\/|日期|Contract No|合同号|Address\/|地址|Supplier Name|供应商名称)/i;
  const supplierLine = lines.find(l => /Supplier Name|供应商名称/i.test(l));
  if (supplierLine) {
    let s = supplierLine.replace(/^.*?(?:Supplier Name|供应商名称)[^:：]*[:：]\s*/i, '');
    s = s.split(NEXT_LABEL)[0].trim();
    if (s) out.supplierEn = s;
  }
  const zh = text.match(/([一-鿿（）()·\s]{2,}(?:有限公司|公司|厂))/);
  if (zh) out.supplierZh = zh[1].trim();
  const addrLine = lines.find(l => /Address|地址/i.test(l));
  if (addrLine) {
    let a = addrLine.replace(/^.*?(?:Address|地址)[^:：]*[:：]\s*/i, '');
    a = a.split(NEXT_LABEL)[0].trim();
    if (a) out.supplierAddress = a;
  }

  // Currency: PPN/增值税 is Indonesian VAT — its presence means the PO is IDR.
  // Don't hardcode otherwise; fall back to explicit currency keywords.
  if (/PPN|增值税/i.test(text)) out.currency = 'IDR';
  else if (/USD|美元|\$/.test(text)) out.currency = 'USD';
  else if (/IDR|Rp|印尼盾|Rupiah/i.test(text)) out.currency = 'IDR';

  // Incoterm
  const inco = text.match(/\b(FOB|CIF|CFR|EXW|DDP|FCA)\b[^\n,;]*/i);
  if (inco) out.incoterm = inco[0].trim();

  // Payment terms clause (Indonesian/English/Chinese)
  const pay = text.match(/(?:付款条件|Payment|收到发票后)[^\n]*/i);
  if (pay) out.paymentText = pay[0].trim();

  // PPN presence: line with 增值税 / PPN 11% — exclude the subtotal row,
  // which also contains the substring "PPN" via "(exclude PPN)/不含税".
  const ppnLine = lines.find(l => /增值税|PPN/i.test(l) && !/exclude PPN|不含税/i.test(l));
  if (ppnLine) {
    out.ppnPresent = true;
    const amt = ppnLine.match(/([\d.,]+)\s*$/);
    out.ppn = amt ? toNum(amt[1]) : 0;
    if (out.ppn === 0) out.ppnSuspended = true;
  }

  // Item rows: walk pdf.js text tokens per visual row (grouped by y in pdf.js),
  // not the joined/regex'd line string — CJK descriptions and merged qty+unit
  // tokens don't survive a naive whitespace-split reliably.
  //
  // ERP code, qty(+unit), price and amount always live together on the row
  // the ERP code anchors — the description cell can be empty on that row and
  // wrap onto the row(s) immediately above and/or below it (long CJK/EN names
  // routinely wrap both ways around the numeric columns). So numeric fields
  // are parsed from the anchor row only; description is assembled separately
  // from any neighboring rows that look like plain wrapped text.
  const isDescContinuation = (toks) => {
    if (!toks.length) return false;
    const joined = toks.join(' ');
    return !ERP.test(toks[0])
      && !AMOUNT_RE.test(toks[toks.length - 1])
      && !/共计|合计|总计|PPN|增值税|In total|Amount|ERP Code|Description|Dimension|Quantity|Unit\b|Price|货物如下|Goods as follows/i.test(joined);
  };

  for (const page of pdf.pages) {
    const rows = page.lines;
    // Rows already claimed as another item's wrapped description, per page.
    const consumedRows = new Set();
    for (let i = 0; i < rows.length; i++) {
      const tokens = rows[i].parts.map(p => p.str.trim()).filter(Boolean);
      if (!tokens.length || !ERP.test(tokens[0])) continue;

      const amountTok = tokens[tokens.length - 1];
      if (!AMOUNT_RE.test(amountTok)) continue; // not an item row (header/total/blank) — not counted

      let priceIdx = -1;
      for (let k = tokens.length - 2; k >= 1; k--) {
        if (PRICE_RE.test(tokens[k])) { priceIdx = k; break; }
      }
      if (priceIdx === -1) { out.skippedRows.push({ erp: tokens[0], reason: 'harga tidak terbaca', raw: tokens.join(' ') }); continue; }

      // Quantity token = the last digit-bearing token before price (qty is
      // always closer to price than any digits inside the description, e.g.
      // "100#" mid-desc). Unit is either merged into that same token
      // ("3,000 张PC") or sits in the token(s) between it and price ("千克kg").
      let qtyIdx = -1;
      for (let k = priceIdx - 1; k >= 1; k--) {
        if (/\d/.test(tokens[k])) { qtyIdx = k; break; }
      }
      if (qtyIdx === -1) { out.skippedRows.push({ erp: tokens[0], reason: 'qty tidak terbaca', raw: tokens.join(' ') }); continue; }

      // `[\d,]+` stopped at the decimal point, so "17,000.50" parsed as qty
      // 17000 and dumped ".50" into mergedUnit — which then failed the
      // `!li.unit` gate in poConverter.js and printed verbatim on the PO.
      // Weight-priced lines (千克kg) routinely carry decimals.
      const qtyMatch = tokens[qtyIdx].match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/);
      const qty = qtyMatch ? toNum(qtyMatch[1]) : 0;
      const mergedUnit = qtyMatch ? qtyMatch[2].trim() : '';
      const unitTokens = tokens.slice(qtyIdx + 1, priceIdx).join(' ').trim();
      const unit = unitTokens || mergedUnit;

      // BOOKKEEPING: a wrapped description row may only be consumed ONCE.
      //
      // The anchor row used to absorb rows[i-1] AND rows[i+1] with no record of
      // what had already been taken. For the common layout
      //     itemA / wrapA / itemB
      // `wrapA` was appended to A (as A's "next") and simultaneously prepended
      // to B (as B's "prev") — so a tyre's dimension string ended up labelling
      // the natural-rubber line underneath it.
      const descParts = tokens.slice(1, qtyIdx);
      const hasInlineDesc = descParts.length > 0;

      // The row ABOVE belongs to this item unless a previous anchor already
      // took it.
      if (i > 0 && !consumedRows.has(i - 1)) {
        const prevTokens = rows[i - 1].parts.map(p => p.str.trim()).filter(Boolean);
        if (isDescContinuation(prevTokens)) { descParts.unshift(...prevTokens); consumedRows.add(i - 1); }
      }

      // The row BELOW is contested: it may be this item's wrap, or the NEXT
      // item's description sitting above its own anchor.
      //
      // First-come-first-served here was wrong. For the layout
      //     itemA(desc inline) / wrapRow / itemB(anchor)
      // A grabbed wrapRow as its "next" and B — whose description that actually
      // was — ended up EMPTY. The old double-claiming code polluted A but at
      // least left B correct; naive bookkeeping made it strictly worse.
      //
      // Rule: only claim the row below when the row after THAT is not another
      // anchor, or when this item has no inline description of its own (so the
      // wrap is far more likely to be ours).
      if (i + 1 < rows.length && !consumedRows.has(i + 1)) {
        const nextTokens = rows[i + 1].parts.map(p => p.str.trim()).filter(Boolean);
        const afterTokens = (i + 2 < rows.length) ? rows[i + 2].parts.map(p => p.str.trim()).filter(Boolean) : [];
        const nextIsNextItemsHeader = afterTokens.length > 0 && ERP.test(afterTokens[0]);
        if (isDescContinuation(nextTokens) && !(nextIsNextItemsHeader && hasInlineDesc)) {
          descParts.push(...nextTokens);
          consumedRows.add(i + 1);
        }
      }
      const desc = descParts.join(' ').trim();

      const price = toNum(tokens[priceIdx]);
      const amount = toNum(amountTok);

      out.items.push({
        // No forced fallback here — PO Converter is used for goods generally,
        // not just tires, so guessing '条' when the source text has no
        // recognizable unit token would silently mislabel anything priced in
        // kg/roll/set/etc. Leave it empty; poConverter.js surfaces a picker
        // (backed by the units master) for the user to fill in instead.
        erp: tokens[0], desc, descEn: englishFirst(desc, desc), unit,
        qty, price, amount,
      });
    }
  }

  // Totals — read off the specific labeled row rather than searching the
  // whole joined text, since "Amount" also appears bare in the table header.
  const subtotalLine = lines.find(l => (/共计|In total/i.test(l)) && !/费用总计/i.test(l) && /[\d,]+\.\d{2}\s*$/.test(l));
  if (subtotalLine) {
    const m = subtotalLine.match(/([\d,]+\.\d{2})\s*$/);
    if (m) out.subtotal = toNum(m[1]);
  }
  const totalLine = lines.find(l => (/费用总计|(?:^|[^A-Za-z])Amount(?:[:：]|$)/i.test(l)) && /[\d,]+\.\d{2}\s*$/.test(l));
  if (totalLine) {
    const m = totalLine.match(/([\d,]+\.\d{2})\s*$/);
    if (m) out.total = toNum(m[1]);
  }
  if (!out.subtotal && out.items.length) out.subtotal = out.items.reduce((s, x) => s + (x.amount || 0), 0);
  if (!out.total) out.total = out.subtotal + (out.ppn || 0);

  return out;
}

// ZC ERP exports are ENGLISH-formatted (comma = thousands, dot = decimal), so
// the locale is pinned rather than auto-detected — "1.500" here means one and a
// half, not fifteen hundred.
function toNum(v) {
  const n = parseNumber(v, 'en');
  return Number.isFinite(n) ? n : 0;
}
