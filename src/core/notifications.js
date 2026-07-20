// Notifications are derived LIVE from st.audit (already logged by every module
// via logAudit()) — no separate parallel event store to keep in sync. Read
// state is a single session-only watermark (state.ui.notifReadAt); there is no
// localStorage, so unread state intentionally does not survive reload/logout.
import { daysUntil } from './format.js';

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
  if (n.entity === 'po') return user.role === 'wilbert' ? 'approval' : 'label-request';
  if (n.entity === 'prf') return user.role === 'financemti' ? 'finance' : 'payment';
  if (n.entity === 'invoice') return 'finance';
  return null;
}

export function notifMessage(n) {
  const m = {
    po_approve: 'PO {target} disetujui', po_reject: 'PO {target} ditolak',
    prf_finance_receive: 'PRF {target} diterima Finance', prf_mark_paid: 'PRF {target} sudah dibayar',
    prf_create: 'PRF baru {target} diterima', invoice_overdue: 'Invoice {target} ({detail}) overdue',
  };
  const key = `${n.entity}_${n.action}`;
  const tmpl = m[key] || `${n.entity} ${n.action} — ${n.target || ''}`;
  return tmpl.replace('{target}', n.target || '').replace('{detail}', n.detail || '');
}
