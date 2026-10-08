// ---------------------------------------------------------------------------
// COMPLAINTS 仓库投诉 — tempat gudang melaporkan masalah label.
//
// KENAPA FORMNYA TIDAK PAKAI setUI PER KETIKAN
// mount() di core/dom.js TIDAK punya diffing: setiap setState/setUI membongkar
// seluruh pohon dan membangunnya lagi. Input yang isinya didorong lewat setUI
// akan kehilangan fokus di huruf pertama. Jadi elemen-elemen form di bawah
// dipegang di variabel lokal dan dibaca .value-nya saat Kirim ditekan. Tidak ada
// render ulang selama orangnya mengetik.
//
// KENAPA PO DAN ERP ITU PILIHAN, BUKAN KETIKAN
// Yang mengisi ini orang gudang, dan kode ERP-nya 17 digit. Mengetik ulang kode
// 17 digit dari kardus ke layar adalah cara paling pasti menghasilkan laporan
// yang tidak bisa dicocokkan ke barangnya — dan laporan yang tidak bisa
// dicocokkan sama saja dengan tidak ada laporan.
// ---------------------------------------------------------------------------
import { h } from '../core/dom.js';
import { getState, setState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, inputEl, selectEl } from '../ui/components.js';
import { fmtDate } from '../core/format.js';
import { can, isReadOnly } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { JENIS_KOMPLAIN, STATUS_KOMPLAIN, insertComplaint, updateComplaint, fetchComplaints } from '../core/complaintsApi.js';

const WARNA = { 'Open': 'red', 'In progress': 'amber', 'Closed': 'green' };

function labelStatus(s) {
  return tr({
    'Open': { id: 'Terbuka', en: 'Open', zh: '待处理' },
    'In progress': { id: 'Diproses', en: 'In progress', zh: '处理中' },
    'Closed': { id: 'Selesai', en: 'Closed', zh: '已解决' },
  }[s] || { id: s, en: s, zh: s });
}

async function muatUlang() {
  const rows = await fetchComplaints();
  if (rows) setState({ complaints: rows });
}

