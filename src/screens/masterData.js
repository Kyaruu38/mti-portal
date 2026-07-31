import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { blockWrite } from '../core/guard.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, modal, field, inputEl, selectEl, toggle, searchInput } from '../ui/components.js';
import { fmtDateTime, TOP_OPTIONS } from '../core/format.js';
import { termsText } from '../core/statusText.js';
import { can } from '../auth/roles.js';
import { insertSupplier, updateSupplier } from '../core/suppliersApi.js';
import { fetchAuditLog } from '../core/auditApi.js';
import { insertDescDict, updateDescDict, deleteDescDict } from '../core/descDictApi.js';
import { insertItem, updateItem, deleteItem } from '../core/itemsApi.js';
import { insertBrandMap, updateBrandMap, deleteBrandMap } from '../core/brandMapApi.js';
import { insertUnit, updateUnit, deleteUnit } from '../core/unitsApi.js';
import { UUID_RE } from '../core/supabase.js';

export function masterDataScreen() {
  const st = getState(); const ui = st.ui;
  const tab = ui.mdTab || 'suppliers';
  const tabs = [['suppliers', t('md_suppliers')], ['brands', tr({ id: 'Brand Mapping', en: 'Brand Mapping', zh: '品牌映射' })], ['dict', tr({ id: 'Description Dictionary', en: 'Description Dictionary', zh: '描述词典' })], ['items', tr({ id: 'Item Master', en: 'Item Master', zh: '物料主数据' })], ['units', tr({ id: 'Unit', en: 'Unit', zh: '单位' })]];

  const tabBar = h('div.row.gap8', tabs.map(([id, label]) => h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ mdTab: id }) }, label)));

  let content;
  if (tab === 'brands') content = brandsTab(st);
  else if (tab === 'dict') content = dictTab(st);
  else if (tab === 'items') content = itemsTab(st);
  else if (tab === 'units') content = unitsTab(st);
  else content = suppliersTab(st);

  return h('div.stack', [tabBar, content, ui.supModal ? supModal() : null, ui.itemModal ? itemModal() : null, ui.auditFor ? auditDrawer(ui.auditFor) : null]);
}

// Small inline "confirm delete" — no native confirm() dialogs. Row shows
// Delete → click → Yakin?/Batal, click Yakin? to actually remove.
function confirmDeleteBtn(key, onConfirm) {
  const st = getState();
  const pending = (st.ui.mdDelConfirm || {})[key];
  if (pending) {
    return h('div.row.gap8', [
      h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: onConfirm }, tr({ id: 'Yakin?', en: 'Sure?', zh: '确定？' })),
      btn(tr({ id: 'Batal', en: 'Cancel', zh: '取消' }), { sm: true, onClick: () => setUI({ mdDelConfirm: { ...(st.ui.mdDelConfirm || {}), [key]: false } }) }),
    ]);
  }
  return btn(t('delete'), { sm: true, onClick: () => setUI({ mdDelConfirm: { ...(st.ui.mdDelConfirm || {}), [key]: true } }) });
}

// ---------- Suppliers ----------
function suppliersTab(st) {
  const q = (st.ui.mdQ || '').toLowerCase();
  const rows = st.suppliers.filter(s => !q || s.name.toLowerCase().includes(q));
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', t('md_suppliers')),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${st.suppliers.length} aktif · perubahan rekening wajib review supervisor`,
        en: `${st.suppliers.length} active · account changes require supervisor review`,
        zh: `${st.suppliers.length} 家启用 · 账户变更须经主管审核`,
      })),
      h('div.mla.row.gap8', [searchInput({ id: 'md-q-sup', placeholder: tr({ id: 'Search supplier…', en: 'Search supplier…', zh: '搜索供应商…' }), value: st.ui.mdQ || '', onChange: v => setUI({ mdQ: v }) }), editable ? btn(t('md_add_supplier'), { variant: 'primary', iconName: 'plus', onClick: () => openSup() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_supplier'), t('md_city'), t('md_contact'), t('md_bank'), 'PKP', 'TOP', t('col_action')].map(c => h('th', c)))),
      h('tbody', rows.map(s => h('tr', [
        h('td.cell-strong', [s.name, s.nameZh ? h('span', { style: { color: 'var(--text-3)', fontWeight: 500 } }, ' ' + s.nameZh) : null, s.bankChangePending ? h('span', { style: { marginLeft: '8px' } }, badge(t('md_bank_change_review'), 'amber')) : null]),
        h('td', s.city),
        h('td', `${s.contact} · ${s.phone}`),
        // Always shows the APPROVED account (what a PRF would print today).
        // A staged change is listed underneath, clearly marked as not yet active.
        h('td.mono', [
          h('div', `${s.bank || '—'} ${s.acct || ''}`),
          s.bankChangePending
            ? h('div', { style: { color: 'var(--st-amber-tx)', fontWeight: 600, fontSize: '10.5px', marginTop: '2px' } },
                tr({
                  id: `usulan: ${s.pendingBank || '—'} ${s.pendingAcct || ''} (belum aktif)`,
                  en: `proposed: ${s.pendingBank || '—'} ${s.pendingAcct || ''} (not active yet)`,
                  zh: `变更申请：${s.pendingBank || '—'} ${s.pendingAcct || ''}（尚未生效）`,
                }))
            : null,
        ]),
        h('td', s.overseas ? badge(tr({ id: 'Overseas', en: 'Overseas', zh: '境外' }), 'gray') : badge(s.pkp ? 'PKP' : 'Non-PKP', s.pkp ? 'green' : 'gray')),
        // Master data value, shown translated, stored exactly as chosen —
        // the <select> below still writes '30 hari'.
        h('td.mono', termsText(s.top)),
        h('td', h('div.row.gap8', [
          btn(t('history'), { sm: true, onClick: () => openAuditDrawer(s) }),
          editable ? btn(t('edit'), { sm: true, onClick: () => openSup(s) }) : null,
          editable ? confirmDeleteBtn('sup:' + s.id, () => { st.suppliers = st.suppliers.filter(x => x.id !== s.id); setState({ suppliers: st.suppliers }); logAudit({ entity: 'supplier', target: s.name, action: 'delete' }); toast({ id: 'Supplier dihapus', en: 'Supplier deleted', zh: '供应商已删除' }); }) : null,
        ])),
      ]))),
    ]))),
  ]);
}

