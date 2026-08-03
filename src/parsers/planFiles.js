// Rencana produksi (排产计划) dan rencana penjualan (销售需求表).
//
// KENAPA MODUL INI ADA
// -------------------------------------------------------------------------
// Kolom "Planned Production (units)" di Label Inventory Tracker diketik ulang
// dengan tangan. Diadu ke file rencana aslinya, dua bulan berturut-turut:
//
//     Juli     — 372 dari 470 spec namanya ketemu, angka cocok persis:  4
//     Agustus  — 346 dari 509 spec namanya ketemu, angka cocok persis:  1
//
// Bukan meleset sedikit — meleset jauh dan ke segala arah. Satu contoh nyata:
//
//     ID11R22.5-14PR(144/142M)[I-48T]IRONMAN无内SMARTW
//         tracker 123  ·  rencana produksi Agustus 2000
//
// Label dihitung dari 123. Yang diproduksi 2000. Kekurangan 1877 label itu
// tidak akan ketahuan sampai barangnya berhenti di line, karena tidak ada satu
// pun angka di layar yang terlihat aneh.
//
// Jadi angka rencana tidak lagi diketik. Sona menaruh file rencananya apa
// adanya, portal yang membaca. Stok label tetap dari Excel-nya — itu memang
// datanya dia, tidak ada sumber lain.
//
// MANA YANG DIPAKAI: PRODUKSI, BUKAN PENJUALAN
// -------------------------------------------------------------------------
// Label menempel saat ban DIPRODUKSI. Produksi 2000 tapi terjual 500 tetap
// butuh 2000 label. Diperiksa di data Agustus: tidak ada satu spec pun yang
// penjualannya melebihi produksinya — produksi selalu menjadi plafon.
//
// Rencana penjualan dipakai sebagai peringatan dini: kalau permintaan jual
// naik tajam sementara rencana produksi belum menyusul, kekurangan labelnya
// bisa terlihat sebulan sebelum terjadi.

// Nama sheet berbeda tiap bulan (7月排产计划, 8月排产计划, …) jadi dicocokkan
// dengan pola, bukan daftar tetap.
const RE_PROD_SHEET  = /排产计划/;
const RE_SALES_SHEET = /销售需求/;

// Header dicari lewat teksnya, bukan nomor kolom. Diuji ke file Juli dan
// Agustus: dua-duanya menaruh header di baris 2 dengan susunan kolom yang
// sama persis — tapi menyandarkan diri ke posisi itu berarti diam-diam salah
// baca begitu ada satu kolom disisipkan.
const PROD_COLS  = { spec: '全钢规格', qty: '订单数', market: '市场', pattern: '规格花纹' };
const SALES_COLS = { spec: '产品名称' };

const HEADER_SCAN_ROWS = 8;

// Sama persis dengan skuKey di parsers/labelStock.js: spasi dibuang seluruhnya.
// Nama yang cuma beda spasi memang barang yang sama — itu sudah terbukti sekali
// di tracker (CB332 朝阳 dengan dua spasi vs tanpa spasi, satu label dua baris).
export function planKey(spec) {
  return String(spec == null ? '' : spec).replace(/\s+/g, '').toUpperCase();
}

function cellText(v) {
  return v == null ? '' : String(v).trim();
}

// Angka di file rencana kadang tersimpan sebagai teks ("1,200" / " 750 ").
// Yang tidak bisa dibaca dikembalikan null, bukan 0 — nol berarti "direncanakan
// nol", sedangkan null berarti "tidak terbaca". Dua hal yang sangat berbeda
// kalau yang dihitung adalah kebutuhan label.
function toQty(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function findHeader(rows, wanted) {
  const limit = Math.min(HEADER_SCAN_ROWS, rows.length);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(cellText);
    const idx = {};
    let hasRequired = true;
    for (const [key, label] of Object.entries(wanted)) {
      const at = cells.indexOf(label);
      if (at >= 0) idx[key] = at;
      else if (key === 'spec' || key === 'qty') hasRequired = false;
    }
    if (hasRequired && idx.spec != null) return { row: i, idx };
  }
  return null;
}

