// Label order tracking, DERIVED — never typed.
//
// The workbook's "Order Tracking" sheet asks sona to retype, per order: date,
// spec, qty, priority, expected arrival, status, received date, overdue alert
// and a double-order check. The portal already holds every one of those facts:
//
//   an order          = a line on a label PO           (st.pos, source 'label')
//   priority          = pos.priority                   (Normal / Urgent / Super Urgent)
//   expected arrival  = PO date + lead days for that priority
//   received          = qty shipped on a surat jalan    (core/outstanding.js)
//   overdue           = past expected arrival, not fully received
//   double order      = same SKU with 2+ orders still open
//
// So none of it is typed here. Retyping it would create a second source of truth
// that disagrees with the first, and would make the double-order check depend on
// how carefully someone typed.
//
// Received qty comes from receivedQty() rather than a second implementation, so
// this screen and the Surat Jalan screen can never disagree about what shipped.

import { receivedQty } from './outstanding.js';

export const PRIORITIES = ['Normal', 'Urgent', 'Super Urgent'];

// Lead days per priority. Falls back to the workbook's own numbers when
// label_settings hasn't been read yet.
export function leadDaysFor(priority, settings) {
  const s = settings || {};
  if (priority === 'Super Urgent') return Number(s.leadSuper) || 3;
  if (priority === 'Urgent') return Number(s.leadUrgent) || 7;
  return Number(s.leadNormal) || 14;
}

function addDays(iso, days) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

// Normalised ERP for matching. PO lines and label_stock rows are typed by
// different people at different times, so whitespace and case must not decide
// whether an order is linked.
const normErp = v => String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();

/**
 * Build the order list.
 *
 * @param {object} st        the store
 * @param {object} settings  label_settings ({leadNormal, leadUrgent, leadSuper})
 * @param {Date}   now       injected so this is testable and never depends on
 *                           the clock at call time
 * @returns {{orders: Array, summary: object}}
 */
export function labelOrders(st, settings, now = new Date()) {
  // ERP -> label_stock row, for attaching each order to a tracker SKU. Only
  // rows that actually carry an ERP participate; the rest simply show as
  // unlinked rather than being guessed at.
  const byErp = new Map();
  for (const s of st.labelStock || []) {
    const k = normErp(s.erp);
    if (k) byErp.set(k, s);
  }

  const orders = [];
  for (const po of st.pos || []) {
    // Label POs only. A PO Converter order is for general goods, not labels.
    if (po.source !== 'label') continue;
    // A rejected PO was never placed; a pending one is not an order yet.
    if (po.status !== 'Approved') continue;

    const priority = po.priority || 'Normal';
    const lead = leadDaysFor(priority, settings);
    const expected = addDays(po.createdAt, lead);

    for (const line of po.items || []) {
      const ordered = Number(line.qty) || 0;
      if (ordered <= 0) continue;
      const received = receivedQty(st, po.id, line.lineId);
      // Tolerance mirrors core/outstanding.js: quantities can be fractional
      // (千克kg), and float noise must not leave an order permanently "open".
      const fullyReceived = received >= ordered - 1e-6;

      // Received date = the LAST surat jalan that shipped against this line.
      let receivedAt = null;
      for (const sj of st.suratJalan || []) {
        if (!(sj.poIds || []).includes(po.id)) continue;
        if (!(sj.items || []).some(i => i.poId === po.id && i.lineId === line.lineId)) continue;
        if (!receivedAt || new Date(sj.date) > new Date(receivedAt)) receivedAt = sj.date;
      }

      const overdue = !fullyReceived && expected && now > expected;
      const sku = byErp.get(normErp(line.erp)) || null;

      orders.push({
        key: `${po.id}::${line.lineId}`,
        poId: po.id, poNo: po.contract || po.no, lineId: line.lineId,
        orderDate: po.createdAt,
        supplier: po.supplier,
        erp: line.erp || '',
        name: line.d || line.dimension || '',
        market: sku ? sku.market : '',
        qtyOrdered: ordered,
        qtyReceived: received,
        outstanding: Math.max(0, ordered - received),
        priority, leadDays: lead,
        expectedArrival: expected ? expected.toISOString() : null,
        status: fullyReceived ? 'Received' : 'Ordered',
        receivedAt,
        // IN TRANSIT / OVERDUE / RECEIVED — same vocabulary as the workbook.
        alert: fullyReceived ? 'RECEIVED' : (overdue ? 'OVERDUE' : 'IN TRANSIT'),
        daysOutstanding: fullyReceived ? null : daysBetween(new Date(po.createdAt), now),
        daysLate: overdue ? daysBetween(expected, now) : 0,
        sku,                              // linked tracker row, or null
        linked: !!sku,
      });
    }
  }

  // DOUBLE ORDER: the same ERP with more than one order still open. This is the
  // check the workbook asks a human to eyeball, and the one most worth
  // automating — ordering labels you already have on the way is pure waste.
  const openByErp = new Map();
  for (const o of orders) {
    if (o.status === 'Received') continue;
    const k = normErp(o.erp);
    if (!k) continue;
    if (!openByErp.has(k)) openByErp.set(k, []);
    openByErp.get(k).push(o);
  }
  for (const [, group] of openByErp) {
    if (group.length < 2) continue;
    for (const o of group) {
      o.doubleOrder = true;
      o.doubleWith = group.filter(x => x !== o).map(x => x.poNo);
    }
  }

  orders.sort((a, b) => {
    // Most urgent first: overdue, then in transit, then received.
    const rank = x => (x.alert === 'OVERDUE' ? 0 : x.alert === 'IN TRANSIT' ? 1 : 2);
    return rank(a) - rank(b) || new Date(a.expectedArrival || 0) - new Date(b.expectedArrival || 0);
  });

  const summary = {
    total: orders.length,
    open: orders.filter(o => o.status !== 'Received').length,
    overdue: orders.filter(o => o.alert === 'OVERDUE').length,
    received: orders.filter(o => o.status === 'Received').length,
    doubles: orders.filter(o => o.doubleOrder).length,
    unlinked: orders.filter(o => !o.linked).length,
  };
  return { orders, summary };
}

// ---------------------------------------------------------------------------
// ERP matching candidates.
//
// The tracker's Material Code column is empty for all 984 rows, so the bridge
// from "long spec name" to "ERP code" has to be built once. Candidates are
// gathered from EVERY place the portal already knows an ERP, not just the item
// master — which is populated only by manual Master Data entry and may well be
// near-empty, while historical PO lines and the design library are not.
// ---------------------------------------------------------------------------
export function erpCandidates(st) {
  const out = new Map();   // erp -> { erp, spec, source }
  const add = (erp, spec, source) => {
    const k = normErp(erp);
    if (!k || !spec) return;
    if (!out.has(k)) out.set(k, { erp: String(erp).trim(), spec: String(spec).trim(), source });
  };
  for (const it of st.items || []) add(it.erp, it.spec || it.nameEn || it.nameZh, 'item master');
  for (const d of st.designs || []) add(d.erp, d.spec, 'design library');
  for (const po of st.pos || []) {
    for (const line of po.items || []) add(line.erp, line.dimension || line.d, 'PO ' + (po.contract || po.no));
  }
  return [...out.values()];
}
