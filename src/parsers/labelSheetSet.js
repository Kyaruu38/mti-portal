// Satu workbook, banyak sheet order.
//
// KENAPA MODUL INI ADA
// -----------------------------------------------------------------------------
// Sampai sekarang layar Permintaan Label membaca SATU sheet. Sona menaruh
// workbook, portal menebak sheet mana yang paling mirip sheet order, dia klik
// lanjut, selesai. Itu bekerja selama filenya memang satu sheet order.
//
// File Agustus 2026 punya 14 sheet, dan EMPAT di antaranya sheet order:
// local, export, newitems, 加急优先下单. Sepuluh sisanya rencana produksi,
// berat ban, proses vulkanisir, daftar kontainer — bukan urusan label sama
// sekali. Dengan alur lama, portal memilih `local`, dan tiga sheet order lain
// hilang tanpa satu pun tanda di layar. Bukan error, bukan peringatan: hilang.
//
// TIGA KEPUTUSAN YANG SENGAJA DIAMBIL BEGINI
// -----------------------------------------------------------------------------
// 1. SHEET ORDER DIKENALI DARI HEADERNYA, BUKAN NAMANYA.
//    Nama sheet berubah tiap bulan dan tiap orang: local / LOKAL / dalam negeri.
//    Yang tidak berubah adalah kolomnya — ERP CODE dan QTY selalu ada, karena
//    tanpa dua itu barisnya tidak bisa dipesan. Jadi itu yang dicari.
//
// 2. KATEGORI DITEBAK DARI NAMA, TAPI SELALU BISA DIUBAH DI LAYAR.
//    Tebakan nama itu rapuh — makanya dia cuma nilai awal sebuah tombol, bukan
//    kesimpulan. Nama yang tidak dikenali tidak ditebak: kategorinya kosong dan
//    orangnya yang memilih.
//
// 3. MARKET TIONGHOA DISAMAKAN, TAPI HANYA YANG SUDAH DIBUKTIKAN.
//    Sheet `newitems` menulis kolom market sebagai TUJUAN (巴西, 美国, 亚),
//    bukan kode market (BX, PT, SNI). Pemetaannya diuji ke 124 baris yang sama
//    persis ERP code-nya di sheet `local`, dan cocok 100% tanpa satu pengecualian:
//
//        巴西 6/6 → BX      美国 13/13 → PT      亚  9/9 → SNI
//        南美 4/4 → BX      北美  2/2 → PT      印尼 2/2 → SNI
//
//    Nama tujuan DI LUAR daftar itu TIDAK ditebak. Menebak "欧洲" jadi salah
//    satu dari tiga kode adalah cara paling rapi untuk mengirim label ke pasar
//    yang salah tanpa ada yang tahu. Yang tidak dikenal ditandai dan ditanyakan.

// -----------------------------------------------------------------------------
// MARKET
// -----------------------------------------------------------------------------
// Kode market yang sah. Ini yang dipakai di seluruh portal dan di ERP.
export const MARKET_CODES = ['PT', 'SNI', 'BX'];

// Tujuan (Tionghoa) -> kode market. HANYA yang sudah diverifikasi lawan data.
// Dicocokkan PERSIS setelah spasi dibuang — bukan sebagai potongan kata.
// '亚' sebagai potongan akan ikut kena '东南亚' yang muncul di nama spec, dan
// nama spec bukan market.
const TUJUAN_KE_MARKET = {
  '巴西': 'BX',   // Brasil
  '南美': 'BX',   // Amerika Selatan
  '美国': 'PT',   // Amerika Serikat
  '北美': 'PT',   // Amerika Utara
  '亚':   'SNI',  // Asia
  '印尼': 'SNI',  // Indonesia
};

// Mengembalikan { market, asal, dikenal }.
//   market   kode yang dipakai selanjutnya ('' kalau tidak dikenal)
//   asal     tulisan aslinya kalau memang diterjemahkan, kalau tidak null.
//            Ini yang ditampilkan di layar sebagai "PT ← 美国": orangnya harus
//            bisa melihat portal mengerti, bukan cuma mempercayainya.
//   dikenal  false kalau isinya ada tapi bukan kode maupun tujuan yang terdaftar
export function normalisasiMarket(raw) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, '').trim();
  if (!s) return { market: '', asal: null, dikenal: true };

  const naik = s.toUpperCase();
  if (MARKET_CODES.includes(naik)) return { market: naik, asal: null, dikenal: true };

  const kode = TUJUAN_KE_MARKET[s];
  if (kode) return { market: kode, asal: s, dikenal: true };

  // Ada isinya, tapi tidak dikenal. Dibiarkan apa adanya dan DITANDAI.
  return { market: s, asal: null, dikenal: false };
}