function openSup(existing) {
  setUI({
    supModal: true,
    supForm: existing
      // Prefill with the STAGED account when one is waiting, so editing a
      // supplier mid-review doesn't silently revert someone's pending proposal.
      ? { editingId: existing.id, name: existing.name, address: existing.address || '', contact: existing.contact || '', phone: existing.phone || '',
          bank: existing.pendingBank || existing.bank || '', acct: existing.pendingAcct || existing.acct || '', bankAddress: existing.pendingBankAddress || existing.bankAddress || '',
          pkp: !!existing.pkp, top: existing.top || '30 hari' }
      : { name: '', address: '', contact: '', phone: '', bank: '', acct: '', bankAddress: '', pkp: true, top: '30 hari' },
  });
}

function supModal() {
  const st = getState(); const f = st.ui.supForm;
  const isEdit = !!f.editingId;
  return modal({
    title: isEdit ? tr({ id: 'Edit Supplier', en: 'Edit Supplier', zh: '编辑供应商' }) : t('md_add_supplier'), width: 560, onClose: () => setUI({ supModal: false }),
    body: [
      field(t('md_name'), inputEl({ placeholder: 'PT / CV …', value: f.name, onInput: v => (f.name = v) })),
      field(t('md_address'), h('textarea.input', { rows: 2, onInput: e => (f.address = e.target.value) }, f.address || '')),
      h('div.grid.g2', [field(t('md_contact'), inputEl({ value: f.contact, onInput: v => (f.contact = v) })), field(t('md_phone'), inputEl({ value: f.phone, onInput: v => (f.phone = v) }))]),
      h('div.divider'),
      h('div.grid.g2', [field(t('md_bank'), inputEl({ placeholder: 'BCA / Mandiri…', value: f.bank, onInput: v => (f.bank = v) })), field(t('md_acct'), inputEl({ mono: true, value: f.acct, onInput: v => (f.acct = v) }))]),
      field(tr({ id: 'Alamat Bank', en: 'Bank Address', zh: '开户行地址' }), inputEl({ value: f.bankAddress, onInput: v => (f.bankAddress = v) })),
      h('div.row.gap14', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' } }, [
        h('div.grow', [h('div', { style: { fontSize: '12px', fontWeight: 700 } }, t('md_pkp')), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('md_pkp_d'))]),
        toggle(f.pkp, v => { f.pkp = v; setState({}); }),
      ]),
      field(t('md_top'), selectEl(TOP_OPTIONS, { value: f.top, onChange: v => (f.top = v) })),
      h('div.cfg-banner', [icon('warn', 14), t('md_bank_review_note')]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ supModal: false }) }), btn(t('md_save_supplier'), { variant: 'primary', onClick: () => saveSup() })],
  });
}

