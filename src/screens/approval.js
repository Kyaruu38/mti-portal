import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon } from '../ui/components.js';
import { money, fmtDate } from '../core/format.js';
import { poDocument } from '../ui/documents.js';
import { can } from '../auth/roles.js';
import { downloadBlob } from '../core/dom.js';
import { requestPoDelete, approvePoDelete, rejectPoDelete, updatePoStatus, UUID_RE } from '../core/posApi.js';

// Only POs mirrored to Supabase (real UUID id, see labelRequest.js/poConverter.js
// genPO()/genConverterPO()) have a backing row the delete-request RPCs can act
// on — a PO that only exists locally (e.g. server sync failed at creation) has
// no row to request/approve/reject deletion of.

export function approvalScreen() {
  const st = getState();
  const list = st.pos.filter(p => p.status === 'Menunggu Approval' || p.status === 'Approved' || p.status === 'Rejected');
  const selId = st.ui.selPO || (list[0] && list[0].id);
  const po = st.pos.find(p => p.id === selId) || list[0];
  const isWilbert = can(st.user.role, 'approve');

  const approve = async () => {
    po.status = 'Approved'; po.approvedAt = new Date().toISOString(); po.approvedBy = st.user.username;
    logAudit({ entity: 'po', target: po.no, action: 'approve', detail: 'seal & signature embedded' });
    toast(`PO ${po.no} approved — seal & tanda tangan diterapkan`);
    setState({});
    if (UUID_RE.test(po.id)) {
      try { await updatePoStatus(po.id, { status: po.status, approvedBy: po.approvedBy, approvedAt: po.approvedAt }); }
      catch (e) { console.error('Supabase PO status sync failed', e); toast('Approve tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e)); }
    }
  };
  const reject = async () => {
    const note = st.ui.rejectNote || '';
    po.status = 'Rejected'; po.rejectNote = note; po.rejectedBy = st.user.username; po.rejectedAt = new Date().toISOString();
    logAudit({ entity: 'po', target: po.no, action: 'reject', detail: note });
    toast(`PO ${po.no} rejected — dikembalikan ke ${po.by}`);
    setUI({ rejectOpen: false, rejectNote: '' });
    if (UUID_RE.test(po.id)) {
      try { await updatePoStatus(po.id, { status: po.status, rejectNote: note }); }
      catch (e) { console.error('Supabase PO status sync failed', e); toast('Reject tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e)); }
    }
  };
  const requestDelete = async () => {
    const reason = prompt('Alasan hapus PO ini?');
    if (!reason) return;
    try {
      await requestPoDelete(po.id, reason);
      po.deleteRequested = true; po.deleteReason = reason;
      logAudit({ entity: 'po', target: po.no, action: 'request_delete', detail: reason });
      toast(`Request hapus PO ${po.no} diajukan — menunggu approval Wilbert`);
      setState({});
    } catch (e) { console.error(e); toast('Gagal ajukan request hapus: ' + (e.message || e)); }
  };
  const approveDelete = async () => {
    try {
      await approvePoDelete(po.id);
      const idx = st.pos.indexOf(po);
      if (idx >= 0) st.pos.splice(idx, 1);
      logAudit({ entity: 'po', target: po.no, action: 'approve_delete' });
      toast(`PO ${po.no} dihapus`);
      setUI({ selPO: null });
    } catch (e) { console.error(e); toast('Gagal approve hapus: ' + (e.message || e)); }
  };
  const rejectDelete = async () => {
    try {
      await rejectPoDelete(po.id);
      po.deleteRequested = false; po.deleteReason = null;
      logAudit({ entity: 'po', target: po.no, action: 'reject_delete' });
      toast(`Request hapus PO ${po.no} ditolak`);
      setState({});
    } catch (e) { console.error(e); toast('Gagal reject hapus: ' + (e.message || e)); }
  };
  const downloadFinal = () => {
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    downloadBlob(new Blob([html], { type: 'text/html' }), `${po.no.replace(/\//g, '-')}-final.html`);
    toast('PO final (capped) diunduh');
  };
  const downloadPdf = () => {
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    const w = window.open('', '_blank');
    if (!w) { toast('Popup diblokir — izinkan popup dulu buat Save PDF'); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
  };

  const listPanel = card([
    h('div.card-head', [h('div.card-title', t('ap_pending')), badge(String(st.pos.filter(p => p.status === 'Menunggu Approval').length), 'accent')]),
    ...list.map(p => {
      const active = p.id === po.id;
      const tone = p.status === 'Approved' ? 'green' : p.status === 'Rejected' ? 'red' : 'amber';
      const label = p.status === 'Approved' ? t('ap_approved').split('—')[0] : p.status === 'Rejected' ? 'Rejected' : t('dash_awaiting_you');
      return h('div', {
        style: { padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: active ? 'var(--sel-row)' : 'transparent', borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent' },
        onClick: () => setUI({ selPO: p.id, rejectOpen: false }),
      }, [
        h('div.row', { style: { justifyContent: 'space-between' } }, [h('span.mono', { style: { fontSize: '11.8px', fontWeight: 700 } }, p.no), h('span', { style: { fontSize: '9.5px', color: 'var(--text-3)' } }, fmtDate(p.createdAt))]),
        h('div', { style: { fontSize: '11.8px', color: 'var(--text-2)', marginTop: '3px' } }, p.supplier),
        h('div.row', { style: { justifyContent: 'space-between', marginTop: '7px' } }, [h('span.mono', { style: { fontSize: '12px', fontWeight: 600 } }, money(p.total, p.currency)), badge(label, tone)]),
        h('div', { style: { fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' } }, `${t('ap_submitted_by')} ${p.by}`),
      ]);
    }),
    list.length ? null : h('div', { style: { padding: '18px', fontSize: '12px', color: 'var(--text-3)' } }, '—'),
  ]);

  if (!po) return h('div.stack', [listPanel]);

  const actions = po.status === 'Approved'
    ? [badge(t('ap_approved'), 'green', { iconName: 'check' }), btn('Download PDF', { variant: 'primary', iconName: 'download', onClick: downloadPdf }), btn('Download HTML', { iconName: 'download', onClick: downloadFinal })]
    : po.status === 'Rejected'
      ? [badge(t('ap_rejected'), 'red')]
      : isWilbert
        ? [btn(t('ap_reject'), { variant: 'danger', onClick: () => setUI({ rejectOpen: !st.ui.rejectOpen }) }), btn(t('ap_approve'), { variant: 'primary', iconName: 'check', onClick: approve })]
        : [badge(t('ap_awaiting'), 'amber')];

  const canRequestDelete = UUID_RE.test(po.id) && !po.deleteRequested && (po.by === st.user.username || isWilbert);
  if (canRequestDelete) actions.push(btn('Request Delete', { variant: 'danger', onClick: requestDelete }));

  const deleteBanner = po.deleteRequested
    ? h('div', { style: { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--st-red-bg)' } }, [
        h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--st-red-tx)' } }, `Request hapus menunggu approval — alasan: ${po.deleteReason || '-'}`),
        isWilbert ? h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '8px' } }, [
          btn('Reject', { sm: true, onClick: rejectDelete }),
          h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: approveDelete }, 'Approve & Hapus'),
        ]) : null,
      ])
    : null;

  const previewPanel = card([
    h('div.card-head', [
      h('div', [h('div.card-title', t('ap_preview')), h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, po.contract || po.no)]),
      h('div.mla.row.gap8', actions),
    ]),
    deleteBanner,
    st.ui.rejectOpen ? h('div', { style: { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--st-red-bg)' } }, [
      h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--st-red-tx)', marginBottom: '7px' } }, t('ap_reject_note')),
      h('textarea.input', { rows: 2, placeholder: 'Contoh: harga unit naik vs kontrak — minta renegosiasi…', onInput: e => setUI({ rejectNote: e.target.value }) }),
      h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '8px' } }, [
        btn(t('cancel'), { sm: true, onClick: () => setUI({ rejectOpen: false }) }),
        h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: reject }, t('ap_reject_confirm')),
      ]),
    ]) : null,
    h('div', { style: { background: 'var(--bg)', padding: '26px', display: 'flex', justifyContent: 'center' }, class: 'paper-scroll' }, poDocument(po)),
  ]);

  return h('div.grid', { style: { gridTemplateColumns: '330px 1fr', alignItems: 'start' } }, [listPanel, previewPanel]);
}

export function wrapPrintable(inner, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;display:flex;justify-content:center;padding:20px}.mono{font-family:'IBM Plex Mono',monospace}table{border-collapse:collapse;width:100%}</style>
</head><body>${inner}</body></html>`;
}
