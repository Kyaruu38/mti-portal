// Rule-based parser for the Label Inventory Tracker workbook ("Master Tracker"
// sheet). Grounded in the real file: 984 data rows, 15 columns.
//
// WHAT THIS DOES AND DELIBERATELY DOES NOT DO
// -------------------------------------------
// The Excel is the source of truth — every displayed number comes from the
// sheet, unchanged. This parser ALSO recomputes each derived column and reports
// disagreements as `mismatches`. It never overwrites a value: a mismatch means
// "the sheet and the formula disagree, look at it", not "the sheet is wrong".
// That keeps one source of truth while making a broken formula or a
// paste-as-values accident impossible to miss.
//
// Duplicates are QUARANTINED, not dropped and not merged. A row whose
// (Spec Name, Market Code) pair appears more than once is held out of `items`
// and listed in `duplicates` with its real Excel row number, because merging
// would invent a stock figure and dropping would lose one silently. The rest of
// the sheet imports normally so the weekly routine is never blocked.

import { parseItemName } from './itemName.js';
import { parseNumber } from './numbers.js';

// ---------------------------------------------------------------------------
// Column aliases. Matched case-insensitively against the header row, so a
// renamed or reordered column keeps working. Same approach as excelLabels.js.
// ---------------------------------------------------------------------------
// STOK BISA DATANG DARI DUA KOLOM, DAN KOLOM YANG NAMANYA PALING MIRIP "STOK"
// JUSTRU YANG SALAH.
//
// 13 Agu 2026. Sona mengirim dua berkas stok berformat ERP/WPS, bukan Label
// Inventory Tracker yang parser ini dibangun untuknya. Keduanya memakai
// `物料名称` untuk spec — kosakata ERP — sehingga header tidak terdeteksi sama
// sekali dan layar menolak berkasnya. Perbaikan yang tampak jelas dan aman
// adalah menambahkan `物料名称` ke alias spec.
//
// ITU JUSTRU PERBAIKAN YANG BERBAHAYA. Berkas 海边 punya kolom `库存数量`, dan
// `库存数量` sudah cocok dengan alias /库存/ yang lama. Jadi begitu spec-nya
// dikenali, parser akan BERHASIL, mengambil `库存数量` sebagai stok, dan
// mengisi layar dengan angka — tanpa satu pun error atau peringatan.
//
// Kata sona sendiri: *"海边表格里的库存数量是erp里直接导出的，所以不准确，
// 正确的是新的和旧的相加"* — kolom itu ekspor mentah dari ERP dan TIDAK akurat;
// yang benar adalah `旧` + `新`. Angka yang salah di sini tidak menghasilkan
// error, dia menyuruh orang membeli label untuk barang yang sudah menumpuk,
// atau diam untuk barang yang benar-benar habis.
//
// Aturannya sekarang: KALAU pasangan lama/baru ADA, dia yang dipakai dan
// `库存数量` DIABAIKAN — dan pengabaian itu DILAPORKAN di layar, tidak
// dilakukan diam-diam. Kalau pasangannya tidak ada, jalur lama (Tracker
// dengan `Current Label Stock`) tetap berlaku apa adanya.
const ALIASES = [
  ['no',          [/^no\.?$/i, /^nomor$/i]],
  ['erp',         [/material\s*code/i, /^erp\s*code$/i, /物料编号/]],
  // `物料名称` TIDAK bentrok dengan `物料英文名称` (ada 英文 di tengahnya) dan
  // tidak dengan `物料编号`. Diuji ke header asli kedua berkas.
  ['spec',        [/spec\s*name/i, /^spec$/i, /规格/, /^物料名称/, /^品名/]],
  // Pasangan stok lama/baru. Polanya sengaja BERJANGKAR, bukan potongan kata:
  // /新/ telanjang akan ikut kena `更新时间` dan header sejenis.
  ['stockLama',   [/versi\s*lama/i, /^舊的?$/, /^旧的?$/, /old\s*label/i]],
  ['stockBaru',   [/label\s*baru/i, /^新的?$/, /new\s*label/i]],
  ['market',      [/market\s*code/i, /^market$/i, /市场/]],
  ['stock',       [/current\s*label\s*stock/i, /^stock/i, /库存/]],
  ['production',  [/planned\s*production/i, /排产/]],
  ['sales',       [/planned\s*sales/i, /销售计划/]],
  ['buffer',      [/buffer/i]],
  ['requirement', [/label\s*requirement/i, /^requirement$/i, /需求/]],
  ['surplus',     [/surplus/i, /shortage/i]],
  ['status',      [/reorder\s*status/i, /^status$/i]],
  ['suggested',   [/suggested\s*order/i, /订单建议/]],
  ['week',        [/week\s*updated/i]],
];

