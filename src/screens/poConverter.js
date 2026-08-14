import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { can } from '../auth/roles.js';
import { card, badge, btn, icon, dropzone, modal, field, inputEl, selectEl, poNoField, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { parseZcPo } from '../parsers/zcPoPdf.js';
import { money, num, ccyDecimals, ppnFor, ppnModeFromForm } from '../core/format.js';
import { insertPO, newLineId, duplicatePoNumber } from '../core/posApi.js';
import { blockWrite } from '../core/guard.js';
import { fmtDate } from '../core/format.js';
import { poDocument, ensureCap } from '../ui/documents.js';
import { wrapPrintable } from './approval.js';

export function poConverterScreen() {
  const st = getState(); const ui = st.ui;
  const res = ui.cvResult;

  const dz = dropzone({ title: t('cv_drop'), sub: '.pdf — text-based', accept: '.pdf', iconName: 'rep', onFiles: f => handlePdf(f[0]) });

  if (!res) return h('div.stack', [card([h('div.card-pad', dz)]), runningPoCard(st)]);
  if (res.scanned) {
    return h('div.stack', [
      h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)' } }, [icon('warn', 15), t('cv_reject_scan')]),
      card([h('div.card-pad', dz)]),
    ]);
  }

  const statusBar = h('div.card', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px' } }, [
    h('span', { style: { width: '36px', height: '36px', borderRadius: '50%', background: 'var(--st-green-bg)', color: 'var(--st-green-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, icon('check', 16, { strokeWidth: 2.5 })),
    h('div.grow', [
      h('div.mono', { style: { fontSize: '13px', fontWeight: 700 } }, res.cgdd || res.contractNo || 'PO PDF'),
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, tr({
        id: `Parsed · ${res.items.length} line items · ${res.currency} · sumber: ${res.supplierEn || res.supplierZh || '—'}`,
        en: `Parsed · ${res.items.length} line items · ${res.currency} · source: ${res.supplierEn || res.supplierZh || '—'}`,
        zh: `已解析 · ${res.items.length} 个明细行 · ${res.currency} · 来源：${res.supplierEn || res.supplierZh || '—'}`,
      })),
    ]),
    // Never let a dropped row pass silently — the subtotal falls back to the sum
    // of the surviving items, so a short PO looks perfectly consistent.
    (res.skippedRows && res.skippedRows.length)
      ? badge(tr({
          id: `${res.skippedRows.length} baris TIDAK terbaca`,
          en: `${res.skippedRows.length} rows could NOT be read`,
          zh: `${res.skippedRows.length} 行无法读取`,
        }), 'red', { iconName: 'warn' })
      : badge(tr({ id: 'Rule-based parse', en: 'Rule-based parse', zh: '规则解析' }), 'green'),
    btn(tr({ id: 'Upload PDF lain', en: 'Upload another PDF', zh: '上传其他 PDF' }), { onClick: () => setUI({ cvResult: null }) }),
    // poCreate, mirroring pos_insert (is_label_staff). can(...,'approve') was
    // already used further down, but ONLY to pick the status string — it never
    // gated the insert itself, so screen presence was the real permission.
    can(st.user.role, 'poCreate')
      ? btn(t('cv_send_appr') + ' →', { variant: 'primary', onClick: () => openPopup() })
      : badge(tr({
          id: 'Read-only — PO dibuat oleh purchasing',
          en: 'Read-only — POs are created by purchasing',
          zh: '只读 — 采购单由采购部创建',
        }), 'gray', { iconName: 'eye' }),
  ]);

  const fields = card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', marginBottom: '12px' } }, [h('div.card-title', t('cv_extracted')), h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, [icon('edit', 11), ' ', t('cv_click_edit')])]),
      h('div.col.gap12', [
        editField(tr({ id: 'CGDD / Contract No', en: 'CGDD / Contract No', zh: 'CGDD / 合同号' }), res.contractNo || res.cgdd, v => (res.contractNo = v), true),
        editField(tr({ id: 'Supplier (原文)', en: 'Supplier (original)', zh: '供应商（原文）' }), res.supplierZh, v => (res.supplierZh = v)),
        editField(tr({ id: 'Supplier (English)', en: 'Supplier (English)', zh: '供应商（英文）' }), res.supplierEn, v => (res.supplierEn = v)),
        h('div.grid.g2', [
          editField(tr({ id: 'Currency', en: 'Currency', zh: '币种' }), res.currency, v => (res.currency = v), true),
          editField(tr({ id: 'Incoterm', en: 'Incoterm', zh: '贸易术语' }), res.incoterm, v => (res.incoterm = v)),
        ]),
        editField(tr({ id: 'Payment (from PDF)', en: 'Payment (from PDF)', zh: '付款条件（来自 PDF）' }), res.paymentText, v => (res.paymentText = v)),
        h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px' } }, [
          h('div.field-label', `${t('cv_line_items')} · ${res.items.length}`),
          ...res.items.map(li => h('div.row.gap8', { style: { marginBottom: '6px' } }, [
            inputEl({ value: li.descEn || li.desc, onInput: v => (li.descEn = v) }),
            h('select.input', { style: { width: '86px', fontSize: '11px', borderColor: li.unit ? '' : 'var(--st-amber-tx)' }, onChange: e => (li.unit = e.target.value) },
              unitOptions(st, li.unit).map(o => h('option', { value: o.value, selected: o.value === (li.unit || '') }, o.label))),
            h('span.mono', { style: { width: '70px', textAlign: 'right', fontSize: '11px', color: 'var(--text-2)' } }, num(li.qty)),
            h('span.mono', { style: { width: '80px', textAlign: 'right', fontSize: '11px', color: 'var(--text-2)' } }, num(li.amount, ccyDecimals())),
          ])),
        ]),
        h('div', { style: { borderTop: '1px solid var(--border)', paddingTop: '10px' } }, [
          row2(t('po_subtotal'), money(res.subtotal, res.currency)),
          row2('PPN (11%)', res.ppnPresent ? (res.ppnSuspended ? ppnSuspendedLabel() : money(res.ppn, res.currency)) : ppnSuspendedLabel()),
          row2(t('po_total'), money(res.total, res.currency), true),
        ]),
      ]),
    ]),
  ]);

  const compare = card([
    h('div.card-pad', [
      h('div.card-title', { style: { marginBottom: '12px' } }, t('cv_orig_gen')),
      h('div.grid.g2', [
        h('div', [badge(tr({ id: 'ORIGINAL · 中文 PDF', en: 'ORIGINAL · 中文 PDF', zh: '原件 · 中文 PDF' }), 'gray'), h('div', { style: { marginTop: '8px', aspectRatio: '1/1.32', border: '1px solid var(--border)', borderRadius: '8px', background: 'repeating-linear-gradient(45deg,var(--ph-a) 0 10px,var(--ph-b) 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span.mono', { style: { fontSize: '10px', color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px' } }, res.cgdd || 'contract'))]),
        h('div', [badge(tr({ id: 'GENERATED · ENGLISH PO', en: 'GENERATED · ENGLISH PO', zh: '生成件 · 英文采购单' }), 'green'), genPreview(res)]),
      ]),
      h('div.row.gap8', { style: { marginTop: '12px', background: 'var(--st-green-bg)', borderRadius: '9px', padding: '9px 13px' } }, [icon('check', 13, { stroke: 'var(--st-green-tx)', strokeWidth: 2.5 }), h('span', { style: { fontSize: '11.5px', fontWeight: 600, color: 'var(--st-green-tx)' } }, `${t('cv_valid')} (${money(res.total, res.currency)})`)]),
    ]),
  ]);

  const skippedBanner = (res.skippedRows && res.skippedRows.length)
    ? h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', display: 'block' } }, [
        h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, [icon('warn', 14), tr({
          id: ` ${res.skippedRows.length} baris item gagal diparse dan TIDAK masuk PO ini:`,
          en: ` ${res.skippedRows.length} item rows failed to parse and are NOT in this PO:`,
          zh: ` ${res.skippedRows.length} 个物料行解析失败，未计入本采购单：`,
        })]),
        ...res.skippedRows.slice(0, 8).map(r => h('div.mono', { style: { fontSize: '10.5px' } }, `• ${r.erp} — ${r.reason}`)),
        res.skippedRows.length > 8 ? h('div', { style: { fontSize: '10.5px' } }, tr({
          id: `…dan ${res.skippedRows.length - 8} lagi`,
          en: `…and ${res.skippedRows.length - 8} more`,
          zh: `…还有 ${res.skippedRows.length - 8} 行`,
        })) : null,
        h('div', { style: { fontSize: '10.5px', marginTop: '4px' } }, tr({
          id: 'Cek PDF aslinya — subtotal di bawah dihitung dari baris yang berhasil terbaca saja.',
          en: 'Check the original PDF — the subtotal below counts only the rows that were read successfully.',
          zh: '请核对原始 PDF — 下方小计仅根据成功读取的行计算。',
        })),
      ])
    : null;

  return h('div.stack', [statusBar, skippedBanner, h('div.grid', { style: { gridTemplateColumns: '370px 1fr', alignItems: 'start' } }, [fields, compare]), runningPoCard(st), ui.cvPopup ? popup() : null]);
}

function genPreview(res) {
  const shown = res.items.slice(0, 30);
  const extra = res.items.length - shown.length;
  return h('div', { style: { marginTop: '8px', minHeight: '0', aspectRatio: shown.length > 4 ? 'auto' : '1/1.32', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: 'var(--shadow)', padding: '16px', maxHeight: '480px', overflow: 'auto', color: '#1F2937' } }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #1B3A6B', paddingBottom: '6px' } }, [h('span', { style: { fontSize: '12px', fontWeight: 800, color: '#1B3A6B' } }, 'MTI'), h('span', { style: { fontSize: '8px', fontWeight: 800, letterSpacing: '.18em', color: '#111827' } }, 'PURCHASE ORDER')]),
    h('div.mono', { style: { fontSize: '7.5px', color: '#374151', marginTop: '6px', lineHeight: 1.7 } }, [`Ref: ${res.cgdd}`, h('br'), `Supplier: ${res.supplierEn || res.supplierZh}`, h('br'), `Terms: ${res.paymentText || '—'}`]),
    h('div', { style: { border: '1px solid #D1D5DB', borderRadius: '3px', marginTop: '8px' } }, shown.map(li => h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '6.8px', color: '#374151', padding: '3px 6px', borderBottom: '1px solid #E5E7EB' } }, [h('span', (li.descEn || li.desc || '').slice(0, 34)), h('span.mono', num(li.amount, ccyDecimals()))]))),
    extra > 0 ? h('div', { style: { fontSize: '6.8px', color: '#9CA3AF', padding: '4px 6px', fontStyle: 'italic' } }, `+${extra} item lagi`) : null,
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', fontSize: '7.5px', fontWeight: 800, color: '#111827', marginTop: '6px' } }, [h('span', 'TOTAL'), h('span.mono', money(res.total, res.currency))]),
  ]);
}

