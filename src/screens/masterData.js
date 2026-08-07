import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { blockWrite } from '../core/guard.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, modal, field, inputEl, selectEl, toggle, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { fmtDateTime, CURRENCIES, TOP_OPTIONS, ccyTone } from '../core/format.js';
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

// Opsi dropdown diambil dari isi tabelnya sendiri, bukan dari daftar master
// mana pun. Yang membuka corong sedang menatap baris-baris INI; pilihan yang
// tidak dimiliki satu baris pun cuma jalan buntu — dipilih, hasilnya nol, dan
// yang memilih menyimpulkan datanya hilang, bukan bahwa pilihannya memang tidak
// pernah dipakai. Himpunan tetap (valuta, TOP) tetap dari konstanta karena di
// situ "belum ada yang pakai" memang bukan alasan untuk menyembunyikannya.
const opsiDari = (rows, ambil) => [...new Set((rows || []).map(ambil).filter(Boolean))].sort();

// ---------- Suppliers ----------

// Satu sumber untuk lencana PKP: kotak saringnya harus menawarkan persis kata
// yang tercetak di kolomnya. Kalau dua tempat ini menghitung labelnya sendiri-
// sendiri, cukup satu kata berubah untuk membuat dropdown yang tidak pernah
// cocok dengan apa pun.
const labelPkp = s => s.overseas ? tr({ id: 'Overseas', en: 'Overseas', zh: '境外' }) : (s.pkp ? 'PKP' : 'Non-PKP');

const MEDAN_SUPPLIER = () => [
  // Nama Mandarin ikut dicocokkan karena ikut TERCETAK di kolom yang sama.
  // Penyaring lama cuma melihat s.name, jadi mengetik nama yang jelas-jelas
  // terbaca di layar bisa mengosongkan tabelnya.
  { kunci: 'nama', label: t('col_supplier'), tipe: 'teks', ambil: s => `${s.name || ''} ${s.nameZh || ''}` },
  { kunci: 'kota', label: t('md_city'), tipe: 'teks', ambil: s => s.city },
  // Kontak dan telepon satu kotak karena di tabel pun satu sel — memisahnya
  // memaksa orang menebak nomor itu tersimpan di kolom mana.
  { kunci: 'kontak', label: t('md_contact'), tipe: 'teks', ambil: s => `${s.contact || ''} ${s.phone || ''}` },
  // Nomor rekening dan SWIFT ikut karena keduanya tampil di sel Bank, dan
  // pencarian bank paling sering dimulai dari potongan nomor rekening yang
  // sedang dicocokkan orang dengan lampiran mutasi.
  { kunci: 'bank', label: t('md_bank'), tipe: 'teks', mono: true, ambil: s => `${s.bank || ''} ${s.acct || ''} ${s.swift || ''}` },
  { kunci: 'pkp', label: 'PKP', tipe: 'pilih', opsi: ['PKP', 'Non-PKP', tr({ id: 'Overseas', en: 'Overseas', zh: '境外' })], ambil: labelPkp },
  { kunci: 'ccy', label: tr({ id: 'Valuta', en: 'Currency', zh: '币种' }), tipe: 'pilih', opsi: CURRENCIES, ambil: s => s.currency || 'IDR' },
  // Sama seperti PKP: opsinya teks yang TERBACA ('30 days'), bukan yang
  // tersimpan ('30 hari'), supaya dropdown dan kolomnya bicara satu bahasa.
  { kunci: 'top', label: 'TOP', tipe: 'pilih', opsi: TOP_OPTIONS.map(termsText), ambil: s => termsText(s.top) },
];

