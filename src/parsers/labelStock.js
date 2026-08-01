// Rule-based parser for the Label Inventory Tracker workbook ("Master Tracker"
// sheet). Grounded in the real file: 984 data rows, 15 columns.
//
// WHAT THIS DOES AND DELIBERATELY DOES NOT DO
// -------------------------------------------
// The Excel is the source of truth — every displayed number comes from the
// sheet, unchanged. This parser ALSO recomputes each derived column and reports
// disagreements as `mismatches`. It never overwrites a value: a mismatch means
// "the sheet and the formula disagree, look at it", not "the sheet is wrong".
// That keeps one source of truth while making a broken formula or a
// paste-as-values accident impossible to miss.
//
// Duplicates are QUARANTINED, not dropped and not merged. A row whose
// (Spec Name, Market Code) pair appears more than once is held out of `items`
// and listed in `duplicates` with its real Excel row number, because merging
// would invent a stock figure and dropping would lose one silently. The rest of
// the sheet imports normally so the weekly routine is never blocked.

import { parseItemName } from './itemName.js';
import { parseNumber } from './numbers.js';

// ---------------------------------------------------------------------------
// Column aliases. Matched case-insensitively against the header row, so a
// renamed or reordered column keeps working. Same approach as excelLabels.js.
// ---------------------------------------------------------------------------
const ALIASES = [
  ['no',          [/^no\.?$/i, /^nomor$/i]],
  ['erp',         [/material\s*code/i, /^erp\s*code$/i, /物料编号/]],
  ['spec',        [/spec\s*name/i, /^spec$/i, /规格/]],
  ['market',      [/market\s*code/i, /^market$/i, /市场/]],
  ['stock',       [/current\s*label\s*stock/i, /^stock/i, /库存/]],
  ['production',  [/planned\s*production/i, /排产/]],
  ['sales',       [/planned\s*sales/i, /销售计划/]],
  ['buffer',      [/buffer/i]],
  ['requirement', [/label\s*requirement/i, /^requirement$/i, /需求/]],
  ['surplus',     [/surplus/i, /shortage/i]],
  ['status',      [/reorder\s*status/i, /^status$/i]],
  ['suggested',   [/suggested\s*order/i, /订单建议/]],
  ['week',        [/week\s*updated/i]],
];

function matchHeader(cell) {
  const s = String(cell == null ? '' : cell).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [key, pats] of ALIASES) if (pats.some(p => p.test(s))) return key;
  return null;
}

// The header is not guaranteed to be row 1 — the sibling sheets in this
// workbook carry two title rows above theirs.
function findHeaderRow(rows, scan = 10) {
  let best = { idx: -1, map: {}, hits: 0 };
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const map = {}; let hits = 0;
    (rows[i] || []).forEach((cell, c) => {
      const key = matchHeader(cell);
      if (key && map[key] == null) { map[key] = c; hits++; }
    });
    if (hits > best.hits) best = { idx: i, map, hits };
  }
  return best;
}

// ---------------------------------------------------------------------------
// THE FLOAT TRAP — read this before touching roundUpQty/requirementOf.
//
// Excel's ROUNDUP is fuzzy: it treats 737.0000000000001 as 737. JavaScript's
// Math.ceil is exact and gives 738. In the real file, 670 x 1.1 lands on
// 737.0000000000001 in IEEE-754, and 27 of the 984 rows hit this. A naive
// Math.ceil would therefore report 27 FALSE mismatches on a perfectly healthy
// sheet — and a cross-check that cries wolf 27 times a week gets ignored, which
// defeats the entire point of having one.
//
// Snapping to 9 decimal places before rounding reproduces Excel exactly:
// verified 0 mismatches across all 984 rows.
// ---------------------------------------------------------------------------
const EPS_DP = 9;
function ceilLikeExcel(x) {
  return Math.ceil(Number(x.toFixed(EPS_DP)));
}

export function requirementOf(production, bufferPct) {
  return ceilLikeExcel((Number(production) || 0) * (1 + (Number(bufferPct) || 0)));
}

// Printer MOQ rounding: a shortage of 12,141 with MOQ 500 orders 12,500.
export function suggestedQtyOf(surplus, moq = 500) {
  const s = Number(surplus) || 0;
  if (s >= 0) return 0;
  const m = Number(moq) || 1;
  return Math.ceil(-s / m) * m;
}

// Status rule, reverse-engineered from the workbook and verified against all
// 984 rows with ZERO disagreements:
//   no planned production      -> IDLE STOCK   (stock sitting with no demand)
//   short of requirement       -> BUY NOW
//   stock >= 2x requirement    -> OVERSTOCK
//   otherwise                  -> SUFFICIENT
// The 2x multiple is a business threshold, not a law of nature — it is a
// parameter so it can be changed in Master Data without touching this file.
export const OVERSTOCK_MULTIPLE = 2;
export function statusOf(stock, production, requirement, surplus, multiple = OVERSTOCK_MULTIPLE) {
  if ((Number(production) || 0) === 0) return 'IDLE STOCK';
  if ((Number(surplus) || 0) < 0) return 'BUY NOW';
  return (Number(stock) || 0) >= (Number(requirement) || 0) * multiple ? 'OVERSTOCK' : 'SUFFICIENT';
}