// Unit is unconstrained here (unlike Label Request's fixed 张) — PO Converter
// handles arbitrary goods, not just tires, so the picker reads from the units
// master with a blank placeholder rather than defaulting to any one value.
// `current` (the item's already-parsed unit, if any) is injected as an extra
// option when it isn't already a master code — the parser's recognized
// tokens (KGM/PCE/ROLL/PC/…) don't all have a matching units-master entry by
// default, and silently dropping a genuinely-parsed value because it's not
// in the master would be worse than the bug this whole fix is closing.
function unitOptions(st, current) {
  const codes = st.units.length ? st.units.map(u => u.code) : ['张', '条', '千克kg', 'set'];
  const labelFor = c => { const u = st.units.find(x => x.code === c); return u && u.intl ? `${u.code} · ${u.intl}` : c; };
  // Labels are display-only; `value` stays the raw unit CODE written to the PO.
  const opts = [{ value: '', label: tr({ id: '— pilih —', en: '— select —', zh: '— 请选择 —' }) }, ...codes.map(c => ({ value: c, label: labelFor(c) }))];
  if (current && !codes.includes(current)) opts.push({ value: current, label: tr({
    id: `${current} (dari PDF)`, en: `${current} (from PDF)`, zh: `${current}（来自 PDF）`,
  }) });
  return opts;
}

