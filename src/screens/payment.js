import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { blockWrite } from '../core/guard.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, statusTone, driveLink } from '../ui/components.js';
import { money, num, fmtDate, romanMonth, daysUntil, topDays, addDays, ccyTone } from '../core/format.js';
import { prfPaper } from '../ui/documents.js';
import { downloadBlob } from '../core/dom.js';
import { can } from '../auth/roles.js';
import { wrapPrintable } from './approval.js';
import { nextPrfNo } from '../core/docSeqApi.js';
import { uploadToDrive } from '../core/drive.js';
import { parseInvoicePdf } from '../parsers/invoicePdf.js';
import { insertInvoice, updateInvoice, deleteInvoice } from '../core/invoicesApi.js';
import { insertPrf } from '../core/prfsApi.js';
import { insertDescDict } from '../core/descDictApi.js';
import { UUID_RE } from '../core/supabase.js';

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

  // OBSERVE ONLY — neither half. This branch was missing, and its absence
  // inverted the whole screen: `!canIntake && canPrf` is false when BOTH caps
  // are false, so a role with zero capabilities fell through to the full intake
  // layout below and received MORE write buttons than cania/visca, who at least
  // land in the PRF-only branch. It must come first, because it is the
  // narrowest case.
  if (!canIntake && !canPrf) {
    return h('div.stack', [
      observeOnlyNote(),
      prfTrackingCard(st, true),
      invoiceTable(st, { readonly: true }),
    ]);
  }

  if (!canIntake && canPrf) {
    return h('div.stack', [
      prfOnlyNote(),
      prfBuilder(st),
      ui.prfModal ? prfModal() : null,
    ]);
  }

  // Faktur reminder ONLY when linked PO has PPN=Dibayar (paid) and faktur missing.
  // An OVERSEAS supplier never issues a faktur pajak — import VAT is paid at
  // customs and evidenced by the PPKEK/PIB, not by a tax invoice. Nagging for
  // one on an import is asking for a document that will never exist, and a
  // reminder that can never be satisfied is a reminder people learn to ignore.
  const overseas = new Set(st.suppliers.filter(s => s.overseas).map(s => s.name));
  const needFaktur = st.invoices.filter(i => !i.faktur && poPpnPaid(i) && i.status !== 'Paid' && !overseas.has(i.supplier));
  const banner = (ui.pfBannerClosed ? [] : needFaktur.slice(0, 1)).map(inv => h('div.cfg-banner', { style: { justifyContent: 'flex-start' } }, [
    icon('warn', 17), h('div.grow', [h('b', t('pay_faktur_warn'))]),
    btn(t('pay_upload_faktur'), { sm: true, onClick: () => uploadFaktur(inv) }),
    btn(t('pay_continue_anyway'), { sm: true, variant: 'primary', onClick: () => { setUI({ pfBannerClosed: true }); toast({ id: 'Diproses tanpa faktur pajak — ditandai follow-up', en: 'Processed without a tax invoice — flagged for follow-up', zh: '未附税票继续处理 — 已标记跟进' }); } }),
  ]));

  // No PDF invoice parser exists (unlike PO Converter's zcPoPdf.js) — dropping
  // a file here can't auto-fill invoice fields. It does carry the file itself
  // through as an attachment though: opens the same "Add Invoice" modal with
  // the dropped file pre-attached, uploaded to Drive (category "Invoice") on save.
  // MULTIPLE, but a QUEUE rather than a batch — and the difference is forced by
  // the data, not by taste. There is no invoice PDF parser (unlike PO
  // Converter's zcPoPdf.js), so the invoice number, currency, amount and due
  // date cannot be read from the file; someone has to type them. Processing
  // seven files "automatically" would mean seven invoices with blank numbers.
  //
  // So: drop the whole stack, and the Add Invoice modal walks through them one
  // at a time carrying "invoice 3 / 7", each with its file already attached.
  // The typing is the same; the twenty-one clicks of dropping them one by one
  // are gone.
  const dz = dropzone({
    title: t('pay_drop_inv'), sub: t('pay_faktur_reminder'), accept: '.pdf', iconName: 'upload', compact: true,
    multiple: true,
    onFiles: f => startInvoiceQueue(Array.from(f || [])),
  });

  const flow = card([h('div.card-pad', [
    h('div.row.gap8', [h('div.card-title', t('pay_flow')), readonly ? badge(t('pay_readonly'), 'gray', { iconName: 'eye' }) : null]),
    h('div.row.gap8.wrap', { style: { marginTop: '12px' } }, STAGES.flatMap((s, i) => [
      badge(`${i + 1} · ${trStage(s)}`, ['gray', 'amber', 'blue', 'green'][i]),
      i < 3 ? icon('arrowR', 13, { stroke: 'var(--text-3)' }) : null,
    ])),
    h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '10px' } }, tr({
      id: 'Invoice masuk PRF hanya setelah min. "Diproses Supervisor" · PRF USD & IDR terpisah per currency',
      en: 'An invoice joins a PRF only from "Processed by Supervisor" onwards · USD and IDR PRFs are separate per currency',
      zh: '发票须至少达到“主管处理中”才能进入付款申请单 · 美元与印尼盾付款申请单按币种分开',
    })),
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
      h('div.card-title', tr({ id: 'Progress PRF', en: 'PRF Progress', zh: '付款申请单进度' })),
      badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${st.prfs.length} PRF · status diubah oleh Finance`,
        en: `${st.prfs.length} PRF${st.prfs.length === 1 ? '' : 's'} · status changed by Finance`,
        zh: `${st.prfs.length} 张付款申请单 · 状态由财务更新`,
      })),
      // One PRF at a time was fine when there was one. USD and IDR are separate
      // PRFs per currency, so a single supplier already produces two, and a
      // week's run produces a stack — each needing its own click, its own print
      // dialog, its own Save As.
      list.length > 1 ? h('div.mla', btn(tr({
        id: `Download semua (${list.length}) · ZIP`,
        en: `Download all (${list.length}) · ZIP`,
        zh: `全部下载（${list.length}）· ZIP`,
      }), { sm: true, iconName: 'download', onClick: () => downloadAllPrf(list) })) : null,
    ]),
    list.length ? h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [tr({ id: 'No. PRF', en: 'PRF No.', zh: '付款申请单号' }), t('col_supplier'), t('col_amount'), tr({ id: 'Invoice', en: 'Invoice', zh: '发票' }), tr({ id: 'Dibuat', en: 'Created', zh: '创建' }), t('col_status')].map((c, i) => h('th' + (i === 2 ? '.r' : ''), c)))),
      h('tbody', list.map(p => h('tr', [
        h('td.mono.cell-strong', p.no),
        h('td', p.supplier),
        h('td.mono.r', money(p.amount, p.currency)),
        h('td.mono', { style: { color: 'var(--text-3)', fontSize: '10.5px' } }, (p.invoices || []).join(', ') || '—'),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${p.by || '—'} · ${fmtDate(p.createdAt)}`),
        h('td', h('div.row.gap8', [
          badge(trStage(p.stage), tone(p.stage)),
          p.paidAt ? h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, fmtDate(p.paidAt)) : null,
          // Second route to the document. Previously prfPaper() was reachable
          // ONLY from the preview modal, so once a PRF was submitted there was
          // no way back to it.
          btn('PDF', { sm: true, iconName: 'download', onClick: () => printPrf(p) }),
        ])),
      ]))),
    ])) : h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, tr({ id: 'Belum ada PRF dibuat.', en: 'No PRF has been created yet.', zh: '尚未创建任何付款申请单。' })),
  ]);
}

