import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, checkRow, selectEl, icon, driveLink, modal } from '../ui/components.js';
import { suratJalanPaper } from '../ui/documents.js';
import { romanMonth, nextMonthlySeq, fmtDate, num } from '../core/format.js';
import { outstandingPOs, closeFullyReceivedPOs, receivedQty, overDeliveredPOs } from '../core/outstanding.js';
import { wrapPrintable } from './approval.js';
import { fetchSuratJalan, insertSuratJalan, updateSuratJalan } from '../core/suratJalanApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { isConfigured } from '../core/supabase.js';
import { nextSjNo } from '../core/docSeqApi.js';
import { uploadToDrive } from '../core/drive.js';

function rowKey(poId, lineId) { return `${poId}::${lineId}`; }

// Qty input commits to ui.sjQty on BLUR, not per-keystroke. mount() rebuilds
// the whole DOM tree on every setUI() call, so re-rendering on every
// keystroke would fight the input for focus/characters mid-type; but a pure
// debounce risks losing the last keystroke if the user types-then-instantly-
// submits before the timer fires. Committing on blur guarantees the value is
// flushed to state before any submit button click can fire.
// IMPORTANT: do NOT call setUI() here. Blur fires before the click event when
// the user clicks straight from this field onto another control (e.g. the
// submit button) — a synchronous setUI() would rebuild the whole DOM tree
// (mount() has no diffing) between blur and click, replacing the button the
// browser was about to deliver the click to, silently dropping the click.
// The clamped value is written straight onto the DOM node instead (no
// framework re-render involved), which is safe mid-gesture.
function qtyInput(row, currentValue, canWrite = true) {
  // Plain number when the account cannot ship. A shipped quantity is the input
  // that decides how much of a PO is considered delivered, so it must not be
  // typeable by an observer even though the surrounding table is legitimate
  // reading material.
  if (!canWrite) return h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, String(currentValue));
  return h('input.input.mono', {
    defaultValue: String(currentValue),
    onBlur: e => {
      const st = getState();
      const q = st.ui.sjQty || (st.ui.sjQty = {});
      const clamped = Math.max(0, Math.min(Number(e.target.value) || 0, row.outstanding));
      q[row.key] = clamped;
      e.target.value = String(clamped);
    },
    onKeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
}

// Build the "pulled-in" rows for every outstanding line of the given POs.
function pulledInRows(st, entries) {
  const rows = [];
  entries.forEach(({ po, lines }) => {
    lines.forEach(li => {
      if (li.outstanding <= 0) return;
      const design = st.designs.find(d => (li.d || '').includes(d.spec) || d.erp === li.erp);
      rows.push({
        key: rowKey(po.id, li.lineId), poId: po.id, poNo: po.contract || po.no, lineId: li.lineId,
        erp: design ? design.erp : (li.erp || '—'), name: li.d, dimension: li.dimension || '',
        unit: li.unit || po.unit || '张', outstanding: li.outstanding, ordered: li.qty, received: li.received,
        designUrl: design ? (design.thumb || '') : '', // persisted thumb, not the old session-only blob
        designFull: design ? (design.driveUrl || '') : '', // full design PDF/image on Drive
      });
    });
  });
  return rows;
}

function getQty(ui, row) {
  const v = (ui.sjQty || {})[row.key];
  return v == null ? row.outstanding : Math.max(0, Math.min(Number(v) || 0, row.outstanding));
}

export function suratJalanScreen() {
  const st = getState(); const ui = st.ui;
  // sjWrite, mirroring the sj_rw policy (is_purchasing: wilbert/cania/visca).
  // This file had no capability check at all, so any role holding the screen
  // could ship goods against a PO. The outstanding list itself is legitimate
  // reading material for an observer — only the writes are gated.
  const canWrite = can(st.user.role, 'sjWrite');
  const outstanding = outstandingPOs(st);
  const suppliers = [...new Set(outstanding.map(x => x.po.supplier))];
  const supplier = suppliers.includes(ui.sjSupplier) ? ui.sjSupplier : suppliers[0];
  const supplierPOs = outstanding.filter(x => x.po.supplier === supplier);

  // Surface over-delivery. poOutstanding() computes it, but nothing rendered it,
  // so a PO shipped beyond its ordered qty stayed invisible on every screen.
  const over = overDeliveredPOs(st);
  const overBanner = over.length
    ? h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', display: 'block' } }, [
        h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, [icon('warn', 14), ` ${over.length} PO KELEBIHAN KIRIM — cek ke gudang:`]),
        ...over.slice(0, 6).map(x => h('div.mono', { style: { fontSize: '10.5px' } },
          `• ${x.po.contract || x.po.no} — ${x.po.supplier} — lebih ${x.totalOver}`)),
      ])
    : null;

  const summary = h('div.card', { style: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
    icon('box', 15, { stroke: 'var(--text-3)' }),
    h('span.grow', { style: { fontSize: '12px', color: 'var(--text-2)' } }, `${outstanding.length} PO dengan barang outstanding · ${outstanding.reduce((s, x) => s + x.lines.filter(l => l.outstanding > 0).length, 0)} baris item`),
    isConfigured() ? btn('Refresh dari server', { sm: true, iconName: 'clock', onClick: () => refreshFromServer() }) : null,
  ]);

  if (!suppliers.length) {
    return h('div.stack', [overBanner, summary, card([h('div.card-pad', 'Tidak ada PO dengan barang outstanding untuk dibuat surat jalan.')], { pad: false }), historyCard(st, canWrite)]);
  }

  const poSel = ui.sjPoSel || {};
  const selectedPOs = supplierPOs.filter(x => poSel[x.po.id]);
  const rows = pulledInRows(st, selectedPOs.length ? selectedPOs : []);

  const poChecklist = card([
    h('div.card-head', h('div.card-title', 'Pilih PO (supplier sama)')),
    ...supplierPOs.map(x => checkRow(!!poSel[x.po.id], `${x.po.contract || x.po.no}`, `Outstanding: ${x.lines.filter(l => l.outstanding > 0).length} item`, () => {
      const s = { ...poSel }; s[x.po.id] = !s[x.po.id]; setUI({ sjPoSel: s });
    })),
  ]);

  const itemsTable = rows.length ? h('div.card', [
    h('div.card-head', h('div.card-title', `Item Terpilih · ${rows.length}`)),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['', 'ERP', 'Nama', 'PO', 'Ordered', 'Received', 'Outstanding', 'Qty Kirim'].map(c => h('th', c)))),
      h('tbody', rows.map(r => {
        const itemSel = ui.sjItemSel || {};
        const on = itemSel[r.key] !== false;
        return h('tr', [
          h('td', h('input', { type: 'checkbox', checked: on, onChange: () => { const s = { ...itemSel }; s[r.key] = !on; setUI({ sjItemSel: s }); } })),
          h('td.mono', r.erp), h('td', r.name),
          h('td.mono', { style: { color: 'var(--text-3)' } }, r.poNo),
          h('td.mono.r', num(r.ordered)), h('td.mono.r', num(r.received)), h('td.mono.r', num(r.outstanding)),
          h('td', qtyInput(r, getQty(ui, r), canWrite)),
        ]);
      })),
    ])),
  ]) : null;

  const canGenerate = canWrite && rows.some(r => (ui.sjItemSel || {})[r.key] !== false && getQty(ui, r) > 0);
  const actionBar = h('div.card', { style: { padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' } }, [
    canWrite
      ? btn('Buat Surat Jalan', { variant: 'primary', disabled: !canGenerate, onClick: () => handleGenerateClick(rows) })
      : badge('Read-only — surat jalan dibuat oleh purchasing', 'gray', { iconName: 'eye' }),
  ]);

  const supplierBar = h('div.card', { style: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
    h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' } }, t('col_supplier') + ':'),
    selectEl(suppliers, { value: supplier, onChange: v => setUI({ sjSupplier: v, sjPoSel: {}, sjItemSel: {}, sjQty: {} }) }),
  ]);

  const preview = ui.sjLastId ? previewCard(st, ui.sjLastId) : null;

  return h('div.stack', [overBanner, summary, supplierBar, poChecklist, itemsTable, rows.length ? actionBar : null, preview, historyCard(st, canWrite), ui.sjWarnMissing ? missingDesignModal(ui) : null]);
}