export const STATUSES = ['BUY NOW', 'SUFFICIENT', 'OVERSTOCK', 'IDLE STOCK'];

// Normalised join key. Trailing spaces and full-width/half-width differences in
// a pasted Market Code must not create a phantom "new" SKU every week.
//
// EVERY space is removed, not merely collapsed. The old rule squeezed runs of
// whitespace down to one and stopped there, so these two rows lived side by
// side in the tracker as separate SKUs for months:
//
//     ID10.00R20-18PR(149/146F)[CB332]  朝阳     (two spaces)
//     ID10.00R20-18PR(149/146F)[CB332]朝阳       (none)
//
// One physical label, entered twice. Both looked reasonable on their own, so
// nobody questioned either — and it only surfaced when both matched the SAME
// ERP code (010504214ID) during the bulk match, because THAT comparison dropped
// spaces entirely.
//
// The damage was quiet and arithmetical: stock split across two rows,
// requirement split with it, so BUY NOW and OVERSTOCK for that label were being
// decided on roughly half the real numbers.
//
// Spaces carry no meaning anywhere in these names — they are ERP export
// artefacts and typing accidents. Two label names that differ only in spacing
// are the same label, every time.
export function skuKey(spec, market) {
  const n = s => String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();
  return `${n(spec)}||${n(market)}`;
}

const num = v => {
  const n = parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array<Array>} rows   sheet as array-of-arrays (core/xlsx.js rows())
 * @param {object} opts         { moq, overstockMultiple }
 * @returns {object} see the shape documented at the top of this file
 */