// Render + print any stored PRF. `prf.supplier` is a name string on a stored
// row, so the master record is looked up for the bank block — matching the
// anti-fraud rule that bank details always come from master, never the row.
function printPrf(prf) {
  const st = getState();
  const supplier = st.suppliers.find(s => s.name === prf.supplier) || { name: prf.supplier };
  const html = wrapPrintable(prfPaper(prf, supplier, prf.lines || []).outerHTML, prf.no, 'landscape');
  const w = window.open('', '_blank');
  if (!w) { toast({ id: 'Popup diblokir — izinkan popup buat Save PDF', en: 'Popup blocked — allow popups to save the PDF', zh: '弹窗被拦截 — 请允许弹窗以保存 PDF' }); return; }
  w.document.write(html); w.document.close();
  w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
}

// Every PRF on the card, zipped.
//
// The files are printable HTML, not PDF — the same format Surat Jalan already
// stores in Drive. This project bans html2pdf/html2canvas (they rasterise the
// page, so the result is a picture of a document: unsearchable, unselectable,
// and wrong at any zoom other than the one it was rendered at). The HTML opens
// in a browser and prints to PDF with the layout intact, which is what the
// single-PRF button has always done — this just does it in bulk without twenty
// print dialogs.
//
// Bank details come from the supplier MASTER for every one of them, not from
// the stored PRF row — the same anti-fraud rule the single-document path
// follows, and the reason this loops through the lookup rather than trusting
// what is on the row.
async function downloadAllPrf(list) {
  const rows = (list || []).filter(p => p && p.no);
  if (!rows.length) { toast({ id: 'Belum ada PRF untuk di-download', en: 'No PRF to download yet', zh: '暂无可下载的付款申请单' }); return; }
  toast(t('loading'));
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const st = getState();
    const used = new Set();
    for (const prf of rows) {
      const supplier = st.suppliers.find(x => x.name === prf.supplier) || { name: prf.supplier };
      const html = wrapPrintable(prfPaper(prf, supplier, prf.lines || []).outerHTML, prf.no, 'landscape');
      // PRF numbers carry slashes (PRF/PC/VII/012), which are path separators
      // inside a zip — left alone they would silently become nested folders.
      let name = `${String(prf.no).replace(/[\\/:*?"<>|]/g, '-')}.html`;
      // Two PRFs cannot share a number, but a local-only row might; a duplicate
      // name would overwrite silently.
      let n = 2;
      while (used.has(name)) name = `${String(prf.no).replace(/[\\/:*?"<>|]/g, '-')}-${n++}.html`;
      used.add(name);
      zip.file(name, html);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const now = new Date();
    const p2 = (v) => String(v).padStart(2, '0');
    downloadBlob(blob, `PRF ${p2(now.getDate())}${p2(now.getMonth() + 1)}${now.getFullYear()} ${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}.zip`);
    toast({
      id: `${rows.length} PRF di-download sebagai ZIP`,
      en: `${rows.length} PRFs downloaded as a ZIP`,
      zh: `${rows.length} 张付款申请单已打包下载`,
    });
  } catch (e) {
    console.error('PRF zip failed', e);
    toast({
      id: 'Gagal membuat ZIP: ' + (e.message || e),
      en: 'Could not build the ZIP: ' + (e.message || e),
      zh: '打包失败：' + (e.message || e),
    });
  }
}

// PRE-EXISTING CRASH, fixed here because this screen now has one more reader.
//
// `inv.poRef` is nullable — invoicesApi.js toRow() writes `po_ref: inv.poRef || null`
// — and `po.no` can be empty on a local-only row. Either one made
// `.replace(...)` / `.includes(...)` throw, and because this runs from
// invoiceTable() on EVERY render, a single invoice with no PO Ref replaced the
// whole Payment screen with the red "Terjadi kesalahan di layar ini" box. Not
// just for the observer: for sekar and wilbert too.
//
// A missing PO Ref simply means the invoice can't be matched to a PO, so fall
// back to the invoice's own ppnPaid flag — exactly what happens when the lookup
// finds nothing.
function poPpnPaid(inv) {
  const ref = inv && inv.poRef ? String(inv.poRef) : '';
  if (!ref) return !!(inv && inv.ppnPaid);
  const po = getState().pos.find(p => (p.no && p.no.includes(ref.replace('PO ', ''))) || (p.contract && ref.includes(p.contract)));
  return po ? po.ppnMode === 'paid' : inv.ppnPaid;
}
function trStage(s) { const m = { 'Diterima Purchasing': t('st_diterima_purchasing'), 'Diproses Wilbert': t('st_diproses_wilbert'), 'Diterima Finance': t('st_diterima_finance'), 'Paid': t('st_paid') }; return m[s] || s; }

