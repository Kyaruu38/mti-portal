// ---------------------------------------------------------------------------
// PENCARIAN DESIGN LIBRARY.
//
// Penyaring corong yang sudah ada mencocokkan TEKS PERSIS per kolom, dan itu
// cuma menolong orang yang sudah tahu persis apa yang dia cari. Isi kartunya
// begini:
//
//   01050458005ID
//   (ID-IRONMAN-TBR-OEM)ID295/75R22.5-14PR(144/141L)[I-28D]IRONMAN TL SMARTWAY
//
// Orang yang mencari ban itu mengetik "295/75R22.5", atau "295 75 r225", atau
// "ironman 295", atau "i28d", atau salah ketik "goodrige". Tidak satu pun dari
// itu cocok dengan pencocokan teks persis per kolom, dan hasilnya kosong —
// yang dibaca sebagai "designnya tidak ada", padahal designnya ada.
//
// Empat hal yang dikerjakan di sini, dan tiap-tiapnya dari bentuk data yang
// sebenarnya:
//
//   LINTAS KOLOM. Satu kotak menyapu erp, spec, brand, market, versi, catatan
//   dan tanggal. Orang tidak tahu "295/75R22.5" itu tersimpan di kolom mana,
//   dan memang tidak perlu tahu.
//
//   TAHAN BEDA PEMISAH. "295/75R22.5", "295-75-R22.5" dan "295 75 r225"
//   menunjuk ban yang sama. Tiap teks disimpan dua rupa: apa adanya, dan
//   bentuk PADAT yang seluruh tanda bacanya dibuang. Pencocokan padat inilah
//   yang membuat ketiganya ketemu, termasuk kode pattern "[I-28D]" yang
//   diketik "i28d".
//
//   BANYAK KATA = DAN, BUKAN ATAU. "ironman 295" berarti dua-duanya harus ada,
//   boleh di kolom berbeda. Kalau ATAU, mengetik lebih spesifik justru
//   memperbanyak hasil, dan itu kebalikan dari yang diharapkan orang.
//
//   TAHAN SALAH KETIK, TAPI PALING BELAKANG. "goodrige" tetap menemukan
//   GOODRIDE lewat jarak edit, tapi hasil yang cocok persis selalu di atas.
//   Toleransinya dibatasi panjang kata: kata pendek seperti "TL" atau "SNI"
//   tidak pernah difuzzy-kan, karena pada kata tiga huruf jarak satu edit
//   mencakup hampir seluruh kamus.
// ---------------------------------------------------------------------------

/** Buang tanda baca dan spasi; dipakai buat mencocokkan lintas gaya penulisan. */
export function padatkan(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const kataDari = (s) => String(s == null ? '' : s).toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);

// MEDAN YANG DISAPU, beserta bobotnya. erp dan spec yang paling sering jadi
// titik masuk, jadi kecocokan di situ naik lebih tinggi.
const MEDAN = [
  { k: 'erp',        bobot: 0 },
  { k: 'spec',       bobot: 1 },
  { k: 'brand',      bobot: 2 },
  { k: 'market',     bobot: 3 },
  { k: 'ver',        bobot: 4 },
  { k: 'catatan',    bobot: 5 },
  { k: 'updated',    bobot: 5 },
  { k: 'dibuatDari', bobot: 6 },
];

// INDEKS DISIMPAN DI LUAR BARISNYA, DAN DICEK BASI.
//
// Versi pertama menempelkan indeksnya ke objek designnya sendiri
// (`rows[i].__idx = ...`). Itu cepat dan salah: layar ini menyunting design di
// tempat, jadi sesudah spec-nya diubah, indeksnya masih memegang spec yang
// lama -- design yang baru saja diperbaiki tidak bisa ditemukan dengan isi
// barunya, dan masih ditemukan dengan isi lamanya. Tidak ada yang error.
const simpanan = new WeakMap();
const sidik = (d) => [d.erp, d.spec, d.brand, d.market, d.ver, d.updated, d.catatan, d.dibuatDari].join('\u0001');

function indeksCache(d) {
  const s = sidik(d);
  const ada = simpanan.get(d);
  if (ada && ada.sidik === s) return ada.idx;
  const idx = indeks(d);
  simpanan.set(d, { sidik: s, idx });
  return idx;
}

/** Indeks satu baris design. Dibuat sekali per baris, dipakai tiap ketikan. */
export function indeks(d) {
  const medan = MEDAN.map(m => {
    const mentah = String(d[m.k] == null ? '' : d[m.k]);
    const padat = padatkan(mentah);
    // Bentuk ANGKA SAJA: ukuran ban sering diketik tanpa hurufnya --
    // "295 75 22.5" untuk 295/75R22.5. Bentuk padat tidak menolong di situ
    // karena huruf R-nya masih di tengah.
    return { k: m.k, bobot: m.bobot, teks: mentah.toLowerCase(), padat, angka: padat.replace(/[^0-9]+/g, '') };
  }).filter(m => m.teks);
  const kata = new Set();
  for (const m of medan) for (const w of kataDari(m.teks)) kata.add(w);
  return { medan, kata: [...kata] };
}

