// PDF text extraction via pdf.js (loaded from CDN through the importmap).
// Provides text lines with rough layout so downstream parsers can work by name.

let pdfjsLib = null;

async function lib() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  // Worker from the same CDN.
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  } catch { /* ignore */ }
  return pdfjsLib;
}

// Returns { pages: [{ lines: [{ str, x, y }] }], text, isScanned }.
export async function extractPdf(fileOrBuffer) {
  const L = await lib();
  const data = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer();
  const doc = await L.getDocument({ data }).promise;
  const pages = [];
  let allText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group items into lines by y position.
    const rows = {};
    for (const it of content.items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      (rows[y] = rows[y] || []).push({ str: it.str, x });
    }
    const ys = Object.keys(rows).map(Number).sort((a, b) => b - a);
    const lines = ys.map(y => {
      const parts = rows[y].sort((a, b) => a.x - b.x);
      return { y, x: parts[0].x, str: parts.map(z => z.str).join(' ').replace(/\s+/g, ' ').trim(), parts };
    }).filter(l => l.str);
    pages.push({ lines });
    allText += lines.map(l => l.str).join('\n') + '\n';
  }
  const isScanned = allText.replace(/\s/g, '').length < 20; // almost no text => scan
  return { pages, text: allText, isScanned, numPages: doc.numPages };
}
