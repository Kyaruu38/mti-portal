// PANEN ASET MEREK dari satu artwork asli, untuk dipakai di pedoman label.
//
// Dijalankan DI LUAR portal, sekali per (templat + merek), dan hasilnya ikut
// repo sebagai data. Alasannya ada dua, dan keduanya sudah diuji:
//
//   1. Drive memblokir CORS untuk byte PDF-nya. Dari peramban, satu-satunya
//      jalur yang lolos mengembalikan PNG 1024 px -- sekitar 88 dpi untuk
//      lembar A4, tidak cukup untuk apa pun yang dipakai sebagai acuan
//      cetak. Lihat catatan di src/label/sulih.js. Di luar peramban batas
//      itu tidak berlaku: berkasnya diambil utuh lewat Drive API.
//   2. Aset merek TIDAK BERUBAH antar SKU. Memanennya saat pedoman dibuat
//      berarti mengulang pekerjaan yang sama ratusan kali untuk hasil yang
//      selalu sama.
//
// YANG DIPANEN cuma pita kepala: bidang warna merek berisi logonya. Itu
// satu-satunya bagian yang (a) ada di semua templat yang diperiksa, dan
// (b) letaknya bisa ditemukan tanpa diketik tangan. Blok peringatan,
// piktogram dan foto ban TIDAK diambil di sini: yang pertama berbeda
// bahasa per pasar, dan foto ban harus datang dari tabel pola_foto per
// pattern -- memanennya dari artwork berarti tiap label yang dibuat dari
// dasar ini membawa tapak ban yang salah, dan itu kesalahan yang tidak
// terlihat seperti kesalahan.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const DPI = 110;
const SINI = dirname(fileURLToPath(import.meta.url));

export async function panen(pdfPath, { merek, templat, dpi = DPI } = {}) {
  const kerja = mkdtempSync(join(tmpdir(), 'panen-'));
  const raster = join(kerja, 'r');
  execFileSync('pdftoppm', ['-r', String(dpi), '-png', '-singlefile', pdfPath, raster]);

  const keluar = execFileSync('python3', ['-I', join(SINI, 'kotak-label.py'), raster + '.png', String(dpi), '{}'], { encoding: 'utf8' });
  const info = JSON.parse(keluar);
  if (!info.ok) throw new Error('kotak label tidak ketemu: ' + info.sebab);

  const pitaTeks = execFileSync('python3', ['-I', '-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('kl', ${JSON.stringify(join(SINI, 'kotak-label.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
k = m.kotak_label(${JSON.stringify(raster + '.png')})
print(json.dumps(m.pita_kepala(${JSON.stringify(raster + '.png')}, k)))
`], { encoding: 'utf8' });
  const pita = JSON.parse(pitaTeks);
  if (!pita) throw new Error('pita kepala tidak ketemu — artwork ini perlu diukur tangan');

  const src = await PDFDocument.load(readFileSync(pdfPath));
  const [halSrc] = src.getPages();
  const H = halSrc.getHeight();
  const PX = 72 / dpi;
  const box = {
    left: pita.x0 * PX, right: pita.x1 * PX,
    bottom: H - pita.y1 * PX, top: H - pita.y0 * PX,
  };
  const out = await PDFDocument.create();
  const emb = await out.embedPage(halSrc, box);
  const lebar = box.right - box.left, tinggi = box.top - box.bottom;
  const pg = out.addPage([lebar, tinggi]);
  pg.drawPage(emb, { x: 0, y: 0, width: lebar, height: tinggi });

  const mm = 25.4 / dpi;
  const hx = (a) => '#%s'.replace('%s', a.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase());
  return {
    merek, templat,
    label_mm: info.label_mm,
    lembar_mm: info.lembar_mm,
    pita_mm: { lebar: +( (pita.x1 - pita.x0) * mm ).toFixed(1), tinggi: +( (pita.y1 - pita.y0) * mm ).toFixed(1) },
    warna_pita: hx(pita.warna_pita),
    logo: await out.save(),
  };
}

// Dijalankan langsung: node alat/panen-aset.mjs <pdf> <merek> <kunci-templat> [outdir]
if (process.argv[1] && process.argv[1].endsWith('panen-aset.mjs')) {
  const [pdfPath, merek, templat, outdir = join(SINI, 'aset')] = process.argv.slice(2);
  const hasil = await panen(pdfPath, { merek, templat });
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });
  const nama = `${templat.replace(/\.json$/, '')}__${merek}`.replace(/[^A-Za-z0-9_-]+/g, '-');
  writeFileSync(join(outdir, nama + '.pdf'), hasil.logo);
  const { logo, ...ringkas } = hasil;
  writeFileSync(join(outdir, nama + '.json'), JSON.stringify(ringkas, null, 2));

  // PRATINJAU WAJIB, dan ini bukan kemewahan.
  //
  // Pencari pita kepala itu USULAN, bukan bukti. Dia sudah salah dua kali
  // selama dibuat, dan dua-duanya salah DIAM: GOODRIDE terpotong jadi 10 mm
  // dari 26 mm karena hurufnya putih di atas hijau, dan WESTLAKE PT/TBR
  // sempat tidak ketemu sama sekali karena badannya oranye hanya 60% lebar
  // baris. Angkanya terlihat wajar di dua-duanya; yang memberi tahu cuma
  // GAMBARNYA. Logo yang salah potong tetap terlihat seperti logo, dan
  // sesudah masuk pedoman ia berangkat ke vendor tanpa ada yang memeriksa.
  //
  // Jadi tiap panen meninggalkan satu PNG di sebelah hasilnya. Memeriksanya
  // butuh dua detik per merek, dan itu satu-satunya langkah di jalur ini
  // yang memang harus dikerjakan mata.
  try {
    execFileSync('pdftoppm', ['-r', '150', '-png', '-singlefile',
      join(outdir, nama + '.pdf'), join(outdir, nama + '-pratinjau')]);
    console.error(`pratinjau: ${join(outdir, nama + '-pratinjau.png')} — PERIKSA sebelum dipakai.`);
  } catch (e) {
    console.error('pratinjau gagal dibuat: ' + (e.message || e));
  }
  console.log(JSON.stringify(ringkas));
}
