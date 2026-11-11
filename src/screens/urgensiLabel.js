// =============================================================================
// URGENSI LABEL — TAB SENDIRI, BUKAN BAGIAN DARI STOK LABEL.
// -----------------------------------------------------------------------------
// Permintaan pemiliknya tegas: "gw gamau di gabung sama yg punya sona ya, gw
// mau mini tab sendiri". Dan itu bukan soal rasa. Layar Stok Label adalah
// rutinitas mingguan Sona: dia yang mengunggah tracker-nya, dia yang
// mencocokkan kode ERP-nya, dan daftar belinya adalah usulan portal atas
// angka-angka dia. Layar INI justru lahir karena angka itu tidak dipercaya:
// "data yg sona kasih itu ga akurat, jadi gw purchasing bakal beli sesuai
// data ini bukan data sona".
//
// Dua layar yang satu memeriksa yang lain tidak boleh berbagi kotak unggah,
// state, atau tombol. Kalau digabung, satu unggahan Sona akan mengubah angka di
// layar yang dibuat untuk mengoreksinya — dan tidak akan ada apa pun yang
// menunjukkan itu terjadi.
//
// TIGA SUMBER, TIGA KOTAK:
//   1. Permintaan Sona       lembar order / 排产 — diurai parseLabelSheet()
//   2. Stok WH Indonesia     物料名称 / 库存数量 / 实际数量
//   3. Jadwal kirim WH China 去单位物料名称 / 订单数量 / 发货时间(发货数量)
//
// Daftar gabungannya TIDAK disimpan: dia hasil hitungan, dan menyimpannya
// berarti dua sumber kebenaran yang suatu hari berbeda — dengan yang salah
// justru yang dipakai membeli, karena dia yang tersimpan. Yang disimpan cuma
// yang tidak bisa dihitung ulang: koreksi manusia, dan snapshot ETA.
// =============================================================================

import { h } from '../core/dom.js';
import { getState, setUI, toast, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { badge, btn, icon, modal, dropzone, tombolFilter, nilaiFilter, saring, jumlahFilterAktif,
         barisTakCocok, hitunganSaring, pager, pageSlice, PAGE_DEFAULT } from '../ui/components.js';
import { readWorkbook, writeWorkbook } from '../core/xlsx.js';
import { parseLabelSheet } from '../parsers/excelLabels.js';
import { parseWhIndo, parseWhChina, kenaliSumber } from '../parsers/gudangLabel.js';
import { gabungkan, pergerakanEta, snapshotDari, STATUS } from '../core/urgensi.js';
import { fetchKoreksi, simpanKoreksi, fetchSnapshotTerakhir, simpanSnapshot } from '../core/urgensiApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { num, fmtDate } from '../core/format.js';

const KOTAK = [
  { n: 1, kind: 'sona', state: 'urSona',
    title: { id: 'Permintaan Sona', en: "Sona's request", zh: '索娜申请' },
    file: { id: 'lembar order / 排产计划', en: 'order sheet / 排产计划', zh: '下单表 / 排产计划' } },
  { n: 2, kind: 'indo', state: 'urIndo',
    title: { id: 'Stok WH Indonesia', en: 'Indonesian WH stock', zh: '印尼仓库存' },
    file: { id: 'sheet KCBB0101 (物料名称 / 库存数量 / 实际数量)', en: 'sheet KCBB0101', zh: 'KCBB0101 工作表' } },
  { n: 3, kind: 'china', state: 'urChina',
    title: { id: 'Jadwal kirim WH China', en: 'Chinese WH shipping schedule', zh: '中国仓发货计划' },
    file: { id: '预计发货不足 — 发货时间(发货数量)', en: '预计发货不足', zh: '预计发货不足' } },
];
const KOTAK_OF = (k) => KOTAK.find(x => x.kind === k);

export function urgensiLabelScreen() {
  const st = getState(); const ui = st.ui;
  const bisaTulis = can(st.user.role, 'urgensiWrite');

  // Koreksi dan snapshot diambil SEKALI, bukan tiap render. mount() membangun
  // ulang seluruh pohon tiap klik, jadi fetch di dalam render berarti satu
  // permintaan jaringan per klik di mana pun di layar ini.
  if (ui.urKoreksi == null && !ui.urAmbil) {
    setUI({ urAmbil: true });
    Promise.all([fetchKoreksi().catch(() => ({})), fetchSnapshotTerakhir(2).catch(() => [])])
      .then(([kor, snap]) => setUI({ urKoreksi: kor, urSnapshot: snap, urAmbil: false }))
      .catch(() => setUI({ urKoreksi: {}, urSnapshot: [], urAmbil: false }));
  }

  const kepala = h('div', { style: { marginBottom: '14px' } }, [
    h('div', { style: { fontSize: '18px', fontWeight: 800 } }, t('s_urgensi')),
    h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '3px', maxWidth: '780px', lineHeight: 1.55 } }, tr({
      id: 'Daftar yang dipakai membeli. Tiga sumber digabung dengan kunci (ukuran, kode pola, ply) — bukan nama barang, karena nama ditulis tiga gaya berbeda di tiga berkas. Angka berkas dan angka yang dikoreksi ditampilkan dua-duanya, dan selisihnya ditandai. Terpisah dari layar Stok Label dengan sengaja.',
      en: "The list purchasing actually buys from. Three sources merged on (size, pattern code, ply) — not the item name, because the name is written three different ways across the three files. File numbers and corrected numbers are both shown, and the gap is marked. Deliberately separate from the Label Stock screen.",
      zh: '采购实际依据的清单。三个来源按（尺寸、花纹代码、层级）合并 — 而非物料名称，因为三份文件中名称有三种写法。文件数字与修正后数字同时显示，差额予以标注。有意与标签库存界面分开。',
    })),
  ]);

  const kotak = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '12px' } },
    KOTAK.map(b => kotakTile(st, b)));

  const hasil = ui.urSona ? hitung(st) : null;

  return h('div.stack', { style: { gap: '14px' } }, [
    kepala,
    h('div.card', [
      h('div.card-head', [
        h('div.card-title', tr({ id: 'Sumber', en: 'Sources', zh: '来源' })),
        h('div.mla.row.gap8', [
          btn(tr({ id: 'Kosongkan semua', en: 'Clear all', zh: '全部清空' }), {
            sm: true, onClick: () => setUI({ urSona: null, urIndo: null, urChina: null, urPage: 1 }),
          }),
        ]),
      ]),
      h('div', { style: { padding: '0 16px 16px' } }, kotak),
    ]),
    ...(hasil ? panelHasil(st, hasil, bisaTulis) : [
      h('div.cfg-banner', { style: { display: 'block' } }, [icon('warn', 14), tr({
        id: ' Taruh dulu lembar permintaan Sona di kotak 1 — itu yang menentukan barisnya. Kotak 2 dan 3 melengkapi angkanya; tanpa keduanya barisnya tetap muncul, ditandai "tidak ada data gudang" dan bukan dibuang.',
        en: ' Drop Sona\'s request sheet into box 1 first — it decides the rows. Boxes 2 and 3 fill in the numbers; without them the rows still appear, marked "no warehouse data" rather than dropped.',
        zh: ' 请先将索娜的申请表放入第 1 框 — 它决定行。第 2、3 框补充数字；缺少它们时该行仍会出现，并标记为「无仓库数据」而非被丢弃。',
      })]),
    ]),
  ]);
}