function ppnSuspendedLabel() {
  return tr({ id: 'Ditangguhkan — KEK', en: 'Suspended — KEK', zh: '暂免征收 — KEK' });
}

function editField(label, value, onInput, mono) { return field(label, inputEl({ value: value || '', mono, onInput })); }
function row2(a, b, strong) { return h('div.row', { style: { justifyContent: 'space-between', fontSize: strong ? '12.5px' : '11.5px', fontWeight: strong ? 800 : 400, color: strong ? 'var(--text)' : 'var(--text-2)' } }, [h('span', a), h('span.mono', b)]); }

async function handlePdf(file) {
  if (!file) return;
  toast(t('loading'));
  try {
    const res = await parseZcPo(file);
    if (!res.ok && res.scanned) { setUI({ cvResult: res }); return; }
    setUI({ cvResult: res });
  } catch (e) { console.error(e); toast({ id: 'Parse gagal: ' + e.message, en: 'Parse failed: ' + e.message, zh: '解析失败：' + e.message }); }
}

function openPopup() {
  const res = getState().ui.cvResult;
  // Checked here, before the modal opens — the modal is a full-screen
  // overlay, so blocking inside it would strand the user unable to reach the
  // unit dropdowns in the Extracted panel behind it.
  if (res.items.some(li => !li.unit)) { toast({ id: 'Unit belum dipilih untuk salah satu item — lengkapi dulu di panel Extracted', en: 'One of the items has no unit — set it first in the Extracted panel', zh: '有物料尚未选择单位 — 请先在 Extracted 面板中补齐' }); return; }
  setUI({ cvPopup: true, cvForm: { no: res.cgdd || res.contractNo || '', terms: 'TOP 45', priority: 'Normal', contract: res.contractNo || res.cgdd || '', ppn: res.ppnSuspended || !res.ppnPresent ? 'kek' : 'bayar' } });
}