function invoiceTable(st, opts) {
  // readonly: render the same table with no action buttons. Used by the
  // observe-only branch, which needs the invoice list for monitoring but must
  // offer no way to advance a stage or add a row.
  const readonly = !!(opts && opts.readonly);
  const head = h('thead', h('tr', [tr({ id: 'Invoice', en: 'Invoice', zh: '发票' }), t('col_supplier'), 'PO Ref', t('col_amount'), t('col_due'), t('pay_faktur'), tr({ id: 'File', en: 'File', zh: '文件' }), t('col_status')].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c))));
  const body = h('tbody', st.invoices.map(inv => {
    const d = daysUntil(inv.due);
    const dueTone = inv.status === 'Paid' ? '' : d < 0 ? 'red' : d <= 1 ? 'amber' : '';
    // Advancing an invoice is purchasing-side work (sekar's job), not a
    // finance-stage mutation — not gated by the finance "readonly" cap.
    const canAdvance = !readonly && inv.status === 'Diterima Purchasing';
    return h('tr', { style: inv.status === 'Diterima Purchasing' && !inv.faktur && poPpnPaid(inv) ? { background: 'var(--st-amber-bg)' } : {} }, [
      h('td.mono.cell-strong', inv.no),
      h('td', inv.supplier),
      h('td.mono', { style: { color: 'var(--text-3)' } }, inv.poRef),
      h('td.mono.r', money(inv.amount, inv.currency)),
      h('td.mono', { style: dueTone ? { color: `var(--st-${dueTone}-tx)`, fontWeight: 700 } : {} }, inv.status === 'Paid' ? tr({ id: 'paid', en: 'paid', zh: '已付款' }) : fmtDate(inv.due) + (d < 0 ? tr({ id: ` · overdue ${-d}h`, en: ` · overdue ${-d}d`, zh: ` · 逾期 ${-d} 天` }) : '')),
      h('td', inv.faktur ? h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } }, [icon('check', 11, { strokeWidth: 2.5 }), ' ', inv.faktur]) : badge(t('pay_faktur_missing'), 'amber', { iconName: 'warn' })),
      h('td', driveLink((inv.files && inv.files[0] && inv.files[0].url) || '')),
      h('td', h('div.row.gap8', [
        badge(trStage(inv.status), statusTone(inv.status)),
        // Named for what it GETS YOU, not for the internal step it performs.
        // It used to read "Handed to Wilbert", which is true and useless: it
        // describes a stage transition, and nobody comes to this screen wanting
        // a stage transition. Kyaru hit "why is there no PRF?" twice in a row
        // with this button sitting right there, unclicked — because nothing on
        // it suggested the PRF was on the other side of it.
        canAdvance ? btn(t('pay_create_prf'), { sm: true, variant: 'primary', onClick: () => advanceToPrf(inv) }) : null,
        // Delete is offered ONLY at stage 1. Past that the invoice has entered
        // the payment pipeline — it can be on a PRF, and a row that vanishes
        // from under a PRF leaves a document referencing something that no
        // longer exists. Correcting a typo is a stage-1 problem; anything later
        // is a decision with paperwork attached.
        canAdvance ? invDeleteBtn(inv) : null,
      ])),
    ]);
  }));
  return h('div.card', [
    h('div.card-head', [
      h('div.card-title', t('pay_inv_in')),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${st.invoices.length} invoice`,
        en: `${st.invoices.length} invoice${st.invoices.length === 1 ? '' : 's'}`,
        zh: `${st.invoices.length} 张发票`,
      })),
      readonly ? null : h('div.mla', btn(tr({ id: 'Add Invoice', en: 'Add Invoice', zh: '新增发票' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openInvoiceModal() })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [head, body])),
  ]);
}

async function uploadFaktur(inv) {
  if (blockWrite('upload faktur pajak')) return;
  // Faktur number is still simulated (no real OCR/upload pipeline) — this
  // fix is scoped to persistence, not to building real faktur-pajak intake.
  inv.faktur = '010.005-26.' + Math.floor(Math.random() * 1e8);
  try {
    await updateInvoice(inv.id, { faktur: inv.faktur });
  } catch (e) {
    console.error('Supabase invoice faktur sync failed', e);
    toast({
      id: 'Faktur tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Tax invoice saved locally, but sync to server failed: ' + (e.message || e),
      zh: '税票已本地保存，但同步到服务器失败：' + (e.message || e),
    });
    setState({});
    return;
  }
  toast({ id: 'Faktur pajak terupload', en: 'Tax invoice uploaded', zh: '税票已上传' });
  setState({});
}

// Two-step delete, same shape as Master Data's: no native confirm() dialogs,
// and the second click is the one that acts. The label says what it will
// destroy, because "Sure?" on its own is a question about nothing.
function invDeleteBtn(inv) {
  const st = getState();
  const key = 'inv:' + inv.id;
  const pending = (st.ui.invDelConfirm || {})[key];
  const setPending = (v) => setUI({ invDelConfirm: { ...(st.ui.invDelConfirm || {}), [key]: v } });
  if (!pending) return btn(t('delete'), { sm: true, onClick: () => setPending(true) });
  return h('div.row.gap8', [
    h('button.btn.btn-sm', {
      style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 },
      onClick: () => removeInvoice(inv),
    }, tr({ id: 'Hapus permanen?', en: 'Delete for good?', zh: '确定永久删除？' })),
    btn(t('cancel'), { sm: true, onClick: () => setPending(false) }),
  ]);
}

async function removeInvoice(inv) {
  if (blockWrite('hapus invoice')) return;
  const st = getState();

  // Belt and braces. Stage 1 cannot be on a PRF by construction, but "cannot"
  // is an assumption about every past and future code path, and this is the
  // one operation with no undo. If a PRF names this invoice, refuse and say
  // which one — deleting it would leave a payment document pointing at a row
  // that no longer exists.
  const onPrf = st.prfs.find(p => (p.invoices || []).includes(inv.no) || (p.lines || []).some(l => l.no === inv.no));
  if (onPrf) {
    toast({
      id: `Tidak bisa dihapus — invoice ini dipakai di PRF ${onPrf.no}.`,
      en: `Cannot delete — this invoice is used on PRF ${onPrf.no}.`,
      zh: `无法删除 — 该发票已用于付款申请单 ${onPrf.no}。`,
    });
    setUI({ invDelConfirm: {} });
    return;
  }

  try {
    if (inv.id && UUID_RE.test(inv.id)) await deleteInvoice(inv.id);
  } catch (e) {
    // Do NOT drop it locally when the server refused. A row that disappears
    // from the screen but survives on the server comes back at the next
    // refresh, and in between someone re-enters it — which the duplicate guard
    // then blocks, for reasons nobody can see.
    console.error('Supabase invoice delete failed', e);
    toast({
      id: 'Gagal hapus di server — invoice tidak jadi dihapus: ' + (e.message || e),
      en: 'Server delete failed — the invoice was not removed: ' + (e.message || e),
      zh: '服务器删除失败 — 发票未被删除：' + (e.message || e),
    });
    setUI({ invDelConfirm: {} });
    return;
  }

  st.invoices = st.invoices.filter(i => i !== inv);
  // The audit line carries what the row WAS. After a delete there is nothing
  // left to look up, so anything the log omits is gone for good.
  logAudit({
    entity: 'invoice', target: inv.no, action: 'delete',
    detail: `${inv.supplier} · ${money(inv.amount, inv.currency)} · jatuh tempo ${fmtDate(inv.due)}`,
  });
  setUI({ invDelConfirm: {} });
  setState({ invoices: st.invoices });
  toast({
    id: `Invoice ${inv.no} dihapus — tercatat di History`,
    en: `Invoice ${inv.no} deleted — recorded in History`,
    zh: `发票 ${inv.no} 已删除 — 已记入历史`,
  });
}

// Move the invoice to the stage where it becomes PRF-able, and then actually
// take the user there — pointed at this supplier, this currency, this invoice
// already ticked. A button called "Create PRF" that only changed a badge would
// be a worse lie than the old label.
//
// The STAGE NAME is untouched: 'Diproses Wilbert' is stored in the database and
// on every audit row, and renaming stored values to fix a button is how history
// stops matching itself. Only the label changed.
async function advanceToPrf(inv) {
  if (blockWrite('serahkan invoice ke Wilbert')) return;
  inv.status = 'Diproses Wilbert';
  try {
    await updateInvoice(inv.id, { status: inv.status });
  } catch (e) {
    console.error('Supabase invoice status sync failed', e);
    toast({
      id: 'Status tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Status saved locally, but sync to server failed: ' + (e.message || e),
      zh: '状态已本地保存，但同步到服务器失败：' + (e.message || e),
    });
    setState({});
    return;
  }
  logAudit({ entity: 'invoice', target: inv.no, action: 'handed_wilbert' });

  // Point the PRF builder at this invoice and tick it. Without this the click
  // "worked" and the screen looked identical except for one badge, which is
  // exactly the dead end the rename is meant to remove.
  const st = getState();
  const sup = st.suppliers.find(x => x.name === inv.supplier);
  setUI({
    prfSupplierId: sup ? sup.id : st.ui.prfSupplierId,
    prfCcy: inv.currency,
    prfSel: { ...(st.ui.prfSel || {}), [inv.no]: true },
  });
  toast({
    id: `${inv.no} siap dibuatkan PRF — sudah dicentang di PRF Builder di bawah`,
    en: `${inv.no} is ready for a PRF — already ticked in the PRF Builder below`,
    zh: `${inv.no} 已可开具付款申请单 — 下方付款申请单构建器中已勾选`,
  });
  setState({});
  // Scroll the builder into view. requestAnimationFrame so it runs after the
  // re-render setState() just queued, otherwise this measures the old layout.
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll('.content .card')].find(c => /PRF Builder/i.test(c.innerText));
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

async function openInvoiceModal(file) {
  const st = getState();
  // Open in the selected supplier's billing currency. Starting every entry at
  // IDR meant a USD supplier was one forgotten dropdown away from an invoice
  // recorded in the wrong currency — and the amount would look perfectly
  // reasonable either way.
  const first = st.suppliers[0] || {};
  const form = { no: '', supplierId: first.id || '', poRef: '', currency: first.currency || 'IDR', amount: 0, due: '', ppnPaid: false, file: file || null };
  // Open FIRST, fill after. Reading a PDF takes a moment, and a modal that
  // appears only once the file has been read looks like a click that did
  // nothing — on a queue of seven that happens seven times.
  setUI({ invoiceModal: true, invoiceForm: form, invoiceRead: null });
  if (!file || !/\.pdf$/i.test(file.name || '')) return;
  try {
    const r = await parseInvoicePdf(file, st.suppliers);
    // The form object is the same one the inputs are bound to, and the user may
    // already have started typing into it. Never overwrite what they typed.
    const cur = getState().ui.invoiceForm;
    if (cur !== form) return;
    if (r.no && !form.no) form.no = r.no;
    if (r.poRef && !form.poRef) form.poRef = r.poRef;
    if (r.due && !form.due) form.due = r.due;
    if (r.currency) form.currency = r.currency;
    if (r.amount && !form.amount) form.amount = r.amount;
    if (r.supplierId) form.supplierId = r.supplierId;

    // The document did not state its terms, but the supplier's master record
    // does. Deriving the due date from master is a real answer — it is the
    // agreement on file — as long as it is labelled as coming from there and
    // not from the paper, which `found` does.
    if (!form.due && r.date && !r.termDays && form.supplierId) {
      const sup = getState().suppliers.find(s => s.id === form.supplierId);
      const days = sup ? topDays(sup.top) : 0;
      if (days > 0) {
        // UTC throughout — see addDaysIso() in parsers/invoicePdf.js. Mixing a
        // local-midnight Date with toISOString() lands a day early in every
        // timezone east of Greenwich, Jakarta included.
        const d = new Date(`${r.date}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        form.due = d.toISOString().slice(0, 10);
        r.dueFromMaster = days;
      }
    }
    setUI({ invoiceRead: r });
    // Say it out loud, not just in a panel. On a queue the modal is replaced
    // every few seconds, and a grey box inside it is easy to walk straight past
    // — then the invoice gets saved with a blank number and nobody knows why.
    const q = getState().ui;
    if (r.scanned) {
      setUI({ invoiceScans: (q.invoiceScans || 0) + 1 });
      toast({
        id: `${file.name} — PDF hasil scan, tidak ada teks yang bisa dibaca. Isi manual.`,
        en: `${file.name} — scanned PDF, no readable text inside. Fill it in by hand.`,
        zh: `${file.name} — 扫描件 PDF，内部没有可读文字，请手动填写。`,
      });
    } else if (r.found.length) {
      setUI({ invoiceRead2: (q.invoiceRead2 || 0) + 1 });
    }
  } catch (e) {
    console.warn('invoice prefill skipped', e);
  }
}

