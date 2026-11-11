// Brand mapping: Mandarin brand -> canonical English brand.
// Grounded in the sample label files (威狮=WESTLAKE, 全诺=TRAZANO, 雅度=YARTU,
// 朝阳=CHAOYANG, 金冠=GOLDEN CROWN, 好运=GOODRIDE, 路诚=TRUST TRACK).
// This is a seed; the Master Data > Brand Mapping screen upserts more at runtime.

export const DEFAULT_BRAND_MAP = [
  { zh: '威狮', canonical: 'WESTLAKE' },
  { zh: '全诺', canonical: 'TRAZANO' },
  { zh: '雅度', canonical: 'YARTU' },
  { zh: '朝阳', canonical: 'CHAOYANG' },
  { zh: '金冠', canonical: 'GOLDEN CROWN' },
  { zh: '路诚', canonical: 'TRUST TRACK' },
  // 好运 ITU GOODRIDE, BUKAN GOODLUCK.
  //
  // Bibit ini sempat menulis GOODLUCK. Dipanen dari tiga berkas kerja yang
  // sebenarnya (daftar produksi Sona, stok WH Indo, jadwal kirim WH China):
  // 35 baris memasangkan 好运 dengan kode ERP (ID-GR-...), dan baris Sona
  // bahkan menuliskannya terang-terangan sebagai "GOODRIDE(好运)". Tidak ada
  // SATU pun baris GOODLUCK di ketiga berkas itu.
  { zh: '好运', canonical: 'GOODRIDE' },
  { zh: '天力', canonical: 'TIANLI' },
  { zh: '欧耐特', canonical: 'ORNATE' },
  { zh: '前进', canonical: 'ADVANCE' },
];

// Resolve any brand token (zh or en) to canonical uppercase English.
export function canonicalBrand(raw, map = DEFAULT_BRAND_MAP) {
  if (!raw) return '';
  // DAFTAR KOSONG DIPERLAKUKAN SEPERTI TIDAK DIISI.
  //
  // Nilai bawaan parameter hanya berlaku untuk `undefined`, dan SELURUH
  // pemanggil di portal mengoper st.brandMap apa adanya — yang isinya []
  // selama tabel brand_map di database masih kosong (dan hari ini memang
  // kosong, 0 baris). Jadi [] menang atas bawaannya, pencarian dilakukan di
  // daftar kosong, dan kedelapan bibit di bawah TIDAK PERNAH dipakai sekali
  // pun di produksi. Nama merek Mandarin lolos tanpa diterjemahkan ke cabang
  // "sudah English", lalu masuk master item apa adanya atau kosong.
  //
  // Diperiksa di basis data: 57 dari 1.583 item kolom mereknya kosong, dan
  // tidak ada satu pun merek GOODLUCK — bukan karena petanya benar,
  // melainkan karena petanya tidak pernah dibaca.
  if (!map || !map.length) map = DEFAULT_BRAND_MAP;
  const s = String(raw).trim();
  const hit = map.find(m => m.zh === s || s.includes(m.zh));
  if (hit) return hit.canonical;
  // Already English-ish: normalize casing, strip 无内 / TL / TT noise.
  return s.replace(/无内|全诺|东南亚/g, '').replace(/\s+(TL|TT)$/i, '').trim().toUpperCase();
}