async function saveSup() {
  if (blockWrite('simpan supplier')) return;
  const st = getState(); const f = st.ui.supForm;
  if (!f.name) { toast({ id: 'Nama supplier wajib', en: 'Supplier name is required', zh: '供应商名称必填' }); return; }
  if (f.editingId) {
    const sup = st.suppliers.find(s => s.id === f.editingId);
    if (!sup) { setUI({ supModal: false }); return; }
    // Compare the form against the STAGED values when a proposal exists,
    // otherwise against the live ones. Comparing only against live meant:
    //   * retyping the ORIGINAL account read as "no change", leaving the bad
    //     proposal queued with no way to withdraw it; and
    //   * editing just a phone number on a supplier with a pending proposal
    //     re-fired a bank_change audit entry.
    const stagedBank = sup.pendingBank || sup.bank;
    const stagedAcct = sup.pendingAcct || sup.acct;
    const stagedAddr = sup.pendingBankAddress || sup.bankAddress;
    const matchesApproved = sup.bank === f.bank && sup.acct === f.acct && sup.bankAddress === f.bankAddress;
    const matchesStaged = stagedBank === f.bank && stagedAcct === f.acct && stagedAddr === f.bankAddress;
    // Typing the approved account back in WITHDRAWS a pending proposal.
    const withdraw = !!sup.bankChangePending && matchesApproved;
    const bankChanged = !matchesApproved && !(sup.bankChangePending && matchesStaged);
    const before = `${sup.bank} ${sup.acct}`;

    // ANTI-FRAUD: a changed account is STAGED, not applied. bank/acct/
    // bankAddress keep their approved values until wilbert approves, so
    // prfPaper() (ui/documents.js) cannot print an unreviewed account.
    //
    // This used to Object.assign the new bank/acct straight onto the live
    // supplier and merely raise a `bankChangePending` flag that nothing read —
    // so a PRF built one minute later already carried the new account, and the
    // "Reject" button only fired a toast.
    const patch = {
      name: f.name, address: f.address, contact: f.contact, phone: f.phone,
      pkp: f.pkp, top: f.top, city: (f.address || '').split(',').pop().trim(),
    };
    if (withdraw) {
      patch.pendingBank = ''; patch.pendingAcct = ''; patch.pendingBankAddress = '';
      patch.bankChangePending = false;
    } else if (bankChanged) {
      patch.pendingBank = f.bank;
      patch.pendingAcct = f.acct;
      patch.pendingBankAddress = f.bankAddress;
      patch.bankChangePending = true;
    }

    // Snapshot for rollback: nothing local may diverge from the server.
    const snapshot = { ...sup };
    Object.assign(sup, patch);

    // Sync to Supabase: UPDATE if this row already has a real Supabase id
    // (a UUID); otherwise it's a seeded/local-only row being touched for the
    // first time — INSERT it now and adopt the server-assigned id so future
    // edits target the right row.
    try {
      if (UUID_RE.test(sup.id)) await updateSupplier(sup.id, sup);
      else { const saved = await insertSupplier(sup); sup.id = saved.id; }
    } catch (e) {
      // Roll back and STOP. The old code toasted and fell through with no
      // `return`, so a server-rejected edit still left the new account on the
      // in-memory record — and a PRF printed in that session showed an account
      // the server had refused.
      console.error('Supabase supplier sync failed', e);
      // Object.assign cannot DELETE keys the patch introduced. Supplier objects
      // that never went through suppliersApi.fromRow() (seeded/demo rows, or any
      // environment where the pending_* migration hasn't run) have no pending*
      // keys, so a rolled-back proposal stayed staged in memory and could then
      // be approved into the live account — despite the toast saying it was
      // cancelled.
      for (const k of Object.keys(sup)) if (!(k in snapshot)) delete sup[k];
      Object.assign(sup, snapshot);
      toast({
        id: 'Gagal sync ke server — perubahan dibatalkan: ' + (e.message || e),
        en: 'Server sync failed — changes rolled back: ' + (e.message || e),
        zh: '同步服务器失败 — 变更已回滚：' + (e.message || e),
      });
      setState({});
      return;
    }

    if (withdraw) {
      logAudit({ entity: 'supplier', target: sup.name, action: 'bank_withdrawn', detail: `usulan dibatalkan — tetap ${before}` });
      toast({
        id: 'Usulan rekening dibatalkan — rekening lama tetap aktif',
        en: 'Account proposal withdrawn — the old account stays active',
        zh: '账户变更申请已撤回 — 原账户继续有效',
      });
    } else if (bankChanged) {
      logAudit({ entity: 'supplier', target: sup.name, action: 'bank_change', detail: `usulan ${f.bank} ${f.acct} (aktif tetap ${before})`, status: 'menunggu review' });
      toast({
        id: 'Supplier diperbarui — rekening BARU belum aktif, menunggu approval Wilbert',
        en: "Supplier updated — the NEW account is not active yet, awaiting Wilbert's approval",
        zh: '供应商已更新 — 新账户尚未生效，等待 Wilbert 审批',
      });
    } else {
      toast({ id: 'Supplier diperbarui', en: 'Supplier updated', zh: '供应商已更新' });
    }
    setUI({ supModal: false });
    return;
  }
  // A BRAND-NEW supplier has no previously-approved account to protect, so its
  // details go in live (staging them would leave the supplier with no account
  // at all and block a legitimate first PRF). It's still flagged
  // bankChangePending so the review queue picks it up and the PRF preview warns
  // — see prfModal() in screens/payment.js.
  const localSup = { id: uid('sup'), name: f.name, address: f.address, contact: f.contact, phone: f.phone, bank: f.bank, acct: f.acct, bankAddress: f.bankAddress, pkp: f.pkp, top: f.top, city: (f.address || '').split(',').pop().trim(), bankChangePending: true, pendingBank: '', pendingAcct: '', pendingBankAddress: '' };
  try {
    const saved = await insertSupplier(localSup);
    localSup.id = saved.id;
  } catch (e) {
    console.error('Supabase supplier insert failed', e);
    toast({
      id: 'Gagal simpan supplier ke server: ' + (e.message || e),
      en: 'Failed to save supplier to server: ' + (e.message || e),
      zh: '保存供应商到服务器失败：' + (e.message || e),
    });
    return;
  }
  st.suppliers.unshift(localSup);
  logAudit({ entity: 'supplier', target: f.name, action: 'create', detail: `${f.bank} ${f.acct} · masuk review`, status: 'menunggu review' });
  setUI({ supModal: false });
  toast({
    id: 'Supplier tersimpan — detail bank masuk antrean review supervisor',
    en: 'Supplier saved — bank details queued for supervisor review',
    zh: '供应商已保存 — 银行账户信息已进入主管审核队列',
  });
}

async function openAuditDrawer(sup) {
  setUI({ auditFor: sup.id, auditEntries: null }); // null = loading
  const rows = await fetchAuditLog('suppliers', sup.name);
  setUI({ auditEntries: rows });
}

