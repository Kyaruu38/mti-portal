import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { card, badge, btn, icon, modal, field, inputEl, selectEl, toggle } from '../ui/components.js';
import { fmtDateTime } from '../core/format.js';
import { can } from '../auth/roles.js';
import { insertSupplier, updateSupplier } from '../core/suppliersApi.js';
import { fetchAuditLog } from '../core/auditApi.js';
import { insertDescDict, updateDescDict, deleteDescDict } from '../core/descDictApi.js';
import { insertItem, updateItem, deleteItem } from '../core/itemsApi.js';
import { insertBrandMap, updateBrandMap, deleteBrandMap } from '../core/brandMapApi.js';
import { UUID_RE } from '../core/supabase.js';

export function masterDataScreen() {
  const st = getState(); const ui = st.ui;
  const tab = ui.mdTab || 'suppliers';
  const tabs = [['suppliers', t('md_suppliers')], ['brands', 'Brand Mapping'], ['dict', 'Description Dictionary'], ['items', 'Item Master']];

  const tabBar = h('div.row.gap8', tabs.map(([id, label]) => h('button.btn' + (tab === id ? '.btn-navy' : ''), { onClick: () => setUI({ mdTab: id }) }, label)));

  let content;
  if (tab === 'brands') content = brandsTab(st);
  else if (tab === 'dict') content = dictTab(st);
  else if (tab === 'items') content = itemsTab(st);
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
      h('button.btn.btn-sm', { style: { background: 'var(--st-red-tx)', color: '#fff', border: 'none', fontWeight: 700 }, onClick: onConfirm }, 'Yakin?'),
      btn('Batal', { sm: true, onClick: () => setUI({ mdDelConfirm: { ...(st.ui.mdDelConfirm || {}), [key]: false } }) }),
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
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.suppliers.length} aktif · perubahan rekening wajib review supervisor`),
      h('div.mla.row.gap8', [inputEl({ placeholder: 'Search supplier…', value: st.ui.mdQ || '', onInput: v => setUI({ mdQ: v }) }), editable ? btn(t('md_add_supplier'), { variant: 'primary', iconName: 'plus', onClick: () => openSup() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_supplier'), t('md_city'), t('md_contact'), t('md_bank'), 'PKP', 'TOP', t('col_action')].map(c => h('th', c)))),
      h('tbody', rows.map(s => h('tr', [
        h('td.cell-strong', [s.name, s.nameZh ? h('span', { style: { color: 'var(--text-3)', fontWeight: 500 } }, ' ' + s.nameZh) : null, s.bankChangePending ? h('span', { style: { marginLeft: '8px' } }, badge(t('md_bank_change_review'), 'amber')) : null]),
        h('td', s.city),
        h('td', `${s.contact} · ${s.phone}`),
        h('td.mono', { style: s.bankChangePending ? { color: 'var(--st-amber-tx)', fontWeight: 600 } : {} }, `${s.bank} ${s.acct}`),
        h('td', s.overseas ? badge('Overseas', 'gray') : badge(s.pkp ? 'PKP' : 'Non-PKP', s.pkp ? 'green' : 'gray')),
        h('td.mono', s.top),
        h('td', h('div.row.gap8', [
          btn(t('history'), { sm: true, onClick: () => openAuditDrawer(s) }),
          editable ? btn(t('edit'), { sm: true, onClick: () => openSup(s) }) : null,
          editable ? confirmDeleteBtn('sup:' + s.id, () => { st.suppliers = st.suppliers.filter(x => x.id !== s.id); setState({ suppliers: st.suppliers }); logAudit({ entity: 'supplier', target: s.name, action: 'delete' }); toast('Supplier dihapus'); }) : null,
        ])),
      ]))),
    ]))),
  ]);
}

function openSup(existing) {
  setUI({
    supModal: true,
    supForm: existing
      ? { editingId: existing.id, name: existing.name, address: existing.address || '', contact: existing.contact || '', phone: existing.phone || '', bank: existing.bank || '', acct: existing.acct || '', bankAddress: existing.bankAddress || '', pkp: !!existing.pkp, top: existing.top || '30 hari' }
      : { name: '', address: '', contact: '', phone: '', bank: '', acct: '', bankAddress: '', pkp: true, top: '30 hari' },
  });
}

function supModal() {
  const st = getState(); const f = st.ui.supForm;
  const isEdit = !!f.editingId;
  return modal({
    title: isEdit ? 'Edit Supplier' : t('md_add_supplier'), width: 560, onClose: () => setUI({ supModal: false }),
    body: [
      field(t('md_name'), inputEl({ placeholder: 'PT / CV …', value: f.name, onInput: v => (f.name = v) })),
      field(t('md_address'), h('textarea.input', { rows: 2, onInput: e => (f.address = e.target.value) }, f.address || '')),
      h('div.grid.g2', [field(t('md_contact'), inputEl({ value: f.contact, onInput: v => (f.contact = v) })), field(t('md_phone'), inputEl({ value: f.phone, onInput: v => (f.phone = v) }))]),
      h('div.divider'),
      h('div.grid.g2', [field(t('md_bank'), inputEl({ placeholder: 'BCA / Mandiri…', value: f.bank, onInput: v => (f.bank = v) })), field(t('md_acct'), inputEl({ mono: true, value: f.acct, onInput: v => (f.acct = v) }))]),
      field('Alamat Bank', inputEl({ value: f.bankAddress, onInput: v => (f.bankAddress = v) })),
      h('div.row.gap14', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' } }, [
        h('div.grow', [h('div', { style: { fontSize: '12px', fontWeight: 700 } }, t('md_pkp')), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('md_pkp_d'))]),
        toggle(f.pkp, v => { f.pkp = v; setState({}); }),
      ]),
      field(t('md_top'), selectEl(['30 hari', '45 hari', '60 hari', 'T/T 45 days B/L'], { value: f.top, onChange: v => (f.top = v) })),
      h('div.cfg-banner', [icon('warn', 14), t('md_bank_review_note')]),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ supModal: false }) }), btn(t('md_save_supplier'), { variant: 'primary', onClick: () => saveSup() })],
  });
}

async function saveSup() {
  const st = getState(); const f = st.ui.supForm;
  if (!f.name) { toast('Nama supplier wajib'); return; }
  if (f.editingId) {
    const sup = st.suppliers.find(s => s.id === f.editingId);
    if (!sup) { setUI({ supModal: false }); return; }
    const bankChanged = sup.bank !== f.bank || sup.acct !== f.acct || sup.bankAddress !== f.bankAddress;
    const before = `${sup.bank} ${sup.acct}`;
    Object.assign(sup, { name: f.name, address: f.address, contact: f.contact, phone: f.phone, bank: f.bank, acct: f.acct, bankAddress: f.bankAddress, pkp: f.pkp, top: f.top, city: (f.address || '').split(',').pop().trim() });
    if (bankChanged) sup.bankChangePending = true;

    // Sync to Supabase: UPDATE if this row already has a real Supabase id
    // (a UUID); otherwise it's a seeded/local-only row being touched for the
    // first time — INSERT it now and adopt the server-assigned id so future
    // edits target the right row.
    try {
      if (UUID_RE.test(sup.id)) await updateSupplier(sup.id, sup);
      else { const saved = await insertSupplier(sup); sup.id = saved.id; }
    } catch (e) {
      console.error('Supabase supplier sync failed', e);
      toast('Perubahan tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e));
    }

    if (bankChanged) {
      logAudit({ entity: 'supplier', target: sup.name, action: 'bank_change', detail: `${f.bank} ${f.acct} (dari ${before})`, status: 'menunggu review' });
      toast('Supplier diperbarui — perubahan rekening masuk antrean review supervisor');
    } else {
      toast('Supplier diperbarui');
    }
    setUI({ supModal: false });
    return;
  }
  const localSup = { id: uid('sup'), name: f.name, address: f.address, contact: f.contact, phone: f.phone, bank: f.bank, acct: f.acct, bankAddress: f.bankAddress, pkp: f.pkp, top: f.top, city: (f.address || '').split(',').pop().trim(), bankChangePending: true };
  try {
    const saved = await insertSupplier(localSup);
    localSup.id = saved.id;
  } catch (e) {
    console.error('Supabase supplier insert failed', e);
    toast('Gagal simpan supplier ke server: ' + (e.message || e));
    return;
  }
  st.suppliers.unshift(localSup);
  logAudit({ entity: 'supplier', target: f.name, action: 'create', detail: `${f.bank} ${f.acct} · masuk review`, status: 'menunggu review' });
  setUI({ supModal: false });
  toast('Supplier tersimpan — detail bank masuk antrean review supervisor');
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
        sup && sup.bankChangePending ? h('div.cfg-banner', { style: { marginBottom: '16px' } }, [icon('warn', 14), 'Perubahan rekening menunggu approval supervisor']) : null,
        ...(entries.length ? entries : [{ at: new Date().toISOString(), user: 'system', action: 'no_history', detail: 'Belum ada riwayat perubahan' }]).map((a, i, arr) => h('div', { style: { display: 'flex', gap: '12px' } }, [
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [h('span', { style: { width: '11px', height: '11px', borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--text-3)', border: '2px solid var(--surface)', boxShadow: i === 0 ? '0 0 0 2px var(--accent)' : 'none' } }), i < arr.length - 1 ? h('span', { style: { flex: 1, width: '2px', background: 'var(--border)' } }) : null]),
          h('div', { style: { paddingBottom: '20px' } }, [
            h('div', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--text)' } }, actLabel(a.action)),
            h('div', { style: { fontSize: '11px', color: 'var(--text-2)', marginTop: '3px', lineHeight: 1.5 } }, a.detail || ''),
            h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px' } }, [`oleh `, h('b', { style: { color: 'var(--text-2)' } }, a.user), ` · ${fmtDateTime(a.at)}`, a.status ? h('span', { style: { color: 'var(--st-amber-tx)', fontWeight: 700 } }, ` · ${a.status}`) : '']),
          ]),
        ])),
      ]),
      isWilbert && sup && sup.bankChangePending ? h('div.row.gap8', { style: { padding: '14px 20px', borderTop: '1px solid var(--border)' } }, [
        btn(t('md_reject_change'), { variant: 'danger', onClick: () => { toast('Perubahan rekening ditolak'); setUI({ auditFor: null }); } }),
        btn(t('md_approve_bank'), { variant: 'primary', onClick: () => { sup.bankChangePending = false; logAudit({ entity: 'supplier', target: sup.name, action: 'bank_approved', detail: `${sup.bank} ${sup.acct}` }); toast('Rekening baru disetujui'); setUI({ auditFor: null }); } }),
      ]) : null,
    ]),
  ]);
  return overlay;
}
function actLabel(a) { const m = { bank_change: 'Rekening bank diubah', top_change: 'Default TOP diubah', contact_update: 'Kontak PIC diperbarui', create: 'Supplier dibuat', delete: 'Supplier dihapus', bank_approved: 'Rekening baru disetujui', no_history: 'Tidak ada riwayat', insert: 'Dibuat (server)', update: 'Diperbarui (server)' }; return m[a] || a; }

// ---------- Brand Mapping ----------
function brandsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  return card([
    h('div.card-head', [h('div.card-title', 'Brand Mapping (Mandarin → Canonical)'), editable ? h('div.mla', btn('Add', { sm: true, variant: 'primary', iconName: 'plus', onClick: () => { const zh = prompt('Mandarin brand?'); const en = zh && prompt('Canonical English?'); if (zh && en) addBrandMap(zh, en.toUpperCase()); } })) : null]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['Mandarin', 'Canonical', editable ? t('col_action') : ''].map(c => h('th', c)))),
      h('tbody', st.brandMap.map((b, i) => h('tr', [
        h('td.cell-strong', b.zh), h('td.mono', b.canonical),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => { const zh = prompt('Mandarin brand?', b.zh); const en = zh && prompt('Canonical English?', b.canonical); if (zh && en) editBrandMap(b, zh, en.toUpperCase()); } }),
          confirmDeleteBtn('brand:' + (b.id || i), () => deleteBrandMapRow(b)),
        ]) : null),
      ]))),
    ])),
  ]);
}

async function addBrandMap(zh, canonical) {
  const st = getState();
  const local = { zh, canonical };
  try {
    const saved = await insertBrandMap(local);
    local.id = saved.id;
  } catch (e) {
    console.error('Supabase brand_map insert failed', e);
    toast('Gagal simpan brand mapping ke server: ' + (e.message || e));
    return;
  }
  st.brandMap.push(local);
  toast('Brand mapping ditambah');
  setState({});
}

async function editBrandMap(b, zh, canonical) {
  b.zh = zh; b.canonical = canonical;
  try {
    if (UUID_RE.test(b.id)) await updateBrandMap(b.id, b);
    else { const saved = await insertBrandMap(b); b.id = saved.id; }
  } catch (e) {
    console.error('Supabase brand_map sync failed', e);
    toast('Brand mapping diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e));
    setState({});
    return;
  }
  toast('Brand mapping diperbarui');
  setState({});
}

async function deleteBrandMapRow(b) {
  const st = getState();
  try {
    if (UUID_RE.test(b.id)) await deleteBrandMap(b.id);
  } catch (e) {
    console.error('Supabase brand_map delete failed', e);
    toast('Gagal hapus dari server: ' + (e.message || e));
    return;
  }
  st.brandMap = st.brandMap.filter(x => x !== b);
  toast('Brand mapping dihapus');
  setState({ brandMap: st.brandMap });
}

// ---------- Description Dictionary ----------
function dictTab(st) {
  const editable = can(st.user.role, 'editMaster');
  return card([
    h('div.card-head', [h('div.card-title', 'Learning Description Dictionary (EN ↔ ZH)'), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, 'diisi otomatis saat membuat PRF — bisa dikoreksi manual')]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', ['English', '中文', editable ? t('col_action') : ''].map(c => h('th', c)))),
      h('tbody', st.descDict.map((d, i) => h('tr', [
        h('td', d.en), h('td', d.zh),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => { const en = prompt('English?', d.en); const zh = en != null && prompt('中文?', d.zh); if (en && zh) editDictEntry(d, en, zh); } }),
          confirmDeleteBtn('dict:' + (d.id || i), () => deleteDictEntry(d)),
        ]) : null),
      ]))),
    ])),
  ]);
}

async function editDictEntry(d, en, zh) {
  d.en = en; d.zh = zh;
  try {
    if (UUID_RE.test(d.id)) await updateDescDict(d.id, d);
    else { const saved = await insertDescDict(d); d.id = saved.id; }
  } catch (e) {
    console.error('Supabase desc_dict sync failed', e);
    toast('Dictionary diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e));
    setState({});
    return;
  }
  toast('Dictionary diperbarui');
  setState({});
}

async function deleteDictEntry(d) {
  const st = getState();
  try {
    if (UUID_RE.test(d.id)) await deleteDescDict(d.id);
  } catch (e) {
    console.error('Supabase desc_dict delete failed', e);
    toast('Gagal hapus dari server: ' + (e.message || e));
    return;
  }
  st.descDict = st.descDict.filter(x => x !== d);
  toast('Dictionary dihapus');
  setState({ descDict: st.descDict });
}

// ---------- Item Master ----------
function itemsTab(st) {
  const q = (st.ui.mdItemQ || '').toLowerCase();
  const rows = st.items.filter(i => !q || `${i.erp} ${i.spec} ${i.brand}`.toLowerCase().includes(q));
  const editable = can(st.user.role, 'editMaster');
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', 'Item Master'),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${st.items.length} item`),
      h('div.mla.row.gap8', [inputEl({ placeholder: 'Search ERP / spec / brand…', value: st.ui.mdItemQ || '', onInput: v => setUI({ mdItemQ: v }) }), editable ? btn('Add Item', { variant: 'primary', iconName: 'plus', onClick: () => openItem() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', [t('col_erp'), t('col_spec'), t('col_brand'), 'Market', 'Unit', 'Name EN', t('col_action')].map(c => h('th', c)))),
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
    title: isEdit ? 'Edit Item' : 'Add Item', width: 560, onClose: () => setUI({ itemModal: false }),
    body: [
      h('div.grid.g2', [field(t('col_erp'), inputEl({ mono: true, value: f.erp, onInput: v => (f.erp = v) })), field(t('col_spec'), inputEl({ value: f.spec, onInput: v => (f.spec = v) }))]),
      h('div.grid.g2', [field(t('col_brand'), inputEl({ value: f.brand, onInput: v => (f.brand = v) })), field('Market', inputEl({ value: f.market, onInput: v => (f.market = v) }))]),
      h('div.grid.g2', [field('Unit', selectEl(['张', '条', '千克kg', 'set'], { value: f.unit, onChange: v => (f.unit = v) })), field('EAN', inputEl({ mono: true, value: f.ean, onInput: v => (f.ean = v) }))]),
      h('div.grid.g2', [field('Name EN', inputEl({ value: f.nameEn, onInput: v => (f.nameEn = v) })), field('Name ZH', inputEl({ value: f.nameZh, onInput: v => (f.nameZh = v) }))]),
      h('div.grid.g2', [field('MS', inputEl({ value: f.ms, onInput: v => (f.ms = v) })), field('RR', inputEl({ value: f.rr, onInput: v => (f.rr = v) }))]),
      field('Noise', inputEl({ value: f.noise, onInput: v => (f.noise = v) })),
    ],
    footer: [btn(t('cancel'), { onClick: () => setUI({ itemModal: false }) }), btn(t('save'), { variant: 'primary', onClick: () => saveItem() })],
  });
}

async function saveItem() {
  const st = getState(); const f = st.ui.itemForm;
  if (!f.erp) { toast('Kode ERP wajib'); return; }
  if (f.id) {
    const it = st.items.find(x => x.id === f.id);
    if (it) Object.assign(it, f);
    try {
      if (UUID_RE.test(f.id)) await updateItem(f.id, it || f);
      else { const saved = await insertItem(it || f); if (it) it.id = saved.id; }
    } catch (e) {
      console.error('Supabase item sync failed', e);
      toast('Item diperbarui lokal, tapi gagal sync ke server: ' + (e.message || e));
      setUI({ itemModal: false });
      setState({});
      return;
    }
    toast('Item diperbarui');
  } else {
    const localItem = { ...f, id: uid('itm') };
    try {
      const saved = await insertItem(localItem);
      localItem.id = saved.id;
    } catch (e) {
      console.error('Supabase item insert failed', e);
      toast('Gagal simpan item ke server: ' + (e.message || e));
      return;
    }
    st.items.unshift(localItem);
    toast('Item ditambah');
  }
  setUI({ itemModal: false });
  setState({});
}

async function deleteItemRow(i) {
  const st = getState();
  try {
    if (UUID_RE.test(i.id)) await deleteItem(i.id);
  } catch (e) {
    console.error('Supabase item delete failed', e);
    toast('Gagal hapus dari server: ' + (e.message || e));
    return;
  }
  st.items = st.items.filter(x => x.id !== i.id);
  toast('Item dihapus');
  setState({ items: st.items });
}
