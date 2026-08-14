// Supabase persistence for the Label Inventory Tracker.
//
// Requires supabase_migration_label_stock.sql. Same demo-mode contract as every
// other module here: fetch* returns null (never []) when Supabase isn't
// configured or the read failed, so a caller can tell "no data" apart from
// "couldn't read" and leave local state alone.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  return {
    id: row.id,
    spec: row.spec_name, market: row.market_code || '',
    erp: row.erp || '', erpConfirmed: !!row.erp_confirmed,
    stock: Number(row.stock) || 0,
    production: Number(row.planned_production) || 0,
    sales: Number(row.planned_sales) || 0,
    buffer: Number(row.buffer_pct) || 0,
    requirement: Number(row.requirement) || 0,
    surplus: Number(row.surplus) || 0,
    status: row.reorder_status || '',
    suggestedQty: Number(row.suggested_qty) || 0,
    week: row.week_updated || '',
    calc: {
      requirement: row.calc_requirement == null ? null : Number(row.calc_requirement),
      surplus: row.calc_surplus == null ? null : Number(row.calc_surplus),
      status: row.calc_status || '',
      suggestedQty: row.calc_suggested == null ? null : Number(row.calc_suggested),
    },
    hasMismatch: !!row.has_mismatch,
    lastUploadId: row.last_upload_id || null,
    lastSeenAt: row.last_seen_at,
    missing: !!row.missing_from_last_upload,
  };
}

// Shape the RPC expects. Column names, not the camelCase used in the app.
function toRpcItem(it) {
  return {
    spec_name: it.spec,
    market_code: it.market || '',
    stock: it.stock, planned_production: it.production,
    planned_sales: it.sales, buffer_pct: it.buffer,
    requirement: it.requirement, surplus: it.surplus,
    reorder_status: it.status, suggested_qty: it.suggestedQty,
    week_updated: it.week == null ? '' : String(it.week),
    calc_requirement: it.calc.requirement, calc_surplus: it.calc.surplus,
    calc_status: it.calc.status, calc_suggested: it.calc.suggestedQty,
    has_mismatch: !!(it.mismatch && it.mismatch.length),
  };
}

export async function fetchLabelStock() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // 984 SKU today, i.e. already within one page of PostgREST's 1000-row cap —
  // paged anyway, because "just under the limit" is exactly how that bug bites.
  const { data, error } = await fetchAllPaged((a, b) =>
    c.from('label_stock').select('*').order('spec_name', { ascending: true }).range(a, b));
  if (error) { console.error('fetchLabelStock failed:', error); return null; }
  return data.map(fromRow);
}

export async function fetchLabelSettings() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('label_settings').select('*').maybeSingle();
  if (error) { console.error('fetchLabelSettings failed:', error); return null; }
  if (!data) return null;
  return {
    moq: Number(data.moq) || 500,
    leadNormal: Number(data.lead_days_normal) || 14,
    leadUrgent: Number(data.lead_days_urgent) || 7,
    leadSuper: Number(data.lead_days_super) || 3,
    overstockMultiple: Number(data.overstock_multiple) || 2,
  };
}

export async function fetchLabelUploads(limit = 20) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('label_stock_uploads')
    .select('*').order('at', { ascending: false }).limit(limit);
  if (error) { console.error('fetchLabelUploads failed:', error); return null; }
  return data.map(r => ({
    id: r.id, at: r.at, by: r.by, fileName: r.file_name, sheetName: r.sheet_name,
    weekOf: r.week_of, total: r.rows_total, imported: r.rows_imported,
    duplicate: r.rows_duplicate, mismatch: r.rows_mismatch,
    duplicates: r.duplicates || [], notes: r.notes || '',
  }));
}

// Total stock per upload day, for the dashboard chart.
//
// This is an aggregate, and PostgREST cannot GROUP BY — so it reads a view
// (supabase_label_trend_view.sql) rather than pulling 974 rows x every week
// into the browser to sum them there.
//
// Returns null when the view does not exist yet, exactly like every other
// "couldn't read" here: the chart then says "no data" instead of the screen
// breaking. A dashboard tile is never a reason to take a dashboard down.
export async function fetchLabelStockTrend(limit = 12) {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    if (!c) return null;
    const { data, error } = await c.from('label_stock_trend')
      .select('*').order('hari', { ascending: false }).limit(limit);
    if (error) { console.warn('fetchLabelStockTrend unavailable:', error.message || error); return null; }
    return (data || []).map(r => ({
      day: r.hari,
      sku: Number(r.sku) || 0,
      stock: Number(r.total_stok) || 0,
      requirement: Number(r.total_kebutuhan) || 0,
      buyNow: Number(r.buy_now) || 0,
    })).reverse();   // oldest first, the direction a chart is read
  } catch (e) {
    console.warn('fetchLabelStockTrend unavailable:', e);
    return null;
  }
}

// Stock movement for ONE SKU across uploads — the thing the workbook cannot do,
// because it overwrites itself every week.
export async function fetchLabelHistory(spec, market, limit = 52) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('label_stock_history')
    .select('at, stock, planned_production, requirement, surplus, reorder_status')
    .eq('spec_name', spec).eq('market_code', market || '')
    .order('at', { ascending: false }).limit(limit);
  if (error) { console.error('fetchLabelHistory failed:', error); return null; }
  return data.map(r => ({
    at: r.at, stock: Number(r.stock) || 0,
    production: Number(r.planned_production) || 0,
    requirement: Number(r.requirement) || 0,
    surplus: Number(r.surplus) || 0,
    status: r.reorder_status || '',
  }));
}

