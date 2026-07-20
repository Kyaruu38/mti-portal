// Rule-based parser for tire/label item names, e.g.:
//   "(ID-WL-TBR-BX)ID295/80R22.5-18PR(152/149M)[AD733]WESTLAKE TL"
//   "(ID-YR-TBR-SNI)ID12.00R20-20PR(156/153F)[EZ345]雅度"
// Extracts market segment, spec, PR, load index, pattern code, brand, TT/TL.

import { canonicalBrand } from './brandMap.js';

export function parseItemName(raw, brandMap) {
  const s = String(raw || '').trim();
  const out = {
    raw: s, prefix: '', market: '', spec: '', pr: '', loadIndex: '',
    pattern: '', brand: '', tube: '', english: s, chinese: '',
  };
  if (!s) return out;

  // Leading segment code in parentheses e.g. (ID-WL-TBR-BX)
  const pre = s.match(/^\(([^)]+)\)/);
  if (pre) {
    out.prefix = pre[1];
    const segs = pre[1].split('-');
    // last segment usually the market channel: BX / OEM / PT / SNI / ATD
    out.market = (segs[segs.length - 1] || '').toUpperCase();
  }
  let body = pre ? s.slice(pre[0].length) : s;

  // Spec: starts with ID and captures up to the PR group.
  const spec = body.match(/ID[\d.\/RxX-]+/i);
  if (spec) out.spec = spec[0].toUpperCase();

  // PR (ply rating) e.g. 18PR
  const pr = body.match(/(\d+)\s*PR/i);
  if (pr) out.pr = pr[1] + 'PR';

  // Load/speed index in parentheses e.g. (152/149M)
  const li = body.match(/\((\d+\/\d+[A-Z]?)\)/);
  if (li) out.loadIndex = li[1];

  // Pattern code in brackets e.g. [AD733]
  const pat = body.match(/\[([^\]]+)\]/);
  if (pat) out.pattern = pat[1];

  // Tube type
  if (/\bTL\b/.test(body) || /无内/.test(body)) out.tube = 'TL';
  else if (/\bTT\b/.test(body)) out.tube = 'TT';

  // Brand: text after the last ] up to TT/TL, may be Mandarin.
  let brandRaw = '';
  if (pat) {
    brandRaw = body.slice(body.indexOf(']', body.indexOf(pat[1])) + 1);
    brandRaw = brandRaw.replace(/\b(TL|TT)\b/g, '').replace(/无内|东南亚|全诺/g, '').trim();
  }
  if (/[\u4e00-\u9fff]/.test(brandRaw)) out.chinese = brandRaw;
  out.brand = canonicalBrand(brandRaw || out.pattern, brandMap);

  return out;
}

// Choose an English-first description from paired ZH/EN name columns.
// Prefers the bracketed [..] English fallback -> full English -> ZH.
export function englishFirst(nameEn, nameZh) {
  const en = String(nameEn || '').trim();
  const zh = String(nameZh || '').trim();
  // If english col has actual latin content, use it.
  if (en && /[A-Za-z]/.test(en) && !/^[\u4e00-\u9fff]+$/.test(en)) return en;
  return en || zh;
}
