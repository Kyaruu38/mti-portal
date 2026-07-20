// In-browser archive extraction for PPKEK bundles.
//  - ZIP: JSZip (reliable, from CDN).
//  - RAR: libarchive.js (WASM) if available; otherwise a graceful error so the
//    user can unzip manually. Both loaded lazily from the importmap.

export async function extractArchive(file) {
  const name = (file.name || '').toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.zip')) return extractZip(buf);
  if (name.endsWith('.rar')) return extractRar(buf, file);
  // Sniff by magic bytes.
  const sig = new Uint8Array(buf.slice(0, 4));
  if (sig[0] === 0x50 && sig[1] === 0x4b) return extractZip(buf); // PK..
  if (sig[0] === 0x52 && sig[1] === 0x61 && sig[2] === 0x72) return extractRar(buf, file); // Rar!
  throw new Error('Unsupported archive format');
}

async function extractZip(buf) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const files = [];
  const entries = Object.values(zip.files);
  for (const e of entries) {
    if (e.dir) continue;
    const blob = await e.async('blob');
    files.push(new File([blob], baseName(e.name), { type: guessType(e.name) }));
  }
  return { files, format: 'zip' };
}

async function extractRar(buf, orig) {
  try {
    const mod = await import('libarchive.js');
    const { Archive } = mod;
    Archive.init({
      workerUrl: 'https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/worker-bundle.js',
    });
    const archive = await Archive.open(new File([buf], orig.name));
    const flat = await archive.extractFiles();
    const files = [];
    (function walk(node, prefix) {
      for (const k in node) {
        const v = node[k];
        if (v instanceof File) files.push(new File([v], k, { type: guessType(k) }));
        else if (v && typeof v === 'object') walk(v, prefix + k + '/');
      }
    })(flat, '');
    return { files, format: 'rar' };
  } catch (e) {
    console.warn('RAR extraction unavailable:', e);
    const err = new Error('RAR_UNSUPPORTED');
    err.code = 'RAR_UNSUPPORTED';
    throw err;
  }
}

function baseName(p) { return String(p).split('/').pop(); }
function guessType(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