function auditDrawer(supId) {
  const st = getState(); const sup = st.suppliers.find(s => s.id === supId);
  // Supabase (trigger-written, persistent — the real source of truth per
  // item 4) when available; fall back to the old in-memory st.audit entries
  // for demo mode or for suppliers whose history predates the Supabase wiring.
  const serverEntries = st.ui.auditEntries;
  const entries = (serverEntries && serverEntries.length)
    ? serverEntries.map(a => ({ at: a.at, user: a.username, action: a.action, detail: a.detail, status: a.status }))
    : st.audit.filter(a => a.entity === 'supplier' && (a.target === (sup && sup.name)));
  const isWilbert = st.user.role === 'wilbert';
  const overlay = h('div', { style: { position: 'fixed', inset: 0, zIndex: 70 } }, [
    h('div', { style: { position: 'absolute', inset: 0, background: 'var(--overlay)' }, onClick: () => setUI({ auditFor: null }) }),
    h('div.drawer', [
      h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '18px 20px', borderBottom: '1px solid var(--border)' } }, [
        h('div', [h('div.modal-title', t('md_audit_log')), h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, sup ? sup.name : '—')]),
        h('button.x-btn', { onClick: () => setUI({ auditFor: null }) }, icon('x', 14)),
      ]),
      h('div', { style: { flex: 1, overflowY: 'auto', padding: '16px 20px' } }, [
        sup && sup.bankChangePending ? h('div.cfg-banner', { style: { marginBottom: '16px' } }, [icon('warn', 14), tr({ id: 'Perubahan rekening menunggu approval supervisor', en: 'Account change awaiting supervisor approval', zh: '账户变更等待主管审批' })]) : null,
        ...(entries.length ? entries : [{ at: new Date().toISOString(), user: 'system', action: 'no_history', detail: tr({ id: 'Belum ada riwayat perubahan', en: 'No change history yet', zh: '暂无变更记录' }) }]).map((a, i, arr) => h('div', { style: { display: 'flex', gap: '12px' } }, [
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [h('span', { style: { width: '11px', height: '11px', borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--text-3)', border: '2px solid var(--surface)', boxShadow: i === 0 ? '0 0 0 2px var(--accent)' : 'none' } }), i < arr.length - 1 ? h('span', { style: { flex: 1, width: '2px', background: 'var(--border)' } }) : null]),
          h('div', { style: { paddingBottom: '20px' } }, [
            h('div', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--text)' } }, actLabel(a.action)),
            h('div', { style: { fontSize: '11px', color: 'var(--text-2)', marginTop: '3px', lineHeight: 1.5 } }, a.detail || ''),
            h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px' } }, [tr({ id: `oleh `, en: `by `, zh: `由 ` }), h('b', { style: { color: 'var(--text-2)' } }, a.user), ` · ${fmtDateTime(a.at)}`, a.status ? h('span', { style: { color: 'var(--st-amber-tx)', fontWeight: 700 } }, ` · ${audStatusLabel(a.status)}`) : '']),
          ]),
        ])),
      ]),
      isWilbert && sup && sup.bankChangePending ? h('div.stack', { style: { gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--border)' } }, [
        // Show wilbert exactly what he's approving — old vs proposed, side by
        // side. Approving used to flip a local flag and write nothing.
        h('div', { style: { fontSize: '11px', lineHeight: 1.7 } }, [
          h('div', [h('span', { style: { color: 'var(--text-3)' } }, tr({ id: 'Aktif sekarang: ', en: 'Active now: ', zh: '当前生效：' })), h('b.mono', `${sup.bank || '—'} ${sup.acct || ''}`)]),
          h('div', [h('span', { style: { color: 'var(--text-3)' } }, tr({ id: 'Usulan baru: ', en: 'Proposed: ', zh: '变更申请：' })), h('b.mono', { style: { color: 'var(--st-amber-tx)' } }, `${sup.pendingBank || '—'} ${sup.pendingAcct || ''}`)]),
        ]),
        h('div.row.gap8', [
          btn(t('md_reject_change'), { variant: 'danger', onClick: () => resolveBankChange(sup, false) }),
          btn(t('md_approve_bank'), { variant: 'primary', onClick: () => resolveBankChange(sup, true) }),
        ]),
      ]) : null,
    ]),
  ]);
  return overlay;
}
// Approve  -> promote pending_* into the live account columns, clear staging.
// Reject   -> discard the staging, live account untouched.
// Either way it is a real UPDATE, so the suppliers audit trigger fires and the
// decision is recorded server-side. Previously Approve only flipped an
// in-memory flag (lost on next login) and Reject did nothing at all.
async function resolveBankChange(sup, approve) {
  if (blockWrite('putuskan usulan rekening')) return;
  const snapshot = { ...sup };
  const proposed = `${sup.pendingBank || ''} ${sup.pendingAcct || ''}`.trim();
  const previous = `${sup.bank || ''} ${sup.acct || ''}`.trim();

  if (approve) {
    sup.bank = sup.pendingBank || sup.bank;
    sup.acct = sup.pendingAcct || sup.acct;
    sup.bankAddress = sup.pendingBankAddress || sup.bankAddress;
  }
  sup.pendingBank = ''; sup.pendingAcct = ''; sup.pendingBankAddress = '';
  sup.bankChangePending = false;

  try {
    if (UUID_RE.test(sup.id)) await updateSupplier(sup.id, sup);
  } catch (e) {
    console.error('Supabase bank-change resolution failed', e);
    Object.assign(sup, snapshot);
    toast({
      id: 'Gagal simpan keputusan ke server — tidak ada yang berubah: ' + (e.message || e),
      en: 'Failed to save the decision to server — nothing changed: ' + (e.message || e),
      zh: '保存审批结果到服务器失败 — 未做任何变更：' + (e.message || e),
    });
    setState({});
    return;
  }

  logAudit({
    entity: 'supplier', target: sup.name,
    action: approve ? 'bank_approved' : 'bank_rejected',
    detail: approve ? `${proposed} (menggantikan ${previous})` : `usulan ${proposed} ditolak — tetap ${previous}`,
  });
  toast({
    id: approve ? 'Rekening baru disetujui & aktif' : 'Usulan rekening ditolak — rekening lama tetap aktif',
    en: approve ? 'New account approved & active' : 'Account proposal rejected — the old account stays active',
    zh: approve ? '新账户已批准并生效' : '账户变更申请已驳回 — 原账户继续有效',
  });
  setUI({ auditFor: null });
  setState({});
}

