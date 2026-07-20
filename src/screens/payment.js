import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, statusTone } from '../ui/components.js';
import { money, num, fmtDate, romanMonth, daysUntil, topDays, addDays } from '../core/format.js';
import { prfPaper } from '../ui/documents.js';
import { can } from '../auth/roles.js';
import { wrapPrintable } from './approval.js';
import { downloadBlob } from '../core/dom.js';
import { nextPrfNo } from '../core/docSeqApi.js';

const STAGES = ['Diterima Purchasing', 'Diproses Wilbert', 'Diterima Finance', 'Paid'];

export function paymentScreen() {
  const st = getState(); const ui = st.ui;
  // "paymentReadonly" means the FINANCE stage (Diterima Finance/Paid) is
  // read-only for this role — enforced by RLS on prfs.stage, not by blocking
  // purchasing-side work here. sekar has paymentWrite=true and is the primary
  // user of this screen (intake invoices, hand to Wilbert, build PRFs), so it
  // must NOT disable invoice hand-off or PRF creation — only informs the badge.
  const readonly = can(st.user.role, 'paymentReadonly');

  // Faktur reminder ONLY when linked PO has PPN=Dibayar (paid) and faktur missing.
  const needFaktur = st.invoices.filter(i => !i.faktur && poPpnPaid(i) && i.status !== 'Paid');
  const banner = (ui.pfBannerClosed ? [] : needFaktur.slice(0, 1)).map(inv => h('div.cfg-banner', { style: { justifyContent: 'flex-start' } }, [
    icon('warn', 17), h('div.grow', [h('b', t('pay_faktur_warn'))]),
    btn(t('pay_upload_faktur'), { sm: true, onClick: () => { inv.faktur = '010.005-26.' + Math.floor(Math.random() * 1e8); toast('Faktur pajak terupload'); setState({}); } }),
    btn(t('pay_continue_anyway'), { sm: true, variant: 'primary', onClick: () => { setUI({ pfBannerClosed: true }); toast('Diproses tanpa faktur pajak — ditandai follow-up'); } }),
  ]));

  const dz = dropzone({ title: t('pay_drop_inv'), sub: t('pay_faktur_reminder'), accept: '.pdf', iconName: 'upload', compact: true, onFiles: f => handleInvoice(f[0]) });

  const flow = card([h('div.card-pad', [
    h('div.row.gap8', [h('div.card-title', t('pay_flow')), readonly ? badge(t('pay_readonly'), 'gray', { iconName: 'eye' }) : null]),
    h('div.row.gap8.wrap', { style: { marginTop: '12px' } }, STAGES.flatMap((s, i) => [
      badge(`${i + 1} · ${trStage(s)}`, ['gray', 'amber', 'blue', 'green'][i]),
      i < 3 ? icon('arrowR', 13, { stroke: 'var(--text-3)' }) : null,
    ])),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '10px' } }, 'Invoice masuk PRF hanya setelah min. "Diproses Wilbert" · PRF USD & IDR terpisah per currency'),
  ])]);

  return h('div.stack', [
    ...banner,
    h('div.grid', { style: { gridTemplateColumns: '1fr 1.6fr' } }, [dz, flow]),
    invoiceTable(st),
    prfBuilder(st),
    ui.prfModal ? prfModal() : null,
  ]);
}

function poPpnPaid(inv) { const po = getState().pos.find(p => p.no.includes(inv.poRef.replace('PO ', '')) || (p.contract && inv.poRef.includes(p.contract))); return po ? po.ppnMode === 'paid' : inv.ppnPaid; }
function trStage(s) { const m = { 'Diterima Purchasing': t('st_diterima_purchasing'), 'Diproses Wilbert': t('st_diproses_wilbert'), 'Diterima Finance': t('st_diterima_finance'), 'Paid': t('st_paid') }; return m[s] || s; }