// The dropped stack, minus the one currently in the modal. Kept in ui so a
// re-render cannot lose it.
function startInvoiceQueue(files) {
  const pdfs = files.filter(f => /\.(pdf|jpe?g|png)$/i.test(f.name || ''));
  const skipped = files.length - pdfs.length;
  if (!pdfs.length) {
    toast({ id: 'Tidak ada file invoice yang bisa dibaca di antara yang di-drop', en: 'No usable invoice files among those dropped', zh: '拖入的文件中没有可用的发票文件' });
    return;
  }
  setUI({ invoiceQueue: pdfs.slice(1), invoiceQueueTotal: pdfs.length, invoiceScans: 0, invoiceRead2: 0 });
  openInvoiceModal(pdfs[0]);
  if (pdfs.length > 1 || skipped) {
    toast({
      id: `${pdfs.length} file — isi detailnya satu per satu${skipped ? `, ${skipped} file dilewati` : ''}`,
      en: `${pdfs.length} files — fill in the details one at a time${skipped ? `, ${skipped} skipped` : ''}`,
      zh: `${pdfs.length} 个文件 — 请逐个填写明细${skipped ? `，已跳过 ${skipped} 个` : ''}`,
    });
  }
}

// Move to the next file in the queue, or close. Used by Save and by Skip, so
// there is exactly one place that decides what "next" means.
function nextInvoiceInQueue() {
  const ui = getState().ui;
  const q = ui.invoiceQueue || [];
  if (!q.length) {
    // End of the stack: say how many of them could not be read at all. One
    // scan is a nuisance; five out of seven is worth knowing about the batch
    // before wondering why so little filled itself in.
    const scans = ui.invoiceScans || 0, total = ui.invoiceQueueTotal || 0;
    setUI({ invoiceModal: false, invoiceQueue: null, invoiceQueueTotal: 0, invoiceScans: 0, invoiceRead2: 0 });
    if (total > 1 && scans) {
      toast({
        id: `${scans} dari ${total} file hasil scan — yang itu tidak bisa diisi otomatis`,
        en: `${scans} of ${total} files are scans — those cannot be filled automatically`,
        zh: `${total} 个文件中有 ${scans} 个为扫描件 — 这些无法自动填写`,
      });
    }
    return false;
  }
  setUI({ invoiceQueue: q.slice(1) });
  openInvoiceModal(q[0]);
  return true;
}

