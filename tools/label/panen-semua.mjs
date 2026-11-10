// Memanen blangko untuk SEMUA artwork di satu folder, sekali jalan.
//
// Merek dan keluarga dibaca dari nama berkasnya, karena di situlah MTI memang
// menyimpannya: "(ID-GR-TBR-SNI)" = merek GR, konstruksi TBR, pasar SNI.
// Kode merek pendek dipetakan ke nama penuhnya; yang sudah panjang dipakai
// apa adanya. Kalau polanya tidak cocok, berkasnya DILEWATI dan disebut --
// menebak merek berarti menyimpan blangko merek lain dengan nama merek ini,
// dan itu kesalahan yang tidak terlihat seperti kesalahan.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { panen } from './panen.mjs';

const KODE_MEREK = {
  GR: 'GOODRIDE', YR: 'YARTU', CY: 'CHAOYANG', TN: 'TRAZANO',
  JG: 'GOLDEN CROWN', WL: 'WESTLAKE', TKV: 'TKV',
};

const folder = process.argv[2];
const keluar = process.argv[3] || '_to_delete/panen';
if (!folder) { console.error('pakai: node tools/label/panen-semua.mjs <folder> [keluar/]'); process.exit(2); }

const semua = (await readdir(folder)).filter(f => /\.pdf$/i.test(f));
const antre = new Map();   // kunci blangko -> berkas pertama yang cocok
const lewat = [];

for (const f of semua) {
  const m = f.match(/\(ID-(.+?)[-\s](TBR|PCR|BIAS|OTR|ST)[-\s](SNI|BX|PT|OEM)\)/i);
  if (!m) { lewat.push([f, 'nama berkasnya tidak membawa (ID-merek-konstruksi-pasar)']); continue; }
  const kodeMerek = m[1].trim().toUpperCase();
  const merek = KODE_MEREK[kodeMerek] || kodeMerek;
  const kunci = m[3].toUpperCase() + '/' + m[2].toUpperCase();
  if (kunci.startsWith('OEM/')) { lewat.push([f, 'OEM — tata letaknya milik pelanggan, bukan keluarga templat']); continue; }
  const k = kunci + '|' + merek;
  // Satu blangko per merek+keluarga: berkas kedua yang sama tidak menambah
  // apa pun, cuma menimpa dengan isi yang sama.
  if (!antre.has(k)) antre.set(k, { berkas: path.join(folder, f), kunci, merek });
}

console.log('artwork di folder : ' + semua.length);
console.log('blangko yang dicoba: ' + antre.size + '\n');

const jadi = [], gagal = [];
for (const [k, a] of antre) {
  try {
    const r = await panen({ berkasArtwork: a.berkas, kunciTemplat: a.kunci, merek: a.merek, keluar });
    jadi.push({ k, ...r });
    const bc = r.barcode ? (r.barcode.ditutup ? 'barcode dibuang' : 'BARCODE MASIH ADA') : 'barcode tak terdeteksi';
    console.log('  OK    ' + k.padEnd(26) + r.medan.length + ' medan dibuang, ' + bc);
  } catch (e) {
    gagal.push({ k, sebab: String(e.message || e) });
    console.log('  TOLAK ' + k.padEnd(26) + String(e.message || e));
  }
}

console.log('\n==== RINGKASAN ====');
console.log('blangko jadi : ' + jadi.length);
console.log('ditolak      : ' + gagal.length);
console.log('dilewati     : ' + lewat.length);
const tanpaBarcode = jadi.filter(r => !r.barcode);
if (tanpaBarcode.length) console.log('PERIKSA TANGAN (barcode tak terdeteksi): ' + tanpaBarcode.map(r => r.k).join(', '));
const masihAda = jadi.filter(r => r.barcode && !r.barcode.ditutup);
if (masihAda.length) console.log('BARCODE LAMA MASIH ADA: ' + masihAda.map(r => r.k).join(', '));
const sisaTeks = jadi.filter(r => r.gagalBuang);
if (sisaTeks.length) console.log('TEKS LAMA TERTINGGAL: ' + sisaTeks.map(r => r.k + '(' + r.gagalBuang + ')').join(', '));
