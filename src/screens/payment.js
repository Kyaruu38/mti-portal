import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { blockWrite } from '../core/guard.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, statusTone, driveLink, pager, pageSlice, PAGE_DEFAULT } from '../ui/components.js';
import { money, num, fmtDate, romanMonth, daysUntil, topDays, addDays, ccyTone } from '../core/format.js';
import { prfPaper } from '../ui/documents.js';
import { downloadBlob } from '../core/dom.js';
import { can } from '../auth/roles.js';
import { wrapPrintable } from './approval.js';
import { nextPrfNo } from '../core/docSeqApi.js';
import { uploadToDrive } from '../core/drive.js';
import { linkOutbox } from '../core/driveOutbox.js';
import { parseInvoicePdf } from '../parsers/invoicePdf.js';
import { insertInvoice, updateInvoice, deleteInvoice } from '../core/invoicesApi.js';
import { insertPrf, deletePrf, updatePrfStage } from '../core/prfsApi.js';
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
  //   prfCreate    -> PRF      (builder + preview + send to Supervisor)
  //
  // As of v12.0 nobody holds one without the other, and the reason is worth
  // keeping: they are not really independent. An invoice does not appear in the
  // PRF builder until it has left stage 1, and the only control that moves it
  // sits in the INTAKE half. Handing someone prfCreate alone therefore gives
  // them a builder that can never fill — which is exactly what cania and visca
  // had. The split branch below survives for a role that genuinely only reviews,
  // but it is no longer how the real workflow is divided.
  //
  // The real division is by STEP, not by half of this screen: cania/visca
  // receive the invoice and raise the PRF, sekar prints it and walks it to the
  // supervisor, the supervisor signs, sekar chases finance. Hiding a half here
  // is UX only — RLS on invoices/prfs is the actual boundary.
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
    btn(t('pay_upload_faktur'), { sm: true, onClick: () => setUI({ fakturFor: inv.id }) }),
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
    ui.fakturFor ? fakturModal(st) : null,
  ]);
}

// READ-ONLY progress list of every PRF raised, for the intake side of the screen
// (sekar + wilbert). Once a PRF is submitted sekar's role is to watch where it
// got to, and until now this screen gave her no way to see that at all — she had
// to go to Reports. There are deliberately NO action buttons here: moving a PRF
// to "Diterima Finance" or "Paid" is finance's job, and RLS's prfs_update policy
// blocks sekar/cania/visca from those stages anyway.
// A PRF can be withdrawn only before Finance has it. 'Terbentuk' and
// 'Diproses Wilbert' are still purchasing-side; from 'Diterima Finance' onward
// the document is in someone else's queue and may already have been acted on.
// Deleting it there would remove a payment request that finance is holding,
// with no trace on their screen of what disappeared.
function canDeletePrf(p) {
  return p.stage === 'Terbentuk' || p.stage === 'Diproses Wilbert';
}

// Two clicks, and the second says what it destroys — same shape as the invoice
// delete, deliberately, because two different confirm dialogs on one screen is
// how people learn to click through both.
function prfDeleteBtn(p) {
  const st = getState();
  const key = 'prf:' + p.id;
  const pending = (st.ui.prfDelConfirm || {})[key];
  const setPending = (v) => setUI({ prfDelConfirm: { ...(st.ui.prfDelConfirm || {}), [key]: v } });
  if (!pending) return btn(t('delete'), { sm: true, onClick: () => setPending(true) });
  return h('div.row.gap8', [
    h('button.btn.btn-sm', {
      style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 },
      onClick: () => removePrf(p),
    }, tr({ id: 'Ya, batalkan PRF', en: 'Yes, cancel the PRF', zh: '是，作废此单' })),
    // NOT t('cancel'). In English that renders "Cancel" directly beside "Cancel
    // the PRF" — two buttons, one word, opposite meanings, and the destructive
    // one is the red one. Kyaru looked at that row and asked how to cancel.
    btn(tr({ id: 'Jangan', en: 'Keep it', zh: '保留' }), { sm: true, onClick: () => setPending(false) }),
  ]);
}

