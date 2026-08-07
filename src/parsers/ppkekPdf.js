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
    // Every supporting document the form declares, one entry each:
    //   { jenis, no, tanggal }
    // invoiceNo / contractNo / plNo below are SUMMARIES derived from this, kept
    // so the register columns and the Excel export keep working unchanged.
    docs: [],
    raw: text,
  };

  const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };

  // ---------------------------------------------------------------------------
  // WHICH FORM IS THIS. Read FIRST, because it is no longer just a tab selector.
  //
  // LDP and TLDDP are not two layouts of one form — they are two DIFFERENT
  // FORMS, and the section letters do not line up:
  //
  //                        LDP                          TLDDP
  //   parties        G. DATA PEMBERITAHUAN         F. DATA
  //   counterparty   2. Eksportir LN/Penjual       2. Pengirim
  //                  3. Pemasok                    (none)
  //   value          K. 7/8. Nilai Pabean USD/IDR  J. 1. Harga Penyerahan
  //                  K. 2. Valuta, 3. NDPBM        (neither exists)
  //   goods          M. DATA BARANG                K. DATA BARANG
  //
  // Everything below has to know which form it is reading before it reads it.
  // ---------------------------------------------------------------------------
  if (/TLDDP/i.test(text)) out.asal = 'TLDDP';
  else if (/LDP|Luar Daerah Pabean/i.test(text)) out.asal = 'LDP';

  // The LEMBAR LANJUTAN sheet. Read early because it supersedes several of the
  // flat-text matches below — see parseLanjutan().
  const lanjutan = parseLanjutan(pdf);
  out.docs = lanjutan.docs;

  // `[^\d]*` used to cross newlines here, exactly like the CIF/Nilai Pabean trap
  // documented further down: "NOMOR PENDAFTARAN" carries no digit of its own on
  // some layouts, so the match walked to whatever number appeared next anywhere
  // in the document and captured a section number. `[^\d\n]` keeps it on the
  // line the label is printed on.
  out.nopen = lanjutan.nopen
    || grab(/Nomor Pendaftaran[^\d\n]*([\d\-]+)/i) || grab(/Nopen[^\d\n]*([\d\-]+)/i);
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

  // ---------------------------------------------------------------------------
  // PPKEK DATE — the REGISTRATION date, and it must never be the ETA.
  //
  // The old pattern was /Tanggal[^\n]*?(<date>)/ against the whole flattened
  // document: unanchored, first-match-wins, and the words "Perkiraan Tanggal
  // Tiba" contain "Tanggal". On every LDP bundle tested it therefore returned
  // the ETA, and the register showed two identical date columns — which reads
  // as "arrived the day it was registered", not as a parser failure.
  //
  // Order of preference, most reliable first:
  //   1. LEMBAR LANJUTAN "4. TANGGAL PENDAFTARAN : 02-06-2026" — its own field,
  //      on its own line, in a single-column sheet.
  //   2. Page 1 line A: "3. NOMOR PENDAFTARAN :031951 TANGGAL:07-08-2026",
  //      anchored to NOMOR PENDAFTARAN so it cannot drift to another Tanggal.
  //   3. Any "Tanggal" + date on ONE line that is not the ETA line.
  // ---------------------------------------------------------------------------
  out.ppkekDate = lanjutan.tglDaftar
    || grab(/Nomor\s*Pendaftaran[^\n]*?Tanggal\s*[:：]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i)
    || grabDateNotEta(text);
  // Same trap: unconditional, and placed after the anchored match. On a form
  // that spells it "Perkiraan Tanggal Tiba" and never uses the word ETA, this
  // reliably replaced a correct date with an empty string.
  if (!out.eta) out.eta = grab(/ETA[^\d\n]*(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/i) || '';

  // ---------------------------------------------------------------------------
  // INVOICE / CONTRACT / PACKING LIST — from the declared document list.
  //
  // The old patterns searched the whole flattened document for the WORD
  // "Invoice" and took the next run of [A-Z0-9/-]. A date is nothing but digits
  // and hyphens, so "Invoice 412/INV/BCL/0 06-08-2026" — the wrapped cell in
  // section G/H of page 1 — yielded "06-08-2026". The register carried a date
  // in its Invoice No. column and nothing looked wrong.
  //
  // And "Contract" / "No. Kontrak" / "合同号" are words this form NEVER PRINTS,
  // so contractNo could only ever be empty. The contract is declared as a
  // "Purchase Order/Kontrak Pengadaan/Surat Penunjukan Importir" row.
  //
  // One PPKEK legitimately declares many of each — the BCL bundle declares one
  // invoice, one surat jalan and FIVE purchase orders. out.docs keeps them all;
  // these three fields stay as summaries so nothing downstream has to change.
  // ---------------------------------------------------------------------------
  const docNos = (re) => out.docs.filter(d => re.test(d.jenis)).map(d => d.no).filter(Boolean);
  const invNos = docNos(/invoice|faktur/i);
  const conNos = docNos(/kontrak|contract|purchase\s*order|penunjukan/i);
  const plNos = docNos(/packing\s*list/i);

  out.invoiceNo = invNos.join('; ')
    || grab(/Invoice[^\n]*?[:：]?\s*([A-Z][A-Z0-9\/\-]{3,})/i);
  out.contractNo = summarise(conNos)
    || grab(/(?:Contract|合同号|No\. Kontrak)[^\n]*?(CGDD\d{8,}|[A-Z]{2,}-?\d{4,}[A-Z0-9\-]*)/i);
  out.plNo = plNos.join('; ')
    || grab(/(?:Packing List|PL No)[^\n]*?[:：]?\s*([A-Z][A-Z0-9\/\-]{3,})/i);

  // ---------------------------------------------------------------------------
  // SUPPLIER + ADDRESS — read as a COLUMN of the party block, by position.
  //
  // The old pair were flat-text regexes against a THREE-COLUMN block, and the
  // comment on parseSppbPdf() below already described what that does: anchored
  // on "Penjual" it walks into the neighbouring column HEADING and captures the
  // literal word "Pemasok". Verified still true on LDP nopen 007076.
  //
  // The address was worse. /(?:Alamat|Address)[^\n:：]*[:：]?\s*([^\n]{6,})/
  // is unanchored, so it took the FIRST "Alamat" in the document — and the
  // first party on every form is section 1, MATAHARI TIRE INDONESIA. Every
  // register row carried MTI's own address as the supplier's.
  //
  // parseParty() reads the correct column instead. Which column that is depends
  // on the form: LDP "2. Eksportir LN/Penjual" (the SELLER — the party MTI
  // bought from), TLDDP "2. Pengirim".
  // ---------------------------------------------------------------------------
  const party = parseParty(pdf, out.asal);
  out.supplier = party.supplier || '';
  out.address = party.address || '';

  // Kurs NDPBM. `[^\d]*` crossed newlines; a TLDDP form has no NDPBM and no
  // Kurs field at all, so the loose fallback wandered off the label entirely.
  const kurs = text.match(/NDPBM[^\d\n]*([\d.,]+)/i) || text.match(/\bKurs\b[^\d\n]*([\d.,]+)/i);
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
    // ENGLISH number format, unlike every other figure on this form. The FOB,
    // freight and insurance lines print "472,500" and "397,261.44" while Nilai
    // Pabean two lines below prints "498.605,63". Reading the FOB with
    // Indonesian rules turns 472,500 into 472.5 — a value 1000x too small that
    // still looks like a number, so nothing would have flagged it.
    if (fob) { out.valueForeign = toNumAuto(fob[2]); if (!val) out.valuta = fob[1].toUpperCase(); }
  }
  // Derived only as a last resort, and it must agree with the printed figure
  // when both exist — see the invariant check in the test harness.
  if (!out.valueIDR && out.valueForeign && out.kursNDPBM) out.valueIDR = Math.round(out.valueForeign * out.kursNDPBM);

  // ---------------------------------------------------------------------------
  // TLDDP VALUE — a different field, on a different form, in a different
  // currency, and the parser had no idea it existed.
  //
  // A TLDDP form has no "Nilai Pabean - USD", no "Nilai Pabean - IDR", no
  // "Valuta" and no "NDPBM". Every one of the matches above therefore found
  // nothing, and the register stored 0 / 0 / USD for a domestic rupiah purchase.
  // Two shipments verified: 92.361.600 and 3.986.337.600, both landing as zero.
  //
  // The value it does print is section J:  "1. Harga Penyerahan :92.361.600"
  //
  // A domestic delivery is denominated in rupiah by definition — there is no
  // foreign leg — so foreign and IDR are the same number rather than a blank
  // column, and the currency is IDR unless the form says otherwise. Guarded on
  // `!val` so a TLDDP that ever does print a Valuta keeps what it printed.
  // ---------------------------------------------------------------------------
  if (out.asal === 'TLDDP' && !out.valueIDR) {
    const hp = text.match(/Harga\s*Penyerahan[^\d\n]*([\d.,]+)/i);
    if (hp) {
      out.valueIDR = toNum(hp[1]);
      if (!out.valueForeign) out.valueForeign = out.valueIDR;
      if (!val) out.valuta = 'IDR';
    }
  }

  // ---------------------------------------------------------------------------
  // INCOTERM — anchored to its own label.
  //
  // A bare /\b(FOB|CIF|...)\b/ scan of the whole page returned "CIF" for a TRUCK
  // delivery from Kudus to Kendal, because the blank goods-table header prints
  // the column title "Amount (CIF USD)" whether or not the shipment has an
  // incoterm at all. An incoterm on a domestic road movement is not a small
  // cosmetic error — it is the parser inventing an international shipping term.
  // ---------------------------------------------------------------------------
  const inco = text.match(/Incont?erm[^A-Z\n]*\b(FOB|CIF|CFR|CNF|EXW|DDP|DAP|FCA|FAS|CIP|CPT)\b/i);
  if (inco) out.incoterm = inco[1].toUpperCase();

  // Pungutan negara — the TOTAL row of the duties table.
  //
  // `[^\d]*` crossed newlines again: the heading "PUNGUTAN NEGARA" carries no
  // number, so the match ran on to the "1" of the row numbering below it and
  // every document in the register recorded duties of 1 or 2 rupiah.
  //
  // The table is numbered, and its last row is the total:
  //     4 Total 438,498,000 0 0 0 0 0
  // Read that row's first figure. Note this table prints ENGLISH grouping
  // ("438,498,000") while Nilai Pabean on the same page prints Indonesian
  // ("1.033.815.433,98"), so it needs the 'auto' reader — the same split the
  // FOB line needed.
  const pn = text.match(/^\s*\d+\s+Total\s+([\d.,]+)/im)
    || text.match(/Total\s*Pungutan[^\d\n]*([\d.,]+)/i);
  if (pn) out.pungutan = toNumAuto(pn[1]);

  out.items = parseGoods(pdf);

  return out;
}

