// PENYARINGAN ARTWORK DASAR — satu lewatan atas semua berkas yang dipanen,
// untuk memutuskan mana yang BOLEH disuntik sebagai artwork dasar.
//
// KENAPA PENYARINGAN, BUKAN SEKADAR "UNDUH LALU SIMPAN". Aturannya sudah
// ditulis di src/label/dasar.js dan alasannya tidak enak: artwork dasar yang
// TIDAK BISA DIPAKAI membuat SETIAP kode ERP merek itu gagal otomatis, tanpa
// ada seorang pun yang pernah menekan apa pun. Dasar yang salah lebih buruk
// daripada dasar yang kosong, karena yang kosong masih minta berkas; yang
// salah cuma gagal diam-diam.
//
// Jadi tiap berkas harus MEMBUKTIKAN dirinya lewat rantai yang sama dengan
// jalur sulih di portal, sampai BACA ULANG: nilai yang disulih harus benar
// terbaca di lapisan teks keluarannya. Lolos = boleh jadi dasar. Tolak =
// disebut sebabnya, dan tidak disuntik.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import * as sp from '../../src/label/sumberPdf.js';
import { sulih } from '../../src/label/sulih.js';
import { isiMedan } from '../../src/label/peta.js';
import { TEMPLAT } from '../../src/label/templat.js';

const DIR = new URL('./unduh/', import.meta.url);
const pdfjs = await import(pathToFileURL('./node_modules/pdfjs-dist/legacy/build/pdf.mjs').href);
const AKAR = pathToFileURL('./node_modules/pdfjs-dist/').href;
const muat = f => JSON.parse(readFileSync('./src/label/templat/' + f, 'utf8'));

// Nilai uji per keluarga. Harus BERBEDA dari isi artworknya, kalau tidak
// "berhasil disulih" tidak membuktikan apa pun.
const UJI = {
  TBR:  { size: '12R22.5', pattern: 'AZ599', load_speed: '152/149K', ply: '18PR', ply_block: 'J18', tt_tl: 'ALL STEEL TUBELESS', ean: '0721688049991', ms: 'M+S' },
  BIAS: { size: '9.00-20',  pattern: 'CR926', load_speed: '144/142J', ply: '16PR', ply_block: 'H16', tt_tl: 'TUBE TYPE',          ean: '0721688049992' },
  PCR:  { size: '195/65R15',pattern: 'RP88',  load_speed: '91V',      ply: '4PR',  ply_block: 'B4',  tt_tl: 'TUBELESS',            ean: '0721688049993' },
  ST:   { size: 'ST215/75R14', pattern: 'ST990', load_speed: '108/104M', ply: '8PR', ply_block: 'D8', tt_tl: 'TUBELESS',          ean: '0721688049994' },
};

const hasil = [];
const berkas = readdirSync(DIR).filter(f => f.endsWith('.pdf')).sort();