// -------------------------------------------------------------------------
// Mengenali file SEBELUM dibaca isinya.
//
// Ini yang membuat tiga kotak unggah di layar bisa menolak file yang salah
// kotak dan menyebutkan kotak mana yang benar. Menaruh file di kotak yang keliru
// adalah kesalahan yang paling mungkin terjadi, dan paling mudah dicegah.
//
// Mengembalikan DAFTAR, bukan satu jawaban. File contoh yang dikirim berisi
// rencana produksi dan rencana penjualan di satu workbook — kalau fungsi ini
// memilih salah satu sebagai pemenang, kotak yang lain akan menolak file yang
// sebenarnya benar, dan orangnya berhenti di situ tanpa tahu kenapa. Yang
// ditanya bukan "file ini jenis apa" tapi "file ini punya yang saya butuhkan
// atau tidak".
// -------------------------------------------------------------------------
export function planKinds(sheetNames) {
  const names = (sheetNames || []).map(String);
  const out = [];
  if (names.some(n => RE_PROD_SHEET.test(n)))       out.push('production');
  if (names.some(n => RE_SALES_SHEET.test(n)))      out.push('sales');
  if (names.some(n => /master\s*tracker/i.test(n))) out.push('tracker');
  return out;
}

export function fileHasKind(sheetNames, kind) {
  return planKinds(sheetNames).includes(kind);
}

// Untuk pesan penolakan: "ini file X, taruh di kotak X". Kalau file berisi
// beberapa jenis, yang disebut yang pertama — tapi jalur ini cuma tercapai
// kalau jenis yang diminta memang TIDAK ada, jadi tidak ada ambiguitas.
export function describeFile(sheetNames) {
  const k = planKinds(sheetNames);
  return k.length ? k[0] : null;
}

// Sheet mana di dalam workbook yang berisi rencananya.
export function planSheetName(sheetNames, kind) {
  const re = kind === 'sales' ? RE_SALES_SHEET : RE_PROD_SHEET;
  return (sheetNames || []).map(String).find(n => re.test(n)) || null;
}

