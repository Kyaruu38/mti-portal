// PO Outstanding — barang apa yang masih ditunggu, dan menandai apa yang sudah sampai.
//
// KENAPA LAYAR INI TERPISAH DARI SURAT JALAN
// ---------------------------------------------------------------------------
// Surat Jalan Verifikasi cuma berlaku untuk PO label: gudang mencocokkan warna,
// posisi tulisan, ukuran, dan kerekatan terhadap desain yang disetujui. Untuk
// satu drum oli tidak ada satu pun dari itu yang berarti — tapi selama layar
// itu satu-satunya tempat penerimaan dicatat, PO pelumas terpaksa lewat sana,
// dan checklist yang tidak berlaku tetap dicentang orang karena formulirnya
// minta dicentang.
//
// Jadi penerimaannya dipisah dari dokumennya. Di sini penerimaan dicatat tanpa
// dokumen apa pun: centang, simpan, selesai. PO label tetap punya jalur surat
// jalan, dan dua-duanya dijumlahkan di core/outstanding.js.
//
// YANG SENGAJA TIDAK DILAKUKAN LAYAR INI
// ---------------------------------------------------------------------------
// TIDAK menyentuh stok — tidak stok label, tidak stok apa pun. Itu keputusan
// pemilik, dan sengaja ditulis di sini supaya orang berikutnya yang membaca
// file ini tidak "melengkapinya" dengan niat baik. Stok label sumbernya tetap
// Excel Sona; menaikkannya dari sini akan membuat dua sumber angka untuk satu
// hal, dan tidak akan ada yang tahu mana yang benar ketika keduanya berbeda.
//
// Yang dicatat cuma satu hal: berapa yang sudah sampai. Itu yang menutup PO.
import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { card, badge, btn, icon, searchInput, selectEl } from '../ui/components.js';
import { num, fmtDate } from '../core/format.js';
import { outstandingPOs, overDeliveredPOs, receivedBreakdown, isLabelPO } from '../core/outstanding.js';
import { setPoItems } from '../core/posApi.js';
import { isConfigured } from '../core/supabase.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';

const key = (poId, lineId) => `${poId}::${lineId}`;

export function outstandingPoScreen() {
  const st = getState(); const ui = st.ui;
  const canWrite = can(st.user.role, 'poReceive');

  const all = outstandingPOs(st);
  const filter = ui.opFilter || 'semua';
  const q = (ui.opQ || '').toLowerCase();

  const list = all
    .filter(x => filter === 'semua'
      || (filter === 'label' && isLabelPO(x.po))
      || (filter === 'biasa' && !isLabelPO(x.po)))
    .filter(x => !q || `${x.po.no} ${x.po.contract || ''} ${x.po.supplier || ''}`.toLowerCase().includes(q))
    .sort((a, b) => new Date(a.po.createdAt || 0) - new Date(b.po.createdAt || 0));

  const sel = ui.opSel || {};
  const chosen = Object.keys(sel).filter(k => sel[k]);

  const over = overDeliveredPOs(st);

  return h('div.stack', [
    over.length ? overBanner(over) : null,
    summaryCard(st, all),
    toolbar(st, all, list),
    list.length
      ? h('div.stack', list.map(x => poCard(st, x, sel, canWrite)))
      : card([h('div.card-pad', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({
          id: all.length ? 'Tidak ada yang cocok dengan filter/pencarian.' : 'Tidak ada PO dengan barang outstanding.',
          en: all.length ? 'Nothing matches the filter or search.' : 'No PO with outstanding goods.',
          zh: all.length ? '没有符合筛选或搜索条件的结果。' : '没有尚未到货的采购单。',
        }))]),
    canWrite && chosen.length ? actionBar(st, list, sel) : null,
  ]);
}

function summaryCard(st, all) {
  const label = all.filter(x => isLabelPO(x.po));
  const biasa = all.filter(x => !isLabelPO(x.po));
  const lines = all.reduce((s, x) => s + x.lines.filter(l => l.outstanding > 0).length, 0);
  return h('div.card', { style: { padding: '12px 18px' } }, h('div.row.gap12.wrap', { style: { alignItems: 'center' } }, [
    icon('box', 15, { stroke: 'var(--text-3)' }),
    h('span.grow', { style: { fontSize: '12px', color: 'var(--text-2)' } }, tr({
      id: `${all.length} PO menunggu barang · ${lines} baris item · ${label.length} label, ${biasa.length} non-label`,
      en: `${all.length} PO awaiting goods · ${lines} item lines · ${label.length} label, ${biasa.length} non-label`,
      zh: `${all.length} 张采购单待到货 · ${lines} 行物料 · 标签 ${label.length} 张，非标签 ${biasa.length} 张`,
    })),
    isConfigured() ? btn(tr({ id: 'Refresh dari server', en: 'Refresh from server', zh: '从服务器刷新' }), {
      sm: true, iconName: 'clock', onClick: () => refresh(),
    }) : null,
  ]));
}

