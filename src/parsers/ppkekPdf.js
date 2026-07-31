// Rule-based parser for the PPKEK (customs) PDF (text-based).
// Extracts: Nopen, PPKEK no/date, ETA, supplier+address, invoice/PL no, item lines
// (code/name/qty/unit/price/amount), kurs NDPBM, valuta, USD & IDR values,
// incoterm, pungutan negara, ASAL PEMASUKAN (LDP / TLDDP -> auto-tab).

import { extractPdf } from './pdf.js';
import { parseNumber } from './numbers.js';

export async function parsePpkekPdf(file) {
  const pdf = await extractPdf(file);
  const text = pdf.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const out = {
    ok: !pdf.isScanned,
    scanned: pdf.isScanned,
    nopen: '',
    ppkekNo: '',
    ppkekDate: '',
    eta: '',
    supplier: '',
    address: '',
    invoiceNo: '',
    plNo: '',
    contractNo: '',
    kursNDPBM: 0,
    valuta: 'USD',
    valueForeign: 0,
    valueIDR: 0,
    incoterm: '',
    pungutan: 0,
    asal: 'LDP',       // LDP or TLDDP -> which register tab
    items: [],
    raw: text,
  };

  const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };

  out.nopen = grab(/Nomor Pendaftaran[^\d]*([\d\-]+)/i) || grab(/Nopen[^\d]*([\d\-]+)/i);
  // "NOMOR PENGAJUAN : 201039B6864D93107202600996" — the PPKEK No. column in the
  // register workbook. Parsed all along, just never captured.
  out.ppkekNo = grab(/Nomor\s*Pengajuan[^\w]*([A-Z0-9]{12,})/i) || '';
  // "d. Perkiraan Tanggal Tiba : 31-07-2026"
  out.eta = grab(/Perkiraan\s*Tanggal\s*Tiba[^\d]*(\d{2}-\d{2}-\d{4})/i) || out.eta;
  // FALLBACKS ONLY — the anchored "Nomor Pengajuan" match above is the real one
  // and must not be overwritten by these. This line used to be an unconditional
  // assignment placed AFTER it, so the working value was thrown away every time:
  // the first pattern matches the words "PPKEK PEMASUKAN" in the page title and
  // captures whatever follows.
  if (!out.ppkekNo) out.ppkekNo = grab(/\b(2010\d{3}[A-Z0-9]{10,})/) || '';
  out.ppkekDate = grab(/Tanggal[^\n]*?(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/);
  // Same trap: unconditional, and placed after the anchored match. On a form
  // that spells it "Perkiraan Tanggal Tiba" and never uses the word ETA, this
  // reliably replaced a correct date with an empty string.
  if (!out.eta) out.eta = grab(/ETA[^\d\n]*(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/i) || '';
  out.contractNo = grab(/(?:Contract|合同号|No\. Kontrak)[^\n]*?(CGDD\d{8,}|[A-Z]{2,}-?\d{4,}[A-Z0-9\-]*)/i);
  out.invoiceNo = grab(/Invoice[^\n]*?[:：]?\s*([A-Z0-9\/\-]+)/i);
  out.plNo = grab(/(?:Packing List|PL No)[^\n]*?[:：]?\s*([A-Z0-9\/\-]+)/i);

  // Supplier: often after "Pemasok" / "Supplier" / "Penjual".
  out.supplier = grab(/(?:Pemasok|Supplier|Penjual|Seller)[^\n:：]*[:：]?\s*([A-Z][A-Za-z0-9 .,&()\-]{3,})/);
  out.address = grab(/(?:Alamat|Address)[^\n:：]*[:：]?\s*([^\n]{6,})/i);

  // Kurs NDPBM
  const kurs = text.match(/NDPBM[^\d]*([\d.,]+)/i) || text.match(/Kurs[^\d]*([\d.,]+)/i);
  if (kurs) out.kursNDPBM = toNum(kurs[1]);

  // ---------------------------------------------------------------------------
  // CURRENCY — read from the form's own field, not guessed from the page.
  //
  // This used to be a bare scan for the first currency word anywhere in the
  // document, against a fixed list of six. Two things wrong with it, and both
  // showed up on nopen 010177 and 010242 (Hangzhou Zhongce, priced in CNY):
  //
  //   * the LIST. A currency not on it silently fell back to 'USD'.
  //   * the SCAN. The goods table's column header is printed "Amount (CIF USD)"
  //     on the blank template regardless of what the shipment is actually
  //     denominated in, so a loose search can find a currency the document does
  //     not use.
  //
  // The form states it outright, on its own line, in section K:
  //     2. Valuta : USD
  // Anchored there, any three-letter code works — CNY, EUR, JPY, KRW, THB, or
  // one nobody has invoiced in yet. Nothing to add to a list next time.
  const val = text.match(/\bValuta\s*[:：]\s*([A-Z]{3})\b/i);
  if (val) out.valuta = val[1].toUpperCase();

  // Foreign & IDR values (CIF).
  // ANCHORED TO THE FULL LABEL, on purpose.
  //
  // These used to be /CIF[^\d]*([\d.,]+)/ and /Nilai\s*(?:Pabean|IDR)[^\d]*([\d.,]+)/.
  // `[^\d]*` crosses newlines, so both walked from a label that carries NO
  // number of its own to whatever digit appeared next anywhere in the document:
  //
  //     1. Inconterm : CIF          <- regex matched "CIF" here...
  //     1. Pemenuhan Persyaratan    <- ...and captured this "1"
  //
  // Nilai Pabean came out as 1 and USD as 1 on every real document. Nothing
  // errored — the register just showed IDR 1 next to a genuine nopen and date,
  // which reads as "cheap shipment", not as "parser failure".
  //
  // The customs form always spells these two out in full, with the currency in
  // the label itself:
  //     7. Nilai Pabean - USD : 21.600,00
  //     8. Nilai Pabean - IDR : 387.439.200,00
  // so the currency is matched as part of the label and the number has to sit
  // on the same side of it. [^\d\n]* (no newline) keeps the match on one line.
  // The currency in the label was HARDCODED to USD here, which is why a CNY
  // shipment landed in the register with an empty foreign value and a correct
  // IDR one: the IDR line matched (that label is always "IDR"), the other never
  // could. Read every "Nilai Pabean - <CCY>" line instead and key them by the
  // code the form printed.
  const pabean = {};
  for (const m of text.matchAll(/Nilai\s*Pabean\s*[-–]?\s*([A-Z]{3})\s*[:：][^\d\n]*([\d.,]+)/gi)) {
    pabean[m[1].toUpperCase()] = toNum(m[2]);
  }
  if (pabean.IDR) out.valueIDR = pabean.IDR;

  // The foreign figure is the one in the document's own valuta. An IDR-
  // denominated document (domestic TLDDP) has no separate foreign line, so the
  // two are the same number rather than a blank column.
  if (out.valuta && pabean[out.valuta] != null) {
    out.valueForeign = pabean[out.valuta];
  } else {
    // Valuta unreadable: take whichever Nilai Pabean line is not IDR, and let
    // the document tell us its currency after all.
    const other = Object.keys(pabean).find(c => c !== 'IDR');
    if (other) { out.valueForeign = pabean[other]; out.valuta = other; }
  }
  if (!out.valueForeign) {
    // Fallback: FOB line, same shape, same generalisation.
    //     4. Nilai - FOB USD : 21,600
    const fob = text.match(/Nilai\s*[-–]?\s*FOB\s*([A-Z]{3})[^\d\n]*([\d.,]+)/i);
    if (fob) { out.valueForeign = toNum(fob[2]); if (!val) out.valuta = fob[1].toUpperCase(); }
  }
  // Derived only as a last resort, and it must agree with the printed figure
  // when both exist — see the invariant check in the test harness.
  if (!out.valueIDR && out.valueForeign && out.kursNDPBM) out.valueIDR = Math.round(out.valueForeign * out.kursNDPBM);

  // Incoterm
  const inco = text.match(/\b(FOB|CIF|CFR|EXW|DDP|FCA)\b/);
  if (inco) out.incoterm = inco[1];

  // Pungutan negara (duties)
  const pn = text.match(/(?:Pungutan|Bea Masuk|Total Pungutan)[^\d]*([\d.,]+)/i);
  if (pn) out.pungutan = toNum(pn[1]);

  // ASAL PEMASUKAN -> LDP / TLDDP
  if (/TLDDP/i.test(text)) out.asal = 'TLDDP';
  else if (/LDP|Luar Daerah Pabean/i.test(text)) out.asal = 'LDP';

  out.items = parseGoods(pdf);

  return out;
}

// =============================================================================
// M. DATA BARANG — read as a TABLE, using where the text sits on the page.
//
// The old rule scanned FLATTENED lines for anything that looked like a code:
//
//     const ERP = /^(MTI-[\w-]+|\d{6,}[A-Za-z]{0,3})\b/;
//     for (const l of lines) { if (l.match(ERP)) out.items.push(...) }
//
// A flattened line is a horizontal slice across EVERY column of the goods
// table, and this form wraps a single item across three or four of them, with
// values cut mid-string. One item therefore produced up to seven "items", each
// holding a different fragment — which is exactly what the export showed:
//
//     Item Code: 73121020 | 010205 | MTI-I-S | 010205814ID | 38121000
//
// Those are, in order: an HS code, the NOPEN, and three slices of one item
// code. Five rows, one real item, and not one of them right.
//
// What the page actually holds for a single item (x in brackets):
//
//     y=288  [58]3404909  [93]RUBBER ANTIOZONE WAX  [189]MTI-I-S-  [323]21.600,
//     y=287  [43]1        [222]12.0000  [253]1800.0000  [292]TNE
//     y=281  [58]0        [93]OZOACE-0013           [189]0102069   [323]00
//     y=274                                         [189]17ID
//
// Read down each COLUMN instead of across each line and it resolves:
//     Kode HS   34049090
//     Uraian    RUBBER ANTIOZONE WAX OZOACE-0013
//     Kode      MTI-I-S-010206917ID
//     Amount    21.600,00
//
// Same reconstruction the INCLUSION PO fix needed, for the same reason.
// =============================================================================

// Header cell -> field. The x of each header cell gives the column its anchor.
const GOODS_COLUMNS = [
  ['No', 'no'], ['Kode HS', 'hs'], ['Uraian Barang', 'name'], ['Kode', 'code'],
  ['Jumlah', 'qty'], ['Harga', 'price'], ['Satuan', 'unit'], ['Amount', 'amount'],
  ['Nilai Pabean', 'customs'], ['Negara', 'country'], ['Jenis Bayar', 'payType'],
  ['Ref Dok', 'refDoc'], ['Tanggal', 'refDate'],
];

// Where the goods block stops. Everything below this is a different section.
const GOODS_END = /^\s*(?:N\.|O\.|P\.)\s|PUNGUTAN NEGARA|PENERIMAAN NEGARA/i;

function parseGoods(pdf) {
  const items = [];
  for (const page of (pdf.pages || [])) {
    const lines = page.lines || [];
    // The header row carries every column label on ONE line — that is what
    // makes it identifiable, and its part positions are the column anchors.
    const hIdx = lines.findIndex(l => {
      const t = (l.parts || []).map(p => p.str).join(' ');
      return /Kode\s*HS/i.test(t) && /Uraian\s*Barang/i.test(t) && /Jumlah/i.test(t);
    });
    if (hIdx < 0) continue;

    const anchors = [];
    for (const [label, key] of GOODS_COLUMNS) {
      const part = (lines[hIdx].parts || []).find(p => p.str.trim() === label);
      if (part) anchors.push({ key, x: part.x });
    }
    if (anchors.length < 5) continue;   // not the table we think it is

    // Nearest anchor wins. Data does not sit flush under its header — the
    // Uraian column's text starts 26pt LEFT of its label while Kode starts 6pt
    // left of its own — so a "which band contains x" test puts the description
    // in the HS column. Nearest-anchor gets all thirteen right on the sample.
    const columnOf = (x) => {
      let best = null, bestD = Infinity;
      for (const a of anchors) { const d = Math.abs(a.x - x); if (d < bestD) { bestD = d; best = a.key; } }
      return best;
    };

    // Collect the block, stopping at the next lettered section.
    const block = [];
    for (let i = hIdx + 1; i < lines.length; i++) {
      const t = (lines[i].parts || []).map(p => p.str).join(' ');
      if (GOODS_END.test(t)) break;
      if ((lines[i].parts || []).some(p => p.str.trim())) block.push(lines[i]);
    }
    if (!block.length) continue;

    // Record boundaries: the "No" column counts 1, 2, 3… and is the only place
    // a bare small integer appears. It sits on the SECOND line of its record,
    // so a record runs from one line above its own marker down to one line
    // above the next marker.
    const markers = [];
    block.forEach((l, i) => {
      for (const p of (l.parts || [])) {
        const v = p.str.trim();
        if (/^\d{1,3}$/.test(v) && columnOf(p.x) === 'no') markers.push({ i, n: Number(v) });
      }
    });
    if (!markers.length) continue;

    markers.forEach((m, k) => {
      const from = k === 0 ? 0 : Math.max(markers[k - 1].i + 1, m.i - 1);
      const to = k < markers.length - 1 ? markers[k + 1].i - 2 : block.length - 1;
      const cell = {};
      for (let i = from; i <= to && i < block.length; i++) {
        for (const p of (block[i].parts || [])) {
          const v = p.str.trim();
          if (!v) continue;
          const key = columnOf(p.x);
          if (!key || key === 'no') continue;
          // Fragments of the SAME cell are joined with nothing — they are one
          // value cut in half by the page ("3404909" + "0"). Only the
          // description is genuinely multi-word, and its parts are separate
          // strings on separate lines, so it gets a space.
          cell[key] = cell[key] == null ? v : (key === 'name' ? `${cell[key]} ${v}` : cell[key] + v);
        }
      }
      const it = {
        no: m.n,
        code: (cell.code || '').trim(),
        hs: (cell.hs || '').trim(),
        name: (cell.name || '').replace(/\s+/g, ' ').trim(),
        qty: parseNumber(cell.qty || '') || 0,
        unit: (cell.unit || '').trim(),
        price: parseNumber(cell.price || '') || 0,
        amount: parseNumber(cell.amount || '') || 0,
        country: (cell.country || '').replace(/\s*-\s*/g, ' ').trim(),
      };
      // A record with neither a code nor a description is a stray line, not a
      // good. Dropping it is safer than exporting an empty row that looks like
      // a real one.
      if (it.code || it.name) items.push(it);
    });
  }
  return items;
}

// PPKEK is a Bea Cukai (Indonesian customs) form — every monetary field and
// the NDPBM rate use dot-grouping with a comma decimal ("15.850,00",
// "45.362.500"). The old helper stripped commas but not dots, so the kurs came
// out as 15.85 and Nilai Pabean as 0, and those values are written straight
// into the register row (screens/ppkek.js). Locale is pinned to 'id' — this
// document is never English-formatted.
//
// Returns 0 for an unreadable value ONLY because these fields are all
// operator-editable in the register UI before save; a NaN would render as
// "NaN" in an input box. The zero is now a genuine "not found", not a parse
// failure masquerading as a number.
function toNum(v) {
  const n = parseNumber(v, 'id');
  return Number.isFinite(n) ? n : 0;
}


// ---------------------------------------------------------------------------
// SPPB — where the supplier name actually lives.
//
// The PPKEK form prints "Eksportir LN/Penjual" and "Pemasok" as two ADJACENT
// COLUMNS of a three-column block. Flattened to text that becomes:
//
//     2. Eksportir LN/Penjual        3. Pemasok        <- column HEADINGS
//     c. Nama : NIPPON SEIRO (THAILAND)  c. Nama :
//     CO., LTD. LTD.
//
// so any regex anchored on the word "Penjual" or "Pemasok" walks straight into
// the neighbouring HEADING and captures the literal word "Pemasok". That is what
// every row in the register says today. The real name is on the next line and
// split across two.
//
// The SPPB in the same bundle prints the same party in a plain single column:
//
//     2. PENGIRIM BARANG
//     b. Nama   : NIPPON SEIRO (THAILAND) CO., LTD.
//     c. Alamat : NO.700/15 MOO 7 TAMBON KHAOKHANSONG AMPHUR SRIRACHA...
//
// One label, one value, one line. Reading it from here instead of fighting the
// three-column form is not a workaround — it is the better source.
//
// Returns {} when the file isn't an SPPB or the block is missing, so the caller
// simply keeps whatever the PPKEK parse produced.
// ---------------------------------------------------------------------------
export async function parseSppbPdf(file) {
  let text = '';
  try {
    const pdf = await extractPdf(file);
    if (pdf.isScanned) return {};
    text = pdf.text || '';
  } catch (e) {
    console.warn('SPPB parse failed (non-fatal):', e);
    return {};
  }
  if (!/SURAT\s+PERSETUJUAN\s+PENGELUARAN\s+BARANG|SPPB/i.test(text)) return {};

  // Scoped to the PENGIRIM BARANG block: the same document also carries
  // PENERIMA BARANG (that is MTI itself), and matching "b. Nama" globally would
  // pick whichever came first.
  const block = text.split(/PENGIRIM\s+BARANG/i)[1];
  if (!block) return {};
  const stop = block.split(/PENERIMA\s+BARANG/i)[0];

  const out = {};
  const nama = stop.match(/b\.\s*Nama[^:：]*[:：]\s*([^\n]+)/i);
  if (nama) {
    const v = nama[1].trim();
    // "-" is how the form prints an empty field; never store it as a name.
    if (v && v !== '-') out.supplier = v;
  }
  const alamat = stop.match(/c\.\s*Alamat[^:：]*[:：]\s*([^\n]+)/i);
  if (alamat) {
    const v = alamat[1].trim();
    if (v && v !== '-') out.address = v;
  }
  return out;
}
