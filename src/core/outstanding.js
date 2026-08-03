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

// DUA SUMBER PENERIMAAN, DIJUMLAHKAN — BUKAN DIPILIH SALAH SATU
// ---------------------------------------------------------------------------
// 1. Surat Jalan Verifikasi — jalur label. Gudang memeriksa desainnya, dan
//    jumlah yang lolos tercatat di dokumen itu.
// 2. Penandaan langsung di layar PO Outstanding — untuk PO biasa (pelumas,
//    bahan kimia) yang tidak punya dan tidak butuh surat jalan verifikasi.
//
// Dijumlahkan, dan itu aman dari hitung-ganda karena layar penandaan hanya
// pernah menawarkan SISA yang belum diterima: sisa itu sendiri sudah dihitung
// setelah surat jalan. Menandai "sisanya sudah sampai" dua kali tidak menambah
// apa pun, karena kedua kalinya sisanya nol.
//
// Angkanya tetap TIDAK di-cache sebagai total. Yang disimpan di baris PO cuma
// bagian penerimaan langsungnya; totalnya selalu dihitung ulang di sini.
export function directReceived(po, lineId) {
  const it = ((po && po.items) || []).find(x => x.lineId === lineId);
  return Number(it && it.receivedDirect) || 0;
}

// Sum of qty already shipped against one PO line across every surat jalan ever
// created, PLUS anything marked as arrived directly on the Outstanding PO screen.
export function receivedQty(st, poId, lineId) {
  const viaSj = st.suratJalan
    .filter(sj => (sj.poIds || []).includes(poId))
    .flatMap(sj => sj.items || [])
    .filter(it => it.poId === poId && it.lineId === lineId)
    .reduce((s, it) => s + (it.qtyShipped || 0), 0);
  const po = (st.pos || []).find(p => p.id === poId);
  return snap(viaSj + directReceived(po, lineId));
}

// Dipisah supaya layarnya bisa menampilkan asal-usulnya, bukan cuma totalnya.
// "Diterima 100" tanpa keterangan dari mana membuat orang tidak bisa menyanggah
// angkanya; "80 lewat surat jalan, 20 ditandai manual oleh cania" bisa.
export function receivedBreakdown(st, poId, lineId) {
  const viaSj = st.suratJalan
    .filter(sj => (sj.poIds || []).includes(poId))
    .flatMap(sj => sj.items || [])
    .filter(it => it.poId === poId && it.lineId === lineId)
    .reduce((s, it) => s + (it.qtyShipped || 0), 0);
  const po = (st.pos || []).find(p => p.id === poId);
  return { viaSj: snap(viaSj), direct: snap(directReceived(po, lineId)) };
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

// PO LABEL vs PO LAINNYA
// ---------------------------------------------------------------------------
// `source` menyimpan dari mana PO lahir: 'label' berarti dinaikkan dari sebuah
// Label Request (layar Label Request / tab BUY NOW), 'converter' berarti hasil
// membaca PDF PO dari supplier — pelumas, bahan kimia, apa saja.
//
// Surat Jalan Verifikasi cuma berlaku untuk yang PERTAMA. Dokumennya menyuruh
// gudang mencocokkan warna, posisi tulisan, ukuran, dan kerekatan terhadap
// desain yang disetujui. Tidak ada satu pun dari itu yang berarti untuk satu
// drum oli.
export function isLabelPO(po) { return po && po.source === 'label'; }

// Every approved, non-closed PO that still has goods outstanding.
//
// labelOnly dipakai layar Surat Jalan saja. Dashboard dan Reports SENGAJA
// memakai daftar penuh: "barang apa yang masih ditunggu" itu pertanyaan tentang
// seluruh pembelian, bukan cuma label. Menyempitkan fungsi ini secara global
// akan diam-diam menghapus PO pelumas dari ringkasan outstanding di dua layar
// yang tidak ada hubungannya dengan permintaan ini.
export function outstandingPOs(st, { labelOnly = false } = {}) {
  return st.pos
    .filter(p => (p.source === 'label' || p.source === 'converter') && p.status === 'Approved' && !p.closed)
    .filter(p => !labelOnly || isLabelPO(p))
    .map(p => ({ po: p, ...poOutstanding(st, p) }))
    .filter(x => x.totalOutstanding > 0);
}

// POs that have been shipped MORE than ordered. Nothing surfaced this before.
export function overDeliveredPOs(st, { labelOnly = false } = {}) {
  return st.pos
    // Same scope as outstandingPOs — without this it surfaced rejected and
    // soft-deleted POs too.
    .filter(p => (p.source === 'label' || p.source === 'converter') && p.status === 'Approved')
    .filter(p => !labelOnly || isLabelPO(p))
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
