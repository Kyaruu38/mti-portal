// Reusable UI building blocks (built on the h() hyperscript).
import { h, svg, wireDrop } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { setState, getState } from '../core/store.js';
import { t } from '../i18n/index.js';

export function icon(name, size = 15, extra) { return svg(ICONS[name] || '', size, extra); }

export function btn(label, { variant = '', iconName, onClick, disabled, sm } = {}) {
  const cls = ['btn', variant === 'primary' ? 'btn-primary' : '', variant === 'navy' ? 'btn-navy' : '',
    variant === 'danger' ? 'btn-danger-o' : '', sm ? 'btn-sm' : ''].filter(Boolean).join(' ');
  return h('button', { class: cls, onClick, disabled }, [
    iconName ? icon(iconName, sm ? 12 : 13) : null,
    label,
  ]);
}

export function iconBtn(iconName, { onClick, title, badge } = {}) {
  return h('button.icon-btn', { onClick, title }, [
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
export function dropzone({ title, sub, accept, multiple, onFiles, iconName = 'upload', compact }) {
  const dz = h('div.dropzone', compact ? { style: { minHeight: '150px', padding: '20px' } } : { style: { minHeight: '220px' } }, [
    h('span.dz-icon', icon(iconName, 20)),
    h('div', { style: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' } }, title),
    sub ? h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, sub) : null,
  ]);
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

export function inputEl({ value = '', placeholder, mono, type = 'text', onInput, id } = {}) {
  return h('input.input' + (mono ? '.mono' : ''), { value, placeholder, type, id, onInput: onInput ? (e) => onInput(e.target.value, e) : null });
}

// Editable "No PO" field with a non-blocking duplicate warning. The warning
// is checked on blur and written straight to the warning element (no setUI,
// no re-render) — mount() rebuilds the whole DOM tree on every state change,
// which would risk dropping a click on a button the user clicks straight to
// from this field (see suratJalan.js qtyInput for the same lesson). Never
// disables anything — this only informs, per the "warn, don't block" rule.
export function poNoField(f, key = 'no') {
  const warn = h('div', { style: { fontSize: '10.5px', color: 'var(--st-amber-tx)', marginTop: '4px', display: 'none' } }, '⚠ No PO ini sudah pernah ada — pastikan tidak dobel.');
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
