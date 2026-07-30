import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, modal, field, inputEl, selectEl } from '../ui/components.js';
import { money, num, fmtDate, ppnFor } from '../core/format.js';
import { newLineId } from '../core/posApi.js';
import { poDocument } from '../ui/documents.js';
import { can } from '../auth/roles.js';
import { downloadBlob } from '../core/dom.js';
import { requestPoDelete, approvePoDelete, rejectPoDelete, updatePoStatus, updatePO, UUID_RE } from '../core/posApi.js';

// Reject-note draft. Lives OUTSIDE the store on purpose: writing it into
// st.ui via setUI() on every keystroke rebuilt the DOM mid-type and truncated
// the note to one character (see the textarea in previewPanel below).
const rejectDraft = { note: '' };

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

  // SERVER FIRST, then local state.
  //
  // This used to flip po.status = 'Approved' + setState() BEFORE awaiting
  // updatePoStatus(), and a failed/RLS-denied write only produced a
  // "tersimpan lokal" toast with no rollback. Because poDocument() stamps the
  // company chop purely on po.status === 'Approved' (ui/documents.js), a write
  // the server REJECTED still produced a fully sealed, downloadable PO PDF.
  // RLS cannot defend a client-rendered artifact — the ordering is the defence.
  const approve = async () => {
    const patch = { status: 'Approved', approvedAt: new Date().toISOString(), approvedBy: st.user.username };
    if (UUID_RE.test(po.id)) {
      try {
        await updatePoStatus(po.id, patch);
      } catch (e) {
        console.error('Supabase PO approve failed — nothing changed', e);
        toast('Approve DITOLAK server, PO tidak berubah: ' + (e.message || e));
        return;
      }
    }
    Object.assign(po, patch);
    logAudit({ entity: 'po', target: po.no, action: 'approve', detail: 'seal & signature embedded' });
    toast(`PO ${po.no} approved — seal & tanda tangan diterapkan`);
    setState({});
  };
  const reject = async () => {
    const note = (rejectDraft.note || '').trim();
    if (!note) { toast('Alasan reject wajib diisi'); return; }
    // Server first, same reasoning as approve() above.
    if (UUID_RE.test(po.id)) {
      try {
        await updatePoStatus(po.id, { status: 'Rejected', rejectNote: note });
      } catch (e) {
        console.error('Supabase PO reject failed — nothing changed', e);
        toast('Reject DITOLAK server, PO tidak berubah: ' + (e.message || e));
        return;
      }
    }
    rejectDraft.note = '';
    po.status = 'Rejected'; po.rejectNote = note; po.rejectedBy = st.user.username; po.rejectedAt = new Date().toISOString();
    logAudit({ entity: 'po', target: po.no, action: 'reject', detail: note });
    toast(`PO ${po.no} rejected — dikembalikan ke ${po.by}`);
    setUI({ rejectOpen: false });
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

  if (!po) return h('div.stack', [listPanel, st.ui.poEdit ? poEditModal() : null]);

  const actions = po.status === 'Approved'
    ? [badge(t('ap_approved'), 'green', { iconName: 'check' }), btn('Download PDF', { variant: 'primary', iconName: 'download', onClick: downloadPdf }), btn('Download HTML', { iconName: 'download', onClick: downloadFinal }), isWilbert ? btn('Edit', { iconName: 'edit', onClick: () => openPoEdit(po) }) : null]
    : po.status === 'Rejected'
      ? [badge(t('ap_rejected'), 'red')]
      : isWilbert
        ? [btn(t('ap_reject'), { variant: 'danger', onClick: () => setUI({ rejectOpen: !st.ui.rejectOpen }) }), btn(t('ap_approve'), { variant: 'primary', iconName: 'check', onClick: approve }), btn('Edit', { iconName: 'edit', onClick: () => openPoEdit(po) })]
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
      // NO setUI per keystroke. setUI schedules a full mount() rebuild, which
      // replaced this very <textarea> after the first character — focus fell to
      // <body> and every rejection reason was recorded as a single letter
      // ("h" for "harga unit naik vs kontrak"). The note is written to a plain
      // module-level holder and read by reject(); nothing needs to re-render
      // while the user types.
      h('textarea.input', {
        rows: 2,
        placeholder: 'Contoh: harga unit naik vs kontrak — minta renegosiasi…',
        value: rejectDraft.note,
        onInput: e => { rejectDraft.note = e.target.value; },
      }),
      h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '8px' } }, [
        btn(t('cancel'), { sm: true, onClick: () => { rejectDraft.note = ''; setUI({ rejectOpen: false }); } }),
        h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: reject }, t('ap_reject_confirm')),
      ]),
    ]) : null,
    h('div', { style: { background: 'var(--bg)', padding: '26px', display: 'flex', justifyContent: 'center' }, class: 'paper-scroll' }, poDocument(po)),
  ]);

  return h('div.stack', [
    h('div.grid', { style: { gridTemplateColumns: '330px 1fr', alignItems: 'start' } }, [listPanel, previewPanel]),
    st.ui.poEdit ? poEditModal() : null,
  ]);
}

