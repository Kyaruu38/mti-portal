// ---------------------------------------------------------------------------
// KAS LABEL — sisa PO label yang belum pernah ditarik ke 采购申请.
//
// KENAPA LAYAR INI ADA
// MOQ supplier 3000, kebutuhan sona 1000. PO-nya dinaikkan ke 3000 lewat
// tombol Mark Up, lalu 采购申请 dibuat bertahap mengikuti kiriman. Sisa yang
// belum ditarik itulah kas — barangnya sudah dipesan dan sudah dicetak, tinggal
// diminta bertahap.
//
// Tanpa layar ini kas tidak terlihat di mana pun. Angka yang cuma hidup di
// kepala orang yang membuat PO-nya adalah angka yang hilang waktu dia cuti,
// dan yang menggantikannya akan membuat PO baru untuk barang yang sudah
// dibayar setengahnya.
//
// YANG DITAMPILKAN ADALAH KAS, BUKAN STOK. Tiga hitungan sisa di portal ini
// bunyinya mirip dan bergerak beda kecepatan:
//
//   sisa PO      turun waktu BARANG DATANG      layar PO Outstanding
//   kas          turun waktu EXCEL DITARIK      layar ini
//   stok fisik   turun waktu DIPAKAI PRODUKSI   layar Label Stock
//
// Kas 2000 TIDAK berarti ada 2000 lembar di gudang. Kolom di bawah sengaja
// diberi judul "belum ditarik", bukan "sisa" polos.
// ---------------------------------------------------------------------------
import { h } from '../core/dom.js';
import { getState, setUI } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, hitunganSaring } from '../ui/components.js';
import { fmtDate, num } from '../core/format.js';
import { can } from '../auth/roles.js';
import { barisKas, totalKas } from '../core/kasLabel.js';
import { erpModal } from './approval.js';

