// Locale-aware numeric parsing for scraped document text.
//
// WHY THIS EXISTS
// ---------------
// Both bankProof.js and ppkekPdf.js used to numify with:
//     Number(String(v).replace(/[,\s]/g, '')) || 0
// which strips commas and spaces but NOT dots. Every document those two
// parsers read is Indonesian-formatted (dot = thousands, comma = decimal), so:
//     "2.862.720.000,00"  ->  Number("2.862.720.000,00")  ->  NaN  ->  0
//     "15.850,00"         ->  15.85          (kurs off by 1000x)
//     "45.362.500"        ->  0
// The `|| 0` turned every failure into a silent, plausible-looking zero.
//
// Rules here are deliberately explicit, and failure returns NaN — never 0 —
// so callers must decide what to do rather than shipping a wrong number into
// a payment record or a customs register.

// Detect which character is the DECIMAL separator.
//   both present  -> whichever appears last
//   only ','      -> thousands iff it forms strict 3-digit groups, else decimal
//   only '.'      -> thousands iff it forms strict 3-digit groups, else decimal
// The strict-group test is what disambiguates "17,000" (=17000, grouped) from
// "16,50" (=16.5, decimal) and "45.362.500" (=45362500) from "1.234567".
function decimalSepOf(s) {
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) return lastComma > lastDot ? ',' : '.';
  if (lastComma >= 0) return /^\d{1,3}(,\d{3})+$/.test(s) ? null : ',';
  if (lastDot >= 0) return /^\d{1,3}(\.\d{3})+$/.test(s) ? null : '.';
  return null;
}

/**
 * Parse a number out of scraped text.
 * @param {*} value        raw string (may carry currency words, spaces, sign)
 * @param {string} locale  'auto' (default) | 'id' | 'en'
 * @returns {number}       the value, or NaN if nothing parseable was found
 */
