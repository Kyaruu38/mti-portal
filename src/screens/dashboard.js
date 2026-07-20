import { h } from '../core/dom.js';
import { getState, setState } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, sectionHead, badge, btn } from '../ui/components.js';
import { money, fmtDate, daysUntil, sumByCurrency, moneyMulti } from '../core/format.js';

function stat(label, value, sub, accent) {
  return card([
    h('div.stat-label', label),
    h('div.stat-num', { style: accent ? { color: 'var(--accent-tx)' } : {} }, value),
    h('div.stat-sub', sub),
  ], { pad: true });
}

const sameMonth = (d) => { const dt = new Date(d); const now = new Date(); return !isNaN(dt) && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); };

export function dashboardScreen() {
  const st = getState();
  const u = st.user;

  const header = h('div.row.wrap', { style: { alignItems: 'flex-end', justifyContent: 'space-between' } }, [
    h('div', [
      h('h1.page-h1', `${t('dash_greeting')}, ${u.name.split(' ')[0]}`),
      h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' } }, `${fmtDate(new Date())} · WIB · KEK Kendal`),
    ]),
    h('div.row.gap8.wrap', quickActions(st, u)),
  ]);

  let body;
  if (u.role === 'wilbert') body = wilbertBody(st);
  else if (u.role === 'cania' || u.role === 'visca') body = labelPoBody(st, u);
  else if (u.role === 'sekar') body = sekarBody(st);
  else if (u.role === 'financemti') body = financeBody(st);
  else body = [];

  return h('div.stack', [header, ...body]);
}

function quickActions(st, u) {
  if (u.role === 'wilbert') {
    const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
    return [
      btn(t('quick_label'), { iconName: 'upload', onClick: () => setState({ screen: 'label-request' }) }),
      btn(t('quick_po_pdf'), { iconName: 'rep', onClick: () => setState({ screen: 'po-converter' }) }),
      btn(t('quick_review_appr') + (pending.length ? ` (${pending.length})` : ''), { variant: 'primary', onClick: () => setState({ screen: 'approval' }) }),
    ];
  }
  if (u.role === 'cania' || u.role === 'visca') {
    return [
      btn(t('quick_label'), { iconName: 'upload', onClick: () => setState({ screen: 'label-request' }) }),
      btn(t('quick_po_pdf'), { iconName: 'rep', onClick: () => setState({ screen: 'po-converter' }) }),
    ];
  }
  if (u.role === 'sekar') {
    return [
      btn(t('s_ppkek'), { iconName: 'box', onClick: () => setState({ screen: 'ppkek' }) }),
      btn(t('s_payment'), { iconName: 'card', onClick: () => setState({ screen: 'payment' }) }),
    ];
  }
  if (u.role === 'financemti') {
    return [btn(t('s_finance'), { iconName: 'dollar', variant: 'primary', onClick: () => setState({ screen: 'finance' }) })];
  }
  return [];
}

function wilbertBody(st) {
  const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));
  const unpaidPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const ppkekMonth = st.ppkek.length;

  return [
    h('div.grid.g4', [
      stat(t('dash_po_pending'), String(pending.length), `${pending.length} menunggu`, true),
      stat(t('dash_inv_due'), String(dueSoon.length), `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`),
      stat(t('dash_prf_unpaid'), String(unpaidPrf.length), moneyMulti(sumByCurrency(unpaidPrf))),
      stat(t('dash_ppkek_month'), String(ppkekMonth), `${st.ppkek.filter(p => p.status === 'Open').length} menunggu costing`),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      card([
        sectionHead(h('div.row.gap8', [t('dash_pending_mine'), badge(String(pending.length), 'accent')]),
          h('a.link', { onClick: () => setState({ screen: 'approval' }) }, t('dash_open_queue') + ' →')),
        ...pending.map(p => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)' } }, [
          h('div.grow', [
            h('div.mono', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, p.no),
            h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' } }, `${p.supplier} · dari ${p.by}`),
          ]),
          h('div.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(p.total, p.currency)),
          badge(t('dash_awaiting_you'), 'amber'),
          btn(t('dash_review'), { sm: true, onClick: () => setState({ screen: 'approval', ui: { ...st.ui, selPO: p.id } }) }),
        ])),
        pending.length ? null : h('div', { style: { padding: '18px', color: 'var(--text-3)', fontSize: '12px' } }, 'Tidak ada PO menunggu approval.'),
      ]),
      activityCard(st.audit.slice(0, 6)),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [chartCard(), dueCard(st, dueSoon)]),
  ];
}