// Edit PO in-place (wilbert-only, gated in the actions array above). Content
// edit, not a workflow transition — status is deliberately never touched here.
// items are recomputed live via direct DOM writes (amount cells + totals),
// NOT via setUI() per keystroke: mount() has no diffing and rebuilds the
// whole tree on every setUI(), which would drop keyboard focus after every
// character typed into qty/price (same class of bug suratJalan.js's
// qtyInput comment documents and avoids). Only structural changes (add/
// remove a line, open/close the modal) go through setUI().
function computeTotals(items, ppnMode) {
  const subtotal = items.reduce((s, it) => s + (it.a || 0), 0);
  // ppnFor() compares against the DOMAIN value 'paid'. This used to test the
  // FORM value 'bayar', which po.ppnMode never holds — so every saved edit
  // silently rewrote ppn to 0 and dropped the stored total by 11% while the
  // printed PO still showed the tax. Same helper as ui/documents.js now.
  const ppn = ppnFor(subtotal, ppnMode);
  return { subtotal, ppn, total: subtotal + ppn };
}

function openPoEdit(po) {
  setUI({ poEdit: {
    ref: po,
    supplier: po.supplier, supplierZh: po.supplierZh, currency: po.currency,
    terms: po.terms || '', contract: po.contract || '',
    items: po.items.map(it => ({ ...it })), // copy — don't mutate po.items until Save
  } });
}

function poEditModal() {
  const st = getState(); const f = st.ui.poEdit; const po = f.ref;
  const unitOpts = st.units.length ? st.units.map(u => ({ value: u.code, label: u.intl ? `${u.code} · ${u.intl}` : u.code })) : ['张', '条', '千克kg', 'set'];

  const amountCells = [];
  let subtotalEl, ppnEl, totalEl;
  const recompute = () => {
    f.items.forEach((it, i) => {
      it.a = (Number(it.qty) || 0) * (Number(it.u) || 0);
      if (amountCells[i]) amountCells[i].textContent = num(it.a, f.currency === 'USD' ? 2 : 0);
    });
    const { subtotal, ppn, total } = computeTotals(f.items, po.ppnMode);
    if (subtotalEl) subtotalEl.textContent = money(subtotal, f.currency);
    if (ppnEl) ppnEl.textContent = money(ppn, f.currency);
    if (totalEl) totalEl.textContent = money(total, f.currency);
  };

  const itemRows = f.items.map((it, i) => {
    const amountCell = h('span.mono', num(it.a, f.currency === 'USD' ? 2 : 0));
    amountCells[i] = amountCell;
    return h('div.row.gap8', { style: { alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' } }, [
      h('div', { style: { flex: '2' } }, inputEl({ value: it.d || '', placeholder: 'Deskripsi', onInput: v => { it.d = v; } })),
      h('div', { style: { width: '70px' } }, inputEl({ value: String(it.qty || 0), mono: true, onInput: v => { it.qty = Number(v) || 0; recompute(); } })),
      h('div', { style: { width: '90px' } }, inputEl({ value: String(it.u || 0), mono: true, onInput: v => { it.u = Number(v) || 0; recompute(); } })),
      h('div', { style: { width: '130px' } }, selectEl(unitOpts, { value: it.unit, onChange: v => { it.unit = v; } })),
      h('div', { style: { width: '90px', textAlign: 'right' } }, amountCell),
      btn('Hapus', { sm: true, variant: 'danger', onClick: () => { f.items.splice(i, 1); setUI({}); } }),
    ]);
  });

  const { subtotal: subtotal0, ppn: ppn0, total: total0 } = computeTotals(f.items, po.ppnMode);
  subtotalEl = h('span.mono', money(subtotal0, f.currency));
  ppnEl = h('span.mono', money(ppn0, f.currency));
  totalEl = h('span.mono', { style: { fontWeight: 800 } }, money(total0, f.currency));

  return modal({
    title: `Edit PO — ${po.no}`, width: 760, onClose: () => setUI({ poEdit: null }),
    body: [
      h('div.grid.g2', [
        field('Supplier (English)', inputEl({ value: f.supplier, onInput: v => { f.supplier = v; } })),
        field('Supplier (原文)', inputEl({ value: f.supplierZh, onInput: v => { f.supplierZh = v; } })),
      ]),
      h('div.grid.g2', [
        field('Currency', selectEl(['IDR', 'USD', 'CNY', 'EUR'], { value: f.currency, onChange: v => { f.currency = v; recompute(); } })),
        field('Terms', selectEl(['Payment in Advance', 'TOP 3', 'TOP 14', 'TOP 30', 'TOP 45', 'TOP 60'], { value: f.terms, onChange: v => { f.terms = v; } })),
      ]),
      field('Contract No', inputEl({ value: f.contract, mono: true, onInput: v => { f.contract = v; } })),
      h('div', [
        h('div.card-title', { style: { marginBottom: '8px' } }, 'Line Items'),
        h('div.row.gap8', { style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', paddingBottom: '6px' } }, [
          h('div', { style: { flex: '2' } }, 'Desc'), h('div', { style: { width: '70px' } }, 'Qty'), h('div', { style: { width: '90px' } }, 'Price'),
          h('div', { style: { width: '130px' } }, 'Unit'), h('div', { style: { width: '90px', textAlign: 'right' } }, 'Amount'), h('div', { style: { width: '58px' } }),
        ]),
        ...itemRows,
        // Opaque id minted here, not left empty: two lines added in one edit
        // used to both carry lineId '' and collide on the same shipment key.
        btn('Tambah Baris', { sm: true, iconName: 'plus', onClick: () => { f.items.push({ erp: '', d: '', dimension: '', cn: '', qty: 0, u: 0, a: 0, unit: '', lineId: newLineId() }); setUI({}); } }),
      ]),
      h('div.stack', { style: { gap: '4px', alignItems: 'flex-end', fontSize: '12.5px' } }, [
        h('div.row.gap8', [h('span', 'Subtotal'), subtotalEl]),
        h('div.row.gap8', [h('span', 'PPN'), ppnEl]),
        h('div.row.gap8', [h('span', { style: { fontWeight: 800 } }, 'TOTAL'), totalEl]),
      ]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ poEdit: null }) }), btn(t('save'), { variant: 'primary', onClick: () => savePoEdit() })],
  });
}

