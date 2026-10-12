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
import { card, badge, btn, icon, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, hitunganSaring, pager, pageSlice } from '../ui/components.js';
import { num, fmtDate, BULAN_ID, BULAN_EN, BULAN_ZH } from '../core/format.js';
import { outstandingPOs, overDeliveredPOs, receivedBreakdown, isLabelPO, poSudahMasuk } from '../core/outstanding.js';
import { setPoItems } from '../core/posApi.js';
import { isConfigured } from '../core/supabase.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';

const key = (poId, lineId) => `${poId}::${lineId}`;

// ---------------------------------------------------------------------------
// JUMLAH YANG BENAR-BENAR DATANG, per baris.
//
// Sampai v18.0 tombol "Tandai sudah sampai" selalu menutup SELURUH sisa baris.
// Kiriman 8.000 dari 10.000 tidak punya cara dicatat: centang baris itu dan PO
// ikut tertutup penuh, padahal 2.000 masih di jalan. Satu-satunya jalan keluar
// adalah tidak mencentangnya sama sekali — jadi kedatangan 8.000 itu TIDAK
// TERCATAT DI MANA PUN, dan Purchasing tetap menagih sepuluh ribu.
//
// KENAPA Map DI LUAR RENDER, BUKAN ui STATE
// mount() di core/dom.js tidak punya diffing: setiap setUI membongkar seluruh
// pohon dan membangunnya lagi. Angka yang disimpan lewat setUI akan membuat
// kotaknya kehilangan fokus di digit pertama — orangnya mengetik "8", layar
// dibangun ulang, dan "000" berikutnya jatuh entah ke mana. Jadi angkanya
// disimpan di Map biasa TANPA setUI, kotaknya tidak dikendalikan state, dan
// yang diperbarui saat mengetik cuma satu simpul teks di bilah bawah.
const JUMLAH = new Map();

// Daftar PO yang sedang tampil, disimpan saat render supaya segarkanTotal()
// bisa menghitung ulang tanpa membangun ulang layar.
let DAFTAR = [];

// Default sebuah baris adalah SISA PENUHNYA. Kiriman penuh tetap satu klik —
// yang berubah cuma: sekarang angkanya bisa dikurangi.
function qtyBaris(k, l) {
  const v = JUMLAH.get(k);
  return v == null ? l.outstanding : v;
}
function setQtyBaris(k, v, l) {
  const n = Math.floor(Number(v));
  // Dijepit ke 1..sisa. Lebih dari sisa BUKAN kelebihan kiriman yang boleh
  // diketik di sini: di MTI tidak ada toleransi, dan kelebihan jalurnya
  // komplain Over qty, bukan angka penerimaan yang dibesarkan diam-diam.
  if (!Number.isFinite(n) || n <= 0) { JUMLAH.set(k, 0); return 0; }
  const jepit = Math.min(n, l.outstanding);
  JUMLAH.set(k, jepit);
  return jepit;
}
const lupakanQty = (k) => JUMLAH.delete(k);

// Bilah bawah diperbarui LANGSUNG ke DOM, tanpa setUI. Lihat alasannya di atas.
function segarkanTotal() {
  const el = document.getElementById('op-total-qty');
  if (!el) return;
  const st = getState();
  const sel = (st.ui && st.ui.opSel) || {};
  let total = 0, baris = 0;
  for (const x of DAFTAR) {
    for (const l of x.lines) {
      const k = key(x.po.id, l.lineId);
      if (l.outstanding > 0 && sel[k]) { total += qtyBaris(k, l); baris++; }
    }
  }
  el.textContent = num(total);
  const elB = document.getElementById('op-total-baris');
  if (elB) elB.textContent = String(baris);
}

// Nama jenis PO memakai kata yang tertulis di lencana kartunya, bukan kode
// internal 'label'/'biasa'. Yang memilih di sini sedang menunjuk lencana yang
// dia lihat; 'biasa' cuma ada di dalam kode dan tidak pernah muncul di layar.
const jenisPo = (po) => isLabelPO(po)
  ? tr({ id: 'Label', en: 'Label', zh: '标签' })
  : tr({ id: 'Non-label', en: 'Non-label', zh: '非标签' });