function labelPoBody(st, u) {
  const myPending = st.pos.filter(p => p.by === u.username && p.status === 'Menunggu Approval');
  const myBatches = st.labelBatches.filter(b => b.by === u.username);
  const missingDesign = st.items.filter(i => !st.designs.some(d => d.erp === i.erp));

  return [
    h('div.grid.g4', [
      stat(t('dash_my_po_pending'), String(myPending.length), `${myPending.length} menunggu approval Wilbert`, true),
      stat(t('dash_new_labels'), String(myBatches.length), 'upload label request saya'),
      stat(t('dash_missing_design'), String(missingDesign.length), 'item tanpa desain di library'),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      card([
        sectionHead(h('div.row.gap8', [t('dash_my_pending_list'), badge(String(myPending.length), 'accent')]), null),
        ...myPending.map(p => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)' } }, [
          h('div.grow', [
            h('div.mono', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, p.no),
            h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' } }, p.supplier),
          ]),
          h('div.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(p.total, p.currency)),
          badge(t('ap_awaiting'), 'amber'),
        ])),
        myPending.length ? null : h('div', { style: { padding: '18px', color: 'var(--text-3)', fontSize: '12px' } }, 'Tidak ada PO Anda yang menunggu approval.'),
      ]),
      activityCard(st.audit.filter(a => a.user === u.username).slice(0, 6)),
    ]),
  ];
}

function sekarBody(st) {
  const ppkekMonth = st.ppkek.filter(p => sameMonth(p.date));
  const outstandingPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));

  return [
    h('div.grid.g4', [
      stat(t('dash_ppkek_month'), String(ppkekMonth.length), `${ppkekMonth.filter(p => p.status === 'Open').length} menunggu costing`, true),
      stat(t('dash_prf_outstanding'), String(outstandingPrf.length), moneyMulti(sumByCurrency(outstandingPrf))),
      stat(t('dash_inv_due'), String(dueSoon.length), `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      activityCard(st.audit.filter(a => a.user === st.user.username).slice(0, 6)),
    ]),
  ];
}

function financeBody(st) {
  const receivedMonth = st.prfs.filter(p => p.receivedAt && sameMonth(p.receivedAt));
  const overdue = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const outstanding = st.prfs.filter(p => p.stage !== 'Paid');
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));

  return [
    h('div.grid.g4', [
      stat(t('dash_prf_received_month'), String(receivedMonth.length), 'diterima bulan ini', true),
      stat(t('dash_overdue_total'), String(overdue.length), moneyMulti(sumByCurrency(overdue))),
      stat(t('dash_prf_unpaid'), String(outstanding.length), moneyMulti(sumByCurrency(outstanding))),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      activityCard(st.audit.slice(0, 6)),
    ]),
  ];
}

function activityCard(items) {
  return card([
    h('div.card-head', h('div.card-title', t('dash_recent'))),
    h('div', { style: { padding: '6px 18px 14px' } }, items.length ? items.map((a, i) => h('div.row.gap8', { style: { padding: '9px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' } }, [
      h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: 'var(--st-blue-tx)', marginTop: '5px', flexShrink: 0 } }),
      h('div.grow', { style: { fontSize: '11.8px', color: 'var(--text-2)', lineHeight: 1.45 } }, [
        h('b', { style: { color: 'var(--text)' } }, a.user), ' ', `${a.action} — ${a.target || a.detail || ''}`,
      ]),
      h('span.mono', { style: { fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' } }, fmtDate(a.at)),
    ])) : h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, '—')),
  ]);
}

function dueCard(st, dueSoon) {
  return card([
    sectionHead(t('dash_due_soon'), h('a.link', { onClick: () => setState({ screen: st.user.role === 'financemti' ? 'finance' : 'payment' }) }, 'Payment →')),
    h('div', { style: { padding: '4px 18px 12px' } }, dueSoon.slice(0, 4).map(i => {
      const d = daysUntil(i.due);
      const tone = d < 0 ? 'red' : d <= 1 ? 'amber' : 'gray';
      const lbl = d < 0 ? `Overdue ${-d}h` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : fmtDate(i.due);
      return h('div.row.gap8', { style: { padding: '10px 0', borderBottom: '1px solid var(--border)' } }, [
        h('div.grow', [h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, i.supplier), h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, i.no)]),
        h('div.mono', { style: { fontSize: '12px', fontWeight: 600 } }, money(i.amount, i.currency)),
        badge(lbl, tone),
      ]);
    })),
    dueSoon.length ? null : h('div', { style: { padding: '16px 18px', fontSize: '12px', color: 'var(--text-3)' } }, '—'),
  ]);
}

function chartCard() {
  const bars = [['Feb', 78, 3.1], ['Mar', 64, 2.6], ['Apr', 94, 3.8], ['Mei', 84, 3.4], ['Jun', 104, 4.2], ['Jul', 120, 4.8]];
  return card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } }, [
        h('div.card-title', t('dash_po_value')),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, 'IDR miliar'),
      ]),
      h('div.row', { style: { alignItems: 'flex-end', gap: '26px', height: '150px', marginTop: '16px', padding: '0 8px' } }, bars.map((b, i) => h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, [
        h('span.mono', { style: { fontSize: '10px', color: i === 5 ? 'var(--accent-tx)' : 'var(--text-3)' } }, String(b[2])),
        h('div', { style: { width: '100%', maxWidth: '46px', height: b[1] + 'px', background: i === 5 ? 'var(--accent)' : 'var(--bar)', opacity: i === 5 ? 1 : 0.55, borderRadius: '5px 5px 2px 2px' } }),
        h('span', { style: { fontSize: '10px', fontWeight: 600, color: 'var(--text-3)' } }, b[0]),
      ]))),
    ]),
  ]);
}
