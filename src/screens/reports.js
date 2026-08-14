import { h } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, driveLink, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring, pager, pageSlice, PAGE_DEFAULT } from '../ui/components.js';
import { money, num, fmtDate, sumByCurrency, moneyMulti, BULAN_ID, BULAN_EN, BULAN_ZH, BULAN_PANJANG_ID, BULAN_PANJANG_EN } from '../core/format.js';
import { statusText } from '../core/statusText.js';
import { writeWorkbook } from '../core/xlsx.js';
import { outstandingPOs } from '../core/outstanding.js';
import { allowedReportModules } from '../auth/roles.js';
// NOTE: buildRows() filtering alone was not enough — outstandingCard() and the
// audit sheet in exportReport() each read state directly and bypassed it.

// Flatten the modules THIS ROLE may see into a unified report dataset.
// Filtering here (not just in the dropdown) is what actually keeps finance data
// out of a purchasing role's Excel export — the dropdown alone would still let
// "All" include it.
function buildRows(st) {
  const allowed = new Set(allowedReportModules(st.user.role));
  const rows = [];
  if (allowed.has('PO')) st.pos.forEach(p => rows.push({ date: p.createdAt, module: 'PO', doc: p.no, supplier: p.supplier, value: p.total, currency: p.currency, status: p.status, driveUrl: p.driveUrl || '' }));
  if (allowed.has('PPKEK')) st.ppkek.forEach(p => rows.push({ date: p.date, module: 'PPKEK', doc: p.nopen, supplier: p.supplier, value: p.idr, currency: 'IDR', status: p.status, driveUrl: p.driveUrl || '' }));
  if (allowed.has('PRF')) st.prfs.forEach(p => rows.push({ date: p.createdAt, module: 'PRF', doc: p.no, supplier: p.supplier, value: p.amount, currency: p.currency, status: p.stage, driveUrl: p.driveUrl || '' }));
  if (allowed.has('Label')) st.labelBatches.forEach(b => rows.push({ date: b.at, module: 'Label', doc: `${b.file} · ${b.count} rows`, supplier: 'Multi', value: 0, currency: 'IDR', status: 'draft', driveUrl: '' }));
  if (allowed.has('Payment')) st.payments.forEach(p => rows.push({ date: p.date, module: 'Payment', doc: p.prf, supplier: p.supplier, value: p.amount, currency: p.currency, status: 'Paid', driveUrl: p.driveUrl || '' }));
  return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Kotak penyaring Unified Report — satu per kolom yang benar-benar tampil.
//
// KENAPA DI BALIK SATU TOMBOL
// Enam dropdown ini dulu berdiri permanen di atas tabel: satu baris penuh
// tinggi layar, terpasang setiap hari, padahal yang benar-benar menyaring cuma
// sesekali. Sekarang ongkosnya satu klik, dan cuma dibayar yang memang sedang
// mencari. Yang ikut hilang bersama deretan itu: dua cara mencari hal yang sama
// di satu layar.
//
// KENAPA OPSINYA DARI DATA, BUKAN DAFTAR TETAP
// Dropdown bulan/tahun yang lama menawarkan periode yang belum tentu punya satu
// pun baris — memilih 'Feb 2025' di portal yang datanya mulai Juni menghasilkan
// tabel kosong yang terbaca persis seperti data hilang. Daftar yang isinya cuma
// nilai yang benar-benar ada tidak punya jalan buntu itu. Sumbernya juga sudah
// disaring peran lewat buildRows(), jadi opsinya tidak bisa membocorkan modul
// yang tidak boleh dilihat.
//
// Bulan + tahun sendiri diganti SATU rentang tanggal: pertanyaan yang dibawa
// orang ke sini jarang persis sebulan kalender ("sejak akhir Maret", "kuartal
// lalu"), dan dua dropdown yang harus cocok itu juga berarti tidak ada cara
// melihat lebih dari satu bulan sekaligus.
const MEDAN_REPORT = (semua) => {
  const unik = (ambil) => [...new Set((semua || []).map(ambil).filter(Boolean))].sort();
  return [
    { kunci: 'tgl', label: t('col_date'), tipe: 'tanggal', ambil: r => r.date },
    { kunci: 'module', label: t('rp_module'), tipe: 'pilih', opsi: unik(r => r.module), ambil: r => r.module },
    { kunci: 'doc', label: t('rp_col_doc'), tipe: 'teks', mono: true, ambil: r => r.doc },
    // Supplier jadi kotak teks, bukan dropdown. Daftarnya sepanjang master
    // supplier dan yang mencari biasanya sudah tahu namanya — mengetik tiga
    // huruf lebih pendek daripada menggulung daftar yang isinya ratusan.
    { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
    // Valuta menyaring kolom Value: yang tampil di sana adalah nilai BESERTA
    // valutanya, jadi kotak ini menyaring sesuatu yang memang terlihat.
    { kunci: 'ccy', label: t('rp_currency'), tipe: 'pilih', opsi: unik(r => r.currency), ambil: r => r.currency },
    // Opsi status memakai teks yang TERBACA di kolom Status, bukan nilai
    // simpanannya. Yang memilih di sini sedang menunjuk lencana yang dia lihat;
    // kalau isinya nilai mentah, satu daftar yang sama terlihat seperti dua.
    // Nilai simpanannya tidak ikut berubah — statusText() cuma satu arah.
    { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: unik(r => statusText(r.status)), ambil: r => statusText(r.status) },
  ];
};

// ===========================================================================
// HALAMAN
// ===========================================================================
//
// Reports menggambar SELURUH barisnya sekaligus — 398 baris pada hari ini, dan
// jumlahnya cuma bertambah. mount() tidak punya diffing, jadi setiap setState
// membangun ulang keempat ratus baris itu dari nol; layarnya berat dibuka dan
// berat setiap kali disentuh. Setiap tabel lain di portal ini sudah berhalaman
// sejak v15.x; layar ini terlewat.
//
// Yang DIEKSPOR tetap seluruh hasil saringan, bukan halaman yang kebetulan
// tampil. Tombol ekspor yang diam-diam mengambil sepuluh baris menghasilkan
// berkas yang isinya tidak bisa dijelaskan oleh orang yang mengirimnya — dan
// itu kebalikan dari yang sudah tertulis di kartu PO Outstanding di bawah.
function halaman(rows, st, kHal, kUkur) {
  const size = st.ui[kUkur] === 0 ? 0 : (Number(st.ui[kUkur]) || PAGE_DEFAULT);
  const info = pageSlice(rows, st.ui[kHal] || 1, size);
  info.size = size;
  return info;
}
const pagerRp = (info, kHal, kUkur) => pager(info, {
  onPage: n => setUI({ [kHal]: n }),
  onSize: n => setUI({ [kUkur]: n, [kHal]: 1 }),
});

// ===========================================================================
// RINGKASAN BULAN BERJALAN + DUA GRAFIK
// ===========================================================================
//
// Permintaan Kyaru, 14 Agu 2026: "gw mau ntr di bagian report itu ada, total
// estimated payment nya di bulan ini brp (dari total PRF yg kebuat di bulan
// itu) then belanja bulanan local sales brp, dari PO IDR yang ada nah itu jg
// gw mau ada grafik nya ya".
//
// TIGA KEPUTUSAN YANG DIA AMBIL SENDIRI, DICATAT DI SINI SUPAYA TIDAK ADA YANG
// MENEBAKNYA ULANG:
//   1. Mata uang DIPISAH, tidak pernah dijumlah jadi satu. PRF bulan ini berisi
//      USD dan IDR sekaligus; menjumlahkannya menghasilkan angka yang bahkan
//      bukan uang. Ini juga aturan yang sudah dipegang seluruh portal
//      (sumByCurrency / moneyMulti).
//   2. Belanja lokal = PO IDR ber-status Approved, dihitung pada tanggal
//      APPROVE — "duit yang benar-benar jadi komitmen bulan itu".
//   3. Grafik tahunannya TAHUN KALENDER, 1 Januari sampai 31 Desember. Bukan
//      rentang dua belas bulan terakhir. Kalimatnya: "itu itunya 1 jan sampe 31
//      des ya bukan dalam rentan 12 bulan".
const dalamBulan = (v, th, bl) => { const x = new Date(v); return !isNaN(x) && x.getFullYear() === th && x.getMonth() === bl; };
const dalamTahun = (v, th) => { const x = new Date(v); return !isNaN(x) && x.getFullYear() === th; };
const bulanDari = (v) => { const x = new Date(v); return isNaN(x) ? -1 : x.getMonth(); };

// TANGGAL YANG DIPAKAI UNTUK PO, DAN KENAPA ADA CADANGANNYA.
//
// Kyaru memilih tanggal approve. Tapi diperiksa dulu ke basis data hidup
// sebelum ditulis: dari 24 PO Approved, TUJUH tidak punya approved_at sama
// sekali — baris yang lahir sebelum kolom itu mulai diisi. Memakai tanggal
// approve apa adanya akan membuang ketujuhnya dari total bulanan tanpa satu pun
// tulisan di layar; salah satunya sendirian bernilai Rp 1,98 miliar.
//
// Sebuah total yang diam-diam kehilangan miliaran adalah kelas kesalahan yang
// sama dengan PRF/PC/VIII/083, dan yang menemukannya akan finance lagi. Jadi:
// jatuh ke tanggal dibuat, DAN katakan berapa baris yang memakainya.
const tglPo = (p) => p.approvedAt || p.createdAt;
const poTanpaTglApprove = (p) => !p.approvedAt;

// Sumbu grafik memakai satuan, dan satuannya DICETAK. Angka penuh tetap ada:
// setiap batang membawa nilai persisnya di atribut title, jadi tidak ada satu
// pun angka yang cuma bisa dibaca sebagai pembulatan.
function skala(maks, ccy) {
  const c = String(ccy || 'IDR').toUpperCase();
  if (maks >= 1e9) return { bagi: 1e9, desimal: 2, satuan: tr({ id: `${c} miliar`, en: `${c} billion`, zh: `${c} 十亿` }) };
  if (maks >= 1e6) return { bagi: 1e6, desimal: 1, satuan: tr({ id: `${c} juta`, en: `${c} million`, zh: `${c} 百万` }) };
  if (maks >= 1e3) return { bagi: 1e3, desimal: 1, satuan: tr({ id: `${c} ribu`, en: `${c} thousand`, zh: `${c} 千` }) };
  return { bagi: 1, desimal: 2, satuan: c };
}

// Batang mendatar, karena yang jadi label di sini NAMA PEMASOK — dan nama
// pemasok di portal ini panjang ("PT TANAH LUBRICUTING TECHNOLOGY INDONESIA").
// Batang tegak akan memotong atau memiringkannya, dan label yang dimiringkan
// adalah label yang tidak dibaca.
function batangMendatar(judul, ccy, baris) {
  const maks = Math.max(...baris.map(b => b.nilai), 0);
  const sk = skala(maks, ccy);
  return h('div', { style: { marginTop: '14px' } }, [
    h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, [
      h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--text-2)' } }, judul),
      h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, sk.satuan),
    ]),
    ...baris.map(b => h('div', { style: { display: 'grid', gridTemplateColumns: '190px 1fr 92px', gap: '8px', alignItems: 'center', marginBottom: '5px' } }, [
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: b.label }, b.label),
      h('div', { style: { background: 'var(--bar)', opacity: 0.25, borderRadius: '3px', height: '14px' } },
        h('div', {
          style: { width: (maks > 0 ? Math.max(2, (b.nilai / maks) * 100) : 0) + '%', height: '14px', background: 'var(--accent)', borderRadius: '3px' },
          title: money(b.nilai, ccy),
        })),
      h('div.mono', { style: { fontSize: '10.5px', textAlign: 'right', color: 'var(--text-2)' }, title: money(b.nilai, ccy) },
        (b.nilai / sk.bagi).toFixed(sk.desimal)),
    ])),
  ]);
}

