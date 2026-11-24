// PERENDER: templat + satu baris items -> PDF.
//
// Satuan di berkas templat MILIMETER; pdf-lib bekerja dalam poin. Konversi
// dilakukan di satu tempat (MM) supaya tidak ada angka setengah-jadi
// berkeliaran. Sumbu Y pdf-lib naik dari bawah; sumbu templat turun dari
// atas, sama seperti alat ukurnya. Pembalikannya juga di satu tempat (yPdf).
//
// YANG TIDAK DILAKUKAN PERENDER INI: menebak. Medan yang datanya kosong
// digambar sebagai kotak bergaris putus-putus berisi nama medannya, bukan
// dibiarkan kosong diam-diam. Label yang kurang satu nilai harus KELIHATAN
// kurang; label yang cuma kosong di satu tempat terlihat seperti label yang
// memang begitu desainnya.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { isiTemplat } from './peta.js';
import { batang } from './barcode.js';

const MM = 72 / 25.4;

// Huruf asli artworknya (Impact, OCR-B, Koz Go) tidak ada sebagai huruf baku
// PDF. Untuk PROOF itu cukup, dan ketidakcocokannya justru berguna: proof
// yang hurufnya persis seperti aslinya lebih mudah disangka artwork asli.
// Untuk cetak produksi huruf aslinya harus ditanam, dan itu belum dikerjakan.
const PADAN_HURUF = {
  'Impact': StandardFonts.HelveticaBold,
  'Arial Bold': StandardFonts.HelveticaBold,
  'Arial': StandardFonts.Helvetica,
  'Helvetica Bold': StandardFonts.HelveticaBold,
  'Helvetica Condensed': StandardFonts.HelveticaBold,
  'OCR-B': StandardFonts.Courier,
  'Koz Go Pr6N Bold': StandardFonts.HelveticaBold,
  'Verdana Bold': StandardFonts.HelveticaBold,
  'MS Gothic': StandardFonts.Helvetica,
  'Myriad Pro': StandardFonts.Helvetica,
  'Neue Frutiger': StandardFonts.Helvetica,
};

// Kotak pembatas seluruh blok, dihitung dari offset medannya sendiri.
// Dipakai untuk menempatkan blok di tengah lembar kalau templatnya tidak
// menyebut titik asal mutlak. Titik asal mutlak memang BERPINDAH antar
// berkas asli -- itu temuan pengukurannya -- jadi untuk membuat yang baru
// kita perlu satu pilihan yang tetap, bukan meniru salah satu berkas.
export function kotakBlok(templat) {
  const med = (templat.medan || []);
  if (!med.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of med) {
    const dx = m.dX || 0;
    const dy = m.dY != null ? m.dY : (m.dY_ujung || 0);
    const uk = m.ukuran || 3;
    x0 = Math.min(x0, dx); x1 = Math.max(x1, dx + uk * 6);
    y0 = Math.min(y0, dy - uk); y1 = Math.max(y1, dy + uk * 0.3);
  }
  return { x0, y0, x1, y1, lebar: x1 - x0, tinggi: y1 - y0 };
}

export function titikAsal(templat) {
  if (templat.asal_mutlak) return templat.asal_mutlak;
  const hal = templat.halaman || { lebar: 210, tinggi: 297 };
  const b = kotakBlok(templat);
  if (!b) return { x: hal.lebar / 2, y: hal.tinggi / 2 };
  return { x: (hal.lebar - b.lebar) / 2 - b.x0, y: (hal.tinggi - b.tinggi) / 2 - b.y0 };
}