// Baris yang sudah lengkap TIDAK dirender di kartunya, jadi tidak boleh ikut
// dicari: kecocokan pada ERP yang cuma ada di baris yang sudah tuntas akan
// memunculkan kartu yang di dalamnya tidak ada satu pun yang dicari orang.
const barisTampil = (x) => x.lines.filter(l => l.outstanding > 0);

// Penyaring layar PO Outstanding.
//
// Kotak teks + dropdown yang dulu berdiri di atas daftar sekarang duduk di
// balik satu tombol corong, sama seperti daftar lain di portal ini — satu cara
// mencari, bukan sepasang kotak yang selalu terpasang di layar yang isinya
// sudah panjang dengan kartu.
//
// Kotak No. PO menyapu nomor kontrak DAN nomor PO sekaligus walaupun kartunya
// cuma menampilkan salah satu: yang mengetik menyalin dari e-mail atau dari
// layar lain, dan tidak perlu tahu nomor mana yang kebetulan menang di sana.
//
// ERP dan nama item menyaring KARTU, bukan baris. Kartunya lolos kalau salah
// satu baris outstanding-nya cocok, dan kartu itu tetap tampil utuh — memotong
// isinya jadi baris yang cocok saja akan menyembunyikan sisa PO yang sama, dan
// justru sisa itulah yang menentukan kiriman berikutnya lengkap atau tidak.
//
// Opsi jenis PO diambil dari data yang ada: portal yang sedang tidak punya satu
// pun PO label tidak menawarkan pilihan yang pasti mengosongkan layar.
const MEDAN_OP = (semua) => [
  { kunci: 'po', label: tr({ id: 'No. PO / kontrak', en: 'PO / contract no.', zh: '采购单 / 合同号' }), tipe: 'teks', mono: true, ambil: x => `${x.po.contract || ''} ${x.po.no || ''}` },
  { kunci: 'supplier', label: tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }), tipe: 'teks', ambil: x => x.po.supplier },
  { kunci: 'erp', label: tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }), tipe: 'teks', mono: true, ambil: x => barisTampil(x).map(l => l.erp || '').join(' ') },
  { kunci: 'item', label: tr({ id: 'Nama item', en: 'Item name', zh: '物料名称' }), tipe: 'teks', ambil: x => barisTampil(x).map(l => l.d || l.desc || l.dimension || '').join(' ') },
  { kunci: 'jenis', label: tr({ id: 'Jenis PO', en: 'PO type', zh: '采购单类型' }), tipe: 'pilih', opsi: [...new Set((semua || []).map(x => jenisPo(x.po)).filter(Boolean))].sort(), ambil: x => jenisPo(x.po) },
];

export function outstandingPoScreen() {
  const st = getState(); const ui = st.ui;
  const canWrite = can(st.user.role, 'poReceive');

  const all = outstandingPOs(st);
  const medan = MEDAN_OP(all);
  const nilai = nilaiFilter('op');

  const list = saring(all, medan, nilai)
    .sort((a, b) => new Date(a.po.createdAt || 0) - new Date(b.po.createdAt || 0));

  const sel = ui.opSel || {};
  const chosen = Object.keys(sel).filter(k => sel[k]);

  const over = overDeliveredPOs(st);

  return h('div.stack', [
    over.length ? overBanner(over) : null,
    summaryCard(st, all),
    toolbar(all, list, medan),
    list.length
      ? h('div.stack', list.map(x => poCard(st, x, sel, canWrite)))
      : blokTakCocok(jumlahFilterAktif(nilai) > 0),
    canWrite && chosen.length ? (DAFTAR = list, actionBar(st, list, sel)) : null,
    masukCard(st),
  ]);
}