function kotakTile(st, box) {
  const isi = st.ui[box.state];
  const chip = h('span', {
    style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px',
             borderRadius: '999px', flex: '0 0 20px', fontSize: '11px', fontWeight: 800,
             background: isi ? 'var(--st-green-tx)' : 'var(--text-3)', color: '#fff' },
  }, String(box.n));
  const head = h('div.row.gap8', { style: { alignItems: 'center', marginBottom: '6px' } }, [
    chip, h('div', { style: { fontSize: '13px', fontWeight: 700 } }, tr(box.title)),
    box.kind === 'sona' ? null : h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } },
      tr({ id: '(boleh dikosongkan)', en: '(may be left empty)', zh: '（可留空）' })),
  ]);
  const body = isi
    ? h('div', { style: { border: '1px solid var(--st-green-tx)', background: 'var(--st-green-bg)', color: 'var(--st-green-tx)',
                          borderRadius: '10px', padding: '14px', minHeight: '140px', display: 'flex',
                          flexDirection: 'column', justifyContent: 'center', gap: '4px' } }, [
        h('div.row.gap8', { style: { alignItems: 'center' } }, [icon('check', 14),
          h('span', { style: { fontSize: '12px', fontWeight: 700 } }, tr({ id: 'Sudah masuk', en: 'Loaded', zh: '已载入' }))]),
        h('div.mono', { style: { fontSize: '10.5px', wordBreak: 'break-all' } }, isi.berkas),
        h('div', { style: { fontSize: '10.5px', opacity: .85 } }, isi.note || ''),
        (isi.perluCek && isi.perluCek.length)
          ? h('div', { style: { fontSize: '10.5px', fontWeight: 700, color: 'var(--st-amber-tx)' } }, tr({
              id: `${isi.perluCek.length} baris perlu dicek`,
              en: `${isi.perluCek.length} rows need checking`,
              zh: `${isi.perluCek.length} 行需核对`,
            }))
          : null,
        h('div', { style: { marginTop: '6px' } }, [
          btn(tr({ id: 'Ganti', en: 'Replace', zh: '更换' }), { sm: true, iconName: 'x', onClick: () => setUI({ [box.state]: null }) }),
        ]),
      ])
    : dropzone({ title: tr(box.file), accept: '.xlsx,.xls', iconName: 'upload', compact: true, onFiles: f => terimaBerkas(box, f[0]) });
  return h('div', [head, body]);
}

