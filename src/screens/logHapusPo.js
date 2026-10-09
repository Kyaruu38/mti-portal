// ---------------------------------------------------------------------------
// LOG HAPUS PO — satu layar untuk setiap PO yang pernah dibuang.
//
// KENAPA LAYAR INI ADA
// Catatannya sebenarnya SUDAH ADA sejak lama: setiap jalur penghapusan menulis
// barisnya ke audit_log (delete_own_pending, request_delete, approve_delete,
// reject_delete). Yang tidak ada adalah tempat membacanya. Satu-satunya jalan
// sebelum ini:
//
//   1. kartu "Aktivitas Terbaru" di Dashboard — 6 baris terakhir, semua jenis
//      kejadian bercampur, jadi satu penghapusan terdorong keluar layar oleh
//      enam kali ganti status;
//   2. tab Audit di dalam ekspor Excel Reports — terbaca sesudah diunduh dan
//      dibuka, dan tidak ada yang mengunduh laporan untuk memeriksa satu PO;
//   3. drawer audit di Master Data — hanya untuk supplier.
//
// Jadi pertanyaan "siapa yang menghapus PO ini, kapan, dan kenapa" tidak punya
// jawaban yang bisa dibuka dalam sepuluh detik. Sekarang punya.
//
// SIAPA YANG BOLEH MEMBUKANYA
// Supervisor (wilbert, dan kevin yang dialias ke peran yang sama) serta manajer
// (cenjc). Penjaganya DUA lapis dan keduanya perlu: ACCESS menyembunyikan menu,
// `can(..., 'auditHapus')` di bawah menolak layarnya sendiri — karena sebuah id
// layar bisa sampai ke render() lewat tab yang tersimpan, lewat notifikasi,
// atau lewat hasil pencarian global, bukan cuma lewat klik di menu.
//
// LAYAR INI TIDAK MENULIS APA PUN. Tidak ada tombol yang mengubah baris audit,
// dan memang tidak boleh ada: catatan yang bisa disunting oleh orang yang
// catatannya sedang diperiksa bukan catatan.
// ---------------------------------------------------------------------------
import { h } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { card, badge, btn, sectionHead, searchInput, pager, pageSlice, PAGE_DEFAULT } from '../ui/components.js';
import { fmtDateTime } from '../core/format.js';
import { can } from '../auth/roles.js';
import { fetchAuditLog } from '../core/auditApi.js';
import { writeWorkbook } from '../core/xlsx.js';

// Keempat aksi yang berarti "PO ini dibuang, atau ada yang minta dibuang".
//
// Disimpan sebagai DAFTAR, bukan sebagai regex /delete/, karena tabel audit
// juga memuat aksi bernama 'delete' milik entity lain (supplier, item, PRF) dan
// kelak bisa memuat aksi PO baru yang kebetulan mengandung kata itu. Daftar
// yang salah menampilkan baris akan ketahuan; regex yang diam-diam melebar
// tidak.
const AKSI = {
  delete_own_pending: {
    tone: 'red',
    label: { id: 'Dihapus langsung', en: 'Deleted directly', zh: '直接删除' },
    arti: {
      id: 'PO belum disetujui siapa pun, jadi pembuatnya boleh membuangnya sendiri.',
      en: 'The PO was not approved by anyone yet, so its author could delete it himself.',
      zh: '该采购单尚未经任何人批准，制单人可自行删除。',
    },
  },
  request_delete: {
    tone: 'amber',
    label: { id: 'Minta dihapus', en: 'Deletion requested', zh: '申请删除' },
    arti: {
      id: 'PO sudah disetujui, jadi permintaannya masuk antrean supervisor.',
      en: 'The PO was already approved, so the request went to the supervisor queue.',
      zh: '该采购单已批准，申请进入主管审批队列。',
    },
  },
  approve_delete: {
    tone: 'red',
    label: { id: 'Hapus disetujui', en: 'Deletion approved', zh: '删除已批准' },
    arti: {
      id: 'Supervisor menyetujui permintaannya. PO-nya hilang dari semua layar.',
      en: 'The supervisor approved the request. The PO is gone from every screen.',
      zh: '主管批准了申请，该采购单已从所有页面消失。',
    },
  },
  reject_delete: {
    tone: 'green',
    label: { id: 'Hapus ditolak', en: 'Deletion rejected', zh: '删除被驳回' },
    arti: {
      id: 'Supervisor menolak. PO-nya tetap ada.',
      en: 'The supervisor refused. The PO stays.',
      zh: '主管驳回申请，采购单保留。',
    },
  },
};
const AKSI_KUNCI = Object.keys(AKSI);

const labelAksi = (a) => tr((AKSI[a] && AKSI[a].label) || { id: a, en: a, zh: a });