// Design master is empty at rollout on purpose (built now, filled in later —
// see the task this shipped with), so this will warn on every item until
// someone uploads designs; that's expected, not a bug. Gate is on the
// SELECTED/qty>0 subset (same filter createSuratJalan uses below), not every
// pulled-in row — warning about an item that isn't even being shipped this
// time would be a false alarm.
function handleGenerateClick(rows) {
  if (blockWrite('buat surat jalan')) return;
  const ui = getState().ui;
  const selected = rows.filter(r => (ui.sjItemSel || {})[r.key] !== false && getQty(ui, r) > 0);
  const missing = selected.filter(r => !r.designUrl).map(r => `${r.erp} — ${r.name}`);
  if (missing.length) {
    setUI({ sjWarnMissing: missing, sjPendingRows: rows });
    return;
  }
  createSuratJalan(rows);
}

function missingDesignModal(ui) {
  const missing = ui.sjWarnMissing || [];
  const close = () => setUI({ sjWarnMissing: null, sjPendingRows: null });
  return modal({
    title: '⚠ Design belum lengkap', width: 480, onClose: close,
    body: [
      h('div', { style: { fontSize: '12px', color: 'var(--text-2)' } }, 'Item berikut belum ada master design:'),
      h('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' } },
        missing.map(m => h('div.mono', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, `• ${m}`))),
    ],
    footer: [
      btn(t('cancel'), { onClick: close }),
      // Calls createSuratJalan() directly (not handleGenerateClick again) —
      // the check already ran, re-running it would just loop back here.
      btn('Tetap Lanjut', { variant: 'primary', onClick: () => { const rows = ui.sjPendingRows; close(); createSuratJalan(rows); } }),
    ],
  });
}

