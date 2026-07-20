import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, checkRow, driveLink, statusTone } from '../ui/components.js';
import { money, num, fmtDate, fmtDateTime, daysUntil, similarity, normalize, sumByCurrency, moneyMulti } from '../core/format.js';
import { parsePaymentProof } from '../parsers/bankProof.js';
import { uploadToDrive } from '../core/drive.js';
import { can } from '../auth/roles.js';

export function financeScreen() {
  const st = getState(); const ui = st.ui;
  const canReceive = can(st.user.role, 'financeReceive');
  const canPay = can(st.user.role, 'markPaid');

  // Overdue: invoices received-not-paid past due. Totaled PER CURRENCY — never merged.
  const overdue = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const overdueTotals = sumByCurrency(overdue);
  const banner = overdue.length ? h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', justifyContent: 'flex-start' } }, [
    icon('warn', 17), h('div.grow', [h('b', `${overdue.length} ${t('fn_overdue_banner')}`), ` — total ${moneyMulti(overdueTotals)}. Tertua: ${overdue[0].supplier} (${overdue[0].no}).`]),
  ]) : null;

  const prfIn = card([
    h('div.card-head', [h('div.card-title', t('fn_prf_in')), badge(String(st.prfs.filter(p => p.stage === 'Diproses Wilbert' || p.stage === 'Diterima Finance').length), 'accent')]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['PRF No', 'Dari', t('col_supplier'), t('col_amount'), 'Ccy', 'Kelengkapan', t('col_action')].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', st.prfs.map(p => {
        const done = Object.values(p.receiveChecklist || {}).filter(Boolean).length;
        const received = p.stage === 'Diterima Finance' || p.stage === 'Paid';
        return h('tr', [
          h('td.mono.cell-strong', p.no), h('td', p.by), h('td', p.supplier),
          h('td.mono.r', num(p.amount, p.currency === 'USD' ? 2 : 0)),
          h('td', badge(p.currency, p.currency === 'USD' ? 'accent' : 'navy')),
          h('td', received ? badge(`Diterima ✓ ${done}/4`, 'green') : badge('Menunggu checklist', 'amber')),
          h('td', p.stage === 'Paid' ? badge('Paid', 'green') : (received ? h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, fmtDateTime(p.createdAt)) : (canReceive ? btn(t('fn_receive'), { sm: true, variant: 'primary', onClick: () => setUI({ receiveModal: p.id }) }) : badge('Menunggu Finance', 'amber')))),
        ]);
      })),
    ])),
  ]);

  const dz = dropzone({ title: t('fn_drop_proof'), sub: t('fn_drop_proof_sub'), accept: '.pdf', iconName: 'upload', compact: true, onFiles: f => handleProof(f[0]) });
  const matchPanel = ui.proofMatch ? matchCard(ui.proofMatch) : (ui.proofManual ? manualCard(ui.proofManual) : card([h('div.card-pad', { style: { minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span', { style: { fontSize: '12px', color: 'var(--text-3)' } }, t('fn_no_proof')))]));

  return h('div.stack', [
    banner,
    prfIn,
    h('div.grid', { style: { gridTemplateColumns: '1fr 1.5fr' } }, [dz, matchPanel]),
    historyCard(st),
    ui.receiveModal ? receiveModal(ui.receiveModal) : null,
  ]);
}

function receiveModal(prfId) {
  const st = getState(); const prf = st.prfs.find(p => p.id === prfId); if (!prf) return null;
  const cl = prf.receiveChecklist;
  const count = Object.values(cl).filter(Boolean).length;
  const ok = count === 4;
  return modal({
    title: t('fn_receive_modal'), subtitle: `${prf.no} · ${prf.supplier} · ${money(prf.amount, prf.currency)}`, width: 480, onClose: () => setUI({ receiveModal: null }),
    body: [
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, t('fn_checklist_sub')),
      checkRow(cl.a, t('fn_chk_prf'), 'Signed payment request form', () => { cl.a = !cl.a; setState({}); }),
      checkRow(cl.b, t('fn_chk_inv'), 'Salinan invoice supplier', () => { cl.b = !cl.b; setState({}); }),
      checkRow(cl.c, t('fn_chk_faktur'), 'Tax invoice', () => { cl.c = !cl.c; setState({}); }),
      checkRow(cl.d, t('fn_chk_erp'), 'Bukti entry ERP INA', () => { cl.d = !cl.d; setState({}); }),
    ],
    footer: [
      h('span', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', marginRight: 'auto' } }, [t('fn_completeness') + ' ', h('span.mono', { style: { color: 'var(--accent-tx)' } }, `${count}/4`)]),
      btn(t('cancel'), { onClick: () => setUI({ receiveModal: null }) }),
      btn(t('fn_receive_btn'), { variant: 'primary', disabled: !ok, onClick: () => { prf.stage = 'Diterima Finance'; prf.receivedAt = new Date().toISOString(); logAudit({ entity: 'prf', target: prf.no, action: 'finance_receive', detail: '4/4' }); setUI({ receiveModal: null }); toast(`${prf.no} diterima Finance — kelengkapan 4/4`); } }),
    ],
  });
}

async function handleProof(file) {
  if (!file) return;
  toast(t('loading'));
  try {
    const res = await parsePaymentProof(file);
    const st = getState();
    if (res.manual) { setUI({ proofManual: { file, fields: res.fields }, proofMatch: null }); return; }
    // Auto-match to a received PRF by amount + fuzzy payee (+PO no when available).
    const candidates = st.prfs.filter(p => p.stage === 'Diterima Finance');
    let best = null, bestScore = 0;
    for (const p of candidates) {
      let score = 0;
      if (Math.abs(p.amount - res.fields.amount) < 1) score += 0.6;
      score += 0.3 * similarity(p.supplier, res.fields.beneficiary);
      if (res.fields.poNo && (p.invoices || []).some(x => x.includes(res.fields.poNo))) score += 0.2;
      // PO no triple-match via linked POs
      if (res.fields.poNo && st.pos.some(po => po.contract === res.fields.poNo && po.supplier === p.supplier)) score += 0.15;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    const up = await uploadToDrive(file, 'Payments/', file.name);
    setUI({ proofMatch: { file, fields: res.fields, template: res.templateLabel, prf: best, confidence: Math.min(0.99, bestScore), driveUrl: up.url }, proofManual: null });
    if (!best) toast('Bukti terparse tapi tidak ada PRF cocok — pilih manual');
  } catch (e) { console.error(e); toast('Parse bukti gagal: ' + e.message); }
}

function matchCard(m) {
  const canPay = can(getState().user.role, 'markPaid');
  if (!m.prf) return manualCard({ file: m.file, fields: m.fields });
  return card([
    h('div.card-pad', { style: { border: '1.5px solid var(--accent)', borderRadius: '12px' } }, [
      h('div.row.gap8', [badge(t('fn_automatch'), 'accent'), h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${m.template || 'proof'} · ${m.file.name}`), h('span.mla', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--st-green-tx)' } }, `Confidence ${Math.round(m.confidence * 100)}%`)]),
      h('div', { style: { fontSize: '14px', fontWeight: 800, marginTop: '12px' } }, `Matched: ${m.prf.no} — ${m.prf.supplier}`),
      h('div.mono', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', marginTop: '4px' } }, `${money(m.fields.amount, m.fields.currency)} · ${m.fields.date}${m.fields.poNo ? ' · ' + m.fields.poNo : ''}`),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '8px' } }, `Nominal ${Math.abs(m.prf.amount - m.fields.amount) < 1 ? 'sama persis' : 'beda'} · payee match ${Math.round(similarity(m.prf.supplier, m.fields.beneficiary) * 100)}%${m.fields.poNo ? ' · PO ' + m.fields.poNo : ''}`),
      h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '14px' } }, [
        btn(t('fn_pick_other'), { onClick: () => { setUI({ proofManual: { file: m.file, fields: m.fields }, proofMatch: null }); } }),
        btn(t('fn_confirm_paid'), { variant: 'primary', disabled: !canPay, onClick: () => confirmPaid(m) }),
      ]),
    ]),
  ]);
}

function manualCard(m) {
  const canPay = can(getState().user.role, 'markPaid');
  const f = m.fields;
  return card([h('div.card-pad', [
    h('div.row.gap8', [badge(t('fn_manual_proof'), 'amber', { iconName: 'warn' }), h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, m.file.name)]),
    h('div.grid.g3', { style: { marginTop: '12px' } }, [
      h('div', [h('div.field-label', t('fn_proof_amount')), h('input.input.mono', { value: f.amount || '', onInput: e => (f.amount = Number(e.target.value.replace(/[,\s]/g, '')) || 0) })]),
      h('div', [h('div.field-label', t('fn_proof_payee')), h('input.input', { value: f.beneficiary || '', onInput: e => (f.beneficiary = e.target.value) })]),
      h('div', [h('div.field-label', t('fn_proof_date')), h('input.input.mono', { value: f.date || '', onInput: e => (f.date = e.target.value) })]),
    ]),
    h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '14px' } }, [
      btn(t('fn_confirm_paid'), { variant: 'primary', disabled: !canPay, onClick: () => {
        const st = getState();
        const match = st.prfs.find(p => p.stage === 'Diterima Finance' && Math.abs(p.amount - f.amount) < 1) || st.prfs.find(p => p.stage === 'Diterima Finance');
        if (!match) { toast('Tidak ada PRF cocok'); return; }
        confirmPaid({ file: m.file, fields: f, prf: match, driveUrl: '' });
      } }),
    ]),
  ])]);
}

async function confirmPaid(m) {
  const st = getState(); const prf = m.prf;
  prf.stage = 'Paid'; prf.paidAt = new Date().toISOString();
  st.payments.unshift({ id: uid('pay'), date: new Date().toISOString(), prf: prf.no, supplier: prf.supplier, amount: prf.amount, currency: prf.currency, method: m.template || 'transfer', driveUrl: m.driveUrl || '' });
  // Mark linked invoices paid.
  (prf.invoices || []).forEach(no => { const inv = st.invoices.find(i => i.no === no); if (inv) inv.status = 'Paid'; });
  logAudit({ entity: 'prf', target: prf.no, action: 'mark_paid', detail: money(prf.amount, prf.currency) });
  setUI({ proofMatch: null, proofManual: null });
  toast(`Pembayaran dikonfirmasi — ${prf.no} ditandai PAID`);
}

function historyCard(st) {
  return card([
    h('div.card-head', [h('div.card-title', t('fn_history')), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, 'bukti tersimpan di Drive')]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_date'), 'PRF', t('col_supplier'), t('col_amount'), 'Metode', 'Bukti'].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', st.payments.map(p => h('tr', [
        h('td.mono', fmtDate(p.date)), h('td.mono.cell-strong', p.prf), h('td', p.supplier),
        h('td.mono.r', money(p.amount, p.currency)), h('td', p.method), h('td', driveLink(p.driveUrl)),
      ]))),
    ])),
  ]);
}
