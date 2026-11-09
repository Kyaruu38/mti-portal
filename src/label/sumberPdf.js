// MENCOCOKKAN TEMPLAT KE SEBUAH BERKAS ARTWORK YANG NYATA.
//
// Jalur sulih perlu tahu DI MANA tiap medan berada DI BERKAS ITU, bukan di
// berkas acuan yang dipakai mengukur templat. Titik asalnya memang berpindah
// antar berkas -- itu temuan pengukurannya sejak awal -- jadi koordinat
// templat tidak bisa dipakai mentah-mentah.
//
// Caranya: jangkar dicari DI BERKASNYA, lalu offset templat dihitung dari
// jangkar itu. Yang tetap cuma jarak antar medan; titik asalnya ikut berkas.
//
// Kotak yang ditimpa diambil dari KOTAK ASLI teks yang ditemukan, bukan
// dikira-kira dari ukuran huruf: tulisan yang panjangnya berbeda butuh kotak
// yang berbeda, dan kotak yang kependekan meninggalkan potongan huruf lama
// di tepi -- sisa yang terlihat seperti cetakan kotor, bukan seperti salah.
const MM = 25.4 / 72;

// Jangkar per templat. Dicocokkan ke TEKSNYA karena itu yang tidak berubah
// antar produk; posisinya yang berubah.
export const JANGKAR = {
  'sni.json':    /LSPr-\d+-IDN/i,
  'bx-tbr.json': /made\s*in\s*indonesia/i,
  'bx-pcr.json': /made\s*in\s*indonesia/i,
  'pt-tbr.json': /made\s*in\s*indonesia/i,
  'pt-st.json':  /made\s*in\s*indonesia/i,
  'pt-pcr.json': /made\s*in\s*indonesia/i,
};

/**
 * Mengubah keluaran pdfjs jadi bentuk yang seragam, dalam MILIMETER dan
 * sumbu Y turun dari atas -- sama dengan satuan berkas templat.
 * @param {Array} items  page.getTextContent().items
 * @param {number} tinggiHalamanPt
 */
export function keMedanSumber(items, tinggiHalamanPt) {
  const out = [];
  for (const it of (items || [])) {
    const teks = String(it.str == null ? '' : it.str).trim();
    if (!teks) continue;
    const tr = it.transform || [1, 0, 0, 1, 0, 0];
    const x = tr[4], yAtas = tinggiHalamanPt - tr[5];
    // Teks diputar terbaca dari matriksnya: b dan c yang tidak nol.
    const diputar = Math.abs(tr[1]) > 0.5 || Math.abs(tr[2]) > 0.5;
    const w = it.width || 0, hgt = it.height || 0;
    out.push({
      teks,
      x: x * MM, y: yAtas * MM,
      lebar: (diputar ? hgt : w) * MM,
      tinggi: (diputar ? w : hgt) * MM,
      panjang: w * MM,
      diputar,
    });
  }
  return out;
}

export function cariJangkar(medanSumber, berkasTemplat) {
  const pola = JANGKAR[berkasTemplat];
  if (!pola) return { ok: false, sebab: `tidak ada jangkar terdaftar untuk ${berkasTemplat}` };
  const k = (medanSumber || []).find(m => pola.test(m.teks));
  if (!k) return { ok: false, sebab: `teks jangkar tidak ditemukan di berkas ini (${pola})` };
  return { ok: true, x: k.x, y: k.y, teks: k.teks };
}

/**
 * Untuk tiap medan templat, cari teks di berkas sumber yang paling dekat ke
 * posisi yang diharapkan. Mengembalikan kotak ASLI teks itu.
 *
 * TOLERANSInya sengaja ketat. Medan yang tidak ketemu dalam jarak itu
 * DILAPORKAN TIDAK KETEMU, bukan dipasangkan ke tetangga terdekat: memasang
 * nilai baru di atas medan yang salah menghasilkan label yang terlihat rapi
 * dan isinya tertukar, dan itu lebih berbahaya daripada medan yang kosong.
 */
export function cocokkanMedan(templat, medanSumber, jangkar, toleransiMm = 6) {
  const hasil = [];
  for (const m of (templat.medan || [])) {
    if (m.peran === 'titik asal') continue;
    const rataKanan = m.rata === 'kanan';
    const dx = (rataKanan && !m.putar && m.dX_ujung != null) ? m.dX_ujung : (m.dX || 0);
    const dy = (rataKanan && m.putar && m.dY_ujung != null) ? m.dY_ujung : (m.dY || 0);
    const hx = jangkar.x + dx, hy = jangkar.y + dy;
    let terbaik = null, jarakTerbaik = Infinity;
    for (const s of medanSumber) {
      const d = Math.hypot(s.x - hx, s.y - hy);
      if (d < jarakTerbaik) { jarakTerbaik = d; terbaik = s; }
    }
    if (!terbaik || jarakTerbaik > toleransiMm) {
      hasil.push({ k: m.k, ketemu: false, jarak: Number(jarakTerbaik.toFixed(2)) });
      continue;
    }
    hasil.push({
      k: m.k, ketemu: true, jarak: Number(jarakTerbaik.toFixed(2)),
      lama: terbaik.teks, putar: terbaik.diputar,
      kotak: {
        x0: terbaik.x, y0: terbaik.y - terbaik.tinggi,
        x1: terbaik.x + terbaik.lebar, y1: terbaik.y,
      },
    });
  }
  return hasil;
}

/**
 * SALINAN GANDA. Nilai yang sama sering dicetak dua kali di satu label
 * (panel dan tulang punggung). Satu salinan yang terlewat berarti label
 * membawa dua nilai yang saling bertentangan, dan itu terlihat benar
 * sekilas -- ragam gagal paling berbahaya di jalur ini.
 *
 * Di berkas yang punya lapisan teks, salinannya tidak perlu ditebak: teks
 * lamanya bisa DIBACA, jadi semua kemunculannya bisa dicari langsung.
 */
export function cariSalinan(medanSumber, teksLama, kecuali) {
  const t = String(teksLama || '').trim();
  if (!t) return [];
  return (medanSumber || [])
    .filter(s => s.teks === t)
    .filter(s => !kecuali || Math.hypot(s.x - kecuali.x0, s.y - kecuali.y1) > 0.5)
    .map(s => ({
      lama: s.teks, putar: s.diputar,
      kotak: { x0: s.x, y0: s.y - s.tinggi, x1: s.x + s.lebar, y1: s.y },
    }));
}
