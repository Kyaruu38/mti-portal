// Rule-based parser for label-request Excel sheets.
// Grounded in samples: 7.15缺货标签下单.xls, local items7月份排产计划.xlsx.
//
// Header row columns (by NAME, order varies between sheets):
//   market | ERP Label Code - Chinese | ERP Label Code - English | 规格 specification
//   有无模版 template | EANCODE | ERP CODE | 品牌 Brand | TT/TL | [PR] | M+S标记
//   泥雪地 牵引标识位置 | QTY | RR | W1.24t | 噪音 | 噪音等级 | pickup date
//
// THE SHIFTED-PR-HEADER BUG: some sheets omit the "PR" header, so every column
// to the right of TT/TL shifts by one. We detect this by TYPE-VALIDATION of the
// QTY column (must be numeric) and auto-correct, surfacing a warning.

import { parseItemName } from './itemName.js';
import { canonicalBrand, ejaanResmi, merekDikenal } from './brandMap.js';
import { parseNumber } from './numbers.js';

// Header alias -> canonical key. Matched case-insensitively as substrings.
const ALIASES = [
  // SIZE dan 规格 DIDAFTARKAN DULUAN, dan polanya DIJANGKARKAN.
  //
  // Lembar di sini memuat DUA kolom yang sama-sama bernama 规格, dan artinya
  // TERTUKAR antar berkas:
  //    EAN master     SIZE = 'ID12.00R24-20PR(160/157F)[CB972E]CHAOYANG'
  //                   规格 specification = '12.00R24'
  //    11.2 加急标签   规格 specification = 'ID7.50-16-14PR[R8038]...'
  //                   规格              = '7.50-16'
  // Jadi nama lengkap dan dimensi bisa duduk di bawah judul mana pun. Judulnya
  // tidak bisa dipercaya; yang memutuskan BENTUK ISINYA, di pisahSpecSize()
  // di bawah. Yang dilakukan di sini cuma memastikan kolom keduanya TIDAK
  // hilang: sebelum ini /规格/ menyerap keduanya ke 'spec', dan karena
  // findHeaderRow() cuma menyimpan kolom PERTAMA per kunci, kolom dimensinya
  // dibuang tanpa suara.
  ['size', [/^size$/i, /^规格$/]],
  ['market', [/^market$/i, /市场/]],
  ['nameZh', [/chinese/i, /物料名称/, /物料名字/]],
  ['nameEn', [/english/i]],
  ['spec', [/spec/i, /规格/]],
  ['template', [/template/i, /有无模版/, /有无模板/]],
  ['ean', [/ean/i]],
  ['erp', [/^erp\s*code$/i, /物料编号/]],
  ['brand', [/brand/i, /品牌/]],
  ['ttl', [/tt\s*\/\s*tl/i, /^tt.?tl$/i]],
  // 层级 DIANCURKAN, dan anchor-nya penting: 层级块 (plyBlock) adalah kolom
  // LAIN, dan pola tanpa anchor akan menyerap dua-duanya ke 'pr' sehingga
  // kolom balok lapisnya hilang tanpa suara -- findHeaderRow() cuma menyimpan
  // kolom pertama per kunci.
  //
  // Sampai sekarang 层级 tidak ada aliasnya sama sekali, jadi kolom PR di
  // lembar Sona DIBUANG dan nilainya cuma didapat dari hasil urai nama barang.
  // Itu kebetulan berhasil untuk lembar yang namanya lengkap, dan diam-diam
  // gagal untuk yang tidak.
  ['pr', [/^pr$/i, /ply/i, /^层级$/]],
  ['ms', [/m\s*\+\s*s/i]],
  ['snow', [/泥雪地/, /牵引标识/]],
  ['pattern', [/^pattern$/i, /花纹/]],
  // 速度级别 di lembar 加急 berisi '122/118J' — indeks beban + simbol
  // kecepatan, isi yang sama dengan 负荷指数块 di EAN master. Satu kunci.
  ['loadSpeed', [/速度级别/, /负荷指数/, /load\s*index/i, /速度/]],
  ['plyBlock', [/层级块/]],
  // Dua baris teks yang tercetak di label Brasil/Indonesia. Ditangkap apa
  // adanya — '100:2019' dan '1-132-003-26001522-5' bukan angka yang boleh
  // diurai, melainkan nomor sertifikat yang harus tercetak persis.
  ['npb1', [/npb\s*第一行/i, /first\s*line\s*of\s*npb/i]],
  ['npb3', [/npb\s*第三行/i, /third\s*line\s*of\s*npb/i]],
  ['barcode', [/^barcode$/i]],
  ['sni', [/^sni\s*no/i, /sni\s*no\./i]],
  ['country', [/国家地区/, /^country$/i]],
  ['qty', [/^qty$/i, /数量/, /申请数量/]],
  ['rr', [/^rr$/i]],
  // W1.24t = CENGKERAMAN BASAH (wet grip), diukur pada beban 1.24 ton.
  // Hurufnya A..E dan tercetak di label INMETRO/BX persis di sebelah RR.
  //
  // Sampai sekarang kolom ini DIBUANG: tidak ada aliasnya, jadi
  // findHeaderRow() tidak pernah melihatnya. Padahal lembar order adalah
  // satu-satunya tempat huruf itu pernah dituliskan — sama persis dengan
  // nasib rr/噪音 sebelum label_master.sql ada.
  ['wetGrip', [/^w\s*1[.,]?24\s*t$/i, /湿滑/, /湿地/, /wet\s*grip/i]],
  ['noise', [/噪音$/, /^噪音$/]],
  ['noiseClass', [/噪音等级/]],
  ['pickup', [/pickup/i, /需求日期/]],
];

