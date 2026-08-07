import { h, wireDrop, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, poNoField, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { readWorkbook } from '../core/xlsx.js';
import { parseLabelSheet } from '../parsers/excelLabels.js';
import { money, num, ppnFor, ppnModeFromForm, fmtDateTime } from '../core/format.js';
import { can } from '../auth/roles.js';
import { statusText } from '../core/statusText.js';
import { insertLabelRequest, updateLabelRequest } from '../core/labelRequestsApi.js';
import { insertPO, newLineId, duplicatePoNumber } from '../core/posApi.js';
import { blockWrite } from '../core/guard.js';
import { UUID_RE } from '../core/supabase.js';

export function labelRequestScreen() {
  const st = getState();
  const ui = st.ui;
  const step = ui.labelStep || 1;

  const stepsBar = h('div.card', { style: { padding: '13px 18px' } }, h('div.steps', [
    stepEl(1, t('lr_step_upload'), step), h('div.step-sep'),
    stepEl(2, t('lr_step_sheet'), step), h('div.step-sep'),
    stepEl(3, t('lr_step_preview'), step),
    ui.labelFile ? h('div.mla.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, ui.labelFile) : null,
  ]));

  let content;
  if (step === 1) content = step1();
  else if (step === 2) content = step2();
  else content = step3();

  return h('div.stack', [incomingRequests(st), myRequests(st), stepsBar, content, ui.poModal ? poModal() : null]);
}

function stepEl(n, label, cur) {
  const cls = cur === n ? '.active' : cur > n ? '.done' : '';
  return h('div.step' + cls, { onClick: () => setUI({ labelStep: n }) }, [h('span.circle', String(n)), h('span.lbl', label)]);
}

function step1() {
  const st = getState();
  // labelParse: reading a label Excel rewrites the ITEM MASTER via upsertItems()
  // and appends an upload batch, so it is a write even though nothing is sent to
  // Supabase on this step.
  const canParse = can(st.user.role, 'labelParse');
  const dz = dropzone({
    title: t('lr_drop'), sub: t('lr_or_browse'), accept: '.xls,.xlsx', iconName: 'upload',
    onFiles: (files) => handleFile(files[0]),
    disabled: !canParse,
    disabledNote: tr({
      id: 'Upload label dipegang purchasing — akun ini cuma lihat riwayat',
      en: 'Label uploads belong to purchasing — this account only sees the history',
      zh: '标签上传由采购负责 — 此账号仅可查看历史记录',
    }),
  });
  return card([
    h('div.card-pad', [
      duaPintu(st),
      dz,
      st.labelBatches.length ? h('div', { style: { marginTop: '18px' } }, [
        h('div.field-label', tr({ id: 'Upload Terakhir', en: 'Recent Uploads', zh: '最近上传' })),
        ...st.labelBatches.slice(0, 4).map(b => h('div.row.gap12', { style: { padding: '10px 0', borderTop: '1px solid var(--border)' } }, [
          h('span', { style: { width: '32px', height: '32px', borderRadius: '8px', background: 'var(--st-green-bg)', color: 'var(--st-green-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700 } }, 'XLSX'),
          h('div.grow', [h('div', { style: { fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' } }, b.file), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, `${b.by} · ${b.sheet}`)]),
          badge(tr({
            id: `Parsed · ${b.count} rows`,
            en: `Parsed · ${b.count} rows`,
            zh: `已解析 · ${b.count} 行`,
          }), 'green'),
        ])),
      ]) : null,
    ]),
  ]);
}

// DUA JALAN MASUK, DAN YANG KEDUA SELAMA INI TIDAK KELIHATAN
// ---------------------------------------------------------------------------
// Jalur "centang di BUY NOW" sudah ada sejak lama, tapi dia hidup di layar
// LAIN — di tab BUY NOW pada Stok Label. Orang yang membuka layar ini melihat
// satu kotak unggah dan menyimpulkan Excel adalah satu-satunya cara. Fitur yang
// tidak pernah ditemukan sama saja dengan fitur yang tidak ada.
//
// Kotak kedua di bawah ini tidak menambah kemampuan apa pun. Dia cuma
// mengumumkan kemampuan yang sudah ada, di tempat orang mencarinya — lengkap
// dengan berapa baris yang sedang menunggu di sana.
function duaPintu(st) {
  const menunggu = (st.labelStock || []).filter(r => r.status === 'BUY NOW').length
    + ((st.labelBuyRaw && st.labelBuyRaw.bagian) ? st.labelBuyRaw.bagian.reduce((s, b) => s + b.items.length, 0) : 0);

  const pintu = (opts) => h('div', {
    style: {
      flex: '1', minWidth: '250px', border: '1.5px solid var(--border-strong)',
      borderRadius: '12px', padding: '15px 16px',
      cursor: opts.onClick ? 'pointer' : 'default',
      background: opts.aktif ? 'var(--accent-soft)' : 'var(--surface2)',
      borderColor: opts.aktif ? 'var(--accent)' : 'var(--border-strong)',
    },
    onClick: opts.onClick || undefined,
  }, [
    h('div.row.gap8', { style: { alignItems: 'center', marginBottom: '5px' } }, [
      icon(opts.iconName, 15),
      h('div', { style: { fontSize: '13px', fontWeight: 700 } }, opts.title),
      opts.chip ? h('div.mla', badge(opts.chip, 'accent')) : null,
    ]),
    h('div', { style: { fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.6' } }, opts.body),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '6px' } }, opts.when),
  ]);

  return h('div', { style: { marginBottom: '16px' } }, [
    h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginBottom: '9px' } }, tr({
      id: 'Dua cara membuat permintaan. Hasilnya masuk ke antrean yang sama.',
      en: 'Two ways to raise a request. Both land in the same queue.',
      zh: '两种提交申请的方式，结果进入同一个队列。',
    })),
    h('div.row.gap8.wrap', { style: { alignItems: 'stretch' } }, [
      pintu({
        aktif: true, iconName: 'upload',
        title: tr({ id: 'Dari file Excel', en: 'From an Excel file', zh: '来自 Excel 文件' }),
        body: tr({
          id: 'Taruh workbook order di kotak bawah. Semua sheet order dibaca sekaligus.',
          en: 'Drop the order workbook in the box below. Every order sheet is read at once.',
          zh: '将订单工作簿放入下方方框。所有订单工作表会一次读取。',
        }),
        when: tr({
          id: 'Dipakai kalau daftarnya memang sudah jadi di Excel.',
          en: 'Use this when the list already exists in Excel.',
          zh: '当清单已在 Excel 中整理好时使用。',
        }),
      }),
      pintu({
        iconName: 'check',
        onClick: () => setState({ screen: 'label-stock', ui: { ...getState().ui, lsTab: 'buy' } }),
        title: tr({ id: 'Dari Stok Label · BUY NOW', en: 'From Label Stock · BUY NOW', zh: '来自标签库存 · 需采购' }),
        chip: menunggu ? tr({ id: `${menunggu} menunggu`, en: `${menunggu} waiting`, zh: `${menunggu} 项待处理` }) : null,
        body: tr({
          id: 'Portal sudah hitung mana yang kurang, dan sudah baca daftar beli dari file bulanan. Tinggal centang.',
          en: 'The portal has already worked out what is short, and has read the buy list from the monthly file. Just tick.',
          zh: '门户已算出短缺项，并已读取月度文件中的采购清单。只需勾选。',
        }),
        when: tr({
          id: 'Klik untuk ke sana. Baris yang stoknya sudah berlebih ditandai di layar itu.',
          en: 'Click to go there. Rows already overstocked are flagged on that screen.',
          zh: '点击前往。库存已过剩的行会在该页面标出。',
        }),
      }),
    ]),
  ]);
}

async function handleFile(file) {
  if (blockWrite('upload file label')) return;
  if (!file) return;
  try {
    toast(t('loading'));
    const wb = await readWorkbook(file);
    const sheets = wb.sheetNames.map(n => ({ name: n, count: wb.countRows(n) }));
    setUI({ labelFile: file.name, labelWb: wb, labelSheets: sheets, labelSheet: pickBest(sheets), labelStep: 2 });
  } catch (e) {
    console.error(e); toast({
      id: 'Gagal membaca Excel: ' + e.message,
      en: 'Failed to read Excel: ' + e.message,
      zh: '读取 Excel 失败：' + e.message,
    });
  }
}
function pickBest(sheets) {
  // Prefer a sheet that looks like a label order sheet.
  const pref = sheets.find(s => /po|order|local|label|下单|缺货/i.test(s.name));
  return (pref || sheets[0] || {}).name;
}

function step2() {
  const ui = getState().ui;
  const sheets = ui.labelSheets || [];
  // card(children, opts) — NOT card(opts, children).
  //
  // This read `card({ }, h('div.card-pad', …))`, so the empty object became the
  // CHILDREN and rendered as the literal string "[object Object]", while the
  // entire sheet picker was passed as `opts` and destructured for `pad`/`cls`
  // — both undefined, so it was dropped on the floor. Step 2 of Label Request
  // has therefore never worked: sona drops her weekly workbook and the screen
  // shows one line of debug text with no way forward. It is the only call site
  // in the codebase with the arguments this way round.
  return card(h('div.card-pad', { style: { maxWidth: '640px' } }, [
    h('div.row.gap12', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' } }, [
      h('span', { style: { width: '34px', height: '34px', borderRadius: '8px', background: 'var(--st-green-bg)', color: 'var(--st-green-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700 } }, 'XLSX'),
      h('div.grow', [h('div', { style: { fontSize: '13px', fontWeight: 700 } }, ui.labelFile), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
        id: `${sheets.length} sheet terdeteksi`,
        en: `${sheets.length} sheet${sheets.length === 1 ? '' : 's'} detected`,
        zh: `检测到 ${sheets.length} 个工作表`,
      }))]),
      btn(t('lr_change_file'), { sm: true, onClick: async () => { const f = await pickFiles({ accept: '.xls,.xlsx' }); if (f && f[0]) handleFile(f[0]); } }),
    ]),
    h('div', { style: { fontSize: '13px', fontWeight: 700, margin: '18px 0 4px' } }, t('lr_pick_sheet')),
    h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '12px' } }, t('lr_pick_sheet_sub')),
    ...sheets.map((s, i) => {
      const on = ui.labelSheet === s.name;
      const recommended = i === sheets.findIndex(x => x.name === pickBest(sheets));
      return h('label', {
        style: { display: 'flex', alignItems: 'center', gap: '11px', border: on ? '1.5px solid var(--accent)' : '1.5px solid var(--border-strong)', background: on ? 'var(--accent-soft)' : 'transparent', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', marginBottom: '8px' },
        onClick: () => setUI({ labelSheet: s.name }),
      }, [
        h('input', { type: 'radio', checked: on, style: { accentColor: 'var(--accent)' } }),
        h('span.grow', [h('span', { style: { display: 'block', fontSize: '12.5px', fontWeight: 700 } }, s.name), h('span', { style: { display: 'block', fontSize: '10.5px', color: 'var(--text-3)' } }, `${s.count} ${t('lr_rows_data')}`)]),
        recommended ? badge(t('lr_recommended'), 'accent') : null,
      ]);
    }),
    h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '18px' } }, [
      btn(t('back'), { onClick: () => setUI({ labelStep: 1 }) }),
      btn(t('lr_parse') + ' →', { variant: 'primary', onClick: () => parseNow() }),
    ]),
  ]));
}

function parseNow() {
  if (blockWrite('parse label Excel')) return;
  const st = getState(); const ui = st.ui;
  try {
    const rows = ui.labelWb.rows(ui.labelSheet);
    const knownErps = new Set(st.items.map(i => i.erp));
    const res = parseLabelSheet(rows, { brandMap: st.brandMap, knownErps });
    if (!res.ok) { toast(res.error); return; }
    const sel = {}; res.items.forEach((_, i) => (sel[i] = true));
    setUI({ labelResult: res, labelSel: sel, labelStep: 3, assignSup: (st.suppliers[0] || {}).name });
    // Auto-build item master via upsert on ERP CODE.
    upsertItems(res.items);
    st.labelBatches.unshift({ id: uid('lb'), file: ui.labelFile, sheet: ui.labelSheet, count: res.items.length, by: st.user.username, at: new Date().toISOString() });
    logAudit({ entity: 'label', target: ui.labelFile, action: 'upload', detail: `${res.items.length} rows · ${res.stats.newItems} new` });
  } catch (e) {
    console.error(e); toast({
      id: 'Parse gagal: ' + e.message,
      en: 'Parse failed: ' + e.message,
      zh: '解析失败：' + e.message,
    });
  }
}

function upsertItems(items) {
  const st = getState();
  for (const it of items) {
    if (!it.erp) continue;
    const ex = st.items.find(x => x.erp === it.erp);
    if (ex) { Object.assign(ex, { spec: it.spec || ex.spec, brand: it.brand || ex.brand, market: it.market || ex.market, ms: it.ms || ex.ms, rr: it.rr || ex.rr, noise: it.noise || ex.noise, ean: it.ean || ex.ean, nameEn: it.nameEn || ex.nameEn, nameZh: it.nameZh || ex.nameZh }); }
    else st.items.push({ id: uid('itm'), erp: it.erp, spec: it.spec, brand: it.brand, market: it.market, unit: '张', ms: it.ms, rr: it.rr, noise: it.noise, ean: it.ean, nameEn: it.nameEn, nameZh: it.nameZh });
  }
}

// Kotak di jendela saring baris hasil baca Excel. Isinya persis kolom yang
// tampil di tabelnya — Desain dan Flag sengaja tidak ikut karena keduanya
// lencana hasil hitungan, bukan isi barisnya.
//
// Menggantikan kotak cari lama yang cuma menyapu spec + ERP + brand jadi satu
// teks: yang mau memisahkan "semua 18PR di market Vietnam" dulu tidak punya
// jalan, karena market dan PR tidak pernah ikut dicari.
const MEDAN_BARIS = (rows) => [
  { kunci: 'market', label: t('col_market'), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.market).filter(Boolean))].sort(), ambil: r => r.market },
  { kunci: 'spec', label: t('col_spec'), tipe: 'teks', mono: true, ambil: r => r.spec },
  { kunci: 'erp', label: t('col_erp'), tipe: 'teks', mono: true, ambil: r => r.erp },
  { kunci: 'brand', label: t('col_brand'), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.brand).filter(Boolean))].sort(), ambil: r => r.brand },
  { kunci: 'ttpr', label: 'TT·PR', tipe: 'teks', ambil: r => [r.ttl, r.pr].filter(Boolean).join('·') },
  // Qty dicocokkan dalam DUA bentuk sekaligus: angka mentah dan angka
  // berpemisah ribuan. Yang di layar tertulis '1,200' dan yang di kepala orang
  // '1200' — kalau cuma satu yang disimpan, separuh yang mengetik dapat nol
  // hasil untuk baris yang jelas-jelas sedang mereka lihat.
  { kunci: 'qty', label: t('col_qty'), tipe: 'teks', ambil: r => `${r.qty == null ? '' : r.qty} ${num(r.qty)}` },
];

