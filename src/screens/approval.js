import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, logAudit } from '../core/store.js';
import { blockWrite } from '../core/guard.js';
import { parseNumber } from '../parsers/numbers.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, modal, field, inputEl, selectEl, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, hitunganSaring } from '../ui/components.js';
import { money, num, fmtDate, ppnFor, poTermDays, isAdvanceTerm } from '../core/format.js';
import { newLineId } from '../core/posApi.js';
import { poDocument, ensureCap } from '../ui/documents.js';
import { can } from '../auth/roles.js';
import { downloadBlob } from '../core/dom.js';
import { approvePoDelete, rejectPoDelete, updatePoStatus, updatePO, UUID_RE } from '../core/posApi.js';
import { canBuildErp, susunBarisErp, unduhTemplateErp, namaFileErp, tanggalKebutuhan } from '../core/erpRequest.js';
import { kasBaris, sudahDitarik, kelebihanTarik, tahapBerikut, langgarKas, catatTarikanLokal } from '../core/kasLabel.js';
import { catatTarikan, tahapKembar } from '../core/erpTarikanApi.js';
import { bolehUrusSendiri, hapusPoSendiri, bolehMintaHapus, mintaHapusPo } from '../core/poAkses.js';

// Reject-note draft. Lives OUTSIDE the store on purpose: writing it into
// st.ui via setUI() on every keystroke rebuilt the DOM mid-type and truncated
// the note to one character (see the textarea in previewPanel below).
// Keyed by PO id: a module-level bare string leaked a typed reason to whatever
// PO the user clicked next, and PO B could be rejected carrying PO A's reason.
const rejectDraft = { poId: null, note: '' };
export function resetApprovalDrafts() { rejectDraft.poId = null; rejectDraft.note = ''; }
function draftFor(poId) {
  if (rejectDraft.poId !== poId) { rejectDraft.poId = poId; rejectDraft.note = ''; }
  return rejectDraft;
}

// Only POs mirrored to Supabase (real UUID id, see labelRequest.js/poConverter.js
// genPO()/genConverterPO()) have a backing row the delete-request RPCs can act
// on — a PO that only exists locally (e.g. server sync failed at creation) has
// no row to request/approve/reject deletion of.

// DISPLAY ONLY. PO status values are stored in Postgres and matched exactly
// (the filter above, every === in this file, updatePoStatus, ui/documents.js's
// chop rule); this lookup is used at the point of rendering and nowhere else.
const PO_STATUS_TEXT = {
  'Menunggu Approval': { id: 'Menunggu Approval', en: 'Awaiting Approval', zh: '等待审批' },
  'Approved': { id: 'Approved', en: 'Approved', zh: '已批准' },
  'Rejected': { id: 'Rejected', en: 'Rejected', zh: '已驳回' },
};
function poStatusLabel(s) { return PO_STATUS_TEXT[s] ? tr(PO_STATUS_TEXT[s]) : s; }

// Lencana status yang dipakai di rel kiri. Diangkat jadi fungsi sendiri karena
// jendela saring harus menawarkan PERSIS teks yang terbaca di barisnya — dulu
// teks ini dirakit langsung di dalam .map(), dan pilihan status yang bunyinya
// beda sedikit dari lencananya terbaca seperti dua daftar yang berbeda.
function labelAntrean(s) {
  return s === 'Approved' ? t('ap_approved').split('—')[0]
    : s === 'Rejected' ? poStatusLabel('Rejected')
    : t('dash_awaiting_you');
}

// Kotak-kotak di jendela saring antrean approval — mengikuti apa yang benar-benar
// tertulis di tiap baris rel kiri: nomor PO, supplier, siapa yang mengajukan,
// lencana statusnya, dan tanggalnya. Nilai PO sengaja tidak diberi kotak: yang
// membuka layar ini datang untuk memutuskan, bukan untuk mencari nominal.
const MEDAN_ANTREAN = (rows) => [
  { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => r.no },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
  { kunci: 'by', label: tr({ id: 'Diajukan oleh', en: 'Submitted by', zh: '提交人' }), tipe: 'teks', ambil: r => r.by },
  // Didedupe pada LABEL-nya, bukan pada status tersimpannya: dua status yang
  // kebetulan dilukis dengan teks yang sama akan muncul dua kali di dropdown
  // dan yang memilih salah satunya tidak akan pernah tahu bedanya apa.
  { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: [...new Set(rows.map(r => labelAntrean(r.status)).filter(Boolean))].sort(), ambil: r => labelAntrean(r.status) },
  { kunci: 'tgl', label: t('col_date'), tipe: 'tanggal', ambil: r => r.createdAt },
];

// Padanan barisTakCocok() untuk daftar yang bukan tabel. Helper di components.js
// menghasilkan <tr>, dan <tr> di luar <table> dibuang browser tanpa suara —
// pesannya hilang persis di keadaan yang paling butuh pesan.
function blokTakCocok(id, adaFilter, kosong) {
  const bersihkan = () => {
    const f = { ...(getState().ui.filters || {}) };
    delete f[id];
    setUI({ filters: f });
  };
  if (!adaFilter) return h('div', { style: { padding: '18px', fontSize: '12px', color: 'var(--text-3)' } }, kosong);
  return h('div.stack', { style: { gap: '8px', alignItems: 'center', padding: '22px 16px', color: 'var(--text-3)' } }, [
    h('div', { style: { fontSize: '12px', textAlign: 'center' } }, tr({
      id: 'Tidak ada data yang cocok dengan saringannya',
      en: 'No data matches the filter',
      zh: '没有符合筛选条件的数据',
    })),
    h('button.btn.btn-sm', { onClick: bersihkan },
      tr({ id: 'Bersihkan saringan', en: 'Clear filter', zh: '清除筛选' })),
  ]);
}