function matchHeader(cell) {
  const s = String(cell || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [key, pats] of ALIASES) {
    if (pats.some(p => p.test(s))) return key;
  }
  return null;
}

// Find the header row within the first `scan` rows (row that maps the most columns).
//
// Exported because parsers/labelSheetSet.js has to decide WHICH sheets in a
// 14-sheet workbook are order sheets, and the only honest way to answer that is
// to run the same header matcher this parser will run later. A second private
// copy of the alias list is a copy that will one day disagree with this one —
// and it would disagree silently, by accepting a sheet the parser then refuses
// to read.
export function findHeaderRow(rows, scan = 8) {
  let best = { idx: -1, map: {}, hits: 0 };
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const row = rows[i] || [];
    const map = {};
    let hits = 0;
    const multi = {};
    row.forEach((cell, c) => {
      const key = matchHeader(cell);
      if (!key) return;
      (multi[key] || (multi[key] = [])).push(c);
      if (map[key] == null) { map[key] = c; hits++; }
    });
    // `multi` DITAMBAHKAN, bentuk lama tidak diubah: labelSheetSet.js memakai
    // findHeaderRow() untuk memutuskan lembar mana yang lembar order, dan
    // mengubah bentuk kembaliannya berarti mengubah keputusan itu juga.
    if (hits > best.hits) best = { idx: i, map, hits, multi };
  }
  return best;
}

// SIAPA NAMA LENGKAP, SIAPA DIMENSI — DIPUTUSKAN DARI ISINYA.
//
// Dipanggil sesudah header ketemu, atas semua kolom yang judulnya mengandung
// 规格 / spec / SIZE. Nama lengkap di sini selalu panjang dan memuat kurung
// kode pola ('ID295/80R22.5-18PR(152/149M)[AS898]TRAZANO TL'); dimensi selalu
// pendek dan berhenti di ukuran ('295/80R22.5', '7.50-16').
//
// Kalau cuma ADA SATU kolom, dia tetap jadi `spec` seperti perilaku lama —
// lembar lama tidak boleh berubah artinya karena fungsi ini lahir.
export function pisahSpecSize(rows, headerIdx, map, multi) {
  const kandidat = [...new Set([...(multi.spec || []), ...(multi.size || [])])];
  if (kandidat.length < 2) return map;
  const sample = rows.slice(headerIdx + 1, headerIdx + 25);
  const skor = c => {
    const v = sample.map(r => String((r || [])[c] ?? '').trim()).filter(Boolean);
    if (!v.length) return { panjang: 0, dimensi: 0, n: 0 };
    const panjang = v.filter(x => x.length > 18 || /[[\]]/.test(x)).length / v.length;
    const dimensi = v.filter(x => x.length <= 18 && /^\d|^[A-Z]{0,2}\d/.test(x)).length / v.length;
    return { panjang, dimensi, n: v.length };
  };
  const nilai = kandidat.map(c => ({ c, ...skor(c) })).filter(x => x.n > 0);
  if (nilai.length < 2) return map;
  const penuh = nilai.slice().sort((a, b) => b.panjang - a.panjang)[0];
  const dim = nilai.filter(x => x.c !== penuh.c).sort((a, b) => b.dimensi - a.dimensi)[0];
  const out = { ...map };
  if (penuh && penuh.panjang > 0) out.spec = penuh.c;
  if (dim && dim.dimensi > 0) out.size = dim.c;
  return out;
}

