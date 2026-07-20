// Outstanding-qty tracking for POs shipped via Surat Jalan.
// Received qty is always DERIVED live from st.suratJalan — never cached on the
// PO itself — so it can never drift out of sync with the surat jalan records.

// Sum of qty already shipped against one PO line across every surat jalan ever created.
export function receivedQty(st, poId, lineId) {
  return st.suratJalan
    .filter(sj => (sj.poIds || []).includes(poId))
    .flatMap(sj => sj.items || [])
    .filter(it => it.poId === poId && it.lineId === lineId)
    .reduce((s, it) => s + (it.qtyShipped || 0), 0);
}

export function outstandingForItem(st, po, item) {
  return Math.max(0, (item.qty || 0) - receivedQty(st, po.id, item.lineId));
}

// Per-PO rollup: each line with ordered/received/outstanding + a total.
export function poOutstanding(st, po) {
  const lines = (po.items || []).map(it => {
    const received = receivedQty(st, po.id, it.lineId);
    const outstanding = Math.max(0, (it.qty || 0) - received);
    return { ...it, received, outstanding };
  });
  const totalOutstanding = lines.reduce((s, l) => s + l.outstanding, 0);
  return { lines, totalOutstanding, isFullyReceived: totalOutstanding === 0 };
}

// Every approved, non-closed PO that still has goods outstanding.
export function outstandingPOs(st) {
  return st.pos
    .filter(p => (p.source === 'label' || p.source === 'converter') && p.status === 'Approved' && !p.closed)
    .map(p => ({ po: p, ...poOutstanding(st, p) }))
    .filter(x => x.totalOutstanding > 0);
}

// Set po.closed when every line of every PO in poIds is fully received.
export function closeFullyReceivedPOs(st, poIds, logAudit) {
  poIds.forEach(id => {
    const po = st.pos.find(p => p.id === id);
    if (po && !po.closed && poOutstanding(st, po).isFullyReceived) {
      po.closed = true;
      po.closedAt = new Date().toISOString();
      logAudit({ entity: 'po', target: po.no, action: 'auto_close', detail: 'semua item diterima penuh' });
    }
  });
}
