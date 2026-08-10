// Daftar beli: apa yang MINTA dibeli, diadu dengan apa yang portal TAHU soal stok.
//
// KENAPA MODUL INI ADA
// -----------------------------------------------------------------------------
// Workbook yang sona unggah setiap bulan berisi tiga hal sekaligus, dan selama
// ini portal cuma membaca dua: stok dan rencana. Yang ketiga — sheet `local`,
// `export`, `newitems`, `加急优先下单` — adalah DAFTAR YANG MAU DIBELI, dan itu
// dilewati begitu saja. Sona lalu menyusun ulang daftar yang sama dengan tangan
// di layar lain.
//
// Modul ini membaca yang ketiga itu, lalu mengadunya dengan stok.
//
// APA YANG DITEMUKAN WAKTU DIADU KE DATA ASLI (Agustus 2026)
// -----------------------------------------------------------------------------
// Dari 127 baris di sheet `local`, cuma 13 yang punya padanan di tracker. Dari
// 13 itu, SEMBILAN statusnya OVERSTOCK atau IDLE STOCK. Excel menyuruh beli,
// stoknya sudah menumpuk. Tiga yang terparah:
//
//     [AS898]雅度无内              minta  1.000   stok  5.185   kebutuhan     40
//     [Strong Guard H-RA]HERCULES  minta  1.000   stok 14.678   kebutuhan  1.358
//     [AT196]雅度无内              minta 10.200   stok 10.950   kebutuhan  2.439
//
// Yang pertama itu stok untuk 130 kali kebutuhannya. Kalau baris ini lolos jadi
// PO, uangnya keluar dan gudangnya makin penuh — dan tidak ada satu pun angka di
// layar lama yang terlihat aneh.
//
// YANG LEBIH PENTING: 114 BARIS TIDAK BISA DICEK SAMA SEKALI
// -----------------------------------------------------------------------------
// 114 dari 127 spec itu tidak ada di tracker. Diperiksa dengan pencocokan
// perkiraan: yang "mirip" ternyata spec LAIN — pola beda, ukuran beda. Bukan
// salah eja, memang barang baru.
//
// Ini yang membuat modul ini tidak boleh cuma melaporkan pelanggaran. Kalau
// layar hanya menulis "9 overstock", orang membacanya sebagai "sisanya aman" —
// padahal untuk 114 baris portal tidak tahu apa-apa. DIAM BUKAN BERARTI AMAN.
// Karena itu `takBisaDicek` ikut dihitung dan ikut ditampilkan sebesar yang lain.
//
// PENCOCOKAN LEWAT ERP CODE DULU, NAMA SPEC CUMA CADANGAN
// -----------------------------------------------------------------------------
// Nama spec ditulis manusia dan berbeda antar berkas. Kode ERP tidak. Semua
// sheet order punya kolom ERP CODE, dan portal sudah memegang kode untuk 966
// dari 974 baris tracker. Mencocokkan lewat nama sebagai cara utama berarti
// memilih jalan yang paling mudah meleset.
import { suggestedQtyOf } from '../parsers/labelStock.js';
import { normalisasiMarket } from '../parsers/labelSheetSet.js';

// Kunci nama spec: spasi dibuang seluruhnya, huruf disamakan. Sama persis
// dengan skuKey di parsers/labelStock.js dan planKey di parsers/planFiles.js —
// nama yang cuma beda spasi memang barang yang sama.
const kunciSpec = s => String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();
const kunciErp  = s => String(s == null ? '' : s).trim().toUpperCase();

// Status stok yang berarti "JANGAN BELI LAGI".
//
// SUFFICIENT tidak masuk sini dan itu disengaja. "Cukup" berarti stoknya pas —
// membeli lagi bukan pemborosan, cuma belum mendesak. Yang dilarang adalah yang
// sudah berlebih (≥2× kebutuhan) dan yang menganggur (tidak ada rencana produksi
// sama sekali). Menandai SUFFICIENT sebagai stop akan membuat tanda ini terlalu
// sering muncul, dan tanda yang terlalu sering muncul berhenti dibaca.
const STATUS_STOP = ['OVERSTOCK', 'IDLE STOCK'];

export const TANDA = {
  STOP: 'stop',   // diminta, tapi stoknya sudah berlebih / nganggur
  CEK:  'cek',    // tidak ada di tracker — portal tidak bisa bilang apa-apa
  OK:   'ok',     // portal setuju, atau setidaknya tidak keberatan
};

// Bangun indeks tracker sekali, dipakai untuk semua baris. Dua indeks karena
// dua cara mencocokkan, dan yang lewat ERP selalu dicoba lebih dulu.
function indeksStok(labelStock) {
  const byErp = new Map(), bySpec = new Map();
  for (const r of (labelStock || [])) {
    const e = kunciErp(r.erp);
    if (e && !byErp.has(e)) byErp.set(e, r);
    const s = kunciSpec(r.spec);
    if (s && !bySpec.has(s)) bySpec.set(s, r);
  }
  return { byErp, bySpec };
}

