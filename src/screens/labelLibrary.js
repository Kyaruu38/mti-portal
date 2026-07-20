import { h, pickFiles } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t } from '../i18n/index.js';
import { badge, btn, icon, driveLink, selectEl, inputEl } from '../ui/components.js';
import { uploadToDrive } from '../core/drive.js';
import { insertDesign } from '../core/designsApi.js';

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
    inputEl({ placeholder: t('lib_search'), value: ui.libQ || '', onInput: v => setUI({ libQ: v }) }),
    selectEl(brands, { value: brand, onChange: v => setUI({ libBrand: v }) }),
    selectEl(markets, { value: market, onChange: v => setUI({ libMarket: v }) }),
    h('span', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, [h('span.mono', String(st.designs.length)), ` ${t('lib_designs')}`]),
    h('div.mla', btn(t('lib_upload'), { variant: 'primary', iconName: 'upload', onClick: () => uploadDesign() })),
  ]);

  const grid = h('div.lib-grid', designs.map(d => card(d)));
  return h('div.stack', [toolbar, grid]);
}

function card(d) {
  const hasImg = d.designUrl && !d.designUrl.startsWith('drive-');
  return h('div.lib-card', [
    h('div.lib-thumb', h('div.lib-label', { style: hasImg ? { background: 'none', border: 'none' } : {} }, hasImg
      ? h('img', { src: d.designUrl })
      : [h('span', { style: { width: '100%', height: '20px', background: d.color || '#1B3A6B' } }), h('span.mono', { style: { flex: 1, display: 'flex', alignItems: 'center', fontSize: '8.5px', color: 'var(--text-3)', writingMode: 'vertical-rl' } }, 'label artwork · 79×254 mm')])),
    h('div.mono', { style: { fontSize: '11.8px', fontWeight: 700, color: 'var(--text)', marginTop: '9px' } }, d.erp),
    h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, d.spec),
    h('div.row.gap8', { style: { marginTop: '7px' } }, [
      badge(d.brand, brandTone(d.brand)),
      h('span', { style: { fontSize: '10px', color: 'var(--text-3)' } }, d.market),
      h('div.mla', driveLink(d.driveUrl)),
    ]),
    h('div', { style: { fontSize: '9.5px', color: 'var(--text-3)', marginTop: '5px' } }, `${d.ver} · ${d.updated}`),
  ]);
}
function brandTone(b) { const m = { MATAROAD: 'navy', HARIMAU: 'accent', SOLARIS: 'amber', ARJUNA: 'green' }; return m[b] || 'gray'; }

async function uploadDesign() {
  const files = await pickFiles({ accept: 'image/*,.pdf', multiple: false });
  if (!files || !files[0]) return;
  const file = files[0];
  toast(t('loading'));
  const up = await uploadToDrive(file, 'LabelDesigns/', file.name);
  const url = up.placeholder ? '' : up.url;
  const localUrl = URL.createObjectURL(file);
  const erp = prompt('ERP code untuk desain ini?', 'LBL-NEW-XX') || 'LBL-NEW-' + Date.now().toString(36).slice(-3).toUpperCase();
  const st = getState();
  // color/designUrl are local-only display fields — not persisted (see
  // designsApi.js header comment): color is a swatch fallback derivable from
  // brand, designUrl is a browser-session-only blob: URL.
  const design = { id: uid('dsg'), erp, spec: '—', brand: 'BARU', market: '—', ver: 'v1', updated: 'hari ini', driveUrl: url, designUrl: localUrl, color: '#F26722', status: 'draft' };
  try {
    const saved = await insertDesign(design);
    design.id = saved.id;
  } catch (e) {
    console.error('Supabase design insert failed', e);
    toast('Desain tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e));
  }
  st.designs.unshift(design);
  logAudit({ entity: 'design', target: erp, action: 'upload', detail: file.name });
  toast(up.placeholder ? `Desain ${erp} tersimpan (${t('drive_unconfigured')})` : `Desain ${erp} diupload ke Drive`);
  setState({});
}