// BERKAS YANG SALAH KOTAK DITOLAK SAMBIL MENYEBUT KOTAK YANG BENAR.
//
// Pola yang sama dengan layar Stok Label, dan alasannya sama: berkas yang
// salah kotak TIDAK gagal, dia terbaca separuh benar. Lembar China yang masuk
// kotak 2 menghasilkan stok nol untuk 333 barang, dan stok nol terbaca persis
// seperti "harus beli semuanya".
//
// Sheet-nya dipilih dengan MENCOBA, bukan menebak dari namanya: lembar yang
// sama pernah bernama 'Sheet1', '11月排产' dan 'KCBB0101'. Yang tetap adalah
// bentuk headernya.
async function terimaBerkas(box, file) {
  if (!file) return;
  if (blockWrite('unggah sumber urgensi')) return;
  toast({ id: 'Membaca berkas…', en: 'Reading the file…', zh: '正在读取文件…' });
  try {
    const wb = await readWorkbook(file);
    const st = getState();
    let hasil = null, sheetDipakai = '';

    for (const nama of wb.sheetNames) {
      const rows = wb.rows(nama);
      if (!rows.length) continue;

      if (box.kind === 'sona') {
        const r = parseLabelSheet(rows, {
          brandMap: st.brandMap,
          knownErps: new Set((st.items || []).map(i => i.erp).filter(Boolean)),
          master: st.items || [],
        });
        if (r.ok && r.items.length) {
          hasil = { jenis: 'sona', items: r.items, perluCek: r.perluCek || [], stats: r.stats, warnings: r.warnings || [] };
          sheetDipakai = nama; break;
        }
        continue;
      }

      const jenis = kenaliSumber(rows);
      if (!jenis) continue;
      if (jenis !== box.kind) {
        const benar = KOTAK_OF(jenis);
        toast({
          id: `Salah kotak. Ini berkas ${tr(benar.title)} — taruh di kotak ${benar.n}.`,
          en: `Wrong box. This is the ${tr(benar.title)} file — drop it into box ${benar.n}.`,
          zh: `方框有误。这是${tr(benar.title)}文件 — 请放入第 ${benar.n} 框。`,
        });
        return;
      }
      const r = jenis === 'indo' ? parseWhIndo(rows) : parseWhChina(rows);
      if (r.ok) { hasil = { jenis, baris: r.baris, perluCek: r.perluCek || [] }; sheetDipakai = nama; break; }
    }

    if (!hasil) {
      toast({
        id: `Tidak ada sheet di berkas ini yang bentuknya cocok untuk kotak ${box.n} (${tr(box.title)}). Sheet yang dicoba: ${wb.sheetNames.slice(0, 6).join(', ')}.`,
        en: `No sheet in this file has the shape box ${box.n} (${tr(box.title)}) needs. Sheets tried: ${wb.sheetNames.slice(0, 6).join(', ')}.`,
        zh: `此文件中没有工作表符合第 ${box.n} 框（${tr(box.title)}）所需的结构。已尝试：${wb.sheetNames.slice(0, 6).join('、')}。`,
      });
      return;
    }

    const jml = hasil.items ? hasil.items.length : hasil.baris.length;
    setUI({
      [box.state]: {
        ...hasil, berkas: file.name, sheet: sheetDipakai, at: new Date().toISOString(),
        note: tr({ id: `sheet "${sheetDipakai}" · ${jml} baris`, en: `sheet "${sheetDipakai}" · ${jml} rows`, zh: `工作表「${sheetDipakai}」· ${jml} 行` }),
      },
      urPage: 1,
    });
    toast({ id: `${jml} baris terbaca dari "${sheetDipakai}".`, en: `${jml} rows read from "${sheetDipakai}".`, zh: `已从「${sheetDipakai}」读取 ${jml} 行。` });
  } catch (e) {
    console.error(e);
    toast({ id: 'Gagal baca berkas: ' + (e.message || e), en: 'Failed to read the file: ' + (e.message || e), zh: '读取文件失败：' + (e.message || e) });
  }
}

function hitung(st) {
  const ui = st.ui;
  const g = gabungkan({
    sona: (ui.urSona && ui.urSona.items) || [],
    indo: (ui.urIndo && ui.urIndo.baris) || [],
    china: (ui.urChina && ui.urChina.baris) || [],
    koreksi: ui.urKoreksi || {},
    pos: st.pos || [],
  });
  // Snapshot TERBARU dibanding keadaan SEKARANG, bukan dua snapshot lama: yang
  // ingin diketahui adalah "apa yang berubah sejak terakhir ini dilihat", dan
  // berkas yang baru diunggah ADALAH keadaan sekarang.
  const snap = ui.urSnapshot || [];
  const gerak = snap.length ? pergerakanEta(snap[0].eta, snapshotDari(g.baris)) : [];
  return { ...g, gerak, snapTerakhir: snap[0] || null };
}

const MEDAN = (rows) => [
  { kunci: 'erp', label: t('col_erp'), tipe: 'teks', mono: true, ambil: r => r.erp },
  { kunci: 'spec', label: t('col_spec'), tipe: 'teks', ambil: r => r.spec },
  { kunci: 'market', label: t('col_market'), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.market).filter(Boolean))].sort(), ambil: r => r.market },
  { kunci: 'status', label: tr({ id: 'Status', en: 'Status', zh: '状态' }), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.status))].sort(), ambil: r => r.status },
  { kunci: 'tgl', label: 'ETA', tipe: 'teks', mono: true, ambil: r => r.tgl || '' },
];

