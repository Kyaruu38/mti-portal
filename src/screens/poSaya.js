// ---------------------------------------------------------------------------
// PO SAYA — daftar PO buatan sendiri, dengan pratinjau dan tombolnya.
//
// KENAPA LAYAR INI ADA
// v15.4 memasang tombol Edit dan Hapus di layar Approval, untuk pembuat PO
// yang belum disetujui. Tombolnya benar, RLS-nya benar, RPC-nya benar — dan
// TIDAK ADA SATU ORANG PUN YANG BISA MELIHATNYA, karena `approval` tidak ada
// di ACCESS.cania maupun ACCESS.visca. Fitur yang pintunya tidak pernah
// dibuat. Dua reviewer melewatkannya karena keduanya diminta memeriksa
// approval.js dan SQL-nya, bukan tabel navigasi.
//
// Layar ini pintunya. Bentuknya sengaja MENIRU layar Approval — daftar di
// kiri, pratinjau dokumen di kanan, tombol di kepala kartu — karena itu bentuk
// yang sudah dikenal orang di sini, dan karena permintaannya memang begitu:
// "click PO mereka baru keluar kyk gw mau approve".
//
// YANG MEMBEDAKANNYA DARI LAYAR APPROVAL
//   - Daftarnya HANYA PO buatan sendiri (poMilikku), bukan antrean semua orang.
//   - Tidak ada Approve. Tidak ada Reject. Dua itu milik supervisor, dan
//     bukan cuma disembunyikan di sini: pos_guard_status_trg di basis data
//     menolak perubahan status dari siapa pun selain wilbert.
//   - Edit dan Hapus muncul HANYA selama PO-nya belum disetujui. Sesudah
//     disetujui, PDF-nya sudah bercap dan bisa saja sudah ada di tangan
//     pemasok; yang mengubahnya harus yang menandatanganinya.
//
// Jendela Edit, jendela Template ERP, dan pembungkus cetak SEMUANYA diimpor
// dari approval.js — bukan disalin. Dua salinan penyusun dokumen adalah dua
// salinan yang suatu hari mencetak angka berbeda dari PO yang sama.
// ---------------------------------------------------------------------------
import { h, downloadBlob } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, hitunganSaring } from '../ui/components.js';
import { money, fmtDate } from '../core/format.js';
import { statusText } from '../core/statusText.js';
import { can } from '../auth/roles.js';
import { UUID_RE } from '../core/posApi.js';
import { poDocument, ensureCap } from '../ui/documents.js';
import { canBuildErp } from '../core/erpRequest.js';
import { bolehUrusSendiri, poMilikku, hapusPoSendiri, bolehMintaHapus, mintaHapusPo } from '../core/poAkses.js';
import { wrapPrintable, openPoEdit, poEditModal, erpModal } from './approval.js';

const nada = s => (s === 'Approved' ? 'green' : s === 'Rejected' ? 'red' : 'amber');

// `tipe: 'pilih'` WAJIB membawa `opsi`. jendelaFilter() membangun <select>-nya
// dari `...(m.opsi || [])`, jadi kotak pilih tanpa opsi cuma berisi "Semua" dan
// filternya tidak pernah bisa dipakai — kontrol yang kelihatan hidup tapi tidak
// melakukan apa pun. dashboard.js menghitung opsinya dari baris, approval.js
// memilih memakai `tipe:'teks'`; yang salah cuma versi pertama layar ini.
const MEDAN = (rows) => {
  const unik = (ambil) => [...new Set((rows || []).map(ambil).filter(Boolean))].sort();
  return [
    { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: p => p.no || '' },
    { kunci: 'supplier', label: t('col_supplier'), tipe: 'pilih', opsi: unik(p => p.supplier || ''), ambil: p => p.supplier || '' },
    { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: unik(p => statusText(p.status)), ambil: p => statusText(p.status) },
  ];
};