function actLabel(a) {
  const m = {
    bank_change: tr({ id: 'Rekening bank diubah', en: 'Bank account changed', zh: '银行账户已变更' }),
    top_change: tr({ id: 'Default TOP diubah', en: 'Default TOP changed', zh: '默认付款账期已变更' }),
    contact_update: tr({ id: 'Kontak PIC diperbarui', en: 'PIC contact updated', zh: '联系人已更新' }),
    create: tr({ id: 'Supplier dibuat', en: 'Supplier created', zh: '供应商已创建' }),
    delete: tr({ id: 'Supplier dihapus', en: 'Supplier deleted', zh: '供应商已删除' }),
    bank_approved: tr({ id: 'Rekening baru disetujui', en: 'New account approved', zh: '新账户已批准' }),
    bank_rejected: tr({ id: 'Usulan rekening ditolak', en: 'Account proposal rejected', zh: '账户变更申请已驳回' }),
    bank_withdrawn: tr({ id: 'Usulan rekening dibatalkan', en: 'Account proposal withdrawn', zh: '账户变更申请已撤回' }),
    no_history: tr({ id: 'Tidak ada riwayat', en: 'No history', zh: '暂无记录' }),
    insert: tr({ id: 'Dibuat (server)', en: 'Created (server)', zh: '已创建（服务器）' }),
    update: tr({ id: 'Diperbarui (server)', en: 'Updated (server)', zh: '已更新（服务器）' }),
  };
  return m[a] || a;
}

// DISPLAY-ONLY lookup for the audit `status` column. The stored values
// ('menunggu review', 'disetujui wilbert') are written by logAudit() and live in
// Postgres — they are never rewritten here, only rendered.
function audStatusLabel(s) {
  const m = {
    'menunggu review': tr({ id: 'menunggu review', en: 'awaiting review', zh: '待审核' }),
    'disetujui wilbert': tr({ id: 'disetujui wilbert', en: 'approved by Wilbert', zh: 'Wilbert 已批准' }),
  };
  return m[s] || s;
}

// ---------- Brand Mapping ----------
function brandsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [card([
    h('div.card-head', [h('div.card-title', tr({ id: 'Brand Mapping (Mandarin → Canonical)', en: 'Brand Mapping (Mandarin → Canonical)', zh: '品牌映射（中文 → 标准名）' })), editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openBrandModal() })) : null]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tr({ id: 'Canonical', en: 'Canonical', zh: '标准名' }), editable ? t('col_action') : ''].map(c => h('th', c)))),
      h('tbody', st.brandMap.map((b, i) => h('tr', [
        h('td.cell-strong', b.zh), h('td.mono', b.canonical),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openBrandModal(b) }),
          confirmDeleteBtn('brand:' + (b.id || i), () => deleteBrandMapRow(b)),
        ]) : null),
      ]))),
    ])),
  ]), st.ui.brandModal ? brandModal() : null]);
}

function openBrandModal(existing) {
  setUI({ brandModal: true, brandForm: existing ? { editingRef: existing, zh: existing.zh, canonical: existing.canonical } : { zh: '', canonical: '' } });
}

function brandModal() {
  const st = getState(); const f = st.ui.brandForm;
  const isEdit = !!f.editingRef;
  return modal({
    title: isEdit ? tr({ id: 'Edit Brand Mapping', en: 'Edit Brand Mapping', zh: '编辑品牌映射' }) : tr({ id: 'Add Brand Mapping', en: 'Add Brand Mapping', zh: '新增品牌映射' }), width: 420, onClose: () => setUI({ brandModal: false }),
    body: [
      field(tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), inputEl({ value: f.zh, onInput: v => (f.zh = v) })),
      field(tr({ id: 'Canonical (English)', en: 'Canonical (English)', zh: '标准名（英文）' }), inputEl({ mono: true, value: f.canonical, onInput: v => (f.canonical = v.toUpperCase()) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ brandModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveBrandModal() })],
  });
}

function saveBrandModal() {
  const st = getState(); const f = st.ui.brandForm;
  if (!f.zh || !f.canonical) { toast({ id: 'Mandarin dan Canonical wajib diisi', en: 'Mandarin and Canonical are both required', zh: '中文名和标准名均为必填' }); return; }
  if (f.editingRef) editBrandMap(f.editingRef, f.zh, f.canonical);
  else addBrandMap(f.zh, f.canonical);
  setUI({ brandModal: false });
}

async function addBrandMap(zh, canonical) {
  if (blockWrite('tambah brand map')) return;
  const st = getState();
  const local = { zh, canonical };
  try {
    const saved = await insertBrandMap(local);
    local.id = saved.id;
  } catch (e) {
    console.error('Supabase brand_map insert failed', e);
    toast({
      id: 'Gagal simpan brand mapping ke server: ' + (e.message || e),
      en: 'Failed to save brand mapping to server: ' + (e.message || e),
      zh: '保存品牌映射到服务器失败：' + (e.message || e),
    });
    return;
  }
  st.brandMap.push(local);
  toast({ id: 'Brand mapping ditambah', en: 'Brand mapping added', zh: '品牌映射已添加' });
  setState({});
}

async function editBrandMap(b, zh, canonical) {
  if (blockWrite('ubah brand map')) return;
  b.zh = zh; b.canonical = canonical;
  try {
    if (UUID_RE.test(b.id)) await updateBrandMap(b.id, b);
    else { const saved = await insertBrandMap(b); b.id = saved.id; }
  } catch (e) {
    console.error('Supabase brand_map sync failed', e);
    toast({
      id: 'Brand mapping diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Brand mapping updated locally, but server sync failed: ' + (e.message || e),
      zh: '品牌映射已在本地更新，但同步服务器失败：' + (e.message || e),
    });
    setState({});
    return;
  }
  toast({ id: 'Brand mapping diperbarui', en: 'Brand mapping updated', zh: '品牌映射已更新' });
  setState({});
}