function panelHasil(st, hasil, bisaTulis) {
  const ui = st.ui;
  const medan = MEDAN(hasil.baris);
  const nilai = nilaiFilter('ur');
  const rows = saring(hasil.baris, medan, nilai);
  const hal = pageSlice(rows, ui.urPage || 1, PAGE_DEFAULT);
  const R = hasil.ringkasan;

  const tile = (judul, angka, sub, warna) => h('div.card', { style: { padding: '12px 14px', minWidth: '150px', flex: '1 1 150px' } }, [
    h('div', { style: { fontSize: '9.5px', letterSpacing: '.04em', color: 'var(--text-3)', fontWeight: 700 } }, judul),
    h('div.mono', { style: { fontSize: '19px', fontWeight: 800, color: warna ? `var(--st-${warna}-tx)` : '' } }, num(angka)),
    h('div', { style: { fontSize: '10px', color: 'var(--text-3)' } }, sub),
  ]);

  const kartuAngka = h('div.row.gap8.wrap', [
    tile(tr({ id: 'HARUS BELI', en: 'MUST BUY', zh: '需采购' }), R.kurang,
      tr({ id: 'kurang, sesudah PO dikurangi', en: 'short, after POs subtracted', zh: '扣除采购单后仍短缺' }), R.kurang ? 'red' : null),
    tile(tr({ id: 'SUDAH DI-PO', en: 'ALREADY ON PO', zh: '已开采购单' }), R.sudahDipesan,
      tr({ id: 'bulan ini — keluar dari daftar beli', en: 'this month — out of the buy list', zh: '本月 — 不在采购清单内' }), R.sudahDipesan ? 'green' : null),
    tile(tr({ id: 'TANPA DATA GUDANG', en: 'NO WAREHOUSE DATA', zh: '无仓库数据' }), R.tanpaGudang,
      tr({ id: 'tidak bisa diputuskan', en: 'cannot be decided', zh: '无法判断' }), R.tanpaGudang ? 'amber' : null),
    tile(tr({ id: 'SISTEM ≠ FISIK', en: 'SYSTEM ≠ PHYSICAL', zh: '系统 ≠ 实物' }), R.selisihStok,
      tr({ id: 'stok sistem beda dari hitungan gudang', en: 'system stock differs from the count', zh: '系统库存与盘点不同' }), R.selisihStok ? 'amber' : null),
    tile(tr({ id: 'DIKOREKSI ORANG', en: 'HUMAN-CORRECTED', zh: '人工修正' }), R.dikoreksi,
      tr({ id: 'angka berkas diganti', en: 'file numbers overridden', zh: '已覆盖文件数字' }), null),
  ]);

  const spanduk = [];

  // Baris yang tidak terbaca di KETIGA sumber, disebut di satu tempat.
  const cekSemua = [
    ...((ui.urSona && ui.urSona.perluCek) || []).map(e => ({ ...e, sumber: 1 })),
    ...((ui.urIndo && ui.urIndo.perluCek) || []).map(e => ({ ...e, sumber: 2 })),
    ...((ui.urChina && ui.urChina.perluCek) || []).map(e => ({ ...e, sumber: 3 })),
  ];
  if (cekSemua.length) {
    spanduk.push(h('div.cfg-banner', {
      style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' },
    }, [
      h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
        id: ` ${cekSemua.length} baris di ketiga berkas TIDAK terbaca utuh.`,
        en: ` ${cekSemua.length} rows across the three files were NOT read in full.`,
        zh: ` 三份文件中有 ${cekSemua.length} 行未被完整读取。`,
      })]),
      h('div', { style: { fontSize: '11.5px', marginTop: '4px', fontWeight: 400 } }, tr({
        id: 'Bukan di-skip. Yang sebabnya "nama_tanpa_kunci" memang tidak bisa dipertemukan dengan baris mana pun — stiker, dalaman ban dan barang non-label begitu, dan itu wajar. Yang perlu diperiksa adalah baris yang namanya memang nama ban tapi tetap tidak dapat kunci.',
        en: 'Not skipped. Rows whose reason is "nama_tanpa_kunci" genuinely cannot be matched to anything — stickers, inner tubes and non-label items are like that, which is fine. What needs looking at is a row whose name IS a tyre name and still gets no key.',
        zh: '并非跳过。原因为「nama_tanpa_kunci」的行确实无法与任何行匹配 — 贴纸、内胎与非标签物品本就如此，属正常。需要查看的是名称确为轮胎名称却仍未取得键值的行。',
      })),
      ...cekSemua.slice(0, 6).map(e => h('div.mono', { style: { fontSize: '10.5px', marginTop: '2px', fontWeight: 400 } },
        `• kotak ${e.sumber} baris ${e.baris} — ${[].concat(e.semuaSebab || e.sebab || []).join(',')} — ${String(e.nama || e.erp || '').slice(0, 46)}`)),
      cekSemua.length > 6 ? h('div.mono', { style: { fontSize: '10.5px', fontWeight: 400 } }, `…+${cekSemua.length - 6}`) : null,
    ]));
  }

  if (hasil.gerak.length) spanduk.push(spandukGerak(hasil));

  if (!ui.urIndo || !ui.urChina) {
    const kurang = [!ui.urIndo ? 2 : null, !ui.urChina ? 3 : null].filter(Boolean);
    spanduk.push(h('div.cfg-banner', { style: { display: 'block' } }, [icon('warn', 14), tr({
      id: ` Kotak ${kurang.join(' dan ')} belum diisi — angka gudangnya belum ada, jadi "HARUS BELI" di atas belum bisa dipakai membeli. Barisnya tetap ditampilkan dengan statusnya ditandai.`,
      en: ` Box ${kurang.join(' and ')} is still empty — the warehouse numbers are missing, so "MUST BUY" above is not yet safe to buy from. The rows are still shown with their status marked.`,
      zh: ` 第 ${kurang.join('、')} 框尚未填入 — 缺少仓库数字，因此上方的「需采购」尚不能作为采购依据。相关行仍会显示并标注状态。`,
    })]));
  }

  const thead = h('thead', h('tr', [
    h('th', '#'), h('th', 'ETA'), h('th', t('col_erp')), h('th', t('col_spec')),
    h('th.r', tr({ id: 'Butuh', en: 'Need', zh: '需求' })),
    h('th.r', tr({ id: 'Sistem', en: 'System', zh: '系统' })),
    h('th.r', tr({ id: 'Fisik', en: 'Physical', zh: '实物' })),
    h('th.r', tr({ id: 'Selisih', en: 'Gap', zh: '差额' })),
    h('th.r', tr({ id: 'Jalan', en: 'In transit', zh: '在途' })),
    h('th.r', tr({ id: 'Belum jadwal', en: 'Unscheduled', zh: '未排期' })),
    h('th.r', tr({ id: 'Sudah di-PO', en: 'On PO', zh: '已订' })),
    h('th.r', tr({ id: 'SISA BELI', en: 'STILL BUY', zh: '仍需采购' })),
    h('th', tr({ id: 'Status', en: 'Status', zh: '状态' })),
  ]));

  const body = h('tbody', hal.length
    ? hal.map(r => barisTabel(r, bisaTulis))
    : barisTakCocok(13, { id: 'ur', adaFilter: jumlahFilterAktif(nilai) > 0 }));

  const judulTabel = tr({ id: 'Daftar urgensi', en: 'Urgency list', zh: '紧急度清单' });
  const tabel = h('div.card', [
    h('div.card-head', [
      h('div.card-title', judulTabel),
      hitunganSaring(rows.length, hasil.baris.length, { id: 'baris', en: 'rows', zh: '行' }),
      tombolFilter({ id: 'ur', medan, judul: judulTabel, kunciHalaman: 'urPage' }),
      h('div.mla.row.gap8', [
        btn(tr({ id: 'Export Excel', en: 'Export to Excel', zh: '导出 Excel' }), { sm: true, iconName: 'download', onClick: () => exportUrgensi(hasil.baris) }),
        bisaTulis ? btn(tr({ id: 'Simpan snapshot ETA', en: 'Save ETA snapshot', zh: '保存 ETA 快照' }), { sm: true, variant: 'primary', onClick: () => simpanSnap(hasil) }) : null,
      ]),
    ]),
    h('div.tbl-wrap', h('table.tbl', [thead, body])),
    pager(rows.length, ui.urPage || 1, PAGE_DEFAULT, p => setUI({ urPage: p })),
    h('div.tbl-foot', tr({
      id: 'Urut: yang kurang dulu (ETA terdekat), lalu yang datanya belum lengkap, lalu yang stoknya cukup, lalu yang sudah di-PO. Baris tanpa ETA TIDAK ditaruh paling bawah — belum punya tanggal bukan berarti tidak mendesak, justru belum ketahuan.',
      en: 'Order: short rows first (nearest ETA), then rows with incomplete data, then rows with enough stock, then rows already on a PO. Rows with no ETA are NOT pushed to the bottom — having no date does not mean not urgent, it means not yet known.',
      zh: '排序：先短缺行（ETA 最近），再数据不全行，再库存充足行，最后已开采购单行。无 ETA 的行不会被排到最后 — 没有日期并不意味着不紧急，而是尚不可知。',
    })),
  ]);

  return [kartuAngka, ...spanduk, tabel];
}