// Find the base seq number already assigned to this PO THIS MONTH (from a
// prior surat jalan referencing it whose `no` uses the current month prefix),
// so partial shipments of the SAME PO share one base number — only the
// shipment suffix increments (001-1, 001-2, 001-3 — not 001-1, 002-2, ...).
// Scoped to the current month's prefix on purpose: it composes with the
// monthly-reset numbering (item 12 / B2) instead of fighting it — a PO
// shipped again next month starts a fresh base + its own -1..-N thread.
function existingBaseSeq(st, poId, prefix) {
  for (const sj of st.suratJalan) {
    if (!(sj.poIds || []).includes(poId)) continue;
    if (!String(sj.no).startsWith(prefix)) continue;
    const m = String(sj.no).slice(prefix.length).match(/^(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

async function refreshFromServer() {
  toast('Memuat data terbaru dari server…');
  const fresh = await fetchSuratJalan();
  if (fresh) {
    getState().suratJalan = fresh;
    setUI({});
    toast('Data surat jalan diperbarui dari server');
  } else {
    toast('Gagal memuat dari server — cek console');
  }
}

// Guard against a SECOND submission while the first is still in flight.
//
// btn() has no busy state, onClick returns a floating promise, `rows` is a
// render-time snapshot, and setUI() only runs at the very END of this function —
// after two network round trips (next_sj_number RPC + insert). The button stayed
// live and armed with stale rows for that entire window, so a double-click
// created TWO surat jalan with two distinct numbers, both shipping the full
// outstanding qty: received became 2x ordered, outstanding clamped to 0, and the
// PO was auto-closed. The warehouse shipped double and no screen showed it.
//
// This is the client-side half. The authoritative fix is a server-side check
// inside a create_surat_jalan() transaction — see
// supabase_migration_sj_overdelivery_guard.sql (not executed).
let sjInFlight = false;

async function createSuratJalan(rows) {
  if (blockWrite('buat surat jalan')) return;
  if (sjInFlight) { toast('Surat jalan sedang diproses — tunggu sebentar'); return; }
  const st = getState(); const ui = st.ui;
  const selected = rows.filter(r => (ui.sjItemSel || {})[r.key] !== false && getQty(ui, r) > 0);
  if (!selected.length) { toast('Pilih minimal 1 item untuk dikirim'); return; }

  // Re-derive outstanding from CURRENT state, not from the `rows` snapshot the
  // button closed over — another tab or user may have shipped in the meantime.
  const over = [];
  for (const r of selected) {
    const po = st.pos.find(p => p.id === r.poId);
    const line = po && (po.items || []).find(i => i.lineId === r.lineId);
    if (!line) continue;
    const fresh = Math.max(0, (line.qty || 0) - receivedQty(st, r.poId, r.lineId));
    if (getQty(ui, r) > fresh + 1e-6) over.push(`${r.erp} — minta ${getQty(ui, r)}, sisa ${fresh}`);
  }
  if (over.length) {
    toast('Qty melebihi outstanding (mungkin sudah dikirim di tab/sesi lain): ' + over.join('; '));
    setUI({});   // force a re-render so the table shows the real numbers
    return;
  }

  sjInFlight = true;
  try {
    await doCreateSuratJalan(st, ui, rows, selected);
  } finally {
    sjInFlight = false;
  }
}

async function doCreateSuratJalan(st, ui, rows, selected) {
  if (blockWrite('simpan surat jalan')) return;
  const poIds = [...new Set(selected.map(r => r.poId))];
  const poNos = [...new Set(selected.map(r => r.poNo))];
  // Derive supplier from the actually-selected PO(s), not raw ui.sjSupplier —
  // that field is only ever written when the user touches the dropdown; the
  // screen's default (first supplier with outstanding stock) is computed at
  // render time and never written back to state, so trusting ui.sjSupplier
  // directly silently sent `null` whenever the user never touched the dropdown.
  const supplierPo = st.pos.find(p => p.id === poIds[0]);
  const supplier = ui.sjSupplier || (supplierPo && supplierPo.supplier) || '';
  const prefix = `PC/SJ/${romanMonth()}/`;
  // Number is generated by the atomic next_sj_number() Postgres function
  // (base reused per-PO this month per B3, suffix = shipment count) —
  // serialized server-side via advisory lock, so two users generating a
  // document in the same instant can never collide. DEMO mode (Supabase not
  // configured) falls back to the local monthly-cache scan.
  let no;
  try {
    no = await nextSjNo(poIds, romanMonth(), new Date().getFullYear(), prefix);
  } catch (e) {
    console.error('nextSjNo failed', e);
    toast('Gagal generate nomor surat jalan dari server: ' + (e.message || e));
    return;
  }
  if (no == null) {
    // Demo mode fallback — local scan (see existingBaseSeq below).
    let seq = null;
    for (const id of poIds) { const existing = existingBaseSeq(st, id, prefix); if (existing != null) { seq = existing; break; } }
    if (seq == null) seq = nextMonthlySeq(st.suratJalan, prefix);
    const shipmentNo = 1 + Math.max(0, ...poIds.map(id => st.suratJalan.filter(sj => (sj.poIds || []).includes(id) && String(sj.no).startsWith(prefix)).length));
    no = `${prefix}${String(seq).padStart(3, '0')}-${shipmentNo}`;
  }
  const draft = {
    docNo: no, no, date: new Date().toISOString(),
    supplier, poNo: poNos.join(', '), poIds,
    by: st.user.name, createdBy: st.user.username, createdAt: new Date().toISOString(),
    items: selected.map(r => ({ poId: r.poId, lineId: r.lineId, erp: r.erp, name: r.name, dimension: r.dimension, warna: '', qtyShipped: getQty(ui, r), qty: getQty(ui, r), unit: r.unit, designUrl: r.designUrl || '' })),
  };
  let sj;
  try {
    sj = await insertSuratJalan(draft);
  } catch (e) {
    console.error('insertSuratJalan failed', e);
    toast('Gagal menyimpan surat jalan ke server: ' + (e.message || e));
    return;
  }
  if (!sj.id) sj.id = uid('sj'); // demo-mode fallback (Supabase not configured)
  st.suratJalan.unshift(sj);
  logAudit({ entity: 'suratJalan', target: sj.no, action: 'create', detail: `${poIds.length} PO · ${sj.items.length} item` });
  closeFullyReceivedPOs(st, poIds, logAudit);
  await archiveSuratJalanToDrive(sj);
  setUI({ sjPoSel: {}, sjItemSel: {}, sjQty: {}, sjLastId: sj.id });
  toast(`Surat jalan ${sj.no} dibuat`);
}

// Auto-archives the just-generated document to Drive as the same print-ready
// HTML the "PDF" button already produces (Opsi A — no PDF-rendering lib in
// this codebase; see suratJalanPaper()/wrapPrintable()). Must NEVER throw —
// a Drive outage or useDrive=false must still leave the surat jalan fully
// generated and usable, just without a Drive link yet. uploadToDrive() itself
// already degrades to a placeholder on failure instead of throwing; the only
// other failure mode here is updateSuratJalan() (Supabase write), caught below.
async function archiveSuratJalanToDrive(sj, { announce = false } = {}) {
  try {
    const html = wrapPrintable(suratJalanPaper(sj).outerHTML, sj.no);
    const blob = new Blob([html], { type: 'text/html' });
    const up = await uploadToDrive(blob, '', `${sj.no.replace(/\//g, '-')}.html`, 'Surat Jalan');
    sj.driveUrl = up.url;
    if (up.placeholder) {
      if (announce) toast('Drive belum aktif — link masih placeholder');
      return;
    }
    // The upload has ALREADY COMMITTED here. If this DB write fails, the file
    // sits in the shared Drive folder permanently with no row pointing at it:
    // the current session still shows a working link (sj.driveUrl was set in
    // memory above) but the next fetchSuratJalan() returns drive_url '' and the
    // link is gone for good. That used to be a silent console.warn — now the
    // user is told, and the history row offers "Arsip ulang".
    try {
      await updateSuratJalan(sj.id, { driveUrl: up.url });
      if (announce) toast('Surat jalan diarsipkan ulang ke Drive');
    } catch (e) {
      console.error('Drive upload OK but saving the link to the DB failed', e);
      toast(`File ${sj.no} sudah di Drive tapi link-nya gagal disimpan — pakai "Arsip ulang" di riwayat`);
    }
  } catch (e) {
    console.warn('Surat jalan Drive auto-archive failed (non-fatal, doc already generated):', e);
    if (announce) toast('Gagal arsip ke Drive: ' + (e.message || e));
  }
}

// Re-run the archive for a surat jalan whose driveUrl never landed.
async function reArchive(sj) {
  if (blockWrite('arsipkan ulang surat jalan')) return;
  await archiveSuratJalanToDrive(sj, { announce: true });
  setState({});
}

function previewCard(st, id) {
  const sj = st.suratJalan.find(s => s.id === id);
  if (!sj) return null;
  const doPrint = () => window.print();
  const doPdf = () => {
    const html = wrapPrintable(suratJalanPaper(sj).outerHTML, sj.no);
    const w = window.open('', '_blank');
    if (!w) { toast('Popup diblokir — izinkan popup dulu buat Save PDF'); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
  };
  const bar = h('div.card.no-print', { style: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
    h('span.mono', { style: { fontSize: '12px', fontWeight: 700 } }, sj.no),
    badge(t('sj_await_wh'), 'amber'),
    h('div.mla.row.gap8', [
      btn('PDF', { iconName: 'download', onClick: doPdf }),
      btn(t('print'), { variant: 'primary', iconName: 'print', onClick: doPrint }),
    ]),
  ]);
  return h('div.stack', [bar, h('div.paper-scroll', { style: { justifyContent: 'center' } }, suratJalanPaper(sj))]);
}

function historyCard(st, canWrite) {
  const list = st.suratJalan.slice(0, 20);
  return card([
    h('div.card-head', [h('div.card-title', 'Riwayat Surat Jalan'), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.suratJalan.length} dokumen`)]),
    list.length ? h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['No.', t('col_supplier'), 'PO', t('col_date'), 'File', t('col_action')].map(c => h('th', c)))),
      h('tbody', list.map(sj => h('tr', [
        h('td.mono.cell-strong', sj.no), h('td', sj.supplier), h('td.mono', { style: { color: 'var(--text-3)' } }, sj.poNo),
        h('td.mono', fmtDate(sj.date)),
        h('td', driveLink(sj.driveUrl || '')),
        h('td', h('div.row.gap8', [
          btn('Lihat', { sm: true, onClick: () => setUI({ sjLastId: sj.id }) }),
          // Offered only when there's no Drive link: either the upload failed,
          // or it succeeded and the DB write that stores the link didn't.
          // Without this the file was unreachable forever.
          (canWrite && (!sj.driveUrl || String(sj.driveUrl).startsWith('drive-')))
            ? btn('Arsip ulang', { sm: true, iconName: 'upload', onClick: () => reArchive(sj) })
            : null,
        ])),
      ]))),
    ])) : h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, 'Belum ada surat jalan dibuat.'),
  ]);
}