export function approvalScreen() {
  const st = getState();
  const semua = st.pos.filter(p => p.status === 'Menunggu Approval' || p.status === 'Approved' || p.status === 'Rejected');
  const medanAntre = MEDAN_ANTREAN(semua);
  const nilaiAntre = nilaiFilter('ap-antre');
  const list = saring(semua, medanAntre, nilaiAntre);
  // Yang dipilih otomatis mengikuti daftar TERSARING: sesudah menyaring, PO
  // pertama yang terlihat itulah yang dimaksud orangnya. PO yang sudah dipilih
  // sebelumnya tetap dicari ke st.pos, jadi menyaringnya keluar dari rel kiri
  // tidak mengosongkan panel kanan yang sedang dibaca.
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
    if (blockWrite('approve PO')) return;
    const patch = { status: 'Approved', approvedAt: new Date().toISOString(), approvedBy: st.user.username };
    if (UUID_RE.test(po.id)) {
      try {
        await updatePoStatus(po.id, patch);
      } catch (e) {
        console.error('Supabase PO approve failed — nothing changed', e);
        toast({
          id: 'Approve DITOLAK server, PO tidak berubah: ' + (e.message || e),
          en: 'Approve REJECTED by server, PO unchanged: ' + (e.message || e),
          zh: '服务器拒绝批准，采购单未更改：' + (e.message || e),
        });
        return;
      }
    }
    Object.assign(po, patch);
    logAudit({ entity: 'po', target: po.no, action: 'approve', detail: 'seal & signature embedded' });
    toast({
      id: `PO ${po.no} approved — seal & tanda tangan diterapkan`,
      en: `PO ${po.no} approved — seal & signature applied`,
      zh: `采购单 ${po.no} 已批准 — 已加盖印章与签字`,
    });
    setState({});
  };
  const reject = async () => {
    if (blockWrite('reject PO')) return;
    const note = (draftFor(po.id).note || '').trim();
    if (!note) { toast({ id: 'Alasan reject wajib diisi', en: 'Rejection reason is required', zh: '必须填写驳回原因' }); return; }
    // Server first, same reasoning as approve() above.
    if (UUID_RE.test(po.id)) {
      try {
        await updatePoStatus(po.id, { status: 'Rejected', rejectNote: note });
      } catch (e) {
        console.error('Supabase PO reject failed — nothing changed', e);
        toast({
          id: 'Reject DITOLAK server, PO tidak berubah: ' + (e.message || e),
          en: 'Reject REJECTED by server, PO unchanged: ' + (e.message || e),
          zh: '服务器拒绝驳回操作，采购单未更改：' + (e.message || e),
        });
        return;
      }
    }
    rejectDraft.note = '';
    po.status = 'Rejected'; po.rejectNote = note; po.rejectedBy = st.user.username; po.rejectedAt = new Date().toISOString();
    logAudit({ entity: 'po', target: po.no, action: 'reject', detail: note });
    toast({
      id: `PO ${po.no} rejected — dikembalikan ke ${po.by}`,
      en: `PO ${po.no} rejected — returned to ${po.by}`,
      zh: `采购单 ${po.no} 已驳回 — 已退回给 ${po.by}`,
    });
    setUI({ rejectOpen: false });
  };
  const hapusSendiri = () => hapusPoSendiri(po, { bersihkan: () => setUI({ selPO: null }) });

  // Badannya pindah ke core/poAkses.js — layar PO Saya memanggil yang sama
  // persis. Sebelum dipindah, jalur ini cuma ada di sini, dan cania serta visca
  // tidak punya layar ini.
  const requestDelete = () => mintaHapusPo(po);
  const approveDelete = async () => {
    if (blockWrite('approve hapus PO')) return;
    try {
      await approvePoDelete(po.id);
      const idx = st.pos.indexOf(po);
      if (idx >= 0) st.pos.splice(idx, 1);
      logAudit({ entity: 'po', target: po.no, action: 'approve_delete' });
      toast({ id: `PO ${po.no} dihapus`, en: `PO ${po.no} deleted`, zh: `采购单 ${po.no} 已删除` });
      setUI({ selPO: null });
    } catch (e) { console.error(e); toast({ id: 'Gagal approve hapus: ' + (e.message || e), en: 'Failed to approve deletion: ' + (e.message || e), zh: '批准删除失败：' + (e.message || e) }); }
  };
  const rejectDelete = async () => {
    if (blockWrite('reject hapus PO')) return;
    try {
      await rejectPoDelete(po.id);
      po.deleteRequested = false; po.deleteReason = null;
      logAudit({ entity: 'po', target: po.no, action: 'reject_delete' });
      toast({
        id: `Request hapus PO ${po.no} ditolak`,
        en: `Delete request for PO ${po.no} rejected`,
        zh: `采购单 ${po.no} 删除申请已驳回`,
      });
      setState({});
    } catch (e) { console.error(e); toast({ id: 'Gagal reject hapus: ' + (e.message || e), en: 'Failed to reject deletion: ' + (e.message || e), zh: '驳回删除申请失败：' + (e.message || e) }); }
  };
  // await ensureCap() SEBELUM outerHTML. Capnya sekarang dimuat belakangan
  // (lihat ui/documents.js), dan outerHTML membaca DOM apa adanya saat itu juga.
  // Tanpa penantian ini, PO yang sudah di-approve bisa terunduh TANPA STEMPEL —
  // tanpa error, tanpa tanda apa pun, dan yang menyadarinya suppliernya.
  const downloadFinal = async () => {
    await ensureCap();
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    downloadBlob(new Blob([html], { type: 'text/html' }), `${po.no.replace(/\//g, '-')}-final.html`);
    toast({ id: 'PO final (capped) diunduh', en: 'Final PO (stamped) downloaded', zh: '已下载最终采购单（含印章）' });
  };
  const downloadPdf = async () => {
    // window.open() DULU, sebelum await mana pun. Browser cuma mengizinkan popup
    // selama masih di dalam rantai klik penggunanya; satu await sebelum baris ini
    // dan popupnya diblokir walaupun pengaturannya sudah mengizinkan.
    const w = window.open('', '_blank');
    if (!w) { toast({ id: 'Popup diblokir — izinkan popup dulu buat Save PDF', en: 'Popup blocked — allow popups first to Save PDF', zh: '弹窗被拦截 — 请先允许弹窗再保存 PDF' }); return; }
    await ensureCap();
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
  };

  const listPanel = card([
    h('div.card-head', [
      h('div.card-title', t('ap_pending')),
      // Lencana ini tetap membaca st.pos langsung. Berapa PO yang menunggu
      // adalah beban kerjanya, bukan isi layarnya — angka yang ikut turun waktu
      // orang menyaring akan terbaca sebagai antrean yang sudah berkurang.
      badge(String(st.pos.filter(p => p.status === 'Menunggu Approval').length), 'accent'),
      hitunganSaring(list.length, semua.length, { id: 'PO', en: 'PO', zh: '个采购单' }),
      tombolFilter({ id: 'ap-antre', medan: medanAntre, judul: t('ap_pending') }),
    ]),
    ...list.map(p => {
      const active = p.id === po.id;
      const tone = p.status === 'Approved' ? 'green' : p.status === 'Rejected' ? 'red' : 'amber';
      const label = labelAntrean(p.status);
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
    list.length ? null : blokTakCocok('ap-antre', jumlahFilterAktif(nilaiAntre) > 0, '—'),
  ]);

  if (!po) return h('div.stack', [listPanel, st.ui.poEdit ? poEditModal() : null]);


  // Aturannya tinggal di core/poAkses.js — dipakai bareng layar PO Saya.
  const bisaUrusSendiri = bolehUrusSendiri(st, po);
  const actions = po.status === 'Approved'
    ? [badge(t('ap_approved'), 'green', { iconName: 'check' }), btn(tr({ id: 'Download PDF', en: 'Download PDF', zh: '下载 PDF' }), { variant: 'primary', iconName: 'download', onClick: downloadPdf }), btn(tr({ id: 'Download HTML', en: 'Download HTML', zh: '下载 HTML' }), { iconName: 'download', onClick: downloadFinal }),
      // Tombol ERP TIDAK dirender untuk PO non-label maupun PO yang belum
      // disetujui — bukan dinonaktifkan. Tombol mati yang tidak akan pernah
      // hidup cuma membuat orang mengkliknya lalu bertanya kenapa diam.
      canBuildErp(po) ? btn(tr({ id: 'Template ERP', en: 'ERP template', zh: 'ERP 模板' }), { iconName: 'download', onClick: () => setUI({ erpPo: po.id }) }) : null,
      isWilbert ? btn(tr({ id: 'Edit', en: 'Edit', zh: '编辑' }), { iconName: 'edit', onClick: () => openPoEdit(po) }) : null]
    : po.status === 'Rejected'
      ? [badge(t('ap_rejected'), 'red')]
      : isWilbert
        ? [btn(t('ap_reject'), { variant: 'danger', onClick: () => setUI({ rejectOpen: !st.ui.rejectOpen }) }), btn(t('ap_approve'), { variant: 'primary', iconName: 'check', onClick: approve }), btn(tr({ id: 'Edit', en: 'Edit', zh: '编辑' }), { iconName: 'edit', onClick: () => openPoEdit(po) })]
        // Pembuatnya sendiri, selama PO-nya belum disetujui: boleh benahi dan
        // boleh buang, tanpa mengantre.
        //
        // RLS-nya SUDAH mengizinkan ini sejak lama — pos_update USING berbunyi
        // `is_admin() OR (created_by = current_username() AND status =
        // 'Menunggu Approval')`. Yang menahan cuma tombol di baris ini, dan
        // akibatnya salah ketik harga di PO yang belum disetujui butuh tiga
        // langkah lewat orang lain: minta wilbert edit, atau Request Delete →
        // tunggu approval → bikin ulang.
        //
        // Menyetujui PO sendiri tetap mustahil: pos_guard_status_trg menolak
        // perubahan status/approved_by/approved_at dari siapa pun selain
        // wilbert, jadi membuka Edit di sini tidak menyentuh soal itu.
        : bisaUrusSendiri
          ? [badge(t('ap_awaiting'), 'amber'),
             btn(tr({ id: 'Edit', en: 'Edit', zh: '编辑' }), { iconName: 'edit', onClick: () => openPoEdit(po) }),
             btn(tr({ id: 'Hapus', en: 'Delete', zh: '删除' }), { variant: 'danger', onClick: hapusSendiri })]
          : [badge(t('ap_awaiting'), 'amber')];

  // Aturannya tinggal di core/poAkses.js — dipakai bareng layar PO Saya.
  // Diberikan oleh KEPEMILIKAN, bukan oleh capability; alasan lengkapnya ada di
  // komentar bolehMintaHapus().
  const canRequestDelete = bolehMintaHapus(st, po);
  if (canRequestDelete) actions.push(btn(tr({ id: 'Request Delete', en: 'Request Delete', zh: '申请删除' }), { variant: 'danger', onClick: requestDelete }));

  const deleteBanner = po.deleteRequested
    ? h('div', { style: { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--st-red-bg)' } }, [
        h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--st-red-tx)' } }, tr({
          id: `Request hapus menunggu approval — alasan: ${po.deleteReason || '-'}`,
          en: `Delete request awaiting approval — reason: ${po.deleteReason || '-'}`,
          zh: `删除申请等待审批 — 原因：${po.deleteReason || '-'}`,
        })),
        isWilbert ? h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '8px' } }, [
          btn(t('ap_reject'), { sm: true, onClick: rejectDelete }),
          h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: approveDelete }, tr({ id: 'Approve & Hapus', en: 'Approve & Delete', zh: '批准并删除' })),
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
        placeholder: tr({
          id: 'Contoh: harga unit naik vs kontrak — minta renegosiasi…',
          en: 'Example: unit price is higher than the contract — asking to renegotiate…',
          zh: '例如：单价高于合同价 — 要求重新议价…',
        }),
        value: draftFor(po.id).note,
        onInput: e => { draftFor(po.id).note = e.target.value; },
      }),
      h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '8px' } }, [
        btn(t('cancel'), { sm: true, onClick: () => { resetApprovalDrafts(); setUI({ rejectOpen: false }); } }),
        h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: reject }, t('ap_reject_confirm')),
      ]),
    ]) : null,
    h('div', { style: { background: 'var(--bg)', padding: '26px', display: 'flex', justifyContent: 'center' }, class: 'paper-scroll' }, poDocument(po)),
  ]);

  return h('div.stack', [
    h('div.grid', { style: { gridTemplateColumns: '330px 1fr', alignItems: 'start' } }, [listPanel, previewPanel]),
    st.ui.poEdit ? poEditModal() : null,
    st.ui.erpPo ? erpModal() : null,
  ]);
}