function step3() {
  const st = getState(); const ui = st.ui;
  const res = ui.labelResult; if (!res) { setUI({ labelStep: 1 }); return h('div'); }
  const sel = ui.labelSel || {};
  const medan = MEDAN_BARIS(res.items);
  const nilai = nilaiFilter('lr-baris');
  const rows = saring(res.items, medan, nilai);
  const selCount = res.items.filter((_, i) => sel[i]).length;
  const noDesign = res.items.filter(r => !hasDesign(r)).length;

  const summary = h('div.row.gap8.wrap', [
    badge(`${res.stats.total} ${t('lr_scanned')} · ${countOrders(res.items)} ${t('lr_orders')}`, 'accent'),
    badge(`${noDesign} ${t('lr_no_design')} · ${res.stats.newItems} ${t('lr_new_items')}`, 'gray'),
    h('div.mla.row.gap8', [
      btn(t('lr_reparse'), { onClick: () => setUI({ labelStep: 2 }) }),
    ]),
  ]);

  const warn = (res.warnings || []).map(w => h('div.cfg-banner', { style: { background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' } }, [icon('warn', 15), t('lr_shift_warn')]));

  const thead = h('thead', h('tr', [
    h('th', h('input', { type: 'checkbox', checked: selCount === res.items.length, onChange: e => { const s = {}; res.items.forEach((_, i) => (s[i] = e.target.checked)); setUI({ labelSel: s }); }, style: { accentColor: 'var(--accent)' } })),
    h('th', t('col_market')), h('th', t('col_spec')), h('th', t('col_erp')), h('th', t('col_brand')),
    h('th', 'TT·PR'), h('th.r', t('col_qty')), h('th', t('col_design')), h('th', t('col_flags')),
  ]));
  const body = h('tbody', rows.length ? rows.map((r) => {
    const i = res.items.indexOf(r);
    const on = !!sel[i];
    const dz = hasDesign(r);
    return h('tr' + (on ? '.sel' : ''), [
      h('td', h('input', { type: 'checkbox', checked: on, onChange: () => { const s = { ...sel }; s[i] = !s[i]; setUI({ labelSel: s }); }, style: { accentColor: 'var(--accent)', cursor: 'pointer' } })),
      h('td', r.market || '—'),
      h('td.mono', { style: { color: 'var(--text)' } }, r.spec || '—'),
      h('td.mono', r.erp || '—'),
      h('td.cell-strong', r.brand || '—'),
      h('td', `${r.ttl || '—'}·${r.pr || '—'}`),
      h('td.mono.r', num(r.qty)),
      h('td', dz ? badge(t('design_ok'), 'green', { iconName: 'check' }) : badge(t('design_no'), 'red')),
      h('td', r.isNew ? h('span.tag-new', t('new_item')) : null),
    ]);
  }) : barisTakCocok(9, { id: 'lr-baris', adaFilter: jumlahFilterAktif(nilai) > 0 }));

  const table = h('div.card', [
    h('div.card-head', [
      h('div.card-title', t('lr_step_preview')),
      hitunganSaring(rows.length, res.items.length, { id: 'baris', en: `row${res.items.length === 1 ? '' : 's'}`, zh: '行' }),
      // Tanpa kunciHalaman: tabel ini tidak berhalaman, semua baris digambar.
      tombolFilter({ id: 'lr-baris', medan, judul: t('lr_step_preview') }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [thead, body])),
    h('div.tbl-foot', tr({
      id: `${rows.length}/${res.stats.total} · ${res.stats.skipped} ${t('lr_skipped')} · header baris ${res.stats.headerRow}`,
      en: `${rows.length}/${res.stats.total} · ${res.stats.skipped} ${t('lr_skipped')} · header row ${res.stats.headerRow}`,
      zh: `${rows.length}/${res.stats.total} · ${res.stats.skipped} ${t('lr_skipped')} · 表头行 ${res.stats.headerRow}`,
    })),
  ]);

  const supplierNames = st.suppliers.map(s => s.name);
  const actionBar = h('div.card', { style: { position: 'sticky', bottom: '14px', display: 'flex', alignItems: 'center', gap: '14px', border: '1.5px solid var(--accent)', boxShadow: 'var(--paper-shadow)', padding: '12px 18px' } }, [
    h('div', [h('div', { style: { fontSize: '13px', fontWeight: 800 } }, [h('span.mono', { style: { color: 'var(--accent-tx)' } }, String(selCount)), ' ' + t('lr_selected')]), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('lr_merge_note'))]),
    h('div.mla.row.gap8', [
      // Hidden for the requester: offering a supplier picker to someone whose
      // choice is ignored is worse than not offering it — it reads as input.
      can(st.user.role, 'poCreate') ? h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' } }, t('lr_assign_sup')) : null,
      can(st.user.role, 'poCreate') ? selectEl(supplierNames, { value: ui.assignSup || supplierNames[0], onChange: v => setUI({ assignSup: v }) }) : null,
      // Two different jobs, two different buttons — never both.
      //
      // poCreate (cania/visca/wilbert) assigns a supplier and raises the PO.
      // labelRequestAsk (sona) submits what she needs and stops there: she owns
      // the workbook and knows what has to be printed, but the supplier and the
      // purchase order are not hers to decide.
      can(st.user.role, 'poCreate')
        ? btn(t('lr_assign_gen'), { variant: 'primary', onClick: () => openPoModal() })
        : can(st.user.role, 'labelRequestAsk')
          ? btn(t('lr_submit_req'), { variant: 'primary', iconName: 'check', onClick: () => submitRequest() })
          : badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' }),
    ]),
  ]);

  return h('div.stack', { style: { gap: '14px' } }, [summary, ...warn, table, actionBar]);
}

// sona's half: freeze what she selected and hand it over. Nothing about the
// supplier or the PO is decided here.
async function submitRequest() {
  if (blockWrite('kirim request label')) return;
  const st = getState(); const ui = st.ui;
  const res = ui.labelResult;
  const chosen = (res.items || []).filter((_, i) => (ui.labelSel || {})[i]);
  if (!chosen.length) {
    toast({ id: 'Centang dulu baris yang mau diminta', en: 'Tick the rows you are requesting first', zh: '请先勾选要申请的行' });
    return;
  }
  const local = {
    file: ui.labelFile, sheet: ui.labelSheet, rows: chosen,
    by: st.user.username, at: new Date().toISOString(), status: 'Diminta',
  };
  try {
    const saved = await insertLabelRequest(local);
    local.id = saved.id; local.at = saved.at || local.at;
  } catch (e) {
    // Do NOT keep it locally on failure. A request that exists only on sona's
    // screen is worse than none: she stops chasing it, and purchasing never
    // sees it.
    console.error('Supabase label request insert failed', e);
    toast({
      id: 'Gagal kirim request ke server: ' + (e.message || e),
      en: 'Failed to send the request to the server: ' + (e.message || e),
      zh: '发送申请到服务器失败：' + (e.message || e),
    });
    return;
  }
  if (!local.id) local.id = uid('lr');
  st.labelRequests.unshift(local);
  logAudit({ entity: 'label', target: local.file, action: 'request', detail: `${chosen.length} baris · sheet ${local.sheet}` });
  setUI({ labelStep: 1, labelResult: null, labelSel: {} });
  setState({ labelRequests: st.labelRequests });
  toast({
    id: `${chosen.length} baris dikirim ke Purchasing — mereka yang assign supplier & bikin PO`,
    en: `${chosen.length} rows sent to Purchasing — they assign the supplier and raise the PO`,
    zh: `${chosen.length} 行已发送采购 — 由其指定供应商并开具采购单`,
  });
}

// Kotak di jendela saring "Request Saya". Semua opsi dropdown diambil dari
// permintaan yang BENAR-BENAR ada di daftarnya — daftar supplier lengkap dari
// master data akan berisi nama yang nol hasilnya untuk sona.
const MEDAN_LR_SAYA = (rows) => [
  // Sumber dan Status memakai teks yang TERBACA di lencananya, bukan nilai
  // mentah di database. Yang memilih di sini sedang menunjuk lencana yang dia
  // lihat di kolomnya; kalau isinya kode internal, dua daftar yang sama
  // terlihat beda.
  { kunci: 'sumber', label: tr({ id: 'Sumber', en: 'Source', zh: '来源' }), tipe: 'pilih', opsi: [...new Set(rows.map(sumberTeks).filter(Boolean))].sort(), ambil: sumberTeks },
  { kunci: 'file', label: tr({ id: 'File', en: 'File', zh: '文件' }), tipe: 'teks', mono: true, ambil: r => r.file },
  { kunci: 'sheet', label: 'Sheet', tipe: 'teks', mono: true, ambil: r => r.sheet },
  { kunci: 'qty', label: t('col_qty'), tipe: 'teks', ambil: r => String((r.rows || []).length) },
  { kunci: 'at', label: tr({ id: 'Dikirim', en: 'Sent', zh: '发送时间' }), tipe: 'tanggal', ambil: r => r.at },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.supplier).filter(Boolean))].sort(), ambil: r => r.supplier },
  { kunci: 'po', label: 'PO', tipe: 'teks', mono: true, ambil: r => r.poNo },
  { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: [...new Set(rows.map(r => statusText(r.status)).filter(Boolean))].sort(), ambil: r => statusText(r.status) },
];

