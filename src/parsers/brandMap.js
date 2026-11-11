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
  // 拜森 = BISON, DAN EJAAN INGGRISNYA TIDAK DIAMBIL DARI KODE ERP-nya.
  //
  // Baris Sona menulis kode (ID-BISEN-TBR-BX) tapi mereknya BISON. Kode ERP
  // itu label internal, bukan sumber ejaan nama merek -- memanen ejaan dari
  // situ akan memasukkan 'BISEN' ke master dan merek itu tidak ada.
  // Kode ERP-nya memang BISEN dan itu BENAR -- dikonfirmasi pemiliknya.
  // Kode ERP dan nama merek adalah dua hal berbeda: yang satu label internal,
  // yang satu nama yang tercetak di label. Jangan disamakan.
  { zh: '拜森', canonical: 'BISON' },
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
  const bersih = s.replace(/无内|全诺|东南亚/g, '').replace(/\s+(TL|TT)$/i, '').trim().toUpperCase();
  // Lalu disnap ke ejaan resminya kalau dikenali, supaya GOLDENCROWN dan
  // GOLDEN CROWN tidak jadi dua merek yang berbeda di master.
  return ejaanResmi(bersih) || bersih;
}

// ---------------------------------------------------------------------------
// DAFTAR EJAAN RESMI MEREK.
//
// Peta di atas menjawab "Mandarin ini merek apa". Daftar ini menjawab
// pertanyaan yang berbeda dan ternyata lebih sering salah: "merek ini ejaannya
// yang mana". Diperiksa di basis data hari ini, satu merek bisa tersimpan
// dalam dua ejaan sekaligus:
//
//   GOLDEN CROWN 43 baris  vs  GOLDENCROWN 78 baris
//   HI-RUN        6 baris  vs  HIRUN       32 baris
//   TRUST TRACK   1 baris  vs  TRUSTTRACK 1 + TRUSTTRACKOVERALL 3
//
// Akibatnya bukan sekadar daftar yang berantakan: saringan "semua GOLDEN
// CROWN" melewatkan 78 baris, dan harga label per merek terbelah jadi dua
// kelompok yang tidak pernah dijumlahkan.
//
// Merek di bawah TIDAK punya nama Mandarin, dan itu diperiksa bukan
// diasumsikan: ke-23 merek yang disebut pemiliknya dicari di daftar produksi
// Sona, stok WH Indo dan jadwal kirim WH China -- nol dari 23 punya token
// Mandarin di barisnya. Mengarang nama Mandarin untuk mereka akan membuat
// pencarian cocok ke merek yang salah.
export const MEREK_RESMI = [
  // punya nama Mandarin (lihat DEFAULT_BRAND_MAP di atas)
  'CHAOYANG', 'WESTLAKE', 'YARTU', 'GOLDEN CROWN', 'GOODRIDE', 'TRAZANO',
  'NIPON', 'TRUST TRACK', 'BISON', 'TIANLI', 'ORNATE',
  // tanpa nama Mandarin -- daftar dari pemiliknya
  'DIDAR', 'VITOUR', 'ANTINI', 'IRONMAN', 'HERCULES', 'TRANSEAGLE', 'SUPERMAX',
  'HI-RUN', 'ITARO', 'GRIPMASTER', 'XBRI', 'NEBULA', 'REDCLIFF', 'ARISUN',
  'FREECOUNTRY', 'XCELLENT', 'AMERICAN ROADSTAR', 'ARROYO', 'OMNIMAX',
  'CAPITOL', 'VANTAGE', 'ASPIRA',
  // ada di basis data tapi belum ada di daftar mana pun -- ditemukan waktu
  // membandingkan daftar pemiliknya dengan isi items + designs
  'TRAVELSTAR', 'MASTERTRACK', 'BRANSALES', 'TECHKING', 'EFFIPLUS', 'AGGRESSOR',
  'ASCENDO', 'UNITED', 'TIBER', 'RODOFORT', 'SEDONA', 'BLACKARROW', 'RISEN',
  'SUDESTE', 'TKV', 'OMNI CARGO', 'TUCSON', 'STRADA',
  // STRADA, bukan STRADAR. Basis data memuat keduanya 2 baris masing-masing,
  // jadi datanya sendiri tidak bisa memutuskan mana yang benar -- yang
  // memutuskan pemiliknya. STRADAR dibiarkan TIDAK terdaftar dengan sengaja:
  // begitu ejaan resminya ada, ejaanResmi() menyetel 'STRADAR' ke... tidak ke
  // mana-mana, karena huruf R-nya membuat bentuk padatnya berbeda. Dua baris
  // itu harus dibetulkan di master, bukan disembunyikan oleh pemetaan.
];

const padat = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const RESMI_PADAT = new Map(MEREK_RESMI.map(m => [padat(m), m]));

/**
 * Mengembalikan ejaan resmi sebuah merek, atau '' kalau tidak dikenali.
 * GOLDENCROWN -> GOLDEN CROWN, HIRUN -> HI-RUN, hi run -> HI-RUN.
 */
export function ejaanResmi(raw) {
  return RESMI_PADAT.get(padat(raw)) || '';
}