// A single register cell cannot show five contract numbers without becoming
// unreadable, and truncating to the first silently hides that there are more.
// The count is the honest middle: it says "there is more here" in the width of
// four characters, and out.docs carries the full list for anyone who needs it.
function summarise(list) {
  if (!list.length) return '';
  return list.length === 1 ? list[0] : `${list[0]} (+${list.length - 1})`;
}

// Any "Tanggal" + date sitting on ONE line, skipping the ETA line. Last resort
// only: both anchored patterns are tried before this.
function grabDateNotEta(text) {
  for (const line of text.split('\n')) {
    if (/Perkiraan\s*Tanggal\s*Tiba/i.test(line)) continue;
    const m = line.match(/Tanggal[^\n]*?(\d{1,2}[-\/ ][A-Za-z0-9]{2,}[-\/ ]\d{2,4})/i);
    if (m) return m[1].trim();
  }
  return '';
}

// =============================================================================
// LEMBAR LANJUTAN DOKUMEN PELENGKAP PABEAN — the clean sheet nobody was reading.
//
// Page 1 crams the supporting documents into section G/H as a three-column
// block with wrapped cells, which is why every flat-text match against it
// failed or picked up a date. Page 2 of the SAME PDF prints them as a plain
// numbered table:
//
//     No.  Jenis Dokumen                     Nomor Dokumen             Tanggal
//     1    Invoice                           412/INV/BCL/08/2026    06-08-2026
//     2    Purchase Order/Kontrak Pengadaan  WESTLAKE-BCL-SNI-0907  10-07-2026
//     3    Surat Jalan                       412/SJ/BCL/08/2026     06-08-2026
//     ...
//
// plus "3. NOMOR PENDAFTARAN" and "4. TANGGAL PENDAFTARAN" as their own labelled
// fields. FIVE of the broken columns are answered by this one sheet: nopen,
// PPKEK date, invoice no, contract no, packing list no.
//
// It also answers "one PPKEK can carry six invoices" for free — the table has as
// many rows as the shipment has documents, so nothing here counts to one.
//
// Read by POSITION, like the goods table, because the Jenis cell wraps onto the
// lines above and below its own row and a flattened read splits one record into
// three. The No. column is the record marker: it is the only cell on the sheet
// that ever holds a bare 1-3 digit integer.
// =============================================================================
const LANJUTAN_MARK = /LEMBAR\s+LANJUTAN\s+DOKUMEN\s+PELENGKAP\s+PABEAN/i;
const LANJUTAN_COLS = [['No.', 'no'], ['Jenis Dokumen', 'jenis'], ['Nomor Dokumen', 'nomor'], ['Tanggal Dokumen', 'tanggal']];