// ===========================================================================
// YANG SUDAH MASUK
// ---------------------------------------------------------------------------
// Layar ini sejak lahir cuma bisa menjawab "apa yang masih ditunggu". Lawannya
// — "yang kemarin itu jadi masuk tanggal berapa" — tidak punya tempat sama
// sekali, dan begitu sebuah PO tuntas ia hilang dari layar tanpa meninggalkan
// baris apa pun.
//
// SATU BARIS PER PO, tanggalnya penerimaan TERAKHIR (pilihan Kyaru). Perlu
// disebut terus terang: PO yang datang mencicil lintas bulan cuma muncul di
// bulan cicilan terakhirnya. Itu diterima secara sadar, bukan kelupaan —
// bentuk yang tidak punya kelemahan itu satu baris per KEJADIAN terima, dan
// itu butuh tabel penerimaan sendiri.
// ===========================================================================

const kunciBulan = (iso) => String(iso || '').slice(0, 7);   // YYYY-MM
const TANPA = '-';                                            // kelompok tak bertanggal

function namaBulan(kunci) {
  if (kunci === TANPA) return tr({ id: 'Tanpa tanggal', en: 'No date', zh: '无日期' });
  const [th, bl] = kunci.split('-');
  const i = Number(bl) - 1;
  return tr({
    id: `${BULAN_ID[i] || bl} ${th}`,
    en: `${BULAN_EN[i] || bl} ${th}`,
    zh: `${th}年${BULAN_ZH[i] || bl}`,
  });
}

// PILIHAN BULANNYA DIBANGUN DARI DATANYA, BUKAN DARI KALENDER.
//
// Dropdown 12 bulan yang sebelas di antaranya kosong membuat orang mengira
// portalnya rusak waktu memilih bulan yang memang tidak pernah ada barang
// masuk. Yang muncul di sini cuma bulan yang benar-benar punya baris.
function bulanAda(rows) {
  const set = new Set();
  let kosong = false;
  for (const r of rows) {
    if (!r.tgl) { kosong = true; continue; }
    set.add(kunciBulan(r.tgl));
  }
  // Terbaru di atas: yang dicari orang hampir selalu yang barusan.
  const urut = [...set].sort().reverse();
  // "Tanpa tanggal" ditaruh PALING BAWAH dan tidak pernah jadi bawaan — itu
  // sisa data lama, bukan tempat orang memulai.
  return kosong ? [...urut, TANPA] : urut;
}

const MEDAN_MASUK = (rows) => [
  { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => `${r.po.contract || ''} ${r.po.no || ''}`.trim() },
  { kunci: 'supplier', label: tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.po.supplier).filter(Boolean))].sort(), ambil: r => r.po.supplier },
  { kunci: 'jenis', label: tr({ id: 'Jenis', en: 'Type', zh: '类型' }), tipe: 'pilih', opsi: [...new Set(rows.map(r => jenisPo(r.po)))].sort(), ambil: r => jenisPo(r.po) },
  { kunci: 'status', label: tr({ id: 'Kelengkapan', en: 'Completeness', zh: '完成度' }), tipe: 'pilih', opsi: [...new Set(rows.map(statusMasukTeks))].sort(), ambil: statusMasukTeks },
  { kunci: 'tgl', label: tr({ id: 'Masuk', en: 'Arrived', zh: '到货' }), tipe: 'tanggal', ambil: r => r.tgl },
];

const statusMasukTeks = (r) => (r.lunas
  ? tr({ id: 'Lengkap', en: 'Complete', zh: '已齐' })
  : tr({ id: 'Sebagian', en: 'Partial', zh: '部分' }));