function suppliersTab(st) {
  const editable = can(st.user.role, 'editMaster');
  const medan = MEDAN_SUPPLIER();
  const nilai = nilaiFilter('md-sup');
  const rows = saring(st.suppliers, medan, nilai);
  const kepala = [t('col_supplier'), t('md_city'), t('md_contact'), t('md_bank'), 'PKP', tr({ id: 'Valuta', en: 'Currency', zh: '币种' }), 'TOP', t('col_action')];
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', t('md_suppliers')),
      // Angka jumlahnya pindah ke hitunganSaring dan dicabut dari kalimat di
      // sebelahnya: dua angka bersebelahan yang berbeda ("3 dari 137" di kiri,
      // "137 aktif" di kanan) terbaca sebagai portal yang salah hitung.
      hitunganSaring(rows.length, st.suppliers.length, { id: 'supplier', en: `supplier${st.suppliers.length === 1 ? '' : 's'}`, zh: '家供应商' }),
      tombolFilter({ id: 'md-sup', medan, judul: t('md_suppliers') }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: 'rekening & mata uang dipakai langsung oleh PRF',
        en: 'account and currency are what the PRF uses',
        zh: '账户与币种即付款申请单所用',
      })),
      h('div.mla.row.gap8', [editable ? btn(t('md_add_supplier'), { variant: 'primary', iconName: 'plus', onClick: () => openSup() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map(c => h('th', c)))),
      h('tbody', rows.length ? rows.map(s => h('tr', [
        h('td.cell-strong', [s.name, s.nameZh ? h('span', { style: { color: 'var(--text-3)', fontWeight: 500 } }, ' ' + s.nameZh) : null]),
        h('td', s.city),
        h('td', `${s.contact} · ${s.phone}`),
        // One account, live, and it is exactly what a PRF prints today. There
        // is no second "proposed" line any more — see suppliersApi.js for why
        // the staging layer was removed.
        h('td.mono', [
          h('div', `${s.bank || '—'} ${s.acct || ''}`),
          s.swift ? h('div', { style: { color: 'var(--text-3)', fontSize: '10.5px', marginTop: '2px' } }, s.swift) : null,
        ]),
        h('td', badge(labelPkp(s), !s.overseas && s.pkp ? 'green' : 'gray')),
        h('td', badge(s.currency || 'IDR', ccyTone(s.currency || 'IDR'))),
        // Master data value, shown translated, stored exactly as chosen —
        // the <select> below still writes '30 hari'.
        h('td.mono', termsText(s.top)),
        h('td', h('div.row.gap8', [
          btn(t('history'), { sm: true, onClick: () => openAuditDrawer(s) }),
          editable ? btn(t('edit'), { sm: true, onClick: () => openSup(s) }) : null,
          editable ? confirmDeleteBtn('sup:' + s.id, () => { st.suppliers = st.suppliers.filter(x => x.id !== s.id); setState({ suppliers: st.suppliers }); logAudit({ entity: 'supplier', target: s.name, action: 'delete' }); toast({ id: 'Supplier dihapus', en: 'Supplier deleted', zh: '供应商已删除' }); }) : null,
        ])),
      ])) : barisTakCocok(kepala.length, { id: 'md-sup', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ]))),
  ]);
}