// Dua belas slot, Januari sampai Desember, apa adanya. Bulan kosong tetap
// digambar sebagai slot kosong — sebuah tahun yang cuma menampilkan bulan yang
// ada isinya membuat Februari yang nol terlihat seperti Februari yang hilang.
function batangBulanan(judul, ccy, nilaiPerBulan, tahun) {
  const maks = Math.max(...nilaiPerBulan, 0);
  const sk = skala(maks, ccy);
  const kini = new Date();
  const bulanIni = kini.getFullYear() === tahun ? kini.getMonth() : -1;
  return h('div', { style: { marginTop: '18px' } }, [
    h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } }, [
      h('div', { style: { fontSize: '11.5px', fontWeight: 700, color: 'var(--text-2)' } }, judul),
      h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, sk.satuan),
    ]),
    h('div.row', { style: { alignItems: 'flex-end', gap: '10px', height: '132px', marginTop: '12px', padding: '0 2px' } },
      nilaiPerBulan.map((v, i) => {
        const tinggi = maks > 0 ? Math.max(3, Math.round((v / maks) * 100)) : 3;
        const ini = i === bulanIni;
        return h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' } }, [
          h('span.mono', { style: { fontSize: '9.5px', color: ini ? 'var(--accent-tx)' : 'var(--text-3)' }, title: money(v, ccy) },
            v ? (v / sk.bagi).toFixed(sk.desimal) : ''),
          h('div', {
            style: { width: '100%', maxWidth: '38px', height: tinggi + 'px', background: ini ? 'var(--accent)' : 'var(--bar)', opacity: ini ? 1 : 0.5, borderRadius: '4px 4px 2px 2px' },
            title: money(v, ccy),
          }),
          h('span', { style: { fontSize: '9.5px', fontWeight: 600, color: ini ? 'var(--accent-tx)' : 'var(--text-3)' } },
            tr({ id: BULAN_ID[i], en: BULAN_EN[i], zh: BULAN_ZH[i] })),
        ]);
      })),
  ]);
}