export function parseNumber(value, locale = 'auto') {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;

  // Keep digits, separators and a leading sign. Strips "IDR", "Rp", spaces,
  // non-breaking spaces and any stray letters the PDF text layer picked up.
  let s = String(value).replace(/[\s  ]/g, '');
  // Normalise the Unicode dashes a PDF text layer routinely emits (U+2212 MINUS
  // and friends), and accept a TRAILING sign — Indonesian bank and ERP
  // statements print "1.000-". Both used to survive the [^\d.,] strip below and
  // silently yield a POSITIVE number.
  s = s.replace(/[−‒–—―]/g, '-');
  // A trailing dash is ambiguous in Indonesian documents, and the two readings
  // are 2x apart with the sign flipped:
  //     "1.000-"      accounting negative -> -1000   (ERP / bank statements)
  //     "Rp 1.000,-"  no-cents marker     ->  1000   (invoices, quotations)
  // In "1.000,-" the dash stands in for "00" after the decimal comma; it is not
  // a sign at all. Only a dash sitting directly after a DIGIT is negative.
  const negative = /^-/.test(s) || /\d-$/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;

  let dec;
  if (locale === 'id') dec = s.includes(',') ? ',' : null;
  else if (locale === 'en') dec = s.includes('.') ? '.' : null;
  else dec = decimalSepOf(s);

  let out;
  if (dec === null) {
    out = s.replace(/[.,]/g, '');                 // pure grouping
  } else {
    const group = dec === ',' ? '.' : ',';
    out = s.split(group).join('').replace(dec, '.');
    // A second decimal separator means the string was malformed; bail loudly
    // rather than silently truncating.
    if ((out.match(/\./g) || []).length > 1) return NaN;
  }

  const n = Number(out);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/**
 * Same parse, but returns `fallback` instead of NaN. Use ONLY where a missing
 * value is genuinely harmless (an optional display field) — never for money.
 */
export function parseNumberOr(value, fallback = 0, locale = 'auto') {
  const n = parseNumber(value, locale);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * MONEY TYPED BY A HUMAN, READ ACCORDING TO ITS CURRENCY.
 *
 * WHY THIS EXISTS — 12 Aug 2026, found by Kyaru from the screen, not by a test.
 * The Add Invoice amount box called `parseNumber(v, 'id')`. Locale 'id' accepts
 * ONLY a comma as the decimal mark, so in "20126.88" the dot was read as a
 * thousands separator and thrown away:
 *
 *     parseNumber('20126.88', 'id')  ->  2012688      (x100, cents absorbed)
 *
 * The invoice was a HAICHAO commercial invoice in USD — 19,771 KG of steel cord
 * at USD 1.018/KG = USD 20,126.88 — and the currency dropdown sat directly
 * beside the box, in the same `.grid.g2`, never read. The same mistake lived in
 * the Edit PO qty and unit-price boxes, two lines above a render call that
 * already branched on `f.currency === 'USD'`.
 *
 * THE RULE. An Indonesian document is dot-grouped and comma-decimal; a Chinese,
 * Hong Kong or European supplier's invoice is comma-grouped and dot-decimal.
 * Which one applies is decided by the CURRENCY on the record, never assumed:
 *
 *     IDR            -> 'id'    ("12.500.000" must read 12500000, not 12.5)
 *     USD/CNY/EUR/…  -> 'auto'  (decimalSepOf resolves both forms correctly:
 *                                "20126.88" -> 20126.88, "20,126.88" -> 20126.88,
 *                                "154224" -> 154224)
 *
 * 'auto' rather than 'en' on purpose: 'en' forces the dot to be decimal, so a
 * foreign invoice typed the Indonesian way ("20.126,88" — which happens, the
 * people entering these are Indonesian) would come out as garbage. 'auto' reads
 * the string's own shape and gets both right.
 *
 * Returns NaN on failure — never 0. A zero that looks like a real amount is the
 * failure mode this whole module exists to prevent.
 */
export function parseMoney(value, currency) {
  const cur = String(currency == null ? '' : currency).trim().toUpperCase();
  if (cur === 'IDR') return parseNumber(value, 'id');

  // VALUTA ASING. 'auto' saja TIDAK cukup, dan ini ketahuan dari tesnya sendiri:
  // decimalSepOf('1.018') cocok dengan pola grup tiga-digit `^\d{1,3}(\.\d{3})+$`
  // lalu mengembalikan null, jadi "1.018" terbaca SERIBU DELAPAN BELAS. Untuk
  // harga satuan HAICHAO yang asli — USD 1,018 per KG — itu seribu kali lipat,
  // pada kotak Harga Satuan di Edit PO.
  //
  // Yang membereskannya: pada mata uang yang pemisah ribuannya KOMA, sebuah
  // titik tanpa koma di mana pun hanya bisa berarti desimal.
  //   ada titik, tidak ada koma  -> 'en'   "1.018"->1.018   "20126.88"->20126.88
  //   ada keduanya               -> 'auto' "20,126.88" dan "20.126,88" dua-duanya
  //                                        benar; yang terakhir muncul yang menang
  //   tidak ada titik            -> 'auto' "154224"->154224  "154,224"->154224
  //
  // Cabang 'auto' untuk kasus dua-separator itu yang membuat orang Indonesia
  // boleh mengetik invoice USD dengan cara Indonesia ("20.126,88") dan tetap
  // benar — dan mereka memang begitu, karena yang mengetik ini orang Indonesia.
  const teks = String(value == null ? '' : value);
  const adaTitik = teks.includes('.');
  const adaKoma = teks.includes(',');
  if (!(adaTitik && !adaKoma)) return parseNumber(value, 'auto');

  // Cabang titik-tanpa-koma. 'en' memaksa titik jadi desimal, jadi lebih dari
  // satu titik membuatnya NaN — dan itu persis bentuk yang ditulis orang
  // Indonesia untuk nominal besar: "1.000.000". Menolaknya berarti kotaknya
  // dikosongkan diam-diam dan invoice bernilai NOL bisa tersimpan.
  // 'auto' membacanya benar (grup tiga-digit yang ketat -> 1000000) dan tetap
  // tidak bisa merusak "1.018", karena string itu sudah selesai di 'en'.
  const en = parseNumber(value, 'en');
  return Number.isNaN(en) ? parseNumber(value, 'auto') : en;
}

/**
 * Echo untuk kotak JUMLAH (qty), bukan uang.
 *
 * Sebuah kuantitas TIDAK punya mata uang. Membaca "19.771" menurut mata uang
 * pemasoknya adalah kesalahan kategori — yang mengetik orang Indonesia, apa pun
 * yang ditagihkan pemasok. Percobaan pertama perbaikan 12 Agu 2026 memindahkan
 * kotak Qty di Edit PO ke parseMoney(), dan pada PO USD "19.771" (19.771 KG
 * steel cord HAICHAO) langsung terbaca 19,771 — seribu kali lipat, dan seribu
 * kali lipat itu lahir DARI perbaikan bugnya. Ditangkap review, bukan oleh
 * penulisnya.
 *
 * Qty tetap dibaca `parseNumber(v, 'id')`; echo-nya harus mengikuti aturan itu.
 */
export function qtyInputText(n) {
  return moneyInputText(n, 'IDR');
}

/**
 * The canonical text form of a parsed amount, for writing BACK into the box the
 * user just typed in.
 *
 * This is half the fix, and the more important half. `mount()` has no diffing
 * and no handler here re-renders, so the input keeps displaying whatever was
 * typed while the parsed value lives somewhere the user cannot see. That is how
 * a screen reading 20126.88 saved 2012688 without a single sign that anything
 * had happened — the same shape as the label-price bug, where an empty PRICE
 * cell sat beside a filled AMOUNT cell and the invisible one won into the PO.
 *
 * Deliberately UNGROUPED, dot-decimal: it is unambiguous, and it re-parses to
 * exactly itself under either locale. Grouping it would mean the echo could be
 * misread on the next blur, which is the bug wearing a different hat.
 */
export function moneyInputText(n, currency) {
  if (!Number.isFinite(n)) return '';
  // toLocaleString('en-US', useGrouping:false) — BUKAN String(n).
  // String(n) memakai notasi eksponen di luar rentang tertentu, dan parseNumber
  // membuang hurufnya: "1e-7" akan terbaca 17 pada putaran berikutnya. Bentuk
  // ini juga membereskan sampah float — String(0.1+0.2) mengembalikan
  // "0.30000000000000004" dan itu ikut tercetak ke dalam kotak orang.
  // maximumFractionDigits 6 cukup: harga satuan terkecil di sistem ini 0,0295.
  const s = n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 6 });
  // PEMISAH DESIMALNYA HARUS COCOK DENGAN ATURAN YANG AKAN MEMBACANYA LAGI.
  //
  // Versi pertama fungsi ini selalu mengembalikan bentuk titik-desimal, dan
  // TESNYA SENDIRI yang menangkap akibatnya: 1.234.567,89 rupiah dipantulkan
  // sebagai "1234567.89", lalu blur berikutnya membacanya dengan aturan 'id' —
  // titik = pemisah ribuan — dan menghasilkan 123.456.789. Seratus kali lipat.
  //
  // Jadi perbaikannya melahirkan ulang bug yang ia perbaiki, lewat pintu
  // belakangnya sendiri, persis seperti ui.lrHarga melahirkan ulang bug 1000
  // di v15.3. Kalau pantulan ini tidak bisa dibaca ulang jadi dirinya sendiri,
  // ia bukan pantulan — ia kerusakan yang tertunda satu klik.
  //
  // Tetap TANPA pemisah ribuan: yang dijamin cuma desimalnya, dan grouping cuma
  // menambah satu karakter lagi yang bisa salah dibaca putaran berikutnya.
  return String(currency == null ? '' : currency).trim().toUpperCase() === 'IDR'
    ? s.replace('.', ',')
    : s;
}
