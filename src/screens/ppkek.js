import { h, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, pager, pageSlice, PAGE_DEFAULT, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { extractArchive } from '../parsers/archive.js';
import { parsePpkekPdf, parseSppbPdf } from '../parsers/ppkekPdf.js';
import { uploadToDrive, ppkekFolder } from '../core/drive.js';
import { linkOutbox } from '../core/driveOutbox.js';
import { readWorkbook, writeWorkbook, colLetter } from '../core/xlsx.js';
import { num, fmtDate } from '../core/format.js';
import { insertPpkek, updatePpkek, duplicateNopen, toIsoDate } from '../core/ppkekApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';

// Report/register column order (2-tab LDP/TLDDP layout, from PPKEK DECEMBER.xlsx).
// Column order copied from PPKEK DECEMBER.xlsx, the register Kyaru actually
// keeps. ONE ROW PER ITEM, not per document — nopen 12933 appears twice there
// because that shipment carried two goods lines. A document with no readable
// item lines still produces exactly one row, so nothing disappears from the
// register just because the goods block failed to parse.
//
// 'Valuta' and 'Kurs NDPBM' are INSERTED after Total Cost rather than appended
// at the end. Unit Cost and Total Cost are figures in the document's own
// currency, and with CNY and USD shipments now sharing a sheet, a column that
// says which belongs beside them, not twenty columns away. Kurs sits next to it
// so the sheet can check itself: Total Cost x Kurs is the IDR value.
//
// Inserting is safe for the workbook because everything moves RIGHT — nothing
// that was in a column loses its neighbours, and importUpdates() reads by
// COLUMN NAME (see below), so a file exported before this change still imports.
const REPORT_COLS = [
  'Nopen', 'PPKEK Date', 'ETA', 'Contract No.', 'Item Name', 'Item Code',
  'Suplier Name', 'Address', 'Invoice No.', 'Unit Cost', 'Total Cost',
  'Valuta', 'Kurs NDPBM', 'PPN',
  'Unit', 'PL No', 'PPKEK No.', 'PPKEK Status', 'SO', 'JO', 'Costing',
  'PO ERP INA NO.', 'Tanggal Aktual Diterima', '__ROWID',
];

// Column title -> the field it carries. importUpdates() uses this to locate
// columns BY NAME instead of by position.
//
// It used to count positions, and the positions it counted were the old
// 12-column export's — never updated when the export was rewritten to 22. So
// the advertised round-trip ("Export then Import for bulk round-trip") was
// reading Unit Cost as SO, Total Cost as JO, PPN as Costing and PL No as
// Status, then offering to WRITE those into the register. Silent, and
// destructive if applied.
//
// By name, it also survives this very commit adding two columns, and survives
// anyone reordering or hiding columns in Excel before importing.
const IMPORT_FIELDS = {
  'SO': 'so', 'JO': 'jo', 'Costing': 'costing',
  'PO ERP INA NO.': 'poErpIna', 'PPKEK Status': 'status',
};

export function ppkekScreen() {
  const st = getState(); const ui = st.ui;
  // ppkekWrite, mirroring the ppkek_rw policy (wilbert + sekar). This screen had
  // no capability check at all, and its riskiest write is not a button: every
  // register row carries four inline inputs and a status dropdown that commit on
  // blur/change, which is easy to miss when auditing a screen for buttons.
  const canWrite = can(st.user.role, 'ppkekWrite');

  const dz = dropzone({
    title: t('pk_drop'), sub: t('pk_drop_sub'), accept: '.rar,.zip', iconName: 'box', compact: true,
    // multiple: the folder these bundles arrive in holds twenty-odd of them at a
    // time. Dropping them one at a time is the same work done twenty times.
    multiple: true,
    onFiles: f => handleArchives(f),
    // Locked while a batch runs. Dropping a second pile on top of a running one
    // would interleave two sequential loops over the same register and the same
    // Drive folder — the exact race the nopen index exists to catch.
    disabled: !canWrite || !!(ui.pkBatch && ui.pkBatch.running),
    disabledNote: (ui.pkBatch && ui.pkBatch.running)
      ? tr({ id: 'Sedang memproses — tunggu sampai selesai', en: 'Processing — wait until it finishes', zh: '正在处理 — 请等待完成' })
      : tr({ id: 'Register PPKEK cuma bisa dilihat dari akun ini', en: 'This account can only view the PPKEK register', zh: '此账号只能查看 PPKEK 登记册' }),
  });

  // While a batch is running the progress card takes the extract card's slot:
  // during a twenty-bundle run "which bundle are we on" is the only thing that
  // matters, and the per-bundle file list reappears the moment it finishes.
  const extractCard = ui.pkBatch ? batchStatus(ui.pkBatch)
    : ui.pkExtract ? extractStatus(ui.pkExtract)
    : card([h('div.card-pad', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '150px' } }, [h('div.card-title', tr({ id: 'Hasil Ekstraksi', en: 'Extraction Result', zh: '解压结果' })), h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' } }, tr({ id: 'Drop RAR/ZIP untuk mengekstrak & parse dokumen kepabeanan. Bisa banyak file sekaligus.', en: 'Drop RAR/ZIP to extract & parse customs documents. Many files at once is fine.', zh: '拖入 RAR/ZIP 以解压并解析报关单据。可一次拖入多个文件。' }))])]);

  const parsedCard = ui.pkParsed ? parsedInfo(ui.pkParsed) : card([h('div.card-pad', { style: { minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span', { style: { fontSize: '12px', color: 'var(--text-3)' } }, tr({ id: 'Belum ada PPKEK diparse', en: 'No PPKEK parsed yet', zh: '尚未解析报关单' })))]);

  const top = h('div.grid', { style: { gridTemplateColumns: '1fr 1fr 1.25fr' } }, [dz, extractCard, parsedCard]);

  const register = registerTable(st, canWrite);

  return h('div.stack', [top, register, ui.pkDiff ? diffModal() : null]);
}

function extractStatus(ex) {
  return card([
    h('div.card-pad', [
      h('div.row.gap8', [
        h('span', { style: { width: '32px', height: '32px', borderRadius: '8px', background: 'var(--navy-soft)', color: 'var(--navy-soft-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800 } }, (ex.format || 'ZIP').toUpperCase()),
        h('div.grow', [h('div.mono', { style: { fontSize: '12px', fontWeight: 700 } }, ex.name), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
          id: `${ex.files.length} dokumen`,
          en: `${ex.files.length} document${ex.files.length === 1 ? '' : 's'}`,
          zh: `${ex.files.length} 份单据`,
        }))]),
      ]),
      h('div', { style: { height: '7px', borderRadius: '999px', background: 'var(--surface3)', marginTop: '14px', overflow: 'hidden' } }, h('div', { style: { width: '100%', height: '100%', background: 'var(--st-green-tx)' } })),
      h('div.row', { style: { justifyContent: 'space-between', marginTop: '7px' } }, [h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } }, t('pk_extract_done')), h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${ex.files.length}/${ex.files.length}`)]),
      h('div', { style: { borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '9px', display: 'flex', flexDirection: 'column', gap: '5px' } }, ex.files.map(f => h('div.row.gap8', { style: { fontSize: '11px', color: 'var(--text-2)' } }, [icon('check', 11, { stroke: 'var(--st-green-tx)', strokeWidth: 2.5 }), h('span.grow', f.name), h('a.link', { href: f.url && !f.url.startsWith('drive-') ? f.url : null, target: '_blank', onClick: e => { if (!f.url || f.url.startsWith('drive-')) e.preventDefault(); } }, 'Drive ↗')]))),
    ]),
  ]);
}

// Batch progress + result list. One card, two lives: a live progress bar while
// the loop runs, then a summary of what each bundle turned out to be — which is
// the part you actually need, because with twenty bundles a toast can only say
// how many, never which one was already in the register.
//
// The KEYS are outcome modes (data — they come back from processArchive and are
// compared); only `label` is painted on screen, so only `label` is translated,
// and it is resolved at render time rather than here, or the language in force
// when this module first loaded would stick for the session.
const BATCH_TONE = {
  baru:     { label: { id: 'BARU',   en: 'NEW',    zh: '新增'  }, color: 'var(--st-green-tx)' },
  ulang:    { label: { id: 'ULANG',  en: 'REPEAT', zh: '重复'  }, color: 'var(--st-amber-tx)' },
  balapan:  { label: { id: 'ADA',    en: 'EXISTS', zh: '已存在' }, color: 'var(--st-amber-tx)' },
  nonopen:  { label: { id: 'NOPEN?', en: 'NOPEN?', zh: '单号?'  }, color: 'var(--st-amber-tx)' },
  gagal:    { label: { id: 'GAGAL',  en: 'FAILED', zh: '失败'  }, color: 'var(--st-red-tx)' },
};

// Outcome notes travel from processArchive/addRegisterRow into the batch list
// and the single-file failure toast, both of which render per language — so a
// note carries all three. Server error text has no translation and is repeated.
const note3 = (id, en, zh) => ({ id, en, zh });

function batchStatus(b) {
  const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
  const tally = b.results.reduce((a, r) => { a[r.mode] = (a[r.mode] || 0) + 1; return a; }, {});
  const line = ['baru', 'ulang', 'balapan', 'nonopen', 'gagal']
    .filter(k => tally[k])
    .map(k => `${tally[k]} ${tr(BATCH_TONE[k].label).toLowerCase()}`)
    .join(' · ');
  return card([
    h('div.card-pad', [
      h('div.row.gap8', [
        h('div.grow', [
          h('div.card-title', b.running ? tr({
              id: `Memproses bundel ${Math.min(b.done + 1, b.total)}/${b.total}`,
              en: `Processing bundle ${Math.min(b.done + 1, b.total)}/${b.total}`,
              zh: `正在处理压缩包 ${Math.min(b.done + 1, b.total)}/${b.total}`,
            })
            // "Selesai — 12 bundel" after stopping at the third is a lie the
            // card would tell every time someone cancels.
            : b.cancel ? tr({
              id: `Dibatalkan — ${b.done} dari ${b.total} bundel`,
              en: `Cancelled — ${b.done} of ${b.total} bundles`,
              zh: `已取消 — ${b.done} 个（共 ${b.total} 个压缩包）`,
            })
            : tr({
              id: `Selesai — ${b.total} bundel`,
              en: `Done — ${b.total} bundles`,
              zh: `完成 — ${b.total} 个压缩包`,
            })),
          h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            b.running ? (b.current || '—') : (line || '—')),
        ]),
        b.running
          ? h('button.btn.btn-sm', { style: { fontSize: '10.5px', padding: '3px 9px' }, onClick: () => { b.cancel = true; setState({}); } }, b.cancel
            ? tr({ id: 'Membatalkan…', en: 'Cancelling…', zh: '正在取消…' })
            : tr({ id: 'Batalkan', en: 'Cancel', zh: '取消' }))
          : h('button.x-btn', { onClick: () => setUI({ pkBatch: null }) }, icon('x', 13)),
      ]),
      h('div', { style: { height: '7px', borderRadius: '999px', background: 'var(--surface3)', marginTop: '12px', overflow: 'hidden' } },
        h('div', { style: { width: pct + '%', height: '100%', background: b.running ? 'var(--navy-soft-tx)' : 'var(--st-green-tx)', transition: 'width .2s' } })),
      h('div.row', { style: { justifyContent: 'space-between', marginTop: '6px' } }, [
        // "extracted N/M" for the bundle in flight — a single 11 MB RAR with ten
        // documents can sit on one Drive upload for seconds, and without this the
        // whole thing looks frozen.
        h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } },
          b.running && b.docs ? tr({
            id: `dokumen ${b.doc}/${b.docs}`,
            en: `document ${b.doc}/${b.docs}`,
            zh: `文件 ${b.doc}/${b.docs}`,
          }) : (b.running ? tr({ id: b.phase || 'mengekstrak…', en: 'extracting…', zh: '解压中…' }) : line)),
        h('span.mono', { style: { fontSize: '11px', fontWeight: 600 } }, `${b.done}/${b.total}`),
      ]),
      b.results.length ? h('div', {
        style: { borderTop: '1px solid var(--border)', marginTop: '11px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' },
      }, b.results.slice().reverse().map(r => {
        const tone = BATCH_TONE[r.mode] || BATCH_TONE.gagal;
        return h('div.row.gap8', { style: { fontSize: '10.5px', color: 'var(--text-2)' } }, [
          h('span', { style: { fontSize: '8.5px', fontWeight: 800, letterSpacing: '.05em', color: tone.color, minWidth: '46px' } }, tr(tone.label)),
          h('span.grow.mono', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: (r.note ? tr(r.note) : null) || r.file }, r.nopen || r.file),
          r.docs != null ? h('span', { style: { color: 'var(--text-3)' } }, tr({ id: `${r.docs} dok`, en: `${r.docs} docs`, zh: `${r.docs} 份` })) : null,
        ]);
      })) : null,
    ]),
  ]);
}

function parsedInfo(p) {
  // Sticky duplicate warning — stays until the next import, unlike the toast.
  const dupe = getState().ui.pkDupe;
  return card([
    h('div.card-pad', [
      dupe ? h('div', { style: { background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', border: '1px solid var(--st-amber-tx)', borderRadius: '8px', padding: '9px 12px', marginBottom: '11px', fontSize: '11.5px', fontWeight: 600 } },
        dupe.mode === 'ulang'
          ? tr({
            id: `⚠ Nopen ${dupe.nopen} SUDAH PERNAH DISUBMIT — baris lama diperbarui, tidak ditambah baru. SO/JO/Costing/Status tidak diubah.`,
            en: `⚠ Nopen ${dupe.nopen} WAS ALREADY SUBMITTED — the existing row was updated, no new row added. SO/JO/Costing/Status untouched.`,
            zh: `⚠ 报关单号 ${dupe.nopen} 之前已提交过 — 已更新原有行，未新增。SO/JO/Costing/状态未改动。`,
          })
          : tr({
            id: `⚠ Nopen ${dupe.nopen} sudah ada di register (dimasukkan sesi lain). Refresh untuk melihatnya.`,
            en: `⚠ Nopen ${dupe.nopen} is already in the register (added by another session). Refresh to see it.`,
            zh: `⚠ 报关单号 ${dupe.nopen} 已在登记册中（由其他会话录入）。刷新后可见。`,
          })) : null,
      h('div.row.gap8', { style: { marginBottom: '11px' } }, [badge(tr({ id: 'PARSED', en: 'PARSED', zh: '已解析' }), 'green'), h('span.mono', { style: { fontSize: '12.5px', fontWeight: 700 } }, `Nopen ${p.nopen || '—'}`), h('div.mla.row.gap8', [badge(p.asal, 'navy'), badge(tr({ id: 'Fasilitas KEK', en: 'KEK Facility', zh: 'KEK 设施' }), 'green')])]),
      h('div.grid.g2', { style: { gap: '9px 16px' } }, [
        kv(tr({ id: 'Tgl Pendaftaran', en: 'Registration Date', zh: '报关日期' }), p.ppkekDate || '—'), kv(tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }), p.supplier || '—'),
        kv(tr({ id: 'Kurs NDPBM', en: 'NDPBM Rate', zh: 'NDPBM 汇率' }), p.kursNDPBM ? num(p.kursNDPBM, 2) : '—'), kv(tr({ id: 'Nilai ' + p.valuta, en: p.valuta + ' Value', zh: p.valuta + ' 金额' }), p.valueForeign ? num(p.valueForeign, 2) : '—'),
        kv(tr({ id: 'Nilai IDR', en: 'IDR Value', zh: 'IDR 金额' }), p.valueIDR ? num(p.valueIDR) : '—'), kv(tr({ id: 'No. Kontrak', en: 'Contract No.', zh: '合同号' }), p.contractNo || '—'),
      ]),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', borderTop: '1px dashed var(--border)', marginTop: '11px', paddingTop: '9px' } }, tr({
        id: 'Nilai IDR = CIF × kurs NDPBM tanggal pendaftaran',
        en: 'IDR value = CIF × NDPBM rate on the registration date',
        zh: 'IDR 金额 = CIF × 报关日期的 NDPBM 汇率',
      })),
    ]),
  ]);
}
function kv(l, v) { return h('div', [h('div', { style: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)' } }, l), h('div.mono', { style: { fontSize: '12px', marginTop: '2px', color: 'var(--text)' } }, v)]); }

// Kolom Valuta menuliskan 'USD' sebagai isian terakhir waktu dokumennya tidak
// menyebut valutanya tapi nominalnya terbaca. Penyaringnya harus membaca kolom
// itu persis seperti yang tertulis di layar — kalau dia membaca r.valuta mentah,
// baris yang jelas-jelas berbunyi "USD 1.200" tidak ikut waktu USD dipilih.
const valutaTampil = r => r.valuta || (r.usd ? 'USD' : '');

// Kotak-kotak jendela saring Register PPKEK. Isinya mengikuti kolom yang
// benar-benar ada di tabelnya.
//
// Valuta dan Jalur opsinya diambil dari register yang BENAR-BENAR ADA, bukan
// dari daftar valuta portal: register ini cuma pernah berisi dokumen USD dan
// CNY, dan setiap valuta lain di dropdown adalah pilihan yang tidak mungkin
// menghasilkan satu baris pun. Status sebaliknya memang himpunan tetap — tiga
// itu saja yang bisa dipilih di kolomnya — jadi ketiganya selalu ditawarkan,
// termasuk yang kebetulan belum dipakai satu baris pun.
const MEDAN_REGISTER = (semua) => [
  { kunci: 'nopen', label: tr({ id: 'Nopen', en: 'Nopen', zh: '报关单号' }), tipe: 'teks', mono: true, ambil: r => r.nopen },
  { kunci: 'tgl', label: tr({ id: 'Tanggal', en: 'Date', zh: '日期' }), tipe: 'tanggal', ambil: r => r.date },
  { kunci: 'supplier', label: tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }), tipe: 'teks', ambil: r => r.supplier },
  { kunci: 'valuta', label: tr({ id: 'Valuta', en: 'Currency', zh: '外币' }), tipe: 'pilih', opsi: [...new Set((semua || []).map(valutaTampil).filter(Boolean))].sort(), ambil: valutaTampil },
  { kunci: 'jalur', label: tr({ id: 'Jalur', en: 'Lane', zh: '通道' }), tipe: 'pilih', opsi: [...new Set((semua || []).map(r => r.jalur).filter(Boolean))].sort(), ambil: r => r.jalur },
  { kunci: 'so', label: 'SO', tipe: 'teks', mono: true, ambil: r => r.so },
  { kunci: 'po', label: 'PO ERP INA', tipe: 'teks', mono: true, ambil: r => r.poErpIna },
  // Status memakai teks yang TERBACA di kolomnya, bukan kode simpanannya:
  // dropdown dan kolomnya harus berbunyi sama. Baris yang statusnya belum
  // pernah diisi sengaja mengembalikan kosong — di kolomnya baris itu memang
  // '—', bukan Open, dan tidak boleh ikut terjaring waktu Open dipilih.
  { kunci: 'status', label: tr({ id: 'Status', en: 'Status', zh: '状态' }), tipe: 'pilih', opsi: ['Open', 'Costed', 'Closed'].map(statusLabel), ambil: r => (r.status ? statusLabel(r.status) : '') },
];

function registerTable(st, canWrite) {
  // NEWEST FIRST, and by the date on the document — not by whatever order the
  // server happened to return. A register is read top-down to answer "what just
  // came in", so fetch order is the wrong thing to trust. Ties fall back to the
  // row's own position so the sort stays stable instead of shuffling on rerender.
  const rows = (st.ppkek || []).map((r, i) => [r, i]).sort((a, b) => {
    const ta = new Date(a[0].date).getTime(), tb = new Date(b[0].date).getTime();
    const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
    return vb - va || a[1] - b[1];
  }).map(x => x[0]);
  const medan = MEDAN_REGISTER(rows);
  const nilai = nilaiFilter('pkk');
  const tersaring = saring(rows, medan, nilai);
  // Paginasi — alasannya di ui/components.js. Register ini tumbuh terus dan
  // tidak pernah menyusut, jadi ongkosnya cuma naik seiring waktu.
  // Dipotong dari hasil SARINGANNYA, bukan dari seluruh register: kalau
  // dipotong dari seluruhnya, hasil yang tinggal tiga baris bisa jatuh di
  // halaman yang sedang tidak dibuka dan terbaca sebagai "tidak ada hasil".
  const size = st.ui.pkSize === 0 ? 0 : (Number(st.ui.pkSize) || PAGE_DEFAULT);
  const hal = pageSlice(tersaring, st.ui.pkPage || 1, size);
  hal.size = size;
  // The pencil marks mean "you can edit this". Strip them when the cells are
  // read-only, otherwise the header promises an affordance the row doesn't have.
  // Translated head-word + the ' ✎' suffix appended separately, so the strip
  // below (and the /✎/ colour test) keeps working in every language.
  // Judul kolomnya dipegang dulu di satu variabel supaya colspan baris "tidak
  // ada yang cocok" di bawah ikut benar sendiri kalau kolomnya bertambah.
  const kepala = [
    tr({ id: 'Nopen', en: 'Nopen', zh: '报关单号' }),
    tr({ id: 'Tanggal', en: 'Date', zh: '日期' }),
    tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }),
    // Was literally 'USD'. The column holds the value in whatever currency the
    // document is denominated in, and the cell now prints the code next to it.
    tr({ id: 'Valuta', en: 'Currency', zh: '外币' }),
    tr({ id: 'Kurs', en: 'Rate', zh: '汇率' }),
    'IDR',
    tr({ id: 'Jalur', en: 'Lane', zh: '通道' }),
    tr({ id: 'Dok', en: 'Docs', zh: '单据' }),
    'SO ✎', 'JO ✎',
    tr({ id: 'Costing', en: 'Costing', zh: '成本核算' }) + ' ✎',
    'PO ERP INA ✎',
    tr({ id: 'Status', en: 'Status', zh: '状态' }) + ' ✎',
  ].map(c => (canWrite ? c : c.replace(' ✎', '')));
  const head = h('thead', h('tr', kepala
    // 3=Valuta, 4=Kurs, 5=IDR — all numeric, all right-aligned.
    .map((c, i) => h('th' + (i >= 3 && i <= 5 ? '.r' : ''), { style: /✎/.test(c) ? { color: 'var(--accent-tx)' } : {} }, c))));
  const body = h('tbody', hal.items.length ? hal.items.map(r => h('tr', {
    // Clicking a row pulls it back up into the parse panel, so the documents
    // attached to it (and their Drive links) are reachable again after the
    // import that created it has scrolled away. Editable cells stop the event
    // themselves, so clicking into SO/JO/Costing does not also fire this.
    style: { cursor: 'pointer' },
    onClick: (e) => {
      if (e.target.closest('input, select, button, a')) return;
      setUI({
        pkExtract: { name: `Nopen ${r.nopen}`, format: 'register', files: (r.files || []).map(f => ({ name: f.name, url: f.url })) },
        pkParsed: {
          nopen: r.nopen, ppkekDate: r.date, eta: r.eta, supplier: r.supplier,
          address: r.address, contractNo: r.contractNo, kursNDPBM: r.kurs,
          valuta: r.valuta || 'USD', valueForeign: r.usd, valueIDR: r.idr, asal: r.jalur,
        },
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }, [
    h('td.mono.cell-strong', r.nopen),
    h('td.mono', fmtDate(r.date)),
    h('td', r.supplier),
    // A row with no foreign value used to render a bare '—' with no hint why.
    // Now the code is always shown, so an unparsed amount reads as "CNY, amount
    // missing" rather than as "no amount".
    h('td.mono.r', r.usd ? `${r.valuta || 'USD'} ${num(r.usd, 2)}` : (r.valuta ? `${r.valuta} —` : '—')),
    // NDPBM was stored and only visible after clicking into the row. On screen
    // it is what makes the other two columns checkable at a glance: valuta
    // x kurs should be the IDR figure beside it.
    h('td.mono.r', r.kurs ? num(r.kurs, 2) : '—'),
    h('td.mono.r', num(r.idr)),
    h('td', badge(r.jalur, r.jalur === 'LDP' ? 'navy' : 'gray')),
    // How many documents from the bundle actually landed in Drive for this
    // nopen. A row showing 0 means the archive extracted but nothing uploaded —
    // worth noticing, and previously invisible from this screen.
    h('td.mono.r', { style: { fontSize: '11px', color: (r.files || []).length ? 'var(--text-2)' : 'var(--st-red-tx)' } }, String((r.files || []).length)),
    editCell(r, 'so', 84, canWrite), editCell(r, 'jo', 84, canWrite), editCell(r, 'costing', 84, canWrite), editCell(r, 'poErpIna', 96, canWrite),
    // `r.status || 'Open'` would have been a lie: a row whose status was never
    // filled in is NOT Open, it is unset. statusSelect() shows no selection for
    // those, so the read-only view must not invent one — this register is what
    // a monitoring account reads to decide what still needs costing.
    h('td', canWrite ? statusSelect(r) : (r.status
      ? badge(statusLabel(r.status), r.status === 'Closed' ? 'green' : r.status === 'Costed' ? 'blue' : 'gray')
      : h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, '—'))),
  ])) : barisTakCocok(kepala.length, { id: 'pkk', adaFilter: jumlahFilterAktif(nilai) > 0 }));
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', `${t('pk_register')} — ${new Date().getFullYear()}`),
      hitunganSaring(tersaring.length, rows.length, {
        id: 'dokumen', en: `document${rows.length === 1 ? '' : 's'}`, zh: '份单据',
      }),
      // Register ini berhalaman, jadi kunciHalaman wajib: menyaring 400 baris
      // jadi tiga sementara orangnya sedang di halaman 9 akan menampilkan
      // halaman kosong yang terbaca persis seperti "tidak ada hasil".
      tombolFilter({ id: 'pkk', medan, judul: t('pk_register'), kunciHalaman: 'pkPage' }),
      h('div.mla.row.gap8', [
        btn(t('pk_export'), { iconName: 'download', onClick: () => exportRegister() }),
        canWrite
          ? btn(t('pk_import'), { variant: 'primary', iconName: 'upload', onClick: () => importUpdates() })
          : badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' }),
      ]),
    ]),
    // maxHeight + overflowY: the register grows without limit, and a table taller
    // than the viewport pushed the page itself into a scroll the wheel could not
    // reach from inside the table. Bounded here so the wheel scrolls the rows.
    h('div.tbl-wrap', { style: { maxHeight: '58vh', overflowY: 'auto' } }, h('table.tbl', [head, body])),
    // Pager disembunyikan waktu tidak ada hasil: "Tampilkan 10 · kosong" di
    // bawah tabel yang sudah bilang tidak ada yang cocok cuma mengulang kabar
    // buruk dengan angka.
    tersaring.length ? pager(hal, { onPage: n => setUI({ pkPage: n }), onSize: n => setUI({ pkSize: n, pkPage: 1 }) }) : null,
    h('div.tbl-foot', t('pk_manual_note')),
  ]);
}

// Mirrors suratJalan.js's qtyInput lesson: mutate the row + DOM directly on
// every keystroke (no setState/setUI — mount() has no diffing and would drop
// characters mid-type or eat a blur-then-click), and only sync to Supabase
// on blur, once the value has settled.
function editCell(r, key, width = 84, canWrite = true) {
  // Plain text, not a disabled input: a greyed-out input still reads as "you
  // may type here once something unlocks", which is wrong for this account.
  if (!canWrite) {
    return h('td', { style: { padding: '4px 6px' } },
      h('span.mono', { style: { fontSize: '11px', color: r[key] ? 'var(--text)' : 'var(--text-3)' } }, r[key] || '—'));
  }
  const inp = h('input.cell-edit' + (r[key] ? '.filled' : ''), {
    value: r[key] || '', placeholder: '—', style: { width: width + 'px' },
    onInput: e => { r[key] = e.target.value; inp.classList.toggle('filled', !!e.target.value); },
    onBlur: e => commitPpkekField(r, key, e.target.value),
  });
  return h('td', { style: { padding: '4px 6px' } }, inp);
}
// Display text for a stored status. The VALUE in `value:`, in `r.status`, and
// in every === comparison stays exactly what Postgres holds; only the visible
// word changes with the language.
const STATUS_TEXT = {
  Open:   { id: 'Open',   en: 'Open',   zh: '未结'   },
  Costed: { id: 'Costed', en: 'Costed', zh: '已核算' },
  Closed: { id: 'Closed', en: 'Closed', zh: '已结'   },
};
function statusLabel(s) { return STATUS_TEXT[s] ? tr(STATUS_TEXT[s]) : s; }

function statusSelect(r) {
  const sel = h('select.input.mono', {
    style: { padding: '5px 7px', fontSize: '11px', width: 'auto' },
    onChange: e => { r.status = e.target.value; commitPpkekField(r, 'status', e.target.value); },
  }, ['Open', 'Costed', 'Closed'].map(o => h('option', { value: o, selected: r.status === o }, statusLabel(o))));
  return h('td', { style: { padding: '4px 6px' } }, sel);
}

async function commitPpkekField(r, key, value) {
  if (blockWrite('ubah register PPKEK')) return;
  try { await updatePpkek(r.id, { [key]: value }); }
  catch (e) {
    console.error('Supabase ppkek update failed', e);
    toast({
      id: `Gagal sync ${key} ke server: ` + (e.message || e),
      en: `Failed to sync ${key} to the server: ` + (e.message || e),
      zh: `${key} 同步到服务器失败：` + (e.message || e),
    });
  }
}

// Drop twenty bundles, get twenty bundles processed.
//
// The dropzone passed f[0] and nothing else, so a multi-file drop silently did
// one file and looked like a failure. The folder these arrive in holds ~22 at a
// time, which is the normal case, not the exotic one.
//
// SEQUENTIAL, deliberately. Each bundle uploads ~10 files through the Drive
// Edge Function and then writes a register row; running them concurrently would
// hammer that function and have several imports racing on the same register
// snapshot — the same shape of race that recorded one PO five times. Slow and
// correct is what was asked for ("kalo lama gpp").
async function handleArchives(list) {
  const all = Array.from(list || []);
  if (!all.length) return;
  if (blockWrite('import arsip PPKEK')) return;
  const st0 = getState();
  if (st0.ui.pkBatch && st0.ui.pkBatch.running) {
    toast({
      id: 'Masih memproses batch sebelumnya — tunggu selesai',
      en: 'Still processing the previous batch — wait for it to finish',
      zh: '仍在处理上一批 — 请等待完成',
    });
    return;
  }

  const archives = all.filter(f => /\.(rar|zip)$/i.test(f.name || ''));
  const skipped = all.length - archives.length;
  if (!archives.length) {
    toast({
      id: 'Tidak ada file RAR/ZIP di antara yang di-drop',
      en: 'No RAR/ZIP files among the ones dropped',
      zh: '拖入的文件中没有 RAR/ZIP 文件',
    });
    return;
  }

  const b = { total: archives.length, done: 0, doc: 0, docs: 0, current: '', phase: '', results: [], running: true, cancel: false };
  setUI({ pkBatch: b, pkDupe: null });

  // Closing the tab mid-run leaves bundles half-uploaded to Drive with no
  // register row — recoverable (re-drop updates in place) but confusing.
  const warn = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
  window.addEventListener('beforeunload', warn);

  try {
    for (const file of archives) {
      if (b.cancel) break;
      b.current = file.name; b.doc = 0; b.docs = 0; b.phase = 'mengekstrak…';
      setState({});
      try {
        const outcome = await processArchive(file, (done, total) => {
          b.doc = done; b.docs = total; b.phase = ''; setState({});
        });
        b.results.push({ file: file.name, ...outcome });
      } catch (e) {
        console.error('PPKEK bundle failed:', file.name, e);
        // One bad bundle must not take the other twenty-one with it.
        const raw = e.message || String(e);
        b.results.push({ file: file.name, mode: 'gagal', note: e && e.code === 'RAR_UNSUPPORTED'
          ? note3('RAR tidak didukung browser ini', 'RAR is not supported in this browser', '此浏览器不支持 RAR')
          : note3(raw, raw, raw) });
        // ...except this one: if the browser cannot do RAR at all, every
        // remaining RAR fails the same way, and twenty identical errors is worse
        // than one honest stop.
        if (e && e.code === 'RAR_UNSUPPORTED' && archives.slice(b.done + 1).every(f => /\.rar$/i.test(f.name))) {
          b.done++; b.cancel = true;
          toast({
            id: 'RAR belum bisa diekstrak di browser ini — unzip manual atau pakai .zip',
            en: 'RAR cannot be extracted in this browser yet — unzip manually or use .zip',
            zh: '此浏览器暂时无法解压 RAR — 请手动解压或改用 .zip',
          });
          break;
        }
      }
      b.done++;
      setState({});
    }
  } finally {
    window.removeEventListener('beforeunload', warn);
    b.running = false; b.current = ''; b.phase = '';
    setState({});
  }

  const n = (m) => b.results.filter(r => r.mode === m).length;
  const dupes = b.results.filter(r => r.mode === 'ulang' || r.mode === 'balapan');
  // A single drop keeps the exact wording it already had — that path is
  // verified and a one-file import should not suddenly read like a report.
  if (b.total === 1) {
    const r = b.results[0] || { mode: 'gagal', note: note3('tidak diproses', 'not processed', '未处理') };
    if (r.mode === 'ulang') toast({
      id: `Nopen ${r.nopen} SUDAH PERNAH DISUBMIT — baris diperbarui, tidak ditambah. ${r.docs} dokumen di Drive · SO/JO/Costing tidak diubah`,
      en: `Nopen ${r.nopen} WAS ALREADY SUBMITTED — row updated, not added. ${r.docs} documents in Drive · SO/JO/Costing untouched`,
      zh: `报关单号 ${r.nopen} 之前已提交过 — 已更新原有行，未新增。${r.docs} 份文件在 Drive · SO/JO/Costing 未改动`,
    });
    else if (r.mode === 'balapan') toast({
      id: `Nopen ${r.nopen} sudah ada di register (dimasukkan sesi lain) — refresh untuk melihatnya`,
      en: `Nopen ${r.nopen} is already in the register (added by another session) — refresh to see it`,
      zh: `报关单号 ${r.nopen} 已在登记册中（由其他会话录入）— 刷新后可见`,
    });
    else if (r.mode === 'baru') toast({
      id: `Nopen ${r.nopen} masuk register · ${r.docs} dokumen ke Drive`,
      en: `Nopen ${r.nopen} added to the register · ${r.docs} documents to Drive`,
      zh: `报关单号 ${r.nopen} 已加入登记册 · ${r.docs} 份文件已上传至 Drive`,
    });
    else if (r.mode === 'nonopen') toast({
      id: `Ekstraksi selesai — ${r.docs} dokumen, tapi nopen tidak terbaca sehingga tidak masuk register`,
      en: `Extraction complete — ${r.docs} documents, but the nopen could not be read so nothing entered the register`,
      zh: `解压完成 — ${r.docs} 份文件，但无法识别报关单号，未加入登记册`,
    });
    // Each language gets its own fallback AND its own copy of the note — the
    // toast is re-resolved on every render, so an Indonesian note pasted into
    // the en/zh variants would survive a language switch.
    else toast({
      id: `Gagal: ${r.file} — ${(r.note && r.note.id) || 'penyebab tidak diketahui'}`,
      en: `Failed: ${r.file} — ${(r.note && r.note.en) || 'unknown cause'}`,
      zh: `失败：${r.file} — ${(r.note && r.note.zh) || '原因不明'}`,
    });
    if (r.mode === 'ulang' || r.mode === 'balapan') setUI({ pkDupe: r, pkBatch: null });
    else setUI({ pkBatch: null });
    return;
  }
  const parts = [`${b.done}/${b.total} bundel`];
  if (n('baru')) parts.push(`${n('baru')} baru`);
  if (dupes.length) parts.push(`${dupes.length} sudah pernah disubmit`);
  if (n('nonopen')) parts.push(`${n('nonopen')} nopen tidak terbaca`);
  if (n('gagal')) parts.push(`${n('gagal')} gagal`);
  if (skipped) parts.push(`${skipped} file bukan arsip dilewati`);
  if (b.cancel) parts.push('DIBATALKAN');
  toast({
    id: parts.join(' · '),
    // Same conditions as `parts` above, rebuilt per language: the Indonesian
    // pieces are already composed by the time we get here.
    en: [
      `${b.done}/${b.total} bundles`,
      n('baru') && `${n('baru')} new`,
      dupes.length && `${dupes.length} already submitted`,
      n('nonopen') && `${n('nonopen')} nopen unreadable`,
      n('gagal') && `${n('gagal')} failed`,
      skipped && `${skipped} non-archive files skipped`,
      b.cancel && 'CANCELLED',
    ].filter(Boolean).join(' · '),
    zh: [
      `${b.done}/${b.total} 个压缩包`,
      n('baru') && `${n('baru')} 个新增`,
      dupes.length && `${dupes.length} 个之前已提交过`,
      n('nonopen') && `${n('nonopen')} 个报关单号无法识别`,
      n('gagal') && `${n('gagal')} 个失败`,
      skipped && `${skipped} 个非压缩文件已跳过`,
      b.cancel && '已取消',
    ].filter(Boolean).join(' · '),
  });
}

async function processArchive(file, onDoc) {
  const { files, format } = await extractArchive(file);
  // Upload each extracted file to Drive (graceful — see core/drive.js:
  // returns a drive-pending://... placeholder while useDrive=false, a real
  // webViewLink once Drive is configured, same call site either way).
  const year = new Date().getFullYear(), month = new Date().getMonth() + 1;
  const sppb = (file.name.match(/SPPB\s*(\d+)/i) || [])[1] || '000000';
  const shipment = (file.name.match(/\b(\d{2}ID\d{4})\b/i) || [])[1] || 'SHIP';
  const folder = ppkekFolder(year, month, sppb, shipment);
  const fileRecords = [];
  if (onDoc) onDoc(0, files.length);
  for (const f of files) {
    const up = await uploadToDrive(f, folder, f.name, 'PPKEK');
    f.url = up.url;
    // outboxId rides along on the record because the ppkek row does not exist
    // until every file in this bundle has been through here — and it is stripped
    // again before the array is written to the database (see addRegisterRow).
    fileRecords.push({ name: f.name, url: up.url, placeholder: !!up.placeholder, outboxId: up.outboxId || null });
    if (onDoc) onDoc(fileRecords.length, files.length);
  }
  // Parse the PPKEK PDF if present.
  const pdf = files.find(f => /ppkek/i.test(f.name) && /\.pdf$/i.test(f.name)) || files.find(f => /\.pdf$/i.test(f.name));
  let parsed = null;
  if (pdf) { try { parsed = await parsePpkekPdf(pdf); } catch (e) { console.warn(e); } }
  // Supplier + address come from the SPPB, not the PPKEK — see parseSppbPdf()
  // for why. Purely additive: if the SPPB is missing or unreadable the PPKEK
  // values stand, so a bundle without one behaves exactly as before.
  if (parsed) {
    const sppb = files.find(f => /sppb/i.test(f.name) && /\.pdf$/i.test(f.name));
    if (sppb) {
      try {
        const extra = await parseSppbPdf(sppb);
        if (extra.supplier) parsed.supplier = extra.supplier;
        if (extra.address) parsed.address = extra.address;
      } catch (e) { console.warn('SPPB parse skipped:', e); }
    }
  }
  // The parse panel keeps showing the LAST bundle of the run. Over a long
  // batch that panel is the least useful thing on screen anyway — the batch
  // card is what you watch — and leaving it on the final document means it
  // matches what the register just gained.
  setUI({ pkExtract: { name: file.name, format, files }, pkParsed: parsed });
  logAudit({ entity: 'ppkek', target: file.name, action: 'import', detail: `${files.length} docs (${format})` });
  // Announces nothing. handleArchives composes the message once, at the end —
  // otherwise twenty bundles would fire twenty toasts, each erasing the last,
  // and the only one anyone ever sees is the twentieth.
  if (parsed && parsed.nopen) {
    const outcome = await addRegisterRow(parsed, folder, fileRecords);
    if (outcome) return outcome;
    return { mode: 'gagal', nopen: parsed.nopen, docs: fileRecords.length, note: note3('gagal simpan ke server', 'failed to save to the server', '保存到服务器失败') };
  }
  return { mode: 'nonopen', docs: files.length };
}

// One nopen = one customs document = one register row, always.
//
// This used to INSERT unconditionally. Drop the same archive twice and the
// register grew a second identical row — which is exactly what happened when
// sekar re-dropped a bundle after seeing the parse come out wrong: four rows,
// same nopen 009444, same date, same figures. The same shape of hole that let
// CGDD2607200143 be recorded as five separate POs.
//
// Rejecting the re-import would be the wrong cure here. A nopen is assigned by
// Bea Cukai and is unique by construction, so a second import of it is not a
// mistake to block — it is the SAME document, usually re-dropped precisely
// because the first result looked wrong. So it UPDATES in place: parsed fields
// refresh, the Drive file list merges, and the manually typed columns (SO, JO,
// Costing, PO ERP INA, Status) are left completely alone — those are sekar's
// work and a re-import must never wipe them.
async function addRegisterRow(p, folder, files) {
  // The queue ids travel on the file records; the database gets the array
  // without them. Persisting a transient id would leave a pointer to a queue
  // entry that is deleted the moment the upload succeeds.
  const outboxIds = (files || []).map(f => f && f.outboxId).filter(Boolean);
  const cleanFiles = (files || []).map(f => ({ name: f.name, url: f.url, placeholder: !!f.placeholder }));
  if (blockWrite('tambah baris register PPKEK')) return;
  const st0 = getState();
  const norm = v => String(v == null ? '' : v).trim();
  const existing = (st0.ppkek || []).find(r => norm(r.nopen) && norm(r.nopen) === norm(p.nopen));
  if (existing) return updateRegisterRow(existing, p, folder, files);
  const local = {
    // Registration date FROM THE DOCUMENT, not the moment of import. The
    // register's TANGGAL column is "PPKEK Date" in the workbook — a fact about
    // the customs document, not about when someone got round to uploading it.
    // Falls back to now only when the document has no readable date.
    nopen: p.nopen, date: toIsoDate(p.ppkekDate) || new Date(), eta: toIsoDate(p.eta) || '', supplier: p.supplier || '—',
    address: p.address || '', invoiceNo: p.invoiceNo || '', plNo: p.plNo || '',
    // `p.valuta === 'USD' ? … : 0` threw the amount away for every document that
    // was not in dollars — a second reason nopen 010177 and 010242 showed an
    // empty column even once the parser could read them. The value is stored as
    // it was invoiced; `valuta` records in what.
    usd: p.valueForeign || 0, valuta: p.valuta || 'USD',
    idr: p.valueIDR, jalur: p.asal, contractNo: p.contractNo,
    kurs: p.kursNDPBM, ppkekNo: p.ppkekNo || '',
    // Item lines were parsed and thrown away at this exact point. The register
    // workbook is ONE ROW PER ITEM, so without them the export can never match.
    items: p.items || [],
    so: '', jo: '', costing: '', poErpIna: '', status: 'Open',
    driveFolder: folder, files: cleanFiles,
  };
  try {
    const saved = await insertPpkek(local);
    Object.assign(local, saved);
    // Every file of this bundle points home to the same row.
    for (const oid of outboxIds) await linkOutbox(oid, 'ppkek', saved.id, 'files');
  } catch (e) {
    console.error('Supabase ppkek insert failed', e);
    // Lost the race: another session inserted this same nopen between our check
    // and our write. Not an error the user did anything about — the document IS
    // in the register, just not in the copy this tab is holding.
    if (duplicateNopen(e)) {
      return { mode: 'balapan', nopen: local.nopen, docs: (files || []).length };
    }
    // Returned, not toasted: in a batch of twenty this would be erased by the
    // next bundle's message a few seconds later. handleArchives keeps it in the
    // result list, where it stays readable after the run.
    const raw = e.message || e;
    return { mode: 'gagal', nopen: local.nopen, docs: (files || []).length, note: note3('gagal simpan ke server: ' + raw, 'failed to save to the server: ' + raw, '保存到服务器失败：' + raw) };
  }
  if (!local.id) local.id = uid('pk'); // demo mode: insertPpkek no-ops, keep a local id
  const st = getState();
  st.ppkek.unshift(local);
  setState({});
  return { mode: 'baru', nopen: local.nopen, docs: (files || []).length };
}

// Re-import of a nopen already in the register.
async function updateRegisterRow(row, p, folder, files) {
  // Merge Drive files by name so a re-drop doesn't duplicate the list, and a
  // bundle that carried an extra document the first time isn't lost.
  const byName = new Map((row.files || []).map(f => [f.name, f]));
  for (const f of (files || [])) byName.set(f.name, f);
  const merged = [...byName.values()];

  // Parsed fields only. so/jo/costing/poErpIna/status/receivedDate are typed by
  // hand and are deliberately NOT in this list.
  const patch = {
    date: toIsoDate(p.ppkekDate) || row.date, eta: toIsoDate(p.eta) || row.eta, supplier: p.supplier || row.supplier,
    address: p.address || row.address, invoiceNo: p.invoiceNo || row.invoiceNo,
    plNo: p.plNo || row.plNo, contractNo: p.contractNo || row.contractNo,
    usd: p.valueForeign || row.usd, valuta: p.valuta || row.valuta || 'USD',
    idr: p.valueIDR || row.idr, kurs: p.kursNDPBM || row.kurs,
    ppkekNo: p.ppkekNo || row.ppkekNo,
    items: (p.items && p.items.length) ? p.items : row.items,
    jalur: p.asal || row.jalur, driveFolder: folder || row.driveFolder, files: merged,
  };
  Object.assign(row, patch);
  try {
    await updatePpkek(row.id, patch);
  } catch (e) {
    console.error('Supabase ppkek update failed', e);
    setState({});
    const raw = e.message || e;
    return { mode: 'gagal', nopen: row.nopen, docs: merged.length, note: note3('diperbarui lokal, gagal sync ke server: ' + raw, 'updated locally, failed to sync to the server: ' + raw, '已本地更新，同步到服务器失败：' + raw) };
  }
  setState({});
  return { mode: 'ulang', nopen: row.nopen, docs: merged.length };
}

async function exportRegister() {
  const st = getState();
  // Header fields repeat on every one of a document's item rows — that is how
  // the workbook does it, and it is what makes the sheet filterable per item.
  const itemRows = (r) => {
    const items = (r.items && r.items.length) ? r.items : [null];
    return items.map(it => [
      r.nopen, fmtDate(r.date), r.eta ? fmtDate(r.eta) : '', r.contractNo || '-',
      it ? (it.name || '') : '', it ? (it.code || '') : '',
      r.supplier, r.address || '', r.invoiceNo || '',
      it ? (it.price || '') : '', it ? (it.amount || '') : '',
      r.valuta || 'USD', r.kurs || '',
      r.ppn || '',
      it ? [it.qty || '', it.unit || ''].filter(Boolean).join(' ') : '',
      r.plNo || '', r.ppkekNo || '', r.status,
      r.so, r.jo, r.costing, r.poErpIna, r.receivedDate || '', r.id,
    ]);
  };
  const toAoa = (rows) => [REPORT_COLS, ...rows.flatMap(itemRows)];
  const ldp = st.ppkek.filter(r => r.jalur === 'LDP');
  const tlddp = st.ppkek.filter(r => r.jalur === 'TLDDP');
  const hyperlinks = [];
  // Live Drive hyperlink example in the Nopen cell where a Drive folder exists.
  // `A${i + 2}` assumed one sheet row per document. The export became one row
  // per ITEM, so from the first document carrying two goods lines every
  // hyperlink after it pointed at the wrong nopen — a link that opens someone
  // else's folder is worse than no link.
  [{ name: 'LDP', rows: ldp }, { name: 'TLDDP', rows: tlddp }].forEach(tab => {
    let line = 2;                                   // row 1 is the header
    tab.rows.forEach((r) => {
      const span = (r.items && r.items.length) ? r.items.length : 1;
      if (r.driveFolder) hyperlinks.push({ sheet: tab.name, cell: `A${line}`, url: driveUrlOf(r), text: r.nopen });
      line += span;
    });
  });
  // "LIST PPKEK 31072026 14-12-05.xlsx" — date then time, so two exports on the
  // same day sort next to each other and never overwrite one another in
  // Downloads. Colons are illegal in a Windows filename, hence the dashes.
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${p2(now.getDate())}${p2(now.getMonth() + 1)}${now.getFullYear()} ${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`;
  await writeWorkbook(`LIST PPKEK ${stamp}.xlsx`, [
    { name: 'LDP', aoa: toAoa(ldp) }, { name: 'TLDDP', aoa: toAoa(tlddp) },
  ], hyperlinks);
  toast({
    id: 'Export Excel (2-tab LDP/TLDDP + hidden row-ID) — hyperlink Drive aktif',
    en: 'Excel exported (2-tab LDP/TLDDP + hidden row-ID) — Drive hyperlinks live',
    zh: '已导出 Excel（LDP/TLDDP 双工作表 + 隐藏行 ID）— Drive 超链接有效',
  });
}
function driveUrlOf(r) { return r.driveUrl && !r.driveUrl.startsWith('drive-') ? r.driveUrl : 'https://drive.google.com/'; }

async function importUpdates() {
  if (blockWrite('import update register PPKEK')) return;
  const files = await pickFiles({ accept: '.xlsx,.xls' });
  if (!files || !files[0]) return;
  toast(t('loading'));
  try {
    const wb = await readWorkbook(files[0]);
    const changes = [];
    const missingHeaders = [];
    const unknownRows = [];
    const st = getState();
    for (const sheet of wb.sheetNames) {
      const rows = wb.rows(sheet);
      if (!rows.length) continue;
      const header = rows[0].map(h => String(h ?? '').trim());
      const at = (title) => header.indexOf(title);
      const idIdx = at('__ROWID');
      if (idIdx < 0) continue;
      const nopenIdx = at('Nopen');
      // Columns located by NAME. A column that is not in the file is simply not
      // compared — better than reading whatever happens to sit at that index.
      const cols = Object.entries(IMPORT_FIELDS)
        .map(([title, key]) => ({ title, key, idx: at(title) }))
        .filter(c => c.idx >= 0);
      if (!cols.length) {
        missingHeaders.push(sheet);
        continue;
      }
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]; const id = row[idIdx];
        const existing = st.ppkek.find(r => r.id === id);
        const nopen = nopenIdx >= 0 ? row[nopenIdx] : '';
        // A row whose __ROWID matches nothing is a row this register has never
        // seen. Adding it from a spreadsheet would mean inventing a customs
        // document from typed cells, with no PDF behind it — so it is reported,
        // not created. Import them by dropping the bundle.
        if (!existing) { unknownRows.push(nopen || `(baris ${i + 1})`); continue; }
        for (const c of cols) {
          const nv = String(row[c.idx] ?? '').trim(); const ov = String(existing[c.key] ?? '').trim();
          if (nv !== ov) changes.push({ type: 'update', id, nopen, label: c.title, key: c.key, old: ov || '—', neu: nv || '—' });
        }
      }
    }
    // Nothing recognised at all is a wrong-file mistake, and it used to look
    // identical to "no changes found".
    if (!changes.length && missingHeaders.length) {
      toast({
        id: `File ini tidak punya kolom SO/JO/Costing/Status — pastikan yang di-import adalah hasil Export Excel dari layar ini`,
        en: `This file has no SO/JO/Costing/Status columns — import the file produced by Export Excel on this screen`,
        zh: '该文件没有 SO/JO/Costing/Status 列 — 请导入本页“导出 Excel”生成的文件',
      });
      return;
    }
    setUI({ pkDiff: { changes, file: files[0].name, unknownRows } });
  } catch (e) {
    console.error(e);
    toast({ id: 'Import gagal: ' + e.message, en: 'Import failed: ' + e.message, zh: '导入失败：' + e.message });
  }
}

// Diff-row field names. Display only — the change is written through c.key,
// and the header words the workbook uses (c.label) are untouched.
const FIELD_TEXT = {
  Costing: { id: 'Costing', en: 'Costing', zh: '成本核算' },
  Status: { id: 'Status', en: 'Status', zh: '状态' },
};
function fieldLabel(l) { return FIELD_TEXT[l] ? tr(FIELD_TEXT[l]) : l; }

function diffModal() {
  const st = getState(); const d = st.ui.pkDiff;
  const updates = d.changes.filter(c => c.type === 'update');
  // No 'new' change is produced any more — see importUpdates(). Rows whose
  // __ROWID matches nothing are reported, not created: a customs document with
  // no PDF behind it is not something a spreadsheet should be able to invent.
  const unknown = d.unknownRows || [];
  const rowsEl = d.changes.map(c =>
    h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1px', background: 'var(--border)' } }, [
        h('div', { style: { background: 'var(--surface)', padding: '9px 11px' } }, [h('div.mono', { style: { fontSize: '11px', fontWeight: 700 } }, c.nopen), h('div', { style: { fontSize: '10px', color: 'var(--text-3)' } }, fieldLabel(c.label))]),
        h('div.mono', { style: { background: 'var(--surface)', padding: '9px 11px', fontSize: '11px', color: 'var(--text-3)', textDecoration: 'line-through' } }, c.old),
        h('div.mono', { style: { background: 'var(--st-green-bg)', padding: '9px 11px', fontSize: '11px', fontWeight: 700, color: 'var(--st-green-tx)' } }, c.neu),
      ]));
  return modal({
    title: t('pk_diff_title'), subtitle: tr({
      id: `${d.file} · ${d.changes.length} perubahan`,
      en: `${d.file} · ${d.changes.length} change${d.changes.length === 1 ? '' : 's'}`,
      zh: `${d.file} · ${d.changes.length} 项更改`,
    }), width: 600, onClose: () => setUI({ pkDiff: null }),
    body: [
      h('div.row.gap8', { style: { fontSize: '11px' } }, [
        badge(tr({ id: `${updates.length} update`, en: `${updates.length} update${updates.length === 1 ? '' : 's'}`, zh: `${updates.length} 项更新` }), 'green'),
        unknown.length ? badge(tr({
          id: `${unknown.length} baris tidak dikenal — dilewati`,
          en: `${unknown.length} unknown row${unknown.length === 1 ? '' : 's'} — skipped`,
          zh: `${unknown.length} 行无法识别 — 已跳过`,
        }), 'amber') : null,
      ]),
      h('div', { style: { border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' } }, [
        h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1px', background: 'var(--border)' } }, [tr({ id: 'Nopen · Field', en: 'Nopen · Field', zh: '报关单号 · 字段' }), t('pk_old'), t('pk_new')].map(x => h('div', { style: { background: 'var(--surface2)', padding: '7px 11px', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' } }, x))),
        ...rowsEl,
      ]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ pkDiff: null }) }), btn(`${t('pk_apply_changes')} (${d.changes.length})`, { variant: 'primary', onClick: () => applyDiff() })],
  });
}

