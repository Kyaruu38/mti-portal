// Merek ban yang labelnya dicetak di sini, dengan warna resminya.
//
// SUMBERNYA
// -----------------------------------------------------------------------------
// 中策橡胶品牌logo及色标.pdf — lembar standar logo dan warna resmi ZC Rubber,
// diberikan Kyaru 7 Agustus 2026. Isinya CMYK dan Pantone untuk tiap merek.
//
// Nilai hex di bawah TIDAK dihitung ulang dari CMYK. Dia diambil langsung dari
// blok warna di dokumen itu sendiri — halamannya dirender lalu warnanya dibaca
// dari piksel banner tiap merek. Konversi CMYK ke RGB butuh profil warna yang
// tidak disebutkan di dokumen mana pun; membaca hasil cetaknya sendiri melewati
// tebakan itu sepenuhnya.
//
// Pantone-nya ikut dicatat karena itulah yang dipakai bicara dengan pemasok
// label. Portal tidak memakainya, tapi yang membuka berkas ini suatu hari
// mungkin butuh menyebutnya.
//
// SEBELUM DOKUMEN INI ADA, ENAM DARI TUJUH WARNA DI SINI TEBAKAN — DAN LIMA
// DI ANTARANYA SALAH:
//     GOODRIDE  ditebak merah    → sebenarnya HIJAU
//     CHAOYANG  ditebak biru     → sebenarnya MERAH
//     TRAZANO   ditebak biru tua → sebenarnya ORANYE
//     YARTU     ditebak ungu     → sebenarnya ABU-ABU
//     ARISUN    ditebak oranye   → sebenarnya HITAM
// Cuma WESTLAKE yang arahnya benar (hijau), itu pun rona yang salah.
// Dicatat di sini bukan sebagai penyesalan, tapi sebagai alasan kenapa baris
// `sumber` di bawah ada: yang tidak berasal dari dokumen harus kelihatan.

export const BRANDS = [
  {
    nama: 'WESTLAKE', zh: '威狮',
    warna: '#104629',        // PANTONE 343 C · C100 M50 Y100 K40
    kedua: '#FBC707',        // PANTONE 7406 C · C0 M20 Y100 K0
    sumber: 'resmi',
  },
  {
    nama: 'GOODRIDE', zh: '好运',
    warna: '#26B255',        // PANTONE 354 C · C85 M0 Y90 K0
    // Terlalu terang untuk teks putih di atasnya. Ditandai, bukan dihitung:
    // tujuh merek tidak butuh rumus kontras, dan rumus yang meleset sekali akan
    // meleset diam-diam — teks putih di atas hijau muda tetap TERBACA, cuma
    // buruk, jadi tidak ada yang akan melaporkannya.
    teksGelap: true,
    sumber: 'resmi',
  },
  {
    nama: 'CHAOYANG', zh: '朝阳',
    warna: '#ED1C24',        // PANTONE 1795 C · C0 M100 Y100 K0
    sumber: 'resmi',
  },
  {
    nama: 'TRAZANO', zh: '全诺',
    warna: '#F47216',        // PANTONE 151 C · C0 M60 Y100 K0
    kedua: '#231F20',        // PANTONE Process Black C
    teksGelap: true,
    sumber: 'resmi',
  },
  {
    nama: 'ARISUN', zh: '',
    warna: '#231F20',        // PANTONE Process Black C — warna utama resminya
    kedua: '#ED1C24',        // PANTONE 1795 C
    // HITAM TIDAK BISA DIPAKAI SEBAGAI WARNA LENCANA, dan itu bukan soal selera.
    // Portal punya tema gelap dengan latar #0F1522. Lencana hitam di atasnya
    // tidak terlihat; dicerahkan otomatis pun hasilnya abu-abu — yang berarti
    // ARISUN jadi kembar dengan YARTU, dan dua merek berbeda dengan warna yang
    // sama lebih buruk daripada tidak berwarna sama sekali.
    // Jadi lencananya memakai warna KEDUA yang resmi, bukan warna karangan.
    warnaUi: '#ED1C24',
    sumber: 'resmi',
  },
  {
    nama: 'YARTU', zh: '雅度',
    warna: '#706D6E',        // PANTONE 75% Process Black C · C0 M0 Y0 K65
    sumber: 'resmi',
  },
  {
    nama: 'TIANLI', zh: '天力',
    // TIDAK ADA di lembar standar. Dokumen itu memuat enam merek — ZC Rubber
    // induknya plus WEST LAKE, GOODRIDE, TRAZANO, CHAOYANG, ARISUN, YARTU —
    // dan TIANLI bukan salah satunya.
    //
    // Yang dipakai sementara adalah tosca: sengaja jauh dari kedua hijau yang
    // sudah terpakai (WESTLAKE #104629 dan GOODRIDE #26B255) supaya tidak ada
    // yang mengira warnanya sudah benar. Ganti begitu lembar standarnya ada.
    warna: '#0F7B6C',
    sumber: 'sementara',
  },
];

// Hijau dan merah korporat ZC Rubber, dari lembar yang sama.
// PANTONE 348 C dan 1795 C. Belum dipakai di mana pun — dicatat supaya tidak
// perlu dicari lagi kalau suatu hari layar butuh warna induknya.
export const ZC = { hijau: '#00A650', merah: '#ED1C24' };

// Dicocokkan longgar: nama merek datang dari kolom Excel yang diketik manusia,
// jadi 'Westlake', 'WEST LAKE', dan 'westlake ' harus sama-sama ketemu.
const kunci = s => String(s || '').replace(/\s+/g, '').toUpperCase();
const PETA = new Map(BRANDS.map(b => [kunci(b.nama), b]));

// Warna untuk DIPAKAI DI LAYAR. Sengaja terpisah dari `warna` — lihat catatan
// ARISUN di atas: warna resminya tetap tercatat apa adanya, yang berbeda cuma
// yang dipakai menggambar.
export function warnaMerek(nama, bawaan = null) {
  const b = PETA.get(kunci(nama));
  return b ? (b.warnaUi || b.warna) : bawaan;
}

export function merek(nama) { return PETA.get(kunci(nama)) || null; }

// Warna teks di ATAS warna merek (dipakai pita layar boot, yang latarnya warna
// merek penuh). Lihat catatan teksGelap di GOODRIDE.
export function teksDiAtasMerek(nama) {
  const b = PETA.get(kunci(nama));
  return (b && b.teksGelap) ? '#17263F' : '#FFFFFF';
}