function masukCard(st) {
  const ui = st.ui;
  const semua = poSudahMasuk(st);
  if (!semua.length) return null;

  const pilihan = bulanAda(semua);
  // Bawaannya bulan TERBARU YANG ADA ISINYA, bukan bulan berjalan: bulan
  // berjalan bisa saja belum kedatangan apa-apa, dan menyambut orang dengan
  // daftar kosong di layar yang datanya sebenarnya penuh.
  let bln = ui.opMasukBulan;
  if (!pilihan.includes(bln)) bln = pilihan[0];

  const dibulan = semua.filter(r => (bln === TANPA ? !r.tgl : kunciBulan(r.tgl) === bln));
  const medan = MEDAN_MASUK(dibulan);
  const nilai = nilaiFilter('op-masuk');
  const tersaring = saring(dibulan, medan, nilai)
    .sort((a, b) => new Date(b.tgl || 0) - new Date(a.tgl || 0));

  const size = ui.opMasukSize === 0 ? 0 : (Number(ui.opMasukSize) || 10);
  const hal = { ...pageSlice(tersaring, ui.opMasukPage || 1, size), size };

  const gantiBulan = (v) => setUI({ opMasukBulan: v, opMasukPage: 1 });

  return card([
    h('div.card-head', [
      h('div.card-title', tr({ id: 'Sudah Masuk', en: 'Already Arrived', zh: '已到货' })),
      // <select>, bukan deretan tab: jumlah bulannya tumbuh setiap bulan, dan
      // tab akan melebar sampai membungkus baris kedua dalam setahun.
      h('select.input', {
        style: { width: 'auto', padding: '4px 10px', fontSize: '11.5px' },
        onChange: e => gantiBulan(e.target.value),
      }, pilihan.map(k => h('option', { value: k, selected: k === bln }, namaBulan(k)))),
      badge(String(dibulan.length), 'accent'),
      hitunganSaring(tersaring.length, dibulan.length, { id: 'PO', en: 'PO', zh: '张' }),
      tombolFilter({ id: 'op-masuk', medan, judul: tr({ id: 'Sudah Masuk', en: 'Already Arrived', zh: '已到货' }) }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'Masuk', en: 'Arrived', zh: '到货日期' }),
        tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
        tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }),
        tr({ id: 'Jenis', en: 'Type', zh: '类型' }),
        tr({ id: 'Diterima', en: 'Received', zh: '已收' }),
        tr({ id: 'Dipesan', en: 'Ordered', zh: '订购' }),
        tr({ id: 'Kelengkapan', en: 'Completeness', zh: '完成度' }),
      ].map((c, i) => h('th' + (i === 4 || i === 5 ? '.r' : ''), c)))),
      h('tbody', hal.items.length ? hal.items.map(r => h('tr', [
        h('td', { style: { fontSize: '11px', color: r.tgl ? 'var(--text-2)' : 'var(--text-3)' } },
          r.tgl ? fmtDate(r.tgl) : tr({ id: 'tidak tercatat', en: 'not recorded', zh: '未记录' })),
        h('td.mono.cell-strong', { style: { fontSize: '11.5px' } }, r.po.contract || r.po.no || '—'),
        h('td', r.po.supplier || '—'),
        h('td', badge(jenisPo(r.po), isLabelPO(r.po) ? 'accent' : 'navy')),
        h('td.mono.r', num(r.totalDiterima)),
        h('td.mono.r', { style: { color: 'var(--text-3)' } }, num(r.totalDipesan)),
        h('td', badge(statusMasukTeks(r), r.lunas ? 'green' : 'amber')),
      ])) : h('tr', h('td', { colspan: '7', style: { padding: '26px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' } },
        tr({
          id: 'Tidak ada yang cocok dengan saringan di bulan ini.',
          en: 'Nothing matches the filter in this month.',
          zh: '本月没有符合筛选条件的记录。',
        })))),
    ])),
    pager(hal, {
      onPage: n => setUI({ opMasukPage: n }),
      onSize: n => setUI({ opMasukSize: n, opMasukPage: 1 }),
      // Disebut di layar, bukan disembunyikan: satu baris per PO memang punya
      // kelemahan ini, dan yang membaca angkanya berhak tahu.
      note: tr({
        id: 'tanggalnya penerimaan terakhir tiap PO',
        en: 'the date is each PO\'s latest receipt',
        zh: '日期为每张采购单最近一次收货',
      }),
    }),
  ]);
}