async function removePrf(p) {
  if (blockWrite('hapus PRF')) return;
  const st = getState();

  // Re-check the stage at click time. The button was rendered from state that
  // may be seconds old, and in those seconds finance may have received it.
  if (!canDeletePrf(p)) {
    toast({
      id: `${p.no} sudah di tangan Finance — tidak bisa dibatalkan dari sini.`,
      en: `${p.no} is already with Finance — it cannot be cancelled from here.`,
      zh: `${p.no} 已在财务手中 — 无法从此处作废。`,
    });
    setUI({ prfDelConfirm: {} });
    return;
  }

  try {
    if (p.id && UUID_RE.test(p.id)) await deletePrf(p.id);
  } catch (e) {
    // Keep it on screen when the server refused. RLS on prfs is stage-gated, so
    // a refusal here is information, not noise — and a PRF that vanishes
    // locally while surviving on the server reappears at the next refresh,
    // after someone has already raised its replacement.
    console.error('Supabase PRF delete failed', e);
    toast({
      id: 'Gagal hapus di server — PRF tidak jadi dibatalkan: ' + (e.message || e),
      en: 'Server delete failed — the PRF was not cancelled: ' + (e.message || e),
      zh: '服务器删除失败 — 付款申请单未被作废：' + (e.message || e),
    });
    setUI({ prfDelConfirm: {} });
    return;
  }

  st.prfs = st.prfs.filter(x => x !== p);
  // The invoices come back on their own: prfBuilder derives "already on a PRF"
  // from st.prfs, so removing the PRF releases them with nothing to reset. That
  // is why the invoice rows carry no "used" flag — a flag would now be stale.
  logAudit({
    entity: 'prf', target: p.no, action: 'delete',
    detail: `${p.supplier} · ${money(p.amount, p.currency)} · invoice ${(p.invoices || []).join(', ') || '—'}`,
  });
  setUI({ prfDelConfirm: {} });
  setState({ prfs: st.prfs });
  toast({
    id: `${p.no} dibatalkan — invoicenya bisa dipakai lagi (statusnya tetap di tahap 2; pakai "Kembalikan ke tahap 1" kalau mau diedit/dihapus). Nomor ${p.no} TIDAK dipakai ulang.`,
    en: `${p.no} cancelled — its invoices are available again (they stay at stage 2; use "Back to stage 1" to edit or delete them). The number ${p.no} will NOT be reused.`,
    zh: `${p.no} 已作废 — 其发票可再次使用（仍处于第 2 阶段；如需编辑或删除请用“退回第 1 阶段”）。编号 ${p.no} 不会被重复使用。`,
  });
}

// A PRF still at 'Terbentuk' has been raised and printed but not yet carried
// over. That is the only state where "I have it now" is news.
function canTick(p) { return p.stage === 'Terbentuk'; }

// Bulk handover: the supervisor ticks whatever is in his hands and confirms
// once. Each row is a separate write, so one failure does not silently take
// the others with it — and whatever did land stays landed.
async function markPrfsReceived() {
  if (blockWrite('tandai PRF diterima')) return;
  const st = getState();
  const sel = st.ui.prfRecvSel || {};
  const targets = st.prfs.filter(p => sel[p.no] && canTick(p));
  if (!targets.length) { setUI({ prfRecvSel: {} }); return; }

  const done = [];
  const failed = [];
  for (const p of targets) {
    const before = p.stage;
    p.stage = 'Diproses Wilbert';
    try {
      if (p.id && UUID_RE.test(p.id)) await updatePrfStage(p.id, { stage: p.stage });
      done.push(p);
      logAudit({ entity: 'prf', target: p.no, action: 'prf_received', detail: `${p.supplier} · ${money(p.amount, p.currency)}` });
    } catch (e) {
      console.error('Supabase PRF receive failed', p.no, e);
      p.stage = before;
      failed.push(p.no);
    }
  }
  setUI({ prfRecvSel: {} });
  setState({ prfs: st.prfs });
  if (failed.length) {
    toast({
      id: `${done.length} PRF ditandai diterima · ${failed.length} GAGAL sync: ${failed.join(', ')} — coba lagi`,
      en: `${done.length} PRF marked received · ${failed.length} FAILED to sync: ${failed.join(', ')} — try again`,
      zh: `${done.length} 张已标记收到 · ${failed.length} 张同步失败：${failed.join('、')} — 请重试`,
    });
    return;
  }
  toast({
    id: `${done.length} PRF ditandai sudah diterima — sekarang di antrean Finance`,
    en: `${done.length} PRF${done.length === 1 ? '' : 's'} marked as received — now in the Finance queue`,
    zh: `已标记 ${done.length} 张收到 — 现已进入财务队列`,
  });
}