// "8月排产计划" -> 8. Dipakai untuk memberi label periode pada unggahan, jadi
// rencana bulan lalu tidak diam-diam menimpa rencana bulan ini.
export function planMonth(sheetName) {
  const m = String(sheetName || '').match(/(\d{1,2})\s*月/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

// -------------------------------------------------------------------------
// Pembacaan.
//
// Satu spec bisa muncul beberapa baris — mesin berbeda, prioritas berbeda,
// pasar berbeda. Yang dibutuhkan label adalah TOTALNYA, jadi barisnya
// dijumlahkan. Jumlah baris asal disimpan supaya angkanya bisa ditelusuri
// balik ke file kalau ada yang mempertanyakan.
// -------------------------------------------------------------------------
function parsePlan(rows, kind) {
  const wanted = kind === 'sales'
    ? { ...SALES_COLS, qty: null }   // qty rencana penjualan ada di kolom sebelah spec
    : PROD_COLS;

  let head;
  if (kind === 'sales') {
    head = findHeader(rows, { spec: SALES_COLS.spec });
    // Sheet penjualan tidak memberi judul pada kolom jumlahnya — kolomnya
    // persis di sebelah kanan nama produk, sama di Juli maupun Agustus.
    if (head) head.idx.qty = head.idx.spec + 1;
  } else {
    head = findHeader(rows, wanted);
  }

  if (!head) {
    return {
      ok: false,
      error: kind === 'sales'
        ? { id: 'Kolom "产品名称" tidak ketemu — sheet ini sepertinya bukan rencana penjualan.',
            en: 'Column "产品名称" not found — this sheet does not look like a sales plan.',
            zh: '未找到"产品名称"列 — 此工作表似乎不是销售需求表。' }
        : { id: 'Kolom "全钢规格" / "订单数" tidak ketemu — sheet ini sepertinya bukan rencana produksi.',
            en: 'Columns "全钢规格" / "订单数" not found — this sheet does not look like a production plan.',
            zh: '未找到"全钢规格"/"订单数"列 — 此工作表似乎不是排产计划。' },
    };
  }

  const { idx } = head;
  const byKey = new Map();
  let read = 0, skippedNoSpec = 0, skippedNoQty = 0;

  for (let i = head.row + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const spec = cellText(r[idx.spec]);
    if (!spec) { skippedNoSpec++; continue; }

    const qty = toQty(r[idx.qty]);
    if (qty == null) { skippedNoQty++; continue; }

    read++;
    const key = planKey(spec);
    const prev = byKey.get(key);
    if (prev) {
      prev.qty += qty;
      prev.lines++;
    } else {
      byKey.set(key, {
        key,
        spec,                                        // apa adanya, buat ditampilkan
        qty,
        lines: 1,
        market:  idx.market  != null ? cellText(r[idx.market])  : '',
        pattern: idx.pattern != null ? cellText(r[idx.pattern]) : '',
      });
    }
  }

  const items = [...byKey.values()].sort((a, b) => b.qty - a.qty);
  return {
    ok: true,
    kind,
    items,
    stats: {
      rowsRead: read,
      specs: items.length,
      total: items.reduce((s, r) => s + r.qty, 0),
      merged: read - items.length,     // baris yang dijumlahkan ke spec yang sama
      skippedNoSpec,
      skippedNoQty,
    },
  };
}

export function parseProductionPlan(rows) { return parsePlan(rows, 'production'); }
export function parseSalesPlan(rows)      { return parsePlan(rows, 'sales'); }

// -------------------------------------------------------------------------
// Mengadu rencana ke daftar SKU label.
//
// Yang dilaporkan bukan cuma "berapa yang cocok", tapi juga volume yang JATUH
// DI LUAR tracker. Di Agustus angka itu 48% — hampir separuh produksi tidak
// punya baris label sama sekali. Persentase spec saja menyembunyikan hal ini,
// karena yang di luar tracker kebetulan item-item bervolume besar.
// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// Menimpa angka rencana ke baris-baris hasil baca Excel stok.
//
// Kolom turunan (requirement / surplus / status / suggested) DIHITUNG ULANG,
// karena kalau tidak, angka produksinya berubah sementara statusnya masih
// mengikuti angka lama — layar yang saling bertentangan dengan dirinya sendiri.
//
// SKU YANG TIDAK ADA DI RENCANA SENGAJA TIDAK DINOLKAN
// -------------------------------------------------------------------------
// Menggoda sekali: tidak ada di rencana bulan ini berarti tidak diproduksi,
// berarti labelnya nganggur, berarti IDLE STOCK. Tapi pencocokan namanya baru
// 67-75%. Dari 954 SKU tracker, 617 tidak ketemu di rencana Agustus — dan
// sebagian dari 617 itu hampir pasti diproduksi, cuma namanya beda tipis.
//
// Menandai 617 SKU sebagai nganggur berdasarkan tebakan itu artinya menyuruh
// orang berhenti memesan label untuk barang yang sedang jalan. Angkanya
// dibiarkan seperti di Excel, dan jumlahnya dilaporkan supaya kelihatan
// seberapa besar yang belum tersambung. Kalau suatu saat pencocokannya sudah
// mendekati 100%, opsi zeroUnplanned bisa dinyalakan.
// -------------------------------------------------------------------------
// PENCOCOKAN LEWAT AWALAN NAMA — LANGKAH KEDUA, DAN SELALU DILAPORKAN
// ---------------------------------------------------------------------------
// Tracker menyimpan nomor homologasi di ujung nama spec-nya; file rencana
// tidak. Nama yang sama persis sampai huruf terakhir lalu bercabang:
//
//     rencana : ID(G105003)80/90-14-4P[H-577]40P GOODRIDE 纳米高抓 TL
//     tracker : ID(G105003)80/90-14-4P[H-577]40P GOODRIDE 纳米高抓 TL E4-75R-0018686
//
// Delapan spec seperti ini, 87.200 pcs. Tanpa penanganan, semuanya jatuh ke
// daftar "tidak ada di tracker" dan orang diminta membuat baris baru untuk
// barang yang barisnya sudah ada — persis cara melahirkan SKU kembar, yang
// sudah pernah memecah stok satu label jadi dua dan bertahan berbulan-bulan.
//
// SYARATNYA KETAT: hanya diterima kalau PERSIS SATU baris tracker yang cocok.
// Dua kandidat berarti tebakan, dan tebakan pada kode ERP atau nama spec
// berarti kiriman barang lain tercatat masuk ke SKU ini — lebih buruk daripada
// tidak tersambung, karena tidak ada yang akan curiga. Diukur pada data Juli +
// Agustus: 8 pasangan, semuanya 1:1, nol yang ambigu.
//
// Hasilnya TIDAK PERNAH diam-diam: setiap pasangan dikembalikan lewat
// `viaPrefix` dan ditampilkan di layar pratinjau sebelum apa pun disimpan.
function buildMatcher(items) {
  const exact = new Map();
  for (const it of items) {
    const k = planKey(it.spec);
    if (!exact.has(k)) exact.set(k, it);
  }
  const keys = [...exact.keys()];
  return function match(key) {
    const hit = exact.get(key);
    if (hit) return { it: hit, how: 'persis' };
    const cand = keys.filter(k => k.startsWith(key) || key.startsWith(k));
    if (cand.length !== 1) return null;
    return { it: exact.get(cand[0]), how: 'awalan' };
  };
}

export function applyPlansToStock(items, prodPlan, salesPlan, opts = {}) {
  const { requirementOf, suggestedQtyOf, statusOf } = opts.calc || {};
  const moq = opts.moq || 500;
  const multiple = opts.overstockMultiple || 2;
  const zeroUnplanned = !!opts.zeroUnplanned;

  const prod  = new Map((prodPlan  && prodPlan.items  || []).map(p => [p.key, p]));
  const sales = new Map((salesPlan && salesPlan.items || []).map(p => [p.key, p]));
  const prodMatch  = buildMatcher([...prod.values()].map(p => ({ spec: p.spec, ...p })));
  const salesMatch = buildMatcher([...sales.values()].map(p => ({ spec: p.spec, ...p })));

  const changed = [], unplanned = [], viaPrefix = [];
  const dipakai = new Set();          // key rencana yang menemukan barisnya
  const out = items.map(it => {
    const k = planKey(it.spec);
    const mp = prodMatch(k);
    const ms = salesMatch(k);
    const p = mp && mp.it;
    const s = ms && ms.it;
    if (p) dipakai.add(p.key);
    if (s) dipakai.add(s.key);
    if (!p && !s) { unplanned.push(it); return it; }
    if ((mp && mp.how === 'awalan') || (ms && ms.how === 'awalan')) {
      viaPrefix.push({ tracker: it.spec, rencana: (p || s).spec });
    }

    const production = p ? p.qty : (zeroUnplanned ? 0 : it.production);
    const planSales  = s ? s.qty : it.sales;
    if (production === it.production && planSales === it.sales) return it;

    const requirement  = requirementOf(production, it.buffer);
    const surplus      = (Number(it.stock) || 0) - requirement;
    const status       = statusOf(it.stock, production, requirement, surplus, multiple);
    const suggestedQty = suggestedQtyOf(surplus, moq);

    if (p && production !== it.production) {
      changed.push({
        spec: it.spec, market: it.market,
        before: it.production, after: production, delta: production - it.production,
        statusBefore: it.status, statusAfter: status,
        lines: p.lines,
      });
    }

    return {
      ...it,
      production, sales: planSales,
      requirement, surplus, status, suggestedQty,
      // Angka rencana datang dari file rencana, bukan dari sheet stok — jadi
      // tidak ada "beda dengan Excel" yang perlu dilaporkan untuk baris ini.
      // Menyimpan hasil hitung yang sama di kedua sisi membuat spanduk kuning
      // "rumus tidak cocok" berhenti berbohong.
      mismatch: [],
      calc: { requirement, surplus, status, suggestedQty },
    };
  });

  // ARAH YANG BERBAHAYA: spec ADA DI RENCANA tapi tidak punya baris label
  // sama sekali.
  // ---------------------------------------------------------------------------
  // `unplanned` di atas adalah arah sebaliknya — SKU tracker yang tidak muncul
  // di rencana bulan ini. Itu wajar dan tidak berbahaya: labelnya cuma
  // menganggur sebulan.
  //
  // Yang ini kebalikannya, dan tidak wajar sama sekali: barang yang DIPASTIKAN
  // diproduksi, tapi tidak ada satu baris pun di tracker yang menghitung
  // labelnya. Tidak akan pernah masuk BUY NOW, karena tidak ada yang
  // mewakilinya. Diukur pada rencana Juli + Agustus: 171 spec, 559.750 pcs —
  // 48% dari seluruh volume.
  //
  // Layar yang diam soal ini menampilkan daftar belanja yang terlihat lengkap
  // padahal separuh produksinya tidak terwakili, dan itu jenis kesalahan yang
  // tidak akan ditemukan siapa pun sampai barangnya berhenti di line.
  const takAdaBarisnya = [];
  for (const [k, p] of prod)  if (!dipakai.has(k)) takAdaBarisnya.push({ spec: p.spec, qty: p.qty, dari: 'produksi' });
  for (const [k, p] of sales) if (!dipakai.has(k) && !prod.has(k)) takAdaBarisnya.push({ spec: p.spec, qty: p.qty, dari: 'penjualan' });
  takAdaBarisnya.sort((a, b) => b.qty - a.qty);
  const volTak = takAdaBarisnya.reduce((s, r) => s + r.qty, 0);
  const volProd = [...prod.values()].reduce((s, r) => s + r.qty, 0);

  changed.sort((a, b) => b.delta - a.delta);
  return {
    items: out,
    changed,
    unplanned,
    viaPrefix,
    takAdaBarisnya,
    stats: {
      viaPrefix: viaPrefix.length,
      takAdaBarisnya: takAdaBarisnya.length,
      volTakAdaBarisnya: volTak,
      pctVolTakAda: volProd ? Math.round((volTak / volProd) * 100) : 0,
      touched: changed.length,
      raised:  changed.filter(c => c.delta > 0).length,
      lowered: changed.filter(c => c.delta < 0).length,
      unplanned: unplanned.length,
      toBuyNow: changed.filter(c => c.statusAfter === 'BUY NOW' && c.statusBefore !== 'BUY NOW').length,
      leftBuyNow: changed.filter(c => c.statusBefore === 'BUY NOW' && c.statusAfter !== 'BUY NOW').length,
    },
  };
}

export function matchPlanToStock(plan, stockRows) {
  const stock = new Map();
  for (const r of stockRows || []) {
    const k = planKey(r.spec);
    if (!stock.has(k)) stock.set(k, r);
  }

  const matched = [], unmatched = [];
  for (const p of plan.items || []) {
    const s = stock.get(p.key);
    if (s) matched.push({ ...p, stock: s, wasPlanned: Number(s.plan) || 0 });
    else unmatched.push(p);
  }

  const volMatched   = matched.reduce((s, r) => s + r.qty, 0);
  const volUnmatched = unmatched.reduce((s, r) => s + r.qty, 0);
  const volAll       = volMatched + volUnmatched;

  // Selisih terhadap angka yang sekarang tertulis di tracker. Diurutkan dari
  // yang paling banyak KURANG dihitung — itu yang berisiko kehabisan label.
  const changed = matched
    .filter(r => r.qty !== r.wasPlanned)
    .map(r => ({ ...r, delta: r.qty - r.wasPlanned }))
    .sort((a, b) => b.delta - a.delta);

  return {
    matched, unmatched, changed,
    stats: {
      specsMatched:   matched.length,
      specsUnmatched: unmatched.length,
      volMatched, volUnmatched, volAll,
      pctVolUnmatched: volAll ? Math.round((volUnmatched / volAll) * 100) : 0,
      same:      matched.length - changed.length,
      raised:    changed.filter(r => r.delta > 0).length,
      lowered:   changed.filter(r => r.delta < 0).length,
    },
  };
}
