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
  ['pr', [/^pr$/i, /ply/i]],
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

  const numericAt = col => sample.filter(r => NUMERIC(r[col])).length / sample.length;
  const declared = numericAt(map.qty);
  if (declared >= 0.6) return { map, shifted: false };

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

// Main entry. rows = array-of-arrays (SheetJS header:1). knownErps = Set of ERP codes.
export function parseLabelSheet(rows, { brandMap, knownErps = new Set() } = {}) {
  const warnings = [];
  const header = findHeaderRow(rows);
  if (header.idx < 0 || header.hits < 3) {
    return { ok: false, error: 'Header tidak terdeteksi (kolom market / ERP CODE / QTY tidak ditemukan).', warnings };
  }
  const mapAwal = pisahSpecSize(rows, header.idx, header.map, header.multi || {});
  const { map, shifted, unvalidated } = correctQty(rows, header.idx, mapAwal);
  if (shifted) {
    warnings.push({
      type: 'shifted_pr',
      msg: 'Kolom "PR" hilang di sheet ini — kolom di kanan TT/TL bergeser. Otomatis dikoreksi lewat validasi tipe QTY.',
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
  let skipped = 0;

  for (let i = header.idx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const first = String(row[0] ?? row[map.market] ?? '').trim().toLowerCase();

    // Section marker "newitems".
    if (first.replace(/\s/g, '') === 'newitems') { section = 'newitems'; continue; }
    if (!row.some(c => String(c ?? '').trim() !== '')) continue; // blank row

    const erp = String(get(row, map.erp)).trim();
    const qtyRaw = get(row, map.qty);
    // Skip rows without a numeric QTY (per spec).
    if (!NUMERIC(qtyRaw)) { skipped++; continue; }
    const qty = toNum(qtyRaw);
    if (qty <= 0) { skipped++; continue; }

    const nameEn = String(get(row, map.nameEn)).trim();
    const nameZh = String(get(row, map.nameZh)).trim();
    const parsed = parseItemName(nameEn || nameZh, brandMap);

    const market = kodePasar(get(row, map.market)) || kodePasar(parsed.market);
    const brand = String(get(row, map.brand)).trim();
    // Dipisah SEBELUM dipakai, bukan sesudah: begitu '254X79mm' ikut masuk
    // ke `size`, aturan "kosong tidak pernah menimpa" di label_master_panen
    // justru melindunginya dari diperbaiki.
    const sizeMentah = String(get(row, map.size)).trim();
    const sizeStokLabel = POLA_STOK_LABEL.test(sizeMentah);

    const isNew = section === 'newitems' || (erp && !knownErps.has(erp)) || !erp;

    items.push({
      market,
      spec: String(get(row, map.spec)).trim() || parsed.spec,
      erp,
      ean: String(get(row, map.ean)).trim(),
      brand: brand || parsed.brand,
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
    });
  }

  return {
    ok: true,
    warnings,
    columns: map,
    items,
    stats: { total: items.length, skipped, newItems: items.filter(x => x.isNew).length, headerRow: header.idx + 1 },
  };
}

function get(row, col) { return col == null ? '' : (row[col] ?? ''); }