function invoiceModal() {
  const st = getState(); const f = st.ui.invoiceForm;
  const attachment = f.file
    ? h('div.row.gap8', { style: { alignItems: 'center' } }, [
        icon('file', 14, { stroke: 'var(--text-3)' }),
        h('span.mono', { style: { fontSize: '12px' } }, f.file.name),
        btn(tr({ id: 'Hapus', en: 'Remove', zh: '移除' }), { sm: true, onClick: () => { f.file = null; setUI({}); } }),
      ])
    : dropzone({ title: tr({ id: 'Upload file invoice (opsional)', en: 'Upload invoice file (optional)', zh: '上传发票文件（可选）' }), sub: tr({ id: 'PDF/gambar scan invoice supplier', en: 'PDF or scanned image of the supplier invoice', zh: '供应商发票的 PDF 或扫描件' }), accept: '.pdf,.jpg,.jpeg,.png', iconName: 'upload', compact: true, onFiles: files => { f.file = files[0]; setUI({}); } });
  // Position in the dropped stack. Without it there is no way to tell a queue
  // of seven from a single file, and no way to know how many are still coming.
  const total = st.ui.invoiceQueueTotal || 0;
  const left = (st.ui.invoiceQueue || []).length;
  const idx = total ? total - left : 0;
  return modal({
    title: tr({ id: 'Add Invoice', en: 'Add Invoice', zh: '新增发票' }),
    subtitle: total > 1 ? tr({
      id: `Invoice ${idx} dari ${total}${f.file ? ' · ' + f.file.name : ''}`,
      en: `Invoice ${idx} of ${total}${f.file ? ' · ' + f.file.name : ''}`,
      zh: `第 ${idx} / ${total} 张发票${f.file ? ' · ' + f.file.name : ''}`,
    }) : null,
    width: 480,
    // Closing abandons the WHOLE queue, not just this one. Anything already
    // saved stays saved.
    onClose: () => setUI({ invoiceModal: false, invoiceQueue: null, invoiceQueueTotal: 0 }),
    body: [
      field(tr({ id: 'No. Invoice', en: 'Invoice No.', zh: '发票号' }), inputEl({ value: f.no, mono: true, onInput: v => (f.no = v) })),
      field(t('col_supplier'), selectEl(st.suppliers.map(s => ({ value: s.id, label: s.name })), { value: f.supplierId, onChange: v => (f.supplierId = v) })),
      field('PO Ref', inputEl({ value: f.poRef, onInput: v => (f.poRef = v) })),
      h('div.grid.g2', [
        field(tr({ id: 'Currency', en: 'Currency', zh: '币种' }), selectEl(['IDR', 'USD', 'CNY', 'EUR'], { value: f.currency, onChange: v => (f.currency = v) })),
        field(t('col_amount'), inputEl({ mono: true, value: f.amount || '', onInput: v => (f.amount = Number(String(v).replace(/[,\s]/g, '')) || 0) })),
      ]),
      field(t('col_due'), h('input.input', { type: 'date', value: f.due, onInput: e => (f.due = e.target.value) })),
      field(tr({ id: 'Lampiran', en: 'Attachment', zh: '附件' }), attachment),
      prefillNote(st.ui.invoiceRead),
    ],
    footer: [
      btn(t('cancel'), { onClick: () => setUI({ invoiceModal: false, invoiceQueue: null, invoiceQueueTotal: 0 }) }),
      // Skip exists because a dropped stack will contain the odd file that is
      // not an invoice, and without it the only way past that file is to
      // abandon the remaining six.
      // Shown for the whole queue, including the LAST file. Without it the only
      // way past an unusable final scan was Cancel — which abandons rather than
      // finishes, so the run never got its closing summary.
      total > 1 ? btn(tr({ id: 'Lewati', en: 'Skip', zh: '跳过' }), { onClick: () => nextInvoiceInQueue() }) : null,
      btn(left ? tr({ id: 'Simpan & lanjut', en: 'Save & next', zh: '保存并继续' }) : t('save'), { variant: 'primary', onClick: () => saveInvoiceModal() }),
    ],
  });
}

