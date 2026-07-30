import { h } from '../core/dom.js';
import { getState, setState } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, sectionHead, badge, btn } from '../ui/components.js';
import { money, fmtDate, daysUntil, sumByCurrency, moneyMulti } from '../core/format.js';
import { outstandingPOs } from '../core/outstanding.js';

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
  else if (u.role === 'cenjc') body = observerBody(st);
  // Still a real fallback: an unknown role reaching here gets the header and
  // nothing else rather than a thrown error. main.js already refuses to render
  // any screen for a role missing from ACCESS, so this is the second net.
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
  if (u.role === 'cenjc') {
    // Navigation only — every destination is read-only for this account.
    return [
      btn('Approval', { iconName: 'check', onClick: () => setState({ screen: 'approval' }) }),
      btn('Surat Jalan', { iconName: 'box', onClick: () => setState({ screen: 'surat-jalan' }) }),
      btn('Reports', { iconName: 'rep', variant: 'primary', onClick: () => setState({ screen: 'reports' }) }),
    ];
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
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [chartCard(st), dueCard(st, dueSoon)]),
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

// MONITORING VIEW — for an account whose whole job is to see where things are
// stuck, and which can change none of it.
//
// Deliberately different from every other body on this screen: the others answer
// "what should I do next", filtering activity to the viewer's own username. This
// one answers "where is the pipeline blocked", so it shows EVERY user's activity
// and counts documents by how long they have been waiting rather than by who
// owns them. Filtering by username here would have made the account useless.
function observerBody(st) {
  const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
  const overdueInv = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));
  const unpaidPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const ppkekOpen = st.ppkek.filter(r => r.status !== 'Closed');
  // Undelivered goods, from the same source Surat Jalan uses — never a second
  // implementation, so the two screens cannot disagree about what is outstanding.
  const outstanding = outstandingPOs(st);
  // `r.status`, matching labelStock.js's own BUY NOW tab exactly — the tracker's
  // status field, not the recomputed one, so this tile and that tab can never
  // report different numbers for the same data.
  const buyNow = (st.labelStock || []).filter(r => r.status === 'BUY NOW');

  // Age of the oldest thing waiting in each queue — the number that actually
  // says whether a queue is moving.
  const ageOf = iso => { const d = daysUntil(iso); return isNaN(d) ? null : -d; };
  const oldestPending = pending
    .map(p => ageOf(p.createdAt)).filter(v => v != null)
    .reduce((a, b) => Math.max(a, b), 0);
  const oldestPrf = unpaidPrf
    .map(p => ageOf(p.createdAt)).filter(v => v != null)
    .reduce((a, b) => Math.max(a, b), 0);

  const stuck = [
    { label: 'PO menunggu approval Wilbert', n: pending.length, sub: pending.length ? `paling lama ${oldestPending} hari` : 'kosong', screen: 'approval' },
    { label: 'PO barang belum lengkap dikirim', n: outstanding.length, sub: `${outstanding.reduce((a, x) => a + x.lines.filter(l => l.outstanding > 0).length, 0)} baris item`, screen: 'surat-jalan' },
    { label: 'Invoice lewat jatuh tempo', n: overdueInv.length, sub: overdueInv.length ? moneyMulti(sumByCurrency(overdueInv)) : 'kosong', screen: 'payment' },
    { label: 'PRF belum dibayar', n: unpaidPrf.length, sub: unpaidPrf.length ? `${moneyMulti(sumByCurrency(unpaidPrf))} · paling lama ${oldestPrf} hari` : 'kosong', screen: 'finance' },
    { label: 'PPKEK belum Closed', n: ppkekOpen.length, sub: `${ppkekOpen.filter(r => r.status === 'Open').length} belum costing`, screen: 'ppkek' },
    { label: 'SKU label perlu dibeli', n: buyNow.length, sub: buyNow.length ? 'status BUY NOW di tracker' : 'stok aman', screen: 'label-stock' },
  ];

  return [
    h('div.grid.g4', [
      stat('PO menunggu approval', String(pending.length), pending.length ? `paling lama ${oldestPending} hari` : 'antrian kosong', !!pending.length),
      stat('Invoice overdue', String(overdueInv.length), overdueInv.length ? moneyMulti(sumByCurrency(overdueInv)) : 'tidak ada'),
      stat('PRF belum lunas', String(unpaidPrf.length), unpaidPrf.length ? moneyMulti(sumByCurrency(unpaidPrf)) : 'tidak ada'),
      stat('PPKEK belum Closed', String(ppkekOpen.length), `${ppkekOpen.filter(r => r.status === 'Open').length} belum costing`),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      card([
        sectionHead(h('div.row.gap8', ['Yang sedang nyangkut', badge('Read-only', 'gray', { iconName: 'eye' })]), null),
        ...stuck.map(row => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }, onClick: () => setState({ screen: row.screen }) }, [
          h('div.grow', [
            h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, row.label),
            h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, row.sub),
          ]),
          badge(String(row.n), row.n ? 'amber' : 'green'),
        ])),
      ]),
      // EVERY user, not just this one — see the note above this function.
      activityCard(st.audit.slice(0, 8)),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      chartCard(st),
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

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Real last-6-calendar-months IDR PO totals, derived from st.pos — this used
// to be a hardcoded literal array (never wired to any data, seed or real).
// Only sums IDR POs, matching the chart's own "IDR miliar" axis label; this
// doesn't attempt multi-currency aggregation (out of scope here — see B1's
// sumByCurrency/moneyMulti for the pattern this would follow if that's ever
// wanted for this chart specifically).
function chartCard(st) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: MONTHS_ID[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  const totals = months.map(m => st.pos
    .filter(p => p.currency === 'IDR')
    .filter(p => { const d = new Date(p.createdAt); return !isNaN(d) && d.getMonth() === m.month && d.getFullYear() === m.year; })
    .reduce((s, p) => s + (p.total || 0), 0) / 1e9);
  const max = Math.max(...totals, 0);
  const hasData = totals.some(v => v > 0);

  return card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } }, [
        h('div.card-title', t('dash_po_value')),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, 'IDR miliar'),
      ]),
      hasData
        ? h('div.row', { style: { alignItems: 'flex-end', gap: '26px', height: '150px', marginTop: '16px', padding: '0 8px' } }, months.map((m, i) => {
            const barPx = max > 0 ? Math.max(4, Math.round((totals[i] / max) * 120)) : 4;
            const isLast = i === months.length - 1;
            return h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, [
              h('span.mono', { style: { fontSize: '10px', color: isLast ? 'var(--accent-tx)' : 'var(--text-3)' } }, totals[i].toFixed(1)),
              h('div', { style: { width: '100%', maxWidth: '46px', height: barPx + 'px', background: isLast ? 'var(--accent)' : 'var(--bar)', opacity: isLast ? 1 : 0.55, borderRadius: '5px 5px 2px 2px' } }),
              h('span', { style: { fontSize: '10px', fontWeight: 600, color: 'var(--text-3)' } }, m.label),
            ]);
          }))
        : h('div', { style: { padding: '48px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' } }, 'Belum ada data PO'),
    ]),
  ]);
}