function barisTabel(r, bisaTulis) {
  const warnaSisa = (r.sisaKurang == null) ? '' : (r.sisaKurang > 0 ? 'var(--st-red-tx)' : 'var(--st-green-tx)');
  const sel = (v) => h('td.mono.r', { style: { fontSize: '11px' } }, v == null ? '—' : num(v));

  // Angka berkas DAN angka koreksi dua-duanya, bukan salah satu. "Dua-duanya
  // ditampilin, selisihnya ditandai" — dan kalau yang tampil cuma hasilnya,
  // tidak ada apa pun yang membuktikan berkasnya memang salah.
  const duaAngka = (dipakai, dariBerkas, medanAwal) => {
    const beda = dariBerkas != null && dipakai != null && Number(dipakai) !== Number(dariBerkas);
    return h('td.r', { style: { fontSize: '11px' } }, [
      h('div.mono', { style: { fontWeight: beda ? 800 : 400, color: beda ? 'var(--st-amber-tx)' : '' } }, dipakai == null ? '—' : num(dipakai)),
      beda ? h('div.mono', { style: { fontSize: '9.5px', color: 'var(--text-3)', textDecoration: 'line-through' } }, num(dariBerkas)) : null,
      (bisaTulis && r.kunci) ? h('span', {
        title: tr({ id: 'Koreksi angka ini', en: 'Correct this number', zh: '修正此数字' }),
        style: { cursor: 'pointer', fontSize: '10px', color: 'var(--accent-tx)' },
        onClick: () => bukaKoreksi(r, medanAwal),
      }, tr({ id: 'ubah', en: 'edit', zh: '修改' })) : null,
    ]);
  };

  const tglPo = (r.po || []).map(p => String(p.tgl).slice(0, 10));
  return h('tr', [
    h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, String(r._row)),
    h('td.mono', { style: { fontSize: '11px', fontWeight: r.tgl ? 700 : 400, color: r.tgl ? '' : 'var(--text-3)' } }, r.tgl || '—'),
    h('td.mono', { style: { fontSize: '10.5px' } }, r.erp || '—'),
    h('td', { style: { fontSize: '11px', maxWidth: '300px' } }, [
      r.spec,
      r.catatan ? h('div', { style: { fontSize: '10px', color: 'var(--st-amber-tx)' } }, '↳ ' + r.catatan) : null,
    ]),
    duaAngka(r.butuh, r.butuhFile, 'butuh'),
    sel(r.sistem),
    duaAngka(r.fisik, r.fisikFile, 'fisik'),
    h('td.mono.r', { style: { fontSize: '11px', color: r.selisih ? 'var(--st-amber-tx)' : 'var(--text-3)' } },
      r.selisih == null ? '—' : (r.selisih > 0 ? '+' : '') + num(r.selisih)),
    sel(r.jalan),
    sel(r.belum),
    h('td.r', { style: { fontSize: '11px' } }, r.sudahDipesan
      ? h('span.mono', { title: (r.po || []).map(p => `${p.poNo} · ${String(p.tgl).slice(0, 10)} · ${num(p.qty)}`).join('\n') }, num(r.sudahDipesan))
      : h('span.mono', { style: { color: 'var(--text-3)' } }, '—')),
    h('td.mono.r', { style: { fontSize: '11.5px', fontWeight: 800, color: warnaSisa } }, r.sisaKurang == null ? '—' : num(r.sisaKurang)),
    h('td', { style: { fontSize: '10.5px' } }, [
      // Yang sudah di-PO "dihilangkan dari daftar beli" seperti yang diminta —
      // SISA BELI-nya nol dan dia jatuh ke golongan paling bawah — tapi barisnya
      // TETAP ADA dan menyebutkan tanggal pesanannya. Benar-benar menghapusnya
      // berarti tidak ada lagi yang bisa menjawab "ini sudah dibeli atau
      // kelewat?", dan pertanyaan itu pasti datang.
      r.status === STATUS.SUDAH_DIPESAN
        ? badge(tr({
            id: `sudah dipesan ${tglPo.join(', ')}`,
            en: `ordered ${tglPo.join(', ')}`,
            zh: `已于 ${tglPo.join('、')} 订购`,
          }), 'green', { iconName: 'check' })
        : r.status === STATUS.LENGKAP
          ? badge(tr({ id: 'lengkap', en: 'complete', zh: '完整' }), 'gray')
          : badge(r.status, r.status === STATUS.TANPA_GUDANG ? 'red' : 'amber'),
      r.dikoreksi ? h('div', { style: { fontSize: '9.5px', color: 'var(--text-3)', marginTop: '2px' } },
        tr({ id: `dikoreksi ${r.koreksiOleh}`, en: `corrected by ${r.koreksiOleh}`, zh: `由 ${r.koreksiOleh} 修正` })) : null,
    ]),
  ]);
}