// Delapan teratas plus satu baris "lainnya" yang MENYEBUT berapa yang
// diringkasnya. Memotong di delapan tanpa mengatakannya membuat grafik yang
// terlihat seperti seluruh bulan padahal bukan.
function delapanTeratas(peta) {
  const semua = [...peta.entries()].map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai);
  if (semua.length <= 8) return semua;
  const sisa = semua.slice(8);
  const jml = sisa.reduce((s, x) => s + x.nilai, 0);
  return [...semua.slice(0, 8), {
    label: tr({ id: `+ ${sisa.length} pemasok lain`, en: `+ ${sisa.length} other suppliers`, zh: `+ 其他 ${sisa.length} 家供应商` }),
    nilai: jml,
  }];
}

function kotakAngka(judul, isi, catatan) {
  return h('div', { style: { flex: '1 1 240px', minWidth: '220px' } }, [
    h('div', { style: { fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)' } }, judul),
    h('div.mono', { style: { fontSize: '19px', fontWeight: 800, marginTop: '5px', lineHeight: 1.35, whiteSpace: 'normal' } }, isi),
    catatan ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '4px', whiteSpace: 'normal', lineHeight: 1.45 } }, catatan) : null,
  ]);
}

function ringkasanCard(st, bolehPrf, bolehPo) {
  const kini = new Date();
  const th = kini.getFullYear();
  const bl = kini.getMonth();
  const namaBulan = tr({ id: `${BULAN_PANJANG_ID[bl]} ${th}`, en: `${BULAN_PANJANG_EN[bl]} ${th}`, zh: `${th} 年 ${bl + 1} 月` });

  const prfBulan = bolehPrf ? (st.prfs || []).filter(p => dalamBulan(p.createdAt, th, bl)) : [];
  const prfTahun = bolehPrf ? (st.prfs || []).filter(p => dalamTahun(p.createdAt, th)) : [];
  const poIdr = bolehPo ? (st.pos || []).filter(p => p.currency === 'IDR' && p.status === 'Approved') : [];
  const poBulan = poIdr.filter(p => dalamBulan(tglPo(p), th, bl));
  const poTahun = poIdr.filter(p => dalamTahun(tglPo(p), th));
  const poCadangan = poBulan.filter(poTanpaTglApprove).length;

  const totalPo = poBulan.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const mataUangPrf = [...new Set(prfTahun.map(p => p.currency || 'IDR'))].sort();

  const angka = h('div.row.wrap', { style: { gap: '26px', alignItems: 'flex-start' } }, [
    bolehPrf ? kotakAngka(
      tr({ id: 'Estimasi pembayaran bulan ini', en: 'Estimated payment this month', zh: '本月预计付款' }),
      prfBulan.length ? moneyMulti(sumByCurrency(prfBulan)) : '—',
      tr({
        id: `dari ${prfBulan.length} PRF yang dibuat di ${namaBulan}. Mata uang tidak pernah dijumlah jadi satu.`,
        en: `from ${prfBulan.length} PRF${prfBulan.length === 1 ? '' : 's'} raised in ${namaBulan}. Currencies are never merged into one figure.`,
        zh: `来自 ${namaBulan} 开具的 ${prfBulan.length} 张付款申请单。不同币种从不合并为一个数字。`,
      })) : null,
    bolehPo ? kotakAngka(
      tr({ id: 'Belanja lokal bulan ini', en: 'Local purchases this month', zh: '本月本地采购' }),
      poBulan.length ? money(totalPo, 'IDR') : '—',
      tr({
        id: `dari ${poBulan.length} PO IDR yang disetujui, dihitung pada tanggal approve.${poCadangan ? ` ${poCadangan} di antaranya belum punya tanggal approve tersimpan, jadi dipakai tanggal dibuatnya — kalau dibuang, angka di atas akan kekurangan sebanyak itu tanpa ada yang menyebutkannya.` : ''}`,
        en: `from ${poBulan.length} approved IDR PO${poBulan.length === 1 ? '' : 's'}, counted on the approval date.${poCadangan ? ` ${poCadangan} of them have no stored approval date, so their creation date was used — dropping them would leave the figure above short by that much with nothing saying so.` : ''}`,
        zh: `来自 ${poBulan.length} 张已批准的 IDR 采购单，按批准日期计入。${poCadangan ? `其中 ${poCadangan} 张没有已保存的批准日期，改用创建日期 — 若将其剔除，上面的数字会凭空少掉那么多且无任何提示。` : ''}`,
      })) : null,
  ]);

  // GRAFIK UTAMA — bulan berjalan, pecah per pemasok.
  const petaPrfBulan = new Map();
  for (const p of prfBulan) {
    const k = `${p.supplier} · ${p.currency || 'IDR'}`;
    petaPrfBulan.set(k, (petaPrfBulan.get(k) || 0) + (Number(p.amount) || 0));
  }
  const petaPoBulan = new Map();
  for (const p of poBulan) petaPoBulan.set(p.supplier, (petaPoBulan.get(p.supplier) || 0) + (Number(p.total) || 0));

  // Batang mendatar PRF memakai satu sumbu untuk beberapa mata uang, jadi
  // panjangnya TIDAK bisa dibandingkan lintas mata uang — labelnya menyebut
  // mata uang tiap baris, dan angkanya di kanan yang dibaca. Yang dibandingkan
  // di sini urutan besar-kecil dalam satu mata uang, bukan USD lawan IDR.
  const grafikBulan = h('div', { style: { marginTop: '18px' } }, [
    h('div', { style: { fontSize: '12px', fontWeight: 800 } },
      tr({ id: `Bulan berjalan — ${namaBulan}`, en: `Current month — ${namaBulan}`, zh: `本月 — ${namaBulan}` })),
    ...(bolehPrf && petaPrfBulan.size
      ? mataUangPrf.filter(c => prfBulan.some(p => (p.currency || 'IDR') === c)).map(c => {
          const peta = new Map();
          for (const p of prfBulan.filter(x => (x.currency || 'IDR') === c)) {
            peta.set(p.supplier, (peta.get(p.supplier) || 0) + (Number(p.amount) || 0));
          }
          return batangMendatar(tr({
            id: `PRF ${c} per pemasok`, en: `PRF ${c} per supplier`, zh: `按供应商 · 付款申请单 ${c}`,
          }), c, delapanTeratas(peta));
        })
      : []),
    (bolehPo && petaPoBulan.size)
      ? batangMendatar(tr({ id: 'PO IDR disetujui per pemasok', en: 'Approved IDR POs per supplier', zh: '按供应商 · 已批准 IDR 采购单' }), 'IDR', delapanTeratas(petaPoBulan))
      : null,
    (!petaPrfBulan.size && !petaPoBulan.size)
      ? h('div', { style: { padding: '26px 0', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-3)' } },
          tr({ id: 'Belum ada PRF maupun PO disetujui di bulan ini.', en: 'No PRFs or approved POs yet this month.', zh: '本月尚无付款申请单或已批准采购单。' }))
      : null,
  ]);

  // GRAFIK TAHUNAN — 1 Januari sampai 31 Desember, bukan dua belas bulan
  // terakhir. Permintaan Kyaru, dan bedanya nyata: rentang 12 bulan menaruh
  // Desember tahun lalu bersebelahan dengan November tahun ini, dan dua angka
  // dari dua tahun anggaran yang berbeda tidak boleh berdiri di satu deret
  // tanpa ada yang menyebutkannya.
  const perBulan = (baris, ambilTgl, ambilNilai) => {
    const out = new Array(12).fill(0);
    for (const x of baris) { const b = bulanDari(ambilTgl(x)); if (b >= 0) out[b] += Number(ambilNilai(x)) || 0; }
    return out;
  };

  const grafikTahun = h('div', { style: { marginTop: '26px', borderTop: '1px solid var(--border)', paddingTop: '16px' } }, [
    h('div', { style: { fontSize: '12px', fontWeight: 800 } },
      tr({ id: `Perbandingan bulan ke bulan — ${th}`, en: `Month-to-month — ${th}`, zh: `逐月对比 — ${th}` })),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px' } },
      tr({ id: '1 Januari – 31 Desember, tahun kalender penuh.', en: '1 January – 31 December, full calendar year.', zh: '1 月 1 日至 12 月 31 日，完整日历年度。' })),
    ...(bolehPrf
      ? mataUangPrf.map(c => batangBulanan(
          tr({ id: `Estimasi pembayaran (PRF) — ${c}`, en: `Estimated payment (PRF) — ${c}`, zh: `预计付款（付款申请单）— ${c}` }),
          c,
          perBulan(prfTahun.filter(p => (p.currency || 'IDR') === c), p => p.createdAt, p => p.amount),
          th))
      : []),
    bolehPo
      ? batangBulanan(
          tr({ id: 'Belanja lokal (PO IDR disetujui)', en: 'Local purchases (approved IDR POs)', zh: '本地采购（已批准 IDR 采购单）' }),
          'IDR',
          perBulan(poTahun, tglPo, p => p.total),
          th)
      : null,
    (!prfTahun.length && !poTahun.length)
      ? h('div', { style: { padding: '26px 0', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-3)' } },
          tr({ id: `Belum ada data di tahun ${th}.`, en: `No data for ${th} yet.`, zh: `${th} 年暂无数据。` }))
      : null,
  ]);

  return h('div.card', h('div.card-pad', [
    h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' } }, [
      h('div.card-title', tr({ id: 'Ringkasan Bulanan', en: 'Monthly Summary', zh: '月度汇总' })),
      badge(namaBulan, 'accent'),
    ]),
    angka,
    grafikBulan,
    grafikTahun,
  ]));
}

