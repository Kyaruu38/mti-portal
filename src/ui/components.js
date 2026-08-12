// Reusable UI building blocks (built on the h() hyperscript).
import { h, svg, wireDrop } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { setState, setUI, getState } from '../core/store.js';
import { t, tr } from '../i18n/index.js';

export function icon(name, size = 15, extra) { return svg(ICONS[name] || '', size, extra); }

export function btn(label, { variant = '', iconName, onClick, disabled, sm } = {}) {
  const cls = ['btn', variant === 'primary' ? 'btn-primary' : '', variant === 'navy' ? 'btn-navy' : '',
    variant === 'danger' ? 'btn-danger-o' : '', sm ? 'btn-sm' : ''].filter(Boolean).join(' ');
  return h('button', { class: cls, onClick, disabled }, [
    iconName ? icon(iconName, sm ? 12 : 13) : null,
    label,
  ]);
}

export function iconBtn(iconName, { onClick, title, badge, class: cls } = {}) {
  return h('button.icon-btn', { onClick, title, class: cls || null }, [
    icon(iconName, 15),
    badge ? h('span', { style: { position: 'absolute', top: '-5px', right: '-5px', background: 'var(--accent)', color: '#fff', fontSize: '9px', fontWeight: 700, borderRadius: '999px', minWidth: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' } }, String(badge)) : null,
  ]);
}

const CHIP_CLASS = {
  green: 'b-green', amber: 'b-amber', red: 'b-red', blue: 'b-blue', gray: 'b-gray', navy: 'b-navy', accent: 'b-accent',
};
export function badge(text, tone = 'gray', { iconName } = {}) {
  return h('span', { class: 'badge ' + (CHIP_CLASS[tone] || 'b-gray') }, [
    iconName ? icon(iconName, 11) : null, text,
  ]);
}

// Map a status string to a tone.
export function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (/paid|approved|diterima finance|costed ✓|closed|✓/.test(s)) return 'green';
  if (/menunggu|awaiting|diproses|pending|open|besok/.test(s)) return 'amber';
  if (/overdue|reject|urgent/.test(s)) return 'red';
  if (/finance|diterima purchasing|blue|di finance/.test(s)) return 'blue';
  return 'gray';
}

export function card(children, { pad = false, cls = '' } = {}) {
  return h('div.card' + (cls ? '.' + cls : ''), pad ? { class: 'card-pad' } : {}, children);
}

export function sectionHead(title, right) {
  return h('div.card-head', [h('div.card-title', title), right ? h('div.mla', right) : null]);
}

// Simple table. cols: [{ key, label, r, render }]. rows: array of objects.
export function table(cols, rows, { rowClass, footer, empty } = {}) {
  const thead = h('thead', h('tr', cols.map(c => h('th' + (c.r ? '.r' : ''), c.label))));
  const body = h('tbody', rows.length ? rows.map((row, i) => {
    const tr = h('tr' + (rowClass && rowClass(row, i) ? '.' + rowClass(row, i) : ''),
      cols.map(c => h('td' + (c.r ? '.r' : ''), c.render ? c.render(row, i) : text(row[c.key]))));
    return tr;
  }) : h('tr', h('td', { colspan: cols.length, style: { textAlign: 'center', color: 'var(--text-3)', padding: '24px' } }, empty || '—')));
  return h('div.card', [
    h('div.tbl-wrap', h('table.tbl', [thead, body])),
    footer ? h('div.tbl-foot', footer) : null,
  ]);
}
function text(v) { return v == null ? '—' : String(v); }

// Dropzone. onFiles(File[]).
//
// `disabled` renders the same box, dimmed and inert — nothing is wired, so no
// drop and no click can start an upload. It exists because a dropzone had no way
// to be switched off: on the Finance and PPKEK screens the drop target was the
// one write path with no gate at all, and a dropzone is easy to miss when
// auditing a screen for buttons. `disabledNote` replaces the subtitle so the box
// says why it is inert instead of just looking broken.
export function dropzone({ title, sub, accept, multiple, onFiles, iconName = 'upload', compact, disabled, disabledNote }) {
  const readOnlyNote = () => tr({
    id: 'Akun ini cuma bisa memantau',
    en: 'This account can only view',
    zh: '此账号只能查看',
  });
  const dz = h('div.dropzone', compact ? { style: { minHeight: '150px', padding: '20px' } } : { style: { minHeight: '220px' } }, [
    h('span.dz-icon', icon(disabled ? 'eye' : iconName, 20)),
    h('div', { style: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' } }, title),
    (disabled ? (disabledNote || readOnlyNote()) : sub)
      ? h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, disabled ? (disabledNote || readOnlyNote()) : sub)
      : null,
  ]);
  if (disabled) {
    dz.style.opacity = '.5';
    dz.style.pointerEvents = 'none';
    return dz;
  }
  wireDrop(dz, { accept, multiple, onFiles });
  return dz;
}

// Modal wrapper. Returns element; onClose closes via overlay/x.
export function modal({ title, subtitle, body, footer, width = 520, onClose }) {
  const overlay = h('div.overlay', {
    onClick: (e) => { if (e.target === overlay) onClose && onClose(); },
  }, [
    h('div.modal', { style: { width: width + 'px' } }, [
      h('div.modal-head', [
        h('div', [
          h('div.modal-title', title),
          subtitle ? h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, subtitle) : null,
        ]),
        h('button.x-btn', { onClick: () => onClose && onClose() }, icon('x', 14)),
      ]),
      h('div.modal-body', body),
      footer ? h('div.modal-foot', footer) : null,
    ]),
  ]);
  return overlay;
}

export function field(label, control) {
  return h('div', [h('div.field-label', label), control]);
}

// `onBlur` exists for MONEY boxes and is not decoration. A typed amount is
// parsed into a variable the user cannot see, and nothing here re-renders while
// typing (mount() has no diffing), so the box can display one number while a
// different one is what gets saved. onBlur is where the parsed value is written
// BACK into the node, so the two can never disagree at the moment Save is
// pressed. It receives (value, event) exactly like onInput — the caller needs
// `event.target` to write to.
//
// NEVER call toast() from an onBlur handler passed here. toast() goes through
// setState -> queueMicrotask(flush) -> full rebuild, and that microtask drains
// BETWEEN mousedown and click — so the button being clicked is replaced mid-
// gesture and the click vanishes with no error. Write to the node by id
// instead. This has already blown up three times in this repo.
export function inputEl({ value = '', placeholder, mono, type = 'text', onInput, onBlur, id } = {}) {
  return h('input.input' + (mono ? '.mono' : ''), {
    value, placeholder, type, id,
    onInput: onInput ? (e) => onInput(e.target.value, e) : null,
    onBlur: onBlur ? (e) => onBlur(e.target.value, e) : null,
  });
}

// ---------------------------------------------------------------------------
// searchInput — an input that DRIVES A RE-RENDER without losing focus.
//
// THE PROBLEM IT SOLVES
// mount() (core/dom.js) has no diffing: it clears the container and rebuilds
// the whole tree. setUI() schedules that rebuild on a microtask. So any plain
// `onInput: v => setUI({ q: v })` replaces the very <input> being typed into
// before the SECOND keystroke lands — focus falls to <body> and only the first
// character is ever captured. Typing "BSN" into a search box yielded "B".
//
// THE FIX
//   1. Debounce, so a burst of keystrokes causes ONE re-render, not one per key.
//   2. After that render, re-acquire the element by id (it is a NEW node) and
//      restore focus plus the caret position.
//
// `id` is required and must be unique per call site — it is the only handle we
// have on the replacement node.
// ---------------------------------------------------------------------------
export function searchInput({ id, value = '', placeholder, mono, onChange, delay = 160 }) {
  const el = h('input.input' + (mono ? '.mono' : ''), { value, placeholder, id, autocomplete: 'off' });
  let timer = null;
  // Commit immediately on blur as well as on the debounce. qtyInput in
  // suratJalan.js documents the same hazard: a user who types and instantly
  // clicks a button would otherwise lose the last keystrokes when the timer
  // never fires.
  el.addEventListener('blur', () => { clearTimeout(timer); if (el.value !== value) onChange(el.value); });
  el.addEventListener('input', () => {
    const v = el.value;
    const caret = el.selectionStart;
    clearTimeout(timer);
    timer = setTimeout(() => {
      onChange(v);
      // Two frames: one for setUI's microtask flush, one for the rebuild.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const next = document.getElementById(id);
        if (!next || next === document.activeElement) return;
        // ONLY reclaim focus if the rebuild actually dropped it to <body>.
        //
        // This used to focus() unconditionally. Every call site keeps rendering
        // behind its screen's modal, so ~190 ms after the last keystroke focus
        // was yanked out of whatever the user had moved on to — including the
        // supplier bank-account field in the Edit Supplier modal, which sits
        // over this input and shows no sign anything went wrong. Digits of an
        // account number ended up in a search box hidden behind the overlay.
        const active = document.activeElement;
        const stolen = active && active !== document.body && active.tagName !== 'HTML';
        if (stolen) return;
        // Don't grab focus from under an open modal/drawer either.
        if (document.querySelector('.overlay, .modal, .drawer')) return;
        next.value = v;
        next.focus();
        try { next.setSelectionRange(caret, caret); } catch { /* not text-selectable */ }
      }));
    }, delay);
  });
  return el;
}

