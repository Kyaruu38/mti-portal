// ---------------------------------------------------------------------------
// PANEN BLANGKO: mengubah satu artwork jadi lembar kosong yang bisa dipakai
// ulang, dengan SELURUH vektornya utuh.
//
// KENAPA BEGINI, BUKAN MENGEKSTRAK LOGO JADI SVG.
//
// Yang dibutuhkan untuk "bikin artwork dari data" bukan logonya saja. Satu
// label SNI membawa: logo merek, blok warna hijau dua nada, tanda SNI, kode
// QR, blok peringatan tujuh baris, garis potong, dan tulisan tetap seperti
// 'Ply / Rating' dan baris kaki pabrikan. Mengekstrak semuanya satu per satu
// berarti membangun ulang seluruh design — dan tiap satu yang meleset
// posisinya atau warnanya adalah label yang salah cetak.
//
// Yang jauh lebih murah dan jauh lebih aman: AMBIL ARTWORKNYA, BUANG TEKS
// DATANYA, SISAKAN SISANYA. Yang tersisa persis blangko yang dipakai designer
// aslinya: semua vektor di tempatnya, warna aslinya, resolusinya asli, garis
// potongnya asli — karena memang tidak ada yang digambar ulang.
//
// Dan kotak medannya ikut dipanen DARI BERKAS ITU SENDIRI, bukan dari templat
// umum. Templat umum benar untuk keluarganya; blangko hasil panen benar untuk
// MEREK ITU, karena diukur dari artwork merek itu.
//
// Pakai:
//   node tools/label/panen.mjs <artwork.pdf> <kunci-templat> <merek> <keluar/>
// contoh:
//   node tools/label/panen.mjs "GOODRIDE.pdf" SNI/TBR GOODRIDE _to_delete/panen
// ---------------------------------------------------------------------------
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// pdf.js di portal menunjuk worker ke CDN https; di node pemuat ESM menolaknya.
const pdfjs = await import('pdfjs-dist');
const worker = pathToFileURL('./node_modules/pdfjs-dist/build/pdf.worker.mjs').href;
Object.defineProperty(pdfjs.GlobalWorkerOptions, 'workerSrc', { get: () => worker, set: () => {}, configurable: true });

const { itemTeks } = await import('../../src/parsers/pdf.js');
const sp = await import('../../src/label/sumberPdf.js');
const { TEMPLAT } = await import('../../src/label/templat.js');
const { ATURAN } = await import('../../src/label/peta.js');
const streamTeks = await import('../../src/label/streamTeks.js');
const pdfLib = await import('pdf-lib');

/**
 * Memanen satu blangko. Dibuat jadi fungsi supaya memanen 50 artwork tidak
 * berarti memuat pdf.js dan pdf-lib 50 kali -- itu bedanya empat menit dan
 * dua puluh detik.
 *
 * Melempar kalau blangkonya tidak bisa dipanen; pemanggilnya yang memutuskan
 * mau berhenti atau lanjut ke berkas berikutnya.
 */