// sona's own view. Without it, submitting is a one-way drop: she would have to
// ask someone whether her request had been picked up, which is the question the
// record exists to answer.
function myRequests(st) {
  if (!can(st.user.role, 'labelRequestAsk')) return null;
  const semua = (st.labelRequests || []).filter(r => r.by === st.user.username);
  // Dicek SEBELUM disaring. Kalau kartunya ikut hilang waktu saringan tidak
  // menemukan apa-apa, tombol corongnya ikut hilang juga — dan saringan yang
  // menyala jadi tidak ada lagi jalan untuk dimatikan.
  if (!semua.length) return null;
  const medan = MEDAN_LR_SAYA(semua);
  const nilai = nilaiFilter('lr-saya');
  const tersaring = saring(semua, medan, nilai);
  // Potongan diam-diam yang sudah ada dari dulu: tabelnya cuma menggambar 8
  // teratas. Dibiarkan, TAPI angka di kepala kartu dihitung dari daftar penuh —
  // "8 dari 8" pada seseorang yang punya 23 permintaan adalah kabar yang salah,
  // dan justru menyembunyikan bahwa ada yang tidak kelihatan.
  const mine = tersaring.slice(0, 8);
  const tone = (x) => ({ 'Diminta': 'amber', 'PO Terbit': 'green', 'Ditolak': 'red' }[x] || 'gray');
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', t('lr_my_reqs')),
      // Dihitung dari daftar penuh, bukan dari yang tersaring: berapa
      // permintaannya yang masih menggantung tidak berubah gara-gara dia
      // menyaring kolom lain.
      badge(String(semua.filter(r => r.status === 'Diminta').length), 'amber'),
      hitunganSaring(tersaring.length, semua.length, {
        id: `permintaan`, en: `request${semua.length === 1 ? '' : 's'}`, zh: `份申请`,
      }),
      tombolFilter({ id: 'lr-saya', medan, judul: t('lr_my_reqs') }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        tr({ id: 'Sumber', en: 'Source', zh: '来源' }),
        tr({ id: 'File', en: 'File', zh: '文件' }), 'Sheet', t('col_qty'),
        tr({ id: 'Dikirim', en: 'Sent', zh: '发送时间' }), t('col_supplier'), 'PO', t('col_status'),
      ].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', mine.length ? mine.map(r => h('tr', [
        h('td', lencanaSumber(r)),
        h('td.mono', { style: { fontSize: '11px' } }, r.file || '—'),
        h('td.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, r.sheet || '—'),
        h('td.mono.r', String((r.rows || []).length)),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, fmtDateTime(r.at)),
        h('td', r.supplier || '—'),
        h('td.mono', { style: { fontSize: '11px' } }, r.poNo || '—'),
        h('td', badge(statusText(r.status), tone(r.status))),
      ])) : barisTakCocok(8, { id: 'lr-saya', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
  ]);
}