function prfTrackingCard(st, readonly) {
  // Dulu dipotong 25 secara diam-diam: PRF ke-26 tidak ada di layar dan tidak
  // ada satu pun tulisan yang menyebutkannya. Sekarang seluruhnya ada, dibuka
  // per halaman, dan jumlah aslinya tertulis di kaki tabel.
  const semua = st.prfs;
  const halPrf = halamanBayar(semua, st, 'prfPage', 'prfSize');
  const list = halPrf.items;
  const canReceive = !readonly && can(st.user.role, 'prfReceive');
  const recvSel = st.ui.prfRecvSel || {};
  // Dihitung dari SELURUH PRF, bukan halaman yang tampil: mencentang di
  // halaman 1 lalu pindah ke halaman 2 tidak boleh membuat centangannya
  // terlihat hilang.
  const tickedCount = semua.filter(p => recvSel[p.no] && canTick(p)).length;
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
      // "Download semua" berarti SEMUA, bukan sepuluh yang kebetulan sedang
      // tampil. Memakai halaman yang terlihat akan menghasilkan ZIP yang isinya
      // berubah-ubah tergantung halaman berapa yang sedang dibuka — dan tidak
      // ada satu pun tanda di layar yang menjelaskan kenapa.
      semua.length > 1 ? h('div.mla', btn(tr({
        id: `Download semua (${semua.length}) · ZIP`,
        en: `Download all (${semua.length}) · ZIP`,
        zh: `全部下载（${semua.length}）· ZIP`,
      }), { sm: true, iconName: 'download', onClick: () => downloadAllPrf(semua) })) : null,
      // The handover, done in one go. The papers arrive as a stack, so ticking
      // them off one modal at a time would be the wrong shape entirely.
      (canReceive && tickedCount) ? btn(tr({
        id: `Tandai ${tickedCount} PRF sudah diterima`,
        en: `Mark ${tickedCount} PRF${tickedCount === 1 ? '' : 's'} as received`,
        zh: `标记 ${tickedCount} 张已收到`,
      }), { sm: true, variant: 'primary', iconName: 'check', onClick: () => markPrfsReceived() }) : null,
    ]),
    list.length ? h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [
        canReceive ? h('th', { style: { width: '34px' } }, '') : null,
        ...[tr({ id: 'No. PRF', en: 'PRF No.', zh: '付款申请单号' }), t('col_supplier'), t('col_amount'), tr({ id: 'Invoice', en: 'Invoice', zh: '发票' }), tr({ id: 'Dibuat', en: 'Created', zh: '创建' }), t('col_status')].map((c, i) => h('th' + (i === 2 ? '.r' : ''), c)),
      ])),
      h('tbody', list.map(p => h('tr', { style: recvSel[p.no] ? { background: 'var(--sel-row)' } : {} }, [
        // Tick box only on PRFs still waiting to be handed over. A PRF already
        // with the supervisor, at finance, or paid has nothing left to confirm.
        canReceive
          ? h('td', canTick(p)
              ? h('input', { type: 'checkbox', checked: !!recvSel[p.no], style: { accentColor: 'var(--accent)', cursor: 'pointer' },
                  onChange: () => { const s2 = { ...recvSel }; s2[p.no] = !s2[p.no]; setUI({ prfRecvSel: s2 }); } })
              : null)
          : null,
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
          // Cancelling a PRF you raised is not the same as advancing one, which
          // is why it can live on a card labelled read-only: read-only here
          // means "finance owns the stage transitions", and this is not one.
          // Once Finance HAS it, it stops being ours to withdraw.
          (!readonly && canDeletePrf(p)) ? prfDeleteBtn(p) : null,
        ])),
      ]))),
    ])) : h('div', { style: { padding: '16px', fontSize: '12px', color: 'var(--text-3)' } }, tr({ id: 'Belum ada PRF dibuat.', en: 'No PRF has been created yet.', zh: '尚未创建任何付款申请单。' })),
    semua.length ? pagerBayar(halPrf, 'prfPage', 'prfSize') : null,
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
// FAKTUR PAJAK — four states, not two.
//
// The column used to answer one question: "is inv.faktur filled?" Everything
// else got a red "Belum upload". So an OVERSEAS supplier — who will never issue
// an Indonesian tax invoice, because import VAT is paid at customs and evidenced
// by the PPKEK/PIB — was nagged forever about a document that does not exist.
// HAICHAO sat there flagged next to two domestic suppliers who genuinely owed
// one, and once a warning is wrong a third of the time it stops being read.
//
// The banner above the table already knew this rule (it filters out overseas and
// PPN-not-paid). The column never learnt it. Now they share one function.
//
//   'ada'        the number is on file
//   'nonpkp'     overseas supplier — no faktur will ever exist. NOT a warning
//   'belum-ppn'  PPN on the linked PO is not settled yet, so no faktur is due
//   'missing'    genuinely owed and genuinely absent
export function fakturState(inv) {
  if (inv && inv.faktur) return 'ada';
  const overseas = new Set(getState().suppliers.filter(s => s.overseas).map(s => s.name));
  if (overseas.has(inv && inv.supplier)) return 'nonpkp';
  if (!poPpnPaid(inv)) return 'belum-ppn';
  return 'missing';
}

// The invoice's OWN file, never the faktur attached later. Both live in the same
// `files` array, and picking files[0] blindly would make the File column point
// at the tax invoice once one was added — the wrong document under the right
// heading, which is worse than an empty cell.
export function invoiceFileUrl(inv) {
  const files = (inv && inv.files) || [];
  const own = files.find(f => f && f.kind !== 'faktur');
  return (own && own.url) || '';
}
export function fakturFileUrl(inv) {
  const f = ((inv && inv.files) || []).find(x => x && x.kind === 'faktur');
  return (f && f.url) || '';
}

