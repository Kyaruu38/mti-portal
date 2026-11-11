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
  // Hasil peta Mandarin JUGA disnap ke ejaan resmi, bukan dipercaya apa adanya.
  // Isi tabel brand_map datang dari panen dan dari layar Master Data, jadi dia
  // bisa memuat 'BISEN' atau 'GOODLUCK' -- dan kalau dipercaya mentah, satu
  // baris peta yang salah mengalahkan seluruh daftar ejaan resmi di bawah.
  if (hit) return ejaanResmi(hit.canonical) || hit.canonical;
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
  'SUDESTE', 'TKV', 'OMNI CARGO', 'TUCSON', 'STRADA', 'STRYKER',
  // STRADA (bukan STRADAR) dan STRYKER (bukan SRYKER) -- dua-duanya diputuskan
  // pemiliknya, karena datanya sendiri tidak bisa memutuskan: basis data memuat
  // STRADA dan STRADAR masing-masing 2 baris. Yang SALAH tidak didaftarkan di
  // sini -- dia masuk ALIAS_MEREK di bawah, supaya ejaan yang benar yang
  // tersimpan sementara ejaan yang salah tetap DIKENALI waktu dibaca.
];

// ---------------------------------------------------------------------------
// EJAAN SALAH DAN NAMA LAMA YANG TETAP HARUS DIKENALI.
//
// padat() di bawah sudah menyatukan beda spasi, tanda hubung dan huruf besar
// kecil -- GOLDENCROWN, 'golden crown' dan 'Golden  Crown' bentuk padatnya
// sama, jadi ketiganya otomatis menyetel ke GOLDEN CROWN tanpa perlu didaftar.
// HIRUN / HI-RUN / 'hi run' sama ceritanya.
//
// Yang TIDAK bisa diselesaikan padat() adalah ejaan yang hurufnya memang
// berbeda. 'SRYKER' dan 'STRYKER' beda satu huruf T, jadi bentuk padatnya
// berbeda dan tidak akan pernah bertemu. Untuk kelas ini satu-satunya jalan
// adalah didaftarkan, dan itu isi tabel di bawah.
//
// ATURANNYA SATU ARAH, DAN ITU YANG PENTING: yang kiri NGGAK pernah ditulis
// ke mana pun. Dia cuma dikenali waktu dibaca -- dari lembar Excel, dari nama
// barang, dari kolom merek yang sudah lama tersimpan salah -- lalu diterjemahkan
// ke yang kanan. Yang masuk JSON, masuk basis data dan tercetak di label selalu
// yang kanan. Jadi lembar yang menulis SRYKER tetap ketemu barangnya, tanpa
// memasukkan merek bernama SRYKER ke master.
//
// Setiap baris di sini ada yang memutuskan, bukan ditebak:
//   GOODLUCK   -> dulu bibit brandMap.js menulis 好运 = GOODLUCK. Dibantah
//                 data kerja sendiri (35 baris 好运 berpasangan ID-GR-..., dan
//                 baris Sona menulis 'GOODRIDE(好运)' terang-terangan) lalu
//                 dikonfirmasi pemiliknya: "untuk goodluck semuanya ganti
//                 goodride".
//   LUNCHENG   -> nama lama 路诚. Pemiliknya: "luncheng itu ganti jadi TRUST
//                 TRACK". LUCHENG ikut karena ejaan itu juga beredar.
//   TRUST TRACK OVERALL
//              -> kode ERP di baris Sona (ID-TRUST TRACK OVERALL-TBR-BX), 3
//                 baris. Dikonfirmasi: "Itu ttp trusttrack".
//   BISEN      -> KODE ERP-nya, dan kode ERP-nya memang BISEN -- itu BENAR dan
//                 tidak diubah di mana pun. Yang tidak benar adalah memakainya
//                 sebagai NAMA MEREK. Pemiliknya: "itu namanya BISON tpi kode
//                 ERP nya BISEN".
//   STRADAR    -> salah ketik STRADA. SRYKER -> salah ketik STRYKER. Dua-duanya
//                 diputuskan pemiliknya karena jumlah barisnya seri di basis
//                 data dan datanya tidak bisa memutuskan sendiri.
//
// '95H CAPITOL' SEKARANG ADA DI SINI, dan cara dia masuk yang penting: dia
// tidak masuk waktu ditemukan, dia masuk waktu DIJAWAB. Sewaktu ditemukan
// (1 baris di basis data) dia dilempar ke daftar PERLU DICEK dan pemiliknya
// yang memutuskan: "95H CAPITOL itu masuk capitol". Itu urutan yang harus
// dipertahankan untuk nilai aneh berikutnya -- tanya dulu, daftarkan sesudah
// dijawab. Yang tidak boleh adalah menyimpulkan CAPITOL dari '95H CAPITOL'
// sendiri, karena ejaan yang kebetulan mirip bukan bukti.
export const ALIAS_MEREK = [
  { salah: 'GOODLUCK', resmi: 'GOODRIDE' },
  { salah: 'GOOD LUCK', resmi: 'GOODRIDE' },
  { salah: 'LUNCHENG', resmi: 'TRUST TRACK' },
  { salah: 'LUCHENG', resmi: 'TRUST TRACK' },
  { salah: 'TRUST TRACK OVERALL', resmi: 'TRUST TRACK' },
  { salah: 'BISEN', resmi: 'BISON' },
  { salah: 'STRADAR', resmi: 'STRADA' },
  { salah: 'SRYKER', resmi: 'STRYKER' },
  // '95H CAPITOL' -> CAPITOL. Dikonfirmasi pemiliknya: "95H CAPITOL itu masuk
  // capitol". 95H indeks beban + simbol kecepatan yang bocor dari kolom
  // sebelahnya; mereknya CAPITOL. Sebelum dikonfirmasi baris ini SENGAJA tidak
  // ada di sini, karena menyimpulkan CAPITOL dari situ sendiri berarti menebak
  // -- dan menebak merek berarti mencetak label merek yang salah.
  { salah: '95H CAPITOL', resmi: 'CAPITOL' },
];

const padat = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const RESMI_PADAT = new Map(MEREK_RESMI.map(m => [padat(m), m]));
const ALIAS_PADAT = new Map(ALIAS_MEREK.map(a => [padat(a.salah), a.resmi]));

/**
 * Mengembalikan ejaan resmi sebuah merek, atau '' kalau tidak dikenali.
 * GOLDENCROWN -> GOLDEN CROWN, HIRUN -> HI-RUN, hi run -> HI-RUN,
 * SRYKER -> STRYKER, BISEN -> BISON, 'trust track overall' -> TRUST TRACK.
 *
 * Daftar resmi diperiksa DULUAN. Kalau suatu hari ada ejaan yang terdaftar di
 * dua-duanya, yang resmi yang menang -- alias tidak boleh bisa membajak merek
 * yang sudah sah.
 */
export function ejaanResmi(raw) {
  const k = padat(raw);
  return RESMI_PADAT.get(k) || ALIAS_PADAT.get(k) || '';
}

/**
 * true kalau merek ini dikenali portal (ejaan resmi atau alias yang terdaftar).
 * Dipakai jalur unggah Excel untuk memutuskan baris mana yang harus DICEK
 * orangnya, bukan diterima diam-diam atau dibuang diam-diam.
 */
export function merekDikenal(raw) {
  return !!ejaanResmi(raw);
}