function matchHeader(cell) {
  const s = String(cell == null ? '' : cell).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [key, pats] of ALIASES) if (pats.some(p => p.test(s))) return key;
  return null;
}

// The header is not guaranteed to be row 1 — the sibling sheets in this
// workbook carry two title rows above theirs.
// HEADER YANG DIPILIH HARUS PUNYA DATA DI BAWAHNYA.
//
// Skor mentah saja tidak cukup sejak alias bertambah. Berkas ekspor sering
// punya baris caption/ringkasan di atas header asli (berkas B punya
// `STIKER | 91702 | 46241`), dan sebuah caption yang kebetulan memuat kata
// `规格`, `库存`, `旧`, `新` bisa MENGALAHKAN header sungguhan di bawahnya.
// Dulu berkas begitu ditolak berisik karena tidak ada yang cocok; sekarang dia
// bisa DITERIMA membawa baris caption sebagai SKU.
//
// Penjaganya sederhana dan sulit dibantah: baris header yang benar punya sel
// spec TERISI tepat di bawahnya. Kandidat diurut menurut skor, lalu yang
// pertama lolos uji itulah yang dipakai.
function findHeaderRow(rows, scan = 10) {
  const kandidat = [];
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const map = {}; let hits = 0;
    (rows[i] || []).forEach((cell, c) => {
      const key = matchHeader(cell);
      if (key && map[key] == null) { map[key] = c; hits++; }
    });
    if (hits > 0) kandidat.push({ idx: i, map, hits });
  }
  if (!kandidat.length) return { idx: -1, map: {}, hits: 0 };

  const adaIsi = (r, c) => {
    const v = (rows[r] || [])[c];
    return v !== undefined && v !== null && String(v).trim() !== '';
  };

  // YANG MENANG ADALAH YANG PALING DEKAT DI ATAS DATA, BUKAN YANG SKORNYA
  // PALING TINGGI.
  //
  // Percobaan pertama memakai skor tertinggi lalu menguji "baris di bawahnya
  // terisi". Itu tidak cukup: baris caption `规格 | 库存 | 旧 | 新` mencetak
  // EMPAT, header aslinya tiga, dan baris ringkasan di bawah caption memang
  // terisi — jadi captionnya lolos ujian dan ikut terimpor sebagai SKU
  // bernilai 46.241. Ditangkap oleh tesnya sendiri, bukan oleh pembacaan ulang.
  //
  // Band caption/ringkasan selalu duduk LEBIH JAUH DI ATAS daripada header
  // sungguhan. Jadi di antara kandidat yang sah, yang indeksnya paling besar
  // yang benar.
  //
  // Syarat "sah" sengaja tiga, supaya sebuah BARIS DATA tidak bisa menang cuma
  // karena nama specnya kebetulan memuat kata `规格`:
  //   1. punya kolom spec,
  //   2. punya sumber stok (stock, atau salah satu dari pasangan lama/baru),
  //   3. minimal dua kolom dikenali — satu kecocokan nyasar tidak cukup.
  const sah = kandidat.filter(k =>
    k.map.spec != null
    && (k.map.stock != null || k.map.stockLama != null || k.map.stockBaru != null)
    && k.hits >= 2
    && adaIsi(k.idx + 1, k.map.spec));
  if (sah.length) return sah[sah.length - 1];

  // Tidak ada yang lolos: pulangkan skor tertinggi apa adanya supaya
  // pemeriksaan kolom wajib di parseLabelStockSheet yang menolak dan menyebut
  // alasannya — bukan fungsi ini yang diam-diam memutuskan.
  kandidat.sort((a, b) => b.hits - a.hits || a.idx - b.idx);
  return kandidat[0];
}

