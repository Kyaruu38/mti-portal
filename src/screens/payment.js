import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, statusTone, driveLink } from '../ui/components.js';
import { money, num, fmtDate, romanMonth, daysUntil, topDays, addDays } from '../core/format.js';
import { prfPaper } from '../ui/documents.js';
import { can } from '../auth/roles.js';
import { wrapPrintable } from './approval.js';
import { nextPrfNo } from '../core/docSeqApi.js';
import { uploadToDrive } from '../core/drive.js';
import { insertInvoice, updateInvoice } from '../core/invoicesApi.js';
import { insertPrf } from '../core/prfsApi.js';
import { insertDescDict } from '../core/descDictApi.js';

const STAGES = ['Diterima Purchasing', 'Diproses Wilbert', 'Diterima Finance', 'Paid'];

export function paymentScreen() {
  const st = getState(); const ui = st.ui;
  // "paymentReadonly" means the FINANCE stage (Diterima Finance/Paid) is
  // read-only for this role — enforced by RLS on prfs.stage, not by blocking
  // purchasing-side work here. sekar has paymentWrite=true and is the primary
  // user of this screen (intake invoices, hand to Wilbert, build PRFs), so it
  // must NOT disable invoice hand-off or PRF creation — only informs the badge.
  const readonly = can(st.user.role, 'paymentReadonly');

  // Two independent halves of this screen:
  //   paymentWrite -> INTAKE   (drop-zone, invoice table, faktur, hand-off)
  //   prfCreate    -> PRF      (builder + preview + send to Wilbert)
  // cania/visca have prfCreate WITHOUT paymentWrite: they raise a PRF against
  // invoices sekar already pushed to "Diproses Wilbert", but they don't own
  // invoice intake and they don't track payment stages. Hiding the intake half
  // here is UX only — RLS on invoices/prfs is the actual boundary.
  const canIntake = can(st.user.role, 'paymentWrite');
  const canPrf = can(st.user.role, 'prfCreate');
  if (!canIntake && canPrf) {
    return h('div.stack', [
      prfOnlyNote(),
      prfBuilder(st),
      ui.prfModal ? prfModal() : null,
    ]);
  }

  // Faktur reminder ONLY when linked PO has PPN=Dibayar (paid) and faktur missing.
  const needFaktur = st.invoices.filter(i => !i.faktur && poPpnPaid(i) && i.status !== 'Paid');
  const banner = (ui.pfBannerClosed ? [] : needFaktur.slice(0, 1)).map(inv => h('div.cfg-banner', { style: { justifyContent: 'flex-start' } }, [
    icon('warn', 17), h('div.grow', [h('b', t('pay_faktur_warn'))]),
    btn(t('pay_upload_faktur'), { sm: true, onClick: () => uploadFaktur(inv) }),
    btn(t('pay_continue_anyway'), { sm: true, variant: 'primary', onClick: () => { setUI({ pfBannerClosed: true }); toast('Diproses tanpa faktur pajak — ditandai follow-up'); } }),
  ]));

  // No PDF invoice parser exists (unlike PO Converter's zcPoPdf.js) — dropping
  // a file here can't auto-fill invoice fields. It does carry the file itself
  // through as an attachment though: opens the same "Add Invoice" modal with
  // the dropped file pre-attached, uploaded to Drive (category "Invoice") on save.
  const dz = dropzone({ title: t('pay_drop_inv'), sub: t('pay_faktur_reminder'), accept: '.pdf', iconName: 'upload', compact: true, onFiles: f => { toast('File dilampirkan — lengkapi detail invoice'); openInvoiceModal(f[0]); } });

  const flow = card([h('div.card-pad', [
    h('div.row.gap8', [h('div.card-title', t('pay_flow')), readonly ? badge(t('pay_readonly'), 'gray', { iconName: 'eye' }) : null]),
    h('div.row.gap8.wrap', { style: { marginTop: '12px' } }, STAGES.flatMap((s, i) => [
      badge(`${i + 1} · ${trStage(s)}`, ['gray', 'amber', 'blue', 'green'][i]),
      i < 3 ? icon('arrowR', 13, { stroke: 'var(--text-3)' }) : null,
    ])),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '10px' } }, 'Invoice masuk PRF hanya setelah min. "Diproses Wilbert" · PRF USD & IDR terpisah per currency'),
  ])]);

  return h('div.stack', [
    ...banner,
    h('div.grid', { style: { gridTemplateColumns: '1fr 1.6fr' } }, [dz, flow]),
    invoiceTable(st),
    prfBuilder(st),
    prfTrackingCard(st, readonly),
    ui.prfModal ? prfModal() : null,
    ui.invoiceModal ? invoiceModal() : null,
  ]);
}