async function savePoEdit() {
  const st = getState(); const f = st.ui.poEdit; const po = f.ref;
  f.items.forEach(it => { it.a = (Number(it.qty) || 0) * (Number(it.u) || 0); });
  const { subtotal, ppn, total } = computeTotals(f.items, po.ppnMode);

  // A COMMERCIAL change to an already-approved PO invalidates the approval.
  // Previously status was left untouched no matter what changed, so an Approved
  // PO could be re-priced from 10,000,000 to 500,000,000 and the regenerated
  // PDF still carried the chop — with nothing re-entering the approval queue.
  // Cosmetic edits (supplier spelling, contract no.) don't trigger this.
  const commercialChange = po.status === 'Approved' && (
    subtotal !== po.subtotal || total !== po.total ||
    f.currency !== po.currency || f.terms !== po.terms ||
    JSON.stringify(f.items.map(i => [i.d, i.qty, i.u, i.unit])) !==
      JSON.stringify((po.items || []).map(i => [i.d, i.qty, i.u, i.unit]))
  );

  const before = { status: po.status, approvedBy: po.approvedBy, approvedAt: po.approvedAt };
  po.supplier = f.supplier; po.supplierZh = f.supplierZh; po.currency = f.currency;
  po.terms = f.terms; po.contract = f.contract; po.items = f.items;
  po.subtotal = subtotal; po.ppn = ppn; po.total = total;
  if (commercialChange) {
    po.status = 'Menunggu Approval';
    po.approvedBy = null; po.approvedAt = null;
  }
  // Same UUID gate as approve/reject/requestDelete: a local-only PO (no server
  // row yet) has nothing to sync.
  if (UUID_RE.test(po.id)) {
    try {
      await updatePO(po.id, po);
    } catch (e) {
      console.error('Supabase PO edit sync failed', e);
      Object.assign(po, before);   // don't leave the approval reset applied locally
      toast('Gagal simpan edit PO ke server: ' + (e.message || e));
      return; // keep the modal open so nothing is lost
    }
  }
  logAudit({
    entity: 'po', target: po.no, action: 'edit',
    detail: `Edit isi PO oleh ${st.user.username} — total baru ${money(po.total, po.currency)}`
      + (commercialChange ? ' · APPROVAL DIRESET, PO masuk antrean lagi' : ''),
  });
  toast(commercialChange
    ? 'PO diperbarui — nilai berubah, approval direset & masuk antrean Wilbert lagi'
    : 'PO diperbarui');
  setUI({ poEdit: null });
  setState({});
}

// Escape for an HTML text context. There is no shared escaper in this codebase
// because everything else builds DOM through h(), which uses createTextNode and
// is therefore injection-safe by construction. wrapPrintable is the one place
// that concatenates a raw string into markup.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// `title` is derived from a user-typed document number (poNoField / sj.no), so
// it was an injection sink: a PO number of `</title><img src=x onerror=…>`
// executed inside a same-origin popup that inherits the Supabase session.
// The document BODY is safe (built by h()), so this was the whole gap.
//
// The inline <style> is the ONLY stylesheet this popup gets — print.css is not
// loaded here — so the page-break and colour-fidelity rules have to be repeated
// below or they simply don't apply on the actual PDF path.
export function wrapPrintable(inner, title, orientation = 'portrait') {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
@page{size:A4 ${orientation};margin:10mm}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;display:flex;justify-content:center;padding:20px}
.mono{font-family:'IBM Plex Mono',monospace}
table{border-collapse:collapse;width:100%}
/* Keep MTI navy/orange rules + table header shading even with Chrome's
   "Background graphics" unchecked (the default). */
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
/* Never split a Surat Jalan item card, or any table row, across pages. */
.sj-item,.p-keep{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
</style>
</head><body>${inner}</body></html>`;
}