// Kotak di jendela saring "Request Label Masuk". Status tidak ikut: daftar ini
// sudah dikunci ke yang berstatus 'Diminta', jadi kotaknya cuma punya satu
// pilihan dan tidak pernah membuang apa pun. Catatan portal juga tidak —
// isinya lencana hasil pemeriksaan, bukan teks yang bisa diketik ulang.
const MEDAN_LR_MASUK = (rows) => [
  { kunci: 'by', label: t('lr_req_by'), tipe: 'teks', ambil: r => r.by },
  { kunci: 'sumber', label: tr({ id: 'Sumber', en: 'Source', zh: '来源' }), tipe: 'pilih', opsi: [...new Set(rows.map(sumberTeks).filter(Boolean))].sort(), ambil: sumberTeks },
  { kunci: 'file', label: tr({ id: 'File', en: 'File', zh: '文件' }), tipe: 'teks', mono: true, ambil: r => r.file },
  { kunci: 'sheet', label: 'Sheet', tipe: 'teks', mono: true, ambil: r => r.sheet },
  { kunci: 'qty', label: t('col_qty'), tipe: 'teks', ambil: r => String((r.rows || []).length) },
  { kunci: 'at', label: tr({ id: 'Diminta', en: 'Requested', zh: '申请时间' }), tipe: 'tanggal', ambil: r => r.at },
];