function invoiceTable(st) {
  const head = h('thead', h('tr', ['Invoice', t('col_supplier'), 'PO Ref', t('col_amount'), t('col_due'), t('pay_faktur'), t('col_status')].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c))));
  const body = h('tbody', st.invoices.map(inv => {
    const d = daysUntil(inv.due);
    const dueTone = inv.status === 'Paid' ? '' : d < 0 ? 'red' : d <= 1 ? 'amber' : '';
    // Handing off to Wilbert is purchasing-side work (sekar's job), not a
    // finance-stage mutation — not gated by the finance "readonly" cap.
    const canAdvance = inv.status === 'Diterima Purchasing';
    return h('tr', { style: inv.status === 'Diterima Purchasing' && !inv.faktur && poPpnPaid(inv) ? { background: 'var(--st-amber-bg)' } : {} }, [
      h('td.mono.cell-strong', inv.no),
      h('td', inv.supplier),
      h('td.mono', { style: { color: 'var(--text-3)' } }, inv.poRef),
      h('td.mono.r', money(inv.amount, inv.currency)),
      h('td.mono', { style: dueTone ? { color: `var(--st-${dueTone}-tx)`, fontWeight: 700 } : {} }, inv.status === 'Paid' ? 'paid' : fmtDate(inv.due) + (d < 0 ? ` · overdue ${-d}h` : '')),
      h('td', inv.faktur ? h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } }, [icon('check', 11, { strokeWidth: 2.5 }), ' ', inv.faktur]) : badge(t('pay_faktur_missing'), 'amber', { iconName: 'warn' })),
      h('td', h('div.row.gap8', [
        badge(trStage(inv.status), statusTone(inv.status)),
        canAdvance ? btn(t('handed_wilbert'), { sm: true, onClick: () => { inv.status = 'Diproses Wilbert'; logAudit({ entity: 'invoice', target: inv.no, action: 'handed_wilbert' }); toast(`${inv.no} → Diproses Wilbert`); setState({}); } }) : null,
      ])),
    ]);
  }));
  return h('div.card', [h('div.card-head', [h('div.card-title', t('pay_inv_in')), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.invoices.length} invoice`)]), h('div.tbl-wrap', h('table.tbl', [head, body]))]);
}

function prfBuilder(st) {
  const ui = st.ui;
  const supplierId = ui.prfSupplierId || (st.suppliers[0] || {}).id;
  const supplierObj = st.suppliers.find(s => s.id === supplierId) || st.suppliers[0] || {};
  const supplier = supplierObj.name;
  // Outstanding invoices for supplier: at least "Diproses Wilbert", not Paid, not already PRF'd.
  const prfInvoiceNos = new Set(st.prfs.flatMap(p => p.invoices || []));
  const allOut = st.invoices.filter(i => i.supplier === supplier && i.status !== 'Paid' && i.status !== 'Diterima Purchasing' && !prfInvoiceNos.has(i.no));
  // A PRF is ONE currency only. Group by currency; user picks which when >1.
  const currencies = [...new Set(allOut.map(i => i.currency))];
  const currency = (ui.prfCcy && currencies.includes(ui.prfCcy)) ? ui.prfCcy : (currencies[0] || 'IDR');
  const outstanding = allOut.filter(i => i.currency === currency);
  const sel = ui.prfSel || {};                       // keyed by invoice.no
  const chosen = outstanding.filter(inv => sel[inv.no]);
  const sum = chosen.reduce((s, x) => s + x.amount, 0);

  return h('div.card', [
    h('div.card-head', [h('div.card-title', t('pay_prf_builder')), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, t('pay_prf_builder_sub'))]),
    h('div.row.gap8.wrap', { style: { padding: '13px 16px', borderBottom: '1px solid var(--border)' } }, [
      h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' } }, t('pay_supplier') + ':'),
      h('select.input', { style: { width: 'auto', minWidth: '260px' }, onChange: e => setUI({ prfSupplierId: e.target.value, prfSel: {}, prfCcy: null }) }, st.suppliers.map(s => h('option', { value: s.id, selected: s.id === supplierId }, s.name))),
      // Currency selector — enforces one currency per PRF (never mixed).
      ...(currencies.length > 1
        ? currencies.map(c => h('button.btn.btn-sm' + (c === currency ? '.btn-navy' : ''), { onClick: () => setUI({ prfCcy: c, prfSel: {} }) }, c))
        : [badge(currency, ccyTone(currency))]),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('pay_ccy_detected')),
    ]),
    ...(outstanding.length ? outstanding.map((inv) => h('div.row.gap12', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', background: sel[inv.no] ? 'var(--sel-row)' : 'transparent', cursor: 'pointer' }, onClick: () => { const s = { ...sel }; s[inv.no] = !s[inv.no]; setUI({ prfSel: s }); } }, [
      h('input', { type: 'checkbox', checked: !!sel[inv.no], style: { accentColor: 'var(--accent)' } }),
      h('div.grow', [h('div.mono', { style: { fontSize: '12px', fontWeight: 600 } }, inv.no), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, inv.poRef)]),
      h('span.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, 'due ' + fmtDate(inv.due)),
      h('span.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(inv.amount, inv.currency)),
    ])) : [h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, 'Tidak ada invoice outstanding untuk supplier ini (harus min. "Diproses Wilbert").')]),
    h('div.row.gap14', { style: { padding: '13px 16px', background: 'var(--surface2)' } }, [
      h('div', { style: { fontSize: '12.5px', fontWeight: 800 } }, [h('span.mono', { style: { color: 'var(--accent-tx)' } }, String(chosen.length)), ` invoice · Total `, h('span.mono', money(sum, currency))]),
      badge(currency, ccyTone(currency)),
      h('div.mla', btn(t('pay_preview_prf') + ' →', { variant: 'primary', disabled: !chosen.length, onClick: () => openPrf(chosen, currency, supplier) })),
    ]),
  ]);
}

function ccyTone(c) { return { USD: 'accent', EUR: 'blue', CNY: 'amber', IDR: 'navy' }[c] || 'gray'; }

async function openPrf(chosen, currency, supplierName) {
  const st = getState();
  const supplier = st.suppliers.find(s => s.name === supplierName);
  const prefix = `PRF/PC/${romanMonth()}/`;
  let no;
  try {
    no = await nextPrfNo(st.prfs, romanMonth(), new Date().getFullYear(), prefix);
  } catch (e) {
    console.error('nextPrfNo failed', e);
    toast('Gagal generate nomor PRF dari server: ' + (e.message || e));
    return;
  }
  const lines = chosen.map(inv => ({ no: inv.no, desc: descFor(inv), amount: inv.amount }));
  setUI({ prfModal: true, prfDraft: { no, supplier, supplierName, currency, amount: chosen.reduce((s, x) => s + x.amount, 0), invoices: chosen.map(i => i.no), lines, by: st.user.username, createdAt: new Date().toISOString(), stage: 'Terbentuk', receiveChecklist: { a: false, b: false, c: false, d: false } } });
}

// Learning bilingual description dictionary: prefill from prior entries.
function descFor(inv) {
  const st = getState();
  const po = st.pos.find(p => (p.contract && inv.poRef.includes(p.contract)) || p.no.includes((inv.poRef || '').replace('PO ', '')));
  const hint = po && po.items[0] ? po.items[0].d : inv.poRef;
  const dictHit = st.descDict.find(d => hint && (hint.includes(d.en) || (d.zh && hint.includes(d.zh))));
  return dictHit ? `${dictHit.en} / ${dictHit.zh}` : hint;
}

function prfModal() {
  const st = getState(); const d = st.ui.prfDraft;
  return modal({
    title: t('prf_preview'), width: 640, onClose: () => setUI({ prfModal: false }),
    body: [
      h('div', { style: { background: 'var(--bg)', padding: '20px', borderRadius: '10px' } }, prfPaper(d, d.supplier, d.lines)),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, [icon('warn', 11), ' ', t('prf_bank_from_master'), ' · ', t('prf_desc_hint')]),
    ],
    footer: [
      btn(t('close'), { onClick: () => setUI({ prfModal: false }) }),
      btn('PDF', { iconName: 'download', onClick: () => { const html = wrapPrintable(prfPaper(d, d.supplier, d.lines).outerHTML, d.no); downloadBlob(new Blob([html], { type: 'text/html' }), `${d.no.replace(/\//g, '-')}.html`); toast('PRF diunduh (HTML siap print → PDF)'); } }),
      btn(t('prf_send_wilbert'), { variant: 'primary', onClick: () => submitPrf() }),
    ],
  });
}

function submitPrf() {
  const st = getState(); const d = st.ui.prfDraft;
  // Learn descriptions.
  d.lines.forEach(l => { const parts = String(l.desc).split('/').map(s => s.trim()); if (parts.length === 2 && !st.descDict.some(x => x.en === parts[0])) st.descDict.push({ en: parts[0], zh: parts[1] }); });
  const prf = { id: uid('prf'), ...d, supplier: d.supplierName, stage: 'Diproses Wilbert' };
  delete prf.supplierName;
  st.prfs.unshift(prf);
  logAudit({ entity: 'prf', target: prf.no, action: 'create', detail: `${prf.invoices.length} invoices · ${money(prf.amount, prf.currency)}` });
  setUI({ prfModal: false, prfSel: {} });
  toast(`${prf.no} dibuat & dikirim ke Wilbert untuk approval`);
}