function popup() {
  const st = getState(); const f = st.ui.cvForm;
  return modal({
    title: t('cv_send_appr'), subtitle: tr({
      id: 'PO Converter → Approval Supervisor',
      en: 'PO Converter → supervisor approval',
      zh: 'PO Converter → 主管审批',
    }), width: 480, onClose: () => setUI({ cvPopup: false }),
    body: [
      field(t('po_contract_no') + ' *', poNoField(f)),
      // 'Custom…' removed: it had no follow-up input, so picking it produced
      // the literal terms string "Custom… days after B/L — ref <contract>",
      // and the printed contract then showed the CONTRACT NUMBER as the number
      // of days. Replaced with the real alternative term.
      field(t('po_terms') + ' *', selectEl(['TOP 30', 'TOP 45', 'TOP 60', 'Bayar di muka'], { value: f.terms, onChange: v => (f.terms = v) })),
      // Priority drives expected arrival in Label Stock -> Order Tracking
      // (lead days come from label_settings: Normal 14 / Urgent 7 / Super 3).
      // Without it every order was assumed Normal and "overdue" meant nothing.
      // Option strings are the STORED priority values — labels only here.
      field(tr({ id: 'Prioritas', en: 'Priority', zh: '优先级' }), selectEl(['Normal', 'Urgent', 'Super Urgent'], { value: f.priority || 'Normal', onChange: v => (f.priority = v) })),
      field(tr({ id: 'Contract No (合同号)', en: 'Contract No (合同号)', zh: '合同号' }), inputEl({ value: f.contract, mono: true, onInput: v => (f.contract = v) })),
      field(t('po_ppn'), selectEl([{ value: 'bayar', label: t('po_ppn_paid') }, { value: 'kek', label: t('po_ppn_susp') }], { value: f.ppn, onChange: v => (f.ppn = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ cvPopup: false }) }), btn(t('generate') + ' PO', { variant: 'primary', onClick: () => genConverterPO() })],
  });
}