export function parseLabelStockSheet(rows, opts = {}) {
  const moq = Number(opts.moq) || 500;
  const multiple = Number(opts.overstockMultiple) || OVERSTOCK_MULTIPLE;
  const warnings = [];

  const header = findHeaderRow(rows);
  // spec + stock are the minimum needed to say anything useful.
  if (header.idx < 0 || header.map.spec == null || header.map.stock == null) {
    return {
      ok: false,
      error: 'Header tidak terdeteksi — kolom "Spec Name" dan "Current Label Stock" wajib ada.',
      warnings,
    };
  }
  const m = header.map;
  for (const need of ['market', 'production', 'buffer', 'requirement', 'status']) {
    if (m[need] == null) warnings.push({ type: 'missing_column', msg: `Kolom "${need}" tidak ketemu — nilainya dianggap kosong.` });
  }

  const seen = new Map();   // skuKey -> [rowRecord]
  const parsed = [];
  let skipped = 0;

  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const spec = String(row[m.spec] == null ? '' : row[m.spec]).trim();
    if (!spec) { if (row.some(c => c !== '' && c != null)) skipped++; continue; }

    const market = m.market == null ? '' : String(row[m.market] == null ? '' : row[m.market]).trim();
    const stock = num(row[m.stock]);
    const production = m.production == null ? 0 : num(row[m.production]);
    const sales = m.sales == null ? 0 : num(row[m.sales]);
    const buffer = m.buffer == null ? 0 : num(row[m.buffer]);

    // AS PRINTED IN THE SHEET — these are what get stored and displayed.
    const sheetRequirement = m.requirement == null ? null : num(row[m.requirement]);
    const sheetSurplus = m.surplus == null ? null : num(row[m.surplus]);
    const sheetStatus = m.status == null ? '' : String(row[m.status] == null ? '' : row[m.status]).trim();
    const sheetSuggested = m.suggested == null ? null : num(row[m.suggested]);

    // RECOMPUTED — cross-check only, never substituted for the sheet's value.
    const calcRequirement = requirementOf(production, buffer);
    const calcSurplus = stock - calcRequirement;
    const calcStatus = statusOf(stock, production, calcRequirement, calcSurplus, multiple);
    const calcSuggested = suggestedQtyOf(calcSurplus, moq);

    const diff = [];
    if (sheetRequirement != null && sheetRequirement !== calcRequirement) diff.push({ field: 'requirement', sheet: sheetRequirement, calc: calcRequirement });
    if (sheetSurplus != null && sheetSurplus !== calcSurplus) diff.push({ field: 'surplus', sheet: sheetSurplus, calc: calcSurplus });
    if (sheetStatus && sheetStatus !== calcStatus) diff.push({ field: 'status', sheet: sheetStatus, calc: calcStatus });
    if (sheetSuggested != null && sheetSuggested !== calcSuggested) diff.push({ field: 'suggestedQty', sheet: sheetSuggested, calc: calcSuggested });

    const rec = {
      // +1 because sheet rows are 1-based; this is the number the user types
      // into Excel's Ctrl+G box, so it must be exact.
      excelRow: i + 1,
      no: m.no == null ? null : row[m.no],
      erp: m.erp == null ? '' : String(row[m.erp] == null ? '' : row[m.erp]).trim(),
      spec, market, key: skuKey(spec, market),
      stock, production, sales, buffer,
      requirement: sheetRequirement == null ? calcRequirement : sheetRequirement,
      surplus: sheetSurplus == null ? calcSurplus : sheetSurplus,
      status: sheetStatus || calcStatus,
      suggestedQty: sheetSuggested == null ? calcSuggested : sheetSuggested,
      week: m.week == null ? '' : row[m.week],
      calc: { requirement: calcRequirement, surplus: calcSurplus, status: calcStatus, suggestedQty: calcSuggested },
      mismatch: diff,
    };

    parsed.push(rec);
    if (!seen.has(rec.key)) seen.set(rec.key, []);
    seen.get(rec.key).push(rec);
  }

  // Split clean rows from duplicated ones. A duplicated key means EVERY row
  // carrying it is held back — we cannot know which one is authoritative.
  const items = [];
  const duplicates = [];
  for (const [key, group] of seen) {
    if (group.length === 1) { items.push(group[0]); continue; }
    duplicates.push({
      key,
      spec: group[0].spec,
      market: group[0].market,
      rows: group.map(r => ({ excelRow: r.excelRow, no: r.no, stock: r.stock, status: r.status })),
      // Shown so the user can see what merging WOULD give, without the parser
      // deciding to merge.
      combinedStock: group.reduce((s, r) => s + r.stock, 0),
      requirement: group[0].requirement,
    });
  }
  items.sort((a, b) => a.excelRow - b.excelRow);
  duplicates.sort((a, b) => a.rows[0].excelRow - b.rows[0].excelRow);

  if (duplicates.length) {
    warnings.push({
      type: 'duplicate_sku',
      msg: `${duplicates.length} spec muncul lebih dari sekali (${duplicates.reduce((s, d) => s + d.rows.length, 0)} baris). Baris-baris ini TIDAK diimpor — perbaiki di Excel lalu upload ulang.`,
    });
  }

  const mismatches = items.filter(r => r.mismatch.length);
  if (mismatches.length) {
    warnings.push({
      type: 'formula_mismatch',
      msg: `${mismatches.length} baris angkanya beda dari hasil hitung ulang. Nilai dari Excel tetap dipakai — tapi cek apakah ada rumus yang rusak atau kolom yang ke-paste sebagai angka mati.`,
    });
  }

  // ERP guess — a HINT for the one-time matching screen, never applied silently.
  // NOTE: the ERP guess is NOT computed here. The matching screen does it, for
  // the visible slice only — 974 rows x every candidate on each upload is wasted
  // work, and by then the candidate pool (item master + design library +
  // historical PO lines, see core/labelOrders.js erpCandidates) is far richer
  // than the item master alone.

  return {
    ok: true,
    headerIdx: header.idx,
    map: m,
    items,
    duplicates,
    mismatches,
    warnings,
    stats: {
      total: parsed.length,
      imported: items.length,
      duplicated: parsed.length - items.length,
      skipped,
      mismatched: mismatches.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Best-effort ERP suggestion. The tracker's Material Code column is empty for
// every row in the real file, so the portal has to bridge "long spec name" to
// "ERP code" itself. Confidence is returned alongside so the matching screen can
// sort the certain ones to the top and leave the rest for a human.
//
// Never auto-applied: a wrong ERP silently attributes another product's
// shipments to this SKU.
// ---------------------------------------------------------------------------
export function guessErp(rec, master) {
  const parsed = parseItemName(rec.spec, []);
  const norm = s => String(s || '').replace(/\s+/g, '').toUpperCase();
  const specN = norm(rec.spec);
  let best = null;

  for (const it of master) {
    if (!it.erp) continue;
    let score = 0;
    const itSpecN = norm(it.spec);
    if (itSpecN && itSpecN === specN) score = 1;                       // exact
    else if (itSpecN && (specN.includes(itSpecN) || itSpecN.includes(specN))) score = 0.8;
    else {
      // Pattern code is the most distinctive token and survives every naming
      // variant in this data ([AZ850], [ST600], [AT-1], [H-568]).
      if (parsed.pattern && norm(it.spec).includes(norm(parsed.pattern))) score += 0.5;
      if (parsed.loadIndex && norm(it.spec).includes(norm(parsed.loadIndex))) score += 0.25;
      if (parsed.pr && norm(it.spec).includes(norm(parsed.pr))) score += 0.15;
    }
    if (score > 0 && (!best || score > best.score)) best = { erp: it.erp, spec: it.spec, score };
  }
  return best && best.score >= 0.5 ? best : null;
}