// What the PDF gave, said plainly.
//
// A pre-filled box looks exactly like a box someone typed, and this form ends
// at a bank transfer. So every field that came from the file is NAMED, and the
// note says to check them. It is deliberately not a quiet green tick.
//
// A scan gets its own message rather than silence: "nothing was filled" and
// "this file has no text in it" are different facts, and only the second one
// tells you not to bother waiting.
function prefillNote(r) {
  if (!r) return null;
  const LABELS = {
    no: tr({ id: 'No. Invoice', en: 'Invoice no.', zh: '发票号' }),
    poRef: tr({ id: 'PO / kontrak', en: 'PO / contract', zh: '合同号' }),
    date: tr({ id: 'tanggal invoice', en: 'invoice date', zh: '发票日期' }),
    termDays: tr({ id: 'termin', en: 'terms', zh: '账期' }),
    due: tr({ id: 'jatuh tempo', en: 'due date', zh: '到期日' }),
    amount: tr({ id: 'nominal', en: 'amount', zh: '金额' }),
    currency: tr({ id: 'currency', en: 'currency', zh: '币种' }),
    supplier: tr({ id: 'supplier', en: 'supplier', zh: '供应商' }),
  };
  const box = (bg, fg, text) => h('div', { style: { background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: '8px', padding: '8px 11px', fontSize: '11px', fontWeight: 600, lineHeight: 1.5 } }, text);
  if (r.scanned) {
    return box('var(--navy-soft)', 'var(--navy-soft-tx)', tr({
      id: 'PDF ini hasil scan — tidak ada teks di dalamnya, jadi tidak ada yang bisa diisi otomatis. Isi manual seperti biasa.',
      en: 'This PDF is a scan — there is no text inside it, so nothing could be filled in. Type the details as usual.',
      zh: '此 PDF 为扫描件 — 内部没有文字，无法自动填写，请照常手动输入。',
    }));
  }
  if (!r.found || !r.found.length) {
    return box('var(--surface2)', 'var(--text-3)', tr({
      id: 'Format invoice ini belum dikenali — tidak ada yang diisi otomatis. Isi manual seperti biasa.',
      en: 'This invoice layout is not recognised yet — nothing was filled in. Type the details as usual.',
      zh: '尚未识别该发票版式 — 未自动填写任何内容，请照常手动输入。',
    }));
  }
  const named = r.found.map(k => LABELS[k]).filter(Boolean).join(', ');
  const notes = [tr({
    id: `Diisi dari PDF: ${named}. CEK DULU sebelum simpan — ini jadi dasar pembayaran.`,
    en: `Filled from the PDF: ${named}. CHECK THESE before saving — they become a payment.`,
    zh: `已从 PDF 填入：${named}。保存前请核对 — 这些将成为付款依据。`,
  })];
  // The due date came from the supplier's agreed terms, not from this page.
  // Different provenance, said plainly, because "the PDF says so" and "our
  // master record says so" are not the same claim.
  if (r.dueFromMaster) {
    notes.push(tr({
      id: `Jatuh tempo dihitung dari TOP master supplier (${r.dueFromMaster} hari) — invoice ini tidak mencantumkan termin.`,
      en: `Due date derived from the supplier's master terms (${r.dueFromMaster} days) — this invoice does not state any.`,
      zh: `到期日按供应商主数据账期推算（${r.dueFromMaster} 天）— 此发票未注明账期。`,
    }));
  }
  // 2/9/2026 is either 2 September or 9 February, and nothing on the page can
  // settle it. Day-first is what every unambiguous document in the corpus uses,
  // so that is what was filled — but with 90-day terms the wrong reading moves
  // the payment by seven months, which is too expensive to leave unsaid.
  if (r.dateAmbiguous) {
    notes.push(tr({
      id: 'Format tanggalnya ambigu (bisa dibaca hari-bulan atau bulan-hari). Dibaca sebagai TANGGAL dulu — cocokkan dengan invoice aslinya.',
      en: 'The date format is ambiguous (day-month or month-day). Read as DAY first — check it against the paper invoice.',
      zh: '日期格式存在歧义（日-月或月-日）。已按“日”在前解读 — 请与纸质发票核对。',
    }));
  }
  return box('var(--st-amber-bg)', 'var(--st-amber-tx)', notes.map((n, i) => h('div', { style: i ? { marginTop: '6px' } : {} }, n)));
}

async function saveInvoiceModal() {
  if (blockWrite('simpan invoice')) return;
  const st = getState(); const f = st.ui.invoiceForm;
  const supplier = st.suppliers.find(s => s.id === f.supplierId);
  if (!f.no || !supplier || !f.due) { toast({ id: 'No. Invoice, supplier, dan tanggal jatuh tempo wajib diisi', en: 'Invoice no., supplier and due date are required', zh: '发票号、供应商和到期日为必填项' }); return; }

  // ONE INVOICE NUMBER, ONE INVOICE, PER SUPPLIER.
  //
  // Kyaru dropped the same PDF twice and ended up with two identical rows.
  // Both would advance, both would appear in the PRF builder looking the same,
  // and a PRF built from both pays 25,459.20 twice. Double payment is the
  // commonest way money leaves an AP function, and it does not look like a
  // mistake at any point along the way — every row is individually correct.
  //
  // Compared case-insensitively and whitespace-stripped, because "IN-HC-001"
  // and "in-hc-001 " are the same invoice to everyone except a string compare.
  // Scoped to the SUPPLIER: two different suppliers can legitimately both use
  // "INV-001", and rejecting that would block real work.
  //
  // This is the client-side half. The database half is a unique index (see
  // supabase_invoice_no_unique.sql) — needed because this check reads state
  // loaded at login, so two people entering the same invoice at the same time
  // would both pass it.
  const key = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();
  const clash = st.invoices.find(i => i.supplier === supplier.name && key(i.no) === key(f.no));
  if (clash) {
    toast({
      id: `No. Invoice ${f.no} sudah ada untuk ${supplier.name} (${money(clash.amount, clash.currency)}, jatuh tempo ${fmtDate(clash.due)}). Tidak disimpan — invoice kembar bisa kebayar dua kali.`,
      en: `Invoice no. ${f.no} already exists for ${supplier.name} (${money(clash.amount, clash.currency)}, due ${fmtDate(clash.due)}). Not saved — a duplicate can be paid twice.`,
      zh: `${supplier.name} 已存在发票号 ${f.no}（${money(clash.amount, clash.currency)}，到期 ${fmtDate(clash.due)}）。未保存 — 重复发票可能被支付两次。`,
    });
    return;
  }

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
    toast({
      id: 'Gagal simpan invoice ke server: ' + (e.message || e),
      en: 'Failed to save the invoice to the server: ' + (e.message || e),
      zh: '发票保存到服务器失败：' + (e.message || e),
    });
    return;
  }
  if (!local.id) local.id = uid('inv'); // demo mode: insertInvoice no-ops, keep a local id
  st.invoices.unshift(local);
  logAudit({ entity: 'invoice', target: local.no, action: 'create', detail: `${supplier.name} · ${money(local.amount, local.currency)}` });
  // Straight on to the next file in the stack; closes only when it runs out.
  const more = nextInvoiceInQueue();
  toast(more
    ? { id: `Invoice ${local.no} ditambahkan — lanjut ke berikutnya`, en: `Invoice ${local.no} added — on to the next`, zh: `发票 ${local.no} 已添加 — 继续下一张` }
    : { id: `Invoice ${local.no} ditambahkan`, en: `Invoice ${local.no} added`, zh: `发票 ${local.no} 已添加` });
}