async function genConverterPO() {
  if (blockWrite('generate PO dari PDF')) return;
  const st = getState(); const res = st.ui.cvResult; const f = st.ui.cvForm;
  if (!f.no || !f.no.trim()) { toast({ id: 'No. PO wajib diisi', en: 'PO number is required', zh: '采购单号必须填写' }); return; }
  if (res.items.some(li => !li.unit)) { toast({ id: 'Unit belum dipilih untuk salah satu item — lengkapi dulu di panel Extracted', en: 'One of the items has no unit — set it first in the Extracted panel', zh: '有物料尚未选择单位 — 请先在 Extracted 面板中补齐' }); return; }
  const no = f.no.trim();
  const contract = f.contract || '';
  // Capability, not a username string. The literal comparison paired with the
  // window.__MTI__ handle (main.js) let any purchasing account fake the role
  // client-side and insert a PO with status 'Approved' — pos_insert's RLS
  // policy only checked is_purchasing(), never the status value.
  // Server-side lock is in supabase_migration_po_insert_guard.sql.
  const isWilbert = can(st.user.role, 'approve');
  // lineId minted here, before the insert — see posApi.js newLineId(). It used
  // to be '' and get patched to `${id}:${idx}` after the insert returned.
  const items = res.items.map(li => ({ erp: li.erp, d: li.descEn || li.desc, dimension: li.spec || '', cn: '', qty: li.qty, u: li.price, a: li.amount, unit: li.unit, lineId: newLineId() }));
  // Terms string must stay parseable by poTermDays(): a day count has to be at
  // the START, and a non-day term must not begin with a digit.
  const termDays = f.terms.startsWith('TOP ') ? f.terms.slice(4).trim() : null;
  const termsText = termDays
    ? `${termDays} days after B/L — ref ${contract || no}`
    : `Payment in Advance — ref ${contract || no}`;
  const ppnMode = ppnModeFromForm(f.ppn);
  const po = {
    id: uid('po'), no, contract, supplier: res.supplierEn || res.supplierZh, supplierZh: res.supplierZh,
    address: res.supplierAddress || '', currency: res.currency, unit: (items[0] && items[0].unit) || '',
    subtotal: res.subtotal, ppn: ppnFor(res.subtotal, ppnMode),
    ppnMode,
    total: res.total, amount: res.total, terms: termsText,
    delivery: res.incoterm || 'FOB', priority: f.priority || 'Normal', by: st.user.username, status: isWilbert ? 'Approved' : 'Menunggu Approval',
    createdAt: new Date().toISOString(), source: 'converter',
    contact: res.contact || '', phone: res.phone || '',
    items,
  };
  if (isWilbert) { po.approvedAt = new Date().toISOString(); po.approvedBy = 'wilbert'; }
  // Peringatan yang harus ikut terbaca bareng pesan suksesnya, bukan
  // menggantikannya. toast() cuma punya SATU slot — alasannya di dalam catch().
  const peringatan = [];
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
        zh: `采购单号 ${po.no} 已被使用 — 请更换号码`,
      });
      return;
    }
    // Anything else (network, timeout) may well succeed on a retry, so the
    // original behaviour stands: keep it locally and say so.
    //
    // DIKUMPULKAN, TIDAK LANGSUNG DI-TOAST. toast() cuma punya SATU slot, dan
    // beberapa baris di bawah ada toast sukses "dikirim ke approval queue" yang
    // pasti jalan — jadi peringatan ini dulu tertimpa sebelum sempat terlihat,
    // dan cania membaca "terkirim" untuk PO yang cuma ada di tab-nya sendiri
    // dan lenyap saat login berikutnya. Pola `ekor` ini disalin dari
    // labelRequest.js, yang sudah kena persis di tempat yang sama.
    peringatan.push(tr({
      id: 'TAPI GAGAL SYNC KE SERVER, tersimpan lokal saja: ' + (e.message || e),
      en: 'BUT SYNCING TO THE SERVER FAILED, saved locally only: ' + (e.message || e),
      zh: '但同步到服务器失败，仅本地保存：' + (e.message || e),
    }));
  }
  // No post-insert lineId patch any more — the ids were minted above and are
  // identical in the local copy and the persisted row.
  st.pos.unshift(po);
  logAudit({ entity: 'po', target: no, action: 'convert', detail: `from ${contract || no}` });
  setUI({ cvPopup: false, cvResult: null });
  const ekor = peringatan.length ? ` · ${peringatan.join(' · ')}` : '';
  toast(isWilbert
    ? { id: `PO ${no} dibuat & di-approve${ekor}`, en: `PO ${no} created & approved${ekor}`, zh: `采购单 ${no} 已创建并批准${ekor}` }
    : { id: `PO ${no} dikirim ke approval queue supervisor${ekor}`, en: `PO ${no} sent to the supervisor's approval queue${ekor}`, zh: `采购单 ${no} 已提交至主管审批队列${ekor}` });
  // Tujuannya mengikuti PERAN, bukan satu layar untuk semua.
  //
  // Dulu baris ini selalu 'approval'. cania dan visca tidak memilikinya, jadi
  // penjaga di main.js menulis ulang layarnya ke yang pertama yang mereka
  // punya — Dashboard. Mereka menekan Generate, dapat toast tentang antrean
  // yang tidak bisa mereka buka, lalu mendarat jauh dari PO yang barusan
  // mereka buat. Sekarang mereka mendarat DI PO-nya.
  if (isWilbert) { setState({ screen: 'approval' }); return; }
  setUI({ poSayaSel: po.id, selPO: po.id });
  setState({ screen: 'po-saya' });
}