// parseNumber, BUKAN Number(replace(/[,\s]/g)) — pola lama membuang koma dan
// spasi tapi TIDAK membuang titik, jadi sel Excel yang tersimpan sebagai TEKS
// "1.200" terbaca 1,2 dan "1.200.000" terbaca NaN lalu ditolak NUMERIC. Sel
// yang benar-benar bertipe angka tidak terpengaruh; yang berbahaya adalah yang
// diketik tangan, dan itu justru yang paling sering di berkas order bulanan.
const toNum = v => { const n = parseNumber(v, 'id'); return Number.isFinite(n) ? n : NaN; };
const NUMERIC = v => v !== '' && v != null && Number.isFinite(toNum(v));

// ANGKA POLOS: dipakai HANYA untuk mendeteksi pergeseran kolom, dan ketatnya
// disengaja. parseNumber() memang memaafkan banyak bentuk -- itu gunanya untuk
// MEMBACA sel yang diketik tangan. Tapi untuk MENEBAK kolom mana sebenarnya
// kolom QTY, kemurahan itu berbahaya: '152/149M' (indeks beban) lolos
// NUMERIC() dan terbaca 152149, dan '18PR' terbaca 18.
//
// Itu bukan dugaan. Diuji: lembar satu baris dengan QTY berisi 'asap' membuat
// correctQty memindahkan kolom QTY ke kolom 负荷指数 di sebelahnya, lalu
// memesan 152.149 lembar label dari satu baris yang jumlahnya tidak terbaca.
// Spanduk 'kolom PR hilang' muncul, jadi secara teknis ada peringatan -- tapi
// peringatannya menyebut hal lain, dan angkanya tetap masuk ke PO.
//
// Kolom QTY berisi angka saja: '1200', '1.200', '1,200', '1200.0'. Yang
// mengandung huruf atau garis miring BUKAN kandidat, apa pun kata parseNumber.
const ANGKA_POLOS = v => {
  const str = String(v ?? '').trim();
  if (!str || /[A-Za-z/]/.test(str)) return false;
  return Number.isFinite(toNum(str));
};
const ERP_RE = /^\d{6,}[A-Za-z]{0,3}$|^MTI-|^\d{4,}ID$/;

// Validate & auto-correct the QTY column via type inspection of data rows.
function correctQty(rows, headerIdx, map) {
  const dataRows = rows.slice(headerIdx + 1).filter(r => r && r.some(c => c !== ''));
  // Sample by "row has content in the mapped columns", NOT by "row has an ERP
  // code". The `newitems` section exists precisely for items that have no ERP
  // yet, so an all-new-items sheet produced an EMPTY sample: correctQty bailed
  // with shifted:false, the column shift was never detected, map.qty kept
  // pointing at the 泥雪地 column, NUMERIC failed on every row, and all rows were
  // silently counted as `skipped` with no warning at all.
  const hasContent = r => [map.erp, map.spec, map.qty, map.brand].some(c => c != null && r[c] != null && String(r[c]).trim() !== '');
  const withErp = dataRows.filter(r => (r[map.erp] != null && String(r[map.erp]).trim()));
  const sample = (withErp.length ? withErp : dataRows.filter(hasContent)).slice(0, 20);
  if (map.qty == null) return { map, shifted: false };
  // An empty sample means we genuinely cannot validate — say so instead of
  // reporting "no shift detected", which reads like a clean bill of health.
  if (!sample.length) return { map, shifted: false, unvalidated: true };

  const numericAt = col => sample.filter(r => ANGKA_POLOS(r[col])).length / sample.length;
  const declared = numericAt(map.qty);
  if (declared >= 0.6) return { map, shifted: false };

  // SAMPEL TERLALU KECIL UNTUK MEMUTUSKAN PERGESERAN.
  //
  // Dengan satu atau dua baris, "kolom di sebelahnya 100% angka" tidak berarti
  // apa-apa -- satu sel kebetulan angka sudah cukup. Dan akibat salahnya tidak
  // simetris: tidak menggeser berarti barisnya ditanyakan ke orangnya, sedangkan
  // menggeser dengan salah berarti angka dari kolom lain masuk ke PO sebagai
  // jumlah pesanan. Jadi kalau tidak yakin, JANGAN geser -- biarkan jalur
  // PERLU DICEK yang menanganinya.
  if (sample.length < 3) {
    return { map, shifted: false, sampelKecil: sample.length };
  }

  // QTY column isn't numeric -> look at neighbours (the shift is usually +/-1..2).
  let bestCol = map.qty, bestScore = declared;
  for (const d of [-1, 1, -2, 2]) {
    const c = map.qty + d;
    if (c < 0) continue;
    const score = numericAt(c);
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }
  if (bestCol !== map.qty && bestScore >= 0.6) {
    const shift = bestCol - map.qty;
    const newMap = { ...map };
    // Shift every column at/after QTY's original position (right of TT/TL region).
    for (const k of ['pr', 'ms', 'snow', 'qty', 'rr', 'wetGrip', 'noise', 'noiseClass', 'pickup']) {
      if (newMap[k] != null) newMap[k] += shift;
    }
    return { map: newMap, shifted: true, shift };
  }
  return { map, shifted: false };
}