export async function panen({ berkasArtwork, kunciTemplat, merek, keluar = '_to_delete/panen' }) {
const berkasTemplat = TEMPLAT[kunciTemplat];
if (!berkasTemplat) throw new Error('kunci templat tidak dikenal: ' + kunciTemplat);

const templat = JSON.parse(await readFile(new URL('../../src/label/templat/' + berkasTemplat, import.meta.url), 'utf8'));
const mentah = await readFile(berkasArtwork);
const buf = mentah.buffer.slice(mentah.byteOffset, mentah.byteOffset + mentah.byteLength);

const { items, tinggiPt, lebarPt } = await itemTeks(buf.slice(0));
const sumber = sp.keMedanSumber(items, tinggiPt);
// BERKAS TANPA LAPISAN TEKS DITOLAK, BUKAN DIPAKSAKAN. Kalau hurufnya sudah
// jadi kurva, mana teks data dan mana gambar tidak bisa dibedakan — membuang
// salah satunya berarti menebak, dan yang ditebak di sini bagian design.
if (!sumber.length) throw new Error('tidak ada lapisan teks (huruf sudah jadi kurva)');

const jangkar = sp.cariJangkar(sumber, berkasTemplat);
if (!jangkar.ok) throw new Error(jangkar.sebab);

const cocok = sp.cocokkanMedan(templat, sumber, jangkar);
const ketemu = cocok.filter(c => c.ketemu);
const hilang = cocok.filter(c => !c.ketemu);

// SALINAN GANDA IKUT DIBUANG. Nilai yang sama sering tercetak dua kali (panel
// dan tulang punggung). Satu yang tertinggal berarti blangkonya masih membawa
// data ban ASALNYA, dan tiap artwork yang dibuat dari situ akan membawa satu
// nilai yang tidak pernah diganti sambil terlihat benar.
// HANYA MEDAN YANG DATANG DARI DATA YANG DIBUANG.
//
// Templat juga menyebut medan yang BUKAN data: tulisan tetap seperti
// 'Ply / Rating', callout ukuran lembar '79 mm' dan '254 mm', alamat situs
// merek, dan blok persetujuan. Versi pertama membuang semuanya karena
// semuanya cocok posisinya — hasilnya blangko WESTLAKE yang kehilangan pita
// 'ALL STEEL TUBELESS', 'MADE IN INDONESIA' dan alamat situsnya sendiri.
//
// Yang boleh hilang cuma yang nanti ditulis ulang dari items: medan yang
// punya kolom atau turunan di ATURAN.
const dariData = (k) => {
  const a = ATURAN[String(k).replace(/ \(salinan\)$/, '')];
  return !!a && (a.kolom || a.turunan) && !a.tetap && !a.lapisan && !a.aset;
};
const dibuang = [];
for (const c of ketemu) {
  if (!dariData(c.k)) continue;
  dibuang.push({ k: c.k, tm: c.tm, kotak: c.kotak, arah: c.arah, putar: c.putar, lama: c.lama });
  for (const sal of sp.cariSalinan(sumber, c.lama, c.kotak)) {
    dibuang.push({ k: c.k + ' (salinan)', tm: sal.tm, kotak: sal.kotak, arah: sal.arah, putar: sal.putar, lama: sal.lama });
  }
}

// ---- BARCODE -------------------------------------------------------------
// BARCODE LAMA HARUS IKUT HILANG, DAN INI BUKAN KERAPIAN. Blangko yang masih
// membawa barcode ban asalnya akan mencetak EAN merek itu di SETIAP artwork
// yang dibuat darinya. Datanya semua benar, barcodenya milik ban lain, dan
// satu-satunya yang membaca barcode adalah mesin di gudang -- tidak ada orang
// yang akan melihatnya salah.
//
// Angkanya teks, jadi ketahuan dari lapisan teks dan bisa dibuang seperti
// medan lain. Batangnya vektor: jangkauannya diukur dari hasil render (lihat
// tools/label/kotak_barcode.py), lalu ditutup putih DI DALAM alas putihnya
// sendiri -- jadi yang tertutup cuma barcode, tidak pernah panel labelnya.
const angka = sumber.filter(m => /^[0-9][0-9 ]*$/.test(m.teks.trim()));
let barcode = null;
if (angka.length >= 3) {
  // Dikelompokkan per kolom: angka barcode berderet pada satu sumbu.
  const kol = new Map();
  for (const a of angka) {
    const k = Math.round(a.kotak.x0 * 2) / 2;
    if (!kol.has(k)) kol.set(k, []);
    kol.get(k).push(a);
  }
  let terbesar = null;
  for (const [, daftar] of kol) {
    const digit = daftar.reduce((n, a) => n + a.teks.replace(/\D/g, '').length, 0);
    if (digit >= 12 && (!terbesar || digit > terbesar.digit)) terbesar = { daftar, digit };
  }
  if (terbesar) {
    const d = terbesar.daftar;
    const kotakAngka = {
      x0: Math.min(...d.map(a => a.kotak.x0)), x1: Math.max(...d.map(a => a.kotak.x1)),
      y0: Math.min(...d.map(a => a.kotak.y0)), y1: Math.max(...d.map(a => a.kotak.y1)),
    };
    // Kode dibaca menurut URUTAN GAMBARNYA di label, bukan urutan item pdf.js.
    const arahAngka = d[0].arah;
    const urut = [...d].sort((a, b) => arahAngka === 'datar' ? a.kotak.x0 - b.kotak.x0 : a.kotak.y0 - b.kotak.y0);
    const kode = urut.map(a => a.teks.replace(/\D/g, '')).join('');
    let ukur = null;
    try {
      ukur = JSON.parse(execFileSync('python3', ['tools/label/kotak_barcode.py', berkasArtwork,
        String(kotakAngka.x0), String(kotakAngka.y0), String(kotakAngka.x1), String(kotakAngka.y1)],
        { encoding: 'utf8' }));
    } catch (e) {
      console.error('PERINGATAN: kotak barcode tidak terukur (' + String(e.message || e).split('\n')[0] + ')');
    }
    barcode = { kode, arah: arahAngka, kotakAngka, ...(ukur || {}) };
    for (const a of d) dibuang.push({ k: 'barcode-angka', tm: a.tm, kotak: a.kotak, arah: a.arah, putar: a.diputar, lama: a.teks });
  }
}

const doc = await pdfLib.PDFDocument.load(buf.slice(0));
// Halaman DAN Form XObject di dalamnya. Sebagian designer menaruh blok
// teksnya di XObject; membaca Contents saja membuat 15 dari 19 blangko
// pertama masih membawa data ban asalnya.
const bagian = await streamTeks.ambilBagian(doc, pdfLib);
const hasil = streamTeks.buangDiBagian(bagian, dibuang.map(d => d.tm));
if (hasil.dibuang) streamTeks.tulisBagian(doc, pdfLib, hasil.bagian);

// Batang barcodenya ditutup SESUDAH teksnya dibuang: penutupnya digambar di
// atas, jadi urutannya penting.
// PENUTUP YANG KEBESARAN DITOLAK, BUKAN DIGAMBAR. Kalau pengukurannya
// meleset, yang hilang bagian design -- dan berkasnya tetap terlihat sehat.
if (barcode && barcode.alas && barcode.tinta) {
  const luasAlas = (barcode.alas.x1 - barcode.alas.x0) * (barcode.alas.y1 - barcode.alas.y0);
  const luasHalaman = (lebarPt / (72 / 25.4)) * (tinggiPt / (72 / 25.4));
  if (luasAlas > luasHalaman * 0.25) {
    console.error('PERINGATAN: kotak barcode kebesaran (' + Math.round(luasAlas / luasHalaman * 100) +
      '% lembar) — tidak ditutup, barcode lama masih ada di blangko');
    barcode.alas = null;
  }
}
if (barcode && barcode.alas && barcode.tinta) {
  const MM = 72 / 25.4;
  const pg = doc.getPage(0);
  const H = pg.getHeight();
  // Dijepit ke dalam alas putihnya, dengan sedikit jarak dari tepinya. Kalau
  // pengukurannya meleset sedikit pun ke luar, yang kena panel hijaunya.
  const jepit = (v, a, b) => Math.max(a, Math.min(b, v));
  const x0 = jepit(barcode.tinta.x0 - 0.3, barcode.alas.x0 + 0.1, barcode.alas.x1);
  const x1 = jepit(barcode.tinta.x1 + 0.3, barcode.alas.x0, barcode.alas.x1 - 0.1);
  const y0 = jepit(barcode.tinta.y0 - 0.3, barcode.alas.y0 + 0.1, barcode.alas.y1);
  const y1 = jepit(barcode.tinta.y1 + 0.3, barcode.alas.y0, barcode.alas.y1 - 0.1);
  pg.drawRectangle({ x: x0 * MM, y: H - y1 * MM, width: (x1 - x0) * MM, height: (y1 - y0) * MM,
    color: pdfLib.rgb(1, 1, 1) });
  barcode.penutup = { x0, y0, x1, y1 };
}

// Blangko TIDAK ditandai apa pun. Dia bukan artwork dan bukan dokumen jadi;
// dia bahan. Yang ditandai ARTWORK OTOMATIS adalah keluaran yang dibuat
// DARINYA, dan itu ditangani sulih().
const blangko = await doc.save();

await mkdir(keluar, { recursive: true });
const nama = (kunciTemplat + '-' + merek).replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
await writeFile(path.join(keluar, nama + '.pdf'), blangko);

// Kotak medan diukur DARI BERKAS INI. Inilah yang membuat blangko hasil panen
// lebih tepat daripada templat umum: posisinya posisi merek ini.
const peta = {
  kunci: kunciTemplat, merek,
  dari: path.basename(berkasArtwork),
  dipanen: new Date().toISOString(),
  halaman: { lebarPt, tinggiPt },
  jangkar: { teks: jangkar.teks, x: jangkar.x, y: jangkar.y },
  medan: dibuang.map(d => ({ k: d.k, kotak: d.kotak, arah: d.arah, putar: !!d.putar, contoh: d.lama })),
  takKetemu: hilang.map(c => ({ k: c.k, jarakTerdekatMm: c.jarak })),
  barcode,
};
await writeFile(path.join(keluar, nama + '.json'), JSON.stringify(peta, null, 2));

return {
  nama, blangko: path.join(keluar, nama + '.pdf'), peta: path.join(keluar, nama + '.json'),
  bita: blangko.length, dibuang: hasil.dibuang, penempatan: dibuang.length,
  gagalBuang: hasil.takKetemu.length,
  medan: dibuang.filter(d => !/\(salinan\)$/.test(d.k) && d.k !== 'barcode-angka').map(d => d.k),
  dilewatiTetap: ketemu.filter(c => !dariData(c.k)).map(c => c.k),
  takKetemu: hilang.map(c => c.k),
  barcode: barcode ? { kode: barcode.kode, arah: barcode.arah, ditutup: !!barcode.penutup } : null,
};
}

