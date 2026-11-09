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
  const { tandaiOtomatis = true, dari = '', erp = '' } = opsi;
  const hal = templat.halaman || { lebar: 210, tinggi: 297 };
  const doc = await PDFDocument.create();
  const pg = doc.addPage([hal.lebar * MM, hal.tinggi * MM]);
  const H = hal.tinggi * MM;
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
      laporan.push({ k: m.k, nilai: '', sebab: nilai.sebab || 'kosong', ragam: 'BOLONG' });
      continue;
    }

    const teks = String(nilai.nilai);
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
    laporan.push({ k: m.k, nilai: teks, ragam: nilai.ragam });
  }

  if (tandaiOtomatis) {
    const f = await ambilHuruf('Arial Bold');
    let baris2 = 'ARTWORK OTOMATIS - DIBUAT MESIN, BELUM DIPERIKSA MANUSIA';
    if (dari) baris2 += '  |  dari: ' + dari;
    // Dipaskan ke lebar lembar: templat terkecil cuma 77 mm, dan tanda air
    // yang terpotong di tepi justru menghilangkan kata yang paling penting.
    let uk2 = 8.5, w = f.widthOfTextAtSize(baris2, uk2);
    const maks = hal.lebar * MM - 8;
    while (w > maks && uk2 > 2.5) { uk2 -= 0.25; w = f.widthOfTextAtSize(baris2, uk2); }
    if (w > maks) { baris2 = 'ARTWORK OTOMATIS'; w = f.widthOfTextAtSize(baris2, uk2); }
    pg.drawText(baris2, { x: (hal.lebar * MM - w) / 2, y: 8, size: uk2, font: f, color: rgb(0.48, 0.25, 0.89) });
    doc.setTitle('ARTWORK OTOMATIS' + (erp ? ' - ' + erp : ''));
    doc.setSubject('Artwork dibuat mesin, BUKAN artwork asli. Belum diperiksa manusia dan belum boleh dipakai mencetak.');
    doc.setKeywords(['artwork-otomatis', 'bukan-artwork-asli', 'belum-diperiksa',
      dari ? 'dari=' + dari : '', erp ? 'erp=' + erp : ''].filter(Boolean));
    doc.setAuthor('MTI Purchasing Portal (otomatis)');
    doc.setProducer('src/label/render.js');
  }

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