// ---------------------------------------------------------------------------
// MEMUAT DARI SERVER, BUKAN DARI st.audit.
//
// st.audit cuma berisi 20 baris TERAKHIR dari seluruh portal (lihat
// session.js) — penghapusan PO bulan lalu sudah lama terdorong keluar dari
// sana. Layar yang menjawab "kapan PO ini dihapus" tidak boleh dibatasi oleh
// daftar yang panjangnya dipilih untuk sebuah kartu di Dashboard.
//
// Batasnya 1000: cukup untuk bertahun-tahun penghapusan PO di volume portal
// ini, dan tetap satu permintaan. fetchAuditLog() tanpa limit akan memaginasi
// SELURUH audit_log, yang isinya ribuan baris ganti status yang tidak ada
// hubungannya dengan layar ini.
async function muat() {
  setUI({ logHapusMuat: true });
  try {
    const rows = await fetchAuditLog('po', null, 1000);
    // null = gagal baca. DIBEDAKAN dari [] = tidak ada penghapusan sama sekali,
    // karena yang satu berarti "coba lagi" dan yang satu berarti "memang bersih".
    setUI({ logHapusRows: rows || [], logHapusGagal: rows === null, logHapusMuat: false });
  } catch (e) {
    console.error('log hapus PO gagal dimuat', e);
    setUI({ logHapusRows: [], logHapusGagal: true, logHapusMuat: false });
  }
}

