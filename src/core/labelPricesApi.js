// Ingatan harga label — satu harga terakhir per (kode ERP, pemasok).
//
// KENAPA BUKAN SATU KOLOM DI `items`
// Harga label ditentukan tukang cetaknya, bukan barangnya. MTI sudah memakai
// lebih dari satu: CV BINTANG CAHAYA LABEL dan PT WINS TUNGGAL PERDANA, dua-
// duanya punya PO label yang hidup. Kalau harga ditempel ke item, setiap ganti
// pemasok akan memicu peringatan "harga berubah" padahal tidak ada yang
// berubah. Peringatan yang selalu berbunyi sama saja dengan tidak ada
// peringatan — orang berhenti membacanya, lalu kenaikan yang SUNGGUHAN lewat
// begitu saja. Itu justru kebalikan dari yang diminta.
//
// KENAPA HARGANYA DIINGAT, BUKAN DIKUNCI
// Yang tersimpan di sini bukan daftar harga resmi. Ini catatan "terakhir kali
// kita bayar segini". Dia mengisi kolom di layar dan berani menyela kalau
// angkanya berbeda, tapi tidak pernah menolak angka baru: harga label memang
// naik, dan yang mengetik yang tahu hasil negonya, bukan portal.
import { getClient, isConfigured, fetchAllPaged, assertWrote } from './supabase.js';
import { parseNumber } from '../parsers/numbers.js';

function fromRow(r) {
  return {
    id: r.id,
    erp: r.erp,
    supplier: r.supplier,
    harga: Number(r.harga),
    poNo: r.po_no || '',
    oleh: r.oleh || '',
    tanggal: r.updated_at || r.created_at || null,
  };
}

// Kunci pencarian. Dinormalkan (trim + huruf besar) karena nama pemasok datang
// dari dropdown tapi kode ERP datang dari sel Excel yang diketik manusia —
// spasi di ujung dan beda huruf besar-kecil sudah pernah jadi masalah di
// brandMap dan descDict.
export function kunciHarga(erp, supplier) {
  return `${String(erp || '').trim().toUpperCase()}::${String(supplier || '').trim().toUpperCase()}`;
}

// Peta siap-pakai dari array state. Dibangun ulang tiap dipanggil — daftarnya
// puluhan baris, bukan puluhan ribu, dan cache yang basi lebih mahal daripada
// satu lintasan.
export function petaHarga(daftar) {
  const m = new Map();
  (daftar || []).forEach(p => m.set(kunciHarga(p.erp, p.supplier), p));
  return m;
}

// ---------------------------------------------------------------------------
// ringkasHarga — SATU hitungan yang dipakai layar, tombol, dan penulis PO.
//
// Sengaja satu fungsi dan bukan tiga: sampai v15.2 subtotal di modal dan nilai
// per baris di PO dihitung oleh dua ekspresi terpisah yang kebetulan sama. Dua
// salinan aturan uang adalah dua salinan yang suatu hari beda pendapat, dan
// yang kalah adalah angka yang sudah tercetak di PDF dan terlanjur dikirim.
//
// Murni: tidak menyentuh getState(), DOM, atau jaringan — supaya bisa diuji
// dengan angka asli dari dokumen, bukan dengan menghitung tombol.
//
//   items     baris hasil baca Excel
//   sel       { indeks: boolean } centang — bentuknya sama dengan ui.labelSel
//   ketikan   { indeks: number }  harga yang diketik — bentuknya ui.lrHarga
//   daftar    st.labelPrices
//   supplier  nama pemasok yang sedang dipilih
//
// Aturan harga: KETIKAN menang atas INGATAN, ingatan menang atas kosong.
// null berarti benar-benar belum ada harga — dan null itulah yang menahan
// Generate PO. Tidak ada angka cadangan di mana pun sepanjang jalur ini.
// ---------------------------------------------------------------------------
export function ringkasHarga({ items = [], sel = {}, ketikan = {}, daftar = [], supplier = '' } = {}) {
  const peta = petaHarga(daftar);
  let total = 0; let kosong = 0; let beda = 0;

  const baris = items.map((r, i) => {
    const ket = ketikan[i];
    const pIngat = peta.get(kunciHarga(r.erp, supplier));
    const ingat = pIngat && Number.isFinite(pIngat.harga) && pIngat.harga > 0 ? pIngat : null;
    // TIGA keadaan, bukan dua:
    //   undefined  belum diapa-apakan       -> pakai ingatan
    //   null       DIKOSONGKAN dengan sadar -> tidak ada harga, ingatan diabaikan
    //   angka > 0  diketik                  -> pakai ketikan
    //
    // Tanpa keadaan ketiga, mengosongkan kotak harga tidak bisa mengosongkan
    // harga: ingatan langsung mengisi lagi, dan layarnya jadi kotak kosong di
    // sebelah kolom JUMLAH yang terisi — dua sel di baris yang sama yang
    // saling membantah, dan yang menang diam-diam adalah yang masuk ke PO.
    const dikosongkan = ket === null;
    const harga = dikosongkan ? null
      : (Number.isFinite(ket) && ket > 0) ? ket
        : (ingat ? ingat.harga : null);
    const jumlah = harga == null ? null : harga * (Number(r.qty) || 0);
    const dipilih = !!sel[i];
    // "Berubah" hanya berarti sesuatu kalau ADA yang dibandingkan. Baris yang
    // belum pernah punya ingatan bukan perubahan harga — dia baru pertama kali.
    const berubah = harga != null && ingat != null && harga !== ingat.harga;

    if (dipilih) {
      if (harga == null) kosong++; else total += jumlah;
      if (berubah) beda++;
    }
    return { i, r, harga, jumlah, ingat, berubah, dipilih };
  });

  return {
    baris,
    dipilih: baris.filter(b => b.dipilih),
    // Subtotal hanya sah kalau SEMUA baris terpilih punya harga. Menjumlahkan
    // yang ada dan diam soal yang kosong menghasilkan angka yang kelihatan
    // benar dan kurang — bentuk kesalahan paling mahal, karena tidak ada yang
    // curiga padanya.
    total: kosong ? null : total,
    kosong,
    beda,
  };
}