function openSup(existing) {
  setUI({
    supModal: true,
    supForm: existing
      ? { editingId: existing.id, name: existing.name, address: existing.address || '', contact: existing.contact || '', phone: existing.phone || '',
          bank: existing.bank || '', acct: existing.acct || '', bankAddress: existing.bankAddress || '',
          swift: existing.swift || '',
          currency: existing.currency || 'IDR',
          pkp: !!existing.pkp, overseas: !!existing.overseas, top: existing.top || '30 hari' }
      : { name: '', address: '', contact: '', phone: '', bank: '', acct: '', bankAddress: '', swift: '', currency: 'IDR', pkp: true, overseas: false, top: '30 hari' },
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
      // SWIFT/BIC appears only for an overseas supplier, and that is not
      // decoration: a domestic transfer between Indonesian banks does not use
      // one, so on a local supplier the field is a question with no answer. A
      // disabled box would still say "you are missing something".
      //
      // It sits directly under Bank Address because it is part of the same
      // instruction — a payment routed to the right account number at the wrong
      // SWIFT still lands in the wrong bank, so the two are one thought.
      f.overseas ? field(tr({ id: 'SWIFT / BIC', en: 'SWIFT / BIC', zh: 'SWIFT / BIC' }), (() => {
        // SWIFT codes are upper case by definition (ISO 9362). Stored upper via
        // toUpperCase, and DISPLAYED upper via CSS rather than by rewriting the
        // input's value: mount() has no diffing, so re-rendering on every
        // keystroke would take the cursor out of the box mid-code.
        const el = inputEl({ mono: true, placeholder: 'HSBCSGSG / ICBKCNBJ…', value: f.swift, onInput: v => (f.swift = v.toUpperCase()) });
        el.style.textTransform = 'uppercase';
        return el;
      })()) : null,
      // IMPORT / OVERSEAS.
      //
      // The database and the supplier list have carried `overseas` all along —
      // the list even renders an "Overseas" badge in place of PKP/Non-PKP — but
      // no form ever set it, so it could only ever be false.
      //
      // PKP is an INDONESIAN tax status. A supplier in Hangzhou or Ho Chi Minh
      // cannot be PKP and cannot be Non-PKP either; the question does not apply
      // to them. They issue no faktur pajak at all — import VAT is paid at
      // customs and evidenced by the PPKEK/PIB. So switching this on does not
      // just default PKP to off, it takes the question away.
      h('div.row.gap14', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' } }, [
        h('div.grow', [
          h('div', { style: { fontSize: '12px', fontWeight: 700 } }, tr({ id: 'Supplier Import / Luar Negeri', en: 'Import / Overseas supplier', zh: '进口 / 境外供应商' })),
          h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, tr({
            id: 'Tidak menerbitkan faktur pajak — PPN dibayar di bea cukai (PPKEK/PIB)',
            en: 'Issues no Indonesian tax invoice — VAT is paid at customs (PPKEK/PIB)',
            zh: '不开具印尼税票 — 增值税在海关缴纳（PPKEK/PIB）',
          })),
        ]),
        toggle(f.overseas, v => { f.overseas = v; if (v) f.pkp = false; setState({}); }),
      ]),
      f.overseas
        ? h('div', { style: { background: 'var(--navy-soft)', color: 'var(--navy-soft-tx)', borderRadius: '10px', padding: '10px 14px', fontSize: '11px', fontWeight: 600 } }, tr({
            id: 'Status PKP tidak berlaku untuk supplier luar negeri — pertanyaannya dilewati, bukan dijawab "Non-PKP".',
            en: 'PKP status does not apply to an overseas supplier — the question is skipped, not answered "Non-PKP".',
            zh: '境外供应商不适用 PKP 状态 — 该问题被跳过，而非填为“非 PKP”。',
          }))
        : h('div.row.gap14', { style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' } }, [
            h('div.grow', [h('div', { style: { fontSize: '12px', fontWeight: 700 } }, t('md_pkp')), h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, t('md_pkp_d'))]),
            toggle(f.pkp, v => { f.pkp = v; setState({}); }),
          ]),
      // CURRENCY and TOP sit together because they are the same kind of fact:
      // what was agreed with this supplier, known before any invoice arrives.
      //
      // Without it the Add Invoice form opened at IDR for everyone, so a USD
      // supplier started every entry with the wrong currency, and the PRF
      // builder printed an "IDR" badge for a supplier who has never been
      // billed in rupiah. Neither was reading anything — IDR was just the
      // fallback, and a fallback shown as a fact is how wrong numbers get
      // typed with confidence.
      h('div.row.gap14', [
        h('div.grow', field(t('md_currency'), selectEl(CURRENCIES, { value: f.currency, onChange: v => (f.currency = v) }))),
        h('div.grow', field(t('md_top'), selectEl(TOP_OPTIONS, { value: f.top, onChange: v => (f.top = v) }))),
      ]),
      // No review-queue notice: there is no queue. What replaces it is a plain
      // statement of consequence — this account is what the bank transfer will
      // use, and the change is signed. Saying "goes to review" when nothing
      // reviews it would be worse than saying nothing.
      h('div.cfg-banner', [icon('warn', 14), t('md_bank_live_note')]),
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
    // The account is written LIVE. What used to happen here was a staging
    // dance — the new account sat in pending_* until a supervisor approved it —
    // and it is gone at the owner's instruction; suppliersApi.js records why.
    //
    // The comparison stays, because the audit trail still needs to know whether
    // this save touched the payment instruction or just a phone number. A
    // `bank_change` entry on every phone edit would make the log unreadable,
    // and an unreadable log is the same as no log.
    // Field by field, so the audit line can name WHICH part moved. A summary
    // built from bank+acct alone reported "HSBC 004-123 → HSBC 004-123" when
    // only the SWIFT changed — an entry that says a payment instruction was
    // edited while showing two identical strings is worse than no entry: it
    // reads as a no-op and gets skimmed past. With no approval gate left, this
    // line is the whole control, so it has to be legible on its own.
    const BANK_FIELDS = [
      ['bank', 'Bank'], ['acct', 'No. Rek'], ['bankAddress', 'Alamat Bank'], ['swift', 'SWIFT'],
    ];
    const moved = BANK_FIELDS.filter(([k]) => (sup[k] || '') !== (f[k] || ''));
    const bankChanged = moved.length > 0;
    const before = moved.map(([k, label]) => `${label}: ${sup[k] || '—'} → ${f[k] || '—'}`).join(' · ');

    const patch = {
      name: f.name, address: f.address, contact: f.contact, phone: f.phone,
      bank: f.bank, acct: f.acct, bankAddress: f.bankAddress, swift: f.swift || '',
      currency: f.currency || 'IDR',
      pkp: f.pkp, overseas: !!f.overseas, top: f.top, city: (f.address || '').split(',').pop().trim(),
    };

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
      // Object.assign cannot DELETE keys the patch introduced, and a supplier
      // object that never went through suppliersApi.fromRow() (a seeded row)
      // may not carry every key the patch does. Drop the additions first, then
      // restore — otherwise a rejected edit leaves the new account sitting on
      // the in-memory record and a PRF printed in that session shows it.
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

    if (bankChanged) {
      // No approval gate left, so the audit line carries the whole story:
      // what it was, what it is now, who did it, when. That entry is the only
      // thing standing between a swapped account and nobody noticing — it is
      // written from the OLD and NEW values, not from an intention.
      logAudit({ entity: 'supplier', target: sup.name, action: 'bank_change', detail: before });
      toast({
        id: 'Rekening supplier diubah & langsung aktif — tercatat di History',
        en: 'Supplier account changed and live immediately — recorded in History',
        zh: '供应商账户已变更并立即生效 — 已记入历史',
      });
    } else {
      toast({ id: 'Supplier diperbarui', en: 'Supplier updated', zh: '供应商已更新' });
    }
    setUI({ supModal: false });
    return;
  }
  // A brand-new supplier goes in live. It used to be flagged for a review
  // queue as well, which is what broke this screen entirely: the flag pulled
  // four pending_* columns into the INSERT, the database has never had them,
  // and PostgREST rejects the whole row over one unknown column — so NO
  // supplier could be created at all. The flag is gone with the queue.
  const localSup = { id: uid('sup'), name: f.name, address: f.address, contact: f.contact, phone: f.phone, bank: f.bank, acct: f.acct, bankAddress: f.bankAddress, swift: f.swift || '', currency: f.currency || 'IDR', pkp: f.pkp, overseas: !!f.overseas, top: f.top, city: (f.address || '').split(',').pop().trim() };
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
  logAudit({ entity: 'supplier', target: f.name, action: 'create', detail: `${f.bank || '—'} ${f.acct || ''}${f.swift ? ' · ' + f.swift : ''}`.trim() });
  setUI({ supModal: false });
  toast({
    id: 'Supplier tersimpan & langsung aktif',
    en: 'Supplier saved and active immediately',
    zh: '供应商已保存并立即生效',
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
  const overlay =h('div', { style: { position: 'fixed', inset: 0, zIndex: 70 } }, [
    h('div', { style: { position: 'absolute', inset: 0, background: 'var(--overlay)' }, onClick: () => setUI({ auditFor: null }) }),
    h('div.drawer', [
      h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '18px 20px', borderBottom: '1px solid var(--border)' } }, [
        h('div', [h('div.modal-title', t('md_audit_log')), h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, sup ? sup.name : '—')]),
        h('button.x-btn', { onClick: () => setUI({ auditFor: null }) }, icon('x', 14)),
      ]),
      h('div', { style: { flex: 1, overflowY: 'auto', padding: '16px 20px' } }, [
        ...(entries.length ? entries : [{ at: new Date().toISOString(), user: 'system', action: 'no_history', detail: tr({ id: 'Belum ada riwayat perubahan', en: 'No change history yet', zh: '暂无变更记录' }) }]).map((a, i, arr) => h('div', { style: { display: 'flex', gap: '12px' } }, [
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [h('span', { style: { width: '11px', height: '11px', borderRadius: '50%', background: i === 0 ? 'var(--accent)' : 'var(--text-3)', border: '2px solid var(--surface)', boxShadow: i === 0 ? '0 0 0 2px var(--accent)' : 'none' } }), i < arr.length - 1 ? h('span', { style: { flex: 1, width: '2px', background: 'var(--border)' } }) : null]),
          h('div', { style: { paddingBottom: '20px' } }, [
            h('div', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--text)' } }, actLabel(a.action)),
            h('div', { style: { fontSize: '11px', color: 'var(--text-2)', marginTop: '3px', lineHeight: 1.5 } }, a.detail || ''),
            h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px' } }, [tr({ id: `oleh `, en: `by `, zh: `由 ` }), h('b', { style: { color: 'var(--text-2)' } }, a.user), ` · ${fmtDateTime(a.at)}`, a.status ? h('span', { style: { color: 'var(--st-amber-tx)', fontWeight: 700 } }, ` · ${audStatusLabel(a.status)}`) : '']),
          ]),
        ])),
      ]),
      // The Approve / Reject footer that used to sit here is gone with the
      // review queue. The drawer is now purely a record — which is what anyone
      // opening "History" was after in the first place.
    ]),
  ]);
  return overlay;
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
    'disetujui wilbert': tr({ id: 'disetujui supervisor', en: 'approved by the supervisor', zh: '主管已批准' }),
  };
  return m[s] || s;
}