// `tipe:'pilih'` WAJIB membawa `opsi` — jendelaFilter() membangun <select>-nya
// dari `...(m.opsi || [])`, jadi kotak pilih tanpa opsi cuma berisi "Semua" dan
// tidak pernah bisa dipakai. Cacat itu sudah pernah dikirim sekali di v15.5.
const MEDAN = (rows) => {
  const unik = (ambil) => [...new Set((rows || []).map(ambil).filter(Boolean))].sort();
  return [
    { kunci: 'supplier', label: t('col_supplier'), tipe: 'pilih', opsi: unik(r => r.supplier), ambil: r => r.supplier },
    { kunci: 'erp', label: tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编号' }), tipe: 'teks', mono: true, ambil: r => r.erp },
    { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => r.poNo },
    { kunci: 'tgl', label: t('col_date'), tipe: 'tanggal', ambil: r => r.tanggalPo },
  ];
};

export function kasLabelScreen() {
  const st = getState();
  const semua = barisKas(st);
  const medan = MEDAN(semua);
  const nilai = nilaiFilter('kas-label');
  const daftar = saring(semua, medan, nilai);
  const judul = tr({ id: 'Kas Label', en: 'Label balance', zh: '标签额度' });

  // Yang boleh menarik excel. Bukan sekadar menyembunyikan tombol: RLS di
  // erp_tarikan hanya mengizinkan INSERT dari wilbert/cania/visca, jadi tombol
  // untuk peran lain cuma menjanjikan yang akan ditolak server.
  const bisaTarik = can(st.user.role, 'poCreate') || can(st.user.role, 'approve');

  const totalSisa = totalKas(daftar);

  return h('div.stack', [
    card([
      h('div.card-head', [
        h('div.card-title', judul),
        badge(String(daftar.length), daftar.length ? 'accent' : 'gray'),
        hitunganSaring(daftar.length, semua.length, { id: 'baris', en: 'rows', zh: '行' }),
        tombolFilter({ id: 'kas-label', medan, judul }),
      ]),

      // Riwayat tarikan gagal dimuat = setiap angka di tabel ini terlalu besar.
      // Layar yang menampilkan kas penuh untuk PO yang sudah ditarik separuh
      // lebih berbahaya daripada layar kosong, karena angkanya kelihatan wajar.
      st.erpTarikanGagal ? h('div', {
        style: {
          margin: '12px 16px', background: 'var(--st-red-bg)', border: '1px solid var(--st-red-tx)',
          borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: 'var(--st-red-tx)', fontWeight: 700,
        },
      }, tr({
        id: 'Riwayat tarikan GAGAL DIMUAT. Angka di bawah menampilkan kas penuh untuk semua PO — termasuk yang sudah pernah ditarik. Muat ulang halaman sebelum memakai layar ini.',
        en: 'The pull history FAILED TO LOAD. The figures below show a full balance for every PO — including ones already pulled. Reload the page before using this screen.',
        zh: '取数历史加载失败。下方数字对所有采购单都显示为完整额度 — 包括已取过数的。请先刷新页面再使用本页。',
      })) : null,

      h('div', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
        id: 'Kas = jumlah PO dikurangi yang sudah pernah ditarik ke 采购申请. Ini BUKAN stok gudang — barangnya mungkin belum dikirim supplier. Stok fisik ada di Label Stock, barang yang belum datang ada di PO Outstanding.',
        en: 'Balance = PO quantity minus what has already been pulled into 采购申请. This is NOT warehouse stock — the supplier may not have shipped it yet. Physical stock is in Label Stock; undelivered goods are in PO Outstanding.',
        zh: '额度 = 采购单数量减去已取入采购申请的数量。这不是库存 — 供应商可能尚未发货。实物库存见标签库存，未到货见未结采购单。',
      })),

      daftar.length ? h('table.tbl', { style: { width: '100%' } }, [
        h('thead', h('tr', [
          h('th', t('col_supplier')),
          h('th', tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编号' })),
          h('th', tr({ id: 'Nama', en: 'Name', zh: '名称' })),
          h('th', tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' })),
          h('th', t('col_date')),
          h('th', { style: { textAlign: 'right' } }, tr({ id: 'Qty PO', en: 'PO qty', zh: '采购数量' })),
          h('th', { style: { textAlign: 'right' } }, tr({ id: 'Sudah ditarik', en: 'Pulled', zh: '已取' })),
          h('th', { style: { textAlign: 'right' } }, tr({ id: 'Belum ditarik', en: 'Not yet pulled', zh: '未取' })),
          h('th', ''),
        ])),
        h('tbody', daftar.map(k => h('tr', [
          h('td', { style: { fontSize: '11.5px' } }, k.supplier || '—'),
          h('td.mono', { style: { fontSize: '11px' } }, k.erp || '—'),
          h('td', { style: { fontSize: '11px', color: 'var(--text-2)' } }, String(k.nama).slice(0, 38)),
          h('td.mono', { style: { fontSize: '11px' } }, k.poNo),
          h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, k.tanggalPo ? fmtDate(k.tanggalPo) : '—'),
          h('td.mono', { style: { fontSize: '11.5px', textAlign: 'right' } }, num(k.dipesan, 0)),
          h('td.mono', { style: { fontSize: '11.5px', textAlign: 'right', color: 'var(--text-3)' } },
            k.tahapTerakhir ? `${num(k.ditarik, 0)} (s/d tahap ${k.tahapTerakhir})` : '—'),
          h('td.mono', { style: { fontSize: '12px', textAlign: 'right', fontWeight: 800, color: k.lebih > 0 ? 'var(--st-red-tx)' : 'var(--accent-tx)' } },
            k.lebih > 0 ? `+${num(k.lebih, 0)} LEBIH` : num(k.sisa, 0)),
          h('td', { style: { textAlign: 'right' } }, bisaTarik ? btn(tr({ id: 'Tarik excel', en: 'Pull excel', zh: '取数' }), {
            sm: true, iconName: 'download',
            // selPO ikut diisi supaya kalau orangnya menutup jendelanya, layar
            // PO Saya / Approval membuka PO yang sama — bukan PO acak yang
            // kebetulan tertinggal dari klik sebelumnya.
            // erpLine IKUT DIKIRIM. Tabel ini satu baris per BARIS PO, dan
            // tanpa ini jendelanya mengisi seluruh baris PO itu sampai penuh —
            // menekan Unduh dari baris SKU B ikut menghabiskan kas SKU A, dan
            // erp_tarikan tidak punya policy DELETE untuk membatalkannya.
            onClick: () => setUI({ erpPo: k.poId, erpLine: k.lineId, selPO: k.poId, poSayaSel: k.poId }),
          }) : null),
        ]))),
        h('tfoot', h('tr', [
          h('td', { colSpan: 7, style: { textAlign: 'right', fontWeight: 700, fontSize: '11.5px' } },
            tr({ id: 'Total belum ditarik', en: 'Total not yet pulled', zh: '未取合计' })),
          h('td.mono', { style: { textAlign: 'right', fontWeight: 800, fontSize: '12.5px' } }, num(totalSisa, 0)),
          h('td', ''),
        ])),
      ]) : h('div', { style: { padding: '30px 18px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-3)', lineHeight: 1.6 } },
        jumlahFilterAktif(nilai) > 0
          ? tr({ id: 'Tidak ada kas yang cocok dengan filter.', en: 'No balance matches the filter.', zh: '没有符合筛选条件的额度。' })
          : tr({
              id: 'Belum ada kas. Kas muncul saat sebuah PO label disetujui dan belum seluruh jumlahnya ditarik ke 采购申请 — biasanya karena PO-nya di-Mark Up di atas permintaan.',
              en: 'No balance yet. A balance appears when an approved label PO has not had its full quantity pulled into 采购申请 — usually because the PO was marked up above the request.',
              zh: '暂无额度。当已批准的标签采购单尚未将全部数量取入采购申请时会出现额度 — 通常是因为采购单在申请数量之上做了上调。',
            })),
    ]),
    st.ui.erpPo ? erpModal() : null,
  ]);
}