export async function fetchLabelPrices() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST diam-diam memotong select tanpa batas di 1000 baris.
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('label_prices').select('*').order('erp', { ascending: true }).range(a, b));
  if (error) { console.error('fetchLabelPrices failed:', error); return null; }
  return data.map(fromRow);
}

// Membaca satu ketikan harga jadi nilai yang dimengerti ringkasHarga().
//
//   null      kosong, atau tidak terbaca sebagai angka -> DIKOSONGKAN
//   number    bilangan bulat > 0
//
// Diekspor supaya bisa diuji. Selama ini logikanya hidup di dalam onBlur
// hargaInput() dan tidak bisa dipanggil dari mana pun — jadi bagian yang
// MENGHASILKAN null (yang seluruh aturan tiga-keadaan bergantung padanya)
// nol pengujian, sementara tesnya cuma menguji parseNumber yang tidak diubah.
export function bacaKetikanHarga(mentah) {
  const s = String(mentah == null ? '' : mentah).trim();
  if (!s) return null;
  // parseNumber(v, 'id') — BUKAN Number(String(v).replace(/[,\s]/g,'')). Yang
  // kedua membaca "1.500" sebagai 1,5: harga jadi seperseribu, dan PO-nya tetap
  // terbit karena 1,5 tetap lebih besar dari nol.
  const n = parseNumber(s, 'id');
  // Tidak terbaca, nol, atau negatif dihitung sengaja dikosongkan — bukan
  // dilupakan. Kalau "abc" cuma dilupakan, ingatan mengisi ulang dan kotaknya
  // memantul balik ke harga lama tanpa ada yang berubah di layar.
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

// Pasangan yang HILANG karena penggabungan duplikat — bukan karena datanya
// rusak, tapi karena satu PO memuat kunci (ERP, pemasok) yang sama dua kali
// DENGAN HARGA BERBEDA.
//
// Ini bukan kasus karangan: core/labelBuyList.js punya tandaiKodeGanda() dan
// layar ini menampilkan lencana merah "N kode ganda", karena dua spesifikasi
// yang berbeda memang sah berbagi satu kode ERP di daftar beli. Yang terjadi
// tanpa fungsi ini: dua baris berharga 2.750 dan 3.000 masuk, satu baris
// tersimpan seharga 3.000, yang 2.750 lenyap tanpa suara, dan bulan depan
// KEDUANYA terisi 3.000.
//
// Duplikat dengan harga yang SAMA tidak dilaporkan — tidak ada yang hilang.
export function hargaBentrok(entries) {
  const lihat = new Map();
  const bentrok = [];
  (entries || []).forEach(e => {
    if (!e || !e.erp || !e.supplier || !Number.isFinite(Number(e.harga))) return;
    const k = kunciHarga(e.erp, e.supplier);
    const sebelum = lihat.get(k);
    if (sebelum !== undefined && sebelum !== Number(e.harga)) {
      bentrok.push({ erp: e.erp, supplier: e.supplier, dibuang: sebelum, dipakai: Number(e.harga) });
    }
    lihat.set(k, Number(e.harga));
  });
  return bentrok;
}

// Menyiapkan baris yang akan dikirim. Dipisah dari rememberLabelPrices() supaya
// bisa diuji tanpa jaringan — dan supaya jalur "Supabase belum dikonfigurasi"
// mengembalikan bentuk yang SAMA dengan jalur yang menulis beneran. Dulu yang
// satu mengembalikan entri mentah dan yang lain baris hasil server; pemanggil
// yang menyalin hasilnya ke state lokal akan menyimpan dua bentuk berbeda
// tergantung konfigurasi, dan yang salah baru ketahuan di komputer orang lain.
export function siapkanBarisHarga(entries, sekarang) {
  const bersih = (entries || []).filter(e =>
    e && e.erp && e.supplier && Number.isFinite(Number(e.harga)) && Number(e.harga) > 0);

  // Satu baris per (erp, supplier) — kalau satu PO memuat kode ERP yang sama
  // dua kali, yang belakangan menang. Tanpa ini upsert menolak SELURUH batch
  // dengan "ON CONFLICT DO UPDATE command cannot affect row a second time",
  // dan harga yang benar-benar dipakai gagal tersimpan gara-gara duplikat yang
  // sebenarnya tidak berbahaya.
  const unik = new Map();
  bersih.forEach(e => unik.set(kunciHarga(e.erp, e.supplier), {
    // DINORMALKAN sebelum ditulis, bukan cuma di-trim. kunciHarga() mencari
    // dengan huruf besar, jadi kalau yang tersimpan huruf kecil maka satu
    // pasangan logis bisa punya DUA baris di database — `unique (erp, supplier)`
    // membandingkan teks apa adanya dan tidak menganggapnya bentrok. petaHarga()
    // lalu menggabungkan keduanya dengan kunci yang sama dan yang menang adalah
    // yang terakhir datang, urutannya bergantung collation database. Peringatan
    // "harga berubah" jadi membandingkan lawan baris yang dipilih secara acak.
    erp: String(e.erp).trim().toUpperCase(),
    // Pemasok IKUT dinormalkan, bukan cuma di-trim. kunciHarga() menaikkan
    // KEDUA sisi ke huruf besar, jadi menyimpan sisi ini apa adanya
    // meninggalkan separuh lubang yang sama tetap terbuka: seseorang dengan
    // editMaster mengetik ulang nama pemasok jadi "Pt Wins Tunggal Perdana",
    // `unique (erp, supplier)` tidak melihat bentrok karena membandingkan teks
    // mentah, dan baris kedua lahir untuk pasangan yang sudah ada. petaHarga()
    // lalu memilih salah satunya menurut urutan fetch. Nilai ini tidak pernah
    // ditampilkan ke siapa pun — dia cuma kunci — jadi aman dinaikkan.
    supplier: String(e.supplier).trim().toUpperCase(),
    harga: Number(e.harga),
    po_no: e.poNo || null,
    oleh: e.oleh || null,
    updated_at: sekarang || new Date().toISOString(),
  }));
  return [...unik.values()];
}

// Baris yang TIDAK bisa diingat, dan alasannya. Dipakai genPO() untuk bilang
// terus terang alih-alih diam.
//
// Yang paling nyata: baris BUY NOW dari Label Stock lahir dengan `erp: ''`
// (isNew), dan itu bentuk yang sah di jalur tersebut. Tanpa fungsi ini
// siapkanBarisHarga() membuangnya tanpa suara — PO-nya benar, tapi bulan depan
// kolom HARGA kosong lagi dan tidak ada yang tahu kenapa.
export function tidakBisaDiingat(entries) {
  return (entries || []).filter(e =>
    !e || !e.erp || !String(e.erp).trim() || !e.supplier || !String(e.supplier).trim());
}

// Simpan harga yang baru saja dipakai di sebuah PO.
//
// MELEMPAR kalau server menolak — pemanggilnya yang memutuskan itu fatal atau
// tidak. Di genPO() TIDAK fatal: PO-nya sudah masuk dan nomornya sudah
// terpakai, jadi kegagalan mengingat harga hanya boleh jadi peringatan.
// Membiarkannya menjatuhkan alur akan menampilkan "gagal" untuk PO yang
// sebenarnya berhasil — persis kebalikan dari yang benar.
export async function rememberLabelPrices(entries) {
  const rows = siapkanBarisHarga(entries);
  if (!rows.length) return [];
  if (!isConfigured()) return rows.map(fromRow);
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');

  // assertWrote: PostgREST membalas 204 tanpa error kalau RLS menyaring habis
  // semua baris — penolakan terbaca sebagai keberhasilan. Lihat supabase.js.
  const data = assertWrote(
    await c.from('label_prices').upsert(rows, { onConflict: 'erp,supplier' }).select(),
    'simpan ingatan harga label',
  );
  return data.map(fromRow);
}