// UKURAN STOK LABEL, BUKAN DIMENSI BAN.
//
// Di lembar 'DETAIL NEW ITEM' milik BX, judul kolomnya juga 'SIZE' — tapi
// isinya '254X79mm', yaitu ukuran KERTAS labelnya; dimensi bannya cuma ada
// di dalam nama barang. Lembar SNI bulanan memakai judul yang sama persis
// untuk '10.00-20', dimensi ban yang sebenarnya. Judulnya identik, yang
// membedakan cuma BENTUK ISINYA, jadi tidak bisa dipisah lewat alias.
//
// Kalau tidak dipisah, '254X79mm' masuk ke items.size lalu tercetak sebagai
// dimensi ban — kelas kesalahan yang sudah pernah terjadi di backfill dan
// dicatat di supabase/sql/items_backfill_label.sql.
//
// Syarat 'mm' DISENGAJA ketat. Dimensi ban memakai '/', 'R' dan '-'
// ('295/80R22.5', '10.00-20', '7.50-16'), tidak pernah 'x..mm'. Tanpa
// syarat itu ukuran ban pertanian seperti '6.00x16' ikut terbuang.
// KODE PASAR, BUKAN PREFIKS PENUH NAMA BARANG.
//
// Sebagian lembar order mengisi kolom 'market' dengan prefiks penuh nama
// barang -- '(ID-WL-TBR-PT)' -- bukan kode pasarnya. Karena kolom lembar
// lebih dipercaya daripada hasil urai nama, nilai itu masuk apa adanya:
// 702 dari 1.560 baris items.market akhirnya menyimpan prefiks penuh, dan
// jumlah ejaan market membengkak jadi 87 untuk enam kode yang sebenarnya.
//
// Itu bukan soal rapi-rapian: generator artwork MEMILIH TEMPLATE lewat
// market, jadi '(ID-WL-TBR-PT)' berarti tidak ada template yang cocok.
//
// Kode pasarnya adalah segmen terakhir prefiks -- aturan yang sudah dipakai
// parseItemName() sejak awal. Dilipat di sini supaya kedua jalur (kolom
// lembar dan hasil urai nama) menghasilkan bentuk yang sama.
function kodePasar(v) {
  const s = String(v || '').trim();
  const m = s.match(/^\(\s*ID-.*?-([A-Za-z]+)\s*\)$/);
  if (m) return m[1].toUpperCase();
  if (/^[\u2014\u2013-]+$/.test(s)) return '';   // '-' / '--' / em-dash sebagai pasar bukan nilai
  return s;
}

const POLA_STOK_LABEL = /^\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?\s*mm$/i;