function spandukGerak(hasil) {
  const g = hasil.gerak;
  const mundur = g.filter(x => x.arah === 'mundur');
  const hilang = g.filter(x => x.arah === 'hilang');
  const kapan = String((hasil.snapTerakhir || {}).at || '').slice(0, 16);
  const merah = mundur.length > 0;
  return h('div.cfg-banner', {
    style: { display: 'block',
             background: merah ? 'var(--st-red-bg)' : 'var(--st-amber-bg)',
             color: merah ? 'var(--st-red-tx)' : 'var(--st-amber-tx)',
             borderColor: merah ? 'var(--st-red-tx)' : 'var(--st-amber-tx)' },
  }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), tr({
      id: ` ETA bergeser di ${g.length} barang sejak snapshot ${kapan} — ${mundur.length} MUNDUR, ${hilang.length} jadwalnya hilang.`,
      en: ` ETA moved on ${g.length} items since the ${kapan} snapshot — ${mundur.length} moved LATER, ${hilang.length} lost their schedule.`,
      zh: ` 自 ${kapan} 快照以来，${g.length} 项 ETA 发生变动 — ${mundur.length} 项推迟，${hilang.length} 项排期消失。`,
    })]),
    h('div', { style: { fontSize: '11.5px', marginTop: '4px', fontWeight: 400 } }, tr({
      id: 'Yang MUNDUR paling atas: itu yang paling mungkin membatalkan keputusan beli yang sudah diambil atas tanggal yang lama. Jadwal yang HILANG dari berkas juga disebut — tidak ada satu angka pun yang berubah di layar waktu itu terjadi, jadi dia yang paling mudah tidak disadari.',
      en: 'Rows that moved LATER come first: those are the ones most likely to invalidate a buying decision already made on the old date. Schedules that DISAPPEARED from the file are named too — not one number on screen changes when that happens, so they are the easiest to miss.',
      zh: '推迟的行排在最前：它们最有可能使基于旧日期已做出的采购决定失效。从文件中消失的排期也会被指出 — 发生时屏幕上没有任何数字变化，因此最容易被忽略。',
    })),
    ...g.slice(0, 8).map(x => h('div.mono', { style: { fontSize: '10.5px', marginTop: '2px', fontWeight: 400 } },
      '• ' + x.kunci + ' — ' + (
        x.arah === 'hilang' ? `jadwal ${x.dari} HILANG`
        : x.arah === 'baru' ? `dapat jadwal ${x.ke}`
        : x.arah === 'qty' ? `${x.dari} jumlah ${num(x.qtyDari)} → ${num(x.qtyKe)}`
        : `${x.dari} → ${x.ke} (${x.geser > 0 ? '+' : ''}${x.geser} hari)`
      ))),
    g.length > 8 ? h('div.mono', { style: { fontSize: '10.5px', fontWeight: 400 } }, `…+${g.length - 8}`) : null,
  ]);
}