for (const f of berkas) {
  const nama = f.replace(/\.pdf$/, '');
  const [kunciBerkas, merek] = nama.split('__');
  const kunci = kunciBerkas.replace('-', '/');
  const tpl = TEMPLAT[kunci];
  const baris = UJI[kunci.split('/')[1]] || UJI.TBR;
  const r = { kunci, merek, berkas: f, tpl };

  if (!tpl) { r.putusan = 'TOLAK'; r.sebab = 'tidak ada templat untuk ' + kunci; hasil.push(r); continue; }

  let buf;
  try { buf = new Uint8Array(readFileSync(new URL(f, DIR))); }
  catch (e) { r.putusan = 'TOLAK'; r.sebab = 'tidak terbaca: ' + e.message; hasil.push(r); continue; }
  r.kb = Math.round(buf.length / 1024);

  try {
    const doc = await pdfjs.getDocument({ data: buf.slice(0), cMapUrl: AKAR + 'cmaps/', cMapPacked: true, standardFontDataUrl: AKAR + 'standard_fonts/' }).promise;
    r.hal = doc.numPages;
    const page = await doc.getPage(1);
    // rotation:0 — sama dengan yang dipulangkan itemTeks() di portal. Matriks
    // potongan teksnya ada di ruang PDF yang belum diputar, jadi tinggi yang
    // dipakai membalik sumbu Y harus tinggi tanpa putaran juga.
    r.putaran = page.rotate || 0;
    const vp = page.getViewport({ scale: 1, rotation: 0 });
    const sumber = sp.keMedanSumber((await page.getTextContent()).items, vp.height);
    r.potong = sumber.length;
    if (sumber.length === 0) { r.putusan = 'TOLAK'; r.sebab = 'lapisan teks KOSONG — seluruh hurufnya kurva'; hasil.push(r); continue; }

    const j = sp.cariJangkar(sumber, tpl);
    r.jangkar = j.ok;
    const t = muat(tpl);
    const cocok = j.ok ? sp.cocokkanMedan(t, sumber, j) : [];
    r.koor = cocok.filter(c => c.ketemu).length;
    r.koorDari = cocok.length;
    const isi = sp.cocokkanIsi(t, sumber, j.ok ? j : { ok: false }).filter(x => x.ketemu);
    r.isi = isi.length;
    r.isiPasti = isi.filter(x => x.pasti).length;
    // Lintas golongan tidak boleh pernah terjadi: itu alasan pencocokan isi ada.
    r.silang = isi.filter(x => sp.golongan(x.lama) !== x.golongan).length;

    // Sumber gantian: koordinat dulu, isi menambal yang belum terisi.
    const pakai = new Map();
    for (const c of cocok) if (c.ketemu) pakai.set(c.k, c);
    for (const x of isi) if (x.pasti && !pakai.has(x.k)) pakai.set(x.k, x);

    const gantian = [];
    for (const c of pakai.values()) {
      const med = t.medan.find(m => m.k === c.k);
      if (!med || med.tetap) continue;
      const nilai = isiMedan(med, baris);
      if (!nilai.nilai || nilai.nilai === c.lama) continue;
      if (sp.bolehGanti(c.k, c.lama, nilai.nilai)) continue;
      gantian.push({ ...c.kotak, nilai: nilai.nilai, putar: c.putar, arah: c.arah, tm: c.tm, catatan: c.k, lama: c.lama });
    }
    r.ganti = gantian.length;
    if (gantian.length === 0) {
      r.putusan = 'TOLAK';
      r.sebab = j.ok ? 'jangkar ketemu tapi tidak ada medan yang bisa disulih' : 'jangkar tidak ketemu: ' + j.sebab;
      hasil.push(r); continue;
    }

    // tandai:false — pita 'bukan untuk dicetak' menambah 13pt ke MediaBox
    // (sulih.js baris 162). Dengan pita menyala, pembandingan ukuran lembar
    // selalu 'berubah', dan itu BUKAN kegagalan berkasnya. Penyaringan ini
    // mematikan pitanya supaya yang dibandingkan memang geometri aslinya.
    const out = await sulih(buf.slice(0), gantian, { erp: 'SARING', dari: tpl, tandai: false });
    const od = await PDFDocument.load(out.pdf);
    r.halKeluar = od.getPageCount();
    // DIBANDINGKAN SESAMA pdf-lib, bukan lawan viewport pdfjs. pdfjs sudah
    // menerapkan /Rotate pada viewport-nya, jadi untuk halaman yang diputar
    // 90 derajat lebar dan tingginya TERTUKAR -- dan pembandingan lintas
    // pustaka itu melaporkan 'ukuran lembar berubah' pada berkas yang
    // sebenarnya utuh. Masuk ke daftar kesalahan ukur gw yang kedua di
    // pemeriksaan ini; yang pertama pita 13pt.
    const idoc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
    const ip = idoc.getPage(0);
    r.lembar = `${Math.round(ip.getWidth())}x${Math.round(ip.getHeight())}`;
    r.lembarKeluar = `${Math.round(od.getPage(0).getWidth())}x${Math.round(od.getPage(0).getHeight())}`;
    r.lembarUtuh = r.lembar === r.lembarKeluar;

    // BACA ULANG — bukti sebenarnya.
    const d2 = await pdfjs.getDocument({ data: new Uint8Array(out.pdf), cMapUrl: AKAR + 'cmaps/', cMapPacked: true, standardFontDataUrl: AKAR + 'standard_fonts/' }).promise;
    const teks2 = (await (await d2.getPage(1)).getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ');
    const mau = [...new Set(gantian.map(g => String(g.nilai)))];
    r.terbaca = mau.filter(v => teks2.includes(v)).length;
    r.mau = mau.length;

    if (!r.lembarUtuh) { r.putusan = 'TOLAK'; r.sebab = `ukuran lembar berubah ${r.lembar} -> ${r.lembarKeluar}`; }
    else if (r.silang > 0) { r.putusan = 'TOLAK'; r.sebab = r.silang + ' pasangan lintas golongan'; }
    else if (r.terbaca === 0) { r.putusan = 'TOLAK'; r.sebab = 'tidak satu pun dari ' + r.mau + ' nilai baru terbaca di keluarannya'; }
    else if (r.terbaca < r.mau) { r.putusan = 'LOLOS-SEBAGIAN'; r.sebab = `${r.terbaca}/${r.mau} nilai terbaca`; }
    else r.putusan = 'LOLOS';
  } catch (e) {
    r.putusan = 'TOLAK'; r.sebab = 'galat: ' + String(e.message).slice(0, 90);
  }
  hasil.push(r);
}

const lebar = Math.max(...hasil.map(h => h.merek.length));
console.log('KUNCI'.padEnd(9) + 'MEREK'.padEnd(lebar + 2) + 'POT  JGK KOOR   ISI  GANTI BACA  PUTUSAN');
for (const h of hasil) {
  console.log(
    h.kunci.padEnd(9) + h.merek.padEnd(lebar + 2) +
    String(h.potong ?? '-').padEnd(5) +
    (h.jangkar === undefined ? '-' : h.jangkar ? 'ya ' : 'tdk').padEnd(4) +
    `${h.koor ?? '-'}/${h.koorDari ?? '-'}`.padEnd(7) +
    `${h.isiPasti ?? '-'}/${h.isi ?? '-'}`.padEnd(6) +
    String(h.ganti ?? '-').padEnd(6) +
    `${h.terbaca ?? '-'}/${h.mau ?? '-'}`.padEnd(6) +
    h.putusan + (h.sebab ? ' — ' + h.sebab : ''));
}
const n = p => hasil.filter(h => h.putusan === p).length;
console.log(`\nLOLOS ${n('LOLOS')}   LOLOS-SEBAGIAN ${n('LOLOS-SEBAGIAN')}   TOLAK ${n('TOLAK')}   dari ${hasil.length} berkas`);
writeFileSync(new URL('./putusan.json', import.meta.url), JSON.stringify(hasil, null, 2));