function toolbar(st, all, list) {
  return h('div.row.gap8.wrap', [
    searchInput({
      id: 'op-q',
      placeholder: tr({ id: 'Cari no PO / supplier…', en: 'Search PO no / supplier…', zh: '搜索采购单号 / 供应商…' }),
      value: st.ui.opQ || '', onChange: v => setUI({ opQ: v }),
    }),
    selectEl([
      { value: 'semua', label: tr({ id: 'Semua PO', en: 'All POs', zh: '全部采购单' }) },
      { value: 'label', label: tr({ id: 'PO Label', en: 'Label POs', zh: '标签采购单' }) },
      { value: 'biasa', label: tr({ id: 'PO Biasa (non-label)', en: 'Ordinary POs (non-label)', zh: '普通采购单（非标签）' }) },
    ], { value: st.ui.opFilter || 'semua', onChange: v => setUI({ opFilter: v }) }),
    h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
      id: `${list.length} dari ${all.length} PO`,
      en: `${list.length} of ${all.length} PO`,
      zh: `${all.length} 张中的 ${list.length} 张`,
    })),
  ]);
}

// Satu kartu per PO: kepala bisa dicentang untuk memilih SELURUH barisnya,
// dan tiap baris bisa dicentang sendiri. Dua-duanya diminta pemilik, dan
// keduanya perlu: kiriman penuh itu satu klik, kiriman sebagian tidak boleh
// memaksa orang mencentang seluruh PO lalu membatalkan satu per satu.
function poCard(st, x, sel, canWrite) {
  const { po, lines } = x;
  const open = lines.filter(l => l.outstanding > 0);
  const allOn = open.length > 0 && open.every(l => sel[key(po.id, l.lineId)]);
  const someOn = open.some(l => sel[key(po.id, l.lineId)]);

  const head = h('div.card-head', h('div.row.gap12.wrap', { style: { alignItems: 'center', width: '100%' } }, [
    canWrite ? h('input', {
      type: 'checkbox', checked: allOn,
      style: { accentColor: 'var(--accent)', cursor: 'pointer' },
      onChange: e => {
        const s = { ...(getState().ui.opSel || {}) };
        open.forEach(l => { const k = key(po.id, l.lineId); if (e.target.checked) s[k] = true; else delete s[k]; });
        setUI({ opSel: s });
      },
    }) : null,
    h('div', [
      h('div.row.gap8', { style: { alignItems: 'center' } }, [
        h('span.mono', { style: { fontSize: '12.5px', fontWeight: 700 } }, po.contract || po.no),
        badge(isLabelPO(po)
          ? tr({ id: 'Label', en: 'Label', zh: '标签' })
          : tr({ id: 'Non-label', en: 'Non-label', zh: '非标签' }), isLabelPO(po) ? 'blue' : 'gray'),
        someOn && !allOn ? badge(tr({ id: 'sebagian dipilih', en: 'partly selected', zh: '部分已选' }), 'amber') : null,
      ]),
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } },
        `${po.supplier || '—'} · ${fmtDate(po.createdAt)} · ${po.by || '—'}`),
    ]),
    h('div.mla', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
      id: `${open.length} baris belum lengkap · sisa ${num(x.totalOutstanding)}`,
      en: `${open.length} incomplete lines · ${num(x.totalOutstanding)} outstanding`,
      zh: `${open.length} 行未齐 · 未交 ${num(x.totalOutstanding)}`,
    })),
  ]));

  const rows = open.map(l => {
    const b = receivedBreakdown(st, po.id, l.lineId);
    const k = key(po.id, l.lineId);
    return h('tr', [
      canWrite ? h('td', { style: { width: '34px' } }, h('input', {
        type: 'checkbox', checked: !!sel[k],
        style: { accentColor: 'var(--accent)', cursor: 'pointer' },
        onChange: () => {
          const s = { ...(getState().ui.opSel || {}) };
          if (s[k]) delete s[k]; else s[k] = true;
          setUI({ opSel: s });
        },
      })) : null,
      h('td.mono', { style: { fontSize: '10.5px' } }, l.erp || '—'),
      h('td', { style: { fontSize: '11.5px', maxWidth: '320px' } }, l.d || l.desc || l.dimension || '—'),
      h('td.mono.r', num(l.qty)),
      // Asal-usul penerimaan ditampilkan, bukan cuma totalnya. Angka yang tidak
      // bisa ditelusuri asalnya adalah angka yang tidak bisa disanggah.
      h('td.mono.r', { style: { fontSize: '11px' } }, [
        num(l.received),
        (b.viaSj && b.direct)
          ? h('div', { style: { fontSize: '9px', color: 'var(--text-3)' } }, tr({
              id: `${num(b.viaSj)} surat jalan + ${num(b.direct)} manual`,
              en: `${num(b.viaSj)} delivery note + ${num(b.direct)} manual`,
              zh: `${num(b.viaSj)} 送货单 + ${num(b.direct)} 手工`,
            }))
          : b.direct
            ? h('div', { style: { fontSize: '9px', color: 'var(--text-3)' } }, tr({ id: 'ditandai manual', en: 'marked manually', zh: '手工标记' }))
            : b.viaSj
              ? h('div', { style: { fontSize: '9px', color: 'var(--text-3)' } }, tr({ id: 'lewat surat jalan', en: 'via delivery note', zh: '通过送货单' }))
              : null,
      ]),
      h('td.mono.r', { style: { fontWeight: 700, color: 'var(--st-red-tx)' } }, num(l.outstanding)),
      h('td', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, l.unit || po.unit || ''),
    ]);
  });

  const head2 = [
    canWrite ? '' : null,
    tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }),
    tr({ id: 'Item', en: 'Item', zh: '物料' }),
    tr({ id: 'Dipesan', en: 'Ordered', zh: '订购' }),
    tr({ id: 'Diterima', en: 'Received', zh: '已收' }),
    tr({ id: 'Sisa', en: 'Outstanding', zh: '未交' }),
    tr({ id: 'Satuan', en: 'Unit', zh: '单位' }),
  ].filter(x => x !== null);

  return card([
    head,
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', head2.map((c, i) => h('th' + (i >= (canWrite ? 3 : 2) && i <= (canWrite ? 5 : 4) ? '.r' : ''), c)))),
      h('tbody', rows),
    ])),
  ], { pad: false });
}