// ---------- Brand Mapping ----------
const MEDAN_BRAND = () => [
  { kunci: 'zh', label: tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tipe: 'teks', ambil: b => b.zh },
  // Canonical sengaja kotak teks, bukan dropdown, walaupun himpunannya tertutup:
  // satu merek kanonik biasanya punya beberapa ejaan Mandarin, dan yang datang
  // ke tabel ini justru mau melihat SEMUA ejaan itu berjajar — mengetik sepotong
  // namanya menemukan mereka sekaligus, memilih satu nilai persis tidak.
  { kunci: 'canonical', label: tr({ id: 'Canonical', en: 'Canonical', zh: '标准名' }), tipe: 'teks', mono: true, ambil: b => b.canonical },
];

function brandsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  const judul = tr({ id: 'Brand Mapping (Mandarin → Canonical)', en: 'Brand Mapping (Mandarin → Canonical)', zh: '品牌映射（中文 → 标准名）' });
  const medan = MEDAN_BRAND();
  const nilai = nilaiFilter('md-brand');
  const rows = saring(st.brandMap, medan, nilai);
  const kepala = [tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tr({ id: 'Canonical', en: 'Canonical', zh: '标准名' }), editable ? t('col_action') : ''];
  return h('div.stack', [card([
    h('div.card-head', [
      h('div.card-title', judul),
      hitunganSaring(rows.length, st.brandMap.length, { id: 'merek', en: `brand${st.brandMap.length === 1 ? '' : 's'}`, zh: '个品牌' }),
      tombolFilter({ id: 'md-brand', medan, judul }),
      editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openBrandModal() })) : null,
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map(c => h('th', c)))),
      h('tbody', rows.length ? rows.map(b => h('tr', [
        h('td.cell-strong', b.zh), h('td.mono', b.canonical),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openBrandModal(b) }),
          // Baris yang belum punya id dikenali lewat posisinya di daftar ASAL,
          // bukan di daftar tersaring: nomor urut hasil saringan berubah tiap
          // kali saringannya diubah, dan konfirmasi "Yakin?" yang tergantung
          // padanya bisa pindah ke baris lain di bawah tangan orangnya.
          confirmDeleteBtn('brand:' + (b.id || st.brandMap.indexOf(b)), () => deleteBrandMapRow(b)),
        ]) : null),
      ])) : barisTakCocok(kepala.length, { id: 'md-brand', adaFilter: jumlahFilterAktif(nilai) > 0 })),
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
const MEDAN_DICT = () => [
  { kunci: 'en', label: tr({ id: 'English', en: 'English', zh: '英文' }), tipe: 'teks', ambil: d => d.en },
  { kunci: 'zh', label: tr({ id: '中文', en: 'Chinese', zh: '中文' }), tipe: 'teks', ambil: d => d.zh },
];

