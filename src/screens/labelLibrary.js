import { h, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { badge, btn, icon, driveLink, selectEl, inputEl, searchInput } from '../ui/components.js';
import { uploadToDrive } from '../core/drive.js';
import { insertDesign } from '../core/designsApi.js';
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
  return h('div.stack', [toolbar, grid]);
}

function card(d) {
  const hasImg = d.designUrl && !d.designUrl.startsWith('drive-');
  return h('div.lib-card', [
    h('div.lib-thumb', h('div.lib-label', { style: hasImg ? { background: 'none', border: 'none' } : {} }, hasImg
      ? h('img', { src: d.designUrl })
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
      h('div.mla', driveLink(d.driveUrl)),
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
