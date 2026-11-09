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
    const b = tr[1];
    const x = tr[4] * MM;
    const yAtas = (tinggiHalamanPt - tr[5]) * MM;   // dari ATAS, sama dengan satuan templat
    const panjang = (it.width || 0) * MM;            // sepanjang arah baca
    const tebal = (it.height || 0) * MM;             // tinggi hurufnya

    // ARAH DIUKUR DARI MATRIKSNYA, TIDAK DIANGGAP SERAGAM.
    //
    // Diukur pada artwork SNI asli: teks diputar di situ punya a=0, b<0, c>0.
    // Arah bacanya adalah vektor (a,b) di ruang PDF yang sumbu Y-nya NAIK,
    // jadi b<0 berarti tulisannya berjalan TURUN di halaman, titik awalnya di
    // ujung ATAS, dan badan hurufnya melebar ke +x. Pasar lain memutar ke arah
    // sebaliknya (b>0): titik awal di ujung BAWAH, badan huruf ke -x.
    //
    // Versi pertama berkas ini menghitung kotaknya seolah semua teks putar
    // berjalan ke atas, jadi kotak penimpanya mendarat di SISI YANG SALAH --
    // nilai lamanya tidak tertutup sama sekali, dan nilai barunya ditulis
    // terbalik di tempat lain. Ujinya lolos karena datanya pun disusun dengan
    // asumsi yang sama salahnya; yang membongkarnya berkas asli dan gambarnya.
    let arah, kotak;
    if (Math.abs(b) > 0.01) {
      if (b < 0) {
        arah = 'turun';
        kotak = { x0: x, y0: yAtas, x1: x + tebal, y1: yAtas + panjang };
      } else {
        arah = 'naik';
        kotak = { x0: x - tebal, y0: yAtas - panjang, x1: x, y1: yAtas };
      }
    } else {
      arah = 'datar';
      kotak = { x0: x, y0: yAtas - tebal, x1: x + panjang, y1: yAtas };
    }
    out.push({
      // Matriks MENTAH (dalam poin) ikut dibawa: itu kunci yang dipakai
      // membuang teks lamanya dari content stream. Tanpa ini, penghapusan
      // harus menebak lewat teksnya, dan itu salah sasaran begitu nilai yang
      // sama muncul dua kali dengan arti berbeda.
      tm: [tr[0], tr[1], tr[2], tr[3], tr[4], tr[5]],
      teks, x, y: yAtas, panjang, tebal, arah,
      diputar: arah !== 'datar',
      lebar: kotak.x1 - kotak.x0,
      tinggi: kotak.y1 - kotak.y0,
      kotak,
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
    // MEDAN RATA-KANAN DIBANDINGKAN KE UJUNGNYA, bukan ke pangkalnya.
    //
    // Templat menyimpan dX_ujung/dY_ujung untuk medan rata-kanan: itu letak
    // UJUNG tulisannya. Tapi item di berkas sumber dilaporkan dari PANGKALnya.
    // Membandingkan ujung-harapan dengan pangkal-item membuat jaraknya meleset
    // sepanjang tulisannya sendiri -- untuk baris spesifikasi di kepala label
    // itu ~32 mm, jauh di luar toleransi 6 mm, jadi medannya dilaporkan tidak
    // ketemu dan nilai lamanya tetap tercetak. Back test menemukannya sebagai
    // '10.00R20-18PR' yang tidak pernah berubah.
    let terbaik = null, jarakTerbaik = Infinity;
    for (const s of medanSumber) {
      let sx = s.x, sy = s.y;
      if (rataKanan) {
        if (m.putar && s.arah === 'turun') sy = s.kotak.y1;
        else if (m.putar && s.arah === 'naik') sy = s.kotak.y0;
        else if (!m.putar) sx = s.kotak.x1;
      }
      const d = Math.hypot(sx - hx, sy - hy);
      if (d < jarakTerbaik) { jarakTerbaik = d; terbaik = s; }
    }
    if (!terbaik || jarakTerbaik > toleransiMm) {
      hasil.push({ k: m.k, ketemu: false, jarak: Number(jarakTerbaik.toFixed(2)) });
      continue;
    }
    hasil.push({
      k: m.k, ketemu: true, jarak: Number(jarakTerbaik.toFixed(2)),
      lama: terbaik.teks, putar: terbaik.diputar, arah: terbaik.arah,
      tm: terbaik.tm, kotak: { ...terbaik.kotak },
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
    .filter(s => !kecuali || Math.hypot(s.kotak.x0 - kecuali.x0, s.kotak.y0 - kecuali.y0) > 0.5)
    .map(s => ({ lama: s.teks, putar: s.diputar, arah: s.arah, tm: s.tm, kotak: { ...s.kotak } }));
}

/**
 * PENJAGA BENTUK: menolak penggantian yang posisinya benar tapi ISInya tidak
 * sebanding.
 *
 * Ditemukan di back test dengan MELIHAT hasilnya, bukan dari uji. Di artwork
 * SNI GOODRIDE, slot `konstruksi` mencetak "ALL STEEL TUBE TYPE". Kolom
 * items.tt_tl yang dipetakan ke situ berasal dari kolom 'ttl' di excel label,
 * dan isinya cuma "TT" atau "TL". Pencocokan posisinya benar -- memang slot
 * itu -- jadi jalur sulih dengan senang hati membuang frasanya dan menulis
 * "TL" dua huruf di tengah panel yang lebarnya untuk 19 huruf.
 *
 * Hasilnya bukan label yang salah data, tapi label yang KEHILANGAN keterangan
 * konstruksinya, dan itu tidak kelihatan sebagai kesalahan: tidak ada yang
 * kosong, tidak ada yang merah, cuma tulisan yang hilang.
 *
 * Mengarang padanannya ("TT" -> "ALL STEEL TUBE TYPE") ditolak: "ALL STEEL"
 * cuma benar untuk TBR all-steel, dan label bias dengan frasa itu adalah
 * klaim konstruksi yang keliru. Jadi medannya DILEWATI dan DILAPORKAN, biar
 * orangnya yang memutuskan.
 */
export const PENJAGA = {
  konstruksi: (lama, baru) => {
    const l = String(lama || '').trim(), b = String(baru || '').trim();
    if (/^(TT|TL)$/i.test(b) && /[A-Za-z]\s+[A-Za-z]/.test(l)) {
      return `artworknya menulis "${l}", data cuma kode "${b}" \u2014 dilewati supaya frasanya tidak hilang`;
    }
    return '';
  },
};

/** '' artinya boleh diganti; selain itu sebab kenapa dilewati. */
export function bolehGanti(k, lama, baru) {
  const p = PENJAGA[k];
  return p ? p(lama, baru) : '';
}