async function deleteBrandMapRow(b) {
  if (blockWrite('hapus brand map')) return;
  const st = getState();
  try {
    if (UUID_RE.test(b.id)) await deleteBrandMap(b.id);
  } catch (e) {
    console.error('Supabase brand_map delete failed', e);
    toast({
      id: 'Gagal hapus dari server: ' + (e.message || e),
      en: 'Failed to delete on the server: ' + (e.message || e),
      zh: '从服务器删除失败：' + (e.message || e),
    });
    return;
  }
  st.brandMap = st.brandMap.filter(x => x !== b);
  toast({ id: 'Brand mapping dihapus', en: 'Brand mapping deleted', zh: '品牌映射已删除' });
  setState({ brandMap: st.brandMap });
}

// ---------- Description Dictionary ----------
function dictTab(st) {
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [card([
    h('div.card-head', [
      h('div', [h('div.card-title', tr({ id: 'Learning Description Dictionary (EN ↔ ZH)', en: 'Learning Description Dictionary (EN ↔ ZH)', zh: '自学习描述词典（英 ↔ 中）' })), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({ id: 'diisi otomatis saat membuat PRF — bisa dikoreksi manual', en: 'filled automatically when a PRF is created — can be corrected by hand', zh: '生成付款申请单时自动填充 — 可手工修正' }))]),
      editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openDictModal() })) : null,
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [tr({ id: 'English', en: 'English', zh: '英文' }), tr({ id: '中文', en: 'Chinese', zh: '中文' }), editable ? t('col_action') : ''].map(c => h('th', c)))),
      h('tbody', st.descDict.map((d, i) => h('tr', [
        h('td', d.en), h('td', d.zh),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openDictModal(d) }),
          confirmDeleteBtn('dict:' + (d.id || i), () => deleteDictEntry(d)),
        ]) : null),
      ]))),
    ])),
  ]), st.ui.dictModal ? dictModal() : null]);
}

function openDictModal(existing) {
  setUI({ dictModal: true, dictForm: existing ? { editingRef: existing, en: existing.en, zh: existing.zh } : { en: '', zh: '' } });
}

function dictModal() {
  const st = getState(); const f = st.ui.dictForm;
  const isEdit = !!f.editingRef;
  return modal({
    title: isEdit ? tr({ id: 'Edit Dictionary Entry', en: 'Edit Dictionary Entry', zh: '编辑词典条目' }) : tr({ id: 'Add Dictionary Entry', en: 'Add Dictionary Entry', zh: '新增词典条目' }), width: 420, onClose: () => setUI({ dictModal: false }),
    body: [
      field(tr({ id: 'English', en: 'English', zh: '英文' }), inputEl({ value: f.en, onInput: v => (f.en = v) })),
      field(tr({ id: '中文', en: 'Chinese', zh: '中文' }), inputEl({ value: f.zh, onInput: v => (f.zh = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ dictModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveDictModal() })],
  });
}

function saveDictModal() {
  const st = getState(); const f = st.ui.dictForm;
  if (!f.en || !f.zh) { toast({ id: 'English dan 中文 wajib diisi', en: 'English and 中文 are both required', zh: '英文和中文均为必填' }); return; }
  if (f.editingRef) editDictEntry(f.editingRef, f.en, f.zh);
  else addDictEntry(f.en, f.zh);
  setUI({ dictModal: false });
}

async function addDictEntry(en, zh) {
  if (blockWrite('tambah kamus')) return;
  const st = getState();
  const local = { en, zh };
  try {
    const saved = await insertDescDict(local);
    local.id = saved.id;
  } catch (e) {
    console.error('Supabase desc_dict insert failed', e);
    toast({
      id: 'Gagal simpan dictionary ke server: ' + (e.message || e),
      en: 'Failed to save dictionary entry to server: ' + (e.message || e),
      zh: '保存词典条目到服务器失败：' + (e.message || e),
    });
    return;
  }
  st.descDict.push(local);
  toast({ id: 'Dictionary ditambah', en: 'Dictionary entry added', zh: '词典条目已添加' });
  setState({});
}

async function editDictEntry(d, en, zh) {
  if (blockWrite('ubah kamus')) return;
  d.en = en; d.zh = zh;
  try {
    if (UUID_RE.test(d.id)) await updateDescDict(d.id, d);
    else { const saved = await insertDescDict(d); d.id = saved.id; }
  } catch (e) {
    console.error('Supabase desc_dict sync failed', e);
    toast({
      id: 'Dictionary diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Dictionary entry updated locally, but server sync failed: ' + (e.message || e),
      zh: '词典条目已在本地更新，但同步服务器失败：' + (e.message || e),
    });
    setState({});
    return;
  }
  toast({ id: 'Dictionary diperbarui', en: 'Dictionary entry updated', zh: '词典条目已更新' });
  setState({});
}

async function deleteDictEntry(d) {
  if (blockWrite('hapus kamus')) return;
  const st = getState();
  try {
    if (UUID_RE.test(d.id)) await deleteDescDict(d.id);
  } catch (e) {
    console.error('Supabase desc_dict delete failed', e);
    toast({
      id: 'Gagal hapus dari server: ' + (e.message || e),
      en: 'Failed to delete on the server: ' + (e.message || e),
      zh: '从服务器删除失败：' + (e.message || e),
    });
    return;
  }
  st.descDict = st.descDict.filter(x => x !== d);
  toast({ id: 'Dictionary dihapus', en: 'Dictionary entry deleted', zh: '词典条目已删除' });
  setState({ descDict: st.descDict });
}

// ---------- Item Master ----------
function itemsTab(st) {
  const q = (st.ui.mdItemQ || '').toLowerCase();
  const rows = st.items.filter(i => !q || `${i.erp} ${i.spec} ${i.brand}`.toLowerCase().includes(q));
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', tr({ id: 'Item Master', en: 'Item Master', zh: '物料主数据' })),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: `${st.items.length} item`,
        en: `${st.items.length} item${st.items.length === 1 ? '' : 's'}`,
        zh: `${st.items.length} 个物料`,
      })),
      h('div.mla.row.gap8', [searchInput({ id: 'md-q-item', placeholder: tr({ id: 'Search ERP / spec / brand…', en: 'Search ERP / spec / brand…', zh: '搜索 ERP / 规格 / 品牌…' }), value: st.ui.mdItemQ || '', onChange: v => setUI({ mdItemQ: v }) }), editable ? btn(tr({ id: 'Add Item', en: 'Add Item', zh: '新增物料' }), { variant: 'primary', iconName: 'plus', onClick: () => openItem() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_erp'), t('col_spec'), t('col_brand'), tr({ id: 'Market', en: 'Market', zh: '市场' }), tr({ id: 'Unit', en: 'Unit', zh: '单位' }), tr({ id: 'Name EN', en: 'Name EN', zh: '英文名称' }), t('col_action')].map(c => h('th', c)))),
      h('tbody', rows.map(i => h('tr', [
        h('td.mono.cell-strong', i.erp || '—'), h('td', i.spec || '—'), h('td', i.brand || '—'), h('td', i.market || '—'), h('td.mono', i.unit || '—'), h('td', i.nameEn || '—'),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openItem(i) }),
          confirmDeleteBtn('item:' + i.id, () => deleteItemRow(i)),
        ]) : null),
      ]))),
    ]))),
  ]);
}

