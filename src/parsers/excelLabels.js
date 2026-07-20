// Rule-based parser for label-request Excel sheets.
// Grounded in samples: 7.15缺货标签下单.xls, local items7月份排产计划.xlsx.
//
// Header row columns (by NAME, order varies between sheets):
//   market | ERP Label Code - Chinese | ERP Label Code - English | 规格 specification
//   有无模版 template | EANCODE | ERP CODE | 品牌 Brand | TT/TL | [PR] | M+S标记
//   泥雪地 牵引标识位置 | QTY | RR | W1.24t | 噪音 | 噪音等级 | pickup date
//
// THE SHIFTED-PR-HEADER BUG: some sheets omit the "PR" header, so every column
// to the right of TT/TL shifts by one. We detect this by TYPE-VALIDATION of the
// QTY column (must be numeric) and auto-correct, surfacing a warning.

import { parseItemName } from './itemName.js';

// Header alias -> canonical key. Matched case-insensitively as substrings.
const ALIASES = [
  ['market', [/^market$/i, /市场/]],
  ['nameZh', [/chinese/i, /物料名称/, /物料名字/]],
  ['nameEn', [/english/i]],
  ['spec', [/spec/i, /规格/]],
  ['template', [/template/i, /有无模版/, /有无模板/]],
  ['ean', [/ean/i]],
  ['erp', [/^erp\s*code$/i, /物料编号/]],
  ['brand', [/brand/i, /品牌/]],
  ['ttl', [/tt\s*\/\s*tl/i, /^tt.?tl$/i]],
  ['pr', [/^pr$/i, /ply/i]],
  ['ms', [/m\s*\+\s*s/i]],
  ['snow', [/泥雪地/, /牵引标识/]],
  ['qty', [/^qty$/i, /数量/, /申请数量/]],
  ['rr', [/^rr$/i]],
  ['noise', [/噪音$/, /^噪音$/]],
  ['noiseClass', [/噪音等级/]],
  ['pickup', [/pickup/i, /需求日期/]],
];

function matchHeader(cell) {
  const s = String(cell || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [key, pats] of ALIASES) {
    if (pats.some(p => p.test(s))) return key;
  }
  return null;
}

// Find the header row within the first `scan` rows (row that maps the most columns).
function findHeaderRow(rows, scan = 8) {
  let best = { idx: -1, map: {}, hits: 0 };
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const row = rows[i] || [];
    const map = {};
    let hits = 0;
    row.forEach((cell, c) => {
      const key = matchHeader(cell);
      if (key && map[key] == null) { map[key] = c; hits++; }
    });
    if (hits > best.hits) best = { idx: i, map, hits };
  }
  return best;
}

const NUMERIC = v => v !== '' && v != null && !isNaN(Number(String(v).replace(/[,\s]/g, '')));
const toNum = v => Number(String(v).replace(/[,\s]/g, ''));
const ERP_RE = /^\d{6,}[A-Za-z]{0,3}$|^MTI-|^\d{4,}ID$/;

// Validate & auto-correct the QTY column via type inspection of data rows.
function correctQty(rows, headerIdx, map) {
  const dataRows = rows.slice(headerIdx + 1).filter(r => r && r.some(c => c !== ''));
  const sample = dataRows.filter(r => (r[map.erp] != null && String(r[map.erp]).trim())).slice(0, 20);
  if (!sample.length || map.qty == null) return { map, shifted: false };

  const numericAt = col => sample.filter(r => NUMERIC(r[col])).length / sample.length;
  const declared = numericAt(map.qty);
  if (declared >= 0.6) return { map, shifted: false };

  // QTY column isn't numeric -> look at neighbours (the shift is usually +/-1..2).
  let bestCol = map.qty, bestScore = declared;
  for (const d of [-1, 1, -2, 2]) {
    const c = map.qty + d;
    if (c < 0) continue;
    const score = numericAt(c);
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }
  if (bestCol !== map.qty && bestScore >= 0.6) {
    const shift = bestCol - map.qty;
    const newMap = { ...map };
    // Shift every column at/after QTY's original position (right of TT/TL region).
    for (const k of ['pr', 'ms', 'snow', 'qty', 'rr', 'noise', 'noiseClass', 'pickup']) {
      if (newMap[k] != null) newMap[k] += shift;
    }
    return { map: newMap, shifted: true, shift };
  }
  return { map, shifted: false };
}

// Main entry. rows = array-of-arrays (SheetJS header:1). knownErps = Set of ERP codes.
export function parseLabelSheet(rows, { brandMap, knownErps = new Set() } = {}) {
  const warnings = [];
  const header = findHeaderRow(rows);
  if (header.idx < 0 || header.hits < 3) {
    return { ok: false, error: 'Header tidak terdeteksi (kolom market / ERP CODE / QTY tidak ditemukan).', warnings };
  }
  const { map, shifted } = correctQty(rows, header.idx, header.map);
  if (shifted) {
    warnings.push({
      type: 'shifted_pr',
      msg: 'Kolom "PR" hilang di sheet ini — kolom di kanan TT/TL bergeser. Otomatis dikoreksi lewat validasi tipe QTY.',
    });
  }

  const items = [];
  let section = '';
  let skipped = 0;

  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const first = String(row[0] ?? row[map.market] ?? '').trim().toLowerCase();

    // Section marker "newitems".
    if (first.replace(/\s/g, '') === 'newitems') { section = 'newitems'; continue; }
    if (!row.some(c => String(c ?? '').trim() !== '')) continue; // blank row

    const erp = String(get(row, map.erp)).trim();
    const qtyRaw = get(row, map.qty);
    // Skip rows without a numeric QTY (per spec).
    if (!NUMERIC(qtyRaw)) { skipped++; continue; }
    const qty = toNum(qtyRaw);
    if (qty <= 0) { skipped++; continue; }

    const nameEn = String(get(row, map.nameEn)).trim();
    const nameZh = String(get(row, map.nameZh)).trim();
    const parsed = parseItemName(nameEn || nameZh, brandMap);

    const market = String(get(row, map.market)).trim() || parsed.market;
    const brand = String(get(row, map.brand)).trim();
    const isNew = section === 'newitems' || (erp && !knownErps.has(erp)) || !erp;

    items.push({
      market,
      spec: String(get(row, map.spec)).trim() || parsed.spec,
      erp,
      ean: String(get(row, map.ean)).trim(),
      brand: brand || parsed.brand,
      ttl: String(get(row, map.ttl)).trim() || parsed.tube,
      pr: String(get(row, map.pr)).trim() || parsed.pr,
      ms: String(get(row, map.ms)).trim(),
      qty,
      unit: '张', // default unit for labels
      rr: String(get(row, map.rr)).trim(),
      noise: String(get(row, map.noise)).trim(),
      nameEn: nameEn || parsed.english,
      nameZh,
      hasTemplate: /✅|✔|有|yes|y/i.test(String(get(row, map.template)).trim()),
      isNew,
      section,
      _row: i,
    });
  }

  return {
    ok: true,
    warnings,
    columns: map,
    items,
    stats: { total: items.length, skipped, newItems: items.filter(x => x.isNew).length, headerRow: header.idx + 1 },
  };
}

function get(row, col) { return col == null ? '' : (row[col] ?? ''); }