function dictTab(st) {
  const editable = can(st.user.role, 'editMaster');
  const judul = tr({ id: 'Learning Description Dictionary (EN ↔ ZH)', en: 'Learning Description Dictionary (EN ↔ ZH)', zh: '自学习描述词典（英 ↔ 中）' });
  const medan = MEDAN_DICT();
  const nilai = nilaiFilter('md-dict');
  // Kamus ini tumbuh sendiri tiap PRF dibuat, jadi justru daftar yang paling
  // cepat jadi terlalu panjang untuk dibaca — mencocokkan satu istilah dengan
  // mata, dari atas ke bawah, berhenti masuk akal jauh sebelum tabel lainnya.
  const rows = saring(st.descDict, medan, nilai);
  const kepala = [tr({ id: 'English', en: 'English', zh: '英文' }), tr({ id: '中文', en: 'Chinese', zh: '中文' }), editable ? t('col_action') : ''];
  return h('div.stack', [card([
    h('div.card-head', [
      h('div', [h('div.card-title', judul), h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({ id: 'diisi otomatis saat membuat PRF — bisa dikoreksi manual', en: 'filled automatically when a PRF is created — can be corrected by hand', zh: '生成付款申请单时自动填充 — 可手工修正' }))]),
      hitunganSaring(rows.length, st.descDict.length, { id: 'istilah', en: `term${st.descDict.length === 1 ? '' : 's'}`, zh: '个词条' }),
      tombolFilter({ id: 'md-dict', medan, judul }),
      editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openDictModal() })) : null,
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map(c => h('th', c)))),
      h('tbody', rows.length ? rows.map(d => h('tr', [
        h('td', d.en), h('td', d.zh),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openDictModal(d) }),
          confirmDeleteBtn('dict:' + (d.id || st.descDict.indexOf(d)), () => deleteDictEntry(d)),
        ]) : null),
      ])) : barisTakCocok(kepala.length, { id: 'md-dict', adaFilter: jumlahFilterAktif(nilai) > 0 })),
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

