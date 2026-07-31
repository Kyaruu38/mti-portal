import { h, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal } from '../ui/components.js';
import { extractArchive } from '../parsers/archive.js';
import { parsePpkekPdf, parseSppbPdf } from '../parsers/ppkekPdf.js';
import { uploadToDrive, ppkekFolder } from '../core/drive.js';
import { readWorkbook, writeWorkbook, colLetter } from '../core/xlsx.js';
import { num, fmtDate } from '../core/format.js';
import { insertPpkek, updatePpkek } from '../core/ppkekApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';

// Report/register column order (2-tab LDP/TLDDP layout, from PPKEK DECEMBER.xlsx).
const REPORT_COLS = ['Nopen', 'PPKEK Date', 'Contract No.', 'Suplier Name', 'USD', 'IDR', 'Jalur', 'SO', 'JO', 'Costing', 'PO ERP INA NO.', 'PPKEK Status', 'Tanggal Aktual Diterima', '__ROWID'];

export function ppkekScreen() {
  const st = getState(); const ui = st.ui;
  // ppkekWrite, mirroring the ppkek_rw policy (wilbert + sekar). This screen had
  // no capability check at all, and its riskiest write is not a button: every
  // register row carries four inline inputs and a status dropdown that commit on
  // blur/change, which is easy to miss when auditing a screen for buttons.
  const canWrite = can(st.user.role, 'ppkekWrite');

  const dz = dropzone({
    title: t('pk_drop'), sub: t('pk_drop_sub'), accept: '.rar,.zip', iconName: 'box', compact: true,
    onFiles: f => handleArchive(f[0]),
    disabled: !canWrite,
    disabledNote: 'Register PPKEK cuma bisa dilihat dari akun ini',
  });

  const extractCard = ui.pkExtract ? extractStatus(ui.pkExtract) : card([h('div.card-pad', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '150px' } }, [h('div.card-title', 'Hasil Ekstraksi'), h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' } }, 'Drop RAR/ZIP untuk mengekstrak & parse dokumen kepabeanan.')])]);

  const parsedCard = ui.pkParsed ? parsedInfo(ui.pkParsed) : card([h('div.card-pad', { style: { minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span', { style: { fontSize: '12px', color: 'var(--text-3)' } }, 'Belum ada PPKEK diparse'))]);

  const top = h('div.grid', { style: { gridTemplateColumns: '1fr 1fr 1.25fr' } }, [dz, extractCard, parsedCard]);

  const register = registerTable(st, canWrite);

  return h('div.stack', [top, register, ui.pkDiff ? diffModal() : null]);
}

function extractStatus(ex) {
  return card([
    h('div.card-pad', [
      h('div.row.gap8', [
        h('span', { style: { width: '32px', height: '32px', borderRadius: '8px', background: 'var(--navy-soft)', color: 'var(--navy-soft-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800 } }, (ex.format || 'ZIP').toUpperCase()),
        h('div.grow', [h('div.mono', { style: { fontSize: '12px', fontWeight: 700 } }, ex.name), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, `${ex.files.length} dokumen`)]),
      ]),
      h('div', { style: { height: '7px', borderRadius: '999px', background: 'var(--surface3)', marginTop: '14px', overflow: 'hidden' } }, h('div', { style: { width: '100%', height: '100%', background: 'var(--st-green-tx)' } })),
      h('div.row', { style: { justifyContent: 'space-between', marginTop: '7px' } }, [h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } }, t('pk_extract_done')), h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${ex.files.length}/${ex.files.length}`)]),
      h('div', { style: { borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '9px', display: 'flex', flexDirection: 'column', gap: '5px' } }, ex.files.map(f => h('div.row.gap8', { style: { fontSize: '11px', color: 'var(--text-2)' } }, [icon('check', 11, { stroke: 'var(--st-green-tx)', strokeWidth: 2.5 }), h('span.grow', f.name), h('a.link', { href: f.url && !f.url.startsWith('drive-') ? f.url : null, target: '_blank', onClick: e => { if (!f.url || f.url.startsWith('drive-')) e.preventDefault(); } }, 'Drive ↗')]))),
    ]),
  ]);
}

function parsedInfo(p) {
  return card([
    h('div.card-pad', [
      h('div.row.gap8', { style: { marginBottom: '11px' } }, [badge('PARSED', 'green'), h('span.mono', { style: { fontSize: '12.5px', fontWeight: 700 } }, `Nopen ${p.nopen || '—'}`), h('div.mla.row.gap8', [badge(p.asal, 'navy'), badge('Fasilitas KEK', 'green')])]),
      h('div.grid.g2', { style: { gap: '9px 16px' } }, [
        kv('Tgl Pendaftaran', p.ppkekDate || '—'), kv('Supplier', p.supplier || '—'),
        kv('Kurs NDPBM', p.kursNDPBM ? num(p.kursNDPBM) : '—'), kv('Nilai ' + p.valuta, p.valueForeign ? num(p.valueForeign, 2) : '—'),
        kv('Nilai IDR', p.valueIDR ? num(p.valueIDR) : '—'), kv('No. Kontrak', p.contractNo || '—'),
      ]),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', borderTop: '1px dashed var(--border)', marginTop: '11px', paddingTop: '9px' } }, 'Nilai IDR = CIF × kurs NDPBM tanggal pendaftaran'),
    ]),
  ]);
}
function kv(l, v) { return h('div', [h('div', { style: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)' } }, l), h('div.mono', { style: { fontSize: '12px', marginTop: '2px', color: 'var(--text)' } }, v)]); }

function registerTable(st, canWrite) {
  const rows = st.ppkek;
  // The pencil marks mean "you can edit this". Strip them when the cells are
  // read-only, otherwise the header promises an affordance the row doesn't have.
  const head = h('thead', h('tr', ['Nopen', 'Tanggal', 'Supplier', 'USD', 'IDR', 'Jalur', 'Dok', 'SO ✎', 'JO ✎', 'Costing ✎', 'PO ERP INA ✎', 'Status ✎']
    .map(c => (canWrite ? c : c.replace(' ✎', '')))
    .map((c, i) => h('th' + (i === 3 || i === 4 ? '.r' : ''), { style: /✎/.test(c) ? { color: 'var(--accent-tx)' } : {} }, c))));
  const body = h('tbody', rows.map(r => h('tr', [
    h('td.mono.cell-strong', r.nopen),
    h('td.mono', fmtDate(r.date)),
    h('td', r.supplier),
    h('td.mono.r', r.usd ? num(r.usd, 2) : '—'),
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
      ? badge(r.status, r.status === 'Closed' ? 'green' : r.status === 'Costed' ? 'blue' : 'gray')
      : h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, '—'))),
  ])));
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', `${t('pk_register')} — ${new Date().getFullYear()}`),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, [h('span.mono', String(rows.length)), ' dokumen']),
      h('div.mla.row.gap8', [
        btn(t('pk_export'), { iconName: 'download', onClick: () => exportRegister() }),
        canWrite
          ? btn(t('pk_import'), { variant: 'primary', iconName: 'upload', onClick: () => importUpdates() })
          : badge('Read-only', 'gray', { iconName: 'eye' }),
      ]),
    ]),
    h('div.tbl-wrap', h('table.tbl', [head, body])),
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
function statusSelect(r) {
  const sel = h('select.input.mono', {
    style: { padding: '5px 7px', fontSize: '11px', width: 'auto' },
    onChange: e => { r.status = e.target.value; commitPpkekField(r, 'status', e.target.value); },
  }, ['Open', 'Costed', 'Closed'].map(o => h('option', { value: o, selected: r.status === o }, o)));
  return h('td', { style: { padding: '4px 6px' } }, sel);
}

async function commitPpkekField(r, key, value) {
  if (blockWrite('ubah register PPKEK')) return;
  try { await updatePpkek(r.id, { [key]: value }); }
  catch (e) { console.error('Supabase ppkek update failed', e); toast(`Gagal sync ${key} ke server: ` + (e.message || e)); }
}

async function handleArchive(file) {
  if (!file) return;
  if (blockWrite('import arsip PPKEK')) return;
  toast(t('loading'));
  try {
    const { files, format } = await extractArchive(file);
    // Upload each extracted file to Drive (graceful — see core/drive.js:
    // returns a drive-pending://... placeholder while useDrive=false, a real
    // webViewLink once Drive is configured, same call site either way).
    const year = new Date().getFullYear(), month = new Date().getMonth() + 1;
    const sppb = (file.name.match(/SPPB\s*(\d+)/i) || [])[1] || '000000';
    const shipment = (file.name.match(/\b(\d{2}ID\d{4})\b/i) || [])[1] || 'SHIP';
    const folder = ppkekFolder(year, month, sppb, shipment);
    const fileRecords = [];
    for (const f of files) {
      const up = await uploadToDrive(f, folder, f.name, 'PPKEK');
      f.url = up.url;
      fileRecords.push({ name: f.name, url: up.url, placeholder: !!up.placeholder });
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
    setUI({ pkExtract: { name: file.name, format, files }, pkParsed: parsed });
    if (parsed && parsed.nopen) await addRegisterRow(parsed, folder, fileRecords);
    logAudit({ entity: 'ppkek', target: file.name, action: 'import', detail: `${files.length} docs (${format})` });
    toast(`Ekstraksi ${format.toUpperCase()} selesai — ${files.length} dokumen`);
  } catch (e) {
    if (e.code === 'RAR_UNSUPPORTED') { toast('RAR belum bisa diekstrak di browser ini — unzip manual atau gunakan .zip'); return; }
    console.error(e); toast('Ekstraksi gagal: ' + e.message);
  }
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
  if (blockWrite('tambah baris register PPKEK')) return;
  const st0 = getState();
  const norm = v => String(v == null ? '' : v).trim();
  const existing = (st0.ppkek || []).find(r => norm(r.nopen) && norm(r.nopen) === norm(p.nopen));
  if (existing) return updateRegisterRow(existing, p, folder, files);
  const local = {
    nopen: p.nopen, date: new Date(), eta: p.eta || '', supplier: p.supplier || '—',
    address: p.address || '', invoiceNo: p.invoiceNo || '', plNo: p.plNo || '',
    usd: p.valuta === 'USD' ? p.valueForeign : 0, idr: p.valueIDR, jalur: p.asal, contractNo: p.contractNo,
    kurs: p.kursNDPBM, so: '', jo: '', costing: '', poErpIna: '', status: 'Open',
    driveFolder: folder, files: files || [],
  };
  try {
    const saved = await insertPpkek(local);
    Object.assign(local, saved);
  } catch (e) {
    console.error('Supabase ppkek insert failed', e);
    toast('PPKEK terparse tapi gagal simpan ke server: ' + (e.message || e));
    return;
  }
  if (!local.id) local.id = uid('pk'); // demo mode: insertPpkek no-ops, keep a local id
  const st = getState();
  st.ppkek.unshift(local);
  setState({});
  toast(`Nopen ${local.nopen} masuk register · ${(files || []).length} dokumen ke Drive`);
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
    eta: p.eta || row.eta, supplier: p.supplier || row.supplier,
    address: p.address || row.address, invoiceNo: p.invoiceNo || row.invoiceNo,
    plNo: p.plNo || row.plNo, contractNo: p.contractNo || row.contractNo,
    usd: p.valuta === 'USD' ? p.valueForeign : row.usd,
    idr: p.valueIDR || row.idr, kurs: p.kursNDPBM || row.kurs,
    jalur: p.asal || row.jalur, driveFolder: folder || row.driveFolder, files: merged,
  };
  Object.assign(row, patch);
  try {
    await updatePpkek(row.id, patch);
  } catch (e) {
    console.error('Supabase ppkek update failed', e);
    toast('Data diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e));
    setState({});
    return;
  }
  setState({});
  toast(`Nopen ${row.nopen} SUDAH ADA — baris diperbarui, tidak ditambah. ${merged.length} dokumen di Drive · SO/JO/Costing tidak diubah`);
}

async function exportRegister() {
  const st = getState();
  const toAoa = (rows) => [REPORT_COLS, ...rows.map(r => [r.nopen, fmtDate(r.date), r.contractNo || '-', r.supplier, r.usd || '', r.idr, r.jalur, r.so, r.jo, r.costing, r.poErpIna, r.status, r.receivedDate || '', r.id])];
  const ldp = st.ppkek.filter(r => r.jalur === 'LDP');
  const tlddp = st.ppkek.filter(r => r.jalur === 'TLDDP');
  const hyperlinks = [];
  // Live Drive hyperlink example in the Nopen cell where a Drive folder exists.
  [{ name: 'LDP', rows: ldp }, { name: 'TLDDP', rows: tlddp }].forEach(tab => {
    tab.rows.forEach((r, i) => { if (r.driveFolder) hyperlinks.push({ sheet: tab.name, cell: `A${i + 2}`, url: driveUrlOf(r), text: r.nopen }); });
  });
  await writeWorkbook(`PPKEK_${new Date().getFullYear()}.xlsx`, [
    { name: 'LDP', aoa: toAoa(ldp) }, { name: 'TLDDP', aoa: toAoa(tlddp) },
  ], hyperlinks);
  toast('Export Excel (2-tab LDP/TLDDP + hidden row-ID) — hyperlink Drive aktif');
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
    const st = getState();
    for (const sheet of wb.sheetNames) {
      const rows = wb.rows(sheet);
      if (!rows.length) continue;
      const header = rows[0];
      const idIdx = header.indexOf('__ROWID');
      if (idIdx < 0) continue;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]; const id = row[idIdx];
        const existing = st.ppkek.find(r => r.id === id);
        const nopen = row[0];
        if (!existing) {
          changes.push({ type: 'new', nopen, fields: { supplier: row[3], usd: row[4], idr: row[5], jalur: row[6] } });
          continue;
        }
        [['SO', 'so', 7], ['JO', 'jo', 8], ['Costing', 'costing', 9], ['PO ERP INA', 'poErpIna', 10], ['Status', 'status', 11]].forEach(([label, key, idx]) => {
          const nv = String(row[idx] ?? '').trim(); const ov = String(existing[key] ?? '').trim();
          if (nv !== ov) changes.push({ type: 'update', id, nopen, label, key, old: ov || '—', neu: nv || '—' });
        });
      }
    }
    setUI({ pkDiff: { changes, file: files[0].name } });
  } catch (e) { console.error(e); toast('Import gagal: ' + e.message); }
}

function diffModal() {
  const st = getState(); const d = st.ui.pkDiff;
  const updates = d.changes.filter(c => c.type === 'update');
  const news = d.changes.filter(c => c.type === 'new');
  const rowsEl = d.changes.map(c => c.type === 'update'
    ? h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1px', background: 'var(--border)' } }, [
        h('div', { style: { background: 'var(--surface)', padding: '9px 11px' } }, [h('div.mono', { style: { fontSize: '11px', fontWeight: 700 } }, c.nopen), h('div', { style: { fontSize: '10px', color: 'var(--text-3)' } }, c.label)]),
        h('div.mono', { style: { background: 'var(--surface)', padding: '9px 11px', fontSize: '11px', color: 'var(--text-3)', textDecoration: 'line-through' } }, c.old),
        h('div.mono', { style: { background: 'var(--st-green-bg)', padding: '9px 11px', fontSize: '11px', fontWeight: 700, color: 'var(--st-green-tx)' } }, c.neu),
      ])
    : h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1px', background: 'var(--border)' } }, [
        h('div', { style: { background: 'var(--surface)', padding: '9px 11px' } }, [h('div.mono', { style: { fontSize: '11px', fontWeight: 700 } }, c.nopen), h('div', { style: { fontSize: '10px', color: 'var(--accent-tx)', fontWeight: 700 } }, 'baris baru')]),
        h('div', { style: { background: 'var(--surface)', padding: '9px 11px', fontSize: '11px', color: 'var(--text-3)' } }, '—'),
        h('div.mono', { style: { background: 'var(--accent-soft)', padding: '9px 11px', fontSize: '11px', fontWeight: 700, color: 'var(--accent-tx)' } }, `${c.fields.supplier || ''}`),
      ]));
  return modal({
    title: t('pk_diff_title'), subtitle: `${d.file} · ${d.changes.length} perubahan`, width: 600, onClose: () => setUI({ pkDiff: null }),
    body: [
      h('div.row.gap8', { style: { fontSize: '11px' } }, [badge(`${updates.length} update`, 'green'), badge(`${news.length} baris baru`, 'accent')]),
      h('div', { style: { border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' } }, [
        h('div', { style: { display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '1px', background: 'var(--border)' } }, ['Nopen · Field', t('pk_old'), t('pk_new')].map(x => h('div', { style: { background: 'var(--surface2)', padding: '7px 11px', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)' } }, x))),
        ...rowsEl,
      ]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ pkDiff: null }) }), btn(`${t('pk_apply_changes')} (${d.changes.length})`, { variant: 'primary', onClick: () => applyDiff() })],
  });
}

async function applyDiff() {
  if (blockWrite('terapkan perubahan register PPKEK')) return;
  const st = getState(); const d = st.ui.pkDiff;
  for (const c of d.changes) {
    if (c.type === 'update') {
      const r = st.ppkek.find(x => x.id === c.id);
      if (!r) continue;
      const value = c.neu === '—' ? '' : c.neu;
      r[c.key] = value;
      try { await updatePpkek(c.id, { [c.key]: value }); }
      catch (e) { console.error('Supabase ppkek update failed', e); toast(`Gagal sync ${c.nopen} ke server: ` + (e.message || e)); }
    } else {
      const local = { nopen: c.nopen, date: new Date(), supplier: c.fields.supplier || '—', usd: Number(c.fields.usd) || 0, idr: Number(c.fields.idr) || 0, jalur: c.fields.jalur || 'LDP', so: '', jo: '', costing: '', poErpIna: '', status: 'Open', files: [] };
      try { const saved = await insertPpkek(local); Object.assign(local, saved); }
      catch (e) { console.error('Supabase ppkek insert failed', e); toast(`Gagal simpan baris baru ${c.nopen}: ` + (e.message || e)); continue; }
      if (!local.id) local.id = uid('pk'); // demo mode: insertPpkek no-ops, keep a local id
      st.ppkek.push(local);
    }
  }
  logAudit({ entity: 'ppkek', target: d.file, action: 'import_apply', detail: `${d.changes.length} changes` });
  setUI({ pkDiff: null });
  toast(`${d.changes.length} perubahan diterapkan ke register PPKEK`);
}