export function reportsScreen() {
  const st = getState();

  const semua = buildRows(st);
  const medan = MEDAN_REPORT(semua);
  const nilai = nilaiFilter('rp');
  // Tanpa saringan, yang tampil SELURUHNYA. Dulu bulan+tahun dipaksa terisi
  // bulan berjalan, jadi layar ini selalu dibuka dalam keadaan tersaring tanpa
  // ada yang memintanya — dan awal bulan, ketika belum ada dokumen apa pun,
  // Reports terlihat seperti portal yang kehilangan seluruh isinya.
  const rows = saring(semua, medan, nilai);
  // Halaman dihitung dari hasil SARINGAN, dan yang diekspor tetap `rows` —
  // seluruh hasil saringan, bukan sepuluh yang kebetulan tampil.
  const hal = halaman(rows, st, 'rpPage', 'rpSize');

  const tableCard = h('div.card', [
    h('div.card-head', [
      hitunganSaring(rows.length, semua.length, { id: 'baris', en: `row${semua.length === 1 ? '' : 's'}`, zh: '行' }),
      tombolFilter({ id: 'rp', medan, kunciHalaman: 'rpPage', judul: tr({ id: 'Saring Unified Report', en: 'Filter Unified Report', zh: '筛选统一报表' }) }),
      badge(t('rp_drive_note'), 'navy'),
      h('div.mla', btn(t('pk_export'), { variant: 'primary', iconName: 'download', onClick: () => exportReport(rows, nilai) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_date'), t('rp_module'), t('rp_col_doc'), t('col_supplier'), t('rp_col_value'), t('col_status'), t('rp_col_link')].map((c, i) => h('th' + (i === 4 ? '.r' : ''), c)))),
      h('tbody', hal.items.length ? hal.items.map(r => h('tr', [
        h('td.mono', fmtDate(r.date)),
        h('td', badge(r.module, moduleTone(r.module))),
        h('td.mono.cell-strong', r.doc),
        h('td', r.supplier),
        h('td.mono.r', r.value ? money(r.value, r.currency) : '—'),
        // Translated for the eye only — statusToneRp still reads the STORED
        // value. Kotak status di jendela corong sengaja membandingkan hasil
        // statusText() di kedua sisi, jadi yang dipilih orang sama persis
        // dengan lencana yang dia tunjuk; tidak ada satu pun dari keduanya yang
        // menghasilkan nilai untuk disimpan.
        h('td', badge(statusText(r.status), statusToneRp(r.status))),
        h('td', driveLink(r.driveUrl)),
      ])) : barisTakCocok(7, { id: 'rp', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
    rows.length ? pagerRp(hal, 'rpPage', 'rpSize') : null,
  ]);

  // outstandingCard reads st.pos DIRECTLY and has its OWN Excel export, so the
  // buildRows() role filter never touched it — sekar (PPKEK/PRF only) still saw
  // every outstanding PO with supplier names and values, and could export them.
  // Ringkasan mematuhi penyaring peran yang sama dengan tabelnya. sekar tidak
  // memegang modul PO, jadi kotak belanja lokal dan grafiknya tidak muncul
  // untuknya — bukan muncul kosong, yang justru memberi tahu bahwa angkanya ada
  // dan sedang disembunyikan.
  const bolehModul = allowedReportModules(st.user.role);
  const canSeePO = bolehModul.includes('PO');
  const bolehPrf = bolehModul.includes('PRF');
  return h('div.stack', [
    (canSeePO || bolehPrf) ? ringkasanCard(st, bolehPrf, canSeePO) : null,
    tableCard,
    canSeePO ? outstandingCard(st) : null,
  ]);
}

// Daftar ini cuma punya dua kolom yang bisa dicari orang; dua sisanya angka
// hitungan, dan tidak ada yang datang ke sini mencari "PO dengan tepat 3 baris".
//
// Kotak No. PO menyapu nomor kontrak DAN nomor PO sekaligus walaupun kolomnya
// cuma menampilkan salah satu (kontrak kalau ada). Yang mengetik biasanya
// menyalin dari e-mail atau dari layar lain, dan tidak tahu — tidak perlu tahu
// — nomor mana yang kebetulan menang di kolom itu.
const MEDAN_RP_PO = () => [
  { kunci: 'po', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => `${r.po.contract || ''} ${r.po.no || ''}` },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.po.supplier },
];

// Outstanding POs (goods not yet fully shipped via Surat Jalan). This is a
// current-state snapshot, not a dated event, so it's NOT subject to the date
// range above — it always shows the live picture. Saringannya pun terpisah
// (id 'rp-po'), karena menyempitkan laporan ke satu supplier tidak berarti
// orangnya juga sedang menyempitkan daftar barang yang ditunggu.
function outstandingCard(st) {
  const semua = outstandingPOs(st);
  const medan = MEDAN_RP_PO();
  const nilai = nilaiFilter('rp-po');
  const rows = saring(semua, medan, nilai);
  const hal = halaman(rows, st, 'rpPoPage', 'rpPoSize');
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', tr({
        id: 'PO Outstanding (barang belum terkirim penuh)',
        en: 'Outstanding POs (goods not yet fully shipped)',
        zh: '未结采购单（货物尚未全部发出）',
      })),
      // Menggantikan lencana angka yang lama. Lencana itu cuma tahu satu angka,
      // dan begitu ada saringan, satu angka tidak cukup: daftar yang tinggal 3
      // dari 41 terlihat persis seperti daftar yang memang cuma punya 3.
      hitunganSaring(rows.length, semua.length, { id: 'PO', en: 'PO', zh: '张采购单' }),
      tombolFilter({
        id: 'rp-po', medan, kunciHalaman: 'rpPoPage',
        judul: tr({ id: 'Saring PO Outstanding', en: 'Filter Outstanding POs', zh: '筛选未结采购单' }),
      }),
      // Yang diekspor adalah yang TERLIHAT. Tombol ekspor yang diam-diam
      // mengambil lebih banyak daripada yang ada di layar menghasilkan berkas
      // yang isinya tidak bisa dijelaskan oleh orang yang mengirimnya.
      h('div.mla', btn(t('pk_export'), { iconName: 'download', onClick: () => exportOutstanding(rows) })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
        t('col_supplier'),
        tr({ id: 'Baris Outstanding', en: 'Outstanding Lines', zh: '未结行数' }),
        tr({ id: 'Total Qty Outstanding', en: 'Total Outstanding Qty', zh: '未结总数量' }),
      ].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      // Kosong karena saringan dan kosong karena semuanya memang sudah terkirim
      // adalah dua kabar yang berbeda — yang kedua itu kabar BAIK, dan
      // menggantinya dengan "belum ada data" membuang satu-satunya kalimat di
      // kartu ini yang bilang pekerjaannya beres.
      h('tbody', hal.items.length ? hal.items.map(r => h('tr', [
        h('td.mono.cell-strong', r.po.contract || r.po.no), h('td', r.po.supplier),
        h('td.mono', String(r.lines.filter(l => l.outstanding > 0).length)),
        h('td.mono.r', num(r.totalOutstanding)),
      ])) : jumlahFilterAktif(nilai) > 0
        ? barisTakCocok(4, { id: 'rp-po', adaFilter: true })
        : h('tr', h('td', { colspan: 4, style: { textAlign: 'center', padding: '24px', color: 'var(--text-3)' } }, tr({
            id: 'Semua PO sudah terkirim penuh',
            en: 'Every PO has been fully shipped',
            zh: '所有采购单均已全部发出',
          })))),
    ])),
    rows.length ? pagerRp(hal, 'rpPoPage', 'rpPoSize') : null,
  ]);
}