// ---------------------------------------------------------------------------
// PO YANG SEDANG JALAN
//
// Layar ini dulu hanya menunjukkan PO yang BARU SAJA dibuat, lalu kosong lagi
// begitu halamannya dimuat ulang. Orang yang mengubah PDF menjadi PO adalah
// orang yang paling butuh tahu PO mana yang masih menggantung — dan satu-satunya
// tempat daftar itu ada adalah Approval Queue, yang tidak semua akun bisa buka.
//
// "Jalan" = belum selesai jalurnya: menunggu approval, atau sudah disetujui tapi
// barangnya belum diterima. PO yang ditolak dan yang sudah tuntas sengaja tidak
// masuk — daftar yang berisi hal yang tidak perlu dikerjakan berhenti dibaca.
// ---------------------------------------------------------------------------
const RUNNING = ['Menunggu Approval', 'Approved', 'Diproses Wilbert', 'Diterima Purchasing', 'Open'];
const DONE_TONE = { 'Approved': 'green', 'Rejected': 'red', 'Menunggu Approval': 'amber' };

async function openPoPdf(po) {
  // Urutannya penting: popup dibuka dulu (harus di dalam rantai klik), cap
  // ditunggu setelahnya, baru dokumennya di-serialize. Lihat ui/documents.js.
  const w = window.open('', '_blank');
  if (!w) {
    toast({
      id: 'Popup diblokir — izinkan popup dulu buat buka PDF-nya',
      en: 'Popup blocked — allow popups to open the PDF',
      zh: '弹窗被拦截 — 请允许弹窗以打开 PDF',
    });
    return;
  }
  await ensureCap();
  const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
  w.document.write(html); w.document.close();
  w.onload = () => { w.focus(); };
}

// Kotak-kotak di jendela saring PO Jalan — satu per kolom yang tampil.
//
// MENGGANTIKAN KOTAK CARI YANG DULU ADA DI ATAS TABEL. Kotak itu menyapu empat
// medan sekaligus dalam satu kata, jadi 'cania' menemukan PO yang dibuat cania
// DAN PO ke supplier yang kebetulan mengandung huruf itu, bercampur tanpa cara
// memisahkannya. Dipecah per kolom, yang mencari bisa bilang mana yang dia
// maksud.
//
// Opsi status diambil dari status yang BENAR-BENAR ADA di daftarnya, bukan dari
// RUNNING: kalau tidak ada satu pun PO 'Diterima Purchasing' hari ini, pilihan
// itu cuma jalan menuju daftar kosong.
const MEDAN_PO_JALAN = (rows) => [
  // Nomor kontrak ikut dicari walau kolomnya menampilkan p.no saja. Kotak teks
  // hanya bisa MELONGGARKAN dengan tambahan ini — baris yang nomornya cocok
  // secara kasat mata tetap ikut — sementara nomor kontrak adalah identitas
  // yang dipegang supplier, dan itu yang sering ada di tangan orang.
  { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => `${r.no || ''} ${r.contract || ''}` },
  { kunci: 'supplier', label: tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }), tipe: 'teks', ambil: r => r.supplier },
  // Nilainya dicocokkan ke teks yang TERBACA di kolomnya ('USD 12,340.00'),
  // bukan ke angka mentahnya — supaya 'usd' menyaring per valuta dan potongan
  // angka bisa diketik persis seperti yang terlihat, koma dan semuanya.
  { kunci: 'nilai', label: tr({ id: 'Nilai', en: 'Value', zh: '金额' }), tipe: 'teks', mono: true, ambil: r => money(r.subtotal + ppnFor(r.subtotal, r.ppnMode), r.currency) },
  { kunci: 'by', label: tr({ id: 'Dibuat oleh', en: 'Raised by', zh: '制单人' }), tipe: 'teks', ambil: r => r.by },
  { kunci: 'tgl', label: tr({ id: 'Tanggal', en: 'Date', zh: '日期' }), tipe: 'tanggal', ambil: r => r.createdAt },
  { kunci: 'status', label: tr({ id: 'Status', en: 'Status', zh: '状态' }), tipe: 'pilih', opsi: [...new Set(rows.map(r => r.status).filter(Boolean))].sort(), ambil: r => r.status },
];