// Purchasing's half: what is waiting, and how to pick it up.
function incomingRequests(st) {
  const open = (st.labelRequests || []).filter(r => r.status === 'Diminta');
  // Kartunya hilang cuma waktu memang tidak ada yang menunggu. Sesudah itu
  // yang mengosongkan tabel adalah saringannya, dan itu harus terbaca sebagai
  // saringan — lengkap dengan tombol untuk mematikannya.
  if (!can(st.user.role, 'labelRequestFill') || !open.length) return null;
  const medan = MEDAN_LR_MASUK(open);
  const nilai = nilaiFilter('lr-masuk');
  const tersaring = saring(open, medan, nilai);
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', t('lr_incoming')),
      badge(String(open.length), 'accent'),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, t('lr_incoming_sub')),
      hitunganSaring(tersaring.length, open.length, {
        id: `permintaan`, en: `request${open.length === 1 ? '' : 's'}`, zh: `份申请`,
      }),
      tombolFilter({ id: 'lr-masuk', medan, judul: t('lr_incoming') }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        t('lr_req_by'),
        tr({ id: 'Sumber', en: 'Source', zh: '来源' }),
        tr({ id: 'File', en: 'File', zh: '文件' }), 'Sheet',
        t('col_qty'),
        tr({ id: 'Catatan portal', en: 'Portal notes', zh: '门户提示' }),
        tr({ id: 'Diminta', en: 'Requested', zh: '申请时间' }),
        t('col_action'),
      ].map((c, i) => h('th' + (i === 4 ? '.r' : ''), c)))),
      h('tbody', tersaring.length ? tersaring.map(r => h('tr', [
        h('td.cell-strong', r.by),
        h('td', lencanaSumber(r)),
        h('td.mono', { style: { fontSize: '11px' } }, r.file || '—'),
        h('td.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, r.sheet || '—'),
        h('td.mono.r', String((r.rows || []).length)),
        h('td', catatanPortal(r)),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, fmtDateTime(r.at)),
        h('td', btn(t('lr_open_req'), { sm: true, variant: 'primary', onClick: () => openRequest(r) })),
      ])) : barisTakCocok(8, { id: 'lr-masuk', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
  ]);
}