// ---------------------------------------------------------------------------
// TEMPLATE ERP 采购申请 — pratinjau sebelum diunduh.
//
// Sengaja ada langkah pratinjau, bukan langsung mengunduh. Yang ditulis ke
// berkas ini adalah kode material ERP dan tanggal kebutuhan; keduanya tidak
// terlihat di dokumen PO, jadi kalau salah tidak ada yang akan menyadarinya
// sampai barangnya tidak datang. Satu layar untuk melihatnya lebih dulu.
// ---------------------------------------------------------------------------
// Diekspor untuk layar PO Saya. Dipakai bersama, bukan disalin: jendela ini
// menyusun baris 采购申请明细 dari isi PO, dan dua salinan penyusun itu adalah
// dua salinan yang suatu hari menghasilkan Excel berbeda dari PO yang sama.
// ---------------------------------------------------------------------------
// DRAF TARIKAN — hidup DI LUAR store, sama seperti rejectDraft di atas.
//
// Kotak qty di jendela ini diketik manusia. setUI() membangun ulang seluruh
// pohon (mount() tidak punya diffing), jadi menyimpan ketikan ke state berarti
// kotaknya diganti di tengah orang mengetik dan fokusnya jatuh ke <body> —
// kegagalan yang sama persis dengan alasan textarea reject dan kolom HARGA di
// Label Request ditulis begini.
//
// Dikunci per PO: draf yang tertinggal dari PO sebelumnya akan menarik jumlah
// milik PO lain ke berkas yang salah, dan angkanya kelihatan wajar.
const tarikDraft = { kunci: null, poId: null, qty: {}, tanggal: '' };

function drafTarikan(st, po) {
  // `erpLine` dibaca sebagai bagian dari KUNCI, bukan cuma sebagai penyaring.
  //
  // Layar Kas Label menampilkan satu baris PER BARIS PO dan tombolnya membuka
  // jendela ini. Tanpa ini, mengklik "Tarik excel" di baris SKU B mengisi
  // SELURUH baris PO itu sampai penuh — termasuk SKU A — dan sekali Unduh
  // ditekan, kas SKU A ikut habis untuk berkas yang tidak pernah dimaksudkan
  // memuatnya. Tabel erp_tarikan sengaja tidak punya policy UPDATE maupun
  // DELETE, jadi kesalahan itu tidak bisa dibatalkan dari aplikasi sama sekali.
  const fokus = st.ui.erpLine || null;
  const kunci = `${po.id}::${fokus || '*'}`;
  if (tarikDraft.kunci !== kunci) {
    tarikDraft.kunci = kunci;
    tarikDraft.poId = po.id;
    tarikDraft.qty = {};
    tarikDraft.tanggal = '';
    // Isian awal. Tahap 1 memakai qtyMinta — jumlah yang BENAR-BENAR diminta
    // sona sebelum di-Mark Up — karena itulah yang perlu didatangkan duluan.
    // Tahap berikutnya tidak punya permintaan yang menempel padanya (kaitan
    // request→kas baru datang di v15.7), jadi isian awalnya seluruh sisa kas
    // dan orangnya menurunkan sendiri kalau kirimannya lebih kecil.
    const tahap = tahapBerikut(st, po.id);
    for (const it of (po.items || [])) {
      if (fokus && it.lineId !== fokus) continue;
      const sisa = kasBaris(st, po, it);
      if (sisa <= 0) continue;
      const minta = tahap === 1 ? (Number(it.qtyMinta) || sisa) : sisa;
      tarikDraft.qty[it.lineId] = Math.max(0, Math.min(sisa, minta));
    }
  }
  return tarikDraft;
}

export function resetErpDraft() { tarikDraft.kunci = null; tarikDraft.poId = null; tarikDraft.qty = {}; tarikDraft.tanggal = ''; }