// Editable "No PO" field with a non-blocking duplicate warning. The warning
// is checked on blur and written straight to the warning element (no setUI,
// no re-render) — mount() rebuilds the whole DOM tree on every state change,
// which would risk dropping a click on a button the user clicks straight to
// from this field (see suratJalan.js qtyInput for the same lesson). Never
// disables anything — this only informs, per the "warn, don't block" rule.
export function poNoField(f, key = 'no') {
  const warn = h('div', { style: { fontSize: '10.5px', color: 'var(--st-amber-tx)', marginTop: '4px', display: 'none' } }, tr({
    id: '⚠ No PO ini sudah pernah ada — pastikan tidak dobel.',
    en: '⚠ This PO number already exists — make sure it is not a duplicate.',
    zh: '⚠ 此采购单号已存在 — 请确认没有重复。',
  }));
  const input = h('input.input.mono', {
    value: f[key] || '',
    onInput: e => { f[key] = e.target.value; },
    onBlur: e => {
      const v = e.target.value.trim();
      const dup = v && getState().pos.some(p => p.no === v);
      warn.style.display = dup ? 'block' : 'none';
    },
  });
  return h('div', [input, warn]);
}

export function selectEl(options, { value, onChange, mono } = {}) {
  const sel = h('select.input' + (mono ? '.mono' : ''), {
    onChange: onChange ? (e) => onChange(e.target.value) : null,
  }, options.map(o => {
    const val = typeof o === 'object' ? o.value : o;
    const lbl = typeof o === 'object' ? o.label : o;
    return h('option', { value: val, selected: val === value }, lbl);
  }));
  return sel;
}