function openItem(existing) {
  setUI({
    itemModal: true,
    itemForm: existing
      ? { ...existing }
      : { erp: '', spec: '', brand: '', market: '', unit: '张', ms: '', rr: '', noise: '', ean: '', nameEn: '', nameZh: '' },
  });
}

function itemModal() {
  const st = getState(); const f = st.ui.itemForm;
  const isEdit = !!f.id;
  return modal({
    title: isEdit ? tr({ id: 'Edit Item', en: 'Edit Item', zh: '编辑物料' }) : tr({ id: 'Add Item', en: 'Add Item', zh: '新增物料' }), width: 560, onClose: () => setUI({ itemModal: false }),
    body: [
      h('div.grid.g2', [field(t('col_erp'), inputEl({ mono: true, value: f.erp, onInput: v => (f.erp = v) })), field(t('col_spec'), inputEl({ value: f.spec, onInput: v => (f.spec = v) }))]),
      h('div.grid.g2', [field(t('col_brand'), inputEl({ value: f.brand, onInput: v => (f.brand = v) })), field(tr({ id: 'Market', en: 'Market', zh: '市场' }), inputEl({ value: f.market, onInput: v => (f.market = v) }))]),
      h('div.grid.g2', [field(tr({ id: 'Unit', en: 'Unit', zh: '单位' }), selectEl(st.units.length ? st.units.map(u => ({ value: u.code, label: u.intl ? `${u.code} · ${u.intl}` : u.code })) : ['张', '条', '千克kg', 'set'], { value: f.unit, onChange: v => (f.unit = v) })), field('EAN', inputEl({ mono: true, value: f.ean, onInput: v => (f.ean = v) }))]),
      h('div.grid.g2', [field(tr({ id: 'Name EN', en: 'Name EN', zh: '英文名称' }), inputEl({ value: f.nameEn, onInput: v => (f.nameEn = v) })), field(tr({ id: 'Name ZH', en: 'Name ZH', zh: '中文名称' }), inputEl({ value: f.nameZh, onInput: v => (f.nameZh = v) }))]),
      h('div.grid.g2', [field('MS', inputEl({ value: f.ms, onInput: v => (f.ms = v) })), field('RR', inputEl({ value: f.rr, onInput: v => (f.rr = v) }))]),
      field(tr({ id: 'Noise', en: 'Noise', zh: '噪音值' }), inputEl({ value: f.noise, onInput: v => (f.noise = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ itemModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveItem() })],
  });
}

async function saveItem() {
  if (blockWrite('simpan item master')) return;
  const st = getState(); const f = st.ui.itemForm;
  if (!f.erp) { toast({ id: 'Kode ERP wajib', en: 'ERP code is required', zh: 'ERP 编码必填' }); return; }
  if (f.id) {
    const it = st.items.find(x => x.id === f.id);
    if (it) Object.assign(it, f);
    try {
      if (UUID_RE.test(f.id)) await updateItem(f.id, it || f);
      else { const saved = await insertItem(it || f); if (it) it.id = saved.id; }
    } catch (e) {
      console.error('Supabase item sync failed', e);
      toast({
        id: 'Item diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e),
        en: 'Item updated locally, but server sync failed: ' + (e.message || e),
        zh: '物料已在本地更新，但同步服务器失败：' + (e.message || e),
      });
      setUI({ itemModal: false });
      setState({});
      return;
    }
    toast({ id: 'Item diperbarui', en: 'Item updated', zh: '物料已更新' });
  } else {
    const localItem = { ...f, id: uid('itm') };
    try {
      const saved = await insertItem(localItem);
      localItem.id = saved.id;
    } catch (e) {
      console.error('Supabase item insert failed', e);
      toast({
        id: 'Gagal simpan item ke server: ' + (e.message || e),
        en: 'Failed to save item to server: ' + (e.message || e),
        zh: '保存物料到服务器失败：' + (e.message || e),
      });
      return;
    }
    st.items.unshift(localItem);
    toast({ id: 'Item ditambah', en: 'Item added', zh: '物料已添加' });
  }
  setUI({ itemModal: false });
  setState({});
}

async function deleteItemRow(i) {
  if (blockWrite('hapus item master')) return;
  const st = getState();
  try {
    if (UUID_RE.test(i.id)) await deleteItem(i.id);
  } catch (e) {
    console.error('Supabase item delete failed', e);
    toast({
      id: 'Gagal hapus dari server: ' + (e.message || e),
      en: 'Failed to delete on the server: ' + (e.message || e),
      zh: '从服务器删除失败：' + (e.message || e),
    });
    return;
  }
  st.items = st.items.filter(x => x.id !== i.id);
  toast({ id: 'Item dihapus', en: 'Item deleted', zh: '物料已删除' });
  setState({ items: st.items });
}

// ---------- Unit ----------
function unitsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [card([
    h('div.card-head', [h('div.card-title', tr({ id: 'Unit', en: 'Unit', zh: '单位' })), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
      id: `${st.units.length} unit`,
      en: `${st.units.length} unit${st.units.length === 1 ? '' : 's'}`,
      zh: `${st.units.length} 个单位`,
    })), editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openUnitModal() })) : null]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tr({ id: 'International', en: 'International', zh: '国际单位' }), tr({ id: 'Keterangan', en: 'Notes', zh: '备注' }), editable ? t('col_action') : ''].map(c => h('th', c)))),
      h('tbody', st.units.map((u, i) => h('tr', [
        h('td.cell-strong.mono', u.code),
        h('td.mono', u.intl || '—'),
        h('td', u.note || '—'),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openUnitModal(u) }),
          confirmDeleteBtn('unit:' + (u.id || i), () => deleteUnitRow(u)),
        ]) : null),
      ]))),
    ])),
  ]), st.ui.unitModal ? unitModal() : null]);
}