function bukaKoreksi(r, medanAwal) {
  const st = getState();
  const kotak = (k, label, nilai, ph) => h('div', { style: { marginBottom: '10px' } }, [
    h('div', { style: { fontSize: '11px', fontWeight: 700, marginBottom: '3px' } }, label),
    h('input.input.mono', {
      id: 'kor-' + k, defaultValue: nilai == null ? '' : String(nilai), placeholder: ph,
      style: { width: '100%', fontSize: '12px' },
    }),
  ]);

  const ov = modal({
    title: tr({ id: 'Koreksi angka', en: 'Correct the numbers', zh: '修正数字' }),
    subtitle: `${r.erp || ''} · ${r.spec}`.slice(0, 92),
    width: 560,
    body: h('div', [
      h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '12px', lineHeight: 1.5 } }, tr({
        id: 'Angka berkas tidak dihapus — dia tetap tampil di bawah angka koreksi, dicoret. Kosongkan kotaknya untuk membatalkan koreksi dan kembali ke angka berkas. Setiap perubahan dicatat beserta siapa dan kapan.',
        en: 'The file number is not deleted — it stays below the corrected one, struck through. Clear the box to cancel the correction and fall back to the file number. Every change is recorded with who and when.',
        zh: '文件数字不会被删除 — 它仍显示在修正值下方并带删除线。清空输入框即可取消修正并回退到文件数字。每次更改都会连同操作人与时间一并记录。',
      })),
      kotak('fisik', tr({
        id: `Stok fisik (berkas: ${r.fisikFile == null ? 'tidak ada' : num(r.fisikFile)})`,
        en: `Physical stock (file: ${r.fisikFile == null ? 'none' : num(r.fisikFile)})`,
        zh: `实物库存（文件：${r.fisikFile == null ? '无' : num(r.fisikFile)}）`,
      }), r.fisik, tr({ id: 'kosong = pakai angka berkas', en: 'empty = use the file number', zh: '留空 = 使用文件数字' })),
      kotak('butuh', tr({
        id: `Kebutuhan (berkas: ${num(r.butuhFile)})`,
        en: `Requirement (file: ${num(r.butuhFile)})`,
        zh: `需求量（文件：${num(r.butuhFile)}）`,
      }), r.butuh, tr({ id: 'kosong = pakai angka berkas', en: 'empty = use the file number', zh: '留空 = 使用文件数字' })),
      kotak('catatan', tr({ id: 'Catatan (kenapa dikoreksi)', en: 'Note (why it was corrected)', zh: '备注（修正原因）' }),
        r.catatan, tr({ id: 'mis. sudah dihitung ulang di gudang 11 Nov', en: 'e.g. recounted at the warehouse on 11 Nov', zh: '例如：11 月 11 日已在仓库重新盘点' })),
      h('div.mono', { id: 'kor-pesan', style: { fontSize: '11px', fontWeight: 700 } }, ''),
    ]),
    footer: h('div.row.gap8', { style: { justifyContent: 'flex-end' } }, [
      btn(t('cancel'), { onClick: () => ov.remove() }),
      btn(t('save'), {
        variant: 'primary',
        onClick: async () => {
          const baca = (k) => { const el = document.getElementById('kor-' + k); return el ? el.value.trim() : ''; };
          const pesan = document.getElementById('kor-pesan');
          const salah = (teks) => { if (pesan) { pesan.textContent = teks; pesan.style.color = 'var(--st-red-tx)'; } };
          // undefined = diketik tapi bukan angka. null = dikosongkan, dan itu
          // nilai yang SAH ("batalkan koreksi"). Dua keadaan yang berbeda, dan
          // menyamakannya berarti salah ketik tersimpan sebagai pembatalan.
          const angkaAtauNull = (s) => {
            if (s === '') return null;
            const n = Number(String(s).replace(/[,\s]/g, ''));
            return Number.isFinite(n) ? n : undefined;
          };
          const fisik = angkaAtauNull(baca('fisik'));
          const butuh = angkaAtauNull(baca('butuh'));
          if (fisik === undefined || butuh === undefined) {
            salah(tr({ id: 'Isi angka, atau kosongkan sama sekali.', en: 'Enter a number, or leave it completely empty.', zh: '请输入数字，或完全留空。' }));
            return;
          }
          const catatan = baca('catatan');
          try {
            await simpanKoreksi({ kunci: r.kunci, medan: ['fisik', 'butuh', 'catatan'], fisik, butuh, catatan, oleh: st.user.username });
          } catch (e) {
            console.error(e);
            salah(tr({ id: 'Gagal simpan: ' + (e.message || e), en: 'Save failed: ' + (e.message || e), zh: '保存失败：' + (e.message || e) }));
            return;
          }
          const kor = { ...(getState().ui.urKoreksi || {}) };
          kor[r.kunci] = { fisik, butuh, catatan, oleh: st.user.username, pada: new Date().toISOString() };
          logAudit({ entity: 'urgensi', target: r.erp || r.kunci, action: 'koreksi', detail: `fisik=${fisik} butuh=${butuh}` });
          ov.remove();
          setUI({ urKoreksi: kor });
        },
      }),
    ]),
    onClose: () => ov.remove(),
  });
  document.body.appendChild(ov);
  setTimeout(() => { const el = document.getElementById('kor-' + (medanAwal || 'fisik')); if (el) el.focus(); }, 0);
}