async function ekspor(rows) {
  const judul = ['Waktu', 'Aksi', 'No. PO', 'Oleh', 'Alasan'];
  const aoa = [judul, ...rows.map(r => [
    fmtDateTime(r.at), labelAksi(r.action), r.target || '', r.user || '', r.detail || '',
  ])];
  const nama = `log-hapus-po-${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    await writeWorkbook(nama, [{ name: 'Log Hapus PO', aoa }]);
  } catch (e) {
    console.error('ekspor log hapus PO gagal', e);
    toast({
      id: 'Gagal membuat file Excel: ' + (e.message || e),
      en: 'Could not build the Excel file: ' + (e.message || e),
      zh: '生成 Excel 文件失败：' + (e.message || e),
    });
  }
}

export function logHapusPoScreen() {
  const st = getState();
  const ui = st.ui || {};

  // Lapis kedua. ACCESS sudah menyembunyikan menunya; ini menolak layarnya
  // kalau id-nya sampai ke sini lewat jalan lain.
  if (!can(st.user.role, 'auditHapus')) {
    return h('div.stack', [card(h('div', { style: { padding: '28px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.7 } }, [
      h('div', { style: { fontWeight: 700, color: 'var(--text-2)' } }, tr({
        id: 'Layar ini cuma untuk supervisor dan manajer.',
        en: 'This screen is for the supervisor and the manager only.',
        zh: '此页面仅供主管与经理使用。',
      })),
      h('div', tr({
        id: 'Akunmu tidak punya aksesnya.',
        en: 'Your account does not have access.',
        zh: '你的账号没有访问权限。',
      })),
    ]))]);
  }

  // Muat sekali saat layarnya pertama dibuka. Dipanggil di luar siklus render
  // supaya setUI di dalam muat() tidak terjadi di tengah pembangunan pohon.
  if (ui.logHapusRows === undefined && !ui.logHapusMuat) {
    setTimeout(muat, 0);
  }

  const semua = (ui.logHapusRows || []).filter(r => AKSI[r.action]);
  const saringAksi = ui.logHapusAksi || 'ALL';
  const cari = String(ui.logHapusCari || '').trim().toLowerCase();

  const tersaring = semua.filter(r => {
    if (saringAksi !== 'ALL' && r.action !== saringAksi) return false;
    if (!cari) return true;
    return [r.target, r.user, r.detail].some(x => String(x || '').toLowerCase().includes(cari));
  });

  const size = ui.logHapusSize == null ? PAGE_DEFAULT : ui.logHapusSize;
  const hal = { ...pageSlice(tersaring, ui.logHapusPage || 1, size), size };

  const hitung = (a) => semua.filter(r => r.action === a).length;

  const tombolSaring = [
    btn(tr({ id: 'Semua', en: 'All', zh: '全部' }) + ` (${semua.length})`, {
      sm: true, variant: saringAksi === 'ALL' ? 'primary' : '',
      onClick: () => setUI({ logHapusAksi: 'ALL', logHapusPage: 1 }),
    }),
    ...AKSI_KUNCI.map(a => btn(labelAksi(a) + ` (${hitung(a)})`, {
      sm: true, variant: saringAksi === a ? 'primary' : '',
      onClick: () => setUI({ logHapusAksi: a, logHapusPage: 1 }),
    })),
  ];

  const kepala = h('div.row.wrap', { style: { alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' } }, [
    h('div', [
      h('h1.page-h1', tr({ id: 'Log Hapus PO', en: 'PO Deletion Log', zh: '采购单删除记录' })),
      h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginTop: '3px', lineHeight: 1.6 } }, tr({
        id: 'Setiap PO yang pernah dihapus atau diminta dihapus, beserta siapa dan alasannya. Layar ini hanya membaca — tidak ada yang bisa diubah dari sini.',
        en: 'Every PO that was deleted or proposed for deletion, with who did it and why. This screen only reads — nothing here can be changed.',
        zh: '所有已删除或申请删除的采购单，含操作人与原因。本页仅供查看，无法修改任何记录。',
      })),
    ]),
    h('div.row.gap8.wrap', [
      btn(tr({ id: 'Refresh dari server', en: 'Refresh from server', zh: '从服务器刷新' }), {
        sm: true, iconName: 'refresh', onClick: () => muat(),
      }),
      btn(tr({ id: 'Export Excel', en: 'Export Excel', zh: '导出 Excel' }), {
        sm: true, iconName: 'download', disabled: !tersaring.length, onClick: () => ekspor(tersaring),
      }),
    ]),
  ]);

  const kolomJudul = [
    tr({ id: 'Waktu', en: 'Time', zh: '时间' }),
    tr({ id: 'Aksi', en: 'Action', zh: '操作' }),
    tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
    tr({ id: 'Oleh', en: 'By', zh: '操作人' }),
    tr({ id: 'Alasan', en: 'Reason', zh: '原因' }),
  ];

  const isiTabel = ui.logHapusMuat
    ? h('tr', h('td', { colspan: 5, style: { textAlign: 'center', padding: '28px', color: 'var(--text-3)', fontSize: '12.5px' } },
        tr({ id: 'Memuat…', en: 'Loading…', zh: '加载中…' })))
    : !hal.items.length
      ? h('tr', h('td', { colspan: 5, style: { textAlign: 'center', padding: '28px', color: 'var(--text-3)', fontSize: '12.5px', lineHeight: 1.7 } },
          ui.logHapusGagal
            ? tr({
                id: 'Gagal membaca log dari server. Tekan Refresh untuk mencoba lagi.',
                en: 'Could not read the log from the server. Press Refresh to try again.',
                zh: '无法从服务器读取记录。请点击刷新重试。',
              })
            : semua.length
              ? tr({ id: 'Tidak ada yang cocok dengan saringan ini.', en: 'Nothing matches this filter.', zh: '没有符合此筛选条件的记录。' })
              : tr({ id: 'Belum ada PO yang dihapus.', en: 'No PO has been deleted yet.', zh: '尚无采购单被删除。' })))
      : hal.items.map(r => h('tr', [
          h('td', { style: { fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' } }, r.at ? fmtDateTime(r.at) : '—'),
          h('td', badge(labelAksi(r.action), (AKSI[r.action] || {}).tone || 'gray')),
          h('td.mono', { style: { fontSize: '11.5px', fontWeight: 700 } }, r.target || '—'),
          h('td', { style: { fontSize: '11.5px' } }, r.user || '—'),
          // Alasannya sengaja TIDAK dipotong. Itu satu-satunya kalimat yang
          // menjelaskan kenapa sebuah dokumen tidak ada lagi, dan memotongnya
          // di 60 karakter menghemat beberapa piksel dengan menghapus justru
          // bagian yang dicari orang.
          h('td', { style: { fontSize: '11.5px', color: 'var(--text-2)', lineHeight: 1.55, whiteSpace: 'normal' } }, r.detail || '—'),
        ]));

  const tabel = h('div.card', [
    sectionHead(
      tr({ id: 'Riwayat penghapusan', en: 'Deletion history', zh: '删除记录' }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${tersaring.length} baris`, en: `${tersaring.length} rows`, zh: `${tersaring.length} 行`,
      })),
    ),
    h('div', { style: { padding: '10px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' } }, [
      ...tombolSaring,
      h('div', { style: { marginLeft: 'auto', minWidth: '220px' } }, searchInput({
        id: 'logHapusCari',
        value: ui.logHapusCari || '',
        placeholder: tr({ id: 'Cari No. PO, user, atau alasan', en: 'Search PO no., user, or reason', zh: '搜索采购单号、用户或原因' }),
        onChange: (v) => setUI({ logHapusCari: v, logHapusPage: 1 }),
      })),
    ]),
    h('div.tbl-wrap', h('table.tbl', { style: { width: '100%' } }, [
      h('thead', h('tr', kolomJudul.map(c => h('th', c)))),
      h('tbody', isiTabel),
    ])),
    pager(hal, {
      onPage: (n) => setUI({ logHapusPage: n }),
      onSize: (n) => setUI({ logHapusSize: n, logHapusPage: 1 }),
    }),
  ]);

  // Keterangan arti tiap aksi. Ditulis di layar, bukan diwariskan lisan: empat
  // nilai ini kelihatan mirip dari namanya saja, dan membedakan "minta dihapus"
  // dari "hapus disetujui" justru inti dari layar ini.
  const keterangan = card([
    sectionHead(tr({ id: 'Arti tiap aksi', en: 'What each action means', zh: '各项操作的含义' })),
    h('div', { style: { padding: '12px 16px', display: 'grid', gap: '9px' } },
      AKSI_KUNCI.map(a => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } }, [
        h('div', { style: { minWidth: '130px' } }, badge(labelAksi(a), AKSI[a].tone)),
        h('div', { style: { fontSize: '11.5px', color: 'var(--text-2)', lineHeight: 1.6 } }, tr(AKSI[a].arti)),
      ]))),
  ]);

  return h('div.stack', [kepala, tabel, keterangan]);
}