// DARI MANA PERMINTAAN INI DATANG
// ---------------------------------------------------------------------------
// Dua jalur masuk sekarang: sona mencentang di BUY NOW, atau seseorang menaruh
// berkas Excel. Barisnya sengaja berbentuk identik supaya modal PO, pengecekan
// desain, dan template ERP tidak perlu tahu bedanya — tapi ORANG perlu tahu.
// Enam bulan lagi "ini dari mana?" adalah pertanyaan pertama yang muncul, dan
// tanpa lencana ini jawabannya cuma ada di ingatan seseorang.
//
// Dibaca dari isi barisnya (`section`), BUKAN dari kolom baru di tabel:
// permintaan lama yang sudah tersimpan tidak punya kolom itu, dan menambah
// kolom berarti SQL — yang bukan hak layar ini untuk menjalankan.
function dariStok(r) {
  return (r.rows || []).some(x => x.section === 'buynow')
    || /Stok Label|Label Stock|标签库存/.test(String(r.file || ''));
}

// Teksnya dipisah dari lencananya supaya dropdown "Sumber" di jendela saring
// memakai kata yang SAMA PERSIS dengan yang tertulis di kolomnya. Kalau kedua
// tempat itu menghitung sendiri-sendiri, cukup satu yang diubah nanti untuk
// membuat saringan yang selalu nol hasil tanpa ada yang tahu sebabnya.
function sumberTeks(r) {
  return dariStok(r)
    ? tr({ id: 'BUY NOW', en: 'BUY NOW', zh: '需采购' })
    : tr({ id: 'Excel', en: 'Excel', zh: 'Excel' });
}

function lencanaSumber(r) {
  const stok = dariStok(r);
  return badge(sumberTeks(r), stok ? 'accent' : 'blue', { iconName: stok ? 'check' : 'upload' });
}

// Peringatan yang dihitung waktu permintaan dibuat IKUT TERSIMPAN di barisnya,
// dan ditampilkan lagi di sini. Peringatan yang berhenti di layar orang pertama
// tidak menolong orang kedua — dan orang keduanyalah yang menerbitkan PO.
function catatanPortal(r) {
  const rows = r.rows || [];
  const stop = rows.filter(x => x._stop).length;
  const cek = rows.filter(x => x._takBisaDicek).length;
  const ganda = rows.filter(x => x._kodeGanda).length;
  if (!stop && !cek && !ganda) return h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, '—');
  return h('div.row.gap8.wrap', [
    stop ? badge(tr({ id: `${stop} overstock`, en: `${stop} overstocked`, zh: `${stop} 项库存过剩` }), 'red', { iconName: 'warn' }) : null,
    ganda ? badge(tr({ id: `${ganda} kode ganda`, en: `${ganda} duplicate codes`, zh: `${ganda} 个编码重复` }), 'red', { iconName: 'warn' }) : null,
    cek ? badge(tr({ id: `${cek} tak bisa dicek`, en: `${cek} unverifiable`, zh: `${cek} 项无法核对` }), 'amber') : null,
  ]);
}