// READ-ONLY progress list of every PRF raised, for the intake side of the screen
// (sekar + wilbert). Once a PRF is submitted sekar's role is to watch where it
// got to, and until now this screen gave her no way to see that at all — she had
// to go to Reports. There are deliberately NO action buttons here: moving a PRF
// to "Diterima Finance" or "Paid" is finance's job, and RLS's prfs_update policy
// blocks sekar/cania/visca from those stages anyway.
function prfTrackingCard(st, readonly) {
  const list = st.prfs.slice(0, 25);
  const tone = s => ({ 'Terbentuk': 'gray', 'Diproses Wilbert': 'amber', 'Diterima Finance': 'blue', 'Paid': 'green' }[s] || 'gray');
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', 'Progress PRF'),
      badge('Read-only', 'gray', { iconName: 'eye' }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.prfs.length} PRF · status diubah oleh Finance`),
    ]),
    list.length ? h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['No. PRF', t('col_supplier'), t('col_amount'), 'Invoice', 'Dibuat', t('col_status')].map((c, i) => h('th' + (i === 2 ? '.r' : ''), c)))),
      h('tbody', list.map(p => h('tr', [
        h('td.mono.cell-strong', p.no),
        h('td', p.supplier),
        h('td.mono.r', money(p.amount, p.currency)),
        h('td.mono', { style: { color: 'var(--text-3)', fontSize: '10.5px' } }, (p.invoices || []).join(', ') || '—'),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${p.by || '—'} · ${fmtDate(p.createdAt)}`),
        h('td', h('div.row.gap8', [
          badge(trStage(p.stage), tone(p.stage)),
          p.paidAt ? h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, fmtDate(p.paidAt)) : null,
        ])),
      ]))),
    ])) : h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, 'Belum ada PRF dibuat.'),
  ]);
}

function poPpnPaid(inv) { const po = getState().pos.find(p => p.no.includes(inv.poRef.replace('PO ', '')) || (p.contract && inv.poRef.includes(p.contract))); return po ? po.ppnMode === 'paid' : inv.ppnPaid; }
function trStage(s) { const m = { 'Diterima Purchasing': t('st_diterima_purchasing'), 'Diproses Wilbert': t('st_diproses_wilbert'), 'Diterima Finance': t('st_diterima_finance'), 'Paid': t('st_paid') }; return m[s] || s; }

