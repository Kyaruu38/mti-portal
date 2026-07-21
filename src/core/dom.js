// Tiny hyperscript + DOM helpers. No framework, no build step.
// h('div.card', {onClick}, [children]) -> HTMLElement

export function h(tag, props, children) {
  // Allow h(tag, children) shorthand
  if (Array.isArray(props) || typeof props === 'string' || props instanceof Node) {
    children = props; props = {};
  }
  props = props || {};

  // Parse "div.class1.class2#id"
  let tagName = 'div', classes = [];
  const idMatch = tag.match(/#([\w-]+)/);
  let id = null;
  if (idMatch) { id = idMatch[1]; tag = tag.replace(/#[\w-]+/, ''); }
  const parts = tag.split('.');
  if (parts[0]) tagName = parts[0];
  classes = parts.slice(1);

  const el = document.createElement(tagName);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');

  for (const key in props) {
    const val = props[key];
    if (val == null || val === false) continue;
    if (key === 'class' || key === 'className') {
      el.className = (el.className ? el.className + ' ' : '') + val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key === 'dataset' && typeof val === 'object') {
      Object.assign(el.dataset, val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'html') {
      el.innerHTML = val;
    } else if (key in el && key !== 'list' && key !== 'type') {
      try { el[key] = val; } catch { el.setAttribute(key, val); }
    } else {
      el.setAttribute(key, val);
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  if (children == null || children === false) return;
  if (Array.isArray(children)) {
    children.forEach(c => appendChildren(el, c));
  } else if (children instanceof Node) {
    el.appendChild(children);
  } else {
    el.appendChild(document.createTextNode(String(children)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function mount(el, ...children) { clear(el); appendChildren(el, children); return el; }

// Simple SVG icon element from a "d1|d2|d3" path spec (design convention).
export function svg(paths, size = 15, extra = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.style.fill = 'none'; s.style.stroke = extra.stroke || 'currentColor';
  s.style.strokeWidth = extra.strokeWidth || 2;
  s.style.strokeLinecap = 'round'; s.style.strokeLinejoin = 'round';
  s.style.flexShrink = 0;
  (paths || '').split('|').forEach(d => {
    if (!d) return;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
  });
  return s;
}

// Trigger a native file picker; resolves with FileList (or null).
export function pickFiles({ accept, multiple = false } = {}) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    if (accept) inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = 'none';
    inp.addEventListener('change', () => { resolve(inp.files); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

// Wire an element as a drag & drop target + click-to-browse.
export function wireDrop(el, { accept, multiple = false, onFiles }) {
  el.addEventListener('click', async () => {
    const files = await pickFiles({ accept, multiple });
    if (files && files.length) onFiles(Array.from(files));
  });
  ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => {
    e.preventDefault(); el.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => {
    e.preventDefault(); el.classList.remove('drag');
  }));
  el.addEventListener('drop', e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) onFiles(Array.from(files));
  });
  return el;
}

// Download a Blob as a file.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Lazy-loads html2pdf.js as a UMD bundle via a <script> tag rather than an
// esm.sh dynamic import — esm.sh fails to bundle its jsPDF/html2canvas deps
// correctly ("x is not a function"), while the jsdelivr UMD bundle just
// attaches window.html2pdf directly. Cached across calls (module-level
// promise) so the CDN script tag is only ever injected once per session.
let _h2pPromise = null;
export function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (_h2pPromise) return _h2pPromise;
  _h2pPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
    s.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error('html2pdf tak tersedia'));
    s.onerror = () => reject(new Error('gagal load html2pdf dari CDN'));
    document.head.appendChild(s);
  });
  return _h2pPromise;
}

// Render a print-ready element to PDF. Throws on failure — callers should
// catch and fall back to an HTML download (see approval.js/payment.js/suratJalan.js).
export async function downloadDocPdf(el, filename, orientation = 'portrait') {
  const html2pdf = await loadHtml2Pdf();
  el.style.background = '#fff';
  await html2pdf().set({
    filename: filename.endsWith('.pdf') ? filename : filename + '.pdf',
    margin: [8, 8, 8, 8],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation },
    pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
  }).from(el).save();
}