function fakturCell(inv, readonly) {
  const state = fakturState(inv);
  const url = fakturFileUrl(inv);

  if (state === 'ada') {
    return h('div.row.gap8', [
      h('span', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--st-green-tx)' } },
        [icon('check', 11, { strokeWidth: 2.5 }), ' ', inv.faktur]),
      url ? driveLink(url) : null,
      // Wrong number typed in is at least as likely as none at all, and until
      // now there was no way back — the field could only ever be filled once.
      readonly ? null : h('a.link', { style: { fontSize: '10.5px' }, onClick: () => setUI({ fakturFor: inv.id }) },
        tr({ id: 'ubah', en: 'change', zh: '修改' })),
    ]);
  }

  if (state === 'nonpkp') {
    return h('span', {
      style: { fontSize: '10.5px', color: 'var(--text-3)' },
      title: tr({
        id: 'Supplier luar negeri — PPN impor dibayar di bea cukai, buktinya PPKEK/PIB, bukan faktur pajak.',
        en: 'Overseas supplier — import VAT is paid at customs and evidenced by the PPKEK/PIB, not by a tax invoice.',
        zh: '境外供应商 — 进口增值税在海关缴纳，凭证为报关单，而非税票。',
      }),
    }, tr({ id: 'tidak perlu', en: 'not required', zh: '无需' }));
  }

  if (state === 'belum-ppn') {
    return h('span', {
      style: { fontSize: '10.5px', color: 'var(--text-3)' },
      title: tr({
        id: 'PPN di PO ini belum dibayar, jadi fakturnya memang belum terbit.',
        en: 'VAT on this PO has not been settled, so no tax invoice is due yet.',
        zh: '此采购单的增值税尚未结算，税票尚未开具。',
      }),
    }, tr({ id: 'belum jatuh tempo', en: 'not due yet', zh: '尚未到期' }));
  }

  if (readonly) return badge(t('pay_faktur_missing'), 'amber', { iconName: 'warn' });
  // The badge IS the button. A separate "add" control in a table this wide is
  // one more thing to find; the thing complaining should be the thing you press.
  return h('a', {
    style: { cursor: 'pointer' },
    title: tr({ id: 'Klik untuk menambahkan faktur pajak', en: 'Click to add the tax invoice', zh: '点击添加税票' }),
    onClick: () => setUI({ fakturFor: inv.id }),
  }, badge(t('pay_faktur_missing'), 'amber', { iconName: 'warn' }));
}

function poPpnPaid(inv) {
  const ref = inv && inv.poRef ? String(inv.poRef) : '';
  if (!ref) return !!(inv && inv.ppnPaid);
  const po = getState().pos.find(p => (p.no && p.no.includes(ref.replace('PO ', ''))) || (p.contract && ref.includes(p.contract)));
  return po ? po.ppnMode === 'paid' : inv.ppnPaid;
}
function trStage(s) { const m = { 'Diterima Purchasing': t('st_diterima_purchasing'), 'Diproses Wilbert': t('st_diproses_wilbert'), 'Diterima Finance': t('st_diterima_finance'), 'Paid': t('st_paid') }; return m[s] || s; }

// Paginasi. Alasan lengkapnya di ui/components.js: mount() membangun ulang
// seluruh layar setiap klik, jadi 137 baris invoice + 136 baris PRF di satu
// halaman berarti SETIAP tombol di layar ini membayar ongkos 273 baris.
function halamanBayar(rows, st, kHal, kUkur) {
  const size = st.ui[kUkur] === 0 ? 0 : (Number(st.ui[kUkur]) || PAGE_DEFAULT);
  const info = pageSlice(rows, st.ui[kHal] || 1, size);
  info.size = size;
  return info;
}
const pagerBayar = (info, kHal, kUkur) => pager(info, {
  onPage: n => setUI({ [kHal]: n }),
  onSize: n => setUI({ [kUkur]: n, [kHal]: 1 }),
});

