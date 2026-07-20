import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, poNoField } from '../ui/components.js';
import { parseZcPo } from '../parsers/zcPoPdf.js';
import { money, num } from '../core/format.js';
import { insertPO } from '../core/posApi.js';

export function poConverterScreen() {
  const st = getState(); const ui = st.ui;
  const res = ui.cvResult;

  const dz = dropzone({ title: t('cv_drop'), sub: '.pdf — text-based', accept: '.pdf', iconName: 'rep', onFiles: f => handlePdf(f[0]) });

  if (!res) return h('div.stack', [card([h('div.card-pad', dz)])]);
  if (res.scanned) {
    return h('div.stack', [
      h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [icon('warn', 15), t('cv_reject_scan')]),
      card([h('div.card-pad', dz)]),
    ]);
  }

  const statusBar = h('div.card', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px' } }, [
    h('span', { style: { width: '36px', height: '36px', borderRadius: '50%', background: 'var(--st-green-bg)', color: 'var(--st-green-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, icon('check', 16, { strokeWidth: 2.5 })),
    h('div.grow', [
      h('div.mono', { style: { fontSize: '13px', fontWeight: 700 } }, res.cgdd || res.contractNo || 'PO PDF'),
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, `Parsed · ${res.items.length} line items · ${res.currency} · sumber: ${res.supplierEn || res.supplierZh || '—'}`),
    ]),
    badge('Rule-based parse', 'green'),
    btn('Upload PDF lain', { onClick: () => setUI({ cvResult: null }) }),
    btn(t('cv_send_appr') + ' →', { variant: 'primary', onClick: () => openPopup() }),
  ]);

  const fields = card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', marginBottom: '12px' } }, [h('div.card-title', t('cv_extracted')), h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, [icon('edit', 11), ' ', t('cv_click_edit')])]),
      h('div.col.gap12', [
        editField('CGDD / Contract No', res.contractNo || res.cgdd, v => (res.contractNo = v), true),
        editField('Supplier (原文)', res.supplierZh, v => (res.supplierZh = v)),
        editField('Supplier (English)', res.supplierEn, v => (res.supplierEn = v)),
        h('div.grid.g2', [editField('Currency', res.currency, v => (res.currency = v), true), editField('Incoterm', res.incoterm, v => (res.incoterm = v))]),
        editField('Payment (from PDF)', res.paymentText, v => (res.paymentText = v)),
        h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px' } }, [
          h('div.field-label', `${t('cv_line_items')} · ${res.items.length}`),
          ...res.items.map(li => h('div.row.gap8', { style: { marginBottom: '6px' } }, [
            inputEl({ value: li.descEn || li.desc, onInput: v => (li.descEn = v) }),
            h('select.input', { style: { width: '86px', fontSize: '11px', borderColor: li.unit ? '' : 'var(--st-amber-tx)' }, onChange: e => (li.unit = e.target.value) },
              unitOptions(st, li.unit).map(o => h('option', { value: o.value, selected: o.value === (li.unit || '') }, o.label))),
            h('span.mono', { style: { width: '70px', textAlign: 'right', fontSize: '11px', color: 'var(--text-2)' } }, num(li.qty)),
            h('span.mono', { style: { width: '80px', textAlign: 'right', fontSize: '11px', color: 'var(--text-2)' } }, num(li.amount, res.currency === 'USD' ? 2 : 0)),
          ])),
        ]),
        h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px' } }, [
          row2(t('po_subtotal'), money(res.subtotal, res.currency)),
          row2('PPN (11%)', res.ppnPresent ? (res.ppnSuspended ? 'Ditangguhkan — KEK' : money(res.ppn, res.currency)) : 'Ditangguhkan — KEK'),
          row2(t('po_total'), money(res.total, res.currency), true),
        ]),
      ]),
    ]),
  ]);

  const compare = card([
    h('div.card-pad', [
      h('div.card-title', { style: { marginBottom: '12px' } }, t('cv_orig_gen')),
      h('div.grid.g2', [
        h('div', [badge('ORIGINAL · 中文 PDF', 'gray'), h('div', { style: { marginTop: '8px', aspectRatio: '1/1.32', border: '1px solid var(--border)', borderRadius: '8px', background: 'repeating-linear-gradient(45deg,var(--ph-a) 0 10px,var(--ph-b) 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span.mono', { style: { fontSize: '10px', color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px' } }, res.cgdd || 'contract'))]),
        h('div', [badge('GENERATED · ENGLISH PO', 'green'), genPreview(res)]),
      ]),
      h('div.row.gap8', { style: { marginTop: '12px', background: 'var(--st-green-bg)', borderRadius: '9px', padding: '9px 13px' } }, [icon('check', 13, { stroke: 'var(--st-green-tx)', strokeWidth: 2.5 }), h('span', { style: { fontSize: '11.5px', fontWeight: 600, color: 'var(--st-green-tx)' } }, `${t('cv_valid')} (${money(res.total, res.currency)})`)]),
    ]),
  ]);

  return h('div.stack', [statusBar, h('div.grid', { style: { gridTemplateColumns: '370px 1fr', alignItems: 'start' } }, [fields, compare]), ui.cvPopup ? popup() : null]);
}

function genPreview(res) {
  return h('div', { style: { marginTop: '8px', aspectRatio: '1/1.32', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: 'var(--shadow)', padding: '16px', overflow: 'hidden', color: '#1F2937' } }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #1B3A6B', paddingBottom: '6px' } }, [h('span', { style: { fontSize: '12px', fontWeight: 800, color: '#1B3A6B' } }, 'MTI'), h('span', { style: { fontSize: '8px', fontWeight: 800, letterSpacing: '.18em', color: '#111827' } }, 'PURCHASE ORDER')]),
    h('div.mono', { style: { fontSize: '7.5px', color: '#374151', marginTop: '6px', lineHeight: 1.7 } }, [`Ref: ${res.cgdd}`, h('br'), `Supplier: ${res.supplierEn || res.supplierZh}`, h('br'), `Terms: ${res.paymentText || '—'}`]),
    h('div', { style: { border: '1px solid #D1D5DB', borderRadius: '3px', marginTop: '8px' } }, res.items.slice(0, 4).map(li => h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '6.8px', color: '#374151', padding: '3px 6px', borderBottom: '1px solid #E5E7EB' } }, [h('span', (li.descEn || li.desc || '').slice(0, 34)), h('span.mono', num(li.amount, res.currency === 'USD' ? 2 : 0))]))),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', fontSize: '7.5px', fontWeight: 800, color: '#111827', marginTop: '6px' } }, [h('span', 'TOTAL'), h('span.mono', money(res.total, res.currency))]),
  ]);
}

// Unit is unconstrained here (unlike Label Request's fixed 张) — PO Converter
// handles arbitrary goods, not just tires, so the picker reads from the units
// master with a blank placeholder rather than defaulting to any one value.
// `current` (the item's already-parsed unit, if any) is injected as an extra
// option when it isn't already a master code — the parser's recognized
// tokens (KGM/PCE/ROLL/PC/…) don't all have a matching units-master entry by
// default, and silently dropping a genuinely-parsed value because it's not
// in the master would be worse than the bug this whole fix is closing.
function unitOptions(st, current) {
  const codes = st.units.length ? st.units.map(u => u.code) : ['张', '条', '千克kg', 'set'];
  const opts = [{ value: '', label: '— pilih —' }, ...codes.map(c => ({ value: c, label: c }))];
  if (current && !codes.includes(current)) opts.push({ value: current, label: `${current} (dari PDF)` });
  return opts;
}

function editField(label, value, onInput, mono) { return field(label, inputEl({ value: value || '', mono, onInput })); }
function row2(a, b, strong) { return h('div.row', { style: { justifyContent: 'space-between', fontSize: strong ? '12.5px' : '11.5px', fontWeight: strong ? 800 : 400, color: strong ? 'var(--text)' : 'var(--text-2)' } }, [h('span', a), h('span.mono', b)]); }

async function handlePdf(file) {
  if (!file) return;
  toast(t('loading'));
  try {
    const res = await parseZcPo(file);
    if (!res.ok && res.scanned) { setUI({ cvResult: res }); return; }
    setUI({ cvResult: res });
  } catch (e) { console.error(e); toast('Parse gagal: ' + e.message); }
}

function openPopup() {
  const res = getState().ui.cvResult;
  // Checked here, before the modal opens — the modal is a full-screen
  // overlay, so blocking inside it would strand the user unable to reach the
  // unit dropdowns in the Extracted panel behind it.
  if (res.items.some(li => !li.unit)) { toast('Unit belum dipilih untuk salah satu item — lengkapi dulu di panel Extracted'); return; }
  setUI({ cvPopup: true, cvForm: { no: res.cgdd || res.contractNo || '', terms: 'TOP 45', contract: res.contractNo || res.cgdd || '', ppn: res.ppnSuspended || !res.ppnPresent ? 'kek' : 'bayar' } });
}

function popup() {
  const st = getState(); const f = st.ui.cvForm;
  return modal({
    title: t('cv_send_appr'), subtitle: 'PO Converter → Approval Wilbert', width: 480, onClose: () => setUI({ cvPopup: false }),
    body: [
      field(t('po_contract_no') + ' *', poNoField(f)),
      field(t('po_terms') + ' *', selectEl(['TOP 30', 'TOP 45', 'TOP 60', 'Custom…'], { value: f.terms, onChange: v => (f.terms = v) })),
      field('Contract No (合同号)', inputEl({ value: f.contract, mono: true, onInput: v => (f.contract = v) })),
      field(t('po_ppn'), selectEl([{ value: 'bayar', label: t('po_ppn_paid') }, { value: 'kek', label: t('po_ppn_susp') }], { value: f.ppn, onChange: v => (f.ppn = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ cvPopup: false }) }), btn(t('generate') + ' PO', { variant: 'primary', onClick: () => genConverterPO() })],
  });
}

async function genConverterPO() {
  const st = getState(); const res = st.ui.cvResult; const f = st.ui.cvForm;
  if (!f.no || !f.no.trim()) { toast('No. PO wajib diisi'); return; }
  if (res.items.some(li => !li.unit)) { toast('Unit belum dipilih untuk salah satu item — lengkapi dulu di panel Extracted'); return; }
  const no = f.no.trim();
  const contract = f.contract || '';
  const isWilbert = st.user.role === 'wilbert';
  const items = res.items.map((li, idx) => ({ erp: li.erp, d: li.descEn || li.desc, dimension: li.spec || '', cn: '', qty: li.qty, u: li.price, a: li.amount, unit: li.unit, lineId: '' }));
  const po = {
    id: uid('po'), no, contract, supplier: res.supplierEn || res.supplierZh, supplierZh: res.supplierZh,
    address: res.supplierAddress || '', currency: res.currency, unit: (items[0] && items[0].unit) || '',
    subtotal: res.subtotal, ppn: f.ppn === 'bayar' ? Math.round(res.subtotal * 0.11) : 0,
    ppnMode: f.ppn === 'bayar' ? 'paid' : 'suspended',
    total: res.total, amount: res.total, terms: f.terms.replace('TOP ', '') + ' days after B/L — ref ' + (contract || no),
    delivery: res.incoterm || 'FOB', by: st.user.username, status: isWilbert ? 'Approved' : 'Menunggu Approval',
    createdAt: new Date().toISOString(), source: 'converter',
    contact: res.contact || '', phone: res.phone || '',
    items,
  };
  if (isWilbert) { po.approvedAt = new Date().toISOString(); po.approvedBy = 'wilbert'; }
  try {
    const supabaseId = await insertPO(po);
    if (supabaseId) po.id = supabaseId;
  } catch (e) {
    console.error('insertPO failed — PO stays local-only', e);
    toast('PO tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e));
  }
  po.items.forEach((it, idx) => { it.lineId = `${po.id}:${idx}`; });
  st.pos.unshift(po);
  logAudit({ entity: 'po', target: no, action: 'convert', detail: `from ${contract || no}` });
  setUI({ cvPopup: false, cvResult: null });
  toast(isWilbert ? `PO ${no} dibuat & di-approve` : `PO ${no} dikirim ke approval queue Wilbert`);
  setState({ screen: 'approval' });
}