// Brand, market dan unit jadi dropdown karena ketiganya dipakai untuk
// MEMPERSEMPIT, bukan untuk mencari: yang membukanya ingin "semua item merek
// ini", dan mengetiknya sendiri cuma menambah peluang salah eja pada nilai yang
// sudah pasti ada di data. Opsinya dari isi tabel — lihat catatan opsiDari.
const MEDAN_ITEM = (rows) => [
  { kunci: 'erp', label: t('col_erp'), tipe: 'teks', mono: true, ambil: i => i.erp },
  { kunci: 'spec', label: t('col_spec'), tipe: 'teks', ambil: i => i.spec },
  { kunci: 'brand', label: t('col_brand'), tipe: 'pilih', opsi: opsiDari(rows, i => i.brand), ambil: i => i.brand },
  { kunci: 'market', label: tr({ id: 'Market', en: 'Market', zh: '市场' }), tipe: 'pilih', opsi: opsiDari(rows, i => i.market), ambil: i => i.market },
  // Unit sengaja TIDAK diambil dari tab Unit sebelah: master unit boleh berisi
  // satuan yang belum dipakai item mana pun, dan di sini yang ditawarkan harus
  // yang benar-benar berdiri di kolomnya.
  { kunci: 'unit', label: tr({ id: 'Unit', en: 'Unit', zh: '单位' }), tipe: 'pilih', opsi: opsiDari(rows, i => i.unit), ambil: i => i.unit },
  { kunci: 'nameEn', label: tr({ id: 'Name EN', en: 'Name EN', zh: '英文名称' }), tipe: 'teks', ambil: i => i.nameEn },
];

function itemsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  const judul = tr({ id: 'Item Master', en: 'Item Master', zh: '物料主数据' });
  const medan = MEDAN_ITEM(st.items);
  const nilai = nilaiFilter('md-item');
  const rows = saring(st.items, medan, nilai);
  const kepala = [t('col_erp'), t('col_spec'), t('col_brand'), tr({ id: 'Market', en: 'Market', zh: '市场' }), tr({ id: 'Unit', en: 'Unit', zh: '单位' }), tr({ id: 'Name EN', en: 'Name EN', zh: '英文名称' }), t('col_action')];
  return h('div.stack', [
    h('div.row.gap8', [
      h('div.card-title', judul),
      hitunganSaring(rows.length, st.items.length, { id: 'item', en: `item${st.items.length === 1 ? '' : 's'}`, zh: '个物料' }),
      tombolFilter({ id: 'md-item', medan, judul }),
      h('div.mla.row.gap8', [editable ? btn(tr({ id: 'Add Item', en: 'Add Item', zh: '新增物料' }), { variant: 'primary', iconName: 'plus', onClick: () => openItem() }) : null]),
    ]),
    h('div.card', h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map(c => h('th', c)))),
      h('tbody', rows.length ? rows.map(i => h('tr', [
        h('td.mono.cell-strong', i.erp || '—'), h('td', i.spec || '—'), h('td', i.brand || '—'), h('td', i.market || '—'), h('td.mono', i.unit || '—'), h('td', i.nameEn || '—'),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openItem(i) }),
          confirmDeleteBtn('item:' + i.id, () => deleteItemRow(i)),
        ]) : null),
      ])) : barisTakCocok(kepala.length, { id: 'md-item', adaFilter: jumlahFilterAktif(nilai) > 0 })),
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
const MEDAN_UNIT = (rows) => [
  { kunci: 'code', label: tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tipe: 'teks', mono: true, ambil: u => u.code },
  // PC/KG/SET adalah himpunan pendek yang berulang di banyak baris — persis
  // bentuk yang lebih enak dipilih daripada diketik.
  { kunci: 'intl', label: tr({ id: 'International', en: 'International', zh: '国际单位' }), tipe: 'pilih', opsi: opsiDari(rows, u => u.intl), ambil: u => u.intl },
  { kunci: 'note', label: tr({ id: 'Keterangan', en: 'Notes', zh: '备注' }), tipe: 'teks', ambil: u => u.note },
];

function unitsTab(st) {
  const editable = can(st.user.role, 'editMaster');
  const judul = tr({ id: 'Unit', en: 'Unit', zh: '单位' });
  const medan = MEDAN_UNIT(st.units);
  const nilai = nilaiFilter('md-unit');
  const rows = saring(st.units, medan, nilai);
  const kepala = [tr({ id: 'Mandarin', en: 'Mandarin', zh: '中文' }), tr({ id: 'International', en: 'International', zh: '国际单位' }), tr({ id: 'Keterangan', en: 'Notes', zh: '备注' }), editable ? t('col_action') : ''];
  return h('div.stack', [card([
    h('div.card-head', [
      h('div.card-title', judul),
      hitunganSaring(rows.length, st.units.length, { id: 'unit', en: `unit${st.units.length === 1 ? '' : 's'}`, zh: '个单位' }),
      tombolFilter({ id: 'md-unit', medan, judul }),
      editable ? h('div.mla', btn(tr({ id: 'Add', en: 'Add', zh: '新增' }), { sm: true, variant: 'primary', iconName: 'plus', onClick: () => openUnitModal() })) : null,
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map(c => h('th', c)))),
      h('tbody', rows.length ? rows.map(u => h('tr', [
        h('td.cell-strong.mono', u.code),
        h('td.mono', u.intl || '—'),
        h('td', u.note || '—'),
        h('td', editable ? h('div.row.gap8', [
          btn(t('edit'), { sm: true, onClick: () => openUnitModal(u) }),
          confirmDeleteBtn('unit:' + (u.id || st.units.indexOf(u)), () => deleteUnitRow(u)),
        ]) : null),
      ])) : barisTakCocok(kepala.length, { id: 'md-unit', adaFilter: jumlahFilterAktif(nilai) > 0 })),
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
