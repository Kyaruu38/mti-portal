// Cross-module lookup for the top-bar Global Search (see ui/layout.js). Pure
// function over the in-memory store — no DOM, no state mutation — so it's
// safe to call on every keystroke. The dropdown that renders these results
// is direct-DOM (not mount()-based) precisely so typing never re-renders
// the input itself; see layout.js's header() for that half.
//
// PO/PRF are documents this app generates, not files it archives to Drive —
// drive is deliberately always null for those two, not a bug.
export function globalSearch(st, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return [];
  const hit = s => s != null && String(s).toLowerCase().includes(query);
  // A file/driveUrl is only worth linking to once it's a real webViewLink —
  // uploadToDrive() placeholders (`drive-pending://`, `drive-error://`) are
  // not openable, same guard ui/components.js's driveLink() already applies
  // everywhere else a Drive link is shown.
  const realUrl = u => (u && !String(u).startsWith('drive-')) ? u : null;

  const results = [];

  for (const p of st.pos) {
    if (hit(p.no) || hit(p.contract) || hit(p.supplier) || hit(p.supplierZh)) {
      results.push({ type: 'PO', id: p.no, sub: p.supplier, ref: p, drive: null });
    }
  }
  for (const i of st.invoices) {
    if (hit(i.no) || hit(i.supplier) || hit(i.poRef)) {
      results.push({ type: 'Invoice', id: i.no, sub: i.supplier, ref: i, drive: realUrl(i.files && i.files[0] && i.files[0].url) });
    }
  }
  for (const s of st.suratJalan) {
    if (hit(s.no) || hit(s.docNo) || hit(s.supplier) || hit(s.poNo)) {
      results.push({ type: 'Surat Jalan', id: s.no, sub: s.supplier, ref: s, drive: realUrl(s.driveUrl) });
    }
  }
  for (const p of st.prfs) {
    if (hit(p.no) || hit(p.supplier)) {
      results.push({ type: 'PRF', id: p.no, sub: p.supplier, ref: p, drive: null });
    }
  }
  for (const k of st.ppkek) {
    if (hit(k.nopen) || hit(k.supplier)) {
      results.push({ type: 'PPKEK', id: k.nopen, sub: k.supplier, ref: k, drive: realUrl(k.driveUrl) });
    }
  }

  return results.slice(0, 15);
}