// Shown only in PRF-generate-only mode (cania/visca) so it's obvious why the
// invoice intake table isn't here and where the outstanding list comes from.
function prfOnlyNote() {
  return card([h('div.card-pad', [
    h('div.row.gap8', [
      icon('card', 15, { stroke: 'var(--text-3)' }),
      h('div.card-title', tr({ id: 'Buat PRF', en: 'Create PRF', zh: '生成付款申请单' })),
      badge(tr({ id: 'Generate only', en: 'Generate only', zh: '仅生成' }), 'gray', { iconName: 'eye' }),
    ]),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '8px', lineHeight: 1.5 } },
      tr({
        id: 'Invoice masuk & tracking status dipegang sekar/finance. Di sini cuma bikin PRF: yang muncul adalah invoice yang statusnya minimal "Diproses Supervisor" dan belum pernah masuk PRF. Satu PRF = satu currency. Detail rekening diambil otomatis dari master supplier.',
        en: 'Invoice intake & status tracking belong to sekar/finance. This screen only builds PRFs: it lists invoices that are at least "Processed by Supervisor" and have never been on a PRF. One PRF = one currency. Bank details are pulled automatically from the supplier master.',
        zh: '发票录入与状态跟踪由 sekar/财务负责。此处仅生成付款申请单：列出状态至少为“主管处理中”且从未进入付款申请单的发票。一张付款申请单只对应一种币种。账户信息自动取自供应商主数据。',
      })),
  ])]);
}

// Shown to an account that holds neither half of this screen — it sees where
// every invoice and PRF got to, and can act on none of it.
function observeOnlyNote() {
  return card([h('div.card-pad', [
    h('div.row.gap8', [
      icon('eye', 15, { stroke: 'var(--text-3)' }),
      h('div.card-title', tr({ id: 'Payment — Pantau', en: 'Payment — Monitoring', zh: '付款 — 查看' })),
      badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' }),
    ]),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '8px', lineHeight: 1.5 } },
      tr({
        id: 'Akun ini cuma memantau. Invoice masuk dipegang sekar, PRF dibikin sekar/cania/visca, status bayar diubah Finance. Di sini kelihatan posisi tiap dokumen tanpa tombol aksi apa pun.',
        en: 'This account only monitors. Invoice intake belongs to sekar, PRFs are raised by sekar/cania/visca, and payment status is changed by Finance. You can see where every document stands here, with no action buttons at all.',
        zh: '此账号仅用于查看。发票录入由 sekar 负责，付款申请单由 sekar/cania/visca 生成，付款状态由财务更新。此处可查看每份单据的进度，但没有任何操作按钮。',
      })),
  ])]);
}

