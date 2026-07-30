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

  // -------------------------------------------------------------------------
  // TWO LAYOUTS, TWO PASSES.
  //
  // Pass 1 assumes ERP + qty + unit + price + amount all sit on the ERP
  // anchor row. That is true of the ZC (中策) export the parser was built from.
  //
  // It is NOT true of every supplier. In the PT INCLUSION PO
  // (samples/inclusion gabungan.pdf) each item occupies a vertical BAND of
  // 4-5 text rows and the price sits on the row ABOVE the anchor, with its
  // decimal tail wrapping onto the row BELOW:
  //
  //     y=594  MTI锂基脂（lithium grease）【SEP2，        1,058,829.38000   <- price
  //     y=590  0107010024ID          80 桶   84,706,350.40                <- anchor, NO price
  //     y=584  15KG/Pail】安美                    0                        <- price tail
  //     y=581                        DRUMP                                 <- unit cont.
  //
  // Pass 1 finds no price on the anchor row, so every one of the 5 items was
  // dropped and the converted PO came out empty.
  //
  // Pass 2 retries using the item's BAND: the rows nearer to THIS anchor than
  // to any other anchor (a Voronoi split on y — no magic pixel window, so it
  // adapts to whatever row spacing a supplier uses). Pass 1 is left completely
  // untouched, so a layout that already worked cannot regress: pass 2 only ever
  // runs on a row pass 1 was about to throw away.
  // -------------------------------------------------------------------------
  const tokensOf = row => row.parts.map(p => p.str.trim()).filter(Boolean);

  // qty / unit / price / description, given a token list and the anchor's
  // amount token. Returns null when the price can't be located.
  const resolveLine = (tokens, stopIdx) => {
    let priceIdx = -1;
    for (let k = stopIdx - 1; k >= 1; k--) {
      if (PRICE_RE.test(tokens[k])) { priceIdx = k; break; }
    }
    if (priceIdx === -1) return null;

    // Quantity token = the last digit-bearing token before price (qty is
    // always closer to price than any digits inside the description, e.g.
    // "100#" mid-desc). Unit is either merged into that same token
    // ("3,000 张PC") or sits in the token(s) between it and price ("千克kg").
    let qtyIdx = -1;
    for (let k = priceIdx - 1; k >= 1; k--) {
      if (/\d/.test(tokens[k])) { qtyIdx = k; break; }
    }
    if (qtyIdx === -1) return { noQty: true };

    // `[\d,]+` stopped at the decimal point, so "17,000.50" parsed as qty
    // 17000 and dumped ".50" into mergedUnit — which then failed the
    // `!li.unit` gate in poConverter.js and printed verbatim on the PO.
    // Weight-priced lines (千克kg) routinely carry decimals.
    const qtyMatch = tokens[qtyIdx].match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/);
    const mergedUnit = qtyMatch ? qtyMatch[2].trim() : '';
    const unitTokens = tokens.slice(qtyIdx + 1, priceIdx).join(' ').trim();
    return {
      priceIdx, qtyIdx,
      qty: qtyMatch ? toNum(qtyMatch[1]) : 0,
      // Keep BOTH halves: INCLUSION splits the unit as "80 桶" + "DRUMP", and
      // dropping either loses information the operator needs in the picker.
      unit: [mergedUnit, unitTokens].filter(Boolean).join(' ').trim(),
      price: toNum(tokens[priceIdx]),
      descParts: tokens.slice(1, qtyIdx),
    };
  };

  for (const page of pdf.pages) {
    const rows = page.lines;
    // Rows already claimed as another item's wrapped description, per page.
    const consumedRows = new Set();

    // Anchor rows, found up front so pass 2 can work out band boundaries.
    const anchorIdx = [];
    for (let i = 0; i < rows.length; i++) {
      const tk = tokensOf(rows[i]);
      if (tk.length && ERP.test(tk[0]) && AMOUNT_RE.test(tk[tk.length - 1])) anchorIdx.push(i);
    }
    // THE ITEM TABLE'S VERTICAL EXTENT — a hard fence for pass 2.
    //
    // Without it the first item's band is unbounded upward and the last item's
    // unbounded downward, and both reached into text that isn't an item:
    //   item 1  read qty "60 天付款"          from the Payment terms block above
    //   item 5  read qty 3,090,741,801.10     from the 共计/增值税/费用总计 block below
    // Both look like a plausible number and neither raises an error, which is
    // exactly the kind of quiet wrong value that must not reach a PO.
    //
    // rows are sorted y-descending, so a HIGHER index is FURTHER DOWN the page.
    const rowText = i => tokensOf(rows[i]).join(' ');
    const HEADER_RE = /ERP\s*Code|物料编码|Material\s*Code/i;
    const TOTALS_RE = /共计|合计|总计|增值税|费用总计|in\s*total\b/i;
    let headerIdx = -1;
    let totalsIdx = rows.length;
    if (anchorIdx.length) {
      const last = anchorIdx[anchorIdx.length - 1];
      for (let i = anchorIdx[0] - 1; i >= 0; i--) if (HEADER_RE.test(rowText(i))) { headerIdx = i; break; }
      for (let i = last + 1; i < rows.length; i++) if (TOTALS_RE.test(rowText(i))) { totalsIdx = i; break; }
    }

    // Rows belonging to anchor k.
    //
    // Boundary rule, read straight off the sample rather than guessed: an item's
    // block STARTS on the row directly above its anchor (the first line of its
    // description) and RUNS DOWN to just before the next item's own first
    // description row — i.e. two rows before the next anchor. Everything in
    // between (wrapped description, the unit continuation "DRUMP", the price's
    // wrapped decimal tail) falls inside without needing a pixel window.
    //
    // A y-midpoint (Voronoi) split was tried first and mis-assigned rows for the
    // one item whose description wraps three lines: geometry alone can't tell
    // whether a line between two anchors is the upper item's tail or the lower
    // item's head, but index adjacency can.
    //
    // Below the LAST anchor there is no next anchor to fence against, so the
    // totals row does the job. A supplier whose PO carries no totals row at all
    // would leave that edge open onto the footer terms ("...2% per day",
    // "9:00-17:00"), so the reach is additionally capped at the tallest gap
    // observed between two anchors on this page — an item block is never taller
    // than the tallest block.
    let maxSpan = 4;
    for (let k = 1; k < anchorIdx.length; k++) maxSpan = Math.max(maxSpan, anchorIdx[k] - anchorIdx[k - 1]);

    const bandRange = (k) => {
      // The row above the anchor is only ours if it isn't the PREVIOUS anchor.
      // Two anchors on consecutive rows (an item with no wrapped description at
      // all) otherwise let the lower one read the upper one's price and amount.
      const from = Math.max(
        headerIdx + 1,
        anchorIdx[k] - 1,
        k > 0 ? anchorIdx[k - 1] + 1 : 0,
      );
      const downTo = k < anchorIdx.length - 1
        ? anchorIdx[k + 1] - 2
        : Math.min(totalsIdx - 1, anchorIdx[k] + maxSpan);
      // max() with the anchor itself: two adjacent anchor rows would otherwise
      // produce a range that excludes the very row being resolved.
      const to = Math.min(rows.length - 1, Math.max(anchorIdx[k], downTo));
      return { from, to };
    };
    const bandTokens = ({ from, to }) => {
      const parts = [];
      for (let i = from; i <= to; i++) parts.push(...rows[i].parts);
      // x order, so the right-to-left column walk still holds across rows.
      return parts.map(p => ({ s: String(p.str).trim(), x: p.x }))
        .filter(p => p.s).sort((a, b) => a.x - b.x).map(p => p.s);
    };

    for (let a = 0; a < anchorIdx.length; a++) {
      const i = anchorIdx[a];
      const tokens = tokensOf(rows[i]);
      const amountTok = tokens[tokens.length - 1];

      // PASS 1 — anchor row only (unchanged behaviour).
      let hit = resolveLine(tokens, tokens.length - 1);
      let src = tokens;
      let banded = false;

      // PASS 2 — the whole band, only if pass 1 found no price.
      if (!hit || hit.noQty) {
        const range = bandRange(a);
        const band = bandTokens(range);
        // The amount is still taken from the anchor row; only stop the price
        // search before the anchor's amount token wherever it landed in x order.
        const stop = band.lastIndexOf(amountTok);
        const alt = resolveLine(band, stop > 0 ? stop : band.length - 1);
        if (alt && !alt.noQty) {
          hit = alt; src = band; banded = true;
          // Every row in the band is now attributed to THIS item, so a later
          // pass-1 item can't also claim one of them as its wrapped description.
          for (let r = range.from; r <= range.to; r++) consumedRows.add(r);
        }
      }

      if (!hit) { out.skippedRows.push({ erp: tokens[0], reason: 'harga tidak terbaca', raw: tokens.join(' ') }); continue; }
      if (hit.noQty) { out.skippedRows.push({ erp: tokens[0], reason: 'qty tidak terbaca', raw: tokens.join(' ') }); continue; }

      const { priceIdx, qty, unit } = hit;

      // BOOKKEEPING: a wrapped description row may only be consumed ONCE.
      //
      // The anchor row used to absorb rows[i-1] AND rows[i+1] with no record of
      // what had already been taken. For the common layout
      //     itemA / wrapA / itemB
      // `wrapA` was appended to A (as A's "next") and simultaneously prepended
      // to B (as B's "prev") — so a tyre's dimension string ended up labelling
      // the natural-rubber line underneath it.
      const descParts = hit.descParts.slice();
      const hasInlineDesc = descParts.length > 0;

      // The row ABOVE belongs to this item unless a previous anchor already
      // took it. SKIPPED in banded mode: the band already swept every row that
      // belongs to this item, so scanning neighbours again would duplicate them.
      if (!banded && i > 0 && !consumedRows.has(i - 1)) {
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
      if (!banded && i + 1 < rows.length && !consumedRows.has(i + 1)) {
        const nextTokens = rows[i + 1].parts.map(p => p.str.trim()).filter(Boolean);
        const afterTokens = (i + 2 < rows.length) ? rows[i + 2].parts.map(p => p.str.trim()).filter(Boolean) : [];
        const nextIsNextItemsHeader = afterTokens.length > 0 && ERP.test(afterTokens[0]);
        if (isDescContinuation(nextTokens) && !(nextIsNextItemsHeader && hasInlineDesc)) {
          descParts.push(...nextTokens);
          consumedRows.add(i + 1);
        }
      }
      const desc = descParts.join(' ').trim();

      const price = hit.price;
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
