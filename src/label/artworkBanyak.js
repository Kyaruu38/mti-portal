// ---------------------------------------------------------------------------
// BANYAK ARTWORK SEKALIGUS, DARI SATU LEMBAR EXCEL.
//
// "gabisa tingal ngasih data dari excel gitu?" — bisa, dan ini jalurnya.
// Yang TIDAK bisa adalah membuat artwork dari data saja: logo, warna merek,
// tanda SNI, QR, blok peringatan dan piktogram semuanya VEKTOR di artworknya
// dan tidak ada di kolom mana pun. Dari Excel saja yang keluar cuma lembar
// data — halaman putih yang sudah ditolak.
//
// Jadi yang dilakukan jalur ini: datanya dari Excel, gambarnya dari artwork
// yang sudah ada di Drive, dan TIDAK ADA SEORANG PUN YANG MEMILIH BERKAS.
// Artworknya ditarik sendiri lewat drive-download (lihat dasar.js), per merek
// + keluarga, sekali, lalu dipakai ulang untuk semua baris merek itu.
//
// SATU BARIS GAGAL TIDAK MENGGAGALKAN SELEMBAR. Tiap baris dilaporkan
// sendiri-sendiri dengan sebabnya. Lembar 40 baris yang 3 barisnya datanya
// bolong harus menghasilkan 37 artwork plus 3 sebab — bukan satu pesan galat
// dan nol berkas. Ini pelajaran dari jalur-jalur lain di portal ini: yang
// gagal diam-diam atau gagal total sama-sama membuat orangnya mengulang
// seluruh pekerjaan.
// ---------------------------------------------------------------------------
import { PDFDocument } from 'pdf-lib';
import { artworkSatu } from './artworkSatu.js';
import { tempelPedoman } from './render.js';
import { kunciDasar, cari as cariDasar } from './dasar.js';
import { lihatPeta } from './dasarPeta.js';

/**
 * @param {Array<Object>} baris   baris data (nama kolom basis data: size, ean, ...)
 * @param {Object} opsi
 *   @param {Function} opsi.pilihTemplat   ({nama,spec,market}) => {ok,kunci,berkas,sebab}
 *   @param {Function} opsi.muatTemplat    (berkas) => Promise<templatJSON>
 *   @param {Function} opsi.itemTeks       (ArrayBuffer) => {items,tinggiPt}
 *   @param {Function} [opsi.unduh]        (urlAtauId) => {ok,bytes} — jalur Drive
 *   @param {Function} [opsi.cariDrive]    (barisnya) => drive_url milik ERP itu
 *   @param {boolean}  [opsi.pedoman=true] tempelkan halaman pedoman di tiap artwork
 *   @param {Function} [opsi.kabar]        (sudah, dari, erp) => void
 */
export async function artworkBanyak(baris, opsi = {}) {
  const {
    pilihTemplat, muatTemplat, itemTeks,
    unduh = null, cariDrive = null, pedoman = true, kabar = null, tandai = true,
  } = opsi;

  const gabungan = await PDFDocument.create();
  const berhasil = [];
  const gagal = [];

  // Singgahan dalam-proses. dasar.cari() sudah menyinggahkan ke IndexedDB,
  // tapi lembar 40 baris dengan 6 merek tetap akan membuka IndexedDB 40 kali
  // dan — lebih mahal — memanggil fungsi tepinya ulang di peramban yang
  // IndexedDB-nya diblokir. Satu Map menutup dua-duanya.
  const singgahanDasar = new Map();
  const singgahanTemplat = new Map();

  let n = 0;
  for (const b of baris) {
    n++;
    const erp = b.erp || b.ERP || `(baris ${n})`;
    if (kabar) { try { kabar(n, baris.length, erp); } catch { /* laporan kemajuan tidak boleh menggagalkan kerjanya */ } }
    try {
      const p = pilihTemplat({ nama: b.nameEn || b.nama || b.spec, spec: b.spec, market: b.market });
      if (!p || !p.ok) throw new Error(p && p.sebab ? p.sebab : 'templat tidak ketemu untuk baris ini');

      const merek = b.brand || b.merek || '';
      if (!merek) {
        // Tanpa merek, artwork dasarnya akan diambil dari keluarga mana pun —
        // dan yang keluar label merek A dengan LOGO merek B. Satu-satunya
        // ragam gagal di jalur ini yang tidak terlihat seperti kesalahan.
        throw new Error('baris ini tidak punya merek, artwork dasarnya tidak bisa ditentukan');
      }

      const kd = kunciDasar(p.kunci, merek);
      let dasarBytes = singgahanDasar.get(kd);
      if (!dasarBytes) {
        const d = await cariDasar(p.kunci, merek, {
          driveUrl: cariDrive ? (cariDrive(b) || '') : (b.driveUrl || ''),
          unduh,
        });
        if (!d) {
          const pt = lihatPeta(p.kunci, merek);
          throw new Error(pt && !pt.bisa
            ? `artwork ${merek} ${p.kunci} tidak bisa dipakai jalur ini: ${pt.sebab}`
            : `belum ada artwork dasar untuk ${merek} ${p.kunci}, dan tidak bisa ditarik dari Drive`);
        }
        dasarBytes = d.bytes;
        singgahanDasar.set(kd, dasarBytes);
      }

      let t = singgahanTemplat.get(p.berkas);
      if (!t) { t = await muatTemplat(p.berkas); singgahanTemplat.set(p.berkas, t); }

      const r = await artworkSatu({
        bytes: dasarBytes instanceof ArrayBuffer ? dasarBytes.slice(0) : new Uint8Array(dasarBytes).slice().buffer,
        templat: t, berkasTemplat: p.berkas, baris: b, erp,
        dari: `${kd} · ${p.berkas}`, itemTeks, tandai,
      });

      let bytesAkhir = r.pdf;
      let bolong = [];
      if (pedoman) {
        // takTersulih diteruskan: tanpa itu pedoman akan mencetak nilai yang
        // DIMAKSUD untuk medan yang labelnya masih membawa nilai lama, dan
        // dokumen yang dipakai MEMERIKSA label justru jadi yang membenarkan
        // kesalahannya.
        const tp = await tempelPedoman(r.pdf, t, b, { erp, dari: `${kd} · ${p.berkas}`, takTersulih: r.takTersulih });
        bytesAkhir = tp.pdf;
        bolong = tp.bolong || [];
      }

      const satu = await PDFDocument.load(bytesAkhir);
      const hal = await gabungan.copyPages(satu, satu.getPageIndices());
      for (const x of hal) gabungan.addPage(x);

      berhasil.push({
        erp, merek, kunci: p.kunci,
        diganti: r.gantian.filter(g => !String(g.catatan).includes('salinan')).length,
        koordinat: r.nKoordinat, isi: r.nIsi,
        lewat: r.lewat, bolong: bolong.map(x => x.k || x), belumTersulih: r.takTersulih,
      });
    } catch (e) {
      gagal.push({ erp, sebab: e.message || String(e) });
    }
  }

  if (!berhasil.length) {
    // Berkas nol halaman yang diserahkan sebagai hasil terlihat seperti
    // berkas rusak, dan menyembunyikan sebab aslinya.
    throw new Error('tidak ada satu pun baris yang jadi artwork:\n' +
      gagal.map(g => `  ${g.erp} — ${g.sebab}`).join('\n'));
  }

  return { pdf: await gabungan.save(), berhasil, gagal, jumlahHalaman: gabungan.getPageCount() };
}
