// Notifications are derived LIVE from st.audit (already logged by every module
// via logAudit()) — no separate parallel event store to keep in sync. Read
// state is a single session-only watermark (state.ui.notifReadAt); there is no
// localStorage, so unread state intentionally does not survive reload/logout.
import { daysUntil } from './format.js';
import { tr } from '../i18n/index.js';

export function notificationsFor(st, user) {
  const role = user.role;
  let items = [];

  if (role === 'cania' || role === 'visca') {
    items = st.audit.filter(a => a.entity === 'po' && (a.action === 'approve' || a.action === 'reject') &&
      st.pos.some(p => p.no === a.target && p.by === user.username));
  } else if (role === 'sekar') {
    items = st.audit.filter(a =>
      (a.entity === 'prf' && a.action === 'finance_receive' && st.prfs.some(p => p.no === a.target && p.by === user.username)) ||
      (a.entity === 'prf' && a.action === 'mark_paid' && st.prfs.some(p => p.no === a.target && p.by === user.username)));
  } else if (role === 'financemti') {
    items = st.audit.filter(a => a.entity === 'prf' && a.action === 'create');
    items = items.concat(st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0).map(i => ({
      id: 'ov_' + i.id, at: i.due, user: 'system', entity: 'invoice', action: 'overdue', target: i.no, detail: i.supplier,
    })));
  } else if (role === 'wilbert') {
    items = st.audit.filter(a => a.entity === 'po' && a.action !== 'approve' && a.action !== 'reject');
  }

  return items.slice().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
}

export function unreadCount(st, user) {
  const readAt = st.ui.notifReadAt || 0;
  return notificationsFor(st, user).filter(n => new Date(n.at) > new Date(readAt)).length;
}

// Which screen a notification row should navigate to on click.
export function notifTargetScreen(n, user) {
  // 'label-request' itu tebakan lama dari zaman sebelum ada layar PO untuk
  // pembuatnya: cania menekan "PO ... disetujui" di lonceng lalu mendarat di
  // layar yang tidak ada hubungannya dengan PO itu. Sekarang ada tujuan yang
  // benar.
  if (n.entity === 'po') return user.role === 'wilbert' ? 'approval' : 'po-saya';
  // Diantar ke layar PRF-nya sendiri, bukan ke Payment yang PRF-nya ada di
  // bagian bawah. Lonceng yang mendarat di layar yang salah membuat orangnya
  // mencari sendiri — dan itu persis yang seharusnya dihemat oleh lonceng.
  if (n.entity === 'prf') return user.role === 'financemti' ? 'finance' : 'prf';
  if (n.entity === 'invoice') return 'finance';
  return null;
}

export function notifMessage(n) {
  const m = {
    po_approve: { id: 'PO {target} disetujui', en: 'PO {target} approved', zh: '采购单 {target} 已批准' },
    po_reject: { id: 'PO {target} ditolak', en: 'PO {target} rejected', zh: '采购单 {target} 已拒绝' },
    prf_finance_receive: { id: 'PRF {target} diterima Finance', en: 'PRF {target} received by Finance', zh: '付款申请单 {target} 财务已接收' },
    prf_mark_paid: { id: 'PRF {target} sudah dibayar', en: 'PRF {target} has been paid', zh: '付款申请单 {target} 已付款' },
    prf_create: { id: 'PRF baru {target} diterima', en: 'New PRF {target} received', zh: '收到新的付款申请单 {target}' },
    invoice_overdue: { id: 'Invoice {target} ({detail}) overdue', en: 'Invoice {target} ({detail}) is overdue', zh: '发票 {target}（{detail}）已逾期' },
  };
  const key = `${n.entity}_${n.action}`;
  const tmpl = m[key] ? tr(m[key]) : `${n.entity} ${n.action} — ${n.target || ''}`;
  return tmpl.replace('{target}', n.target || '').replace('{detail}', n.detail || '');
}