// ONE transaction for the whole upload — see apply_label_stock_upload() in the
// migration for why this is an RPC and not ~974 client-side upserts.
export async function applyLabelStockUpload(meta, items) {
  if (!isConfigured()) throw new Error('Supabase belum dikonfigurasi — upload butuh koneksi server');
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.rpc('apply_label_stock_upload', {
    p_upload: {
      file_name: meta.fileName || '',
      sheet_name: meta.sheetName || '',
      week_of: meta.weekOf || '',
      rows_total: meta.total || 0,
      rows_imported: meta.imported || 0,
      rows_duplicate: meta.duplicate || 0,
      rows_mismatch: meta.mismatch || 0,
      duplicates: meta.duplicates || [],
    },
    p_items: items.map(toRpcItem),
  });
  if (error) throw error;
  return data;   // upload id
}

// ===========================================================================
// GUDANG
// ===========================================================================
//
// label_stock berkunci (spec_name, market_code) dan tidak punya dimensi gudang.
// Sona sekarang menarik stok dari DUA gudang, dan berkasnya sudah diperiksa:
// 海边 661 spec, Borine 288 spec, TUJUH spec ada di kedua-duanya. Dengan kunci
// yang lama, mengunggah berkas kedua MENIMPA tujuh angka itu alih-alih
// menjumlahkannya — yang terparah kurang 20.000 lembar, dan di layar terlihat
// wajar. Keputusan "mesen apa ngga" diambil dari angka itu.
//
// Stok per gudang tinggal di tabelnya sendiri (label_stock_gudang) dan
// label_stock.stock jadi JUMLAH-nya. Rencana produksi, rencana penjualan,
// buffer, dan ERP tetap SATU baris per spec di label_stock — kalau ikut dipecah
// per gudang, rencana produksi satu spec akan tergandakan dua kali dan
// kebutuhannya ikut berlipat.

export async function fetchLabelGudang() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('label_gudang').select('*').order('urutan', { ascending: true });
  if (error) { console.error('fetchLabelGudang failed:', error); return null; }
  return data.map(r => ({ kode: r.kode, namaId: r.nama_id, namaZh: r.nama_zh, urutan: r.urutan, aktif: !!r.aktif }));
}

export async function fetchLabelStockGudang() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST diam-diam memotong select tak berbatas di max-rows (1000),
  // dan dua gudang saja sudah 949 baris hari ini.
  const { data, error } = await fetchAllPaged((x, y) =>
    c.from('label_stock_gudang').select('*').order('spec_name', { ascending: true }).range(x, y));
  if (error) { console.error('fetchLabelStockGudang failed:', error); return null; }
  return data.map(r => ({
    spec: r.spec_name, market: r.market_code || '', gudang: r.gudang,
    stock: Number(r.stock) || 0,
    lastUploadId: r.last_upload_id || null,
    lastSeenAt: r.last_seen_at || null,
    missing: !!r.missing_from_last_upload,
  }));
}

// SATU transaksi untuk seluruh unggahan satu gudang. RPC-nya cuma menulis STOK:
// rencana produksi, rencana penjualan, buffer, ERP, dan status tidak disentuh
// satu kolom pun.
//
// Itu bukan kerapian, itu syarat. Rencana produksi cuma datang SEKALI di awal
// bulan sementara stok gudang masuk TIAP MINGGU. Jalur unggah yang lama menulis
// planned_production dari berkasnya, dan berkas gudang tidak punya kolom itu —
// jadi ia mengirim 0, dan satu unggahan stok mingguan akan mengosongkan rencana
// sebulan untuk setiap spec di dalamnya, tanpa satu pun tulisan di layar.
export async function applyLabelStockGudang(gudang, meta, items) {
  if (!isConfigured()) throw new Error('Supabase belum dikonfigurasi — upload butuh koneksi server');
  if (!gudang) throw new Error('Gudang belum dipilih');
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.rpc('apply_label_stock_gudang', {
    p_gudang: gudang,
    p_upload: {
      file_name: meta.fileName || '',
      sheet_name: meta.sheetName || '',
      week_of: meta.weekOf || '',
      rows_total: meta.total || 0,
      rows_imported: meta.imported || 0,
      rows_duplicate: meta.duplicate || 0,
      rows_mismatch: meta.mismatch || 0,
      duplicates: meta.duplicates || [],
    },
    // Cuma spec, market, dan stok yang dikirim. Sengaja TIDAK mengirim
    // production/sales/buffer/requirement/status: berkas gudang tidak
    // memilikinya, parser mengisinya nol, dan nol yang terkirim adalah nol yang
    // suatu hari tertulis.
    p_items: items.map(it => ({
      spec_name: it.spec,
      market_code: it.market || '',
      stock: it.stock,
    })),
  });
  if (error) throw error;
  return data;   // upload id
}

// Confirm an ERP match for one SKU (the one-time matching step).
export async function setLabelStockErp(id, erp) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { error } = await c.from('label_stock')
    .update({ erp: erp || null, erp_confirmed: !!erp, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