export function poSayaScreen() {
  const st = getState();
  const semua = poMilikku(st);
  const nilai = nilaiFilter('po-saya');
  const medan = MEDAN(semua);
  const daftar = saring(semua, medan, nilai);
  const menunggu = semua.filter(p => p.status === 'Menunggu Approval').length;

  // Baris terpilih diambil dari `semua`, BUKAN dari `daftar`. Kalau filternya
  // menyembunyikan PO yang sedang dibuka, panel kanannya tidak boleh ikut
  // kosong — yang disaring itu daftarnya, bukan yang sedang dibaca orang.
  //
  // `selPO` ikut dibaca, dan PO milik orang lain ikut BOLEH ditampilkan. Itu
  // yang membuat pencarian global punya tujuan: SEARCH_TYPES.PO dulu hanya
  // menunjuk layar `approval`, jadi cania mengetik nomor PO, hasilnya muncul,
  // dan tidak ada tombol Buka sama sekali. Yang dibuka read-only — daftar di
  // kiri tetap hanya PO miliknya, dan bolehUrusSendiri() tetap yang memutuskan
  // ada tidaknya tombol.
  //
  // "Read-only" DI SINI BERARTI TIDAK BISA MENGUBAH, BUKAN TIDAK BISA MENGUNDUH.
  // Tombol PDF dan Unduh HTML tetap hidup untuk PO orang lain, dan kalau PO itu
  // sudah Approved, yang keluar adalah dokumen BERCAP. Itu keputusan, bukan
  // kelolosan: cania dan visca satu meja dan saling menggantikan waktu cuti,
  // pos_read memang terbuka untuk setiap akun yang login, dan dokumennya toh
  // sudah terlukis utuh di panel ini — memblokir tombolnya cuma memaksa orang
  // memotret layar. Kalau Kyaru mau ini ditutup, syaratnya satu baris:
  // `po.by === st.user.username || can(peran, 'approve')` di dua tombol itu.
  const kunci = st.ui.poSayaSel || st.ui.selPO;
  const po = semua.find(p => p.id === kunci) || (st.pos || []).find(p => p.id === kunci) || null;

  const judul = tr({ id: 'PO Saya', en: 'My POs', zh: '我的采购单' });

  const panelDaftar = card([
    h('div.card-head', [
      h('div.card-title', judul),
      badge(String(menunggu), menunggu ? 'accent' : 'gray'),
      hitunganSaring(daftar.length, semua.length, { id: 'PO', en: 'PO', zh: '个采购单' }),
      tombolFilter({ id: 'po-saya', medan, judul }),
    ]),
    // Gaya baris terpilih disalin PERSIS dari layar Approval (var(--sel-row) +
    // garis aksen kiri) supaya dua layar yang bentuknya sengaja mirip tidak
    // terasa seperti dua aplikasi berbeda.
    ...daftar.map(p => h('div.row.gap8', {
      style: {
        padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        background: po && p.id === po.id ? 'var(--sel-row)' : 'transparent',
        borderLeft: po && p.id === po.id ? '3px solid var(--accent)' : '3px solid transparent',
      },
      onClick: () => setUI({ poSayaSel: p.id }),
    }, [
      h('div.grow', [
        h('div.mono', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, p.no),
        h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, p.supplier || '—'),
        h('div.mono', { style: { fontSize: '12px', fontWeight: 600, marginTop: '4px' } }, money(p.total, p.currency)),
      ]),
      h('div.stack', { style: { gap: '6px', alignItems: 'flex-end' } }, [
        badge(statusText(p.status), nada(p.status)),
        h('div', { style: { fontSize: '10px', color: 'var(--text-3)' } }, p.createdAt ? fmtDate(p.createdAt) : ''),
      ]),
    ])),
    daftar.length ? null : h('div', { style: { padding: '22px 16px', fontSize: '12px', color: 'var(--text-3)', textAlign: 'center' } },
      jumlahFilterAktif(nilai) > 0
        ? tr({ id: 'Tidak ada PO yang cocok dengan filter.', en: 'No PO matches the filter.', zh: '没有符合筛选条件的采购单。' })
        : tr({ id: 'Anda belum membuat PO.', en: 'You have not raised any PO yet.', zh: '您尚未创建采购单。' })),
  ]);

  if (!po) {
    return h('div.stack', [
      h('div.grid', { style: { gridTemplateColumns: '330px 1fr', alignItems: 'start' } }, [
        panelDaftar,
        card([h('div', { style: { padding: '48px 24px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-3)', lineHeight: 1.6 } }, tr({
          id: 'Pilih PO di sebelah kiri untuk melihat dokumennya.',
          en: 'Pick a PO on the left to see its document.',
          zh: '在左侧选择一个采购单以查看其文件。',
        }))]),
      ]),
      st.ui.poEdit ? poEditModal() : null,
    ]);
  }

  const bisaUrus = bolehUrusSendiri(st, po);

  // window.open() DULU, sebelum await mana pun — browser cuma mengizinkan popup
  // selama masih di dalam rantai klik penggunanya. Satu await sebelum baris itu
  // dan popupnya diblokir walaupun pengaturannya sudah mengizinkan. Sama persis
  // dengan alasan yang ditulis di approval.js.
  const bukaPdf = async () => {
    const w = window.open('', '_blank');
    if (!w) {
      toast({ id: 'Popup diblokir — izinkan popup dulu buat Save PDF', en: 'Popup blocked — allow popups first to Save PDF', zh: '弹窗被拦截 — 请先允许弹窗再保存 PDF' });
      return;
    }
    // ensureCap() SEBELUM outerHTML: capnya dimuat belakangan, dan outerHTML
    // membaca DOM apa adanya saat itu juga. Tanpa penantian ini, PO yang sudah
    // disetujui bisa terunduh TANPA STEMPEL — tanpa error, tanpa tanda apa pun,
    // dan yang menyadarinya pemasoknya.
    await ensureCap();
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
  };

  const unduhHtml = async () => {
    await ensureCap();
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    downloadBlob(new Blob([html], { type: 'text/html' }), `${String(po.no).replace(/\//g, '-')}.html`);
    toast({ id: `PO ${po.no} diunduh`, en: `PO ${po.no} downloaded`, zh: `采购单 ${po.no} 已下载` });
  };

  const hapusSendiri = () => hapusPoSendiri(po, { bersihkan: () => setUI({ poSayaSel: null, selPO: null }) });

  // PO yang SUDAH disetujui tidak boleh dibuang sendiri — tapi harus tetap ada
  // jalan untuk MEMINTA-nya, dan jalan itu nyaris tidak ada di sini.
  //
  // Sampai review menemukannya, tombol Request Delete cuma ada di layar
  // Approval. cania dan visca tidak punya layar itu — jadi PO mereka yang sudah
  // disetujui dengan harga salah tidak punya jalan sama sekali untuk dicabut,
  // sementara nilainya terus ikut terhitung di Reports. Itu cacat v15.4 yang
  // sama persis, cuma bergeser satu nilai status.
  const bisaMintaHapus = bolehMintaHapus(st, po);
  const mintaHapus = () => mintaHapusPo(po);

  const tombol = [
    badge(statusText(po.status), nada(po.status)),
    btn(po.status === 'Approved'
      ? tr({ id: 'PDF', en: 'PDF', zh: 'PDF' })
      : tr({ id: 'PDF draft', en: 'Draft PDF', zh: '草稿 PDF' }),
      { iconName: 'download', onClick: bukaPdf }),
    btn(tr({ id: 'Unduh HTML', en: 'Download HTML', zh: '下载 HTML' }), { iconName: 'download', onClick: unduhHtml }),
    // Template ERP 采购申请明细. Syaratnya TIDAK dilonggarkan — canBuildErp()
    // tetap menuntut PO label yang sudah Approved, karena selama belum
    // disetujui angkanya masih bisa berubah dan 采购申请 di ERP adalah dokumen
    // resmi, bukan draft. Yang berubah cuma SIAPA yang bisa menjangkaunya:
    // sebelumnya hanya supervisor, padahal yang mengetik ulang barisnya ke ERP
    // justru cania dan visca.
    canBuildErp(po) ? btn(tr({ id: 'Template ERP', en: 'ERP template', zh: 'ERP 模板' }), { iconName: 'download', onClick: () => setUI({ erpPo: po.id }) }) : null,
    bisaUrus ? btn(tr({ id: 'Edit', en: 'Edit', zh: '编辑' }), { iconName: 'edit', onClick: () => openPoEdit(po) }) : null,
    bisaUrus ? btn(tr({ id: 'Hapus', en: 'Delete', zh: '删除' }), { variant: 'danger', onClick: hapusSendiri }) : null,
    bisaMintaHapus ? btn(tr({ id: 'Request Delete', en: 'Request Delete', zh: '申请删除' }), { variant: 'danger', onClick: mintaHapus }) : null,
  ].filter(Boolean);

  // Permintaan hapus yang sedang menggantung. Tanpa spanduk ini, yang sudah
  // mengajukan tidak punya cara tahu permintaannya tercatat, dan mengajukannya
  // lagi — atau menyimpulkan sistemnya diam lalu menelepon. Tombol Approve &
  // Hapus sengaja TIDAK ada di layar ini: itu milik supervisor, dan tempatnya
  // di Approval Queue.
  const spandukHapus = po.deleteRequested
    ? h('div', { style: { padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--st-red-bg)' } }, [
        h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--st-red-tx)' } }, tr({
          id: `Request hapus sudah diajukan — menunggu approval Wilbert. Alasan: ${po.deleteReason || '-'}`,
          en: `Delete request submitted — awaiting Wilbert's approval. Reason: ${po.deleteReason || '-'}`,
          zh: `删除申请已提交 — 等待 Wilbert 审批。原因：${po.deleteReason || '-'}`,
        })),
      ])
    : null;

  const panelPratinjau = card([
    h('div.card-head', [
      h('div', [
        h('div.card-title', tr({ id: 'Pratinjau PO', en: 'PO preview', zh: '采购单预览' })),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, po.contract || po.no),
      ]),
      h('div.mla.row.gap8.wrap', tombol),
    ]),
    spandukHapus,
    // Kalimat ini menjelaskan APA yang sedang dilihat, bukan apa yang boleh
    // diklik. PO yang belum disetujui memang boleh dikirim ke pemasok untuk
    // konfirmasi angka — yang tidak boleh adalah menyebutnya PO resmi.
    po.status === 'Approved' ? null : h('div', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
      id: 'Belum di-approve, jadi PDF-nya belum ada tanda tangan dan cap — aman dipakai untuk konfirmasi angka ke supplier, bukan sebagai PO resmi.',
      en: 'Not approved yet, so the PDF carries no signature or seal — fine for confirming figures with the supplier, not as an official PO.',
      zh: '尚未批准，因此 PDF 没有签名和印章 — 可用于与供应商核对金额，但不能作为正式采购单。',
    })),
    // Kenapa tombolnya tidak ada — dan HANYA kalau memang tidak ada.
    //
    // Versi pertama menulis "PO ini bukan buatan Anda" untuk setiap PO yang
    // tombolnya absen. Itu SELALU bohong di layar ini: poMilikku() sudah
    // menyaring ke PO milik sendiri, jadi kalimat itu tidak pernah benar untuk
    // satu baris pun di daftar kiri. Lebih buruk lagi, dia menutupi sebab yang
    // sebenarnya pada PO yang gagal sinkron — orangnya menyimpulkan PO-nya
    // bukan miliknya lalu membuat ulang, dan lahirlah PO kembar.
    // Spanduk merahnya sudah menjelaskan sendiri kenapa tombolnya absen —
    // menambah kalimat abu-abu di bawahnya cuma dua penjelasan untuk satu
    // keadaan, dan yang kedua ("sudah diproses supervisor") kebetulan salah
    // untuk PO yang masih Menunggu Approval.
    bisaUrus || po.deleteRequested ? null : h('div', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 } }, (() => {
      const aku = st.user && st.user.username;
      // Cabang supervisor DULUAN, sebelum cabang "bukan buatan Anda".
      //
      // wilbert punya layar ini juga, dan `selPO` ikut dibaca di sini —
      // dia mengklik PO cania di Approval Queue, lalu mengklik menu PO Saya,
      // dan panel kanannya membuka PO cania. Dengan urutan yang lama, layar
      // memberitahunya "Anda bisa melihatnya, tapi tidak mengubahnya" tentang
      // PO yang bisa dia Edit, Approve, Reject dan hapus — satu layar di
      // sebelahnya. Persis jenis kalimat-yang-selalu-bohong yang rilis ini ada
      // untuk mencabutnya.
      if (can(st.user.role, 'approve')) return tr({
        id: 'Anda supervisor — benahi, setujui, atau batalkan PO ini dari Approval Queue.',
        en: 'You are the supervisor — amend, approve or cancel this PO from the Approval Queue.',
        zh: '您是主管 — 请在审批队列中修改、批准或取消该采购单。',
      });
      if (po.by !== aku) return tr({
        id: `Dibuat ${po.by || '—'} — Anda bisa melihatnya, tapi tidak mengubahnya.`,
        en: `Raised by ${po.by || '—'} — you can read it, not change it.`,
        zh: `由 ${po.by || '—'} 创建 — 您可以查看，但不能修改。`,
      });
      if (!UUID_RE.test(String(po.id))) return tr({
        id: 'PO ini belum tersinkron ke server, jadi belum bisa dibenahi atau dibuang dari sini. Coba muat ulang halaman; kalau tetap begini, kabari Wilbert.',
        en: 'This PO never synced to the server, so it cannot be amended or discarded here. Reload the page; if it stays this way, tell Wilbert.',
        zh: '该采购单未同步到服务器，因此无法在此修改或删除。请刷新页面；若仍如此，请告知 Wilbert。',
      });
      return tr({
        id: 'Sudah diproses supervisor — perubahan atau pembatalan lewat Wilbert.',
        en: 'Already handled by the supervisor — changes or cancellation go through Wilbert.',
        zh: '已由主管处理 — 修改或取消需经 Wilbert。',
      });
    })()),
    h('div', { style: { background: 'var(--bg)', padding: '26px', display: 'flex', justifyContent: 'center' }, class: 'paper-scroll' }, poDocument(po)),
  ]);

  return h('div.stack', [
    h('div.grid', { style: { gridTemplateColumns: '330px 1fr', alignItems: 'start' } }, [panelDaftar, panelPratinjau]),
    st.ui.poEdit ? poEditModal() : null,
    st.ui.erpPo ? erpModal() : null,
  ]);
}