// Toggle switch.
export function toggle(on, onChange) {
  const el = h('span', {
    style: { display: 'inline-flex', width: '42px', height: '24px', borderRadius: '999px', background: on ? 'var(--accent)' : 'var(--border-strong)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' },
    onClick: () => onChange(!on),
  }, h('span', { style: { position: 'absolute', top: '2px', left: on ? '20px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .15s' } }));
  return el;
}

// Checkbox row for checklists.
export function checkRow(checked, label, sub, onToggle) {
  return h('label', {
    style: { display: 'flex', alignItems: 'center', gap: '11px', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', background: 'var(--surface2)' },
    onClick: (e) => { e.preventDefault(); onToggle(); },
  }, [
    h('span', { style: { width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: checked ? '1.5px solid var(--accent)' : '1.5px solid var(--border-strong)', background: checked ? 'var(--accent)' : 'var(--surface)' } },
      checked ? svg(ICONS.check, 13, { stroke: '#fff', strokeWidth: 3 }) : null),
    h('span.grow', [
      h('span', { style: { display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' } }, label),
      sub ? h('span', { style: { display: 'block', fontSize: '10.5px', color: 'var(--text-3)' } }, sub) : null,
    ]),
  ]);
}

// Drive hyperlink (or placeholder note when unconfigured).
export function driveLink(url) {
  const placeholder = !url || url.startsWith('drive-pending') || url.startsWith('drive-error');
  return h('a', {
    href: placeholder ? null : url, target: placeholder ? null : '_blank',
    title: placeholder ? t('drive_unconfigured') : url,
    style: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, opacity: placeholder ? 0.7 : 1 },
    onClick: (e) => { if (placeholder) e.preventDefault(); },
  }, ['Drive', icon('ext', 10)]);
}

export function pageHeader(title, sub, actions) {
  return h('div.row.wrap', { style: { alignItems: 'flex-end', justifyContent: 'space-between' } }, [
    h('div', [h('h1.page-h1', title), sub ? h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' } }, sub) : null]),
    actions ? h('div.row.gap8.wrap', actions) : null,
  ]);
}

// ---------------------------------------------------------------------------
// PAGINASI — dipakai semua tabel panjang di portal
// ---------------------------------------------------------------------------
// KENAPA INI ADA
//
// core/dom.js mount() tidak membandingkan apa pun: setiap setState membuang
// seluruh isi layar lalu membangunnya lagi dari nol. Jadi ongkos SETIAP klik —
// ganti bahasa, pindah tab, menekan tombol apa pun — sebanding dengan jumlah
// baris yang sedang tampil, bukan dengan besarnya perubahan.
//
// Diukur di layar Stok Label dengan data asli, 974 SKU:
//
//     400 baris tampil  →  5.311 elemen  →  291 ms
//     200 baris         →  2.684 elemen  →  157 ms
//     100 baris         →  1.411 elemen  →   88 ms
//      10 baris         →     ±220 elemen →  ±35 ms
//       0 baris         →      75 elemen  →   30 ms
//
// Garis lurus. Tabelnya adalah SELURUH ongkosnya — lima kartu angka, tiga kotak
// unggah, enam tab, dan semua spanduk peringatan digabung cuma 30 ms.
//
// Batas 400 yang lama dipilih supaya "hampir semua muat". Yang benar-benar
// terjadi: hampir tidak ada yang menggulir sampai baris ke-400, tapi SEMUA
// ORANG membayar ongkosnya di setiap klik, di setiap layar, sepanjang hari.
//
// Sepuluh baris adalah bawaannya, dan yang butuh lebih memilih sendiri. Ongkos
// besar tetap tersedia — tapi jadi keputusan orangnya, bukan pajak yang
// ditagihkan diam-diam.
export const PAGE_SIZES = [10, 20, 50, 100];
export const PAGE_DEFAULT = 10;

// Potong daftar untuk halaman yang sedang dibuka.
//
// Halaman dijepit ke rentang yang masih ada: menyaring 900 baris menjadi 3
// sementara orangnya sedang di halaman 40 harus menampilkan ketiga baris itu,
// bukan halaman kosong yang terlihat seperti "tidak ada hasil".
export function pageSlice(rows, page, size) {
  const n = rows.length;
  if (!size || size >= n) return { items: rows, page: 1, pages: 1, from: n ? 1 : 0, to: n, total: n };
  const pages = Math.max(1, Math.ceil(n / size));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  const from = (p - 1) * size;
  return { items: rows.slice(from, from + size), page: p, pages, from: from + 1, to: Math.min(from + size, n), total: n };
}

// info = hasil pageSlice(). onPage(n) dan onSize(n) yang menyimpan pilihannya.
export function pager(info, { onPage, onSize, note } = {}) {
  const { page, pages, from, to, total } = info;
  const nomor = h('span.mono', { style: { fontSize: '11.5px', color: 'var(--text-2)' } },
    total ? tr({
      id: `${from}–${to} dari ${total}`,
      en: `${from}–${to} of ${total}`,
      zh: `${total} 中的 ${from}–${to}`,
    }) : tr({ id: 'kosong', en: 'empty', zh: '空' }));

  const lompat = (ke, label, mati) => h('button.btn.btn-sm', {
    disabled: mati, style: mati ? { opacity: '.35', cursor: 'not-allowed' } : {},
    onClick: () => { if (!mati && onPage) onPage(ke); },
  }, label);

  return h('div.tbl-foot', h('div.row.gap8.wrap', { style: { alignItems: 'center' } }, [
    h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
      id: 'Tampilkan', en: 'Show', zh: '显示',
    })),
    // <select> biasa, bukan tombol-tombol: empat pilihan yang saling meniadakan
    // memang bentuknya begini, dan dia tidak ikut melebar di layar sempit.
    h('select.input', {
      style: { width: 'auto', padding: '4px 8px', fontSize: '11.5px' },
      onChange: e => onSize && onSize(Number(e.target.value)),
    }, [
      ...PAGE_SIZES.map(n => h('option', { value: String(n), selected: info.size === n }, String(n))),
      h('option', { value: '0', selected: !info.size }, tr({ id: 'Semua', en: 'All', zh: '全部' })),
    ]),
    nomor,
    pages > 1 ? h('div.row.gap8', { style: { marginLeft: '4px' } }, [
      lompat(1, '«', page <= 1),
      lompat(page - 1, '‹', page <= 1),
      h('span.mono', { style: { fontSize: '11.5px', minWidth: '54px', textAlign: 'center' } }, `${page} / ${pages}`),
      lompat(page + 1, '›', page >= pages),
      lompat(pages, '»', page >= pages),
    ]) : null,
    note ? h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, note) : null,
  ]));
}

// ===========================================================================
// PENYARING PER DAFTAR — tombol corong + jendela isian
// ===========================================================================
//
// BENTUKNYA: satu tombol corong kecil di samping judul daftar. Diklik, muncul
// jendela berisi satu kotak per kolom — supplier, tanggal, nomor dokumen, item,
// status. Yang mengisi memilih sendiri kotak mana yang dipakai; yang dikosongkan
// tidak ikut menyaring.
//
// KENAPA JENDELA, BUKAN DERETAN KOTAK DI ATAS TABEL
// Lima kotak yang selalu kelihatan memakan tinggi layar yang sama di setiap
// daftar, setiap hari, padahal sebagian besar waktu tidak ada yang menyaring.
// Ditaruh di balik satu tombol, ongkosnya cuma satu klik dan cuma dibayar oleh
// yang memang sedang mencari.
//
// KENAPA DRAFT-NYA DI LUAR STATE — INI YANG PALING PENTING
// mount() membangun ulang seluruh layar setiap setUI(). Kalau tiap ketikan
// masuk ke state, jendelanya ikut dibangun ulang di tengah orang mengetik:
// fokus lepas, dan huruf berikutnya jatuh ke mana-mana. Jadi ketikan disimpan
// di DRAF di bawah ini — di luar state, tidak memicu render apa pun — dan baru
// masuk ke state sekali, waktu tombol Terapkan ditekan.
//
// Draf disimpan per-id di tingkat modul, BUKAN sebagai variabel lokal di dalam
// fungsi jendelanya. Kalau lokal, render ulang yang datang dari mana saja
// (lonceng notifikasi, pemeriksa versi, rekan yang menyimpan data) akan
// membuat ulang jendelanya dan mengembalikan semua kotak ke isi lamanya —
// tanpa satu pun tanda bahwa ketikan orangnya barusan hilang.
const DRAF = new Map();

// Nilai penyaring yang SEDANG BERLAKU untuk satu daftar.
export function nilaiFilter(id) { return (getState().ui.filters || {})[id] || {}; }

// Berapa kotak yang benar-benar diisi. Dipakai buat angka di tombol corong —
// tanpa itu, daftar yang tinggal 3 baris dari 137 terlihat seperti daftar yang
// memang cuma punya 3 baris.
export function jumlahFilterAktif(nilai) {
  let n = 0;
  for (const v of Object.values(nilai || {})) {
    if (v == null) continue;
    if (typeof v === 'object') { if (v.dari || v.sampai) n++; }
    else if (String(v).trim()) n++;
  }
  return n;
}

const rapikan = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

// Tanggal datang dalam beberapa bentuk: ISO penuh dari Supabase
// ('2026-04-03T00:00:00.000Z'), 'YYYY-MM-DD' dari <input type=date>, dan
// sesekali 'DD/MM/YYYY' dari berkas Excel. Semuanya diperas jadi 'YYYY-MM-DD'
// supaya perbandingannya cukup perbandingan teks biasa — tidak ada zona waktu
// yang bisa menggeser tanggal sehari, yang justru paling sering terjadi persis
// di batas rentang yang sedang dicari orang.
function tanggalKunci(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// Satu kotak teks boleh berisi beberapa kata: SEMUA kata harus ada, urutannya
// bebas. 'haichao 0206' menemukan baris Haichao yang PO-nya 26ID0206 walaupun
// dua kata itu duduk di ujung baris yang berjauhan.
function cocokTeks(isi, cari) {
  const a = rapikan(isi);
  return rapikan(cari).split(' ').filter(Boolean).every(k => a.includes(k));
}

// medan: [{ kunci, label, tipe:'teks'|'tanggal'|'pilih', ambil(row), opsi? }]
// Baris lolos hanya kalau SEMUA kotak yang diisi cocok — bukan salah satu.
// Menggabungkan dengan "atau" akan membuat menambah kotak justru memperbanyak
// hasil, yang berlawanan dengan arti kata menyaring.
export function saring(rows, medan, nilai) {
  const aktif = (medan || []).filter(m => {
    const v = (nilai || {})[m.kunci];
    if (v == null) return false;
    return m.tipe === 'tanggal' ? !!(v.dari || v.sampai) : !!String(v).trim();
  });
  if (!aktif.length) return rows;
  return rows.filter(row => aktif.every(m => {
    const v = nilai[m.kunci];
    const isi = m.ambil ? m.ambil(row) : row[m.kunci];
    if (m.tipe === 'tanggal') {
      const k = tanggalKunci(isi);
      if (!k) return false;
      if (v.dari && k < v.dari) return false;
      if (v.sampai && k > v.sampai) return false;
      return true;
    }
    if (m.tipe === 'pilih') return rapikan(isi) === rapikan(v);
    return cocokTeks(isi, v);
  }));
}

// Tombol corong + jendelanya. Ditaruh di samping judul daftar.
//
// kunciHalaman: nama kunci nomor halaman daftar ini (mis. 'invPage'). Wajib
// diisi kalau daftarnya berhalaman — menyaring 137 baris jadi 3 sementara
// orangnya sedang di halaman 12 akan menampilkan halaman kosong yang terbaca
// persis seperti "tidak ada hasil".
export function tombolFilter({ id, medan, judul, kunciHalaman }) {
  const st = getState();
  const berlaku = nilaiFilter(id);
  const terbuka = st.ui.filterOpen === id;
  const jml = jumlahFilterAktif(berlaku);

  const buka = () => { DRAF.set(id, { ...berlaku }); setUI({ filterOpen: id }); };
  const tutup = () => { DRAF.delete(id); setUI({ filterOpen: null }); };
  const simpan = (nilai) => {
    DRAF.delete(id);
    const patch = {
      filters: { ...(getState().ui.filters || {}), [id]: nilai },
      filterOpen: null,
    };
    if (kunciHalaman) patch[kunciHalaman] = 1;
    setUI(patch);
  };

  const tombol = iconBtn('filter', {
    title: tr({ id: 'Saring daftar', en: 'Filter list', zh: '筛选列表' }),
    badge: jml || null,
    class: jml ? 'aktif' : null,
    onClick: buka,
  });

  return h('span', { style: { display: 'inline-flex', position: 'relative' } }, [
    tombol,
    terbuka ? jendelaFilter({ id, medan, judul, tutup, simpan }) : null,
  ]);
}

function jendelaFilter({ id, medan, judul, tutup, simpan }) {
  const draf = DRAF.get(id) || {};

  const kotak = (m) => {
    if (m.tipe === 'tanggal') {
      const v = draf[m.kunci] || {};
      // KOTAK TANGGAL YANG BENAR-BENAR KOSONG.
      //
      // <input type="date"> yang kosong TIDAK bisa dibikin polos: browser selalu
      // menulis 'mm/dd/yyyy' di dalamnya, itu bagian dari kontrolnya sendiri dan
      // placeholder tidak berpengaruh sama sekali. Yang terlihat orang bukan
      // kotak kosong, tapi kotak yang seolah sudah ada isinya.
      //
      // Jadi kotaknya lahir sebagai type="text" — polos, benar-benar kosong —
      // lalu berubah jadi type="date" begitu diklik, supaya pemilih tanggal
      // bawaan browser tetap muncul. Kalau ditinggal dalam keadaan kosong, dia
      // balik jadi text. Yang sudah ada tanggalnya tetap type="date" supaya
      // tampil sebagai tanggal, bukan sebagai teks mentah.
      const satu = (bagian, label) => {
        const isi = v[bagian] || '';
        const inp = h('input.input', { type: isi ? 'date' : 'text', value: isi, autocomplete: 'off' });
        inp.addEventListener('focus', () => { if (inp.type !== 'date') inp.type = 'date'; });
        inp.addEventListener('blur', () => { if (!inp.value) inp.type = 'text'; });
        inp.addEventListener('input', () => {
          const lama = draf[m.kunci] || {};
          draf[m.kunci] = { ...lama, [bagian]: inp.value };
        });
        return h('div', { style: { flex: 1 } }, [
          h('div', { style: { fontSize: '10px', color: 'var(--text-3)', marginBottom: '3px' } }, label),
          inp,
        ]);
      };
      return field(m.label, h('div.row.gap8', [
        satu('dari', tr({ id: 'Dari', en: 'From', zh: '从' })),
        satu('sampai', tr({ id: 'Sampai', en: 'To', zh: '到' })),
      ]));
    }
    if (m.tipe === 'pilih') {
      return field(m.label, h('select.input', {
        onChange: e => { draf[m.kunci] = e.target.value; },
      }, [
        h('option', { value: '', selected: !draf[m.kunci] }, tr({ id: 'Semua', en: 'All', zh: '全部' })),
        ...(m.opsi || []).map(o => h('option', { value: o, selected: rapikan(draf[m.kunci]) === rapikan(o) }, o)),
      ]));
    }
    // TANPA placeholder. Contoh abu-abu di dalam kotak ('haichao', '26ID0206')
    // terbaca sebagai isi yang sudah ada, bukan sebagai contoh — dan yang
    // membacanya begitu akan menekan Terapkan mengira sedang menyaring. Judul
    // kotaknya sudah bilang isinya apa; kotaknya sendiri kosong.
    return field(m.label, h('input.input' + (m.mono ? '.mono' : ''), {
      value: draf[m.kunci] || '', autocomplete: 'off',
      // Sengaja TIDAK memanggil setUI: lihat catatan DRAF di atas.
      onInput: e => { draf[m.kunci] = e.target.value; },
      onKeydown: e => { if (e.key === 'Enter') simpan({ ...draf }); },
    }));
  };

  return modal({
    title: judul || tr({ id: 'Saring daftar', en: 'Filter list', zh: '筛选列表' }),
    subtitle: tr({
      id: 'Isi yang perlu saja — yang dikosongkan tidak ikut menyaring',
      en: 'Fill only what you need — empty boxes do not filter',
      zh: '只填需要的项 — 留空的不参与筛选',
    }),
    width: 460, onClose: tutup,
    body: h('div.stack', { style: { gap: '11px' } }, (medan || []).map(kotak)),
    footer: h('div.row.gap8', { style: { justifyContent: 'flex-end', width: '100%' } }, [
      btn(tr({ id: 'Bersihkan', en: 'Clear', zh: '清除' }), { onClick: () => simpan({}) }),
      btn(tr({ id: 'Terapkan', en: 'Apply', zh: '应用' }), { variant: 'primary', onClick: () => simpan({ ...draf }) }),
    ]),
  });
}

// Baris "tidak ada yang cocok" DI DALAM tabelnya.
//
// Tabel yang mendadak kosong tanpa keterangan terbaca sebagai portal rusak,
// bukan sebagai penyaring yang terlalu sempit — dan yang membacanya begitu akan
// memuat ulang halaman, bukan melonggarkan pencariannya. Jadi pesannya duduk
// persis di tempat datanya seharusnya, lengkap dengan jalan keluarnya.
export function barisTakCocok(jumlahKolom, { id, adaFilter = true } = {}) {
  const bersihkan = () => {
    const f = { ...(getState().ui.filters || {}) };
    delete f[id];
    setUI({ filters: f });
  };
  return h('tr', h('td', {
    colspan: jumlahKolom,
    style: { textAlign: 'center', padding: '30px 16px', color: 'var(--text-3)' },
  }, h('div.stack', { style: { gap: '8px', alignItems: 'center' } }, [
    h('div', { style: { fontSize: '12.5px' } }, adaFilter
      ? tr({
          id: 'Tidak ada data yang cocok dengan saringannya',
          en: 'No data matches the filter',
          zh: '没有符合筛选条件的数据',
        })
      : tr({ id: 'Belum ada data', en: 'No data yet', zh: '暂无数据' })),
    adaFilter && id
      ? h('button.btn.btn-sm', { onClick: bersihkan },
          tr({ id: 'Bersihkan saringan', en: 'Clear filter', zh: '清除筛选' }))
      : null,
  ])));
}

// Angka di samping judul daftar: "137 invoice" biasanya, "23 dari 137 invoice"
// begitu ada saringan yang menyala.
//
// Bentuk "X dari Y" itu bukan hiasan. Daftar yang tersaring jadi 3 baris
// TERLIHAT PERSIS SAMA dengan daftar yang memang cuma punya 3 baris — dan yang
// membacanya sebagai yang kedua akan menyimpulkan datanya hilang. Angka
// pembanding di sebelahnya menjawab pertanyaan itu sebelum sempat ditanyakan.
export function hitunganSaring(tampil, total, kata) {
  const teks = tampil === total
    ? tr({ id: `${total} ${kata.id}`, en: `${total} ${kata.en}`, zh: `${total} ${kata.zh}` })
    : tr({
        id: `${tampil} dari ${total} ${kata.id}`,
        en: `${tampil} of ${total} ${kata.en}`,
        zh: `${total} 中的 ${tampil} ${kata.zh}`,
      });
  return h('span', {
    style: { fontSize: '11px', color: tampil === total ? 'var(--text-3)' : 'var(--accent)' },
  }, teks);
}