// ---------------------------------------------------------------------------
// MEDAN YANG HARUS TERBACA, DAN APA YANG TERJADI KALAU TIDAK.
//
// Aturannya dari pemiliknya, dan bunyinya tidak menyisakan ruang: "merek, qty
// everything, kalo ada gk kebaca lu harus confirm ke org yang upload, gw gamau
// lu nge skip yang ga kebaca".
//
// Jadi tidak ada satu pun medan di bawah yang boleh hilang diam-diam. Tapi
// "jangan di-skip" TIDAK sama dengan "tanyakan semuanya ke orangnya": kalau
// ERP-nya sudah ada di master item, medan yang kosong di lembar itu SUDAH
// diketahui portal, dan menanyakannya berarti menyuruh orang mengetik ulang
// sesuatu yang sudah tersimpan. Pertanyaan yang bisa dijawab sendiri adalah
// pertanyaan yang bikin kartunya panjang, dan kartu yang panjang tidak dibaca.
//
// Urutannya: baca lembar -> kalau kosong, ambil dari master (dicatat asalnya)
// -> kalau master juga tidak punya, BARU ditanyakan.
//
// Dua tingkat berat, dan bedanya nyata:
//   'tahan'  barisnya TIDAK boleh dipesan sampai dijawab. Empat medan saja:
//            jumlah (memesan tanpa jumlah bukan pilihan), merek dan pasar
//            (dua-duanya yang memilih DESIGN -- salah satu kosong berarti
//            labelnya tidak bisa dipilih, bukan cuma kurang rapi), dan spec
//            (itu identitas barangnya; tanpa dia barisnya tidak menunjuk apa
//            pun).
//   'tanya'  barisnya boleh dipesan, tapi medannya tetap ditanyakan karena dia
//            TERCETAK di label. Dilepas dari penahan dengan sengaja: menahan
//            seluruh order bulanan karena satu kolom 花纹 kosong akan membuat
//            orang berhenti memakai kartunya dan mulai mencari jalan pintas.
const MEDAN_PERIKSA = [
  { kunci: 'qty',       berat: 'tahan', master: null,        label: { id: 'Jumlah', en: 'Quantity', zh: '数量' } },
  { kunci: 'brand',     berat: 'tahan', master: 'brand',     label: { id: 'Merek', en: 'Brand', zh: '品牌' } },
  { kunci: 'market',    berat: 'tahan', master: 'market',    label: { id: 'Pasar', en: 'Market', zh: '市场' } },
  { kunci: 'spec',      berat: 'tahan', master: 'spec',      label: { id: 'Spec', en: 'Spec', zh: '规格' } },
  { kunci: 'size',      berat: 'tanya', master: 'size',      label: { id: 'Dimensi ban', en: 'Tyre size', zh: '轮胎尺寸' } },
  { kunci: 'ttl',       berat: 'tanya', master: 'ttTl',      label: { id: 'TT / TL', en: 'TT / TL', zh: 'TT / TL' } },
  { kunci: 'pr',        berat: 'tanya', master: 'ply',       label: { id: 'PR (lapis)', en: 'PR (ply)', zh: '层级 PR' } },
  { kunci: 'pattern',   berat: 'tanya', master: 'pattern',   label: { id: 'Kode pola', en: 'Pattern code', zh: '花纹代码' } },
  { kunci: 'loadSpeed', berat: 'tanya', master: 'loadSpeed', label: { id: 'Indeks beban', en: 'Load index', zh: '负荷指数' } },
  { kunci: 'erp',       berat: 'tanya', master: null,        label: { id: 'Kode ERP', en: 'ERP code', zh: 'ERP 代码' } },
];

export const MEDAN_PERIKSA_LABEL = Object.fromEntries(MEDAN_PERIKSA.map(m => [m.kunci, m.label]));
export const MEDAN_PERIKSA_BERAT = Object.fromEntries(MEDAN_PERIKSA.map(m => [m.kunci, m.berat]));

// PASAR YANG BENTUKNYA BUKAN KODE PASAR DIANGGAP TIDAK TERBACA.
//
// Kode pasar adalah segmen terakhir prefiks nama barang: BX, PT, SNI, OEM,
// ATD, EU, ZCTJ. Yang masuk ke kolom ini dan BUKAN itu sudah terbukti ada:
// 702 dari 1.560 baris pernah menyimpan prefiks penuh '(ID-WL-TBR-PT)', dan
// '—' juga pernah. kodePasar() sudah melipat dua bentuk itu, tapi yang lolos
// dari dua-duanya tetap harus ditanyakan -- karena pasar yang salah berarti
// pilihTemplat() tidak menemukan templat, dan itu baru ketahuan di langkah
// cetak, jauh dari orang yang tahu jawabannya.
const POLA_PASAR = /^[A-Z]{2,6}$/;