// -----------------------------------------------------------------------------
// KATEGORI
// -----------------------------------------------------------------------------
export const KATEGORI = [
  { id: 'local',  label: { id: 'Local',    en: 'Local',    zh: '内销' } },
  { id: 'export', label: { id: 'Export',   en: 'Export',   zh: '出口' } },
  { id: 'new',    label: { id: 'New Item', en: 'New Item', zh: '新品' } },
  { id: 'urgent', label: { id: 'Urgent',   en: 'Urgent',   zh: '加急' } },
];
export const KATEGORI_IDS = KATEGORI.map(k => k.id);
export const labelKategori = id => (KATEGORI.find(k => k.id === id) || {}).label || null;

// Tebakan awal dari nama sheet. Dicoba dari yang paling khusus ke paling umum,
// karena "newitems local" harus jadi New Item, bukan Local.
//
// Mengembalikan null kalau tidak yakin — dan null artinya orangnya yang memilih.
// Tebakan yang salah lebih mahal daripada tidak menebak: kategori ikut ke PO,
// dan PO yang salah kategori baru ketahuan waktu barangnya sudah dicetak.
const POLA_KATEGORI = [
  ['urgent', /加急|优先|urgent|mendesak|prioritas/i],
  ['new',    /new\s*item|newitem|新品|新增|barang\s*baru/i],
  ['export', /export|ekspor|出口|外销/i],
  ['local',  /^\s*local\s*$|lokal|dalam\s*negeri|内销|国内/i],
];
export function tebakKategori(sheetName) {
  const s = String(sheetName || '');
  for (const [id, re] of POLA_KATEGORI) if (re.test(s)) return id;
  return null;
}

// -----------------------------------------------------------------------------
// MANA SHEET ORDER, MANA BUKAN
// -----------------------------------------------------------------------------
// Header dicari dengan alias yang sama persis dengan parsers/excelLabels.js —
// diimpor, tidak disalin. Dua daftar alias yang harus dijaga sinkron adalah
// dua daftar yang suatu hari tidak sinkron.
import { findHeaderRow } from './excelLabels.js';

// Syaratnya SEMPIT dan sengaja begitu:
//   * kolom ERP CODE ada        — tanpa ini barisnya tidak bisa dipesan
//   * kolom QTY ada             — tanpa ini tidak ada yang mau dipesan
//   * total kolom terpetakan ≥4 — satu-dua kecocokan bisa kebetulan
//
// Diuji ke 14 sheet file Agustus: 4 sheet order lolos, 10 sheet produksi
// (排产计划, 销售需求表, 轮胎重量, 硫化工艺, …) semuanya ditolak. Sheet 排产计划
// punya kolom 市场 yang memang cocok dengan alias 'market' — dan tetap ditolak,
// karena dia tidak punya ERP CODE. Itulah gunanya syarat ini bukan cuma jumlah.
const MIN_KOLOM = 4;

export function periksaSheetOrder(rows) {
  const h = findHeaderRow(rows || []);
  if (h.idx < 0) return { order: false, alasan: 'tidak ada baris header' };

  const punyaErp = h.map.erp != null;
  const punyaQty = h.map.qty != null;
  if (!punyaErp || !punyaQty || h.hits < MIN_KOLOM) {
    return {
      order: false,
      headerRow: h.idx + 1,
      kolom: h.hits,
      alasan: !punyaErp ? 'tidak ada kolom ERP CODE'
            : !punyaQty ? 'tidak ada kolom QTY'
            : `cuma ${h.hits} kolom dikenali`,
    };
  }
  return { order: true, headerRow: h.idx + 1, kolom: h.hits, map: h.map };
}