// Jarak edit dengan ambang: berhenti begitu sudah pasti melewati batas.
// Tanpa ambang, 635 design x belasan kata x tiap ketikan jadi mahal tanpa
// guna — yang jaraknya 5 sama tidak bergunanya dengan yang jaraknya 50.
export function jarakEdit(a, b, batas = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > batas) return batas + 1;
  const n = a.length, m = b.length;
  let baris = new Array(m + 1);
  for (let j = 0; j <= m; j++) baris[j] = j;
  for (let i = 1; i <= n; i++) {
    let prev = baris[0];
    baris[0] = i;
    let minBaris = baris[0];
    for (let j = 1; j <= m; j++) {
      const simpan = baris[j];
      baris[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, baris[j], baris[j - 1]);
      prev = simpan;
      if (baris[j] < minBaris) minBaris = baris[j];
    }
    if (minBaris > batas) return batas + 1;
  }
  return baris[m];
}

// Berapa salah ketik yang dimaafkan, menurut panjang katanya. Kata pendek
// tidak dimaafkan sama sekali: pada "sni" jarak satu edit juga mencakup "sri",
// "sno", "ani" dan selusin kata lain yang tidak ada hubungannya.
const batasFuzzy = (n) => (n >= 7 ? 2 : n >= 5 ? 1 : 0);

/**
 * Skor satu kata kunci terhadap satu baris. Makin kecil makin cocok;
 * null artinya tidak cocok sama sekali.
 */
function skorKata(idx, kata) {
  const kataPadat = padatkan(kata);
  let terbaik = null;
  for (const m of idx.medan) {
    let s = null;
    if (m.teks === kata || m.padat === kataPadat) s = 0;              // sama persis
    else if (m.teks.startsWith(kata) || m.padat.startsWith(kataPadat)) s = 10;
    else if (m.teks.includes(kata)) s = 20;
    else if (kataPadat && m.padat.includes(kataPadat)) s = 30;        // beda pemisah
    // Angka saja, dan hanya untuk kata yang cukup panjang. Di bawah lima
    // digit angkanya terlalu umum: "18" ada di hampir setiap spec, dan
    // mencocokkannya mengembalikan seluruh pustaka.
    else if (/^[0-9]{5,}$/.test(kataPadat) && m.angka.includes(kataPadat)) s = 40;
    if (s != null) {
      const nilai = s + m.bobot;
      if (terbaik == null || nilai < terbaik) terbaik = nilai;
    }
  }
  if (terbaik != null) return terbaik;

  const batas = batasFuzzy(kata.length);
  if (!batas) return null;
  let jarakTerbaik = batas + 1;
  for (const w of idx.kata) {
    const j = jarakEdit(kata, w, batas);
    if (j < jarakTerbaik) jarakTerbaik = j;
    if (jarakTerbaik === 1) break;
  }
  // Salah ketik selalu di bawah semua yang cocok beneran.
  return jarakTerbaik <= batas ? 100 + jarakTerbaik * 10 : null;
}

/**
 * @param {Array} rows   daftar design
 * @param {string} kueri apa yang diketik orangnya
 * @returns {Array} baris yang cocok, diurut dari yang paling cocok
 */
export function cariDesain(rows, kueri) {
  const q = String(kueri == null ? '' : kueri).trim().toLowerCase();
  if (!q) return rows;
  const kata = q.split(/\s+/).filter(Boolean);

  const hasil = [];
  for (let i = 0; i < rows.length; i++) {
    const idx = indeksCache(rows[i]);
    let total = 0, cocokSemua = true;
    for (const k of kata) {
      const s = skorKata(idx, k);
      // SEMUA kata harus cocok. Kalau salah satunya tidak, barisnya gugur --
      // mengetik lebih spesifik harus MEMPERSEMPIT, bukan memperbanyak.
      if (s == null) { cocokSemua = false; break; }
      total += s;
    }
    if (cocokSemua) hasil.push({ baris: rows[i], skor: total, urut: i });
  }
  hasil.sort((a, b) => a.skor - b.skor || a.urut - b.urut);
  return hasil.map(x => x.baris);
}

/** Dipakai layar buat menjelaskan hasil kosong tanpa menebak-nebak. */
export function adaYangMirip(rows, kueri) {
  const kata = String(kueri || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (kata.length < 2) return null;
  for (const k of kata) {
    if (cariDesain(rows, k).length) return k;
  }
  return null;
}