// What to say when the builder has nothing to show. "No outstanding invoices"
// is accurate and a dead end — it names the absence without naming the cause,
// and the cause was usually one unclicked button on the table directly above.
// So: if this supplier HAS invoices that simply have not been advanced yet,
// say that instead, and count them.
function emptyBuilderNote(st, supplierId) {
  const sup = st.suppliers.find(s => s.id === supplierId);
  const waiting = sup ? st.invoices.filter(i => i.supplier === sup.name && i.status === 'Diterima Purchasing') : [];
  const style = { padding: '16px', fontSize: '12px', color: 'var(--text-3)' };
  if (!waiting.length) {
    return h('div', { style }, tr({
      id: 'Belum ada invoice outstanding untuk supplier ini.',
      en: 'No outstanding invoices for this supplier yet.',
      zh: '该供应商暂无未付发票。',
    }));
  }
  return h('div', { style: { ...style, color: 'var(--st-amber-tx)', fontWeight: 600 } }, tr({
    id: `${waiting.length} invoice supplier ini masih di tahap 1 — klik "Buat PRF" di baris invoice-nya (tabel di atas) supaya bisa dipilih di sini.`,
    en: `${waiting.length} invoice${waiting.length === 1 ? '' : 's'} for this supplier are still at stage 1 — press "Create PRF" on the invoice row above to bring them here.`,
    zh: `该供应商有 ${waiting.length} 张发票仍处于第 1 阶段 — 请在上方发票行点击"开具付款申请单"后才能在此选择。`,
  }));
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
  // With eligible invoices, the currency comes from them. With none, it comes
  // from the supplier's master record — which is a real answer, not the 'IDR'
  // literal this used to fall back to. A supplier who has never been billed in
  // rupiah should never see IDR sitting in this box.
  const supDefaultCcy = (st.suppliers.find(s => s.id === supplierId) || {}).currency || 'IDR';
  const currency = (ui.prfCcy && currencies.includes(ui.prfCcy)) ? ui.prfCcy : (currencies[0] || supDefaultCcy);
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
      //
      // The caption says which of the two sources this came from. It used to
      // read "detected from invoices" unconditionally, so with nothing eligible
      // it announced a detection that never happened — and next to a USD
      // invoice one panel above, the 'IDR' fallback read as though the portal
      // had decided the invoice was rupiah.
      ...(currencies.length > 1
        ? currencies.map(c => h('button.btn.btn-sm' + (c === currency ? '.btn-navy' : ''), { onClick: () => setUI({ prfCcy: c, prfSel: {} }) }, c))
        : [badge(currency, ccyTone(currency))]),
      h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
        currencies.length ? t('pay_ccy_detected') : t('pay_ccy_from_master')),
    ]),
    ...(outstanding.length ? outstanding.map((inv) => h('div.row.gap12', { style: { padding: '10px 16px', borderBottom: '1px solid var(--border)', background: sel[inv.no] ? 'var(--sel-row)' : 'transparent', cursor: 'pointer' }, onClick: () => { const s = { ...sel }; s[inv.no] = !s[inv.no]; setUI({ prfSel: s }); } }, [
      h('input', { type: 'checkbox', checked: !!sel[inv.no], style: { accentColor: 'var(--accent)' } }),
      h('div.grow', [h('div.mono', { style: { fontSize: '12px', fontWeight: 600 } }, inv.no), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, inv.poRef)]),
      h('span.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({ id: 'due ' + fmtDate(inv.due), en: 'due ' + fmtDate(inv.due), zh: '到期 ' + fmtDate(inv.due) })),
      h('span.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(inv.amount, inv.currency)),
    ])) : [emptyBuilderNote(st, supplierId)]),
    h('div.row.gap14', { style: { padding: '13px 16px', background: 'var(--surface2)' } }, [
      h('div', { style: { fontSize: '12.5px', fontWeight: 800 } }, [h('span.mono', { style: { color: 'var(--accent-tx)' } }, String(chosen.length)), tr({
        id: ` invoice · Total `,
        en: ` invoice${chosen.length === 1 ? '' : 's'} · Total `,
        zh: ` 张发票 · 合计 `,
      }), h('span.mono', money(sum, currency))]),
      badge(currency, ccyTone(currency)),
      h('div.mla', btn(t('pay_preview_prf') + ' →', { variant: 'primary', disabled: !chosen.length, onClick: () => openPrf(chosen, currency, supplierObj) })),
    ]),
  ]);
}


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
  if (!supplier) { toast({ id: 'Supplier tidak ditemukan — pilih ulang dari dropdown', en: 'Supplier not found — pick it again from the dropdown', zh: '未找到供应商 — 请从下拉列表重新选择' }); return; }
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
      // A warning used to sit here for an account "not yet reviewed". With the
      // review queue removed there is no such state — every account on file IS
      // the live one. What still deserves a warning is the case that actually
      // costs money: no account on file at all, which prints a payment request
      // with nowhere to send it.
      (d.supplier && !d.supplier.acct)
        ? h('div.cfg-banner', { style: { marginTop: '8px' } }, [icon('warn', 14),
            tr({
              id: `${d.supplier.name} belum punya nomor rekening di Master Data — PRF ini kecetak tanpa tujuan transfer.`,
              en: `${d.supplier.name} has no account number in Master Data — this PRF will print with no transfer destination.`,
              zh: `${d.supplier.name} 在主数据中没有银行账号 — 本付款申请单将没有收款账户。`,
            })])
        : null,
    ],
    footer: [
      btn(t('close'), { onClick: () => setUI({ prfModal: false }) }),
      btn('PDF', { iconName: 'download', onClick: () => {
        if (!d.no) { toast({
          id: 'Nomor PRF baru terbit setelah dikirim ke supervisor — kirim dulu, lalu unduh dari daftar PRF',
          en: 'The PRF number is issued only after it is sent to the supervisor — send it first, then download from the PRF list',
          zh: '付款申请单编号在发送主管之后才生成 — 请先发送，再从付款申请单列表下载',
        }); return; }
        const html = wrapPrintable(prfPaper(d, d.supplier, d.lines).outerHTML, d.no, 'landscape');
        const w = window.open('', '_blank');
        if (!w) { toast({ id: 'Popup diblokir — izinkan popup buat Save PDF', en: 'Popup blocked — allow popups to save the PDF', zh: '弹窗被拦截 — 请允许弹窗以保存 PDF' }); return; }
        w.document.write(html); w.document.close();
        w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
      } }),
      d.submitted
        ? btn(t('close') + tr({ id: ' & selesai', en: ' & done', zh: ' 并完成' }), { variant: 'primary', onClick: () => setUI({ prfModal: false, prfDraft: null }) })
        : btn(t('prf_send_wilbert'), { variant: 'primary', onClick: () => submitPrf() }),
    ],
  });
}

async function submitPrf() {
  if (blockWrite('kirim PRF')) return;
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
      toast({
        id: 'Gagal generate nomor PRF dari server: ' + (e.message || e),
        en: 'Failed to generate a PRF number from the server: ' + (e.message || e),
        zh: '从服务器生成付款申请单编号失败：' + (e.message || e),
      });
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
    toast({
      id: 'Gagal simpan PRF ke server: ' + (e.message || e),
      en: 'Failed to save the PRF to the server: ' + (e.message || e),
      zh: '付款申请单保存到服务器失败：' + (e.message || e),
    });
    return;
  }
  if (!prf.id) prf.id = uid('prf'); // demo mode: insertPrf no-ops, keep a local id
  st.prfs.unshift(prf);
  logAudit({ entity: 'prf', target: prf.no, action: 'create', detail: `${prf.invoices.length} invoices · ${money(prf.amount, prf.currency)}` });
  // REGRESSION FIX: the number was written onto a NEW object (`prf`) and the
  // modal was closed immediately, so ui.prfDraft.no stayed '' forever and the
  // PDF button's `if (!d.no)` guard fired 100% of the time — with prfPaper()
  // rendered in exactly one place, the statutory 付款申请单 became impossible to
  // print at all. Keep the modal open, now carrying the real number, so the
  // document can be produced right after submission.
  setUI({ prfSel: {}, prfDraft: { ...d, no: prf.no, id: prf.id, stage: prf.stage, submitted: true } });
  toast({
    id: `${prf.no} dibuat & dikirim ke supervisor — silakan unduh PDF-nya`,
    en: `${prf.no} created & sent to the supervisor — you can download the PDF now`,
    zh: `${prf.no} 已创建并发送主管 — 现在可以下载 PDF`,
  });
}