export async function render(templat, baris, opsi = {}) {
  const { tandaiOtomatis = true, dari = '', erp = '', aset = null, truk = null } = opsi;
  const hal = templat.halaman || { lebar: 210, tinggi: 297 };
  const doc = await PDFDocument.create();

  // PITA KETERANGAN DI BAWAH LEMBAR, bukan cap yang ditimpakan di atasnya.
  //
  // Sebelumnya tandanya digambar pada y=8 pt -- DI DALAM lembar -- dan di
  // templat SNI tepat di situlah barcode berada. Jadi tandanya menutupi
  // batang barcode: dua hal yang sama-sama tidak terbaca, dan yang satu
  // kebetulan satu-satunya bagian yang dibaca mesin.
  //
  // Lembarnya sekarang DITAMBAH pita di bawahnya, bukan dipakai bersama.
  // Isi labelnya tetap menempel di TEPI ATAS pada koordinat terukurnya
  // (yPdf tetap H dikurangi jarak-dari-atas, dan H sekarang lebih tinggi),
  // jadi tidak ada satu medan pun yang bergeser. Yang bertambah ruang
  // kosong di bawah, dan di situlah keterangannya duduk.
  //
  // PITANYA CUMA ADA KALAU TANDANYA ADA. Dengan tandaiOtomatis:false
  // keluarannya kembali persis seukuran lembar sebenarnya -- karena berkas
  // yang tidak bertanda berarti dipakai sebagai lembar sungguhan, dan
  // lembar sungguhan tidak boleh kelebihan 13 mm di bawahnya.
  const PITA = tandaiOtomatis ? 13 : 0;
  const pg = doc.addPage([hal.lebar * MM, (hal.tinggi + PITA) * MM]);
  const H = pg.getHeight();
  const yPdf = (mmDariAtas) => H - mmDariAtas * MM;

  const huruf = {};
  const ambilHuruf = async (nama) => {
    const std = PADAN_HURUF[nama] || StandardFonts.Helvetica;
    if (!huruf[std]) huruf[std] = await doc.embedFont(std);
    return huruf[std];
  };

  const asal = titikAsal(templat);
  const arahNaik = ((templat.arah_putar || {}).arah || 'naik') !== 'turun';
  const isi = isiTemplat(templat, baris);
  const laporan = [];

  for (const m of (templat.medan || [])) {
    if (m.peran === 'titik asal') continue;
    const nilai = (isi.medan.find(x => x.k === m.k) || {});
    const rataKanan = m.rata === 'kanan';
    // Medan rata-kanan menyimpan UJUNGNYA, bukan titik mulainya -- dan ujung
    // itu ada di sumbu yang berbeda tergantung medannya diputar atau tidak:
    // dY_ujung untuk yang diputar, dX_ujung untuk yang mendatar. Versi
    // pertama cuma membaca dY_ujung, sehingga medan mendatar yang rata-kanan
    // (baris spesifikasi di kepala label) mendarat di titik asal dan menumpuk
    // dengan medan di sebelahnya.
    const dx = (rataKanan && !m.putar && m.dX_ujung != null) ? m.dX_ujung : (m.dX || 0);
    const dy = (rataKanan && m.putar && m.dY_ujung != null) ? m.dY_ujung : (m.dY || 0);
    const x = asal.x + dx;
    const y = asal.y + dy;
    const uk = (m.ukuran || 3) * MM;
    const f = await ambilHuruf(m.font || 'Arial');

    if (m.k === 'ean' && nilai.nilai) {
      gambarBarcode(pg, nilai.nilai, x, y, m, f);
      laporan.push({ k: m.k, nilai: nilai.nilai, ragam: 'barcode' });
      continue;
    }

    if (!nilai.nilai) {
      // MEDAN KOSONG DIGAMBAR, BUKAN DILEWATI.
      const lb = Math.max(14 * MM, (m.k.length + 8) * uk * 0.42);
      pg.drawRectangle({
        x: x * MM, y: yPdf(y) - uk * 0.25, width: lb, height: uk * 1.15,
        borderColor: rgb(0.85, 0.2, 0.2), borderWidth: 0.6,
        borderDashArray: [2, 2], color: rgb(1, 0.94, 0.94),
      });
      pg.drawText('? ' + m.k, {
        x: x * MM + 1.5, y: yPdf(y), size: Math.min(uk * 0.75, 7),
        font: await ambilHuruf('Arial'), color: rgb(0.8, 0.1, 0.1),
      });
      // `asal` DIPERTAHANKAN di samping BOLONG. Tanpa itu, medan yang
      // kosong kehilangan satu-satunya petunjuk ke mana harus dicari:
      // 'items.npb1 kosong' menunjuk ke kolom yang bisa diisi, sedangkan
      // 'BOLONG' saja menyuruh orang menebak sendiri asalnya.
      laporan.push({ k: m.k, nilai: '', sebab: nilai.sebab || 'kosong', ragam: 'BOLONG', asal: nilai.ragam });
      continue;
    }

    // LABEL TETAP DUA BARIS DITULIS DUA BARIS.
    //
    // Templat menyimpan label kotak sebagai SATU teks: 'Ply / Rating',
    // 'Load / Range'. Di artwork aslinya itu DUA BARIS BERTUMPUK, tanpa
    // garis miring -- terlihat jelas di dua artwork yang bisa diperiksa
    // langsung (WESTLAKE PT/TBR dan BX/TBR): 'Ply' di atas 'Rating',
    // 'Load' di atas 'Range'.
    //
    // Ditulis satu baris, teksnya memanjang 17 mm dari jangkarnya dan
    // mendarat tepat di slot nilainya: pada proof SNI, 'Ply / Rating'
    // menimpa angka '18' dan 'Load / Range' menimpa huruf 'J'. Dua-duanya
    // jadi tidak terbaca, dan itu justru dua medan yang menentukan.
    //
    // Hanya untuk medan TETAP, bukan untuk nilai dari data: 'ALL STEEL
    // TUBE TYPE / BIAS TIRE TUBE TYPE' di templat adalah CONTOH isi kolom
    // konstruksi, bukan label dua baris, dan memecahnya akan membuang
    // separuh isinya.
    const duaBaris = m.tetap && String(nilai.nilai).includes(' / ')
      ? String(nilai.nilai).split(' / ')
      : null;
    const teks = duaBaris ? duaBaris[0] : String(nilai.nilai);
    const lebarTeks = f.widthOfTextAtSize(teks, uk);
    const opsiTulis = { x: x * MM, y: yPdf(y), size: uk, font: f, color: rgb(0, 0, 0) };
    if (m.putar) {
      // ARAH PUTAR DIBACA DARI TEMPLAT, TIDAK DIANGGAP SERAGAM.
      //
      // Diukur dari artwork asli: SNI memutar teksnya TURUN (dir 0,1) --
      // titik awal baseline di ujung ATAS, tulisan memanjang ke bawah.
      // Pasar lain memutar NAIK (dir 0,-1) -- titik awal di ujung BAWAH,
      // memanjang ke atas. Versi pertama perender ini menganggap semuanya
      // naik, dan setiap medan diputar mendarat di ujung yang salah.
      if (arahNaik) {
        opsiTulis.rotate = degrees(90);
        if (rataKanan) opsiTulis.y = yPdf(y) - lebarTeks;
      } else {
        opsiTulis.rotate = degrees(-90);
        if (rataKanan) opsiTulis.y = yPdf(y) + lebarTeks;
      }
    } else if (rataKanan) {
      opsiTulis.x = x * MM - lebarTeks;
    }
    pg.drawText(teks, opsiTulis);
    if (duaBaris) {
      // Baris kedua digeser TEGAK LURUS arah tulisannya. Untuk teks yang
      // diputar itu berarti bergeser pada sumbu x, bukan y -- memakai y
      // akan menaruh baris kedua di BELAKANG baris pertama, bukan di
      // bawahnya.
      const sela = uk * 1.12;
      const opsi2 = { ...opsiTulis };
      if (m.putar) opsi2.x = opsiTulis.x - sela;
      else opsi2.y = opsiTulis.y - sela;
      pg.drawText(duaBaris[1], opsi2);
    }
    laporan.push({ k: m.k, nilai: duaBaris ? duaBaris.join(' / ') : teks, ragam: nilai.ragam, asal: nilai.ragam });
  }

  if (tandaiOtomatis) {
    const f = await ambilHuruf('Arial Bold');
    // KELUARAN JALUR INI BUKAN ARTWORK, dan tandanya tidak boleh bilang
    // begitu. Sebelumnya ia bertanda 'ARTWORK OTOMATIS', sehingga sebuah
    // lembar teks hitam-putih tanpa logo terlihat seperti artwork yang
    // gagal dibuat -- padahal ia memang bukan artwork dan tidak pernah
    // berniat jadi artwork. Berkas yang lepas dari portal harus bisa
    // menjelaskan dirinya sendiri.
    // Garis pemisah: tanpa ini pita keterangan terbaca seperti bagian bawah
    // labelnya sendiri, dan orang akan bertanya kenapa ada tulisan ungu di
    // produknya.
    pg.drawLine({
      start: { x: 0, y: PITA * MM }, end: { x: hal.lebar * MM, y: PITA * MM },
      thickness: 0.6, color: rgb(0.48, 0.25, 0.89),
    });

    const baris2 = 'LEMBAR PERIKSA DATA - BUKAN ARTWORK, TIDAK UNTUK DICETAK'
      + (dari ? '  |  templat: ' + dari : '');

    // UKURANNYA IKUT DICETAK, dan dua-duanya, karena memang dua angka yang
    // berbeda: pada SNI labelnya MEMENUHI lembarnya (101x226 = 101x226),
    // sedangkan BX dan PT meletakkan bloknya di lembar A4 yang lebih besar.
    // Satu angka saja membuat orang mengira label BX seukuran A4.
    const sl = templat.stok_label;
    const ukLembar = `lembar ${hal.lebar} x ${hal.tinggi} mm`;
    const ukLabel = sl && sl.lebar && sl.tinggi
      ? (sl.lebar === hal.lebar && sl.tinggi === hal.tinggi
        ? '  (label memenuhi lembar)'
        : `  |  label ${sl.lebar} x ${sl.tinggi} mm`)
      : '';
    const baris3 = ukLembar + ukLabel + (erp ? '  |  ERP ' + erp : '');

    // Dipaskan ke lebar lembar: templat terkecil cuma 77 mm, dan keterangan
    // yang terpotong di tepi justru menghilangkan kata yang paling penting.
    const maks = hal.lebar * MM - 8;
    const pas = (teks, mulai) => {
      let uk = mulai, w = f.widthOfTextAtSize(teks, uk);
      while (w > maks && uk > 2.5) { uk -= 0.25; w = f.widthOfTextAtSize(teks, uk); }
      return { uk, w };
    };
    const p2 = pas(baris2, 8.5);
    const p3 = pas(baris3, 7.5);
    pg.drawText(baris2, { x: (hal.lebar * MM - p2.w) / 2, y: PITA * MM - 13, size: p2.uk, font: f, color: rgb(0.48, 0.25, 0.89) });
    pg.drawText(baris3, { x: (hal.lebar * MM - p3.w) / 2, y: PITA * MM - 25, size: p3.uk, font: f, color: rgb(0.35, 0.35, 0.40) });
    doc.setTitle('LEMBAR PERIKSA DATA' + (erp ? ' - ' + erp : ''));
    doc.setSubject('Lembar periksa data, BUKAN artwork. Isinya hanya teks di koordinat terukur; logo, warna, tanda SNI dan QR tidak ada karena semuanya vektor di artwork aslinya. Tidak untuk dicetak sebagai label.');
    doc.setKeywords(['lembar-periksa-data', 'bukan-artwork', 'tidak-untuk-dicetak',
      dari ? 'dari=' + dari : '', erp ? 'erp=' + erp : ''].filter(Boolean));
    doc.setAuthor('MTI Purchasing Portal (otomatis)');
    doc.setProducer('src/label/render.js');
  }

  if (tandaiOtomatis) await halamanPedoman(doc, templat, laporan, { erp, dari, hal, aset, truk });

  return { pdf: await doc.save(), laporan, bolong: laporan.filter(x => x.ragam === 'BOLONG') };
}

