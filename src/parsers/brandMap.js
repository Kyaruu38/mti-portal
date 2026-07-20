// Brand mapping: Mandarin brand -> canonical English brand.
// Grounded in the sample label files (威狮=WESTLAKE, 全诺=TRAZANO, 雅度=YARTU,
// 朝阳=CHAOYANG, 金冠=GOLDEN CROWN) plus the spec example 路诚=LUCHENG.
// This is a seed; the Master Data > Brand Mapping screen upserts more at runtime.

export const DEFAULT_BRAND_MAP = [
  { zh: '威狮', canonical: 'WESTLAKE' },
  { zh: '全诺', canonical: 'TRAZANO' },
  { zh: '雅度', canonical: 'YARTU' },
  { zh: '朝阳', canonical: 'CHAOYANG' },
  { zh: '金冠', canonical: 'GOLDEN CROWN' },
  { zh: '路诚', canonical: 'LUCHENG' },
  { zh: '好运', canonical: 'GOODLUCK' },
  { zh: '前进', canonical: 'ADVANCE' },
];

// Resolve any brand token (zh or en) to canonical uppercase English.
export function canonicalBrand(raw, map = DEFAULT_BRAND_MAP) {
  if (!raw) return '';
  const s = String(raw).trim();
  const hit = map.find(m => m.zh === s || s.includes(m.zh));
  if (hit) return hit.canonical;
  // Already English-ish: normalize casing, strip 无内 / TL / TT noise.
  return s.replace(/无内|全诺|东南亚/g, '').replace(/\s+(TL|TT)$/i, '').trim().toUpperCase();
}
