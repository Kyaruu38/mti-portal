// JALUR SULIH: menyunting artwork yang SUDAH ADA, bukan merakitnya ulang.
//
// Kenapa ini jalur utama dan bukan cadangan: yang berubah antar produk cuma
// segelintir medan. Logo merek, warna, tanda SNI, kode QR, blok peringatan
// dan foto ban adalah VEKTOR di artworknya, dan perender templat tidak bisa
// membuatnya dari data. Artwork hasil rakit-ulang akan benar penempatan
// datanya tapi kehilangan semua itu; artwork hasil sulih mempertahankannya
// PERSIS karena memang tidak menyentuhnya.
//
// Untuk OEM ini SATU-SATUNYA jalur: tata letaknya milik pelanggan dan
// berbeda tiap merek.
//
// Berkas sumbernya datang dari pengguna (pemilih berkas), bukan ditarik dari
// Drive. Itu bukan pilihan gaya: diuji dari asal portal yang sebenarnya,
// Drive memblokir CORS untuk byte PDF-nya. Satu-satunya jalur yang lolos
// mengembalikan PNG 1024 px -- kira-kira 88 dpi untuk lembar A4, tidak
// cukup untuk apa pun yang akan dicetak.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { batang } from './barcode.js';

const MM = 72 / 25.4;

// Memaskan ukuran huruf ke kotaknya: diperkecil sampai muat.
// Medan yang tidak muat pada ukuran terkecil yang masih terbaca DILAPORKAN,
// bukan dipaksakan. Nilai yang terpotong di label lebih berbahaya daripada
// proof yang ditolak.
function ukuranPas(font, teks, lebarKotak, tinggiKotak, maks) {
  let uk = Math.min(maks, tinggiKotak * 1.05);
  while (uk >= 3) {
    if (font.widthOfTextAtSize(teks, uk) <= lebarKotak * 1.04) return uk;
    uk -= 0.25;
  }
  return null;
}

/**
 * @param {ArrayBuffer|Uint8Array} sumber  byte PDF artwork aslinya
 * @param {Array} gantian  [{ x0,y0,x1,y1 (mm), nilai, putar?, latar?, catatan? }]
 * @param {Object} opsi    { dari, erp, tandai, barcode:{ kode,x0,y0,lebar,tinggi,putar } }
 */
export async function sulih(sumber, gantian, opsi = {}) {
  const { dari = '', erp = '', tandai = true, barcode = null } = opsi;
  const doc = await PDFDocument.load(sumber);
  const pg = doc.getPage(0);
  const H = pg.getHeight();
  const hebo = await doc.embedFont(StandardFonts.HelveticaBold);
  const laporan = [];

  for (const g of (gantian || [])) {
    const lb = (g.x1 - g.x0) * MM, tg = (g.y1 - g.y0) * MM;
    const latar = g.latar || [1, 1, 1];
    pg.drawRectangle({
      x: g.x0 * MM, y: H - g.y1 * MM, width: lb, height: tg,
      color: rgb(latar[0], latar[1], latar[2]),
    });
    const teks = String(g.nilai == null ? '' : g.nilai);
    if (!teks) { laporan.push({ catatan: g.catatan || '?', nilai: '', muat: false, sebab: 'nilai kosong' }); continue; }
    // Untuk medan diputar, panjang tulisannya mengikuti sisi PANJANG kotak.
    const sisiPanjang = g.putar ? tg : lb;
    const sisiLebar   = g.putar ? lb : tg;
    const uk = ukuranPas(hebo, teks, sisiPanjang, sisiLebar, g.ukuranMaks || 40);
    if (uk == null) { laporan.push({ catatan: g.catatan || '?', nilai: teks, muat: false, sebab: 'tidak muat di kotaknya' }); continue; }
    const o = { size: uk, font: hebo, color: rgb(0, 0, 0) };
    if (g.putar) { o.x = g.x0 * MM + sisiLebar * 0.82; o.y = H - g.y1 * MM; o.rotate = degrees(90); }
    else { o.x = g.x0 * MM; o.y = H - g.y1 * MM + sisiLebar * 0.2; }
    pg.drawText(teks, o);
    laporan.push({ catatan: g.catatan || '?', nilai: teks, muat: true, ukuran: Number(uk.toFixed(1)) });
  }

  if (barcode && barcode.kode) {
    try {
      const b = batang(barcode.kode, { lebar: barcode.lebar, tinggi: barcode.tinggi, putar: !!barcode.putar });
      const X = b.modul;
      pg.drawRectangle({
        x: (barcode.x0 - (barcode.putar ? 0 : 10 * X)) * MM,
        y: H - (barcode.y0 + (barcode.putar ? barcode.lebar + 7 * X : barcode.tinggi)) * MM,
        width: (barcode.putar ? barcode.tinggi : barcode.lebar + 17 * X) * MM,
        height: (barcode.putar ? barcode.lebar + 17 * X : barcode.tinggi) * MM,
        color: rgb(1, 1, 1),
      });
      for (const s of b.batang) {
        pg.drawRectangle({
          x: (barcode.x0 + s.x) * MM, y: H - (barcode.y0 + s.y) * MM - s.t * MM,
          width: s.l * MM, height: s.t * MM, color: rgb(0, 0, 0),
        });
      }
      laporan.push({ catatan: 'barcode', nilai: b.kode, muat: true });
    } catch (e) {
      laporan.push({ catatan: 'barcode', nilai: barcode.kode, muat: false, sebab: e.message });
    }
  }

  if (tandai) {
    let t = 'ARTWORK OTOMATIS - DIBUAT MESIN, BELUM DIPERIKSA MANUSIA';
    if (dari) t += '  |  dari: ' + dari;
    let uk = 8.5, w = hebo.widthOfTextAtSize(t, uk);
    const maks = pg.getWidth() - 8;
    while (w > maks && uk > 2.5) { uk -= 0.25; w = hebo.widthOfTextAtSize(t, uk); }
    if (w > maks) { t = 'ARTWORK OTOMATIS'; w = hebo.widthOfTextAtSize(t, uk); }
    pg.drawText(t, { x: (pg.getWidth() - w) / 2, y: 8, size: uk, font: hebo, color: rgb(0.48, 0.25, 0.89) });
    doc.setTitle('ARTWORK OTOMATIS' + (erp ? ' - ' + erp : ''));
    doc.setSubject('Artwork dibuat mesin, BUKAN artwork asli. Belum diperiksa manusia dan belum boleh dipakai mencetak.');
    doc.setKeywords(['artwork-otomatis', 'bukan-artwork-asli', 'belum-diperiksa',
      dari ? 'dari=' + dari : '', erp ? 'erp=' + erp : ''].filter(Boolean));
    doc.setAuthor('MTI Purchasing Portal (otomatis)');
    doc.setProducer('src/label/sulih.js');
  }

  return { pdf: await doc.save(), laporan, gagal: laporan.filter(x => !x.muat) };
}