// Ringkasan satu workbook. Dipakai langsung oleh layar step 2.
//
// bacaRows(nama) harus mengembalikan array-of-arrays sheet itu. Sengaja dititip
// sebagai fungsi, bukan workbook: modul ini tidak perlu tahu SheetJS ada.
export function petakanWorkbook(sheetNames, bacaRows) {
  const order = [], bukan = [];
  for (const nama of (sheetNames || [])) {
    let hasil;
    try {
      hasil = periksaSheetOrder(bacaRows(nama));
    } catch (e) {
      // Sheet yang gagal dibaca BUKAN alasan seluruh layar mati. Dia masuk
      // daftar "bukan order" dengan alasannya, dan sisanya jalan terus.
      console.warn('sheet gagal dibaca:', nama, e);
      hasil = { order: false, alasan: 'gagal dibaca' };
    }
    if (hasil.order) {
      order.push({ nama, headerRow: hasil.headerRow, kolom: hasil.kolom, kategori: tebakKategori(nama) });
    } else {
      bukan.push({ nama, alasan: hasil.alasan });
    }
  }
  return { order, bukan };
}

// -----------------------------------------------------------------------------
// BENTROKAN LINTAS SHEET
// -----------------------------------------------------------------------------
// Satu ERP code = satu barang. Kalau kode yang sama muncul di dua sheet order,
// salah satunya bukan order baru — dan menjumlahkannya begitu saja adalah cara
// tercepat memesan tiga kali lipat label yang dibutuhkan. Di file Agustus:
// 124 dari 124 kode di `local` muncul lagi di `newitems`, dan menjumlah semua
// sheet menghasilkan 784.880 pcs dari yang seharusnya ±257.760 pcs.
//
// Modul ini TIDAK memutuskan apa pun. Dia cuma menyusun pertanyaannya.
//
// bagian = [{ sheet, kategori, items: [...] }]
export function cariBentrokan(bagian) {
  const peta = new Map();
  for (const b of (bagian || [])) {
    for (const it of (b.items || [])) {
      const kode = String(it.erp || '').trim();
      if (!kode) continue;   // baris tanpa ERP code tidak bisa dibandingkan
      if (!peta.has(kode)) peta.set(kode, []);
      peta.get(kode).push({ sheet: b.sheet, kategori: b.kategori, item: it });
    }
  }

  const out = [];
  for (const [kode, hits] of peta) {
    // Dua baris di SHEET YANG SAMA bukan bentrokan lintas sheet — itu duplikat
    // di dalam satu sheet, urusan lain, dan sudah ditangani parser per sheet.
    const sheetUnik = new Set(hits.map(x => x.sheet));
    if (sheetUnik.size < 2) continue;
    out.push({
      erp: kode,
      spec: (hits[0].item.spec || hits[0].item.nameZh || '').trim(),
      hits: hits.map(x => ({
        sheet: x.sheet,
        kategori: x.kategori,
        qty: Number(x.item.qty) || 0,
        catatan: String(x.item.pickup || '').trim(),
        item: x.item,
      })),
    });
  }
  // Yang angkanya BERBEDA ditaruh paling atas: itu yang butuh dibaca orang.
  // Yang angkanya sama persis biasanya cuma sheet yang disalin, dan tombol
  // massal menyelesaikannya tanpa perlu dilihat satu-satu.
  out.sort((a, b) => Number(bedaAngka(b)) - Number(bedaAngka(a)));
  return out;
}

export function bedaAngka(c) {
  const q = c.hits.map(h => h.qty);
  return q.some(x => x !== q[0]);
}

// Terapkan keputusan orangnya ke daftar bentrokan.
//
//   pilihan[erp] = 'sheet:<nama>'  -> ambil baris dari sheet itu saja
//                = 'semua'         -> semua baris jalan, berdiri sendiri
//
// Mengembalikan Set berisi kunci "sheet|erp" yang HARUS DIBUANG. Sengaja
// mengembalikan yang dibuang, bukan yang dipakai: baris yang tidak pernah
// bentrok tidak boleh ikut tersaring gara-gara lupa dimasukkan ke daftar simpan.
export function barisDibuang(bentrokan, pilihan) {
  const buang = new Set();
  for (const c of (bentrokan || [])) {
    const p = (pilihan || {})[c.erp];
    if (!p || p === 'semua') continue;          // belum diputuskan / semua jalan
    const pilih = p.startsWith('sheet:') ? p.slice(6) : null;
    if (!pilih) continue;
    for (const h of c.hits) if (h.sheet !== pilih) buang.add(`${h.sheet}|${c.erp}`);
  }
  return buang;
}

export function semuaSudahDiputuskan(bentrokan, pilihan) {
  return (bentrokan || []).every(c => !!(pilihan || {})[c.erp]);
}