// Load a request's frozen rows straight into step 3. The rows are NOT re-parsed
// from the file — purchasing acts on exactly what sona submitted, which is the
// entire reason the rows were stored rather than the filename.
function openRequest(r) {
  const rows = r.rows || [];
  setUI({
    labelStep: 3,
    labelFile: r.file,
    labelSheet: r.sheet,
    labelResult: {
      items: rows,
      warnings: [],
      stats: { total: rows.length, skipped: 0, headerRow: '—', newItems: rows.filter(x => x.isNew).length },
    },
    labelSel: Object.fromEntries(rows.map((_, i) => [i, true])),
    labelFillingReq: r.id,
  });
}

function hasDesign(r) { return getState().designs.some(d => d.erp === r.erp) || r.hasTemplate; }
function countOrders(items) { return new Set(items.map(i => i.market + '|' + i.brand)).size; }

function openPoModal() {
  const st = getState();
  const selItems = (st.ui.labelResult.items || []).filter((_, i) => st.ui.labelSel[i]);
  const chosen = selItems; // assigned to one supplier per design (bulk assign)
  const subtotal = chosen.reduce((s, r) => s + (r.qty * (r.unitPrice || 1000)), 0); // demo price
  setUI({ poModal: true, poForm: { no: '', contract: '', terms: '45 hari setelah invoice', priority: 'Normal', ppn: 'kek', subtotal, count: chosen.length } });
}

function poModal() {
  const st = getState(); const f = st.ui.poForm;
  const ppn = f.ppn === 'bayar' ? Math.round(f.subtotal * 0.11) : 0;
  const radio = (key, title, desc) => h('div', {
    style: { flex: 1, border: f.ppn === key ? '1.5px solid var(--accent)' : '1.5px solid var(--border-strong)', background: f.ppn === key ? 'var(--accent-soft)' : 'var(--surface)', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer' },
    onClick: () => setUI({ poForm: { ...f, ppn: key } }),
  }, [
    h('div.row.gap8', [h('span', { style: { width: '15px', height: '15px', borderRadius: '50%', border: f.ppn === key ? '1.5px solid var(--accent)' : '1.5px solid var(--border-strong)', background: f.ppn === key ? 'var(--accent)' : 'transparent', boxShadow: f.ppn === key ? 'inset 0 0 0 3px var(--surface)' : 'none' } }), h('span', { style: { fontSize: '12.5px', fontWeight: 700 } }, title)]),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '5px', lineHeight: 1.4 } }, desc),
  ]);

  return modal({
    title: t('po_generate'), subtitle: tr({
      id: `${st.ui.assignSup} · ${f.count} baris · unit 张`,
      en: `${st.ui.assignSup} · ${f.count} lines · unit 张`,
      zh: `${st.ui.assignSup} · ${f.count} 行 · 单位 张`,
    }), width: 520,
    onClose: () => setUI({ poModal: false }),
    body: [
      h('div.grid.g2', [
        field(t('po_contract_no') + ' *', poNoField(f)),
        field(t('po_date'), inputEl({ value: fmtToday(), mono: true })),
      ]),
      field(tr({ id: 'Contract No (opsional)', en: 'Contract No (optional)', zh: '合同号（选填）' }), inputEl({ value: f.contract || '', mono: true, onInput: v => (f.contract = v) })),
      // 'Custom…' removed — it had no follow-up input and printed as "30 days"
      // on the contract via the old topDaysOf() default. See poTermDays().
      field(t('po_terms'), selectEl(['30 hari setelah invoice', '45 hari setelah invoice', '60 hari setelah invoice', 'Bayar di muka'], { value: f.terms, onChange: v => (f.terms = v) })),
      // Priority drives expected arrival in Label Stock -> Order Tracking
      // (lead days come from label_settings: Normal 14 / Urgent 7 / Super 3).
      // Without it every order was assumed Normal and "overdue" meant nothing.
      // Option strings are the STORED priority values (label_settings lead
      // days key off them) — labels only, values untouched.
      field(tr({ id: 'Prioritas', en: 'Priority', zh: '优先级' }), selectEl(['Normal', 'Urgent', 'Super Urgent'], { value: f.priority || 'Normal', onChange: v => (f.priority = v) })),
      field(t('po_ppn'), h('div.row.gap12', [radio('bayar', t('po_ppn_paid'), t('po_ppn_paid_d')), radio('kek', t('po_ppn_susp'), t('po_ppn_susp_d'))])),
      h('div', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' } }, [
        row2(t('po_subtotal'), money(f.subtotal, 'IDR')),
        row2('PPN', f.ppn === 'bayar' ? money(ppn, 'IDR') : tr({
          id: 'Ditangguhkan — KEK', en: 'Suspended — KEK', zh: '暂免征收 — KEK',
        })),
        h('div.divider'), row2(t('po_total'), money(f.subtotal + ppn, 'IDR'), true),
      ]),
    ],
    footer: [
      btn(t('cancel'), { onClick: () => setUI({ poModal: false }) }),
      btn(t('po_gen_btn'), { variant: 'primary', iconName: 'file', onClick: () => genPO() }),
    ],
  });
}
function row2(a, b, strong) { return h('div.row', { style: { justifyContent: 'space-between', fontSize: strong ? '13.5px' : '12px', fontWeight: strong ? 800 : 400, color: strong ? 'var(--text)' : 'var(--text-2)' } }, [h('span', a), h('span.mono', b)]); }
function fmtToday() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