// Main entry. rows = array-of-arrays (SheetJS header:1). knownErps = Set of ERP codes.
export function parseLabelSheet(rows, { brandMap, knownErps = new Set(), master = [] } = {}) {
  // Master item dibuat jadi indeks SEKALI per lembar, bukan dicari linear per
  // baris: lembar order bulanan bisa 600 baris dan master 1.583 item, dan
  // find() di dalam loop berarti hampir satu juta perbandingan untuk satu
  // unggahan. Diterima sebagai array ATAU Map, supaya pemanggil yang sudah
  // punya indeksnya tidak membangun yang kedua.
  const masterIdx = master instanceof Map
    ? master
    : new Map((master || []).filter(x => x && x.erp).map(x => [String(x.erp).trim(), x]));
  const warnings = [];
  const header = findHeaderRow(rows);
  if (header.idx < 0 || header.hits < 3) {
    return { ok: false, error: 'Header tidak terdeteksi (kolom market / ERP CODE / QTY tidak ditemukan).', warnings };
  }
  const mapAwal = pisahSpecSize(rows, header.idx, header.map, header.multi || {});
  const { map, shifted, unvalidated, sampelKecil } = correctQty(rows, header.idx, mapAwal);
  if (shifted) {
    warnings.push({
      type: 'shifted_pr',
      msg: 'Kolom "PR" hilang di sheet ini — kolom di kanan TT/TL bergeser. Otomatis dikoreksi lewat validasi tipe QTY.',
    });
  }
  if (sampelKecil != null) {
    warnings.push({
      type: 'sampel_kecil',
      msg: `Kolom QTY tidak berisi angka dan sampelnya cuma ${sampelKecil} baris — terlalu sedikit untuk memastikan kolomnya bergeser, jadi TIDAK digeser. Baris yang jumlahnya tidak terbaca masuk daftar "perlu dicek" di bawah.`,
    });
  }
  if (unvalidated) {
    // Explicit: "couldn't check" is NOT the same as "checked, all good".
    warnings.push({
      type: 'qty_unvalidated',
      msg: 'Kolom QTY tidak bisa divalidasi (tidak ada baris sampel yang terisi) — cek manual kalau qty terlihat aneh atau semua baris ter-skip.',
    });
  }

  const items = [];
  let section = '';
  // BARIS YANG TIDAK TERBACA TIDAK DIBUANG LAGI -- DIA DILEMPAR KE SINI.
  //
  // Sebelum ini baris yang QTY-nya bukan angka cuma menaikkan satu penghitung
  // (`skipped`), dan yang tampil di kaki tabel cuma angkanya: "12 dilewati".
  // Yang mana, kenapa, dan apa isinya tidak pernah disebut -- jadi baris yang
  // tidak terbaca BUKAN ditolak, melainkan hilang tanpa suara, dan ordernya
  // tetap jalan dengan jumlah yang kurang. Yang menemukan kekurangannya bukan
  // portal ini, tapi gudang, waktu labelnya tidak cukup.
  //
  // Sekarang tiap baris yang tidak terbaca disimpan UTUH beserta sebabnya,
  // nomor barisnya di lembar, dan isi sel yang bikin dia gagal -- supaya yang
  // mengunggah bisa menjawab "ini merek apa" dan "ini jumlahnya berapa", lalu
  // barisnya ikut. Bukan di-skip, bukan dipesan buta: diperiksa dulu.
  const perluCek = [];
  const cekBaris = (i, row, sebab, extra = {}) => {
    perluCek.push({
      _row: i,
      baris: i + 1,                      // nomor baris seperti yang dilihat orang di Excel
      erp: String(get(row, map.erp)).trim(),
      nama: String(get(row, map.nameEn) || get(row, map.nameZh) || get(row, map.spec)).trim(),
      sebab,
      ...extra,
    });
  };

  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const first = String(row[0] ?? row[map.market] ?? '').trim().toLowerCase();

    // Section marker "newitems".
    if (first.replace(/\s/g, '') === 'newitems') { section = 'newitems'; continue; }
    if (!row.some(c => String(c ?? '').trim() !== '')) continue; // blank row

    const erp = String(get(row, map.erp)).trim();
    const qtyRaw = get(row, map.qty);
    // QTY DIPERIKSA DI SINI, TAPI BARISNYA TETAP DIURAI SAMPAI HABIS.
    //
    // Dulu di titik ini ada `continue`, jadi baris yang QTY-nya tidak terbaca
    // tidak pernah sampai ke penguraian nama, merek, dimensi dan pola. Yang
    // tersisa dari dia cuma satu angka di penghitung `skipped`. Akibatnya
    // bukan cuma orangnya tidak tahu baris mana -- tidak ada apa pun yang bisa
    // ditawarkan untuk dibetulkan, karena isinya sudah tidak ada.
    //
    // Sekarang barisnya diurai seperti baris normal, hasilnya disimpan sebagai
    // `calon` di daftar PERLU DICEK, dan yang mengunggah cuma perlu mengisi
    // jumlahnya untuk membuatnya ikut. Yang kosong jumlahnya tetap TIDAK masuk
    // daftar pesanan -- memesan label tanpa jumlah bukan pilihan.
    const qtyKosong = !NUMERIC(qtyRaw);
    const qty = qtyKosong ? null : toNum(qtyRaw);
    const qtyNol = !qtyKosong && qty <= 0;

    const nameEn = String(get(row, map.nameEn)).trim();
    const nameZh = String(get(row, map.nameZh)).trim();
    const parsed = parseItemName(nameEn || nameZh, brandMap);

    const market = kodePasar(get(row, map.market)) || kodePasar(parsed.market);
    // MEREK DISNAP KE EJAAN RESMI DI SINI, DAN YANG TIDAK DIKENALI DITANDAI.
    //
    // Dulu isi kolom merek dibawa APA ADANYA -- `brand || parsed.brand` -- jadi
    // lembar yang menulis 'GOLDENCROWN', 'SRYKER' atau 'BISEN' memasukkan ejaan
    // itu ke master item, dan satu merek jadi dua. Sekarang dia lewat
    // canonicalBrand() + ejaanResmi(), yang menerjemahkan Mandarin, menyatukan
    // beda spasi/huruf, dan membetulkan salah ketik yang terdaftar.
    //
    // Yang TIDAK bisa dikenali tidak ditebak dan tidak dibuang: barisnya tetap
    // ikut, tapi ditandai `cek` supaya layarnya menanyakannya ke yang mengunggah
    // sebelum barisnya boleh dipesan. '95H CAPITOL' dan 'TBR' di kolom merek
    // adalah bentuk kerusakan yang justru harus kelihatan, bukan dirapikan
    // diam-diam jadi merek yang kedengarannya mirip.
    const merekMentah = String(get(row, map.brand)).trim();
    const kandidatMerek = canonicalBrand(merekMentah, brandMap) || parsed.brand || '';
    const brand = ejaanResmi(kandidatMerek) || kandidatMerek;
    // Dipisah SEBELUM dipakai, bukan sesudah: begitu '254X79mm' ikut masuk
    // ke `size`, aturan "kosong tidak pernah menimpa" di label_master_panen
    // justru melindunginya dari diperbaiki.
    const sizeMentah = String(get(row, map.size)).trim();
    const sizeStokLabel = POLA_STOK_LABEL.test(sizeMentah);

    const isNew = section === 'newitems' || (erp && !knownErps.has(erp)) || !erp;

    const calon = {
      market,
      spec: String(get(row, map.spec)).trim() || parsed.spec,
      erp,
      ean: String(get(row, map.ean)).trim(),
      brand,
      ttl: String(get(row, map.ttl)).trim() || parsed.tube,
      pr: String(get(row, map.pr)).trim() || parsed.pr,
      ms: String(get(row, map.ms)).trim(),
      qty,
      unit: '张', // default unit for labels
      rr: String(get(row, map.rr)).trim(),
      wetGrip: String(get(row, map.wetGrip)).trim(),
      noise: String(get(row, map.noise)).trim(),
      nameEn: nameEn || parsed.english,
      nameZh,
      // MEDAN SPESIFIKASI LABEL. Dibawa apa adanya dari lembar order, karena
      // lembar order memang satu-satunya tempat angka-angka ini pernah
      // dituliskan — dan sampai sekarang ikut terbuang tiap kali ordernya
      // selesai. Dipanen ke master label lewat labelMasterApi.js.
      // Cadangannya diurai dari NAMA BARANG, bukan ditebak: parseItemName()
      // sudah memecah 'ID295/80R22.5-18PR(152/149M)[AS898]TRAZANO TL' jadi
      // dimensi, PR, indeks beban, pola dan merek. Kalau kolomnya kosong di
      // lembar, isinya tetap bisa didapat dari namanya sendiri.
      // size TIDAK punya cadangan dari nama barang, dan itu disengaja.
      // parseItemName() memang mengembalikan `spec`, tapi isinya potongan nama
      // apa adanya — untuk 'ID295/80R22.5-18PR(150/147M)[ECOPLUS]XBRI无内'
      // keluarannya 'ID295/80R22.5-18', yang BUKAN dimensi dan akan tercetak
      // apa adanya di label kalau dipakai. Kolom kosong lebih jujur daripada
      // dimensi yang salah bentuk: yang kosong kelihatan dan bisa dilengkapi,
      // yang salah bentuk lolos sampai ke mesin cetak.
      size: sizeStokLabel ? '' : sizeMentah,
      labelSize: sizeStokLabel ? sizeMentah : '',
      pattern: String(get(row, map.pattern)).trim() || parsed.pattern || '',
      loadSpeed: String(get(row, map.loadSpeed)).trim() || parsed.loadIndex || '',
      plyBlock: String(get(row, map.plyBlock)).trim(),
      snow: String(get(row, map.snow)).trim(),
      npb1: String(get(row, map.npb1)).trim(),
      npb3: String(get(row, map.npb3)).trim(),
      barcode: String(get(row, map.barcode)).trim(),
      sni: String(get(row, map.sni)).trim(),
      country: String(get(row, map.country)).trim(),
      noiseClass: String(get(row, map.noiseClass)).trim(),
      hasTemplate: /✅|✔|有|yes|y/i.test(String(get(row, map.template)).trim()),
      // pickup date DIBAWA APA ADANYA, tidak diurai jadi tanggal.
      //
      // Isinya di sheet 加急优先下单 adalah tulisan tangan manusia: "before 8.15",
      // "next firday" (Friday, salah ketik). Menguraikan itu jadi tanggal berarti
      // salah satu dari dua hal: gagal diam-diam, atau — lebih buruk — berhasil
      // menebak tanggal yang keliru lalu memakainya sebagai tenggat ke supplier.
      // 需求日期 di berkas ERP tetap dihitung dari prioritas + lead time.
      pickup: String(get(row, map.pickup)).trim(),
      isNew,
      section,
      _row: i,
    };

    // -----------------------------------------------------------------------
    // PEMERIKSAAN SELURUH MEDAN. Satu tempat, bukan tersebar.
    //
    // Tiga keputusan per medan, dan urutannya yang menentukan:
    //   1. Terbaca dari lembar?            -> selesai.
    //   2. Kosong tapi ERP-nya ada di master item? -> diambil dari sana, dan
    //      asalnya DICATAT di calon.dariMaster. Dicatat bukan untuk rapi-rapian:
    //      tanpa itu, nilai yang datang dari master tidak bisa dibedakan dari
    //      nilai yang benar-benar tertulis di lembar bulan ini, dan panen
    //      berikutnya akan menulisnya balik ke master sebagai "dikonfirmasi
    //      lembar" padahal tidak ada yang mengkonfirmasi apa pun.
    //   3. Master juga tidak punya?        -> DITANYAKAN. Bukan di-skip.
    const cek = [];
    const dariMaster = {};
    const mst = masterIdx.get(erp) || null;

    if (qtyKosong) cek.push('qty_tidak_terbaca');
    else if (qtyNol) cek.push('qty_nol');

    for (const m of MEDAN_PERIKSA) {
      if (m.kunci === 'qty') continue;                 // sudah ditangani di atas
      let v = String(calon[m.kunci] ?? '').trim();
      // Pasar yang bentuknya bukan kode pasar sama saja dengan tidak terbaca.
      if (m.kunci === 'market' && v && !POLA_PASAR.test(v)) v = '';
      if (!v && mst && m.master) {
        const dari = String(mst[m.master] ?? '').trim();
        if (dari) {
          calon[m.kunci] = dari;
          dariMaster[m.kunci] = dari;
          v = dari;
        }
      }
      // ERP kosong di bagian `newitems` BUKAN kerusakan: bagian itu ada justru
      // untuk barang yang belum punya kode. Menanyakannya di situ berarti
      // menanyakan sesuatu yang memang belum ada jawabannya.
      if (m.kunci === 'erp' && !v && section === 'newitems') continue;
      if (!v) { cek.push(m.kunci + '_kosong'); continue; }
      if (m.kunci === 'brand' && !merekDikenal(v)) cek.push('merek_asing');
    }

    calon.cek = cek;
    calon.dariMaster = dariMaster;

    // SATU TEMPAT YANG MEMUTUSKAN: ikut dipesan, atau ditahan dulu.
    //
    // Baris tanpa jumlah TIDAK masuk `items` -- seluruh jalur hilir (harga,
    // subtotal, susunDaftarBeli() di labelStock) menganggap qty angka, dan
    // menaruh null di sana berarti memindahkan kerusakannya ke tempat yang
    // lebih jauh dari tempat orangnya bisa membetulkannya.
    //
    // Baris yang medannya kurang tapi jumlahnya ada TETAP masuk daftar, dengan
    // `cek` yang tidak kosong. Layar unggah yang melepas centangnya kalau ada
    // sebab bertingkat 'tahan' -- jadi dia KELIHATAN di tabel, bisa disaring,
    // bisa dijawab, tapi tidak ikut terpesan diam-diam.
    const berat = cek.map(c => MEDAN_PERIKSA_BERAT[c.replace(/_(kosong|asing|tidak_terbaca|nol)$/, '')] || (c.startsWith('merek') ? 'tahan' : 'tanya'));
    const adaTahan = berat.includes('tahan');
    if (cek.length) {
      cekBaris(i, row, cek[0], {
        semuaSebab: cek,
        tahan: adaTahan,
        dariMaster,
        merekMentah: merekMentah || kandidatMerek,
        qtyMentah: String(qtyRaw ?? '').trim(),
        pasarMentah: String(get(row, map.market)).trim(),
        ikut: !(qtyKosong || qtyNol),
        calon,
      });
    }
    if (qtyKosong || qtyNol) continue;
    items.push(calon);
  }

  // `skipped` dipertahankan BENTUKNYA (kaki tabel dan labelStock.js membacanya)
  // tapi sekarang artinya tepat: baris yang benar-benar tidak masuk daftar
  // pesanan, bukan "baris yang kami lewati dan lupakan".
  const terbuang = perluCek.filter(x => !x.ikut);
  const menahan = perluCek.filter(x => x.tahan);
  return {
    ok: true,
    warnings,
    columns: map,
    items,
    perluCek,
    stats: {
      total: items.length,
      skipped: terbuang.length,
      perluCek: perluCek.length,
      menahan: menahan.length,
      newItems: items.filter(x => x.isNew).length,
      headerRow: header.idx + 1,
    },
  };
}

function get(row, col) { return col == null ? '' : (row[col] ?? ''); }