// Layar ini merender KARTU per PO, bukan baris tabel, jadi pesan kosongnya
// tidak boleh memakai barisTakCocok(): itu sebuah <tr>, dan <tr> di luar
// <table> dibuang browser tanpa suara — pesannya hilang dan yang tersisa cuma
// layar kosong. Isinya sengaja sama persis: pesan plus jalan keluarnya, supaya
// "kosong karena saringan" tidak pernah terbaca sebagai "portal rusak".
function blokTakCocok(adaFilter) {
  const bersihkan = () => {
    const f = { ...(getState().ui.filters || {}) };
    delete f.op;
    setUI({ filters: f });
  };
  return card([h('div.card-pad', { style: { textAlign: 'center', padding: '30px 16px', color: 'var(--text-3)' } },
    h('div.stack', { style: { gap: '8px', alignItems: 'center' } }, [
      h('div', { style: { fontSize: '12.5px' } }, adaFilter
        ? tr({
            id: 'Tidak ada PO yang cocok dengan saringannya',
            en: 'No PO matches the filter',
            zh: '没有符合筛选条件的采购单',
          })
        : tr({
            id: 'Tidak ada PO dengan barang outstanding.',
            en: 'No PO with outstanding goods.',
            zh: '没有尚未到货的采购单。',
          })),
      adaFilter
        ? h('button.btn.btn-sm', { onClick: bersihkan },
            tr({ id: 'Bersihkan saringan', en: 'Clear filter', zh: '清除筛选' }))
        : null,
    ]))]);
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

// Yang tersisa di baris ini cuma angka dan tombol corongnya. Angkanya tetap
// dipasang di tempat yang sama: begitu saringan menyala, daftar kartu yang
// tinggal 3 dari 41 terlihat persis seperti daftar yang memang cuma punya 3 —
// dan tanpa pembandingnya, yang membacanya begitu akan mengira PO-nya hilang.
function toolbar(all, list, medan) {
  return h('div.row.gap8.wrap', { style: { alignItems: 'center' } }, [
    hitunganSaring(list.length, all.length, { id: 'PO', en: 'PO', zh: '张采购单' }),
    tombolFilter({
      id: 'op', medan,
      judul: tr({ id: 'Saring PO Outstanding', en: 'Filter Outstanding POs', zh: '筛选未结采购单' }),
    }),
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
          // Angka ketikan DIBUANG waktu barisnya dilepas. Kalau dibiarkan, baris
          // yang dicentang lagi besok akan membawa angka kemarin tanpa ada yang
          // menyadarinya.
          if (s[k]) { delete s[k]; lupakanQty(k); } else s[k] = true;
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
      // KOTAK JUMLAH DATANG. Hanya muncul kalau barisnya dicentang — kotak
      // kosong di ratusan baris yang tidak sedang diurus cuma ramai.
      canWrite ? h('td', { style: { width: '104px' } }, sel[k] ? h('input.input.mono', {
        type: 'number', min: '1', max: String(l.outstanding),
        value: String(qtyBaris(k, l)),
        style: { width: '96px', padding: '3px 6px', fontSize: '11.5px', textAlign: 'right' },
        title: tr({
          id: `Maksimal ${num(l.outstanding)}. Lebih dari itu jalurnya komplain Over qty.`,
          en: `At most ${num(l.outstanding)}. Anything beyond that is an Over qty complaint.`,
          zh: `最多 ${num(l.outstanding)}。超出部分请提交「数量超出」投诉。`,
        }),
        onInput: e => {
          const jepit = setQtyBaris(k, e.target.value, l);
          // Nilai kotaknya sengaja TIDAK ditulis ulang saat mengetik; menulis
          // ulang akan memindahkan kursor ke ujung di tengah ketikan.
          e.target.style.borderColor = jepit > 0 ? '' : 'var(--st-red-tx)';
          segarkanTotal();
        },
        onChange: e => {
          const jepit = setQtyBaris(k, e.target.value, l);
          if (String(jepit) !== e.target.value) e.target.value = String(jepit);
          segarkanTotal();
        },
      }) : h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, '—')) : null,
      h('td', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, l.unit || po.unit || ''),
    ]);
  });

  // Perataan ikut tiap kolom, bukan dihitung dari nomor urut. Versi lama
  // memakai rentang indeks (`i >= 3 && i <= 5`), dan menyisipkan satu kolom
  // menggeser diam-diam kolom mana yang rata kanan.
  const head2 = [
    canWrite ? { t: '', r: false } : null,
    { t: tr({ id: 'ERP', en: 'ERP', zh: 'ERP' }), r: false },
    { t: tr({ id: 'Item', en: 'Item', zh: '物料' }), r: false },
    { t: tr({ id: 'Dipesan', en: 'Ordered', zh: '订购' }), r: true },
    { t: tr({ id: 'Diterima', en: 'Received', zh: '已收' }), r: true },
    { t: tr({ id: 'Sisa', en: 'Outstanding', zh: '未交' }), r: true },
    canWrite ? { t: tr({ id: 'Datang sekarang', en: 'Arrived now', zh: '本次到货' }), r: true } : null,
    { t: tr({ id: 'Satuan', en: 'Unit', zh: '单位' }), r: false },
  ].filter(x => x !== null);

  return card([
    head,
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', head2.map(c => h('th' + (c.r ? '.r' : ''), c.t)))),
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
  // Totalnya dari angka yang DIKETIK, bukan dari sisa penuh.
  const totalQty = picked.reduce((s, p) => s + qtyBaris(key(p.po.id, p.line.lineId), p.line), 0);
  const poCount = new Set(picked.map(p => p.po.id)).size;
  const adaParsial = picked.some(p => qtyBaris(key(p.po.id, p.line.lineId), p.line) < p.line.outstanding);

  return h('div.card', { style: { padding: '13px 18px', position: 'sticky', bottom: '12px', zIndex: 5 } },
    h('div.row.gap12.wrap', { style: { alignItems: 'center' } }, [
      // Dua angka ini punya id supaya bisa diperbarui langsung saat orangnya
      // mengetik, tanpa membangun ulang seluruh layar.
      h('span', { style: { fontSize: '12px' } }, [
        h('b', [
          h('span#op-total-baris', String(picked.length)),
          tr({ id: ' baris dari ', en: ' lines from ', zh: ' 行 / ' }),
          String(poCount),
          tr({ id: ' PO', en: ' PO', zh: ' 张采购单' }),
        ]),
        h('span', { style: { color: 'var(--text-3)' } }, [
          tr({ id: ' · total ', en: ' · ', zh: ' · 共 ' }),
          h('span#op-total-qty', { style: { fontWeight: 700, color: 'var(--text)' } }, num(totalQty)),
          tr({ id: ' akan ditandai sudah sampai', en: ' in total will be marked as arrived', zh: ' 将被标记为已到货' }),
        ]),
      ]),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: 'Stok TIDAK diubah — ini cuma menutup sisa PO.',
        en: 'Stock is NOT touched — this only closes the PO balance.',
        zh: '不会改动库存 — 仅结清采购单余量。',
      })),
      adaParsial ? h('span', {
        style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--st-amber-tx)' },
      }, tr({
        id: 'Kiriman sebagian — sisanya tetap outstanding.',
        en: 'Partial delivery — the remainder stays outstanding.',
        zh: '部分到货 — 余量仍为未交。',
      })) : null,
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

  // Baris yang angkanya dikosongkan DITOLAK di depan, dengan menyebut barisnya.
  // Menyimpan nol diam-diam akan terbaca sebagai "sudah dicek, memang tidak ada
  // yang datang" — padahal yang terjadi cuma kotaknya belum diisi.
  const nol = picked.filter(p => qtyBaris(key(p.po.id, p.line.lineId), p.line) <= 0);
  if (nol.length) {
    toast({
      id: `${nol.length} baris jumlahnya masih kosong (${nol.map(p => p.line.erp).slice(0, 3).join(', ')}) — isi dulu`,
      en: `${nol.length} line(s) have no quantity yet (${nol.map(p => p.line.erp).slice(0, 3).join(', ')}) — fill them in first`,
      zh: `${nol.length} 行尚未填写数量（${nol.map(p => p.line.erp).slice(0, 3).join('、')}）— 请先填写`,
    });
    return;
  }

  const gagal = [];
  let okPo = 0, okLines = 0, okQty = 0;
  // SATU cap waktu untuk seluruh penekanan tombol, bukan satu per baris.
  // Menandai 40 baris sekaligus adalah SATU kejadian penerimaan; memberi
  // tiap baris new Date()-nya sendiri menghasilkan 40 waktu yang berbeda
  // beberapa milidetik dan tidak ada satu pun yang lebih benar.
  const sekarang = new Date().toISOString();

  for (const { po, lines } of byPo.values()) {
    // Salinan, bukan objek aslinya: kalau simpannya gagal, state di layar tidak
    // boleh terlanjur berubah seolah berhasil.
    const items = (po.items || []).map(it => {
      const hit = lines.find(l => l.lineId === it.lineId);
      if (!hit) return it;
      // receivedDirectAt = KAPAN TERAKHIR baris ini kedatangan barang.
      // Bukan yang pertama: kalau satu baris datang mencicil, yang dicari orang
      // di daftar "sudah masuk" adalah kedatangan terakhirnya. Riwayat lengkap
      // per cicilan tidak disimpan di sini — kalau suatu hari itu dibutuhkan,
      // tempatnya tabel penerimaan sendiri, bukan kolom kedua di dalam items.
      //
      // Perlu supabase_batal_request_dan_tgl_terima.sql: tanpa itu key baru ini
      // ditolak pos_guard_approved untuk cania & visca (wilbert lolos duluan),
      // dan penerimaan mereka gagal total.
      return {
        ...it,
        receivedDirect: (Number(it.receivedDirect) || 0) + qtyBaris(key(po.id, it.lineId), hit),
        receivedDirectAt: sekarang,
      };
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
    const qtyPo = lines.reduce((s, l) => s + qtyBaris(key(po.id, l.lineId), l), 0);
    const sisaPo = lines.reduce((s, l) => s + l.outstanding, 0);
    okPo++; okLines += lines.length; okQty += qtyPo;
    logAudit({
      entity: 'po', target: po.contract || po.no, action: 'receive',
      // Jejaknya menyebut PARSIAL atau tidak. Enam bulan lagi, "3 baris
      // ditandai sampai" tidak bisa dibedakan antara kiriman penuh dan
      // kiriman separuh, dan itu justru bedanya yang dicari orang.
      detail: `${lines.length} baris ditandai sudah sampai · ${num(qtyPo)} dari sisa ${num(sisaPo)} ${po.unit || ''}`
        + (qtyPo < sisaPo ? ' · PARSIAL, sisanya tetap outstanding' : ' · lengkap')
        + ' · stok tidak diubah',
    });
  }

  // Centangan yang gagal sengaja DIBIARKAN tercentang supaya bisa dicoba lagi;
  // yang berhasil dibersihkan supaya tidak ditandai dua kali.
  const sel = { ...(getState().ui.opSel || {}) };
  for (const p of picked) {
    if (!gagal.some(g => g.no === (p.po.contract || p.po.no))) {
      const k = key(p.po.id, p.line.lineId);
      delete sel[k];
      lupakanQty(k);
    }
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
      id: `${okLines} baris dari ${okPo} PO ditandai sudah sampai · ${num(okQty)}. Stok tidak diubah.`,
      en: `${okLines} lines across ${okPo} PO marked as arrived · ${num(okQty)}. Stock untouched.`,
      zh: `${okPo} 张采购单共 ${okLines} 行已标记为到货 · ${num(okQty)}。库存未改动。`,
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