async function exportOutstanding(rows) {
  const header = ['No. PO', 'Supplier', 'Baris Outstanding', 'Total Qty Outstanding'];
  const aoa = [header, ...rows.map(r => [r.po.contract || r.po.no, r.po.supplier, r.lines.filter(l => l.outstanding > 0).length, r.totalOutstanding])];
  await writeWorkbook('MTI_PO_Outstanding.xlsx', [{ name: 'Outstanding', aoa }], []);
  toast({
    id: 'Export PO Outstanding — Excel',
    en: 'Outstanding PO export — Excel',
    zh: '未结采购单导出 — Excel',
  });
}

function moduleTone(m) { return { PO: 'accent', PPKEK: 'blue', PRF: 'navy', Label: 'green', Payment: 'green' }[m] || 'gray'; }
function statusToneRp(s) { return /Paid|Approved|Closed/.test(s) ? 'green' : /Menunggu|Open|Awaiting/.test(s) ? 'amber' : 'blue'; }

async function exportReport(rows, nilai) {
  const header = ['Tanggal', 'Module', 'Dokumen', 'Supplier', 'Currency', 'Nilai', 'Status', 'Drive Link'];
  const aoa = [header, ...rows.map(r => [fmtDate(r.date), r.module, r.doc, r.supplier, r.currency, r.value || '', r.status, r.driveUrl && !r.driveUrl.startsWith('drive-') ? 'Drive' : ''])];
  const hyperlinks = [];
  rows.forEach((r, i) => { if (r.driveUrl && !r.driveUrl.startsWith('drive-')) hyperlinks.push({ sheet: 'Report', cell: `H${i + 2}`, url: r.driveUrl, text: 'Drive' }); });
  // Audit trail tab.
  const st = getState();
  // The audit sheet bypassed the role filter too: it wrote the WHOLE trail,
  // including PRF and payment activity, into a purchasing role's workbook.
  // (RLS already scopes what audit rows a user can fetch, so this is defence in
  // depth rather than the only control — but the export shouldn't widen it.)
  const auditEntities = new Set(allowedReportModules(st.user.role).map(m => ({ PO: 'po', PRF: 'prf', Payment: 'payment', PPKEK: 'ppkek', Label: 'label' }[m])));
  // `|| a.entity === 'supplier'` used to be unconditional, so even a role with
  // NO audit modules received every supplier row — and supplier audit detail
  // spells out proposed bank accounts verbatim (masterData.js logs
  // `usulan {bank} {acct}`).
  //
  // The first attempt tied this to auditEntities.has('po') and that was wrong.
  // It silently stripped the supplier trail from sekar and financemti, and
  // finance is precisely who needs it: they execute the transfer, so "this
  // supplier's bank account was just changed" is their single most useful
  // anti-fraud signal. Narrowing it there traded a theoretical leak for a real
  // loss of oversight.
  //
  // Condition is now simply "this role has some audit scope at all", which
  // restores every role that actually holds the Reports screen while still
  // refusing a zero-module role.
  const seesSuppliers = auditEntities.size > 0;
  const auditRows = st.audit.filter(a => auditEntities.has(a.entity) || (seesSuppliers && a.entity === 'supplier'));
  const auditAoa = [['Waktu', 'User', 'Entity', 'Target', 'Aksi', 'Detail'], ...auditRows.map(a => [fmtDate(a.at), a.user, a.entity, a.target || '', a.action, a.detail || ''])];
  // Nama berkasnya menyebutkan saringan yang menyala. Dulu selalu berisi
  // module_bulan_tahun karena ketiganya WAJIB terisi; sekarang kotaknya boleh
  // dikosongkan, jadi yang kosong tidak ikut disebut — dan dua ekspor berbeda
  // di hari yang sama tetap tidak saling menimpa di folder Download.
  const rentang = nilai && nilai.tgl ? [nilai.tgl.dari, nilai.tgl.sampai].filter(Boolean).join('-') : '';
  const nama = ['MTI_Report', (nilai || {}).module, (nilai || {}).ccy, (nilai || {}).status, rentang]
    .filter(Boolean).join('_').replace(/[\s/\\:*?"<>|]+/g, '');
  await writeWorkbook(`${nama}.xlsx`, [
    { name: 'Report', aoa }, { name: 'Audit Trail', aoa: auditAoa },
  ], hyperlinks);
  toast({
    id: 'Export Excel — hyperlink Drive aktif + tab Audit Trail',
    en: 'Excel export — live Drive hyperlinks + Audit Trail tab',
    zh: 'Excel 导出 — Drive 超链接有效 + 审计日志页',
  });
}