async function applyDiff() {
  if (blockWrite('terapkan perubahan register PPKEK')) return;
  const st = getState(); const d = st.ui.pkDiff;
  // Every change is an update to a row that already exists. The old else-branch
  // INSERTED a register row built from spreadsheet cells, which is how a customs
  // document with no PDF behind it could enter the register.
  for (const c of d.changes) {
    {
      const r = st.ppkek.find(x => x.id === c.id);
      if (!r) continue;
      const value = c.neu === '—' ? '' : c.neu;
      r[c.key] = value;
      try { await updatePpkek(c.id, { [c.key]: value }); }
      catch (e) {
        console.error('Supabase ppkek update failed', e);
        toast({
          id: `Gagal sync ${c.nopen} ke server: ` + (e.message || e),
          en: `Failed to sync ${c.nopen} to the server: ` + (e.message || e),
          zh: `${c.nopen} 同步到服务器失败：` + (e.message || e),
        });
      }
    }
  }
  logAudit({ entity: 'ppkek', target: d.file, action: 'import_apply', detail: `${d.changes.length} changes` });
  setUI({ pkDiff: null });
  toast({
    id: `${d.changes.length} perubahan diterapkan ke register PPKEK`,
    en: `${d.changes.length} changes applied to the PPKEK register`,
    zh: `${d.changes.length} 项更改已应用到 PPKEK 登记册`,
  });
}