function cariStok(idx, erp, spec) {
  const e = kunciErp(erp);
  if (e && idx.byErp.has(e)) return { row: idx.byErp.get(e), lewat: 'erp' };
  const s = kunciSpec(spec);
  if (s && idx.bySpec.has(s)) return { row: idx.bySpec.get(s), lewat: 'spec' };
  return { row: null, lewat: null };
}

// Kunci satu baris daftar beli: KODE ERP **DAN** NAMA SPEC, bukan kode saja.
//
// KENAPA BUKAN KODE ERP SAJA
// -----------------------------------------------------------------------------
// Versi pertama memakai kode ERP saja, karena satu kode memang seharusnya satu
// barang. Diuji ke file Agustus, dan asumsi itu langsung patah:
//
//     01050458095425ID  baris 25  IDST205/75R14-8PR[ST100]105/101M 西湖无内   600
//     01050458095425ID  baris 95  IDST205/75R15-10PR[ST100]111/106M 西湖无内  200
//
// Satu kode, dua spec berbeda — R14 dan R15, ukuran ban yang berbeda. Salah
// satunya pasti salah ketik. Dengan kunci kode-saja, keduanya jatuh ke baris
// yang sama, aturan "ambil yang terbesar" memilih 600, dan permintaan 200 pcs
// itu HILANG tanpa jejak. Tidak ada error, tidak ada peringatan, cuma satu baris
// yang tidak pernah sampai.
//
// Dengan kode+spec, keduanya tetap jadi dua baris, dan `tandaiKodeGanda` di
// bawah menandai dua-duanya supaya orangnya yang membetulkan.
export const kunciBaris = it => `${kunciErp(it.erp)}##${kunciSpec(it.spec)}`;