async function genPO() {
  if (blockWrite('generate PO label')) return;
  const st = getState(); const f = st.ui.poForm;
  if (!f.no || !f.no.trim()) { toast({ id: 'No. PO wajib diisi', en: 'PO number is required', zh: '必须填写采购单号' }); return; }
  const selItems = (st.ui.labelResult.items || []).filter((_, i) => st.ui.labelSel[i]);
  const supplier = st.suppliers.find(s => s.name === st.ui.assignSup) || {};
  const ppnMode = ppnModeFromForm(f.ppn);
  const ppn = ppnFor(f.subtotal, ppnMode);
  // Capability, not a username string. The literal comparison paired with the
  // window.__MTI__ handle (main.js) let any purchasing account fake the role
  // client-side and insert a PO with status 'Approved' — pos_insert's RLS
  // policy only checked is_purchasing(), never the status value.
  // Server-side lock is in supabase_migration_po_insert_guard.sql.
  const isWilbert = can(st.user.role, 'approve');
  const po = {
    id: uid('po'), no: f.no.trim(), contract: f.contract || '', supplier: supplier.name, supplierZh: supplier.nameZh || '',
    address: supplier.address || `${supplier.city || ''}`, currency: 'IDR', unit: '张',
    subtotal: f.subtotal, ppn, ppnMode, total: f.subtotal + ppn,
    amount: f.subtotal + ppn, terms: f.terms, priority: f.priority || 'Normal', delivery: 'Loco Kendal', by: st.user.username,
    status: isWilbert ? 'Approved' : 'Menunggu Approval', createdAt: new Date().toISOString(), source: 'label',
    contact: supplier.contact, phone: supplier.phone,
    // Opaque lineId minted up front — see posApi.js newLineId().
    items: selItems.map(r => ({ erp: r.erp, d: r.nameEn || r.spec, dimension: r.spec, cn: r.nameZh || '', qty: r.qty, u: r.unitPrice || 1000, a: r.qty * (r.unitPrice || 1000), unit: '张/PC', lineId: newLineId() })),
  };
  if (isWilbert) { po.approvedAt = new Date().toISOString(); po.approvedBy = 'wilbert'; }
  // Mirror to Supabase so the delete-request workflow (item 3) has a real row
  // to operate on. lineIds no longer depend on the server id, so there's no
  // post-insert patch step and nothing to go wrong between the two writes.
  try {
    const supabaseId = await insertPO(po);
    if (supabaseId) po.id = supabaseId;
  } catch (e) {
    console.error('insertPO failed', e);
    // PERMANENT rejection: the number is taken and always will be. Abort
    // instead of falling through to the local-only path, which would show the
    // PO as created and then lose it on the next login. The modal stays open,
    // so the number can be corrected and sent again.
    if (duplicatePoNumber(e)) {
      toast({
        id: `No. PO ${po.no} sudah dipakai — ganti nomornya`,
        en: `PO number ${po.no} is already taken — use a different one`,
        zh: `采购单号 ${po.no} 已被占用 — 请更换号码`,
      });
      return;
    }
    // Anything else (network, timeout) may well succeed on a retry, so the
    // original behaviour stands: keep it locally and say so.
    toast({
      id: 'PO tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'PO saved locally, but sync to the server failed: ' + (e.message || e),
      zh: '采购单已本地保存，但同步到服务器失败：' + (e.message || e),
    });
  }
  st.pos.unshift(po);
  logAudit({ entity: 'po', target: po.no, action: 'generate', detail: `${supplier.name} · ${selItems.length} lines` });

  // If this PO came from one of sona's requests, close it — and record WHICH
  // PO answered it. That link is the whole point: months later, "was this the
  // label she asked for?" is answerable by opening the request beside the PO.
  //
  // Deliberately after the PO is safely created. Closing the request first and
  // then failing to raise the PO would leave sona thinking it was handled.
  const reqId = st.ui.labelFillingReq;
  if (reqId) {
    const req = (st.labelRequests || []).find(r => r.id === reqId);
    if (req) {
      const patch = { status: 'PO Terbit', supplier: supplier.name, poNo: po.no, handledBy: st.user.username, handledAt: new Date().toISOString() };
      Object.assign(req, patch);
      try {
        if (UUID_RE.test(String(req.id))) await updateLabelRequest(req.id, patch);
      } catch (e) {
        // The PO exists either way; only the link failed. Say so plainly rather
        // than rolling back a purchase order over a status field.
        console.error('label request close failed', e);
        toast({
          id: `PO ${po.no} dibuat, tapi status request-nya gagal diupdate — tandai manual.`,
          en: `PO ${po.no} created, but the request status failed to update — mark it by hand.`,
          zh: `采购单 ${po.no} 已创建，但申请状态更新失败 — 请手动标记。`,
        });
      }
      logAudit({ entity: 'label', target: req.file, action: 'request_filled', detail: `${po.no} · ${supplier.name}` });
    }
  }
  setUI({ poModal: false, labelFillingReq: null });
  toast(isWilbert ? {
    id: `PO ${po.no} dibuat & di-approve (skip queue)`,
    en: `PO ${po.no} created & approved (queue skipped)`,
    zh: `采购单 ${po.no} 已创建并批准（跳过审批队列）`,
  } : {
    id: `PO ${po.no} dibuat & dikirim untuk approval supervisor`,
    en: `PO ${po.no} created & sent to the supervisor for approval`,
    zh: `采购单 ${po.no} 已创建并提交主管审批`,
  });
  setState({ screen: isWilbert ? 'approval' : 'label-request' });
}
