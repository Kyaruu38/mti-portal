// Thin wrapper over SheetJS (loaded from CDN via importmap). Read + write.
import { downloadBlob } from './dom.js';

let XLSX = null;
async function lib() {
  if (XLSX) return XLSX;
  XLSX = await import('xlsx');
  return XLSX;
}

// Read a workbook File -> { sheetNames, sheet(name) -> array-of-arrays }.
export async function readWorkbook(file) {
  const X = await lib();
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { cellDates: true });
  return {
    sheetNames: wb.SheetNames,
    rows(name) {
      const ws = wb.Sheets[name || wb.SheetNames[0]];
      return X.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    },
    countRows(name) {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) return 0;
      const r = X.utils.decode_range(ws['!ref']);
      return r.e.r - r.s.r; // approx data rows (minus header)
    },
    // Beberapa baris pertama saja.
    //
    // Dipakai untuk MENGENALI sheet, bukan membacanya. Workbook Agustus punya
    // 14 sheet dan tiga di antaranya lebih dari seribu baris (硫化工艺 1.921,
    // 投产规格 1.328, 轮胎重量 1.217). Menanyakan "sheet ini sheet order atau
    // bukan?" cuma butuh baris headernya, dan header selalu ada di delapan
    // baris pertama. Membaca ~5.000 baris untuk pertanyaan yang dijawab oleh
    // delapan adalah beberapa ratus milidetik tab membeku, setiap kali berkas
    // dijatuhkan.
    headRows(name, n = 8) {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) return [];
      const full = X.utils.decode_range(ws['!ref']);
      const range = { s: { r: full.s.r, c: full.s.c }, e: { r: Math.min(full.e.r, full.s.r + n - 1), c: full.e.c } };
      return X.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', range });
    },
  };
}

// Build a workbook from tabs: [{ name, aoa }] and download it.
// hyperlinks: optional [{ sheet, cell:'F2', url, text }] -> live Drive hyperlinks.
export async function writeWorkbook(filename, tabs, hyperlinks = []) {
  const X = await lib();
  const wb = X.utils.book_new();
  for (const tab of tabs) {
    const ws = X.utils.aoa_to_sheet(tab.aoa);
    if (tab.cols) ws['!cols'] = tab.cols;
    X.utils.book_append_sheet(wb, ws, tab.name.slice(0, 31));
  }
  for (const h of hyperlinks) {
    const ws = wb.Sheets[h.sheet];
    if (!ws) continue;
    const cell = ws[h.cell] || (ws[h.cell] = { t: 's', v: h.text || 'Drive' });
    cell.l = { Target: h.url, Tooltip: 'Open in Google Drive' };
    if (h.text) cell.v = h.text;
  }
  const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// Column index -> A1 letter.
export function colLetter(idx) {
  let s = ''; idx += 1;
  while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
  return s;
}
