import { h, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { badge, btn, icon, driveLink, selectEl, inputEl, searchInput, modal, field } from '../ui/components.js';
import { uploadToDrive } from '../core/drive.js';
import { insertDesign, updateDesign, deleteDesign } from '../core/designsApi.js';
import { can } from '../auth/roles.js';
import { blockWrite } from '../core/guard.js';
import { renderThumb } from '../parsers/pdf.js';

export function labelLibraryScreen() {
  const st = getState(); const ui = st.ui;
  const q = (ui.libQ || '').toLowerCase();
  const brand = ui.libBrand || t('lib_all_brand');
  const market = ui.libMarket || t('lib_all_market');
  const designs = st.designs.filter(d =>
    (!q || `${d.erp} ${d.spec} ${d.brand}`.toLowerCase().includes(q)) &&
    (brand === t('lib_all_brand') || d.brand === brand) &&
    (market === t('lib_all_market') || d.market === market));

  const brands = [t('lib_all_brand'), ...new Set(st.designs.map(d => d.brand))];
  const markets = [t('lib_all_market'), ...new Set(st.designs.map(d => d.market))];

  const toolbar = h('div.row.gap8.wrap', [
    searchInput({ id: 'lib-q', placeholder: t('lib_search'), value: ui.libQ || '', onChange: v => setUI({ libQ: v }) }),
    selectEl(brands, { value: brand, onChange: v => setUI({ libBrand: v }) }),
    selectEl(markets, { value: market, onChange: v => setUI({ libMarket: v }) }),
    h('span', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, [h('span.mono', String(st.designs.length)), ` ${t('lib_designs')}`]),
    // designWrite, not screen presence. This file had no capability check at
    // all: every role that could open the library could also add to it.
    can(st.user.role, 'designWrite')
      ? h('div.mla', btn(t('lib_upload'), { variant: 'primary', iconName: 'upload', onClick: () => uploadDesign() }))
      : h('div.mla', badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' })),
  ]);

  const grid = h('div.lib-grid', designs.map(d => card(d)));
  const open = ui.libPreview ? st.designs.find(d => d.id === ui.libPreview) : null;
  return h('div.stack', [
    toolbar,
    grid,
    open ? (ui.libEdit ? editModal(st, open) : previewModal(st, open)) : null,
  ]);
}

// PREVIEW — the artwork at a size a human can actually check.
//
// The grid thumbnail is 79x254mm of tyre label squeezed into a card; nobody can
// read a size code off it. This is the difference between "there is a design on
// file" and "the design on file is the right one", and only the second one
// prevents a wrong print run.
function previewModal(st, d) {
  const img = designImage(d);
  const mayWrite = can(st.user.role, 'designWrite');
  // Closing always disarms the delete. Otherwise reopening a design later can
  // land on a button that is already one click from destroying it.
  const close = () => setUI({ libPreview: null, libEdit: false, libConfirmDel: null });

  const row = (label, value) => h('div.row.gap8', { style: { padding: '7px 0', borderBottom: '1px solid var(--border)' } }, [
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', minWidth: '92px' } }, label),
    h('div.mono', { style: { fontSize: '11.5px', color: 'var(--text)', wordBreak: 'break-all' } }, value || '—'),
  ]);

  return modal({
    title: d.erp, subtitle: d.spec && d.spec !== '—' ? d.spec : null, width: 720, onClose: close,
    body: h('div.row.gap14', { style: { alignItems: 'flex-start', flexWrap: 'wrap' } }, [
      h('div', { style: { flex: '0 0 240px' } }, img
        ? h('img', { src: img, alt: d.erp, style: { width: '100%', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)' } })
        : h('div', {
            style: { width: '100%', padding: '48px 12px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: '8px', lineHeight: 1.6 },
          }, tr({
            // Honest about WHY, because "no image" and "image not saved" need
            // different actions from the person reading it.
            id: 'Tidak ada gambar tersimpan untuk desain ini. Upload ulang filenya supaya bisa dilihat semua orang.',
            en: 'No image stored for this design. Re-upload the file so everyone can see it.',
            zh: '此设计没有已保存的图片。请重新上传文件，以便所有人都能查看。',
          })),
      ),
      h('div', { style: { flex: '1 1 300px', minWidth: '260px' } }, [
        row(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编码' }), d.erp),
        row(tr({ id: 'Spec', en: 'Spec', zh: '规格' }), d.spec),
        row(tr({ id: 'Brand', en: 'Brand', zh: '品牌' }), d.brand),
        row(tr({ id: 'Market', en: 'Market', zh: '市场' }), d.market),
        row(tr({ id: 'Versi', en: 'Version', zh: '版本' }), `${d.ver} · ${updatedText(d.updated)}`),
        h('div', { style: { marginTop: '10px' } }, driveLink(d.driveUrl)),
      ]),
    ]),
    footer: h('div.row.gap8', { style: { justifyContent: 'space-between', width: '100%' } }, [
      mayWrite
        ? deleteBtn(st, d)
        : h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({ id: 'Hanya lihat', en: 'View only', zh: '仅查看' })),
      h('div.row.gap8', [
        btn(t('close'), { onClick: close }),
        mayWrite ? btn(t('edit'), { variant: 'primary', iconName: 'edit', onClick: () => setUI({ libEdit: true }) }) : null,
      ]),
    ]),
  });
}

// EDIT — the four fields a human types. Deliberately NOT the image or the Drive
// link: those come from an upload, and letting them be typed here would create
// a card that claims a file nobody can open.
function editModal(st, d) {
  const draft = { erp: d.erp || '', spec: d.spec || '', brand: d.brand || '', market: d.market || '', ver: d.ver || '' };
  const close = () => setUI({ libEdit: false });

  const f = (label, key, ph) => field(label, inputEl({
    value: draft[key], placeholder: ph, mono: key === 'erp',
    onInput: v => { draft[key] = v; },
  }));

  return modal({
    title: tr({ id: 'Edit desain', en: 'Edit design', zh: '编辑设计' }), subtitle: d.erp, width: 520, onClose: close,
    body: h('div.stack', { style: { gap: '10px' } }, [
      f(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编码' }), 'erp', 'LBL-…'),
      f(tr({ id: 'Spec', en: 'Spec', zh: '规格' }), 'spec', 'ID295/80R22.5-18PR…'),
      h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', gap: '10px' } }, [
        f(tr({ id: 'Brand', en: 'Brand', zh: '品牌' }), 'brand', 'NEBULA'),
        f(tr({ id: 'Market', en: 'Market', zh: '市场' }), 'market', 'ID-…'),
      ]),
      f(tr({ id: 'Versi', en: 'Version', zh: '版本' }), 'ver', 'v1'),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
        id: 'Gambar dan link Drive tidak diedit di sini — keduanya datang dari file yang diupload. Untuk mengganti gambarnya, upload desain baru.',
        en: 'The image and Drive link are not edited here — both come from the uploaded file. To change the artwork, upload a new design.',
        zh: '图片与 Drive 链接不在此处编辑 — 两者均来自上传的文件。如需更换图稿，请上传新设计。',
      })),
    ]),
    footer: h('div.row.gap8', { style: { justifyContent: 'flex-end', width: '100%' } }, [
      btn(t('cancel'), { onClick: close }),
      btn(t('save'), { variant: 'primary', onClick: () => saveEdit(d, draft) }),
    ]),
  });
}

async function saveEdit(d, draft) {
  if (blockWrite('edit desain label')) return;
  const erp = (draft.erp || '').trim();
  if (!erp) {
    toast({ id: 'Kode ERP tidak boleh kosong.', en: 'The ERP code cannot be empty.', zh: 'ERP 编码不能为空。' });
    return;
  }
  const patch = { erp, spec: (draft.spec || '').trim() || '—', brand: (draft.brand || '').trim() || '—', market: (draft.market || '').trim() || '—', ver: (draft.ver || '').trim() || d.ver };
  const before = { ...d };
  try {
    await updateDesign(d.id, patch);
  } catch (e) {
    console.error('updateDesign failed', e);
    toast({
      id: 'Gagal simpan ke server: ' + (e.message || e),
      en: 'Failed to save to the server: ' + (e.message || e),
      zh: '保存到服务器失败：' + (e.message || e),
    });
    return;   // modal stays open, nothing typed is lost
  }
  Object.assign(d, patch);
  // Names the fields that actually moved, not "edited" — a History line that
  // does not say what changed is the same as no History line.
  const changed = Object.keys(patch).filter(k => String(before[k] || '') !== String(patch[k] || ''));
  logAudit({ entity: 'design', target: erp, action: 'edit', detail: changed.length ? changed.map(k => `${k}: ${before[k] || '—'} → ${patch[k]}`).join(' · ') : 'tidak ada perubahan' });
  setUI({ libEdit: false });
  toast({ id: `Desain ${erp} disimpan`, en: `Design ${erp} saved`, zh: `设计 ${erp} 已保存` });
  setState({});
}

// The delete button in the preview footer. Two states, and the armed one NAMES
// the design — the same shape the invoice and PRF deletes use. An unlabelled
// "Are you sure?" is a reflex, not a decision.
function deleteBtn(st, d) {
  const armed = st.ui.libConfirmDel === d.id;
  if (!armed) {
    return btn(t('delete'), { variant: 'danger', iconName: 'x', onClick: () => setUI({ libConfirmDel: d.id }) });
  }
  return h('div.row.gap8', [
    btn(tr({ id: `Ya, hapus ${d.erp}`, en: `Yes, delete ${d.erp}`, zh: `确认删除 ${d.erp}` }),
      { variant: 'danger', iconName: 'check', onClick: () => doDelete(d) }),
    btn(tr({ id: 'Jangan', en: 'Keep it', zh: '保留' }), { onClick: () => setUI({ libConfirmDel: null }) }),
  ]);
}

async function doDelete(d) {
  if (blockWrite('hapus desain label')) return;
  const st = getState();
  // Refused while something still points at it — same rule the invoice delete
  // follows. A design that a label request is built on is not spare.
  const usedBy = (st.labelBatches || []).filter(b => (b.rows || []).some(r => r.erp && r.erp === d.erp)).length;
  if (usedBy) {
    toast({
      id: `Tidak bisa dihapus: desain ${d.erp} dipakai di ${usedBy} label request.`,
      en: `Cannot delete: design ${d.erp} is used by ${usedBy} label request(s).`,
      zh: `无法删除：设计 ${d.erp} 已被 ${usedBy} 份标签申请引用。`,
    });
    return;
  }
  try {
    await deleteDesign(d.id);
  } catch (e) {
    console.error('deleteDesign failed', e);
    toast({
      id: 'Gagal hapus di server: ' + (e.message || e),
      en: 'Failed to delete on the server: ' + (e.message || e),
      zh: '在服务器上删除失败：' + (e.message || e),
    });
    return;
  }
  st.designs = st.designs.filter(x => x.id !== d.id);
  logAudit({ entity: 'design', target: d.erp, action: 'hapus', detail: `${d.brand || '—'} · ${d.market || '—'} · ${d.ver || '—'}` });
  setUI({ libPreview: null, libEdit: false, libConfirmDel: null });
  toast({ id: `Desain ${d.erp} dihapus`, en: `Design ${d.erp} deleted`, zh: `设计 ${d.erp} 已删除` });
  setState({});
}

// WHICH PICTURE TO SHOW — read this before "simplifying" it.
//
// A design carries two image fields and only ONE of them survives leaving the
// browser that uploaded it:
//
//   thumb      base64 JPEG, stored in Postgres. Everyone sees it, forever.
//   designUrl  a blob: URL from URL.createObjectURL(). Valid ONLY inside the
//              tab that made it. In any other browser it is a dead pointer.
//
// The card used to render `designUrl` and never touched `thumb`. So the person
// who uploaded the design saw their artwork, and every colleague saw a broken
// image icon — while the real picture sat in the database the whole time,
// unused. It looked like a permission problem and was not one.
//
// thumb first, always. designUrl is only a same-session sharpness upgrade.
export function designImage(d) {
  if (d.thumb) return d.thumb;
  if (d.designUrl && !d.designUrl.startsWith('drive-') && !d.designUrl.startsWith('blob:')) return d.designUrl;
  // A blob: URL is still worth showing IN the session that created it.
  if (d.designUrl && d.designUrl.startsWith('blob:')) return d.designUrl;
  return '';
}

function card(d) {
  const img = designImage(d);
  return h('div.lib-card', { style: { cursor: 'pointer' }, onClick: () => setUI({ libPreview: d.id }) }, [
    h('div.lib-thumb', h('div.lib-label', { style: img ? { background: 'none', border: 'none' } : {} }, img
      ? h('img', { src: img, alt: d.erp })
      : [h('span', { style: { width: '100%', height: '20px', background: d.color || '#1B3A6B' } }), h('span.mono', { style: { flex: 1, display: 'flex', alignItems: 'center', fontSize: '8.5px', color: 'var(--text-3)', writingMode: 'vertical-rl' } }, tr({
        id: 'label artwork · 79×254 mm',
        en: 'label artwork · 79×254 mm',
        zh: '标签图稿 · 79×254 mm',
      }))])),
    h('div.mono', { style: { fontSize: '11.8px', fontWeight: 700, color: 'var(--text)', marginTop: '9px' } }, d.erp),
    h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, d.spec),
    h('div.row.gap8', { style: { marginTop: '7px' } }, [
      badge(d.brand, brandTone(d.brand)),
      h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, d.market),
      // stopPropagation: the whole card opens the preview now, and a Drive link
      // that also opened the preview behind the new tab would be maddening.
      h('div.mla', { onClick: e => e.stopPropagation() }, driveLink(d.driveUrl)),
    ]),
    h('div', { style: { fontSize: '9.5px', color: 'var(--text-3)', marginTop: '5px' } }, `${d.ver} · ${updatedText(d.updated)}`),
  ]);
}
function brandTone(b) { const m = { MATAROAD: 'navy', HARIMAU: 'accent', SOLARIS: 'amber', ARJUNA: 'green' }; return m[b] || 'gray'; }

