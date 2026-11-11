// =============================================================================
// DAFTAR URGENSI LABEL — menggabungkan tiga sumber jadi satu daftar beli.
// -----------------------------------------------------------------------------
// KENAPA LAYAR INI ADA, kata pemiliknya sendiri: "data yg sona kasih itu ga
// akurat". Jadi yang dipakai membeli bukan daftar Sona, melainkan daftar ini —
// gabungan permintaan Sona, stok gudang Indonesia, dan jadwal kirim gudang
// China, yang diperbaiki orang-orangnya sendiri (cania, visca, kevin) dengan
// apa yang mereka dapat dari gudang.
//
// KUNCI GABUNGNYA BUKAN NAMA, dan itu diukur bukan ditebak. Nama barang
// ditulis tiga gaya berbeda di tiga berkas: merek kadang Mandarin saja, indeks
// beban kadang ada kadang tidak, dan ukuran ditulis '10.00-20' di satu tempat
// lalu '10.00R20' di tempat lain. Mencocokkan nama utuh cuma dapat 19%.
// Kuncinya (ukuran, kode pola, ply) dapat 100% di sisi Sona dan 94-99% di sisi
// gudang.
//
// Kunci ini TIDAK bisa dipakai menentukan merek — satu spec ban dijual di
// banyak merek, dan cara itu sudah pernah dicoba lalu dibuang karena
// menghasilkan 威狮=ARISUN dan 朝阳=GOODRIDE. Di sini dia cuma dipakai untuk
// menjawab "baris gudang mana yang bicara tentang barang yang sama", dan untuk
// pertanyaan itu dia benar.
//
// YANG TIDAK KETEMU TIDAK DIBUANG, dan ini aturan paling keras di berkas ini.
// Separuh kebutuhan Sona tidak punya data gudang sama sekali. Baris itu justru
// yang paling perlu dilihat orang: dia tidak bisa diputuskan dibeli atau tidak
// selama angkanya belum ada, dan membuangnya berarti memutuskannya jadi
// "tidak dibeli" tanpa ada yang pernah memutuskan.
// =============================================================================

import { orderMatchKeys } from './labelOrders.js';

export const STATUS = {
  LENGKAP: 'lengkap',
  TANPA_GUDANG: 'tidak ada data gudang',
  TANPA_INDO: 'stok WH Indo tidak diketahui',
  TANPA_CHINA: 'ETA China tidak diketahui',
  ETA_KOSONG: 'ETA belum dijadwalkan',
  SUDAH_DIPESAN: 'sudah dipesan bulan ini',
};

// Ukuran ban dalam segala bentuk yang benar-benar muncul di ketiga berkas:
// '10.00-20', '295/80R22.5', '25×8-12', 'ST155/80R13', '155/80ZR13'.
const SIZE = /(?:ST)?\d{1,3}(?:\.\d{1,2})?(?:\/\d{2,3}(?:\.\d)?)?\s*(?:ZR|[-RrZz×x])\s*\d{1,2}(?:\.\d)?/i;
const PAT = /\[([^\]]+)\]/;
const PLY = /(\d{1,2})\s*PR\b/i;

// Jadwal kirim WH China ditulis sebagai teks banyak baris di satu sel:
//   '2026/11/20(1060)\n2026/11/07(1060)'    -> tanggal + jumlah
//   '等送货通知(500)'                        -> "menunggu pemberitahuan kirim"
// Dua bentuk itu BEDA ARTINYA dan tidak boleh dijumlahkan jadi satu angka:
// yang pertama barang yang sudah ada tanggalnya, yang kedua barang yang sudah
// dipesan tapi belum dijadwalkan. Yang kedua tidak bisa dipakai menghitung
// "cukup sampai tanggal X" karena tidak ada tanggal X-nya.
const TGL = /(20\d\d)[/-](\d{1,2})[/-](\d{1,2})\s*\((\d+)\)/g;
const NOTIF = /等送货通知\s*\((\d+)\)/g;