// Membaca ketikan jumlah. parseNumber('id') supaya "1.000" terbaca 1000 —
// Number('1.000') menghasilkan 1, dan itu pola yang dilarang di repo ini.
// Label dihitung per lembar, jadi dibulatkan dan tidak pernah negatif.
function bacaQty(mentah) {
  const t = String(mentah == null ? '' : mentah).trim();
  if (!t) return 0;
  const n = parseNumber(t, 'id');
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

// Menyegarkan angka turunan TANPA render ulang. Yang disentuh cuma teks di
// dalam node yang sudah ada, jadi aman dipanggil di tengah gerakan mouse —
// termasuk saat blur mendahului klik tombol Unduh.
function segarkanTarikan(st, po) {
  const d = tarikDraft;
  let total = 0;
  for (const it of (po.items || [])) {
    const minta = Number(d.qty[it.lineId]) || 0;
    total += minta;
    const sisa = kasBaris(st, po, it);
    const el = document.getElementById(`erp-sisa-${it.lineId}`);
    if (el) {
      const sesudah = sisa - minta;
      el.textContent = num(Math.max(0, sesudah), 0);
      el.style.color = sesudah < 0 ? 'var(--st-red-tx)' : 'var(--text-3)';
    }
  }
  const tot = document.getElementById('erp-total-tarik');
  if (tot) tot.textContent = num(total, 0);
}

export function erpModal() {
  const st = getState();
  const po = (st.pos || []).find(p => p.id === st.ui.erpPo);
  if (!po) return null;

  const tahap = tahapBerikut(st, po.id);
  const d = drafTarikan(st, po);
  const tanggalOtomatis = tanggalKebutuhan(st, po);
  const tanggalDipakai = d.tanggal || tanggalOtomatis;

  const { baris, kurang, penanda } = susunBarisErp(st, po, { qty: d.qty, tahap, tanggal: tanggalDipakai });
  const tutup = () => { resetErpDraft(); setUI({ erpPo: null, erpLine: null }); };

  // Baris PO yang masih punya kas. Baris yang kasnya habis TIDAK ditampilkan —
  // kotak isian yang maksimumnya nol cuma mengundang orang mengetik angka lalu
  // ditolak.
  const barisKas = (po.items || [])
    .map(it => ({ it, sisa: kasBaris(st, po, it), ditarik: sudahDitarik(st, po.id, it.lineId), lebih: kelebihanTarik(st, po, it) }))
    .filter(x => x.sisa > 0 || x.lebih > 0);

  const totalMinta = Object.values(d.qty).reduce((a, b) => a + (Number(b) || 0), 0);
  const adaKasHabis = (po.items || []).length > barisKas.length;

  const info = (k, v) => h('div.row', { style: { justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed var(--border)', fontSize: '12px' } },
    [h('span', { style: { color: 'var(--text-3)' } }, k), h('span.mono', { style: { fontWeight: 700 } }, v)]);

  const kotakQty = (x) => h('input.input.mono.r', {
    // Angka polos tanpa pemisah ribuan — alasannya sama seperti kolom HARGA di
    // Label Request: "1,000" akan dibaca ulang sebagai 1 dengan locale 'id'.
    defaultValue: String(Number(d.qty[x.it.lineId]) || 0),
    style: { width: '96px', textAlign: 'right', fontSize: '11.5px', padding: '4px 7px' },
    onBlur: e => {
      const n = bacaQty(e.target.value);
      // Dijepit ke sisa kas DI SINI, bukan cuma diperiksa waktu Unduh. Angka
      // yang dibiarkan berdiri lalu ditolak belakangan memaksa orang menebak
      // batasnya; angka yang langsung turun sendiri menyebutkan batasnya.
      const jepit = Math.min(n, x.sisa);
      d.qty[x.it.lineId] = jepit;
      e.target.value = String(jepit);
      // DITULIS LANGSUNG KE NODE, BUKAN toast().
      //
      // toast() memanggil setState, dan setState menjadwalkan mount() ulang di
      // microtask. Microtask itu jalan DI ANTARA mousedown dan click — jadi
      // tombol Unduh yang sedang ditekan orangnya diganti di tengah gerakan dan
      // kliknya jatuh ke ruang kosong. Tidak ada error, tidak ada unduhan, dan
      // klik keduanya baru berhasil. Persis kegagalan yang komentar
      // segarkanTarikan() di atas ada untuk mencegahnya, dan versi pertama
      // fungsi ini melanggarnya sendiri.
      const nota = document.getElementById(`erp-nota-${x.it.lineId}`);
      if (nota) {
        const kena = jepit !== n && n > 0;
        nota.textContent = kena ? `maks ${num(x.sisa, 0)}` : '';
        nota.style.display = kena ? 'block' : 'none';
      }
      segarkanTarikan(st, po);
    },
    onKeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  return modal({
    title: tr({
      id: `Template ERP — ${penanda}`,
      en: `ERP template — ${penanda}`,
      zh: `ERP 模板 — ${penanda}`,
    }),
    width: 760, onClose: tutup,
    body: [
      // Blokir SELURUH berkas kalau ada satu saja SKU tanpa kode ERP. Membuang
      // barisnya diam-diam menghasilkan berkas yang terlihat wajar, terunggah
      // tanpa keluhan, dan baru ketahuan sebagai label yang tidak pernah dipesan.
      //
      // Sejak v15.6 yang diperiksa cuma baris yang IKUT DITARIK tahap ini —
      // memblokir tahap 2 karena SKU yang tidak diminta di tahap 2 itu menahan
      // berkas yang isinya sama sekali tidak bergantung padanya.
      kurang.length ? h('div', {
        style: {
          background: 'var(--st-red-bg)', border: '1px solid var(--st-red-tx)', borderRadius: '10px',
          padding: '12px 14px', marginBottom: '14px', fontSize: '12px',
        },
      }, [
        h('div', { style: { fontWeight: 800, color: 'var(--st-red-tx)', marginBottom: '6px' } }, tr({
          id: `${kurang.length} SKU belum punya kode material ERP — file tidak dibuat.`,
          en: `${kurang.length} SKU have no ERP material code — the file was not created.`,
          zh: `${kurang.length} 个 SKU 没有 ERP 物料编号 — 未生成文件。`,
        })),
        h('div', { style: { color: 'var(--text-2)', marginBottom: '8px' } }, tr({
          id: 'Cocokkan dulu di Label Stock → kolom ERP, lalu buka lagi.',
          en: 'Match them first in Label Stock → ERP column, then reopen this.',
          zh: '请先在标签库存的 ERP 列中完成匹配，然后重新打开。',
        })),
        ...kurang.map(k => h('div.mono', { style: { fontSize: '11px', color: 'var(--text-2)' } }, `${k.spec} · ${num(k.qty, 0)}`)),
      ]) : null,

      // Baris yang SUDAH ditarik melebihi pesanannya. Seharusnya mustahil —
      // kotaknya menjepit dan Unduh memeriksa lagi — tapi dua tab yang menarik
      // bersamaan masih bisa lolos. Kalau terjadi, yang salah adalah 采购申请
      // yang sudah masuk ERP, dan itu harus DISEBUT, bukan ditampilkan sebagai
      // sisa nol lalu didiamkan.
      barisKas.some(x => x.lebih > 0) ? h('div', {
        style: {
          background: 'var(--st-red-bg)', border: '1px solid var(--st-red-tx)', borderRadius: '10px',
          padding: '12px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--st-red-tx)', fontWeight: 700,
        },
      }, tr({
        id: 'Ada baris yang sudah ditarik MELEBIHI jumlah PO-nya. Cek 采购申请 di ERP sebelum menarik lagi.',
        en: 'Some lines have been pulled BEYOND their PO quantity. Check 采购申请 in the ERP before pulling again.',
        zh: '有行的取数已超过采购单数量。再次取数前请先核对 ERP 中的采购申请。',
      })) : null,

      st.erpTarikanGagal ? h('div', {
        style: {
          background: 'var(--st-red-bg)', border: '1px solid var(--st-red-tx)', borderRadius: '10px',
          padding: '12px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--st-red-tx)', fontWeight: 700,
        },
      }, tr({
        id: 'Riwayat tarikan gagal dimuat — sisa kas di bawah belum tentu benar. Muat ulang halaman sebelum menarik.',
        en: 'The pull history failed to load — the balances below may be wrong. Reload the page before pulling.',
        zh: '取数历史加载失败 — 下方额度可能不准确。请先刷新页面再取数。',
      })) : null,

      info(tr({ id: 'Tahap ke', en: 'Stage', zh: '第几批' }), String(tahap)),
      info(tr({ id: 'Penanda (备注 & nama file)', en: 'Marker (备注 & file name)', zh: '标记（备注与文件名）' }), penanda),
      info(tr({ id: 'Prioritas PO', en: 'PO priority', zh: '采购单优先级' }), po.priority || 'Normal'),
      info(tr({ id: 'Baris siap', en: 'Rows ready', zh: '就绪行数' }), String(baris.length)),
      info(tr({ id: 'Nama file', en: 'File name', zh: '文件名' }), namaFileErp(po, tahap)),

      // 需求日期 BISA DIUBAH sejak v15.6.
      //
      // Sebelumnya dia selalu tanggal approve + lead time prioritas. Untuk satu
      // tarikan itu benar; untuk tiga tahap itu berarti tahap 1, 2 dan 3 menulis
      // tanggal yang sama persis, dan ERP menerima tiga permintaan yang seolah
      // dibutuhkan di hari yang sama padahal kirimannya berbulan-bulan terpisah.
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px dashed var(--border)', fontSize: '12px' } }, [
        h('span', { style: { color: 'var(--text-3)' } }, tr({ id: '需求日期 yang ditulis', en: '需求日期 written', zh: '写入的需求日期' })),
        h('input.input.mono', {
          type: 'date',
          defaultValue: tanggalDipakai,
          style: { width: '170px', fontSize: '11.5px', padding: '4px 7px' },
          // Sama seperti kotak qty: commit di blur, tanpa setUI. Kalau
          // dikosongkan, kembali ke hitungan otomatis — bukan ke string kosong,
          // karena 需求日期 kosong membuat impornya ditolak ERP.
          onBlur: e => {
            const v = String(e.target.value || '').trim();
            d.tanggal = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
            e.target.value = d.tanggal || tanggalOtomatis;
          },
        }),
      ]),

      barisKas.length ? h('div', { style: { marginTop: '14px', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' } }, [
        h('table.tbl', { style: { width: '100%' } }, [
          h('thead', h('tr', [
            h('th', '物料编号'),
            h('th', '物料名称'),
            h('th', { style: { textAlign: 'right' } }, tr({ id: 'PO', en: 'PO', zh: '采购单' })),
            h('th', { style: { textAlign: 'right' } }, tr({ id: 'Ditarik', en: 'Pulled', zh: '已取' })),
            h('th', { style: { textAlign: 'right' } }, tr({ id: 'Tarik skrg', en: 'Pull now', zh: '本次取数' })),
            h('th', { style: { textAlign: 'right' } }, tr({ id: 'Sisa kas', en: 'Balance left', zh: '剩余额度' })),
          ])),
          h('tbody', barisKas.map(x => h('tr', [
            h('td.mono', { style: { fontSize: '11px' } }, String(x.it.erp || '—')),
            h('td', { style: { fontSize: '11px', color: 'var(--text-2)' } }, String(x.it.cn || x.it.d || x.it.dimension || '(label)').slice(0, 40)),
            h('td.mono', { style: { fontSize: '11px', textAlign: 'right' } }, num(Number(x.it.qty) || 0, 0)),
            h('td.mono', { style: { fontSize: '11px', textAlign: 'right', color: 'var(--text-3)' } }, num(x.ditarik, 0)),
            h('td', { style: { textAlign: 'right' } }, [
              kotakQty(x),
              // Diisi oleh onBlur di atas lewat tulisan DOM langsung. Kosong dan
              // tersembunyi sampai ada yang mengetik di atas sisa kasnya.
              h('div.mono', {
                id: `erp-nota-${x.it.lineId}`,
                style: { display: 'none', fontSize: '9.5px', marginTop: '3px', color: 'var(--st-red-tx)', whiteSpace: 'nowrap' },
              }, ''),
            ]),
            h('td.mono', {
              id: `erp-sisa-${x.it.lineId}`,
              style: { fontSize: '11px', textAlign: 'right', color: 'var(--text-3)' },
            }, num(Math.max(0, x.sisa - (Number(d.qty[x.it.lineId]) || 0)), 0)),
          ]))),
          h('tfoot', h('tr', [
            h('td', { colSpan: 4, style: { textAlign: 'right', fontSize: '11.5px', fontWeight: 700 } },
              tr({ id: 'Total ditarik tahap ini', en: 'Total pulled this stage', zh: '本批合计' })),
            h('td.mono', { id: 'erp-total-tarik', style: { textAlign: 'right', fontSize: '11.5px', fontWeight: 800 } }, num(totalMinta, 0)),
            h('td', ''),
          ])),
        ]),
      ]) : h('div', { style: { marginTop: '14px', padding: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' } }, tr({
        id: 'Kas PO ini sudah habis — seluruh jumlahnya sudah pernah ditarik ke 采购申请.',
        en: 'This PO has no balance left — its full quantity has already been pulled into 采购申请.',
        zh: '该采购单额度已用完 — 全部数量均已取入采购申请。',
      })),

      adaKasHabis && barisKas.length ? h('div', { style: { marginTop: '8px', fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: 'Baris yang kasnya sudah habis tidak ditampilkan.',
        en: 'Lines with no balance left are hidden.',
        zh: '额度已用完的行不予显示。',
      })) : null,

      h('div', { style: { marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
        id: '需求日期 awalnya = tanggal approve + lead time prioritas (Label Settings), boleh diubah per tahap. Di ERP: 采购申请 → 新增 → isi dulu 计划类别/需求来源/流向/用途类别 → baru 导入明细.',
        en: '需求日期 defaults to the approval date + the priority lead time (Label Settings) and can be changed per stage. In the ERP: 采购申请 → 新增 → fill 计划类别/需求来源/流向/用途类别 FIRST → then 导入明细.',
        zh: '需求日期 默认为审批日期加优先级提前期（标签设置），可按批次修改。在 ERP 中：采购申请 → 新增 → 先填写计划类别/需求来源/流向/用途类别 → 再点击导入明细。',
      })),
    ],
    footer: [
      btn(t('cancel'), { onClick: tutup }),
      btn(tr({ id: 'Unduh .xls', en: 'Download .xls', zh: '下载 .xls' }), {
        variant: 'primary', iconName: 'download',
        // Diperiksa DI DALAM onClick, bukan dengan menyembunyikan tombolnya.
        // Tombol yang muncul-hilang mengikuti isian akan hilang tepat saat blur
        // mendahului klik, dan klik yang sah jatuh ke ruang kosong — kegagalan
        // yang sudah pernah terjadi di layar Label Request.
        onClick: async () => {
          const s2 = getState();
          const po2 = (s2.pos || []).find(p => p.id === s2.ui.erpPo);
          if (!po2) return;
          if (blockWrite('tarik template ERP')) return;
          // PO yang belum tersinkron tidak punya baris di server, jadi
          // erp_tarikan.po_id (uuid, references pos.id) menolaknya dengan 22P02
          // apa pun isinya. Dihentikan DI SINI dengan kalimat yang menyebut
          // sebabnya, bukan dibiarkan jatuh ke pesan Postgres mentah.
          //
          // Dan bukan cuma soal pesan: sebelum v15.6 berkas ini terunduh tanpa
          // dicatat. Sekarang pencatatan itulah yang menurunkan kas, jadi
          // membiarkannya lewat berarti menerbitkan 采购申请 yang tidak pernah
          // terhitung — persis lubang yang rilis ini ada untuk menutupnya.
          if (!UUID_RE.test(String(po2.id))) {
            toast({
              id: `PO ${po2.no} belum tersinkron ke server — tarikannya tidak bisa dicatat, jadi filenya tidak dibuat. Muat ulang halaman; kalau tetap begini, kabari Wilbert.`,
              en: `PO ${po2.no} never synced to the server — the pull cannot be recorded, so no file was created.`,
              zh: `采购单 ${po2.no} 未同步到服务器 — 无法记录取数，因此未生成文件。`,
            });
            return;
          }
          // Riwayat tarikan GAGAL DIMUAT saat login. Kas dihitung darinya, jadi
          // yang tampil di layar ini adalah kas PENUH untuk setiap PO — angka
          // yang kelihatan wajar dan salah. Menariknya sekarang berarti
          // menerbitkan 采购申请 untuk jumlah yang mungkin sudah pernah diminta.
          if (s2.erpTarikanGagal) {
            toast({
              id: 'Riwayat tarikan gagal dimuat, jadi sisa kas di layar ini belum tentu benar. Muat ulang halaman dulu sebelum menarik.',
              en: 'The pull history failed to load, so the balance shown here may be wrong. Reload the page before pulling.',
              zh: '取数历史加载失败，此处显示的额度可能不准确。请先刷新页面再取数。',
            });
            return;
          }

          const tahapKini = tahapBerikut(s2, po2.id);
          const tglKini = tarikDraft.tanggal || tanggalKebutuhan(s2, po2);
          const susun = susunBarisErp(s2, po2, { qty: tarikDraft.qty, tahap: tahapKini, tanggal: tglKini });

          if (susun.kurang.length) {
            toast({
              id: `${susun.kurang.length} SKU belum punya kode ERP — file tidak dibuat`,
              en: `${susun.kurang.length} SKU have no ERP code — the file was not created`,
              zh: `${susun.kurang.length} 个 SKU 没有 ERP 编号 — 未生成文件`,
            });
            return;
          }
          if (!susun.baris.length) {
            toast({
              id: 'Belum ada jumlah yang diisi — isi minimal satu baris',
              en: 'No quantity entered — fill at least one row',
              zh: '尚未填写数量 — 请至少填写一行',
            });
            return;
          }
          // Pemeriksaan TERAKHIR terhadap kas. Kotaknya sudah menjepit waktu
          // diketik, tapi kas bisa berubah di antara membuka jendela dan
          // menekan tombol — tab lain, orang lain, tarikan yang baru masuk.
          const langgar = langgarKas(s2, po2, tarikDraft.qty);
          if (langgar.length) {
            const l = langgar[0];
            toast({
              id: `Kas tidak cukup untuk ${l.erp || 'baris ini'}: minta ${num(l.minta, 0)}, sisa ${num(l.sisa, 0)}. Buka ulang jendelanya.`,
              en: `Not enough balance for ${l.erp || 'this line'}: asked ${num(l.minta, 0)}, left ${num(l.sisa, 0)}. Reopen this window.`,
              zh: `${l.erp || '该行'} 额度不足：申请 ${num(l.minta, 0)}，剩余 ${num(l.sisa, 0)}。请重新打开此窗口。`,
            });
            return;
          }

          // DICATAT DULU, BARU DIUNDUH. Urutannya bukan selera: kalau berkasnya
          // diunduh lebih dulu lalu pencatatannya gagal, berkasnya sudah ada di
          // tangan orangnya sementara kasnya masih penuh — dan tahap berikutnya
          // menarik jumlah yang sama sekali lagi ke ERP.
          const catatan = susun.baris.map(b => ({
            poId: po2.id, lineId: b.lineId, tahap: tahapKini, qty: b.qty,
            tanggal: tglKini, penanda: susun.penanda, oleh: s2.user.username,
          }));
          let tersimpan;
          try {
            tersimpan = await catatTarikan(catatan);
          } catch (e) {
            console.error('catat tarikan gagal', e);
            toast(tahapKembar(e)
              ? {
                  id: `Tahap ${tahapKini} sudah pernah dicatat — buka ulang jendelanya, mungkin ada yang menarik barusan`,
                  en: `Stage ${tahapKini} is already recorded — reopen this window, someone may have just pulled it`,
                  zh: `第 ${tahapKini} 批已记录 — 请重新打开窗口，可能刚有人取过数`,
                }
              : {
                  id: 'Gagal mencatat tarikan, file TIDAK dibuat: ' + (e.message || e),
                  en: 'Failed to record the pull, the file was NOT created: ' + (e.message || e),
                  zh: '记录取数失败，未生成文件：' + (e.message || e),
                });
            return;
          }
          catatTarikanLokal(tersimpan.length ? tersimpan : catatan);

          try {
            await unduhTemplateErp(namaFileErp(po2, tahapKini), susun.baris);
          } catch (e) {
            // Tarikannya SUDAH tercatat dan kasnya sudah turun. Itu keadaan yang
            // benar — 采购申请-nya memang belum dibuat, tapi nomornya sudah
            // dipesan. Katakan apa adanya, jangan diam-diam membatalkan catatan:
            // menghapusnya membuka celah dua orang menarik tahap yang sama.
            console.error('template ERP gagal:', e);
            toast({
              id: `Tarikan tahap ${tahapKini} tercatat, tapi file gagal dibuat: ${e.message || e}. Buka lagi jendela ini untuk mengunduh ulang tahap berikutnya.`,
              en: `Stage ${tahapKini} was recorded, but the file failed: ${e.message || e}.`,
              zh: `第 ${tahapKini} 批已记录，但文件生成失败：${e.message || e}。`,
            });
            resetErpDraft();
            setUI({ erpPo: null, erpLine: null });
            return;
          }

          const total = susun.baris.reduce((a, b) => a + b.qty, 0);
          logAudit({
            entity: 'po', target: po2.no, action: 'erp_template',
            detail: `${susun.penanda} · ${susun.baris.length} baris · ${num(total, 0)} pcs · ${tglKini}`,
          });
          toast({
            id: `${susun.penanda} diunduh — ${num(total, 0)} pcs, ${susun.baris.length} baris`,
            en: `${susun.penanda} downloaded — ${num(total, 0)} pcs across ${susun.baris.length} rows`,
            zh: `${susun.penanda} 已下载 — ${num(total, 0)} 件，${susun.baris.length} 行`,
          });
          resetErpDraft();
          setUI({ erpPo: null, erpLine: null });
        },
      }),
    ],
  });
}

// Edit PO in-place (wilbert-only, gated in the actions array above). Content
// edit, not a workflow transition — status is deliberately never touched here.
// items are recomputed live via direct DOM writes (amount cells + totals),
// NOT via setUI() per keystroke: mount() has no diffing and rebuilds the
// whole tree on every setUI(), which would drop keyboard focus after every
// character typed into qty/price (same class of bug suratJalan.js's
// qtyInput comment documents and avoids). Only structural changes (add/
// remove a line, open/close the modal) go through setUI().
// ---------------------------------------------------------------------------
// DROPDOWN TERMS YANG TIDAK BERBOHONG.
//
// APA YANG SALAH SEBELUMNYA
// Pilihannya enam string tetap: 'Payment in Advance', 'TOP 3' … 'TOP 60'.
// Tapi yang tersimpan di po.terms tidak pernah berbentuk itu — poConverter.js
// menyimpannya sebagai kalimat, lengkap dengan rujukan kontraknya:
//     "30 days after B/L — ref CGDD2608040047"
// Tidak ada satu pun <option> yang cocok, jadi tidak ada yang ber-`selected`,
// dan HTML punya perilaku baku untuk itu: TAMPILKAN YANG PERTAMA. Yang pertama
// kebetulan 'Payment in Advance'.
//
// Akibatnya SETIAP PO tampil sebagai "Payment in Advance" di modal ini, berapa
// pun term aslinya. Dokumen cetaknya selalu benar — ui/documents.js membaca
// po.terms langsung — jadi yang berbohong cuma layar ini, di tempat yang justru
// dipakai orang untuk memeriksa.
//
// Lapisan keduanya: mengklik opsi yang SUDAH tersorot tidak memicu event
// 'change'. Jadi orang yang benar-benar ingin mengubahnya menjadi Payment in
// Advance tidak bisa — kliknya tidak menghasilkan apa pun, dan Save tidak
// menulis apa pun. Satu-satunya jalan adalah memilih opsi lain dulu, lalu
// kembali.
//
// PERBAIKANNYA
// Nilai PO yang sebenarnya DIMASUKKAN sebagai opsi tersendiri kalau dia belum
// ada di daftar. Dropdown jadi menyebutkan apa adanya, dan opsi baku tetap
// bisa dipilih untuk mengubahnya.
//
// Sengaja TIDAK dinormalisasi jadi 'TOP 30' saat form dibuka. Normalisasi
// membuat f.terms langsung berbeda dari po.terms sejak detik pertama, dan
// commercialChange di bawah membaca perbedaan itu sebagai perubahan syarat
// pembayaran — Save tanpa mengubah apa pun akan MENCABUT approval PO yang sudah
// bercap. Persis kelas kesalahan yang catatan di commercialChange itu sendiri
// peringatkan.
// ---------------------------------------------------------------------------
const TERM_OPTIONS = ['Payment in Advance', 'TOP 3', 'TOP 14', 'TOP 30', 'TOP 45', 'TOP 60'];

function termOptionsFor(current) {
  const cur = String(current == null ? '' : current).trim();
  // PO tanpa syarat pembayaran: beri opsi kosong yang eksplisit, jangan biarkan
  // browser memilihkan yang pertama dan membuatnya tampak sebagai prepayment.
  if (!cur) {
    return [{ value: '', label: tr({ id: '— belum diisi —', en: '— not set —', zh: '— 未填写 —' }) }, ...TERM_OPTIONS];
  }
  if (TERM_OPTIONS.includes(cur)) return TERM_OPTIONS;
  return [{ value: cur, label: cur }, ...TERM_OPTIONS];
}

// Dua tulisan syarat pembayaran yang ARTINYA sama.
//
// "30 days after B/L — ref CGDD2608040047" dan "TOP 30" tercetak sama persis di
// dokumen ("30 days after Invoice"), jadi berpindah dari satu ke yang lain bukan
// perubahan komersial dan tidak boleh mencabut approval. Tanpa ini, membuka
// modal lalu memilih opsi baku yang setara akan melempar kontrak bercap kembali
// ke antrean approval tanpa ada yang berubah di kertasnya.
function sameTerm(a, b) {
  const ta = String(a == null ? '' : a).trim();
  const tb = String(b == null ? '' : b).trim();
  if (ta === tb) return true;
  const da = poTermDays(ta), db = poTermDays(tb);
  if (da != null || db != null) return da === db;   // dua-duanya hitungan hari
  return isAdvanceTerm(ta) && isAdvanceTerm(tb);    // dua-duanya prepayment
}

function computeTotals(items, ppnMode) {
  const subtotal = items.reduce((s, it) => s + (it.a || 0), 0);
  // ppnFor() compares against the DOMAIN value 'paid'. This used to test the
  // FORM value 'bayar', which po.ppnMode never holds — so every saved edit
  // silently rewrote ppn to 0 and dropped the stored total by 11% while the
  // printed PO still showed the tax. Same helper as ui/documents.js now.
  const ppn = ppnFor(subtotal, ppnMode);
  return { subtotal, ppn, total: subtotal + ppn };
}

// Diekspor untuk layar PO Saya — lihat catatan di erpModal().
export function openPoEdit(po) {
  setUI({ poEdit: {
    ref: po,
    supplier: po.supplier, supplierZh: po.supplierZh, currency: po.currency,
    terms: po.terms || '', contract: po.contract || '',
    items: po.items.map(it => ({ ...it })), // copy — don't mutate po.items until Save
  } });
}

export function poEditModal() {
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
      h('div', { style: { flex: '2' } }, inputEl({ value: it.d || '', placeholder: tr({ id: 'Deskripsi', en: 'Description', zh: '描述' }), onInput: v => { it.d = v; } })),
      h('div', { style: { width: '70px' } }, inputEl({ value: String(it.qty || 0), mono: true, onInput: v => { const n = parseNumber(v, 'id'); it.qty = Number.isFinite(n) ? n : 0; recompute(); } })),
      h('div', { style: { width: '90px' } }, inputEl({ value: String(it.u || 0), mono: true, onInput: v => { const n = parseNumber(v, 'id'); it.u = Number.isFinite(n) ? n : 0; recompute(); } })),
      h('div', { style: { width: '130px' } }, selectEl(unitOpts, { value: it.unit, onChange: v => { it.unit = v; } })),
      h('div', { style: { width: '90px', textAlign: 'right' } }, amountCell),
      btn(tr({ id: 'Hapus', en: 'Delete', zh: '删除' }), { sm: true, variant: 'danger', onClick: () => { f.items.splice(i, 1); setUI({}); } }),
    ]);
  });

  const { subtotal: subtotal0, ppn: ppn0, total: total0 } = computeTotals(f.items, po.ppnMode);
  subtotalEl = h('span.mono', money(subtotal0, f.currency));
  ppnEl = h('span.mono', money(ppn0, f.currency));
  totalEl = h('span.mono', { style: { fontWeight: 800 } }, money(total0, f.currency));

  return modal({
    title: tr({ id: `Edit PO — ${po.no}`, en: `Edit PO — ${po.no}`, zh: `编辑采购单 — ${po.no}` }), width: 760, onClose: () => setUI({ poEdit: null }),
    body: [
      h('div.grid.g2', [
        field(tr({ id: 'Supplier (English)', en: 'Supplier (English)', zh: '供应商（英文）' }), inputEl({ value: f.supplier, onInput: v => { f.supplier = v; } })),
        field(tr({ id: 'Supplier (原文)', en: 'Supplier (original)', zh: '供应商（原文）' }), inputEl({ value: f.supplierZh, onInput: v => { f.supplierZh = v; } })),
      ]),
      h('div.grid.g2', [
        // Option values are the STORED currency / terms codes — untranslated.
        field(tr({ id: 'Currency', en: 'Currency', zh: '币种' }), selectEl(['IDR', 'USD', 'CNY', 'EUR'], { value: f.currency, onChange: v => { f.currency = v; recompute(); } })),
        field(tr({ id: 'Terms', en: 'Terms', zh: '付款条件' }), selectEl(termOptionsFor(f.terms), { value: f.terms, onChange: v => { f.terms = v; } })),
      ]),
      field(tr({ id: 'Contract No', en: 'Contract No', zh: '合同号' }), inputEl({ value: f.contract, mono: true, onInput: v => { f.contract = v; } })),
      h('div', [
        h('div.card-title', { style: { marginBottom: '8px' } }, tr({ id: 'Line Items', en: 'Line Items', zh: '明细行' })),
        h('div.row.gap8', { style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)', paddingBottom: '6px' } }, [
          h('div', { style: { flex: '2' } }, tr({ id: 'Desc', en: 'Desc', zh: '描述' })),
          h('div', { style: { width: '70px' } }, tr({ id: 'Qty', en: 'Qty', zh: '数量' })),
          h('div', { style: { width: '90px' } }, tr({ id: 'Price', en: 'Price', zh: '单价' })),
          h('div', { style: { width: '130px' } }, tr({ id: 'Unit', en: 'Unit', zh: '单位' })),
          h('div', { style: { width: '90px', textAlign: 'right' } }, tr({ id: 'Amount', en: 'Amount', zh: '金额' })), h('div', { style: { width: '58px' } }),
        ]),
        ...itemRows,
        // Opaque id minted here, not left empty: two lines added in one edit
        // used to both carry lineId '' and collide on the same shipment key.
        btn(tr({ id: 'Tambah Baris', en: 'Add Line', zh: '添加行' }), { sm: true, iconName: 'plus', onClick: () => { f.items.push({ erp: '', d: '', dimension: '', cn: '', qty: 0, u: 0, a: 0, unit: '', lineId: newLineId() }); setUI({}); } }),
      ]),
      h('div.stack', { style: { gap: '4px', alignItems: 'flex-end', fontSize: '12.5px' } }, [
        h('div.row.gap8', [h('span', tr({ id: 'Subtotal', en: 'Subtotal', zh: '小计' })), subtotalEl]),
        h('div.row.gap8', [h('span', tr({ id: 'PPN', en: 'PPN', zh: '增值税' })), ppnEl]),
        h('div.row.gap8', [h('span', { style: { fontWeight: 800 } }, tr({ id: 'TOTAL', en: 'TOTAL', zh: '总计' })), totalEl]),
      ]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ poEdit: null }) }), btn(t('save'), { variant: 'primary', onClick: () => savePoEdit() })],
  });
}

