import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, checkRow, selectEl, icon, driveLink, modal } from '../ui/components.js';
import { suratJalanPaper } from '../ui/documents.js';
import { romanMonth, nextMonthlySeq, fmtDate, num } from '../core/format.js';
import { outstandingPOs, closeFullyReceivedPOs, receivedQty, overDeliveredPOs } from '../core/outstanding.js';
import { wrapPrintable } from './approval.js';
import { fetchSuratJalan, createSuratJalanGuarded, updateSuratJalan } from '../core/suratJalanApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { isConfigured } from '../core/supabase.js';
import { nextSjNo } from '../core/docSeqApi.js';
import { uploadToDrive } from '../core/drive.js';
import { linkOutbox } from '../core/driveOutbox.js';

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

  // HANYA PO LABEL.
  // -------------------------------------------------------------------------
  // Layar ini sempat menampilkan PO pelumas (PT INCLUSION NEW MATERIALS) dan
  // menawarkan pembuatan surat jalannya. Dokumen yang keluar menyuruh gudang
  // mencocokkan warna, posisi tulisan, ukuran, dan kerekatan terhadap desain
  // yang disetujui — tidak satu pun berlaku untuk drum oli, dan checklist yang
  // tidak berlaku itu tetap dicentang orang karena formulirnya minta dicentang.
  const outstanding = outstandingPOs(st, { labelOnly: true });

  // Yang dikeluarkan TIDAK hilang diam-diam. Kalau ada PO non-label yang masih
  // menunggu barang, jumlahnya tetap disebut di sini, lengkap dengan ke mana
  // harus melihatnya. Menyempitkan layar tanpa mengatakan apa yang disempitkan
  // hanya memindahkan kebingungan, tidak menghapusnya.
  const semua = outstandingPOs(st);
  const diluar = semua.length - outstanding.length;

  const suppliers = [...new Set(outstanding.map(x => x.po.supplier))];
  const supplier = suppliers.includes(ui.sjSupplier) ? ui.sjSupplier : suppliers[0];
  const supplierPOs = outstanding.filter(x => x.po.supplier === supplier);

  const internalBanner = h('div.cfg-banner', {
    style: { background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)', display: 'block' },
  }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ' DOKUMEN INTERNAL — untuk gudang MTI, bukan untuk supplier',
      en: ' INTERNAL DOCUMENT — for the MTI warehouse, not for the supplier',
      zh: ' 内部文件 — 供 MTI 仓库使用，不提供给供应商',
    })]),
    h('div', { style: { fontSize: '10.5px', marginTop: '3px' } }, tr({
      id: 'Ini bukan surat jalan pengiriman. Ini lembar verifikasi label yang datang: gudang mencocokkan warna, posisi tulisan, ukuran, jumlah, dan kerekatan terhadap desain yang disetujui. Cuma berlaku untuk PO label.',
      en: 'This is not a shipping note. It is a verification sheet for incoming labels: the warehouse checks colour, text position, size, quantity and adhesion against the approved design. Label POs only.',
      zh: '这不是发货单，而是到货标签的核对表：仓库需对照批准样核对颜色、文字位置、尺寸、数量与黏着力。仅适用于标签采购单。',
    })),
    diluar ? h('div', { style: { fontSize: '10.5px', marginTop: '4px' } }, tr({
      id: `${diluar} PO non-label yang masih menunggu barang tidak ditampilkan di sini — lihat di Dashboard atau Reports.`,
      en: `${diluar} non-label PO still awaiting goods are not shown here — see the Dashboard or Reports.`,
      zh: `另有 ${diluar} 张非标签采购单尚未到货，此处不显示 — 请查看看板或报表。`,
    })) : null,
  ]);

  // Surface over-delivery. poOutstanding() computes it, but nothing rendered it,
  // so a PO shipped beyond its ordered qty stayed invisible on every screen.
  const over = overDeliveredPOs(st, { labelOnly: true });
  const overBanner = over.length
    ? h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', display: 'block' } }, [
        h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, [icon('warn', 14), tr({
          id: ` ${over.length} PO KELEBIHAN KIRIM — cek ke gudang:`,
          en: ` ${over.length} PO OVER-DELIVERED — check with the warehouse:`,
          zh: ` ${over.length} 张采购单超量发货 — 请与仓库核对：`,
        })]),
        ...over.slice(0, 6).map(x => h('div.mono', { style: { fontSize: '10.5px' } }, tr({
          id: `• ${x.po.contract || x.po.no} — ${x.po.supplier} — lebih ${x.totalOver}`,
          en: `• ${x.po.contract || x.po.no} — ${x.po.supplier} — over by ${x.totalOver}`,
          zh: `• ${x.po.contract || x.po.no} — ${x.po.supplier} — 超出 ${x.totalOver}`,
        }))),
      ])
    : null;

  const summary = h('div.card', { style: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
    icon('box', 15, { stroke: 'var(--text-3)' }),
    h('span.grow', { style: { fontSize: '12px', color: 'var(--text-2)' } }, tr({
      id: `${outstanding.length} PO dengan barang outstanding · ${outstanding.reduce((s, x) => s + x.lines.filter(l => l.outstanding > 0).length, 0)} baris item`,
      en: `${outstanding.length} PO with outstanding goods · ${outstanding.reduce((s, x) => s + x.lines.filter(l => l.outstanding > 0).length, 0)} item lines`,
      zh: `${outstanding.length} 张采购单尚有未交货物 · ${outstanding.reduce((s, x) => s + x.lines.filter(l => l.outstanding > 0).length, 0)} 行物料`,
    })),
    isConfigured() ? btn(tr({ id: 'Refresh dari server', en: 'Refresh from server', zh: '从服务器刷新' }), { sm: true, iconName: 'clock', onClick: () => refreshFromServer() }) : null,
  ]);

  if (!suppliers.length) {
    return h('div.stack', [internalBanner, overBanner, summary, card([h('div.card-pad', tr({
      id: 'Tidak ada PO label dengan barang outstanding untuk dibuat lembar verifikasi.',
      en: 'No label PO with outstanding goods to raise a verification sheet for.',
      zh: '没有尚未到货的标签采购单可开具核对表。',
    }))], { pad: false }), historyCard(st, canWrite)]);
  }

  const poSel = ui.sjPoSel || {};
  const selectedPOs = supplierPOs.filter(x => poSel[x.po.id]);
  const rows = pulledInRows(st, selectedPOs.length ? selectedPOs : []);

  const poChecklist = card([
    h('div.card-head', h('div.card-title', tr({ id: 'Pilih PO (supplier sama)', en: 'Pick POs (same supplier)', zh: '选择采购单（同一供应商）' }))),
    ...supplierPOs.map(x => checkRow(!!poSel[x.po.id], `${x.po.contract || x.po.no}`, tr({
      id: `Outstanding: ${x.lines.filter(l => l.outstanding > 0).length} item`,
      en: `Outstanding: ${x.lines.filter(l => l.outstanding > 0).length} items`,
      zh: `未交：${x.lines.filter(l => l.outstanding > 0).length} 项`,
    }), () => {
      const s = { ...poSel }; s[x.po.id] = !s[x.po.id]; setUI({ sjPoSel: s });
    })),
  ]);

  const itemsTable = rows.length ? h('div.card', [
    h('div.card-head', h('div.card-title', tr({
      id: `Item Terpilih · ${rows.length}`,
      en: `Selected Items · ${rows.length}`,
      zh: `已选物料 · ${rows.length}`,
    }))),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        '', 'ERP',
        tr({ id: 'Nama', en: 'Name', zh: '名称' }),
        'PO',
        tr({ id: 'Ordered', en: 'Ordered', zh: '订购' }),
        tr({ id: 'Received', en: 'Received', zh: '已收' }),
        tr({ id: 'Outstanding', en: 'Outstanding', zh: '未交' }),
        tr({ id: 'Qty Kirim', en: 'Ship Qty', zh: '发货数量' }),
      ].map(c => h('th', c)))),
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
      ? btn(tr({ id: 'Buat Surat Jalan', en: 'Create Surat Jalan', zh: '开具送货单' }), { variant: 'primary', disabled: !canGenerate, onClick: () => handleGenerateClick(rows) })
      : badge(tr({
          id: 'Read-only — surat jalan dibuat oleh purchasing',
          en: 'Read-only — the Surat Jalan is created by purchasing',
          zh: '只读 — 送货单由采购部门开具',
        }), 'gray', { iconName: 'eye' }),
  ]);

  const supplierBar = h('div.card', { style: { padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
    h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' } }, t('col_supplier') + ':'),
    selectEl(suppliers, { value: supplier, onChange: v => setUI({ sjSupplier: v, sjPoSel: {}, sjItemSel: {}, sjQty: {} }) }),
  ]);

  const preview = ui.sjLastId ? previewCard(st, ui.sjLastId) : null;

  return h('div.stack', [internalBanner, overBanner, summary, supplierBar, poChecklist, itemsTable, rows.length ? actionBar : null, preview, historyCard(st, canWrite), ui.sjWarnMissing ? missingDesignModal(ui) : null]);
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
    title: tr({ id: '⚠ Design belum lengkap', en: '⚠ Designs incomplete', zh: '⚠ 设计稿尚未齐全' }), width: 480, onClose: close,
    body: [
      h('div', { style: { fontSize: '12px', color: 'var(--text-2)' } }, tr({
        id: 'Item berikut belum ada master design:',
        en: 'These items have no master design yet:',
        zh: '以下物料尚无设计主数据：',
      })),
      h('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' } },
        missing.map(m => h('div.mono', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, `• ${m}`))),
    ],
    footer: [
      btn(t('cancel'), { onClick: close }),
      // Calls createSuratJalan() directly (not handleGenerateClick again) —
      // the check already ran, re-running it would just loop back here.
      btn(tr({ id: 'Tetap Lanjut', en: 'Continue Anyway', zh: '仍然继续' }), { variant: 'primary', onClick: () => { const rows = ui.sjPendingRows; close(); createSuratJalan(rows); } }),
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
  toast({
    id: 'Memuat data terbaru dari server…',
    en: 'Loading the latest data from the server…',
    zh: '正在从服务器加载最新数据…',
  });
  const fresh = await fetchSuratJalan();
  if (fresh) {
    getState().suratJalan = fresh;
    setUI({});
    toast({
      id: 'Data surat jalan diperbarui dari server',
      en: 'Surat Jalan data updated from the server',
      zh: '送货单数据已从服务器更新',
    });
  } else {
    toast({
      id: 'Gagal memuat dari server — cek console',
      en: 'Failed to load from the server — check the console',
      zh: '从服务器加载失败 — 请查看控制台',
    });
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
  if (sjInFlight) { toast({ id: 'Surat jalan sedang diproses — tunggu sebentar', en: 'Surat Jalan is already being processed — please wait', zh: '送货单正在处理中 — 请稍候' }); return; }
  const st = getState(); const ui = st.ui;
  const selected = rows.filter(r => (ui.sjItemSel || {})[r.key] !== false && getQty(ui, r) > 0);
  if (!selected.length) { toast({ id: 'Pilih minimal 1 item untuk dikirim', en: 'Select at least 1 item to ship', zh: '请至少选择 1 项要发货的物料' }); return; }

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
    toast({
      id: 'Qty melebihi outstanding (mungkin sudah dikirim di tab/sesi lain): ' + over.join('; '),
      en: 'Qty exceeds outstanding (may already have been shipped in another tab/session): ' + over.join('; '),
      zh: '数量超出未交量（可能已在其他标签页/会话中发货）：' + over.join('; '),
    });
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
    toast({
      id: 'Gagal generate nomor surat jalan dari server: ' + (e.message || e),
      en: 'Failed to generate the Surat Jalan number from the server: ' + (e.message || e),
      zh: '从服务器生成送货单号失败：' + (e.message || e),
    });
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
    // Goes through create_surat_jalan(), which locks the referenced POs and
    // recomputes ordered-vs-shipped server-side. The client-side check above is
    // still there for instant feedback, but it is no longer the only thing
    // standing between two simultaneous users and an over-delivered PO.
    sj = await createSuratJalanGuarded(draft);
  } catch (e) {
    console.error('createSuratJalan failed', e);
    // The server's over-delivery message names the line, the ordered qty, what
    // was already shipped, and what this document would add — far more useful
    // than a generic failure, so it is shown as-is rather than replaced.
    const msg = String((e && e.message) || e);
    toast({
      id: /over-delivery/i.test(msg)
        ? 'DITOLAK server — kelebihan kirim: ' + msg.replace(/^.*over-delivery blocked:\s*/i, '')
        : 'Gagal menyimpan surat jalan ke server: ' + msg,
      en: /over-delivery/i.test(msg)
        ? 'REJECTED by the server — over-delivery: ' + msg.replace(/^.*over-delivery blocked:\s*/i, '')
        : 'Failed to save the Surat Jalan to the server: ' + msg,
      zh: /over-delivery/i.test(msg)
        ? '服务器已拒绝 — 超量发货：' + msg.replace(/^.*over-delivery blocked:\s*/i, '')
        : '送货单保存到服务器失败：' + msg,
    });
    return;
  }
  if (!sj.id) sj.id = uid('sj'); // demo-mode fallback (Supabase not configured)
  st.suratJalan.unshift(sj);
  logAudit({ entity: 'suratJalan', target: sj.no, action: 'create', detail: `${poIds.length} PO · ${sj.items.length} item` });
  closeFullyReceivedPOs(st, poIds, logAudit);
  await archiveSuratJalanToDrive(sj);
  setUI({ sjPoSel: {}, sjItemSel: {}, sjQty: {}, sjLastId: sj.id });
  toast({ id: `Surat jalan ${sj.no} dibuat`, en: `Surat Jalan ${sj.no} created`, zh: `送货单 ${sj.no} 已创建` });
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
    if (sj.id) await linkOutbox(up.outboxId, 'surat_jalan', sj.id, 'url');
    if (up.placeholder) {
      if (announce) toast({ id: 'Drive belum aktif — link masih placeholder', en: 'Drive is not active yet — the link is still a placeholder', zh: 'Drive 尚未启用 — 链接仍为占位符' });
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
      if (announce) toast({ id: 'Surat jalan diarsipkan ulang ke Drive', en: 'Surat Jalan re-archived to Drive', zh: '送货单已重新归档到 Drive' });
    } catch (e) {
      console.error('Drive upload OK but saving the link to the DB failed', e);
      toast({
        id: `File ${sj.no} sudah di Drive tapi link-nya gagal disimpan — pakai "Arsip ulang" di riwayat`,
        en: `File ${sj.no} is already on Drive but saving its link failed — use "Arsip ulang" in the history`,
        zh: `文件 ${sj.no} 已在 Drive 上，但链接保存失败 — 请在历史记录中使用“Arsip ulang”`,
      });
    }
  } catch (e) {
    console.warn('Surat jalan Drive auto-archive failed (non-fatal, doc already generated):', e);
    if (announce) toast({ id: 'Gagal arsip ke Drive: ' + (e.message || e), en: 'Failed to archive to Drive: ' + (e.message || e), zh: '归档到 Drive 失败：' + (e.message || e) });
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
    if (!w) { toast({ id: 'Popup diblokir — izinkan popup dulu buat Save PDF', en: 'Popup blocked — allow popups first to save the PDF', zh: '弹窗被拦截 — 请先允许弹窗再保存 PDF' }); return; }
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
    h('div.card-head', [h('div.card-title', tr({ id: 'Riwayat Surat Jalan', en: 'Surat Jalan History', zh: '送货单历史' })), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
      id: `${st.suratJalan.length} dokumen`,
      en: `${st.suratJalan.length} document${st.suratJalan.length === 1 ? '' : 's'}`,
      zh: `${st.suratJalan.length} 份单据`,
    }))]),
    list.length ? h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['No.', t('col_supplier'), 'PO', t('col_date'), 'File', t('col_action')].map(c => h('th', c)))),
      h('tbody', list.map(sj => h('tr', [
        h('td.mono.cell-strong', sj.no), h('td', sj.supplier), h('td.mono', { style: { color: 'var(--text-3)' } }, sj.poNo),
        h('td.mono', fmtDate(sj.date)),
        h('td', driveLink(sj.driveUrl || '')),
        h('td', h('div.row.gap8', [
          btn(tr({ id: 'Lihat', en: 'View', zh: '查看' }), { sm: true, onClick: () => setUI({ sjLastId: sj.id }) }),
          // Offered only when there's no Drive link: either the upload failed,
          // or it succeeded and the DB write that stores the link didn't.
          // Without this the file was unreachable forever.
          (canWrite && (!sj.driveUrl || String(sj.driveUrl).startsWith('drive-')))
            ? btn('Arsip ulang', { sm: true, iconName: 'upload', onClick: () => reArchive(sj) })
            : null,
        ])),
      ]))),
    ])) : h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, tr({
      id: 'Belum ada surat jalan dibuat.',
      en: 'No Surat Jalan has been created yet.',
      zh: '尚未开具任何送货单。',
    })),
  ]);
}