// ---------------------------------------------------------------------------
// THE FLOAT TRAP — read this before touching roundUpQty/requirementOf.
//
// Excel's ROUNDUP is fuzzy: it treats 737.0000000000001 as 737. JavaScript's
// Math.ceil is exact and gives 738. In the real file, 670 x 1.1 lands on
// 737.0000000000001 in IEEE-754, and 27 of the 984 rows hit this. A naive
// Math.ceil would therefore report 27 FALSE mismatches on a perfectly healthy
// sheet — and a cross-check that cries wolf 27 times a week gets ignored, which
// defeats the entire point of having one.
//
// Snapping to 9 decimal places before rounding reproduces Excel exactly:
// verified 0 mismatches across all 984 rows.
// ---------------------------------------------------------------------------
const EPS_DP = 9;
function ceilLikeExcel(x) {
  return Math.ceil(Number(x.toFixed(EPS_DP)));
}

export function requirementOf(production, bufferPct) {
  return ceilLikeExcel((Number(production) || 0) * (1 + (Number(bufferPct) || 0)));
}

// Printer MOQ rounding: a shortage of 12,141 with MOQ 500 orders 12,500.
export function suggestedQtyOf(surplus, moq = 500) {
  const s = Number(surplus) || 0;
  if (s >= 0) return 0;
  const m = Number(moq) || 1;
  return Math.ceil(-s / m) * m;
}

// Status rule, reverse-engineered from the workbook and verified against all
// 984 rows with ZERO disagreements:
//   no planned production      -> IDLE STOCK   (stock sitting with no demand)
//   short of requirement       -> BUY NOW
//   stock >= 2x requirement    -> OVERSTOCK
//   otherwise                  -> SUFFICIENT
// The 2x multiple is a business threshold, not a law of nature — it is a
// parameter so it can be changed in Master Data without touching this file.
export const OVERSTOCK_MULTIPLE = 2;
export function statusOf(stock, production, requirement, surplus, multiple = OVERSTOCK_MULTIPLE) {
  if ((Number(production) || 0) === 0) return 'IDLE STOCK';
  if ((Number(surplus) || 0) < 0) return 'BUY NOW';
  return (Number(stock) || 0) >= (Number(requirement) || 0) * multiple ? 'OVERSTOCK' : 'SUFFICIENT';
}

export const STATUSES = ['BUY NOW', 'SUFFICIENT', 'OVERSTOCK', 'IDLE STOCK'];

// Normalised join key. Trailing spaces and full-width/half-width differences in
// a pasted Market Code must not create a phantom "new" SKU every week.
//
// EVERY space is removed, not merely collapsed. The old rule squeezed runs of
// whitespace down to one and stopped there, so these two rows lived side by
// side in the tracker as separate SKUs for months:
//
//     ID10.00R20-18PR(149/146F)[CB332]  朝阳     (two spaces)
//     ID10.00R20-18PR(149/146F)[CB332]朝阳       (none)
//
// One physical label, entered twice. Both looked reasonable on their own, so
// nobody questioned either — and it only surfaced when both matched the SAME
// ERP code (010504214ID) during the bulk match, because THAT comparison dropped
// spaces entirely.
//
// The damage was quiet and arithmetical: stock split across two rows,
// requirement split with it, so BUY NOW and OVERSTOCK for that label were being
// decided on roughly half the real numbers.
//
// Spaces carry no meaning anywhere in these names — they are ERP export
// artefacts and typing accidents. Two label names that differ only in spacing
// are the same label, every time.
export function skuKey(spec, market) {
  const n = s => String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();
  return `${n(spec)}||${n(market)}`;
}

const num = v => {
  const n = parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array<Array>} rows   sheet as array-of-arrays (core/xlsx.js rows())
 * @param {object} opts         { moq, overstockMultiple }
 * @returns {object} see the shape documented at the top of this file
 */