function actionBar(st, list, sel) {
  const picked = [];
  for (const x of list) {
    for (const l of x.lines) {
      if (l.outstanding > 0 && sel[key(x.po.id, l.lineId)]) picked.push({ po: x.po, line: l });
    }
  }
  const totalQty = picked.reduce((s, p) => s + p.line.outstanding, 0);
  const poCount = new Set(picked.map(p => p.po.id)).size;

  return h('div.card', { style: { padding: '13px 18px', position: 'sticky', bottom: '12px', zIndex: 5 } },
    h('div.row.gap12.wrap', { style: { alignItems: 'center' } }, [
      h('span', { style: { fontSize: '12px' } }, [
        h('b', tr({
          id: `${picked.length} baris dari ${poCount} PO`,
          en: `${picked.length} lines from ${poCount} PO`,
          zh: `${poCount} 张采购单中的 ${picked.length} 行`,
        })),
        h('span', { style: { color: 'var(--text-3)' } }, tr({
          id: ` · total ${num(totalQty)} akan ditandai sudah sampai`,
          en: ` · ${num(totalQty)} in total will be marked as arrived`,
          zh: ` · 共 ${num(totalQty)} 将被标记为已到货`,
        })),
      ]),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: 'Stok TIDAK diubah — ini cuma menutup sisa PO.',
        en: 'Stock is NOT touched — this only closes the PO balance.',
        zh: '不会改动库存 — 仅结清采购单余量。',
      })),
      h('div.mla.row.gap8', [
        btn(tr({ id: 'Batal pilih', en: 'Clear selection', zh: '清除选择' }), { sm: true, onClick: () => setUI({ opSel: {} }) }),
        btn(tr({
          id: `Tandai sudah sampai (${picked.length})`,
          en: `Mark as arrived (${picked.length})`,
          zh: `标记为已到货（${picked.length}）`,
        }), { variant: 'primary', iconName: 'check', onClick: () => markArrived(picked) }),
      ]),
    ]));
}