function openUnitModal(existing) {
  setUI({ unitModal: true, unitForm: existing ? { editingRef: existing, code: existing.code, intl: existing.intl, note: existing.note } : { code: '', intl: '', note: '' } });
}

function unitModal() {
  const st = getState(); const f = st.ui.unitForm;
  const isEdit = !!f.editingRef;
  return modal({
    title: isEdit ? tr({ id: 'Edit Unit', en: 'Edit Unit', zh: '编辑单位' }) : tr({ id: 'Add Unit', en: 'Add Unit', zh: '新增单位' }), width: 380, onClose: () => setUI({ unitModal: false }),
    body: [
      field(tr({ id: 'Satuan Mandarin (张/条/千克)', en: 'Mandarin Unit (张/条/千克)', zh: '中文单位（张/条/千克）' }), inputEl({ value: f.code, onInput: v => (f.code = v) })),
      field(tr({ id: 'Satuan International (PC/KG/SET)', en: 'International Unit (PC/KG/SET)', zh: '国际单位（PC/KG/SET）' }), inputEl({ value: f.intl, onInput: v => (f.intl = v) })),
      field(tr({ id: 'Keterangan', en: 'Notes', zh: '备注' }), inputEl({ value: f.note, onInput: v => (f.note = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ unitModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveUnitModal() })],
  });
}

function saveUnitModal() {
  const st = getState(); const f = st.ui.unitForm;
  if (!f.code) { toast({ id: 'Kode unit wajib diisi', en: 'Unit code is required', zh: '单位编码必填' }); return; }
  if (f.editingRef) editUnit(f.editingRef, { code: f.code, intl: f.intl, note: f.note });
  else addUnit({ code: f.code, intl: f.intl, note: f.note });
  setUI({ unitModal: false });
}

async function addUnit(u) {
  if (blockWrite('tambah unit')) return;
  const st = getState();
  const local = { code: u.code, intl: u.intl, note: u.note };
  try {
    const saved = await insertUnit(local);
    local.id = saved.id;
  } catch (e) {
    console.error('Supabase unit insert failed', e);
    toast({
      id: 'Gagal simpan unit ke server: ' + (e.message || e),
      en: 'Failed to save unit to server: ' + (e.message || e),
      zh: '保存单位到服务器失败：' + (e.message || e),
    });
    return;
  }
  st.units.push(local);
  toast({ id: 'Unit ditambah', en: 'Unit added', zh: '单位已添加' });
  setState({});
}

async function editUnit(u, patch) {
  if (blockWrite('ubah unit')) return;
  Object.assign(u, patch);
  try {
    if (UUID_RE.test(u.id)) await updateUnit(u.id, u);
    else { const saved = await insertUnit(u); u.id = saved.id; }
  } catch (e) {
    console.error('Supabase unit sync failed', e);
    toast({
      id: 'Unit diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Unit updated locally, but server sync failed: ' + (e.message || e),
      zh: '单位已在本地更新，但同步服务器失败：' + (e.message || e),
    });
    setState({});
    return;
  }
  toast({ id: 'Unit diperbarui', en: 'Unit updated', zh: '单位已更新' });
  setState({});
}

async function deleteUnitRow(u) {
  if (blockWrite('hapus unit')) return;
  const st = getState();
  try {
    if (UUID_RE.test(u.id)) await deleteUnit(u.id);
  } catch (e) {
    console.error('Supabase unit delete failed', e);
    toast({
      id: 'Gagal hapus dari server: ' + (e.message || e),
      en: 'Failed to delete on the server: ' + (e.message || e),
      zh: '从服务器删除失败：' + (e.message || e),
    });
    return;
  }
  st.units = st.units.filter(x => x !== u);
  toast({ id: 'Unit dihapus', en: 'Unit deleted', zh: '单位已删除' });
  setState({ units: st.units });
}