function invoiceTable(st) {
  const head = h('thead', h('tr', ['Invoice', t('col_supplier'), 'PO Ref', t('col_amount'), t('col_due'), t('pay_faktur'), 'File', t('col_status')].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c))));
  const body = h('tbody', st.invoices.map(inv => {
    const d = daysUntil(inv.due);
    const dueTone = inv.status === 'Paid' ? '' : d < 0 ? 'red' : d <= 1 ? 'amber' : '';
    // Handing off to Wilbert is purchasing-side work (sekar's job), not a
    // finance-stage mutation — not gated by the finance "readonly" cap.
    const canAdvance = inv.status === 'Diterima Purchasing';
    return h('tr', { style: inv.status === 'Diterima Purchasing' && !inv.faktur && poPpnPaid(inv) ? { background: 'var(--st-amber-bg)' } : {} }, [
      h('td.mono.cell-strong', inv.no),
      h('td', inv.supplier),
      h('td.mono', { style: { color: 'var(--text-3)' } }, inv.poRef),
      h('td.mono.r', money(inv.amount, inv.currency)),
      h('td.mono', { style: dueTone ? { color: `var(--st-${dueTone}-tx)`, fontWeight: 700 } : {} }, inv.status === 'Paid' ? 'paid' : fmtDate(inv.due) + (d < 0 ? ` · overdue ${-d}h` : '')),
      h('td', inv.faktur ? h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } }, [icon('check', 11, { strokeWidth: 2.5 }), ' ', inv.faktur]) : badge(t('pay_faktur_missing'), 'amber', { iconName: 'warn' })),
      h('td', driveLink((inv.files && inv.files[0] && inv.files[0].url) || '')),
      h('td', h('div.row.gap8', [
        badge(trStage(inv.status), statusTone(inv.status)),
        canAdvance ? btn(t('handed_wilbert'), { sm: true, onClick: () => handToWilbert(inv) }) : null,
      ])),
    ]);
  }));
  return h('div.card', [
    h('div.card-head', [h('div.card-title', t('pay_inv_in')), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.invoices.length} invoice`), h('div.mla', btn('Add Invoice', { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openInvoiceModal() }))]),
    h('div.tbl-wrap', h('table.tbl', [head, body])),
  ]);
}

async function uploadFaktur(inv) {
  // Faktur number is still simulated (no real OCR/upload pipeline) — this
  // fix is scoped to persistence, not to building real faktur-pajak intake.
  inv.faktur = '010.005-26.' + Math.floor(Math.random() * 1e8);
  try {
    await updateInvoice(inv.id, { faktur: inv.faktur });
  } catch (e) {
    console.error('Supabase invoice faktur sync failed', e);
    toast('Faktur tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e));
    setState({});
    return;
  }
  toast('Faktur pajak terupload');
  setState({});
}

async function handToWilbert(inv) {
  inv.status = 'Diproses Wilbert';
  try {
    await updateInvoice(inv.id, { status: inv.status });
  } catch (e) {
    console.error('Supabase invoice status sync failed', e);
    toast('Status tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e));
    setState({});
    return;
  }
  logAudit({ entity: 'invoice', target: inv.no, action: 'handed_wilbert' });
  toast(`${inv.no} → Diproses Wilbert`);
  setState({});
}

function openInvoiceModal(file) {
  const st = getState();
  setUI({ invoiceModal: true, invoiceForm: { no: '', supplierId: (st.suppliers[0] || {}).id || '', poRef: '', currency: 'IDR', amount: 0, due: '', ppnPaid: false, file: file || null } });
}

function invoiceModal() {
  const st = getState(); const f = st.ui.invoiceForm;
  const attachment = f.file
    ? h('div.row.gap8', { style: { alignItems: 'center' } }, [
        icon('file', 14, { stroke: 'var(--text-3)' }),
        h('span.mono', { style: { fontSize: '12px' } }, f.file.name),
        btn('Hapus', { sm: true, onClick: () => { f.file = null; setUI({}); } }),
      ])
    : dropzone({ title: 'Upload file invoice (opsional)', sub: 'PDF/gambar scan invoice supplier', accept: '.pdf,.jpg,.jpeg,.png', iconName: 'upload', compact: true, onFiles: files => { f.file = files[0]; setUI({}); } });
  return modal({
    title: 'Add Invoice', width: 480, onClose: () => setUI({ invoiceModal: false }),
    body: [
      field('No. Invoice', inputEl({ value: f.no, mono: true, onInput: v => (f.no = v) })),
      field(t('col_supplier'), selectEl(st.suppliers.map(s => ({ value: s.id, label: s.name })), { value: f.supplierId, onChange: v => (f.supplierId = v) })),
      field('PO Ref', inputEl({ value: f.poRef, onInput: v => (f.poRef = v) })),
      h('div.grid.g2', [
        field('Currency', selectEl(['IDR', 'USD', 'CNY', 'EUR'], { value: f.currency, onChange: v => (f.currency = v) })),
        field(t('col_amount'), inputEl({ mono: true, value: f.amount || '', onInput: v => (f.amount = Number(String(v).replace(/[,\s]/g, '')) || 0) })),
      ]),
      field(t('col_due'), h('input.input', { type: 'date', value: f.due, onInput: e => (f.due = e.target.value) })),
      field('Lampiran', attachment),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ invoiceModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveInvoiceModal() })],
  });
}

async function saveInvoiceModal() {
  const st = getState(); const f = st.ui.invoiceForm;
  const supplier = st.suppliers.find(s => s.id === f.supplierId);
  if (!f.no || !supplier || !f.due) { toast('No. Invoice, supplier, dan tanggal jatuh tempo wajib diisi'); return; }
  // uploadToDrive() never throws — it degrades to a drive-error:// placeholder
  // internally on failure, same graceful-degradation contract as every other
  // upload site (ppkek.js, finance.js).
  let files = [];
  if (f.file) {
    const up = await uploadToDrive(f.file, '', f.file.name, 'Invoice');
    files = [{ name: f.file.name, url: up.url, placeholder: !!up.placeholder }];
  }
  const local = { no: f.no, supplier: supplier.name, poRef: f.poRef, currency: f.currency, amount: f.amount, due: f.due, faktur: '', ppnPaid: f.ppnPaid, status: 'Diterima Purchasing', files };
  try {
    const saved = await insertInvoice(local);
    local.id = saved.id;
  } catch (e) {
    console.error('Supabase invoice insert failed', e);
    toast('Gagal simpan invoice ke server: ' + (e.message || e));
    return;
  }
  if (!local.id) local.id = uid('inv'); // demo mode: insertInvoice no-ops, keep a local id
  st.invoices.unshift(local);
  logAudit({ entity: 'invoice', target: local.no, action: 'create', detail: `${supplier.name} · ${money(local.amount, local.currency)}` });
  setUI({ invoiceModal: false });
  toast(`Invoice ${local.no} ditambahkan`);
}

// Shown only in PRF-generate-only mode (cania/visca) so it's obvious why the
// invoice intake table isn't here and where the outstanding list comes from.
function prfOnlyNote() {
  return card([h('div.card-pad', [
    h('div.row.gap8', [
      icon('card', 15, { stroke: 'var(--text-3)' }),
      h('div.card-title', 'Buat PRF'),
      badge('Generate only', 'gray', { iconName: 'eye' }),
    ]),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '8px', lineHeight: 1.5 } },
      'Invoice masuk & tracking status dipegang sekar/finance. Di sini cuma bikin PRF: yang muncul adalah invoice yang statusnya minimal "Diproses Wilbert" dan belum pernah masuk PRF. Satu PRF = satu currency. Detail rekening diambil otomatis dari master supplier.'),
  ])]);
}

function prfBuilder(st) {
  const ui = st.ui;
  const supplierId = ui.prfSupplierId || (st.suppliers[0] || {}).id;
  const supplierObj = st.suppliers.find(s => s.id === supplierId) || st.suppliers[0] || {};
  const supplier = supplierObj.name;
  // Outstanding invoices for supplier: at least "Diproses Wilbert", not Paid, not already PRF'd.
  const prfInvoiceNos = new Set(st.prfs.flatMap(p => p.invoices || []));
  const allOut = st.invoices.filter(i => i.supplier === supplier && i.status !== 'Paid' && i.status !== 'Diterima Purchasing' && !prfInvoiceNos.has(i.no));
  // A PRF is ONE currency only. Group by currency; user picks which when >1.
  const currencies = [...new Set(allOut.map(i => i.currency))];
  const currency = (ui.prfCcy && currencies.includes(ui.prfCcy)) ? ui.prfCcy : (currencies[0] || 'IDR');
  const outstanding = allOut.filter(i => i.currency === currency);
  const sel = ui.prfSel || {};                       // keyed by invoice.no
  const chosen = outstanding.filter(inv => sel[inv.no]);
  const sum = chosen.reduce((s, x) => s + x.amount, 0);

  return h('div.card', [
    h('div.card-head', [h('div.card-title', t('pay_prf_builder')), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, t('pay_prf_builder_sub'))]),
    h('div.row.gap8.wrap', { style: { padding: '13px 16px', borderBottom: '1px solid var(--border)' } }, [
      h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' } }, t('pay_supplier') + ':'),
      h('select.input', { style: { width: 'auto', minWidth: '260px' }, onChange: e => setUI({ prfSupplierId: e.target.value, prfSel: {}, prfCcy: null }) }, st.suppliers.map(s => h('option', { value: s.id, selected: s.id === supplierId }, s.name))),
      // Currency selector — enforces one currency per PRF (never mixed).
      ...(currencies.length > 1
        ? currencies.map(c => h('button.btn.btn-sm' + (c === currency ? '.btn-navy' : ''), { onClick: () => setUI({ prfCcy: c, prfSel: {} }) }, c))
        : [badge(currency, ccyTone(currency))]),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('pay_ccy_detected')),
    ]),
    ...(outstanding.length ? outstanding.map((inv) => h('div.row.gap12', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', background: sel[inv.no] ? 'var(--sel-row)' : 'transparent', cursor: 'pointer' }, onClick: () => { const s = { ...sel }; s[inv.no] = !s[inv.no]; setUI({ prfSel: s }); } }, [
      h('input', { type: 'checkbox', checked: !!sel[inv.no], style: { accentColor: 'var(--accent)' } }),
      h('div.grow', [h('div.mono', { style: { fontSize: '12px', fontWeight: 600 } }, inv.no), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, inv.poRef)]),
      h('span.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, 'due ' + fmtDate(inv.due)),
      h('span.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(inv.amount, inv.currency)),
    ])) : [h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, 'Tidak ada invoice outstanding untuk supplier ini (harus min. "Diproses Wilbert").')]),
    h('div.row.gap14', { style: { padding: '13px 16px', background: 'var(--surface2)' } }, [
      h('div', { style: { fontSize: '12.5px', fontWeight: 800 } }, [h('span.mono', { style: { color: 'var(--accent-tx)' } }, String(chosen.length)), ` invoice · Total `, h('span.mono', money(sum, currency))]),
      badge(currency, ccyTone(currency)),
      h('div.mla', btn(t('pay_preview_prf') + ' →', { variant: 'primary', disabled: !chosen.length, onClick: () => openPrf(chosen, currency, supplierObj) })),
    ]),
  ]);
}

function ccyTone(c) { return { USD: 'accent', EUR: 'blue', CNY: 'amber', IDR: 'navy' }[c] || 'gray'; }

// Takes the supplier OBJECT the builder already resolved by id.
//
// It used to take only the NAME and re-resolve with
//     st.suppliers.find(s => s.name === supplierName)
// which returns the FIRST row with that name. Supplier creation has no
// uniqueness check and unshifts new rows to the front of the array, so a second
// supplier with the same name and a different account won that lookup — and the
// printed PRF carried the wrong bank details. After a re-login the order comes
// from fetchSuppliers()'s order('name'), where duplicates tie and the winner is
// arbitrary.
async function openPrf(chosen, currency, supplierObj) {
  const st = getState();
  const supplier = supplierObj;
  const supplierName = supplier && supplier.name;
  if (!supplier) { toast('Supplier tidak ditemukan — pilih ulang dari dropdown'); return; }
  // NO number is allocated here.
  //
  // next_doc_seq() increments unconditionally and there is no way to hand a
  // number back, so allocating at PREVIEW time burned one every time the user
  // opened the modal, spotted a wrong invoice, closed it and previewed again —
  // and on every submit path that returned early. The result was permanent gaps
  // in a statutory Indonesian payment-request register. The number is now taken
  // in submitPrf(), immediately before the insert.
  const lines = chosen.map(inv => ({ no: inv.no, desc: descFor(inv), amount: inv.amount }));
  setUI({ prfModal: true, prfDraft: { no: '', supplier, supplierName, currency, amount: chosen.reduce((s, x) => s + x.amount, 0), invoices: chosen.map(i => i.no), lines, by: st.user.username, createdAt: new Date().toISOString(), stage: 'Terbentuk', receiveChecklist: { a: false, b: false, c: false, d: false } } });
}

// Learning bilingual description dictionary: prefill from prior entries.
function descFor(inv) {
  const st = getState();
  const po = st.pos.find(p => (p.contract && inv.poRef.includes(p.contract)) || p.no.includes((inv.poRef || '').replace('PO ', '')));
  const hint = po && po.items[0] ? po.items[0].d : inv.poRef;
  const dictHit = st.descDict.find(d => hint && (hint.includes(d.en) || (d.zh && hint.includes(d.zh))));
  return dictHit ? `${dictHit.en} / ${dictHit.zh}` : hint;
}

function prfModal() {
  const st = getState(); const d = st.ui.prfDraft;
  return modal({
    title: t('prf_preview'), width: 640, onClose: () => setUI({ prfModal: false }),
    body: [
      h('div', { style: { background: 'var(--bg)', padding: '20px', borderRadius: '10px' } }, prfPaper(d, d.supplier, d.lines)),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, [icon('warn', 11), ' ', t('prf_bank_from_master'), ' · ', t('prf_desc_hint')]),
      // The printed block always uses the APPROVED account (masterData.js stages
      // changes in pending_* until wilbert approves). This flags the remaining
      // case: a supplier whose account has never been reviewed at all.
      (d.supplier && d.supplier.bankChangePending)
        ? h('div.cfg-banner', { style: { marginTop: '8px' } }, [icon('warn', 14),
            `Rekening ${d.supplier.name} belum direview supervisor — cek ke Master Data sebelum PRF ini dikirim.`])
        : null,
    ],
    footer: [
      btn(t('close'), { onClick: () => setUI({ prfModal: false }) }),
      btn('PDF', { iconName: 'download', onClick: () => {
        if (!d.no) { toast('Nomor PRF baru terbit setelah dikirim ke Wilbert — kirim dulu, lalu unduh dari daftar PRF'); return; }
        const html = wrapPrintable(prfPaper(d, d.supplier, d.lines).outerHTML, d.no, 'landscape');
        const w = window.open('', '_blank');
        if (!w) { toast('Popup diblokir — izinkan popup buat Save PDF'); return; }
        w.document.write(html); w.document.close();
        w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
      } }),
      btn(t('prf_send_wilbert'), { variant: 'primary', onClick: () => submitPrf() }),
    ],
  });
}

async function submitPrf() {
  const st = getState(); const d = st.ui.prfDraft;
  // Learn descriptions — sync to Supabase too (desc_dict is wired since
  // Batch 1) so this PRF-side side-effect doesn't silently stay local-only
  // while the Master Data tab for the same table is fully persisted.
  for (const l of d.lines) {
    const parts = String(l.desc).split('/').map(s => s.trim());
    if (parts.length === 2 && !st.descDict.some(x => x.en === parts[0])) {
      const entry = { en: parts[0], zh: parts[1] };
      try {
        const saved = await insertDescDict(entry);
        entry.id = saved.id;
      } catch (e) {
        console.error('Supabase desc_dict learn-sync failed', e);
      }
      st.descDict.push(entry);
    }
  }
  // Allocate the register number NOW — one line before the insert, so the only
  // way to burn a number is an insert that actually reaches Postgres.
  let no = d.no;
  if (!no) {
    const prefix = `PRF/PC/${romanMonth()}/`;
    try {
      no = await nextPrfNo(st.prfs, romanMonth(), new Date().getFullYear(), prefix);
    } catch (e) {
      console.error('nextPrfNo failed', e);
      toast('Gagal generate nomor PRF dari server: ' + (e.message || e));
      return;
    }
  }
  const prf = { ...d, no, supplier: d.supplierName, stage: 'Diproses Wilbert' };
  delete prf.supplierName;
  try {
    const saved = await insertPrf(prf);
    prf.id = saved.id;
  } catch (e) {
    console.error('Supabase PRF insert failed', e);
    toast('Gagal simpan PRF ke server: ' + (e.message || e));
    return;
  }
  if (!prf.id) prf.id = uid('prf'); // demo mode: insertPrf no-ops, keep a local id
  st.prfs.unshift(prf);
  logAudit({ entity: 'prf', target: prf.no, action: 'create', detail: `${prf.invoices.length} invoices · ${money(prf.amount, prf.currency)}` });
  setUI({ prfModal: false, prfSel: {} });
  toast(`${prf.no} dibuat & dikirim ke Wilbert untuk approval`);
}