function invoiceTable(st, opts) {
  // readonly: render the same table with no action buttons. Used by the
  // observe-only branch, which needs the invoice list for monitoring but must
  // offer no way to advance a stage or add a row.
  const readonly = !!(opts && opts.readonly);
  const head = h('thead', h('tr', [tr({ id: 'Invoice', en: 'Invoice', zh: '发票' }), t('col_supplier'), 'PO Ref', t('col_amount'), t('col_due'), t('pay_faktur'), tr({ id: 'File', en: 'File', zh: '文件' }), t('col_status')].map((c, i) => h('th' + (i === 3 ? '.r' : ''), c))));
  const halInv = halamanBayar(st.invoices, st, 'invPage', 'invSize');
  const body = h('tbody', halInv.items.map(inv => {
    const d = daysUntil(inv.due);
    const dueTone = inv.status === 'Paid' ? '' : d < 0 ? 'red' : d <= 1 ? 'amber' : '';
    // Advancing an invoice is purchasing-side work (sekar's job), not a
    // finance-stage mutation — not gated by the finance "readonly" cap.
    const canAdvance = !readonly && inv.status === 'Diterima Purchasing';
    return h('tr', { style: fakturState(inv) === 'missing' && inv.status !== 'Paid' ? { background: 'var(--st-amber-bg)' } : {} }, [
      h('td.mono.cell-strong', inv.no),
      h('td', inv.supplier),
      h('td.mono', { style: { color: 'var(--text-3)' } }, inv.poRef),
      h('td.mono.r', money(inv.amount, inv.currency)),
      h('td.mono', { style: dueTone ? { color: `var(--st-${dueTone}-tx)`, fontWeight: 700 } : {} }, inv.status === 'Paid' ? tr({ id: 'paid', en: 'paid', zh: '已付款' }) : fmtDate(inv.due) + (d < 0 ? tr({ id: ` · overdue ${-d}h`, en: ` · overdue ${-d}d`, zh: ` · 逾期 ${-d} 天` }) : '')),
      h('td', fakturCell(inv, readonly)),
      h('td', driveLink(invoiceFileUrl(inv))),
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
        // The way BACK. Advancing used to be one-way: the invoice sat at stage
        // 2 forever, with Delete gone and no route to it, even after the PRF it
        // was raised for had been cancelled.
        //
        // Deliberately NOT automatic on PRF cancel. "Create PRF" advances and
        // builds in one click, so undoing both together looks obvious — until
        // the invoice was advanced days earlier by someone else and a PRF built
        // and cancelled today silently undoes their work. This is explicit,
        // audited, and only offered when no PRF holds the invoice.
        (!readonly && canRevert(st, inv)) ? btn(t('pay_back_stage1'), { sm: true, onClick: () => revertToStage1(inv) }) : null,
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
    pagerBayar(halInv, 'invPage', 'invSize'),
  ]);
}

// ADD A TAX INVOICE, AFTER THE FACT.
//
// WHAT THIS REPLACES, AND WHY IT MATTERED
// -----------------------------------------------------------------------------
// The old uploadFaktur() did this:
//
//     inv.faktur = '010.005-26.' + Math.floor(Math.random() * 1e8);
//
// It uploaded nothing and asked for nothing. One click INVENTED a tax invoice
// number and wrote it to the database, and the column then showed a green tick
// next to a number that corresponds to no document in existence. A fabricated
// faktur number is worse than a missing one: missing is a task, fabricated is a
// finding — it looks settled to everyone downstream, including an auditor.
//
// Now it asks for the number and the file, and refuses to save a number that
// cannot be one.
function fakturModal(st) {
  const inv = st.invoices.find(i => i.id === st.ui.fakturFor);
  if (!inv) return null;
  const draft = { no: inv.faktur || '', file: null };
  const close = () => setUI({ fakturFor: null });

  const numInput = inputEl({
    value: draft.no, mono: true, placeholder: '010.005-26.12345678',
    onInput: v => { draft.no = v; },
  });

  const drop = dropzone({
    title: tr({ id: 'Drop PDF faktur pajak', en: 'Drop the tax invoice PDF', zh: '拖入税票 PDF' }),
    sub: tr({ id: 'Opsional — nomornya yang wajib', en: 'Optional — the number is what matters', zh: '可选 — 编号才是必填项' }),
    accept: '.pdf,.jpg,.jpeg,.png', iconName: 'upload', compact: true,
    onFiles: files => { draft.file = files[0]; setUI({}); },
  });

  return modal({
    title: tr({ id: 'Faktur Pajak', en: 'Tax Invoice', zh: '税票' }),
    subtitle: `${inv.no} · ${inv.supplier}`, width: 520, onClose: close,
    body: h('div.stack', { style: { gap: '12px' } }, [
      field(tr({ id: 'Nomor faktur pajak', en: 'Tax invoice number', zh: '税票编号' }), numInput),
      draft.file
        ? h('div.row.gap8', { style: { fontSize: '11.5px', color: 'var(--st-green-tx)' } },
            [icon('check', 13, { strokeWidth: 2.5 }), draft.file.name])
        : drop,
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
        id: 'Nomornya diketik dari faktur aslinya, bukan dibuatkan sistem. Portal tidak akan pernah mengarang nomor faktur.',
        en: 'The number is typed from the actual document — the portal never generates one.',
        zh: '编号须照实录入，系统绝不自动生成税票编号。',
      })),
    ]),
    footer: h('div.row.gap8', { style: { justifyContent: 'flex-end', width: '100%' } }, [
      btn(t('cancel'), { onClick: close }),
      btn(t('save'), { variant: 'primary', onClick: () => saveFaktur(inv, draft) }),
    ]),
  });
}

// An Indonesian faktur pajak number is 16 digits, usually written with a dot and
// a dash. Checked on DIGIT COUNT, not on the punctuation, because the same
// number is legitimately written 010.005-26.12345678 and 0100052612345678.
// Deliberately loose: this rejects obvious nonsense, it does not pretend to
// validate against Coretax.
export function fakturNoLooksReal(s) {
  return String(s || '').replace(/\D/g, '').length >= 12;
}

async function saveFaktur(inv, draft) {
  if (blockWrite('simpan faktur pajak')) return;
  const no = (draft.no || '').trim();
  if (!fakturNoLooksReal(no)) {
    toast({
      id: 'Nomor faktur pajak minimal 12 digit angka — ketik apa adanya dari fakturnya.',
      en: 'A tax invoice number needs at least 12 digits — type it exactly as printed.',
      zh: '税票编号至少需 12 位数字 — 请照实录入。',
    });
    return;
  }

  // The file is uploaded FIRST. If Drive refuses, the number is still saved —
  // the number is the part Finance needs, and losing it because an unrelated
  // upload failed would be the tail wagging the dog.
  let files = (inv.files || []).filter(f => f && f.kind !== 'faktur');
  if (draft.file) {
    const up = await uploadToDrive(draft.file, 'Invoice/Faktur/', draft.file.name, 'Invoice');
    files = files.concat([{ name: draft.file.name, url: up.url, placeholder: !!up.placeholder, kind: 'faktur' }]);
    await linkOutbox(up.outboxId, 'invoices', inv.id, 'files');
    if (up.placeholder) {
      toast({
        id: 'Nomor faktur tersimpan, tapi filenya GAGAL naik ke Drive — simpan filenya sendiri dulu.',
        en: 'The number was saved, but the file did NOT reach Drive — keep your own copy for now.',
        zh: '编号已保存，但文件未能上传至 Drive — 请自行保留副本。',
      });
    }
  }

  const before = inv.faktur || '';
  try {
    await updateInvoice(inv.id, { faktur: no, files });
  } catch (e) {
    console.error('faktur save failed', e);
    toast({
      id: 'Gagal simpan ke server: ' + (e.message || e),
      en: 'Failed to save to the server: ' + (e.message || e),
      zh: '保存到服务器失败：' + (e.message || e),
    });
    return;   // modal stays open, nothing typed is lost
  }
  inv.faktur = no;
  inv.files = files;
  logAudit({
    entity: 'invoice', target: inv.no, action: before ? 'ubah faktur' : 'tambah faktur',
    detail: before ? `${before} → ${no}` : `${no}${draft.file ? ` · ${draft.file.name}` : ' · tanpa file'}`,
  });
  setUI({ fakturFor: null });
  toast({
    id: `Faktur pajak ${no} tersimpan`, en: `Tax invoice ${no} saved`, zh: `税票 ${no} 已保存`,
  });
  setState({});
}