// Menyimpan per PO, bukan sekaligus. Kalau satu PO gagal disimpan, PO lain yang
// sudah berhasil TIDAK ikut dibatalkan — dan yang gagal disebut namanya, bukan
// dilaporkan sebagai "gagal menyimpan" yang tidak bisa ditindaklanjuti.
async function markArrived(picked) {
  if (blockWrite('tandai barang sudah sampai')) return;
  const st = getState();
  const byPo = new Map();
  for (const p of picked) {
    if (!byPo.has(p.po.id)) byPo.set(p.po.id, { po: p.po, lines: [] });
    byPo.get(p.po.id).lines.push(p.line);
  }

  const gagal = [];
  let okPo = 0, okLines = 0;

  for (const { po, lines } of byPo.values()) {
    // Salinan, bukan objek aslinya: kalau simpannya gagal, state di layar tidak
    // boleh terlanjur berubah seolah berhasil.
    const items = (po.items || []).map(it => {
      const hit = lines.find(l => l.lineId === it.lineId);
      if (!hit) return it;
      return { ...it, receivedDirect: (Number(it.receivedDirect) || 0) + hit.outstanding };
    });
    try {
      // Sengaja BUKAN updatePO(): itu mengirim seluruh baris termasuk `status`.
      // Lihat catatan di core/posApi.js.
      await setPoItems(po.id, items);
    } catch (e) {
      console.error('setPoItems gagal', po.no, e);
      gagal.push({ no: po.contract || po.no, msg: e.message || String(e) });
      continue;
    }
    const live = st.pos.find(p => p.id === po.id);
    if (live) live.items = items;
    okPo++; okLines += lines.length;
    logAudit({
      entity: 'po', target: po.contract || po.no, action: 'receive',
      detail: `${lines.length} baris ditandai sudah sampai · ${num(lines.reduce((s, l) => s + l.outstanding, 0))} ${po.unit || ''} · stok tidak diubah`,
    });
  }

  // Centangan yang gagal sengaja DIBIARKAN tercentang supaya bisa dicoba lagi;
  // yang berhasil dibersihkan supaya tidak ditandai dua kali.
  const sel = { ...(getState().ui.opSel || {}) };
  for (const p of picked) {
    if (!gagal.some(g => g.no === (p.po.contract || p.po.no))) delete sel[key(p.po.id, p.line.lineId)];
  }
  setUI({ opSel: sel });

  if (gagal.length) {
    toast({
      id: `${gagal.length} PO gagal disimpan (${gagal.map(g => g.no).join(', ')}) — ${gagal[0].msg}`,
      en: `${gagal.length} PO could not be saved (${gagal.map(g => g.no).join(', ')}) — ${gagal[0].msg}`,
      zh: `${gagal.length} 张采购单保存失败（${gagal.map(g => g.no).join('、')}）— ${gagal[0].msg}`,
    });
  } else {
    toast({
      id: `${okLines} baris dari ${okPo} PO ditandai sudah sampai. Stok tidak diubah.`,
      en: `${okLines} lines across ${okPo} PO marked as arrived. Stock untouched.`,
      zh: `${okPo} 张采购单共 ${okLines} 行已标记为到货。库存未改动。`,
    });
  }
  setState({});
}

function overBanner(over) {
  return h('div.cfg-banner', {
    style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', display: 'block' },
  }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ${over.length} PO KELEBIHAN KIRIM — cek ke gudang:`,
      en: ` ${over.length} PO OVER-DELIVERED — check with the warehouse:`,
      zh: ` ${over.length} 张采购单超量收货 — 请与仓库核对：`,
    })]),
    ...over.slice(0, 6).map(x => h('div.mono', { style: { fontSize: '10.5px' } },
      `• ${x.po.contract || x.po.no} — ${x.po.supplier} — lebih ${num(x.totalOver)}`)),
  ]);
}

async function refresh() {
  const { fetchPOs } = await import('../core/posApi.js');
  const rows = await fetchPOs();
  if (rows) getState().pos = rows;
  setState({});
  toast({ id: 'Data PO diperbarui', en: 'PO data refreshed', zh: '采购单数据已刷新' });
}