async function savePoEdit() {
  if (blockWrite('simpan perubahan PO')) return;
  const st = getState(); const f = st.ui.poEdit; const po = f.ref;
  f.items.forEach(it => { it.a = (Number(it.qty) || 0) * (Number(it.u) || 0); });
  const { subtotal, ppn, total } = computeTotals(f.items, po.ppnMode);

  // A COMMERCIAL change to an already-approved PO invalidates the approval.
  // Previously status was left untouched no matter what changed, so an Approved
  // PO could be re-priced from 10,000,000 to 500,000,000 and the regenerated
  // PDF still carried the chop — with nothing re-entering the approval queue.
  // Cosmetic edits (supplier spelling, contract no.) don't trigger this.
  //
  // REGRESSION FIX: this used to compare the freshly RECOMPUTED subtotal/total
  // against the STORED po.subtotal/po.total. Every pre-existing PO with
  // ppnMode 'paid' has a stale ppn of 0 (that is the very bug the ppnFor() fix
  // addressed), so recomputation always differed and a no-op save de-approved
  // a signed contract and inflated its total by 11%.
  //
  // Compare only what the USER can actually edit in this modal. The totals are
  // derived, so they can never diverge unless one of these did.
  const itemsKey = list => JSON.stringify((list || []).map(i => [i.d, Number(i.qty) || 0, Number(i.u) || 0, i.unit || '']));
  const commercialChange = po.status === 'Approved' && (
    f.currency !== po.currency ||
    !sameTerm(f.terms, po.terms) ||
    itemsKey(f.items) !== itemsKey(po.items)
  );

  // Full snapshot. The old rollback restored only status/approvedBy/approvedAt,
  // so a server-rejected edit left the NEW prices on a PO still rendered as
  // Approved — chop and all — which is exactly the artifact this was meant to
  // prevent. Items are cloned because `po.items = f.items` aliases the modal's
  // own array.
  const before = { ...po, items: (po.items || []).map(i => ({ ...i })) };
  po.supplier = f.supplier; po.supplierZh = f.supplierZh; po.currency = f.currency;
  // Kalau artinya sama, biarkan tulisan aslinya. "30 days after B/L — ref
  // CGDD2608040047" menyimpan rujukan kontraknya; menimpanya dengan "TOP 30"
  // membuang jejak itu tanpa mengubah apa pun yang tercetak.
  if (!sameTerm(f.terms, po.terms)) po.terms = f.terms;
  po.contract = f.contract; po.items = f.items.map(i => ({ ...i }));
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
      // Restore the FULL pre-edit object, not just the approval fields.
      for (const k of Object.keys(po)) if (!(k in before)) delete po[k];
      Object.assign(po, before);
      toast({
        id: 'Gagal simpan edit PO ke server: ' + (e.message || e),
        en: 'Failed to save PO edit to server: ' + (e.message || e),
        zh: '保存采购单修改到服务器失败：' + (e.message || e),
      });
      return; // keep the modal open so nothing is lost
    }
  }
  logAudit({
    entity: 'po', target: po.no, action: 'edit',
    detail: `Edit isi PO oleh ${st.user.username} — total baru ${money(po.total, po.currency)}`
      + (commercialChange ? ' · APPROVAL DIRESET, PO masuk antrean lagi' : ''),
  });
  toast({
    id: commercialChange
      ? 'PO diperbarui — nilai berubah, approval direset & masuk antrean supervisor lagi'
      : 'PO diperbarui',
    en: commercialChange
      ? 'PO updated — value changed, approval reset & re-queued for the supervisor'
      : 'PO updated',
    zh: commercialChange
      ? '采购单已更新 — 金额变动，审批已重置并重新进入主管队列'
      : '采购单已更新',
  });
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
/* Pengaman terakhir: apa pun lebar .paper yang diminta dokumennya, saat
   DICETAK dia tidak boleh melebihi area cetak. Tanpa ini, satu dokumen yang
   lebarnya kelewat sedikit kehilangan kolom paling kanannya di setiap halaman
   dan tidak ada apa pun di layar yang memberi tahu. */
@media print{
  body{padding:0;display:block}
  .paper{max-width:100%!important;width:100%!important;box-sizing:border-box}
  /* Padding atas/bawah kertas DIHAPUS saat mencetak: margin halaman sudah
     disediakan @page. Dibiarkan, keduanya bertumpuk — dokumen PO ini lebih
     tinggi 21px dari satu halaman A4, dan 21px itu cukup untuk melahirkan
     halaman kedua berisi satu baris syarat yang terpotong. Padding kiri/kanan
     TETAP, karena lebar kolom tabel dihitung terhadapnya. */
  .paper{padding-top:0!important;padding-bottom:0!important}
  table{table-layout:fixed}
}
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
