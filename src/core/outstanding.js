// Outstanding-qty tracking for POs shipped via Surat Jalan.
// Received qty is always DERIVED live from st.suratJalan — never cached on the
// PO itself — so it can never drift out of sync with the surat jalan records.

// Quantities can legitimately be fractional (the units master ships 千克kg, and
// the Edit PO modal offers it), so received qty accumulates in binary floating
// point. Ten 0.1 kg shipments against a 1 kg line summed to 0.9999999999999999,
// leaving outstanding = 1.11e-16 — greater than zero, so isFullyReceived never
// fired and the PO stayed open forever showing an outstanding of "0" (num()
// rounds it away) that no user action could clear.
//
// EPS is well below any real-world order quantity and well above float noise.
const EPS = 1e-6;
const snap = n => (Math.abs(n) < EPS ? 0 : n);

// Sum of qty already shipped against one PO line across every surat jalan ever created.
export function receivedQty(st, poId, lineId) {
  return st.suratJalan
    .filter(sj => (sj.poIds || []).includes(poId))
    .flatMap(sj => sj.items || [])
    .filter(it => it.poId === poId && it.lineId === lineId)
    .reduce((s, it) => s + (it.qtyShipped || 0), 0);
}

export function outstandingForItem(st, po, item) {
  return snap(Math.max(0, (item.qty || 0) - receivedQty(st, po.id, item.lineId)));
}

// Per-PO rollup: each line with ordered/received/outstanding/over + totals.
//
// `over` is new and matters: outstanding was clamped with Math.max(0, …), which
// made "received == ordered" and "received > ordered" arithmetically identical.
// Nothing anywhere compared the two, so a PO shipped twice (double-clicked
// button, two tabs, two users) reported outstanding 0 and was auto-closed while
// the warehouse had shipped double the ordered quantity, with no screen showing
// a discrepancy. Now the excess is carried out so the UI can surface it.
export function poOutstanding(st, po) {
  const lines = (po.items || []).map(it => {
    const received = receivedQty(st, po.id, it.lineId);
    const ordered = it.qty || 0;
    const outstanding = snap(Math.max(0, ordered - received));
    const over = snap(Math.max(0, received - ordered));
    return { ...it, received, outstanding, over };
  });
  const totalOutstanding = snap(lines.reduce((s, l) => s + l.outstanding, 0));
  const totalOver = snap(lines.reduce((s, l) => s + l.over, 0));
  return {
    lines,
    totalOutstanding,
    totalOver,
    hasOverDelivery: totalOver > 0,
    isFullyReceived: totalOutstanding < EPS,
  };
}

// Every approved, non-closed PO that still has goods outstanding.
export function outstandingPOs(st) {
  return st.pos
    .filter(p => (p.source === 'label' || p.source === 'converter') && p.status === 'Approved' && !p.closed)
    .map(p => ({ po: p, ...poOutstanding(st, p) }))
    .filter(x => x.totalOutstanding > 0);
}

// POs that have been shipped MORE than ordered. Nothing surfaced this before.
export function overDeliveredPOs(st) {
  return st.pos
    // Same scope as outstandingPOs — without this it surfaced rejected and
    // soft-deleted POs too.
    .filter(p => (p.source === 'label' || p.source === 'converter') && p.status === 'Approved')
    .map(p => ({ po: p, ...poOutstanding(st, p) }))
    .filter(x => x.hasOverDelivery);
}

// Set po.closed when every line of every PO in poIds is fully received.
export function closeFullyReceivedPOs(st, poIds, logAudit) {
  poIds.forEach(id => {
    const po = st.pos.find(p => p.id === id);
    if (!po || po.closed) return;
    const roll = poOutstanding(st, po);
    if (!roll.isFullyReceived) return;
    // NEVER auto-close an over-delivered PO. Closing it hides the discrepancy
    // in the one place someone would notice it. Leave it open and flagged.
    if (roll.hasOverDelivery) {
      logAudit({
        entity: 'po', target: po.no, action: 'over_delivery',
        detail: `kelebihan kirim ${roll.totalOver} — PO TIDAK ditutup otomatis, cek ke gudang`,
      });
      return;
    }
    po.closed = true;
    po.closedAt = new Date().toISOString();
    logAudit({ entity: 'po', target: po.no, action: 'auto_close', detail: 'semua item diterima penuh' });
  });
}