// Reverting is safe only while no PRF names the invoice. A PRF referencing an
// invoice that has fallen back to stage 1 is a payment request built on
// something the pipeline no longer considers ready.
function canRevert(st, inv) {
  if (inv.status !== 'Diproses Wilbert') return false;
  return !st.prfs.some(p => (p.invoices || []).includes(inv.no) || (p.lines || []).some(l => l.no === inv.no));
}

async function revertToStage1(inv) {
  if (blockWrite('kembalikan invoice ke tahap 1')) return;
  const st = getState();
  // Re-checked at click time: the button was drawn from state that may be
  // seconds old, and a PRF may have been raised on this invoice since.
  if (!canRevert(st, inv)) {
    toast({
      id: `${inv.no} sudah dipakai di PRF — batalkan PRF-nya dulu.`,
      en: `${inv.no} is on a PRF — cancel that PRF first.`,
      zh: `${inv.no} 已用于付款申请单 — 请先作废该单。`,
    });
    return;
  }
  const before = inv.status;
  inv.status = 'Diterima Purchasing';
  try {
    await updateInvoice(inv.id, { status: inv.status });
  } catch (e) {
    console.error('Supabase invoice revert failed', e);
    inv.status = before;
    toast({
      id: 'Gagal sync ke server — status tidak berubah: ' + (e.message || e),
      en: 'Server sync failed — the status did not change: ' + (e.message || e),
      zh: '同步服务器失败 — 状态未变更：' + (e.message || e),
    });
    setState({});
    return;
  }
  logAudit({ entity: 'invoice', target: inv.no, action: 'revert_stage1', detail: `${before} → Diterima Purchasing` });
  setState({});
  toast({
    id: `${inv.no} kembali ke tahap 1 — sekarang bisa diedit atau dihapus`,
    en: `${inv.no} is back at stage 1 — it can be edited or deleted again`,
    zh: `${inv.no} 已回到第 1 阶段 — 现在可以编辑或删除`,
  });
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
    }, tr({ id: 'Ya, hapus permanen', en: 'Yes, delete for good', zh: '是，永久删除' })),
    btn(tr({ id: 'Jangan', en: 'Keep it', zh: '保留' }), { sm: true, onClick: () => setPending(false) }),
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

  // FAKTUR PAJAK, RIGHT HERE — because that is how it usually arrives.
  //
  // This form took ONE file and had no faktur field at all (`faktur: ''` was
  // hardcoded on save). A supplier who sends the invoice and the tax invoice in
  // the same envelope — which is most of them — left cania holding a second PDF
  // with nowhere to put it. Dropping both meant the second one was silently
  // discarded: the dropzone keeps files[0] and says nothing about the rest.
  //
  // The stage-2 route added in v12.2 stays, because the other case is just as
  // real: the faktur turns up a week later. Both paths exist because both
  // things happen; neither replaces the other.
  const fakturAtt = f.fakturFile
    ? h('div.row.gap8', [
        icon('check', 13, { strokeWidth: 2.5, stroke: 'var(--st-green-tx)' }),
        h('span.mono', { style: { fontSize: '12px' } }, f.fakturFile.name),
        btn(tr({ id: 'Hapus', en: 'Remove', zh: '移除' }), { sm: true, onClick: () => { f.fakturFile = null; setUI({}); } }),
      ])
    : dropzone({
        title: tr({ id: 'Upload faktur pajak (opsional)', en: 'Upload the tax invoice (optional)', zh: '上传税票（可选）' }),
        sub: tr({ id: 'Kalau fakturnya datang bareng invoicenya', en: 'If the tax invoice arrived with the invoice', zh: '若税票与发票一同送达' }),
        accept: '.pdf,.jpg,.jpeg,.png', iconName: 'upload', compact: true,
        onFiles: files => { f.fakturFile = files[0]; setUI({}); },
      });
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
      field(tr({ id: 'Lampiran invoice', en: 'Invoice attachment', zh: '发票附件' }), attachment),
      field(tr({ id: 'No. Faktur Pajak (opsional)', en: 'Tax invoice number (optional)', zh: '税票编号（可选）' }),
        inputEl({ value: f.faktur || '', mono: true, placeholder: '010.005-26.12345678', onInput: v => (f.faktur = v) })),
      field(tr({ id: 'Lampiran faktur pajak', en: 'Tax invoice attachment', zh: '税票附件' }), fakturAtt),
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
  let uploaded = null;
  let fakturUp = null;
  if (f.file) {
    uploaded = await uploadToDrive(f.file, '', f.file.name, 'Invoice');
    files = [{ name: f.file.name, url: uploaded.url, placeholder: !!uploaded.placeholder }];
  }
  // Tagged kind:'faktur' so the File column keeps pointing at the invoice and
  // the Faktur column at the tax invoice — same array, two documents.
  if (f.fakturFile) {
    fakturUp = await uploadToDrive(f.fakturFile, 'Invoice/Faktur/', f.fakturFile.name, 'Invoice');
    files = files.concat([{ name: f.fakturFile.name, url: fakturUp.url, placeholder: !!fakturUp.placeholder, kind: 'faktur' }]);
  }

  // A number that cannot be one is refused rather than stored. Same rule as the
  // stage-2 route — there is no reason for it to be laxer just because it was
  // typed earlier.
  const fakturNo = (f.faktur || '').trim();
  if (fakturNo && !fakturNoLooksReal(fakturNo)) {
    toast({
      id: 'Nomor faktur pajak minimal 12 digit angka — kosongkan saja kalau belum ada.',
      en: 'A tax invoice number needs at least 12 digits — leave it empty if you do not have it yet.',
      zh: '税票编号至少需 12 位数字 — 若尚无，请留空。',
    });
    return;
  }

  const local = { no: f.no, supplier: supplier.name, poRef: f.poRef, currency: f.currency, amount: f.amount, due: f.due, faktur: fakturNo, ppnPaid: f.ppnPaid, status: 'Diterima Purchasing', files };
  try {
    const saved = await insertInvoice(local);
    local.id = saved.id;
    if (uploaded) await linkOutbox(uploaded.outboxId, 'invoices', saved.id, 'files');
    if (fakturUp) await linkOutbox(fakturUp.outboxId, 'invoices', saved.id, 'files');
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
  // THE NUMBER IS ALLOCATED HERE, at preview time (Kyaru, 31 Jul 2026).
  //
  // It used to be taken in submitPrf(), one line before the insert, precisely
  // because next_doc_seq() increments unconditionally and nothing can hand a
  // number back — so preview-time allocation put permanent gaps in a statutory
  // Indonesian payment-request register. That reasoning has not changed.
  //
  // What changed is the requirement: the printed PRF goes out for signature
  // BEFORE it is sent, and a signature sheet with no reference number is worse
  // than a gap in a sequence. Kyaru weighed both and chose the gaps.
  //
  // So the cost is paid down instead of ignored: a number is RESERVED per
  // distinct draft and REUSED. Previewing the same selection, closing it,
  // checking something and previewing again returns the same number rather
  // than taking another. Only a genuinely different set of invoices draws a
  // new one, and a successful submit releases the reservation. Gaps now cost
  // one per abandoned draft, not one per click.
  const lines = chosen.map(inv => ({ no: inv.no, desc: descFor(inv), amount: inv.amount }));
  const sig = `${supplier.id}|${currency}|${chosen.map(i => i.no).sort().join(',')}`;
  const reserved = (st.ui.prfReserved || {})[sig];

  let no = reserved || '';
  if (!no) {
    const prefix = `PRF/PC/${romanMonth()}/`;
    try {
      no = await nextPrfNo(st.prfs, romanMonth(), new Date().getFullYear(), prefix);
    } catch (e) {
      // Degrade to the old behaviour rather than blocking the preview: the
      // number can still be taken at submit time, and a PRF you cannot look at
      // is worse than a PDF button that says "send it first".
      console.error('nextPrfNo failed at preview', e);
      toast({
        id: 'Nomor PRF belum bisa diambil dari server — preview tetap jalan, nomornya terbit waktu dikirim.',
        en: 'Could not take a PRF number from the server — preview still works, the number is issued on send.',
        zh: '暂时无法从服务器取号 — 预览仍可用，编号将在发送时生成。',
      });
      no = '';
    }
  }
  setUI({
    prfModal: true,
    prfReserved: no ? { ...(st.ui.prfReserved || {}), [sig]: no } : (st.ui.prfReserved || {}),
    prfSig: sig,
    prfDraft: { no, supplier, supplierName, currency, amount: chosen.reduce((s, x) => s + x.amount, 0), invoices: chosen.map(i => i.no), lines, by: st.user.username, createdAt: new Date().toISOString(), stage: 'Terbentuk', receiveChecklist: { a: false, b: false, c: false, d: false } },
  });
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
      // The number is spent the moment this modal opens. Say so, because the
      // register it comes from is statutory and a gap in it is a question
      // somebody has to answer later — better answered as "we cancelled that
      // draft" than as "we don't know".
      (!d.submitted && d.no)
        ? h('div', { style: { fontSize: '10.5px', color: 'var(--st-amber-tx)', fontWeight: 600 } }, [icon('warn', 11), ' ', tr({
            id: `Nomor ${d.no} sudah dipesan buat draft ini — bisa langsung di-PDF. Kalau draftnya dibatalkan, nomor itu hangus dan deretnya bolong.`,
            en: `Number ${d.no} is reserved for this draft — you can save the PDF now. Abandon the draft and that number is spent, leaving a gap in the register.`,
            zh: `编号 ${d.no} 已为此草稿预留 — 现在即可导出 PDF。若放弃该草稿，该编号作废，登记簿将出现缺号。`,
          })])
        : null,
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
        // Reachable BEFORE sending now — the number is reserved at preview.
        // This branch only fires if the server could not issue one.
        if (!d.no) { toast({
          id: 'Nomor PRF belum terbit (server tidak merespons) — kirim dulu, lalu unduh dari daftar PRF',
          en: 'No PRF number yet (the server did not respond) — send it first, then download from the PRF list',
          zh: '尚未生成付款申请单编号（服务器无响应）— 请先发送，再从列表下载',
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

// ---------------------------------------------------------------------------
// SATU KLIK = SATU PRF, walaupun tombolnya dipencet lima kali.
//
// KEJADIAN NYATA, 5 Agustus 2026
//   PRF/PC/VIII/081  dua baris, invoice sama, IDR 2.338.459.200, selisih 1,97 detik
//   PRF/PC/VIII/082  dua baris, invoice sama, IDR   939.859.200, selisih 0,179 detik
//
// 179 milidetik. Tidak ada manusia yang sengaja membuat dua PRF secepat itu —
// itu tombol yang terpencit dua kali, atau orang yang mengklik lagi karena
// layarnya belum bergerak.
//
// submitPrf() menunggu beberapa panggilan jaringan SEBELUM insertPrf(): sinkron
// desc_dict, kadang minta nomor PRF ke server. Selama jeda itu tidak ada apa pun
// yang menahan klik kedua, dan klik kedua menjalankan seluruh fungsinya lagi
// dari awal — termasuk insert-nya.
//
// Penjaga ini menutup jendela itu di sisi browser. TAPI DIA BUKAN JAMINAN:
// browser bisa mengirim ulang permintaan sendiri, dan dua tab bisa mengirim
// PRF yang sama tanpa saling tahu. Yang benar-benar menjamin cuma unique
// constraint di kolom prfs.no — sama seperti yang sudah ada di invoices.no dan
// ppkek.nopen. Ini lapisan pertama, bukan satu-satunya.
// ---------------------------------------------------------------------------
let kirimPrfBerjalan = false;

async function submitPrf() {
  if (kirimPrfBerjalan) {
    console.warn('PRF sedang dikirim — klik kedua diabaikan.');
    return;
  }
  kirimPrfBerjalan = true;
  // finally, BUKAN setelah await: setiap jalan keluar dari fungsi ini —
  // termasuk return awal dan lemparan error — harus melepas kuncinya. Kunci
  // yang tidak pernah dilepas berarti tombolnya mati sampai halaman di-reload,
  // dan itu kerusakan yang lebih buruk daripada yang diperbaikinya.
  try { await submitPrfInti(); }
  finally { kirimPrfBerjalan = false; }
}

async function submitPrfInti() {
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
  // Normally already reserved by openPrf(). This fallback covers the one case
  // where it is not: the server refused to give a number at preview time.
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
  // 'Terbentuk', not 'Diproses Wilbert'. Saving a PRF is not the same event as
  // handing it over: the paper is printed, signed, stacked with the others, and
  // walked to the supervisor's desk later — sometimes days later. Marking it
  // "with the supervisor" at creation time recorded a handover that had not
  // happened, which made the stage mean nothing.
  const prf = { ...d, no, supplier: d.supplierName, stage: 'Terbentuk' };
  delete prf.supplierName;
  delete prf.supplier_obj;
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
  // Release the reservation: this number is now a real row, so re-selecting
  // the same invoices later must NOT hand back a number that is already used.
  const freed = { ...(getState().ui.prfReserved || {}) };
  delete freed[getState().ui.prfSig];
  setUI({ prfSel: {}, prfReserved: freed, prfDraft: { ...d, no: prf.no, id: prf.id, stage: prf.stage, submitted: true } });
  // WHO YOU HAND IT TO DEPENDS ON WHO YOU ARE.
  //
  // The paper does not go straight to the Supervisor from everyone. cania and
  // visca raise the PRF and hand the printout to sekar; sekar walks the stack to
  // the Supervisor and afterwards chases Finance. This message used to tell all
  // three of them "hand them to the supervisor", which sent two of them to the
  // wrong desk — and an instruction that is wrong for two people out of three
  // teaches everyone to stop reading it.
  //
  // The Supervisor is still the one who ticks "received": the chain ends at his
  // desk regardless of how many hands it passed through.
  const role = getState().user.role;
  const kePurchasing = role === 'cania' || role === 'visca';
  toast(kePurchasing ? {
    id: `${prf.no} tersimpan — cetak PDF-nya, kumpulkan, lalu serahkan ke sekar. Sekar yang meneruskan ke Supervisor.`,
    en: `${prf.no} saved — print the PDF, collect them, then hand them to sekar. She passes them to the Supervisor.`,
    zh: `${prf.no} 已保存 — 请打印 PDF，集齐后交给 sekar，由她转交主管。`,
  } : {
    id: `${prf.no} tersimpan — cetak PDF-nya, kumpulkan, lalu serahkan ke Supervisor. Dia yang centang "sudah diterima".`,
    en: `${prf.no} saved — print the PDF, collect them, then hand them to the Supervisor. He ticks them off as received.`,
    zh: `${prf.no} 已保存 — 请打印 PDF，集齐后交给主管，由其勾选"已收到"。`,
  });
}