// bagian = [{ sheet, kategori, items }] — hasil parseLabelSheet per sheet order.
//
// Mengembalikan { rows, stats }. TIDAK menulis apa pun ke state dan TIDAK
// membuang baris apa pun: baris yang dilarang tetap ada di daftar, cuma
// ditandai. Menghapusnya berarti memutuskan sesuatu yang bukan hak modul ini,
// dan orang yang memang harus membeli barang overstock (kadang memang harus)
// tidak akan punya jalan.
export function susunDaftarBeli(st, bagian, opsi = {}) {
  const idx = indeksStok(st.labelStock);
  const moq = opsi.moq || (st.labelSettings || {}).moq || 500;
  // overstockMultiple tidak dipakai di sini: status sudah tersimpan di baris tracker.
  const byErpMaster = new Map((st.items || []).map(i => [kunciErp(i.erp), i]));

  const peta = new Map();

  for (const b of (bagian || [])) {
    for (const it of (b.items || [])) {
      const minta = Number(it.qty) || 0;
      if (minta <= 0) continue;

      const kunci = kunciBaris({ ...it, sheet: b.sheet });
      const { row: stok, lewat } = cariStok(idx, it.erp, it.spec);
      const mk = normalisasiMarket(it.market);
      const master = byErpMaster.get(kunciErp(it.erp)) || {};

      // Barang yang sama diminta di beberapa sheet: jumlahnya TIDAK dijumlahkan
      // diam-diam. Yang tercatat adalah setiap permintaannya, satu per satu,
      // dan angka yang dipakai adalah yang TERBESAR — dengan daftar asalnya
      // ikut tersimpan supaya orangnya bisa melihat kenapa.
      //
      // Menjumlahkan adalah yang paling terasa "benar" dan paling berbahaya:
      // di file Agustus, 124 dari 124 kode di `local` muncul lagi di `newitems`,
      // dan menjumlah seluruh sheet menghasilkan 784.880 pcs dari yang
      // seharusnya ±257.760 pcs.
      //
      // Ini aman DIPAKAI DI SINI karena kuncinya kode+spec: yang digabung pasti
      // barang yang sama, bukan dua barang yang kebetulan sekode.
      if (peta.has(kunci)) {
        const ada = peta.get(kunci);
        ada.diminta.push({ sheet: b.sheet, kategori: b.kategori, qty: minta, catatan: String(it.pickup || '').trim(), market: mk.market, marketAsal: mk.asal });

        // Nama tujuan Tionghoa dibawa dari sheet mana pun yang menulisnya.
        //
        // Di berkas Agustus, 37 dari 129 barang ditulis pakai nama tujuan di
        // salah satu sheet (biasanya `newitems`: 巴西, 美国, 亚) dan pakai kode
        // di sheet lain. Karena `local` dibaca lebih dulu, barisnya sudah punya
        // market 'BX'/'PT'/'SNI' dan asal Tionghoanya terbuang — sehingga
        // "PT ← 美国" tidak pernah muncul di layar, padahal justru di 37 baris
        // itulah orang perlu melihat portal membacanya dengan benar.
        if (!ada.marketAsal && mk.asal) ada.marketAsal = mk.asal;

        // Market yang BERBEDA antar sheet, setelah dinormalkan. Ini bukan
        // penulisan yang beda — ini pasar yang beda untuk barang yang sama, dan
        // salah satunya pasti salah. Di berkas Agustus ada satu:
        //   01050458095423ID  local=SNI  export=SNI  newitems=印尼→SNI
        //                     加急优先下单=PT
        // Portal tidak memilih. Dia menandai dan menyebut asalnya.
        if (mk.market && ada.market && mk.market !== ada.market) {
          ada.marketBeda = [...new Set([...(ada.marketBeda || [ada.market]), mk.market])];
        }

        if (minta > ada.minta) { ada.minta = minta; ada.sheet = b.sheet; ada.kategori = b.kategori; }
        continue;
      }

      let tanda, status = '', kebutuhan = null, stokKini = null, saran = null;
      if (!stok) {
        tanda = TANDA.CEK;
      } else {
        // Angka yang dipakai adalah angka yang TERSIMPAN di baris tracker —
        // itu angka dari Excel sona, dan seluruh portal memakai angka Excel apa
        // adanya (keputusan pemilik). Hitungan sendiri cuma dipakai kalau
        // barisnya memang tidak punya angkanya.
        stokKini = Number(stok.stock) || 0;
        kebutuhan = Number(stok.requirement);
        if (!Number.isFinite(kebutuhan)) kebutuhan = 0;
        status = stok.status || '';
        saran = Number(stok.suggestedQty);
        if (!Number.isFinite(saran)) saran = suggestedQtyOf(Number(stok.surplus) || 0, moq);
        tanda = STATUS_STOP.includes(status) ? TANDA.STOP : TANDA.OK;
      }

      peta.set(kunci, {
        kunci,
        spec: String(it.spec || '').trim(),
        erp: String(it.erp || '').trim(),
        market: mk.market,
        marketAsal: mk.asal,          // '巴西' kalau memang diterjemahkan
        marketDikenal: mk.dikenal,
        brand: String(it.brand || master.brand || '').trim(),
        kategori: b.kategori,
        sheet: b.sheet,
        minta,
        catatan: String(it.pickup || '').trim(),
        marketBeda: null,
        diminta: [{ sheet: b.sheet, kategori: b.kategori, qty: minta, catatan: String(it.pickup || '').trim(), market: mk.market, marketAsal: mk.asal }],
        stok: stokKini,
        kebutuhan,
        surplus: stok ? Number(stok.surplus) : null,
        status,
        saran,
        cocokLewat: lewat,            // 'erp' | 'spec' | null — ditampilkan, bukan disembunyikan
        tanda,
        // Angka awal kolom PESAN. Baris STOP mulai dari NOL: yang harus
        // melakukan sesuatu adalah orang yang mau membelinya, bukan orang yang
        // mau melewatinya. Selebihnya memakai angka yang diminta di file.
        pesan: tanda === TANDA.STOP ? 0 : minta,
        asal: 'file',
      });
    }
  }

  const rows = [...peta.values()];
  const kodeGanda = tandaiKodeGanda(rows);
  return { rows, kodeGanda, stats: hitungStats(rows) };
}

// SATU KODE ERP, DUA SPEC BERBEDA
// -----------------------------------------------------------------------------
// Ini bukan duplikat dan bukan bentrokan antar sheet — ini SALAH KETIK, dan
// salah ketik yang paling mahal jenisnya: kode ERP-lah yang menentukan barang
// apa yang dicetak ERP, sementara nama spec cuma keterangan. Jadi salah satu
// dari dua baris ini akan memesan barang yang salah, dan berkas 采购申请-nya
// akan lolos impor tanpa keluhan karena kodenya sendiri sah.
//
// Portal TIDAK memilih mana yang benar — dia tidak punya cara untuk tahu.
// Yang dilakukan cuma menandai keduanya dan menyebut lawannya, supaya yang
// membetulkan adalah orang yang memang tahu barangnya.
function tandaiKodeGanda(rows) {
  const perKode = new Map();
  for (const r of rows) {
    const e = kunciErp(r.erp);
    if (!e) continue;
    if (!perKode.has(e)) perKode.set(e, []);
    perKode.get(e).push(r);
  }
  const out = [];
  for (const [kode, grup] of perKode) {
    if (grup.length < 2) continue;
    for (const r of grup) {
      r.kodeGanda = grup.filter(x => x !== r).map(x => ({ spec: x.spec, minta: x.minta }));
    }
    out.push({ erp: kode, baris: grup.map(r => ({ spec: r.spec, minta: r.minta, sheet: r.sheet })) });
  }
  return out;
}