export function parseLabelStockSheet(rows, opts = {}) {
  const moq = Number(opts.moq) || 500;
  const multiple = Number(opts.overstockMultiple) || OVERSTOCK_MULTIPLE;
  const warnings = [];

  const header = findHeaderRow(rows);
  const m = header.map;

  // DUA SUMBER STOK YANG SAH, DAN YANG SATU MENGALAHKAN YANG LAIN.
  //   pasangan lama+baru  -> stok = lama + baru, `库存数量` DIABAIKAN
  //   tidak ada pasangan  -> jalur Tracker lama, pakai kolom stock
  // Lihat catatan panjang di atas ALIASES untuk kenapa urutannya begini.
  // PASANGAN HARUS LENGKAP. Versi pertama memakai OR, dan itu cacat: satu
  // kolom `旧的` nyasar di Tracker biasa membuat SELURUH berkas berhenti
  // memakai `Current Label Stock` lalu menghitung `0 + kosong` = 0 untuk tiap
  // baris yang kolom pasangannya kosong. Aturan sona berbunyi "新 + 旧";
  // separuh pasangan bukan jumlah itu, dan angka yang bukan keduanya adalah
  // angka yang tidak dimiliki siapa pun.
  const pasanganLengkap = m.stockLama != null && m.stockBaru != null;
  const pasanganSetengah = !pasanganLengkap && (m.stockLama != null || m.stockBaru != null);
  const punyaPasangan = pasanganLengkap;
  const adaStok = pasanganLengkap || m.stock != null;

  // spec + salah satu sumber stok adalah minimum untuk bisa berkata apa pun.
  if (header.idx < 0 || m.spec == null || !adaStok) {
    const kurang = [];
    if (header.idx < 0 || m.spec == null) kurang.push('nama/spec barang (Spec Name, 规格, atau 物料名称)');
    if (!adaStok) kurang.push('stok (Current Label Stock, atau pasangan kolom lama+baru)');
    return {
      ok: false,
      // Menyebut APA yang hilang, bukan cuma bahwa ada yang hilang. Berkas yang
      // ditolak tanpa menyebut kolomnya memaksa orangnya menebak, dan header
      // berkas ini memang beda kosakata dari Tracker.
      error: `Header tidak terdeteksi — yang tidak ketemu: ${kurang.join('; ')}.`,
      warnings,
    };
  }

  // Peringatan membawa objek TIGA BAHASA, bukan cuma kalimat Indonesia. Yang
  // mengunggah berkas ini sona, dan yang paling penting di antara peringatan
  // ini — bahwa satu kolom angka DIABAIKAN — justru yang tidak bisa dia baca
  // kalau isinya cuma bahasa Indonesia. `msg` dipertahankan untuk console.
  const warn = (type, t) => warnings.push({ type, t, msg: t.id });

  if (pasanganSetengah) {
    warn('half_pair', {
      id: 'Cuma SATU dari pasangan kolom lama/baru yang ketemu. Stok TIDAK dihitung dari situ — dipakai kolom Stock/库存数量 apa adanya. Lengkapi kedua kolomnya kalau mau memakai aturan lama+baru.',
      en: 'Only ONE of the old/new column pair was found. Stock is NOT derived from it — the Stock/库存数量 column is used as-is. Provide both columns to use the old+new rule.',
      zh: '只找到新/旧两列中的一列。库存不会据此计算 — 直接使用“库存数量”列。若要按“新+旧”计算，请补齐两列。',
    });
  }
  if (pasanganLengkap && m.stock != null) {
    warn('stock_source', {
      id: 'Stok dihitung dari kolom LAMA + BARU. Kolom "库存数量" DIABAIKAN — angkanya ekspor mentah dari ERP dan tidak akurat.',
      en: 'Stock is computed from the OLD + NEW columns. The "库存数量" column is IGNORED — it is a raw ERP export and is not accurate.',
      zh: '库存按“旧 + 新”相加计算。“库存数量”列已被忽略 — 该列由 ERP 直接导出，并不准确。',
    });
  }

  const NAMA = {
    market: { id: 'market', en: 'market', zh: '市场' },
    production: { id: 'rencana produksi', en: 'planned production', zh: '排产计划' },
    buffer: { id: 'buffer', en: 'buffer', zh: '缓冲' },
    requirement: { id: 'kebutuhan', en: 'requirement', zh: '需求' },
    status: { id: 'status', en: 'status', zh: '状态' },
  };
  for (const need of ['market', 'production', 'buffer', 'requirement', 'status']) {
    if (m[need] == null) warn('missing_column', {
      id: `Kolom "${NAMA[need].id}" tidak ketemu — nilainya dianggap kosong.`,
      en: `Column "${NAMA[need].en}" not found — treated as empty.`,
      zh: `未找到“${NAMA[need].zh}”列 — 按空值处理。`,
    });
  }

  // Baris yang stoknya TIDAK BISA DIPASTIKAN dikumpulkan di sini, bukan
  // dijadikan nol. Lihat alasannya di tempat pengumpulannya, di dalam loop.
  const tanpaStok = [];
  const rusak = [];
  const kosongSel = v => v === undefined || v === null || String(v).trim() === '';

  const seen = new Map();   // skuKey -> [rowRecord]
  const parsed = [];
  let skipped = 0;

  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const spec = String(row[m.spec] == null ? '' : row[m.spec]).trim();
    if (!spec) { if (row.some(c => c !== '' && c != null)) skipped++; continue; }

    const market = m.market == null ? '' : String(row[m.market] == null ? '' : row[m.market]).trim();
    // Pasangan lama+baru menang. Sel kosong dihitung nol — di berkas sona kolom
    // `新的` memang kosong untuk sebagian besar baris, dan itu berarti "belum
    // ada yang baru", bukan "tidak diketahui".
    // SEL YANG TERISI TAPI TIDAK TERBACA TIDAK BOLEH JADI NOL.
    //
    // `num()` mengembalikan 0 untuk apa pun yang gagal di-parse — persis pola
    // silent-zero yang parsers/numbers.js ditulis untuk membasmi, dan sekarang
    // dia duduk di dua kolom yang jadi SATU-SATUNYA sumber stok. `#REF!` di
    // kolom 旧 pada ekspor 666 baris akan memotong stok SKU itu tanpa satu pun
    // tanda. Yang kosong tetap nol (di berkas sona kolom `新的` memang kosong
    // untuk hampir semua baris, dan itu berarti "belum ada yang baru"); yang
    // TERISI tapi tidak terbaca dicatat dan dilaporkan.
    const bacaStok = (col) => {
      if (col == null) return 0;
      const v = row[col];
      if (kosongSel(v)) return 0;
      const n = parseNumber(v);
      if (!Number.isFinite(n)) { rusak.push({ excelRow: i + 1, spec, isi: String(v).slice(0, 20) }); return 0; }
      return n;
    };

    // STOK YANG TIDAK DIKETAHUI DIKARANTINA, TIDAK DIANGGAP NOL.
    //
    // Kolom 旧/新 di berkas A diisi TANGAN di atas ekspor ERP 666 baris, jadi
    // baris yang belum terisi itu keadaan normal — bukan pengecualian. Kalau
    // baris seperti itu masuk sebagai stok 0 sementara `库存数量` jelas-jelas
    // menyebut angka, portal akan menandainya BUY NOW dengan saran beli sebesar
    // kebutuhan penuh: memesan label untuk barang yang sedang menumpuk di
    // gudang. Nol yang salah di sini tidak menghasilkan error, dia menghasilkan
    // pembelian.
    //
    // Hanya dikarantina kalau ADA BUKTI TANDINGAN (`库存数量` > 0). Tanpa bukti
    // itu, dua kolom kosong memang berarti nol.
    if (pasanganLengkap && m.stock != null
        && kosongSel(row[m.stockLama]) && kosongSel(row[m.stockBaru])) {
      const erp = num(row[m.stock]);
      if (erp > 0) { tanpaStok.push({ excelRow: i + 1, spec, erp }); continue; }
    }

    const stokLama = m.stockLama == null ? 0 : bacaStok(m.stockLama);
    const stokBaru = m.stockBaru == null ? 0 : bacaStok(m.stockBaru);
    const stock = punyaPasangan ? (stokLama + stokBaru) : num(row[m.stock]);
    const production = m.production == null ? 0 : num(row[m.production]);
    const sales = m.sales == null ? 0 : num(row[m.sales]);
    const buffer = m.buffer == null ? 0 : num(row[m.buffer]);

    // AS PRINTED IN THE SHEET — these are what get stored and displayed.
    const sheetRequirement = m.requirement == null ? null : num(row[m.requirement]);
    const sheetSurplus = m.surplus == null ? null : num(row[m.surplus]);
    const sheetStatus = m.status == null ? '' : String(row[m.status] == null ? '' : row[m.status]).trim();
    const sheetSuggested = m.suggested == null ? null : num(row[m.suggested]);

    // RECOMPUTED — cross-check only, never substituted for the sheet's value.
    const calcRequirement = requirementOf(production, buffer);
    const calcSurplus = stock - calcRequirement;
    const calcStatus = statusOf(stock, production, calcRequirement, calcSurplus, multiple);
    const calcSuggested = suggestedQtyOf(calcSurplus, moq);

    const diff = [];
    if (sheetRequirement != null && sheetRequirement !== calcRequirement) diff.push({ field: 'requirement', sheet: sheetRequirement, calc: calcRequirement });
    if (sheetSurplus != null && sheetSurplus !== calcSurplus) diff.push({ field: 'surplus', sheet: sheetSurplus, calc: calcSurplus });
    if (sheetStatus && sheetStatus !== calcStatus) diff.push({ field: 'status', sheet: sheetStatus, calc: calcStatus });
    if (sheetSuggested != null && sheetSuggested !== calcSuggested) diff.push({ field: 'suggestedQty', sheet: sheetSuggested, calc: calcSuggested });

    const rec = {
      // +1 because sheet rows are 1-based; this is the number the user types
      // into Excel's Ctrl+G box, so it must be exact.
      excelRow: i + 1,
      no: m.no == null ? null : row[m.no],
      erp: m.erp == null ? '' : String(row[m.erp] == null ? '' : row[m.erp]).trim(),
      spec, market, key: skuKey(spec, market),
      stock, production, sales, buffer,
      // Disimpan supaya layar bisa menunjukkan ASALNYA, bukan cuma hasilnya.
      // Sebuah angka stok yang tidak bisa ditelusuri ke kolom sumbernya adalah
      // angka yang tidak bisa dibantah orang yang tahu barangnya.
      stokLama: punyaPasangan ? stokLama : null,
      stokBaru: punyaPasangan ? stokBaru : null,
      stokErp: (punyaPasangan && m.stock != null) ? num(row[m.stock]) : null,
      requirement: sheetRequirement == null ? calcRequirement : sheetRequirement,
      surplus: sheetSurplus == null ? calcSurplus : sheetSurplus,
      status: sheetStatus || calcStatus,
      suggestedQty: sheetSuggested == null ? calcSuggested : sheetSuggested,
      week: m.week == null ? '' : row[m.week],
      calc: { requirement: calcRequirement, surplus: calcSurplus, status: calcStatus, suggestedQty: calcSuggested },
      mismatch: diff,
    };

    parsed.push(rec);
    if (!seen.has(rec.key)) seen.set(rec.key, []);
    seen.get(rec.key).push(rec);
  }

  // Split clean rows from duplicated ones. A duplicated key means EVERY row
  // carrying it is held back — we cannot know which one is authoritative.
  const items = [];
  const duplicates = [];
  for (const [key, group] of seen) {
    if (group.length === 1) { items.push(group[0]); continue; }
    duplicates.push({
      key,
      spec: group[0].spec,
      market: group[0].market,
      rows: group.map(r => ({ excelRow: r.excelRow, no: r.no, stock: r.stock, status: r.status })),
      // Shown so the user can see what merging WOULD give, without the parser
      // deciding to merge.
      combinedStock: group.reduce((s, r) => s + r.stock, 0),
      requirement: group[0].requirement,
    });
  }
  items.sort((a, b) => a.excelRow - b.excelRow);
  duplicates.sort((a, b) => a.rows[0].excelRow - b.rows[0].excelRow);

  if (duplicates.length) {
    warnings.push({
      type: 'duplicate_sku',
      msg: `${duplicates.length} spec muncul lebih dari sekali (${duplicates.reduce((s, d) => s + d.rows.length, 0)} baris). Baris-baris ini TIDAK diimpor — perbaiki di Excel lalu upload ulang.`,
    });
  }

  const mismatches = items.filter(r => r.mismatch.length);
  if (mismatches.length) {
    warnings.push({
      type: 'formula_mismatch',
      msg: `${mismatches.length} baris angkanya beda dari hasil hitung ulang. Nilai dari Excel tetap dipakai — tapi cek apakah ada rumus yang rusak atau kolom yang ke-paste sebagai angka mati.`,
    });
  }

  // ERP guess — a HINT for the one-time matching screen, never applied silently.
  // NOTE: the ERP guess is NOT computed here. The matching screen does it, for
  // the visible slice only — 974 rows x every candidate on each upload is wasted
  // work, and by then the candidate pool (item master + design library +
  // historical PO lines, see core/labelOrders.js erpCandidates) is far richer
  // than the item master alone.

  // Dua laporan ini disusun SESUDAH loop karena keduanya menghitung baris.
  // Angkanya disebut, dan contohnya disebut — "ada baris yang bermasalah" tanpa
  // nomor baris memaksa orangnya memeriksa enam ratus enam puluh enam baris.
  const contoh = (arr) => arr.slice(0, 3).map(x => `baris ${x.excelRow}`).join(', ')
    + (arr.length > 3 ? `, +${arr.length - 3} lagi` : '');

  if (tanpaStok.length) {
    warn('no_stock_quarantined', {
      id: `${tanpaStok.length} baris TIDAK diimpor: kolom lama dan baru dua-duanya kosong padahal "库存数量" ada isinya. Stoknya tidak bisa dipastikan, dan menganggapnya nol akan membuat portal menyuruh membeli label untuk barang yang mungkin sedang menumpuk. Isi kolom lama/baru untuk baris ini. (${contoh(tanpaStok)})`,
      en: `${tanpaStok.length} row(s) NOT imported: both the old and new columns are empty while "库存数量" has a figure. The stock cannot be established, and treating it as zero would make the portal order labels for goods that may be sitting in the warehouse. Fill the old/new columns for these rows. (${contoh(tanpaStok)})`,
      zh: `${tanpaStok.length} 行未导入：新旧两列均为空，但“库存数量”有数值。库存无法确定，若按零处理，系统会为可能仍在仓库的货物下单采购标签。请补填这些行的新/旧数量。（${contoh(tanpaStok)}）`,
    });
  }
  if (rusak.length) {
    warn('unreadable_stock', {
      id: `${rusak.length} sel stok terisi tapi TIDAK TERBACA sebagai angka (mis. "${rusak[0].isi}") — dihitung nol. Periksa dulu sebelum disimpan. (${contoh(rusak)})`,
      en: `${rusak.length} stock cell(s) are filled but NOT READABLE as a number (e.g. "${rusak[0].isi}") — counted as zero. Check before saving. (${contoh(rusak)})`,
      zh: `${rusak.length} 个库存单元格有内容但无法识别为数字（例如“${rusak[0].isi}”）— 已按零计算。保存前请先核对。（${contoh(rusak)}）`,
    });
  }

  return {
    ok: true,
    headerIdx: header.idx,
    map: m,
    items,
    duplicates,
    mismatches,
    warnings,
    tanpaStok,
    rusak,
    stats: {
      total: parsed.length,
      imported: items.length,
      duplicated: parsed.length - items.length,
      skipped,
      mismatched: mismatches.length,
      tanpaStok: tanpaStok.length,
      rusak: rusak.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Best-effort ERP suggestion. The tracker's Material Code column is empty for
// every row in the real file, so the portal has to bridge "long spec name" to
// "ERP code" itself. Confidence is returned alongside so the matching screen can
// sort the certain ones to the top and leave the rest for a human.
//
// Never auto-applied: a wrong ERP silently attributes another product's
// shipments to this SKU.
// ---------------------------------------------------------------------------
export function guessErp(rec, master) {
  const parsed = parseItemName(rec.spec, []);
  const norm = s => String(s || '').replace(/\s+/g, '').toUpperCase();
  const specN = norm(rec.spec);
  let best = null;

  for (const it of master) {
    if (!it.erp) continue;
    let score = 0;
    const itSpecN = norm(it.spec);
    if (itSpecN && itSpecN === specN) score = 1;                       // exact
    else if (itSpecN && (specN.includes(itSpecN) || itSpecN.includes(specN))) score = 0.8;
    else {
      // Pattern code is the most distinctive token and survives every naming
      // variant in this data ([AZ850], [ST600], [AT-1], [H-568]).
      if (parsed.pattern && norm(it.spec).includes(norm(parsed.pattern))) score += 0.5;
      if (parsed.loadIndex && norm(it.spec).includes(norm(parsed.loadIndex))) score += 0.25;
      if (parsed.pr && norm(it.spec).includes(norm(parsed.pr))) score += 0.15;
    }
    if (score > 0 && (!best || score > best.score)) best = { erp: it.erp, spec: it.spec, score };
  }
  return best && best.score >= 0.5 ? best : null;
}