async function uploadDesign() {
  if (blockWrite('upload desain label')) return;
  const files = await pickFiles({ accept: 'image/*,.pdf', multiple: false });
  if (!files || !files[0]) return;
  const file = files[0];
  toast(t('loading'));
  const up = await uploadToDrive(file, 'LabelDesigns/', file.name);
  const url = up.placeholder ? '' : up.url;
  const localUrl = URL.createObjectURL(file);
  // Rendered from the file still in hand (not fetched back from Drive) — a
  // persisted base64 JPEG so the thumbnail survives reload/other sessions,
  // unlike designUrl below. Non-fatal: a render failure just leaves the
  // library card on its color-swatch fallback, same as no thumb at all.
  const thumb = await renderThumb(file).catch(() => '');
  // Default value 'LBL-NEW-XX' is the seed for a stored ERP code — prompt text
  // only is translated.
  const erp = prompt(tr({
    id: 'ERP code untuk desain ini?',
    en: 'ERP code for this design?',
    zh: '此设计的 ERP 编码？',
  }), 'LBL-NEW-XX') || 'LBL-NEW-' + Date.now().toString(36).slice(-3).toUpperCase();
  const st = getState();
  // color/designUrl are local-only display fields — not persisted (see
  // designsApi.js header comment): color is a swatch fallback derivable from
  // brand, designUrl is a browser-session-only blob: URL. thumb IS persisted
  // (designsApi.js) — it's what Surat Jalan pulls in per item (see suratJalan.js).
  const design = { id: uid('dsg'), erp, spec: '—', brand: 'BARU', market: '—', ver: 'v1', updated: 'hari ini', driveUrl: url, designUrl: localUrl, thumb, color: '#F26722', status: 'draft' };
  try {
    const saved = await insertDesign(design);
    design.id = saved.id;
  } catch (e) {
    console.error('Supabase design insert failed', e);
    toast({
      id: 'Desain tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Design saved locally, but sync to the server failed: ' + (e.message || e),
      zh: '设计已保存在本地，但同步到服务器失败：' + (e.message || e),
    });
  }
  st.designs.unshift(design);
  logAudit({ entity: 'design', target: erp, action: 'upload', detail: file.name });
  toast(up.placeholder ? {
    id: `Desain ${erp} tersimpan (${t('drive_unconfigured')})`,
    en: `Design ${erp} saved (${t('drive_unconfigured')})`,
    zh: `设计 ${erp} 已保存（${t('drive_unconfigured')}）`,
  } : {
    id: `Desain ${erp} diupload ke Drive`,
    en: `Design ${erp} uploaded to Drive`,
    zh: `设计 ${erp} 已上传至 Drive`,
  });
  setState({});
}

// 'hari ini' is written onto the design row at creation and lives in the
// database, so it is a value, not a label — translated on the way out only.
function updatedText(v) {
  const s = String(v == null ? '' : v);
  if (/^hari ini$/i.test(s)) return tr({ id: s, en: 'today', zh: '今天' });
  return s;
}