export function hitungStats(rows) {
  const n = t => rows.filter(r => r.tanda === t).length;
  return {
    total: rows.length,
    stop: n(TANDA.STOP),
    cek: n(TANDA.CEK),
    ok: n(TANDA.OK),
    mintaTotal: rows.reduce((s, r) => s + (Number(r.minta) || 0), 0),
    marketAsing: rows.filter(r => !r.marketDikenal).length,
    lewatSpec: rows.filter(r => r.cocokLewat === 'spec').length,
    kodeGanda: rows.filter(r => r.kodeGanda && r.kodeGanda.length).length,
    marketBeda: rows.filter(r => r.marketBeda && r.marketBeda.length > 1).length,
  };
}

// Gabungkan daftar beli dari file dengan baris BUY NOW hasil hitungan portal.
//
// Keduanya jawaban atas pertanyaan yang berbeda — "apa yang sona minta" dan
// "apa yang menurut angka kurang" — dan orang yang memesan butuh dua-duanya di
// satu layar. Yang muncul di dua-duanya jadi SATU baris, bukan dua: dua baris
// untuk barang yang sama adalah cara paling rapi untuk memesannya dua kali.
export function gabungDenganPortal(st, daftar) {
  const rows = (daftar && daftar.rows) ? daftar.rows.slice() : [];
  const sudah = new Set(rows.map(r => kunciErp(r.erp) || kunciSpec(r.spec)));
  const byErpMaster = new Map((st.items || []).map(i => [kunciErp(i.erp), i]));

  for (const r of (st.labelStock || [])) {
    if (r.status !== 'BUY NOW') continue;
    const k = kunciErp(r.erp) || kunciSpec(r.spec);
    if (sudah.has(k)) continue;      // sudah ada dari file — jangan digandakan
    const master = byErpMaster.get(kunciErp(r.erp)) || {};
    const saran = Number(r.suggestedQty) || 0;
    rows.push({
      // Bentuk kunci yang SAMA dengan baris dari file (kode##spec). Dua format
      // kunci di satu daftar adalah dua format yang suatu hari bertabrakan —
      // dan tabrakannya muncul sebagai centangan yang menyeret baris lain.
      kunci: kunciBaris(r),
      spec: r.spec, erp: r.erp || '',
      market: normalisasiMarket(r.market).market || r.market || '',
      marketAsal: null, marketDikenal: true,
      brand: String(master.brand || '').trim(),
      kategori: null,                // portal tidak tahu ini local atau export
      sheet: null,
      minta: null,                   // tidak diminta di file — portal yang mengusulkan
      catatan: '',
      diminta: [],
      stok: Number(r.stock) || 0,
      kebutuhan: Number(r.requirement) || 0,
      surplus: Number(r.surplus) || 0,
      status: r.status,
      saran,
      cocokLewat: 'portal',
      tanda: TANDA.OK,
      pesan: saran,
      asal: 'portal',
    });
  }
  return rows;
}

// Baris yang boleh ikut "Pilih semua".
//
// Baris STOP TIDAK PERNAH ikut. Itu inti seluruh fitur ini: yang mau membeli
// barang yang stoknya sudah berlebih harus mencentangnya sendiri, satu per satu,
// dan portal mencatat siapa yang melakukannya. Sekali "Pilih semua" ikut
// mencentangnya, seluruh peringatannya jadi hiasan.
// BARIS PORTAL JUGA TIDAK IKUT — alasan yang sama, dari arah berlawanan.
//
// Baris STOP dilewati karena SUDAH diminta padahal stoknya berlebih. Baris
// portal dilewati karena BELUM diminta siapa pun: dia usulan aritmatika stok,
// bukan permintaan seseorang.
//
// Ketahuan waktu Kyaru membuka BUY NOW dan bertanya mana yang sudah disetujui
// sona. Jawabannya NOL dari dua puluh dua — berkas order bulan itu belum
// diunggah sama sekali — sementara layarnya menawarkan "Pilih semua yang aman"
// yang akan mencentang kedua puluh duanya sekaligus.
//
// Tetap BISA dicentang satu per satu. Portal menemukan kekurangan yang nyata
// (v13.5: 140 spec, 345.400 pcs yang labelnya tidak pernah dihitung), dan
// menyembunyikan temuan itu jauh lebih mahal daripada meminta satu klik. Yang
// dicabut cuma kemudahan memesannya massal tanpa melihatnya satu-satu.
export const bolehPilihSemua = r => r.tanda !== TANDA.STOP && r.asal !== 'portal';
