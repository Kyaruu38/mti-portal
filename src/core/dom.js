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
      // Object.assign(el.style, …) DIAM-DIAM MENGABAIKAN CUSTOM PROPERTY.
      //
      // `el.style['--bc'] = '#1B7A3C'` bukan error dan bukan peringatan — dia
      // cuma tidak melakukan apa-apa, karena CSSStyleDeclaration tidak punya
      // properti bernama '--bc' untuk ditimpa. Satu-satunya jalan masuk adalah
      // setProperty().
      //
      // Ketahuan waktu tujuh lencana merek di layar boot keluar oranye semua:
      // --bc tidak pernah sampai, jadi setiap lencana memakai nilai cadangannya.
      // Tujuh warna berbeda menjadi satu warna, tanpa satu pun tanda di console.
      for (const [k, v] of Object.entries(val)) {
        if (k.startsWith('--')) el.style.setProperty(k, v);
        else el.style[k] = v;
      }
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