function gambarBarcode(pg, kode, x, y, m, f) {
  let b;
  try { b = batang(kode, { lebar: m.lebar_barcode || 37.29, tinggi: m.tinggi_barcode || 20, putar: !!m.putar }); }
  catch (e) { return; }
  const H = pg.getHeight();
  for (const s of b.batang) {
    pg.drawRectangle({
      x: (x + s.x) * MM, y: H - (y + s.y) * MM - s.t * MM,
      width: s.l * MM, height: s.t * MM, color: rgb(0, 0, 0),
    });
  }
  // Angka di bawah batang digambar untuk KEDUA arah. Versi pertama
  // melewatinya saat diputar, dan barcode tanpa angka terbaca itu tidak bisa
  // diperiksa manusia sama sekali -- padahal justru itu gunanya proof.
  const uk = Math.max(3, b.zonaAngka * MM * 0.78);
  const panjangBatang = Math.max(...b.batang.map(t => t.panjang));
  for (const a of b.angka) {
    if (m.putar) {
      pg.drawText(a.teks, {
        x: (x + panjangBatang) * MM + uk * 0.9,
        y: H - (y + a.dari) * MM - uk * 0.2,
        size: uk, font: f, color: rgb(0, 0, 0), rotate: degrees(-90),
      });
    } else {
      pg.drawText(a.teks, {
        x: (x + a.dari) * MM, y: H - (y + panjangBatang) * MM - uk * 0.1,
        size: uk, font: f, color: rgb(0, 0, 0),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// HALAMAN KEDUA: TABEL PEDOMAN.
//
// Halaman pertama memperlihatkan BENTUKNYA; halaman ini yang dipakai orang.
//
// Kenapa perlu. Keluaran jalur ini bukan berkas siap cetak dan memang tidak
// berniat jadi begitu -- vendor yang membuat artwork finalnya dan vendor pula
// yang mencari hurufnya. Yang selama ini mahal bukan gambarnya, melainkan
// "biasanya dari satu contoh": tiap SKU baru ada orang yang harus mencari
// artwork yang mirip, mendaftar apa yang berubah, mengirimkannya, lalu
// memeriksa balasannya. Tabel ini yang menggantikan langkah itu.
//
// Isinya nilai DAN ASALNYA, bukan nilainya saja. 'kolom:size' berarti diambil
// apa adanya dari master; 'turunan:nomorItem' berarti dihitung, dan hitungan
// itu punya ujinya sendiri; 'tetap' berarti sama di tiap label keluarga ini.
// Pembaca yang tahu asal sebuah angka bisa memeriksanya; yang cuma melihat
// angkanya harus percaya.
//
// MEDAN KOSONG TETAP DITULIS, merah, beserta sebabnya. Baris yang hilang dari
// tabel terbaca seperti medan yang memang tidak ada di label ini -- dan itu
// persis salah paham yang membuat label terbit kurang satu nilai.
// ---------------------------------------------------------------------------
async function halamanPedoman(doc, templat, laporan, { erp, dari, hal, aset, truk }) {
  const pg = doc.addPage([595.28, 841.89]);          // A4 tegak
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const fr = await doc.embedFont(StandardFonts.Helvetica);
  const KIRI = 42;
  let y = 790;

  const tulis = (t, x, uk, font = fr, warna = rgb(0.1, 0.1, 0.12)) =>
    pg.drawText(String(t), { x, y, size: uk, font, color: warna });

  tulis('PEDOMAN LABEL' + (erp ? '  ·  ' + erp : ''), KIRI, 15, fb);
  y -= 17;
  tulis('BUKAN ARTWORK SIAP CETAK — acuan untuk vendor, bukan berkas produksi.',
    KIRI, 9, fb, rgb(0.48, 0.25, 0.89));
  y -= 13;
  const sl = templat.stok_label;
  const ukuran = `templat ${dari || '-'}   ·   lembar ${hal.lebar} x ${hal.tinggi} mm`
    + (sl && sl.lebar ? `   ·   label ${sl.lebar} x ${sl.tinggi} mm` : '');
  tulis(ukuran, KIRI, 8.5, fr, rgb(0.38, 0.38, 0.42));
  y -= 20;

  // BLOK DESAIN: logo merek dan warnanya, dipanen dari artwork aslinya.
  //
  // Pedoman tanpa ini menyuruh vendor menebak logo mana yang dipakai, dan
  // tebakan itu punya satu bentuk kegagalan yang tidak terlihat seperti
  // kegagalan: artwork GOODRIDE dipakai untuk YARTU menghasilkan label
  // YARTU dengan LOGO GOODRIDE -- datanya semua benar, ukurannya benar,
  // hanya mereknya yang salah. Catatan yang sama sudah ditulis di
  // core/dasar.js; di sini akibatnya sampai ke pihak luar.
  //
  // Logonya VEKTOR, dipotong dari artwork lewat alat/panen-aset.mjs, bukan
  // digambar ulang. Warnanya diukur dari piksel artworknya, bukan dikira.
  if (aset && aset.logo) {
    const kotakTinggi = 46;
    pg.drawRectangle({
      x: KIRI - 6, y: y - kotakTinggi + 10, width: 553 - KIRI + 12, height: kotakTinggi,
      color: rgb(0.97, 0.97, 0.98),
    });
    try {
      const [halLogo] = await doc.embedPdf(aset.logo);
      const skala = Math.min(190 / halLogo.width, (kotakTinggi - 14) / halLogo.height);
      pg.drawPage(halLogo, {
        x: KIRI, y: y - kotakTinggi + 17,
        width: halLogo.width * skala, height: halLogo.height * skala,
      });
    } catch (e) {
      tulis('(logo gagal dimuat: ' + (e.message || e) + ')', KIRI, 8, fr, rgb(0.8, 0.1, 0.1));
    }
    const kx = KIRI + 210;
    tulis(aset.merek || '-', kx, 13, fb);
    y -= 15;
    tulis(`warna merek ${aset.warna_pita || '-'}`, kx, 8.5, fr, rgb(0.38, 0.38, 0.42));
    if (aset.warna_pita && /^#[0-9A-F]{6}$/i.test(aset.warna_pita)) {
      const hx = aset.warna_pita.slice(1);
      pg.drawRectangle({
        x: kx + 92, y: y - 1, width: 26, height: 9,
        color: rgb(parseInt(hx.slice(0, 2), 16) / 255, parseInt(hx.slice(2, 4), 16) / 255, parseInt(hx.slice(4, 6), 16) / 255),
        borderColor: rgb(0.7, 0.7, 0.74), borderWidth: 0.4,
      });
    }
    y -= 12;
    if (aset.label_mm) tulis(`label terukur ${aset.label_mm.lebar} x ${aset.label_mm.tinggi} mm (dari artwork)`, kx, 8.5, fr, rgb(0.38, 0.38, 0.42));
    y -= 27;
  }

  // POSISI PEMASANGAN, dari katalog pabriknya.
  //
  // Tiap halaman pola di katalog TBR menandai poros mana yang MERAH
  // (Recommendable) dan mana yang HIJAU (Available). Keterangan itu selama
  // ini cuma ada di katalog cetak, dan itu pula yang tercetak di artwork
  // labelnya — jadi orang yang menyiapkan label harus membuka katalog di
  // sebelahnya, atau menyalin dari label lain dan berharap polanya sama.
  //
  // TITIKNYA DIGAMBAR ULANG DARI DATANYA, bukan ditempel sebagai gambar
  // katalog. Dua alasan: gambar katalognya milik pabrik dan tidak perlu ikut
  // berkeliling, dan yang benar-benar dipakai orang itu POSISINYA, bukan
  // lukisan truknya.
  //
  // YANG TIDAK DIKLAIM: nama poros. Satu blok katalog memuat dua sampai
  // empat kendaraan bersebelahan, jadi x=0,2 berarti 'seperlima dari kiri
  // blok', bukan 'poros kemudi'. Memetakannya jadi steer/drive/trailer
  // butuh pemisahan per kendaraan; menebaknya berarti mencetak keterangan
  // posisi yang salah, dan itu tidak terlihat seperti kesalahan.
  if (truk && Array.isArray(truk.titik) && truk.titik.length) {
    const lebarStrip = 553 - KIRI - 150;
    pg.drawRectangle({ x: KIRI - 6, y: y - 34, width: 553 - KIRI + 12, height: 42, color: rgb(0.97, 0.97, 0.98) });
    tulis(`POSISI PEMASANGAN · ${truk.kode || '-'}`, KIRI, 9, fb);
    y -= 12;
    tulis(`${truk.merah || 0} merah = Recommendable   ·   ${truk.hijau || 0} hijau = Available`
      + (truk.hal ? `   ·   katalog TBR hal ${truk.hal}` : ''), KIRI, 7.5, fr, rgb(0.45, 0.45, 0.5));
    const garisY = y - 10;
    pg.drawLine({ start: { x: KIRI + 150, y: garisY }, end: { x: KIRI + 150 + lebarStrip, y: garisY },
      thickness: 0.8, color: rgb(0.85, 0.1, 0.15) });
    for (const t of truk.titik) {
      const fx = Number(t.x);
      if (!(fx >= 0 && fx <= 1)) continue;
      pg.drawCircle({
        x: KIRI + 150 + fx * lebarStrip, y: garisY + 3, size: 2.6,
        color: t.c === 'h' ? rgb(0.03, 0.66, 0.35) : rgb(0.90, 0.10, 0.16),
      });
    }
    y -= 26;
  }

  pg.drawLine({ start: { x: KIRI, y }, end: { x: 553, y }, thickness: 0.8, color: rgb(0.1, 0.1, 0.12) });
  y -= 13;
  tulis('MEDAN', KIRI, 8, fb, rgb(0.38, 0.38, 0.42));
  tulis('NILAI', KIRI + 118, 8, fb, rgb(0.38, 0.38, 0.42));
  tulis('ASAL', KIRI + 350, 8, fb, rgb(0.38, 0.38, 0.42));
  y -= 6;
  pg.drawLine({ start: { x: KIRI, y }, end: { x: 553, y }, thickness: 0.4, color: rgb(0.7, 0.7, 0.74) });
  y -= 14;

  for (const r of laporan) {
    if (y < 70) break;                               // satu halaman cukup untuk 14 medan
    const bolong = r.ragam === 'BOLONG';
    const warna = bolong ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.1, 0.12);
    tulis(r.k, KIRI, 9, fb, warna);
    tulis(bolong ? '— TIDAK TERISI' : r.nilai, KIRI + 118, 9, bolong ? fb : fr, warna);
    tulis(r.asal || r.ragam || '', KIRI + 350, 8, fr, rgb(0.45, 0.45, 0.5));
    y -= 12;
    if (bolong && r.sebab) { tulis('sebab: ' + r.sebab, KIRI + 118, 7.5, fr, rgb(0.8, 0.1, 0.1)); y -= 11; }
    else y -= 2;
  }

  const bolong = laporan.filter(x => x.ragam === 'BOLONG');
  y -= 6;
  pg.drawLine({ start: { x: KIRI, y }, end: { x: 553, y }, thickness: 0.4, color: rgb(0.7, 0.7, 0.74) });
  y -= 15;
  tulis(bolong.length
    ? `${bolong.length} medan TIDAK TERISI — jangan dikirim ke vendor sebelum diisi.`
    : `${laporan.length} medan terisi, nol kosong.`,
  KIRI, 9.5, fb, bolong.length ? rgb(0.8, 0.1, 0.1) : rgb(0.05, 0.45, 0.2));
}

// ---------------------------------------------------------------------------
// BANYAK SEKALIGUS. Satu berkas Excel masuk, satu berkas pedoman keluar.
//
// Kenapa satu berkas dan bukan satu berkas per baris: pedoman dikirim ke
// vendor sebagai satu kiriman, dan 40 lampiran terpisah adalah 40 kesempatan
// untuk salah satunya tertinggal. Urutannya mengikuti urutan barisnya,
// supaya bisa diadu dengan Excel-nya baris per baris.
//
// SATU BARIS GAGAL TIDAK MENJATUHKAN SISANYA, dan yang gagal disebut
// ERP-nya, bukan cuma dihitung: "12 gagal" tidak bisa dikerjakan, dua belas
// kode ERP bisa. Ini pola yang sama dengan migrasi Drive di core/migrasiDrive.js.
// ---------------------------------------------------------------------------
export async function renderBanyak(pilihTemplat, baris, opsi = {}) {
  const gabungan = await PDFDocument.create();
  const berhasil = [];
  const gagal = [];
  for (const b of baris) {
    const erp = b.erp || '(tanpa ERP)';
    try {
      const t = await pilihTemplat(b);
      if (!t || !t.templat) throw new Error(t && t.sebab ? t.sebab : 'templat tidak ketemu');
      const r = await render(t.templat, b, { ...opsi, erp, dari: t.dari || '', aset: t.aset || null, truk: t.truk || null });
      const satu = await PDFDocument.load(r.pdf);
      const hal = await gabungan.copyPages(satu, satu.getPageIndices());
      for (const h of hal) gabungan.addPage(h);
      berhasil.push({ erp, bolong: r.bolong.map(x => x.k) });
    } catch (e) {
      gagal.push({ erp, sebab: e.message || String(e) });
    }
  }
  if (!berhasil.length && gagal.length) {
    // Berkas nol halaman yang diserahkan sebagai hasil terlihat seperti
    // berkas rusak. Melempar memaksa pemanggilnya menampilkan sebabnya.
    throw new Error('tidak ada satu pun baris yang bisa dirender: ' + gagal.map(g => `${g.erp} (${g.sebab})`).join(' · '));
  }
  return { pdf: await gabungan.save(), berhasil, gagal, jumlahHalaman: gabungan.getPageCount() };
}