export function complaintsScreen() {
  const st = getState();
  const semua = st.complaints || [];
  const bolehLapor = can(st.user.role, 'complaintWrite') && !isReadOnly(st.user.role);
  const bolehTutup = can(st.user.role, 'approve') || can(st.user.role, 'complaintClose');
  const saring = st.ui.komplStatus || 'Open';
  const daftar = saring === 'ALL' ? semua : semua.filter(k => (k.status || 'Open') === saring);

  // Satu baris PO yang belum lengkap = satu pilihan. Diambil dari pos yang sudah
  // ada di state, jadi tidak ada daftar kedua yang bisa basi.
  const barisPo = [];
  for (const po of (st.pos || [])) {
    for (const it of (po.items || [])) {
      if (!it.erp) continue;
      barisPo.push({ poNo: po.no, erp: it.erp, d: it.d || '', supplier: po.supplier || '' });
    }
  }
  barisPo.sort((a, b) => (a.poNo || '').localeCompare(b.poNo || ''));

  let elPo, elErp, elJenis, elQty, elDetail, elFoto;

  function pilihanErp() {
    const po = elPo ? elPo.value : '';
    const sub = barisPo.filter(r => r.poNo === po);
    return [{ value: '', label: tr({ id: '— pilih ERP —', en: '— pick ERP —', zh: '— 选择 ERP —' }) }]
      .concat(sub.map(r => ({ value: r.erp, label: `${r.erp}  ·  ${String(r.d).slice(0, 44)}` })));
  }

  async function kirim() {
    if (blockWrite('complaint')) return;
    const poNo = elPo.value, erpId = elErp.value;
    if (!poNo || !erpId) {
      toast(tr({ id: 'Pilih PO dan ERP dulu.', en: 'Pick a PO and an ERP first.', zh: '请先选择采购单和 ERP 编码。' }));
      return;
    }
    if (!elJenis.value) {
      toast(tr({ id: 'Pilih jenis masalahnya.', en: 'Pick the issue type.', zh: '请选择问题类型。' }));
      return;
    }
    const sumber = barisPo.find(r => r.poNo === poNo && r.erp === erpId) || {};
    try {
      const baru = await insertComplaint({
        poNo, erpId, supplier: sumber.supplier || '', deskripsi: sumber.d || '',
        jenis: elJenis.value, qty: elQty.value, detail: elDetail.value,
        foto: elFoto.value, by: st.user.username, status: 'Open', sumber: 'portal',
      });
      setState({ complaints: [baru, ...semua] });
      toast(tr({ id: 'Komplain terkirim.', en: 'Complaint submitted.', zh: '投诉已提交。' }));
    } catch (e) {
      console.error(e);
      toast(tr({ id: 'Gagal mengirim komplain. Coba lagi.', en: 'Could not submit. Try again.', zh: '提交失败，请重试。' }));
    }
  }

  async function ubahStatus(k, status) {
    if (blockWrite('complaint')) return;
    const patch = { status };
    if (status === 'Closed') { patch.closed_by = st.user.username; patch.closed_at = new Date().toISOString(); }
    try {
      const n = await updateComplaint(k.id, patch);
      if (!n) {
        // 0 baris = RLS menolak. PostgREST memulangkannya sebagai sukses, jadi
        // tanpa pemeriksaan ini layar akan berbohong bahwa statusnya berubah.
        toast(tr({ id: 'Ditolak server — hak aksesmu tidak mengizinkan perubahan ini.', en: 'Rejected by the server — your account may not change this.', zh: '服务器拒绝：你的权限不允许此操作。' }));
        return;
      }
      await muatUlang();
      toast(tr({ id: 'Status diperbarui.', en: 'Status updated.', zh: '状态已更新。' }));
    } catch (e) {
      console.error(e);
      toast(tr({ id: 'Gagal memperbarui status.', en: 'Could not update the status.', zh: '更新失败。' }));
    }
  }

  const judul = tr({ id: 'Komplain Gudang', en: 'Warehouse Complaints', zh: '仓库投诉' });

  elPo = selectEl(
    [{ value: '', label: tr({ id: '— pilih PO —', en: '— pick PO —', zh: '— 选择采购单 —' }) }]
      .concat([...new Set(barisPo.map(r => r.poNo))].map(v => ({ value: v, label: v }))),
    { mono: true, onChange: () => { if (elErp) elErp.replaceChildren(...pilihanErp().map(o => h('option', { value: o.value }, o.label))); } });
  elErp = selectEl(pilihanErp(), { mono: true });
  elJenis = selectEl([{ value: '', label: tr({ id: '— jenis masalah —', en: '— issue type —', zh: '— 问题类型 —' }) }]
    .concat(JENIS_KOMPLAIN.map(v => ({ value: v, label: v }))), {});
  elQty = inputEl({ type: 'number', placeholder: tr({ id: 'Qty bermasalah', en: 'Qty affected', zh: '问题数量' }) });
  elDetail = inputEl({ placeholder: tr({ id: 'Keterangan — apa yang terjadi', en: 'Details — what happened', zh: '详细说明' }) });
  elFoto = inputEl({ placeholder: tr({ id: 'Link foto (opsional)', en: 'Photo link (optional)', zh: '照片链接（可选）' }) });

  const baris = (label, el) => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
    h('label', { style: { fontSize: '11px', color: 'var(--text-3)', fontWeight: 700 } }, label), el,
  ]);

  return h('div.stack', [
    bolehLapor ? card([
      h('div.card-head', [h('div.card-title', tr({ id: 'Lapor masalah baru', en: 'Report a new problem', zh: '新建投诉' }))]),
      h('div', { style: { padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' } }, [
        baris(tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), elPo),
        baris(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编号' }), elErp),
        baris(tr({ id: 'Jenis masalah', en: 'Issue type', zh: '问题类型' }), elJenis),
        baris(tr({ id: 'Qty bermasalah', en: 'Qty affected', zh: '问题数量' }), elQty),
        baris(tr({ id: 'Keterangan', en: 'Details', zh: '详细说明' }), elDetail),
        baris(tr({ id: 'Link foto', en: 'Photo link', zh: '照片链接' }), elFoto),
      ]),
      h('div', { style: { padding: '0 16px 14px', display: 'flex', gap: '8px', alignItems: 'center' } }, [
        btn(tr({ id: 'Kirim komplain', en: 'Submit complaint', zh: '提交投诉' }), { variant: 'primary', iconName: 'check', onClick: kirim }),
        h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
          id: 'Supplier dan nama barang ikut tersimpan otomatis dari PO yang dipilih.',
          en: 'Supplier and item name are saved automatically from the PO you picked.',
          zh: '供应商与品名将根据所选采购单自动保存。',
        })),
      ]),
    ]) : null,

    card([
      h('div.card-head', [
        h('div.card-title', judul),
        badge(String(daftar.length), daftar.length ? 'accent' : 'gray'),
        h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } },
          ['Open', 'In progress', 'Closed', 'ALL'].map(s => btn(
            s === 'ALL' ? tr({ id: 'Semua', en: 'All', zh: '全部' }) : labelStatus(s),
            { sm: true, variant: saring === s ? 'primary' : '', onClick: () => setUI({ komplStatus: s }) }))),
      ]),
      daftar.length ? h('table.tbl', { style: { width: '100%' } }, [
        h('thead', h('tr', [
          h('th', t('col_date')),
          h('th', tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' })),
          h('th', tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编号' })),
          h('th', tr({ id: 'Barang', en: 'Item', zh: '品名' })),
          h('th', tr({ id: 'Masalah', en: 'Issue', zh: '问题' })),
          h('th', { style: { textAlign: 'right' } }, tr({ id: 'Qty', en: 'Qty', zh: '数量' })),
          h('th', tr({ id: 'Keterangan', en: 'Details', zh: '说明' })),
          h('th', tr({ id: 'Pelapor', en: 'Reported by', zh: '报告人' })),
          h('th', tr({ id: 'Status', en: 'Status', zh: '状态' })),
          h('th', ''),
        ])),
        h('tbody', daftar.map(k => h('tr', [
          h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, k.at ? fmtDate(k.at) : '—'),
          h('td.mono', { style: { fontSize: '11px' } }, k.poNo || '—'),
          h('td.mono', { style: { fontSize: '11px' } }, k.erpId || '—'),
          h('td', { style: { fontSize: '11px', color: 'var(--text-2)' } }, String(k.deskripsi || '').slice(0, 38) || '—'),
          h('td', { style: { fontSize: '11px' } }, k.jenis || '—'),
          h('td.mono', { style: { fontSize: '11.5px', textAlign: 'right' } }, k.qty == null ? '—' : String(k.qty)),
          h('td', { style: { fontSize: '11px', color: 'var(--text-2)' } }, String(k.detail || '').slice(0, 60)),
          h('td', { style: { fontSize: '11px' } }, k.by || '—'),
          h('td', badge(labelStatus(k.status), WARNA[k.status] || 'gray')),
          h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
            bolehTutup && k.status !== 'Closed' ? [
              k.status === 'Open' ? btn(tr({ id: 'Proses', en: 'Start', zh: '处理' }), { sm: true, onClick: () => ubahStatus(k, 'In progress') }) : null,
              btn(tr({ id: 'Selesai', en: 'Close', zh: '解决' }), { sm: true, variant: 'primary', onClick: () => ubahStatus(k, 'Closed') }),
            ] : null),
        ]))),
      ]) : h('div', { style: { padding: '30px 18px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-3)', lineHeight: 1.6 } },
        tr({
          id: 'Belum ada komplain dengan status ini.',
          en: 'No complaints with this status.',
          zh: '没有此状态的投诉。',
        })),
    ]),
  ]);
}