function parseLanjutan(pdf) {
  const out = { nopen: '', tglDaftar: '', docs: [] };
  const seen = new Set();

  for (const page of (pdf.pages || [])) {
    const lines = page.lines || [];
    const flat = lines.map(l => l.str).join('\n');
    if (!LANJUTAN_MARK.test(flat)) continue;

    // Single column, one label per line — a plain anchored read is correct here
    // and there is nothing for it to drift into.
    if (!out.nopen) {
      const m = flat.match(/Nomor\s*Pendaftaran[^\d\n]*([\d\-]+)/i);
      if (m) out.nopen = m[1].trim();
    }
    if (!out.tglDaftar) {
      const m = flat.match(/Tanggal\s*Pendaftaran[^\d\n]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
      if (m) out.tglDaftar = m[1].trim();
    }

    const hIdx = lines.findIndex(l => {
      const t = (l.parts || []).map(p => p.str).join(' ');
      return /Nomor\s*Dokumen/i.test(t) && /Tanggal\s*Dokumen/i.test(t);
    });
    if (hIdx < 0) continue;

    const anchor = {};
    for (const [label, key] of LANJUTAN_COLS) {
      const p = (lines[hIdx].parts || []).find(q => q.str.trim() === label);
      if (p) anchor[key] = p.x;
    }
    if (anchor.nomor == null || anchor.tanggal == null) continue;

    const isRecordNo = (v, x) => /^\d{1,3}$/.test(v) && anchor.no != null && Math.abs(x - anchor.no) < 20;

    const body = lines.slice(hIdx + 1);
    const marks = [];
    for (const l of body) {
      for (const p of (l.parts || [])) {
        if (isRecordNo(p.str.trim(), p.x)) marks.push({ y: l.y, n: Number(p.str.trim()) });
      }
    }
    if (!marks.length) continue;
    marks.sort((a, b) => b.y - a.y);
    // Midpoints between neighbouring records, not a fixed window: the Jenis cell
    // wraps two lines up and one line down on the Purchase Order rows and only
    // one line on the Invoice rows, so no single window fits both.
    marks.forEach((m, i) => {
      m.hi = i === 0 ? (lines[hIdx].y + m.y) / 2 : (marks[i - 1].y + m.y) / 2;
      m.lo = i === marks.length - 1 ? m.y - 40 : (marks[i + 1].y + m.y) / 2;
    });

    for (const m of marks) {
      const cell = { jenis: '', nomor: '', tanggal: '' };
      for (const l of body) {
        if (!(l.y > m.lo && l.y <= m.hi)) continue;
        for (const p of (l.parts || [])) {
          const v = p.str.trim();
          // The lone ":" separators and the empty spacer parts carry nothing.
          if (!v || /^[:：|]+$/.test(v)) continue;
          if (isRecordNo(v, p.x)) continue;
          // Wrapped Jenis text starts LEFT of its own header label, because the
          // header is centred over a wide cell while the value is left-aligned
          // in it — "Purchase Order/Kontrak..." sits at x=86 against a header at
          // x=157, nearer to the No. column than to its own. Excluding No. from
          // the choice (nothing but a bare integer ever lives there) puts it
          // back where it belongs.
          let key = null, best = Infinity;
          for (const k of ['jenis', 'nomor', 'tanggal']) {
            if (anchor[k] == null) continue;
            const d = Math.abs(anchor[k] - p.x);
            if (d < best) { best = d; key = k; }
          }
          if (!key) continue;
          cell[key] = cell[key] ? `${cell[key]} ${v}` : v;
        }
      }
      const rec = {
        no: (cell.nomor || '').replace(/\s+/g, ' ').trim(),
        jenis: (cell.jenis || '').replace(/\s+/g, ' ').trim(),
        tanggal: (cell.tanggal || '').trim(),
      };
      // A row with no document number is a stray wrap, not a declared document.
      if (!rec.no) continue;
      const key = `${rec.jenis}|${rec.no}`;
      if (seen.has(key)) continue;      // the sheet can repeat across pages
      seen.add(key);
      out.docs.push(rec);
    }
  }
  return out;
}

// =============================================================================
// THE PARTY BLOCK — read as COLUMNS, because that is what it is.
//
// LDP prints three parties side by side under "G. DATA PEMBERITAHUAN":
//
//     1. Badan Usaha/Pelaku Usaha   2. Eksportir LN/Penjual   3. Pemasok
//     c. Nama :MATAHARI TIRE ...    c. Nama :CHEMO-SENSE      c. Nama :SENNICS
//
// TLDDP prints two under "F. DATA", and the counterparty is called something
// else entirely: "2. Pengirim". No Eksportir, no Pemasok. The old alternation
// (Pemasok|Supplier|Penjual|Seller) contains none of those words, which is why
// TLDDP supplier came back empty on every document.
//
// WHICH COLUMN IS THE SUPPLIER
//   LDP   -> 2. Eksportir LN/Penjual. The SELLER; the party MTI bought from.
//            NOT 3. Pemasok, which is whoever physically shipped it and is very
//            often a different company (CHEMO-SENSE sold, SENNICS shipped).
//            parseSppbPdf() reads the SPPB's "PENGIRIM BARANG", which is the
//            shipper — so it must no longer be allowed to overwrite this.
//   TLDDP -> 2. Pengirim. The only counterparty the form names.
//
// Values are matched to labels by MIDPOINT BANDS in y, the same technique the
// goods lampiran uses, because a wrapped name sits on the line BELOW its own
// label and a wrapped address can start on the line ABOVE its label's baseline.
// =============================================================================
const PARTY_HEAD = {
  LDP: /^\s*2\.\s*Eksportir/i,
  TLDDP: /^\s*2\.\s*Pengirim/i,
};

function parseParty(pdf, asal) {
  const want = PARTY_HEAD[asal] || PARTY_HEAD.LDP;
  for (const page of (pdf.pages || [])) {
    for (const line of (page.lines || [])) {
      const parts = (line.parts || []).filter(p => p.str.trim());
      const idx = parts.findIndex(p => want.test(p.str));
      if (idx < 0) continue;

      // Column band: from this heading to the next heading on the same line.
      // The 8pt margin is because labels sit a few points right of the heading
      // they belong to ("2. Pengirim" at x=261, "c. Nama" at x=269).
      const from = parts[idx].x - 8;
      const nextHead = parts.slice(idx + 1).find(p => /^\s*\d\.\s*\S/.test(p.str));
      const to = nextHead ? nextHead.x - 8 : Infinity;

      const inBand = (x) => x >= from && x < to;
      const below = (page.lines || []).filter(l => l.y < line.y && l.y > line.y - 120);

      // Every lettered label in this column, so a value can never be pulled
      // into a neighbouring row. Listing only Nama and Alamat would let the
      // Nitku value drift into the name.
      const labels = [];
      for (const l of below) {
        for (const p of (l.parts || [])) {
          const m = p.str.trim().match(/^([a-f])\.\s*(Identitas|Nitku|Nama|Alamat|Negara|Pelaku|status)/i);
          if (m && inBand(p.x)) labels.push({ key: m[2].toLowerCase(), y: l.y, x: p.x });
        }
      }
      const nama = labels.find(a => a.key === 'nama');
      if (!nama) continue;

      // BANDS RUN FROM ONE LABEL DOWN TO THE NEXT — deliberately NOT midpoints,
      // which is what the goods lampiran uses.
      //
      // A company name here wraps DOWNWARD across as many lines as it needs, and
      // the address label sits below all of them:
      //
      //     c. Nama   :CHEMO-SENSE          <- label
      //                INTERNATIONAL TRADING
      //                CO., LIMITED         <- still the name
      //     d. Alamat :ROOM 1003, 10/F...   <- label
      //
      // A midpoint band cuts that name in half and files the tail under the
      // address: the register would have read "CHEMO-SENSE INTERNATIONAL
      // TRADING" with an address beginning "CO., LIMITED". Everything between
      // two labels belongs to the upper one.
      //
      // The 6pt of headroom is because the first line of a WRAPPED value is set
      // marginally above its own label's baseline (measured: label y=691, value
      // y=692). Without it that first line falls into the band above.
      const LEAD = 6;
      labels.sort((a, b) => b.y - a.y);
      labels.forEach((a, i) => {
        a.hi = a.y + LEAD;
        a.lo = i === labels.length - 1 ? a.y - 40 : labels[i + 1].y + LEAD;
      });

      const bucket = {};
      for (const l of below) {
        for (const p of (l.parts || [])) {
          const v = p.str.replace(/^[:：\s]+/, '').trim();
          if (!v || /^[:：|\-]+$/.test(v)) continue;
          if (!inBand(p.x)) continue;
          // Left of the value column is the label itself.
          if (p.x < nama.x + 40) continue;
          const band = labels.find(a => l.y > a.lo && l.y <= a.hi);
          if (!band) continue;
          bucket[band.key] = bucket[band.key] ? `${bucket[band.key]} ${v}` : v;
        }
      }

      const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
      const supplier = clean(bucket.nama);
      // "-" is how this form prints an empty field; never store it as a name.
      if (!supplier || supplier === '-') continue;
      return { supplier, address: clean(bucket.alamat) };
    }
  }
  return {};
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

// The attachment sheet uses the SAME table, ROTATED.
//
// Six of seventeen real documents put nothing in the main goods table but the
// single word "Terlampir" — attached. Their goods live on the LEMBAR LAMPIRAN
// DATA BARANG sheet at the back, where the layout is transposed: the field
// names run DOWN the left in one narrow column, and each ITEM is a COLUMN
// across the page.
//
//     y=229 [229]Kode Barang   [246]MTI-I-S-      [276]MTI-I-S-      [306]MTI-I-S-
//     y=227               [256]010205814ID  [286]010205803ID  [316]010205818ID
//     y=291 [229]Jumlah        [251]8000.0000     [281]9600.0000     [311]4000.0000
//     y=351 [229]Harga         [251]5.9900        [281]3.3400        [311]2.8000
//     y=458 [229]Amount        [251]47.920,00     [281]32.064,00     [311]11.200,00
//
// So the main-table reader's axes are simply swapped: rows are found by
// nearest LABEL in y, columns by nearest ITEM ANCHOR in x. The item numbers on
// the "No" row give those anchors.
//
// This is why the register showed one item per document at best. It also
// explains the six blanks exactly — those are the documents that said
// "Terlampir" and meant it.
// Every label on the sheet is listed, including the two whose values this
// parser does not use. A label that is NOT listed leaves its values with no
// row of their own, and they drift into the nearest listed one — that is how
// "Penangguhan BM" ended up in the country field.
const SHEET_LABELS = {
  'no': 'no', 'kode hs': 'hs', 'uraian barang': 'name', 'kode barang': 'code',
  'kode': 'code', 'jumlah': 'qty', 'harga': 'price', 'satuan': 'unit',
  'amount': 'amount', 'nilai pabean': 'customs', 'negara': 'country',
  'jenis bayar': 'payType', 'referensi dokumen': 'refDoc',
};
const SHEET_MARK = /LEMBAR\s+LAMPIRAN\s+DATA\s+BARANG/i;
// A value sits within a few points of its own label. 20 is generous for that
// and still far below the smallest gap between two labels (31), so a value can
// never be pulled into the neighbouring row.
const SHEET_BAND = 20;

// ---------------------------------------------------------------------------
// CONTINUATION PAGES — where the missing items went.
//
// A lampiran that does not fit on one page simply carries on onto the next, and
// that next page has NO "LEMBAR LAMPIRAN DATA BARANG" title and NO label column
// — just the value grid, on exactly the same y bands, starting at the left
// margin. Both readers here are per-page and both need something to identify
// the table by, so the continuation failed the marker test, failed the header
// test, and was skipped in silence.
//
// Measured on PPKEK BCL 031951: the document declares FIFTEEN items, eleven on
// the lampiran page and four on the page after it. The parser returned eleven.
// Nothing errored, nothing warned; the register simply held four fewer goods
// lines than the customs document it was built from.
//
// The fix is to carry the label bands forward. A page with the marker publishes
// its bands as `ctx`; a page without one but with a value grid on those same
// bands is read as a continuation, taking its column anchors from its own
// densest value row (there is no "No" row to take them from) and numbering its
// items on from where the previous page stopped.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WHERE AN ITEM'S MONEY IS, WHICH IS NOT THE SAME COLUMN ON BOTH FORMS.
//
// LDP fills Harga Satuan and Amount and the register reads them straight
// through — item 1 of nopen 007076 is 24 TNE x 1450 = 34,800 and that is what
// the Unit Cost / Total Cost columns show.
//
// TLDDP prints ZERO in both. The goods table of nopen 031951 reads:
//
//     Jumlah      Harga Satuan   Amount   Nilai Pabean
//     8000.0000   0.0000  PCE    0,00     10.368.000,00
//
// The value is in NILAI PABEAN, and that column was collected by the reader
// (SHEET_LABELS maps it to `customs`) and then dropped on the floor — the item
// object never carried it. So the export's Unit Cost and Total Cost were empty
// for every TLDDP line, which is exactly the complaint: "price, amount belum
// terinput". Fixing the document-level Harga Penyerahan did NOT fix this; they
// are two different numbers in two different places.
//
// `amount` keeps whatever the form printed, and falls back to Nilai Pabean only
// when the form printed nothing. The unit price is then DERIVED — value / qty,
// exact division, and it reconciles: price x qty = amount on every line, and
// the lines sum to the document's own Harga Penyerahan. It is derived rather
// than read because the form's own Harga Satuan cell says 0.0000, which is not
// the unit price either; it is the field being left blank.
// ---------------------------------------------------------------------------
function valueItem(it) {
  if (!it.amount && it.customs) it.amount = it.customs;
  if (!it.price && it.amount && it.qty) {
    const p = it.amount / it.qty;
    // Rounded to 4 dp, the precision the form itself prints Harga Satuan at.
    // Left at 0 rather than stored as a rounding artefact if it does not divide
    // into anything meaningful.
    it.price = Number.isFinite(p) ? Math.round(p * 10000) / 10000 : 0;
    it.priceDerived = true;
  }
  return it;
}

// Bands that hold exactly ONE short value per item, so the widest line among
// them has one part per column. The description is deliberately excluded: it
// wraps, so its line count says nothing about how many items there are.
const ANCHOR_BANDS = ['qty', 'unit', 'country', 'amount', 'customs', 'price'];

function continuationAnchors(lines, labels, startNo) {
  let best = null;
  for (const l of lines) {
    const band = labels.find(a => l.y > a.lo && l.y <= a.hi);
    if (!band || !ANCHOR_BANDS.includes(band.key)) continue;
    const parts = (l.parts || []).filter(p => p.str.trim());
    if (!best || parts.length > best.length) best = parts;
  }
  if (!best || best.length < 2) return [];
  return best
    .map(p => p.x).sort((a, b) => a - b)
    .map((x, i) => ({ n: startNo + i, x }));
}

function parseGoodsSheet(page, ctx) {
  const lines = page.lines || [];
  const marked = lines.some(l => SHEET_MARK.test((l.parts || []).map(p => p.str).join(' ')));

  let labels, labelX, anchors;

  if (marked) {
    // Labels, and where each one sits.
    labels = [];
    for (const l of lines) {
      for (const p of (l.parts || [])) {
        const key = SHEET_LABELS[p.str.trim().toLowerCase()];
        if (key && !labels.some(a => a.key === key)) labels.push({ key, x: p.x, y: l.y });
      }
    }
    const noLabel = labels.find(a => a.key === 'no');
    if (!noLabel || labels.length < 5) return { items: [], ctx };
    labelX = Math.max(...labels.map(a => a.x));

    // Row bands are the MIDPOINTS between neighbouring labels, not a fixed
    // window. A fixed one cannot work: the description is the tallest row on the
    // sheet by far — "SILANE COUPLING AGENT CROSILE-" and its wrapped "69" sit 50
    // points apart — while "No" and "Kode HS" are only 31 apart. Any window wide
    // enough for the first merges the second.
    labels.sort((a, b) => b.y - a.y);
    const EDGE = 60;
    labels.forEach((a, i) => {
      a.hi = i === 0 ? a.y + EDGE : (a.y + labels[i - 1].y) / 2;
      a.lo = i === labels.length - 1 ? a.y - EDGE : (a.y + labels[i + 1].y) / 2;
    });

    // The item numbers on the "No" row ARE the column anchors.
    anchors = [];
    for (const l of lines) {
      if (Math.abs(l.y - noLabel.y) > SHEET_BAND) continue;
      for (const p of (l.parts || [])) {
        if (p.x > labelX + 6 && /^\d{1,3}$/.test(p.str.trim())) anchors.push({ n: Number(p.str.trim()), x: p.x });
      }
    }
    if (!anchors.length) return { items: [], ctx };
    anchors.sort((a, b) => a.x - b.x);
  } else if (ctx && ctx.labels) {
    labels = ctx.labels;
    // No label column on a continuation page — the grid starts at the margin,
    // so nothing may be excluded on the left.
    labelX = -Infinity;
    anchors = continuationAnchors(lines, labels, ctx.nextNo);
    if (!anchors.length) return { items: [], ctx };
  } else {
    return { items: [], ctx };
  }
  // Right edge of the last column, so the signature block and the printed
  // legend down the side cannot be read as a further item.
  const gap = anchors.length > 1 ? (anchors[anchors.length - 1].x - anchors[0].x) / (anchors.length - 1) : 34;
  const maxX = anchors[anchors.length - 1].x + gap;

  const cells = anchors.map(() => ({}));
  // Top-to-bottom then left-to-right, so a value split across two lines
  // ("MTI-I-S-" above "010205814ID") reassembles in the order it is printed.
  const parts = [];
  for (const l of lines) for (const p of (l.parts || [])) {
    const v = p.str.trim();
    if (!v || p.x <= labelX + 6 || p.x > maxX) continue;
    parts.push({ v, x: p.x, y: l.y });
  }
  // READING ORDER IS ACROSS X, because the sheet is rotated a quarter turn: a
  // value too long for its cell wraps into the NEXT x, not the next y. Sorting
  // by y instead produced "006569MTI-IM-MSN-" on one document and the correct
  // "MTI-I-S-010205814ID" on another — the two happened to wrap the other way
  // round, which is exactly the tell that y was never the ordering axis.
  parts.sort((a, b) => a.x - b.x || b.y - a.y);
  for (const p of parts) {
    const band = labels.find(a => p.y > a.lo && p.y <= a.hi);
    if (!band || band.key === 'no') continue;
    const row = band.key;
    let col = 0, colD = Infinity;
    anchors.forEach((a, i) => { const d = Math.abs(a.x - p.x); if (d < colD) { colD = d; col = i; } });
    const c = cells[col];
    if (c[row] == null) { c[row] = p.v; continue; }
    // A word broken across the wrap keeps its hyphen and loses the space:
    // "...CROSILE-" + "69" is CROSILE-69, not "CROSILE- 69".
    const joiner = (row === 'name' && !/-$/.test(c[row])) ? ' ' : '';
    c[row] = c[row] + joiner + p.v;
  }

  const items = cells.map((c, i) => valueItem({
    no: anchors[i].n,
    code: (c.code || '').trim(),
    hs: (c.hs || '').trim(),
    name: (c.name || '').replace(/\s+/g, ' ').trim(),
    qty: parseNumber(c.qty || '') || 0,
    unit: (c.unit || '').trim(),
    price: parseNumber(c.price || '') || 0,
    amount: parseNumber(c.amount || '') || 0,
    customs: parseNumber(c.customs || '') || 0,
    country: (c.country || '').replace(/\s*-\s*/g, ' ').trim(),
  })).filter(it => it.code || it.name);

  // Published for the NEXT page, which may be this table continuing with no
  // title and no labels of its own.
  const nextNo = items.length ? Math.max(...items.map(it => it.no)) + 1 : (ctx ? ctx.nextNo : 1);
  return { items, ctx: { labels, nextNo } };
}

function parseGoods(pdf) {
  const items = [];
  // Attachment sheets first — a document that uses them puts nothing but the
  // word "Terlampir" in the main table, so there is nothing there to prefer.
  //
  // `ctx` threads the label bands from one page to the next so a lampiran that
  // spills onto a following page is still read. Without it those items were
  // dropped without a word — see the CONTINUATION PAGES note above.
  let ctx = null;
  for (const page of (pdf.pages || [])) {
    const r = parseGoodsSheet(page, ctx);
    ctx = r.ctx;
    items.push(...r.items);
  }
  if (items.length) return items;
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
      const it = valueItem({
        no: m.n,
        code: (cell.code || '').trim(),
        hs: (cell.hs || '').trim(),
        name: (cell.name || '').replace(/\s+/g, ' ').trim(),
        qty: parseNumber(cell.qty || '') || 0,
        unit: (cell.unit || '').trim(),
        price: parseNumber(cell.price || '') || 0,
        amount: parseNumber(cell.amount || '') || 0,
        customs: parseNumber(cell.customs || '') || 0,
        country: (cell.country || '').replace(/\s*-\s*/g, ' ').trim(),
      });
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

// For the handful of fields this form prints in English format. 'auto' decides
// the decimal separator from the string itself and gets both conventions right
// (472,500 -> 472500; 498.605,63 -> 498605.63).
function toNumAuto(v) {
  const n = parseNumber(v, 'auto');
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