// --- CLI ------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [, , berkasArtwork, kunciTemplat, merek, keluar = '_to_delete/panen'] = process.argv;
  if (!berkasArtwork || !kunciTemplat || !merek) {
    console.error('pakai: node tools/label/panen.mjs <artwork.pdf> <kunci-templat> <merek> [keluar/]');
    process.exit(2);
  }
  const r = await panen({ berkasArtwork, kunciTemplat, merek, keluar });
  console.log('BLANGKO : ' + r.blangko + '  (' + r.bita + ' bita)');
  console.log('PETA    : ' + r.peta);
  console.log('dibuang : ' + r.dibuang + ' dari ' + r.penempatan + ' penempatan');
  if (r.gagalBuang) console.log('GAGAL BUANG: ' + r.gagalBuang + ' — teks lamanya masih tertinggal');
  console.log('medan    : ' + r.medan.join(', '));
  if (r.dilewatiTetap.length) console.log('dibiarkan: ' + r.dilewatiTetap.join(', ') + '  (bukan data)');
  console.log('barcode  : ' + (r.barcode ? r.barcode.kode + ' arah=' + r.barcode.arah + (r.barcode.ditutup ? ' ditutup' : ' TIDAK DITUTUP') : 'tidak terdeteksi'));
  if (r.takKetemu.length) console.log('tak ketemu: ' + r.takKetemu.join(', '));
}