const padat = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Kunci gabung sebuah nama/spec: 'ukuran|pola|ply', atau '' kalau tidak bisa.
 *
 * Prefiks '(ID-..-..-..)' dibuang DULU. Kalau tidak, '(ID-ST-TBR-BX)' bisa
 * ikut terbaca sebagai ukuran oleh pola ST di atas.
 */
export function kunciGabung(nama) {
  const s = String(nama || '').replace(/^\(ID-[^)]*\)/, '').trim();
  if (!s) return '';
  const pola = PAT.exec(s);
  const uk = SIZE.exec(s);
  // Dua-duanya WAJIB. Ukuran saja tidak cukup: satu ukuran dipakai banyak pola,
  // dan mencocokkan lewat ukuran saja akan menjumlahkan stok ban yang berbeda.
  if (!pola || !uk) return '';
  const ply = PLY.exec(s);
  return [padat(uk[0]), padat(pola[1]), ply ? ply[1] : ''].join('|');
}

export function angka(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Stok WH Indo per kunci. sistem = angka di sistem, fisik = hasil hitung orang. */
export function indeksIndo(rows) {
  const out = new Map();
  for (const r of (rows || [])) {
    const k = kunciGabung(r.nama || r.spec);
    if (!k) continue;
    let e = out.get(k);
    if (!e) out.set(k, (e = { sistem: 0, fisik: 0, baris: 0, nama: r.nama || r.spec || '' }));
    const s = angka(r.sistem), f = angka(r.aktual != null ? r.aktual : r.fisik);
    if (s) e.sistem += s;
    if (f) e.fisik += f;
    e.baris++;
  }
  return out;
}

/** Jadwal kirim WH China per kunci. */
export function indeksChina(rows) {
  const out = new Map();
  for (const r of (rows || [])) {
    const k = kunciGabung(r.nama || r.spec);
    if (!k) continue;
    let e = out.get(k);
    if (!e) out.set(k, (e = { pesan: 0, jadwal: [], tanpaJadwal: 0, nama: r.nama || r.spec || '' }));
    const q = angka(r.qty);
    if (q) e.pesan += q;
    const teks = String(r.jadwal || '');
    TGL.lastIndex = 0;
    for (let m; (m = TGL.exec(teks));) {
      e.jadwal.push({ tgl: `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`, qty: Number(m[4]) });
    }
    NOTIF.lastIndex = 0;
    for (let m; (m = NOTIF.exec(teks));) e.tanpaJadwal += Number(m[1]);
  }
  for (const e of out.values()) e.jadwal.sort((a, b) => (a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : 0));
  return out;
}

const JAUH = '2099-12-31';

/**
 * PO BULAN INI, per baris kebutuhan.
 *
 * Aturannya dari pemiliknya: "yang udah di PO di bulan yang sama di kasih
 * ilangin aja dan di tulis sisanya udh di psen di tgl brp".
 *
 * BULAN KALENDER, bukan jendela berjalan. recentOrdersFor() di labelOrders.js
 * memakai jendela 40 hari dan itu benar untuk pertanyaannya sendiri ("apakah
 * ini baru saja dipesan"), tapi pertanyaan DI SINI berbeda: "apakah kebutuhan
 * bulan ini sudah tertutup". PO tanggal 28 bulan lalu masuk jendela 40 hari
 * tapi bukan pesanan bulan ini.
 *
 * Pencocokan barisnya memakai orderMatchKeys() milik labelOrders.js, bukan
 * salinan kedua: dua aturan yang berbeda akan terbaca sebagai "sudah dipesan"
 * di satu layar dan "belum" di layar sebelahnya.
 */
export function poBulan(pos, baris, bulan) {
  const want = orderMatchKeys(baris);
  if (!want.erp && !want.spec) return [];
  const out = [];
  for (const po of (pos || [])) {
    if (po.source !== 'label') continue;
    // Ditolak dan dihapus tidak pernah jadi pesanan. Yang MENUNGGU approval
    // sengaja ikut dihitung — sama seperti recentOrdersFor(), dan alasannya
    // sama: PO yang belum jalan tidak muncul di Order Tracking, jadi kalau
    // tidak dihitung di sini dia tidak terhitung di mana pun dan barangnya
    // dipesan dua kali.
    if (po.status === 'Rejected' || po.deletedAt) continue;
    const dibuat = new Date(po.createdAt);
    if (isNaN(dibuat)) continue;
    const bln = `${dibuat.getFullYear()}-${String(dibuat.getMonth() + 1).padStart(2, '0')}`;
    if (bulan && bln !== bulan) continue;
    for (const line of (po.items || [])) {
      const got = orderMatchKeys(line);
      const cocok = (want.erp && got.erp && want.erp === got.erp)
                 || (!want.erp && want.spec && got.spec && want.spec === got.spec);
      if (!cocok) continue;
      out.push({
        poNo: po.contract || po.no,
        status: po.status,
        tgl: po.createdAt,
        qty: Number(line.qty) || 0,
      });
    }
  }
  return out.sort((a, b) => (a.tgl < b.tgl ? -1 : 1));
}

export function bulanIni(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Menggabungkan tiga sumber jadi daftar urgensi.
 *
 * koreksi: Map/objek kunci -> { fisik, butuh, catatan, oleh, pada }
 *   Koreksi anak-anaknya MENANG atas angka berkas, TAPI angka berkasnya tetap
 *   dibawa sebagai fisikFile / butuhFile. Menimpanya berarti menghapus satu-
 *   satunya bukti bahwa berkasnya memang salah — dan "data yg sona kasih ga
 *   akurat" cuma bisa dibuktikan kalau dua angkanya masih ada dua-duanya.
 *   Kuncinya kunci gabung, BUKAN indeks baris: berkasnya diunggah ulang tiap
 *   periode dan urutannya berubah, jadi koreksi berindeks akan menempel ke
 *   barang yang salah pada unggahan berikutnya.
 */
export function gabungkan({ sona = [], indo = [], china = [], koreksi = {}, pos = [], now = new Date() } = {}) {
  const iIndo = indeksIndo(indo);
  const iChina = indeksChina(china);
  const bln = bulanIni(now);
  const amb = (k) => (koreksi instanceof Map ? koreksi.get(k) : koreksi[k]) || null;

  const baris = (sona || []).map((r, idx) => {
    const k = kunciGabung(r.spec || r.label || r.nama);
    const i = k ? iIndo.get(k) : null;
    const c = k ? iChina.get(k) : null;
    const kor = k ? amb(k) : null;

    const butuhFile = angka(r.qty) || 0;
    const fisikFile = i ? i.fisik : null;
    const sistem = i ? i.sistem : null;

    const butuh = (kor && angka(kor.butuh) != null) ? angka(kor.butuh) : butuhFile;
    const fisik = (kor && angka(kor.fisik) != null) ? angka(kor.fisik) : fisikFile;

    const jalan = c ? c.jadwal.reduce((a, x) => a + x.qty, 0) : null;
    const belum = c ? c.tanpaJadwal : null;
    const tgl = (c && c.jadwal.length) ? c.jadwal[0].tgl : null;

    let status;
    if (!i && !c) status = STATUS.TANPA_GUDANG;
    else if (!i) status = STATUS.TANPA_INDO;
    else if (!c) status = STATUS.TANPA_CHINA;
    else if (!tgl) status = STATUS.ETA_KOSONG;
    else status = STATUS.LENGKAP;

    // tanpaJadwal TIDAK dihitung sebagai tersedia. Barang yang sudah dipesan
    // tapi belum dijadwalkan tidak bisa menutup kebutuhan bertanggal, dan
    // menjumlahkannya ke sini akan membuat baris yang sebenarnya kurang
    // terbaca cukup.
    const tersedia = (fisik || 0) + (jalan || 0);
    const kurang = (i || c) ? butuh - tersedia : null;

    const po = poBulan(pos, r, bln);
    const sudahDipesan = po.reduce((a, x) => a + x.qty, 0);
    // sisaKurang: kebutuhan yang BELUM tertutup, sesudah PO bulan ini dikurangi.
    const sisaKurang = (kurang == null) ? null : Math.max(0, kurang - sudahDipesan);
    if (kurang != null && kurang > 0 && sisaKurang === 0) status = STATUS.SUDAH_DIPESAN;

    return {
      kunci: k,
      erp: r.erp || '', market: r.market || '', spec: r.spec || r.label || r.nama || '',
      butuh, butuhFile,
      sistem, fisik, fisikFile,
      // Selisih sistem vs fisik: "Dua-duanya ditampilin, selisihnya ditandai".
      selisih: (sistem == null || fisik == null) ? null : fisik - sistem,
      // Selisih angka berkas vs angka yang dikoreksi orangnya. Dua selisih yang
      // BERBEDA, dan dua-duanya harus kelihatan: yang satu bilang "sistem dan
      // gudang tidak sama", yang satu bilang "berkasnya dibetulkan orang".
      dikoreksi: !!kor,
      koreksiOleh: kor ? (kor.oleh || '') : '',
      koreksiPada: kor ? (kor.pada || '') : '',
      catatan: kor ? (kor.catatan || '') : '',
      jalan, belum, tgl,
      kurang, sudahDipesan, sisaKurang, po,
      status,
      namaIndo: i ? i.nama : '', namaChina: c ? c.nama : '',
      _row: idx + 1,
    };
  });

  return { baris: urutUrgensi(baris), ringkasan: ringkas(baris), bulan: bln };
}

/**
 * URUTAN: tanggal terdekat dulu — itu yang diminta pemiliknya ("dari kebutuhan
 * di tanggal terdekat").
 *
 * Baris tanpa tanggal TIDAK ditaruh paling bawah, dan itu disengaja: tidak
 * punya tanggal bukan berarti tidak mendesak, justru belum ketahuan — dan yang
 * belum ketahuan tidak bisa dibeli maupun diabaikan. Dia naik ke golongan
 * kedua, di atas baris yang stoknya sudah cukup.
 */
export function urutUrgensi(baris) {
  const gol = (b) => {
    if (b.status === STATUS.SUDAH_DIPESAN) return 3;
    if (b.sisaKurang != null && b.sisaKurang > 0) return 0;
    if (b.status === STATUS.TANPA_GUDANG || b.status === STATUS.TANPA_INDO || b.status === STATUS.TANPA_CHINA) return 1;
    return 2;
  };
  return baris.slice().sort((a, b) => {
    const ga = gol(a), gb = gol(b);
    if (ga !== gb) return ga - gb;
    const ta = a.tgl || JAUH, tb = b.tgl || JAUH;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (b.sisaKurang || 0) - (a.sisaKurang || 0);
  });
}

export function ringkas(baris) {
  const r = { total: baris.length, kurang: 0, cukup: 0, sudahDipesan: 0, tanpaGudang: 0, tanpaIndo: 0, tanpaChina: 0, etaKosong: 0, dikoreksi: 0, selisihStok: 0 };
  for (const b of baris) {
    if (b.status === STATUS.TANPA_GUDANG) r.tanpaGudang++;
    if (b.status === STATUS.TANPA_INDO) r.tanpaIndo++;
    if (b.status === STATUS.TANPA_CHINA) r.tanpaChina++;
    if (b.status === STATUS.ETA_KOSONG) r.etaKosong++;
    if (b.status === STATUS.SUDAH_DIPESAN) r.sudahDipesan++;
    else if (b.sisaKurang != null && b.sisaKurang > 0) r.kurang++;
    else if (b.sisaKurang === 0) r.cukup++;
    if (b.dikoreksi) r.dikoreksi++;
    if (b.selisih != null && b.selisih !== 0) r.selisihStok++;
  }
  return r;
}

// ---------------------------------------------------------------------------
// SNAPSHOT DAN PERGERAKAN ETA
//
// Yang diminta pemiliknya: "belum lagi ada update pergerakan buat shipment
// kita juga kan". Jadi pertanyaannya bukan "kapan ETA-nya" melainkan "ETA-nya
// GESER berapa hari sejak unggahan terakhir" — dan itu tidak bisa dijawab oleh
// satu berkas, sekuat apa pun parsernya. Harus ada yang menyimpan keadaan
// sebelumnya.
//
// Yang disimpan sesedikit mungkin: kunci, tanggal paling awal, jumlah
// terjadwal, jumlah tanpa jadwal. Menyimpan seluruh barisnya berarti setiap
// unggahan menambah satu salinan penuh daftarnya ke basis data.
export function snapshotDari(baris) {
  const out = {};
  for (const b of baris) {
    if (!b.kunci) continue;
    out[b.kunci] = { tgl: b.tgl || null, jalan: b.jalan == null ? null : b.jalan, belum: b.belum == null ? null : b.belum };
  }
  return out;
}

const hariAntara = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/**
 * Membandingkan dua snapshot. Mengembalikan daftar pergerakan.
 *
 * arah: 'mundur' kalau tanggalnya jadi lebih lambat (barang datang lebih
 * lama — ini yang bikin kurang), 'maju' kalau lebih cepat, 'baru' kalau
 * sebelumnya tidak punya jadwal, 'hilang' kalau jadwalnya lenyap.
 *
 * 'hilang' DILAPORKAN, bukan diabaikan: jadwal yang menghilang dari berkas
 * berarti barangnya tidak lagi punya tanggal, dan itu kemunduran yang paling
 * mudah tidak disadari karena tidak ada angka yang berubah di layar.
 */
export function pergerakanEta(lama, baru) {
  const L = lama || {}, B = baru || {};
  const out = [];
  for (const k of new Set([...Object.keys(L), ...Object.keys(B)])) {
    const a = L[k], b = B[k];
    if (!b) { if (a && a.tgl) out.push({ kunci: k, arah: 'hilang', dari: a.tgl, ke: null, geser: null }); continue; }
    if (!a) continue;                           // barang baru, bukan pergerakan
    if (a.tgl && !b.tgl) { out.push({ kunci: k, arah: 'hilang', dari: a.tgl, ke: null, geser: null }); continue; }
    if (!a.tgl && b.tgl) { out.push({ kunci: k, arah: 'baru', dari: null, ke: b.tgl, geser: null }); continue; }
    if (!a.tgl && !b.tgl) continue;
    if (a.tgl === b.tgl) {
      // Tanggalnya sama tapi jumlahnya berubah -- tetap pergerakan, dan tetap
      // perlu dilihat: separuh kiriman yang dibatalkan tidak menggeser tanggal
      // satu hari pun.
      if (a.jalan !== b.jalan) out.push({ kunci: k, arah: 'qty', dari: a.tgl, ke: b.tgl, geser: 0, qtyDari: a.jalan, qtyKe: b.jalan });
      continue;
    }
    const geser = hariAntara(a.tgl, b.tgl);
    out.push({ kunci: k, arah: geser > 0 ? 'mundur' : 'maju', dari: a.tgl, ke: b.tgl, geser, qtyDari: a.jalan, qtyKe: b.jalan });
  }
  // Yang mundur paling jauh duluan: itu yang paling mungkin membatalkan
  // keputusan beli yang sudah diambil berdasarkan tanggal yang lama.
  const berat = { mundur: 0, hilang: 1, qty: 2, baru: 3, maju: 4 };
  return out.sort((x, y) => (berat[x.arah] - berat[y.arah]) || Math.abs(y.geser || 0) - Math.abs(x.geser || 0));
}