// Snapshot disimpan SESUDAH penggabungan berhasil, bukan saat berkasnya masuk.
// Snapshot dari penggabungan yang gagal adalah catatan keadaan yang tidak
// pernah ada, dan dia akan jadi pembanding untuk unggahan berikutnya.
async function simpanSnap(hasil) {
  if (blockWrite('simpan snapshot ETA')) return;
  const st = getState();
  try {
    await simpanSnapshot({
      eta: snapshotDari(hasil.baris),
      ringkasan: hasil.ringkasan,
      berkas: [(st.ui.urSona || {}).berkas, (st.ui.urIndo || {}).berkas, (st.ui.urChina || {}).berkas].filter(Boolean).join(' + '),
      oleh: st.user.username,
    });
    const snap = await fetchSnapshotTerakhir(2).catch(() => []);
    setUI({ urSnapshot: snap });
    logAudit({ entity: 'urgensi', target: 'snapshot', action: 'simpan', detail: `${hasil.baris.length} baris` });
    toast({
      id: 'Snapshot ETA disimpan. Unggahan berikutnya akan dibandingkan dengan yang ini.',
      en: 'ETA snapshot saved. The next upload will be compared against this one.',
      zh: 'ETA 快照已保存。下次上传将与此快照比较。',
    });
  } catch (e) {
    console.error(e);
    toast({ id: 'Gagal simpan snapshot: ' + (e.message || e), en: 'Failed to save the snapshot: ' + (e.message || e), zh: '保存快照失败：' + (e.message || e) });
  }
}

// Export memuat angka berkas DAN angka koreksi dalam kolom terpisah, plus
// kunci gabungnya. Kolom kunci itu yang membuat berkas ini bisa dibawa balik ke
// percakapan dengan gudang: dia satu-satunya yang menjelaskan kenapa dua baris
// yang namanya berbeda dihitung sebagai barang yang sama.
async function exportUrgensi(baris) {
  const aoa = [[
    'ETA', 'ERP', 'Market', 'Spec', 'Butuh (dipakai)', 'Butuh (berkas)', 'Stok sistem',
    'Stok fisik (dipakai)', 'Stok fisik (berkas)', 'Selisih sistem-fisik', 'Jalan', 'Belum jadwal',
    'Sudah di-PO bulan ini', 'No. PO', 'SISA BELI', 'Status', 'Dikoreksi oleh', 'Catatan', 'Kunci gabung',
  ]];
  for (const r of baris) {
    aoa.push([
      r.tgl || '', r.erp || '', r.market || '', r.spec,
      r.butuh == null ? '' : r.butuh, r.butuhFile == null ? '' : r.butuhFile,
      r.sistem == null ? '' : r.sistem,
      r.fisik == null ? '' : r.fisik, r.fisikFile == null ? '' : r.fisikFile,
      r.selisih == null ? '' : r.selisih,
      r.jalan == null ? '' : r.jalan, r.belum == null ? '' : r.belum,
      r.sudahDipesan || '', (r.po || []).map(p => p.poNo).join(', '),
      r.sisaKurang == null ? '' : r.sisaKurang,
      r.status, r.koreksiOleh || '', r.catatan || '', r.kunci || '',
    ]);
  }
  await writeWorkbook(`Urgensi Label - ${fmtDate(new Date())}.xlsx`, [{
    name: 'Urgensi', aoa,
    cols: [{ wch: 11 }, { wch: 18 }, { wch: 8 }, { wch: 46 }, { wch: 14 }, { wch: 13 }, { wch: 12 },
           { wch: 16 }, { wch: 15 }, { wch: 17 }, { wch: 10 }, { wch: 13 }, { wch: 18 }, { wch: 20 },
           { wch: 11 }, { wch: 26 }, { wch: 14 }, { wch: 34 }, { wch: 26 }],
  }]);
  toast({ id: 'Excel diunduh.', en: 'Excel downloaded.', zh: 'Excel 已下载。' });
}