function runningPoCard(st) {
  const all = (st.pos || []).filter(p => RUNNING.includes(p.status));
  const medan = MEDAN_PO_JALAN(all);
  const nilai = nilaiFilter('cv-po');
  const tersaring = saring(all, medan, nilai);
  // Disaring dulu, diurut, baru dipotong 60. Memotong lebih dulu akan menyembunyikan
  // PO ke-61 dari saringan yang justru dibuat untuk menemukannya.
  const rows = tersaring
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 60);

  // Tetap dihitung dari `all`: berapa PO yang menunggu approval adalah fakta
  // tentang pekerjaannya, bukan tentang apa yang sedang dilihat. Angka yang
  // ikut mengecil waktu orang menyaring akan terbaca sebagai antrean yang
  // berkurang.
  const waiting = all.filter(p => p.status === 'Menunggu Approval').length;
  const judul = tr({ id: 'PO Jalan', en: 'POs in Flight', zh: '进行中的采购单' });

  const head = [
    tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }),
    tr({ id: 'Supplier', en: 'Supplier', zh: '供应商' }),
    tr({ id: 'Nilai', en: 'Value', zh: '金额' }),
    tr({ id: 'Dibuat', en: 'Raised by', zh: '制单人' }),
    tr({ id: 'Tanggal', en: 'Date', zh: '日期' }),
    tr({ id: 'Status', en: 'Status', zh: '状态' }),
    '',
  ];

  return card([
    h('div.card-pad', { style: { paddingBottom: '8px' } }, h('div.row.gap12.wrap', { style: { alignItems: 'center' } }, [
      h('div.card-title', judul),
      badge(String(all.length), all.length ? 'blue' : 'gray'),
      waiting
        ? badge(tr({
            id: `${waiting} nunggu approval`,
            en: `${waiting} awaiting approval`,
            zh: `${waiting} 个待审批`,
          }), 'amber', { iconName: 'clock' })
        : null,
      hitunganSaring(tersaring.length, all.length, { id: 'PO', en: 'PO', zh: '个采购单' }),
      h('div.mla', tombolFilter({ id: 'cv-po', medan, judul })),
    ])),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', head.map((c, i) => h('th' + (i === 2 ? '.r' : ''), c)))),
      h('tbody', rows.length ? rows.map(p => h('tr', [
        h('td.mono.cell-strong', { style: { fontSize: '11.5px' } }, p.no),
        h('td', { style: { fontSize: '11.5px', maxWidth: '260px' } }, p.supplier || '—'),
        h('td.mono.r', { style: { fontSize: '11.5px' } }, money(p.subtotal + ppnFor(p.subtotal, p.ppnMode), p.currency)),
        h('td', { style: { fontSize: '11px', color: 'var(--text-3)' } }, p.by || '—'),
        h('td.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, fmtDate(p.createdAt)),
        h('td', badge(p.status, DONE_TONE[p.status] || 'blue')),
        // Sengaja tidak dibedakan Approved atau belum: cania dan visca harus
        // bisa melihat PDF-nya sebelum ada tanda tangan dan cap, karena itu
        // satu-satunya cara memeriksa apa yang mereka ketik sebelum dikirim.
        h('td.r', btn(p.status === 'Approved'
          ? tr({ id: 'PDF', en: 'PDF', zh: 'PDF' })
          : tr({ id: 'PDF draft', en: 'Draft PDF', zh: 'PDF 草稿' }), {
          sm: true, iconName: 'download', onClick: () => openPoPdf(p),
        })),
      ])) : barisTakCocok(head.length, { id: 'cv-po', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
    // Dihitung dari yang tersaring, bukan dari `all`: sesudah menyaring jadi 12
    // baris, catatan "menampilkan 60 dari 300" cuma membicarakan daftar yang
    // sudah tidak ada di layar.
    tersaring.length > 60 ? h('div.card-pad', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
      id: `Menampilkan 60 dari ${tersaring.length} — pakai saringan untuk mempersempit.`,
      en: `Showing 60 of ${tersaring.length} — use the filter to narrow it down.`,
      zh: `显示 ${tersaring.length} 个中的 60 个 — 请使用筛选缩小范围。`,
    })) : null,
  ]);
}
