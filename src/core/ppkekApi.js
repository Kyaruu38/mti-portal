// Supabase persistence for the PPKEK register. Same shape as invoicesApi.js/
// posApi.js. DATA (register rows: parse results, SO/JO/costing, status,
// tracking) is fully live here. FILE storage is not — Drive isn't wired yet
// (useDrive=false in config.js), so `files` just holds whatever
// uploadToDrive() returned (today: `drive-pending://...` placeholders, see
// core/drive.js). That keeps the file layer swappable: once Drive is
// configured, uploadToDrive() starts returning real links and this column
// starts holding those instead — nothing here or in ppkek.js's data flow
// needs to change.
import { getClient, isConfigured, fetchAllPaged } from './supabase.js';

function fromRow(row) {
  const files = row.files || [];
  const realFile = files.find(f => f.url && !String(f.url).startsWith('drive-'));
  return {
    id: row.id, nopen: row.nopen || '', date: row.ppkek_date, eta: row.eta || '',
    contractNo: row.contract_no || '', supplier: row.supplier || '', address: row.address || '',
    invoiceNo: row.invoice_no || '', plNo: row.pl_no || '',
    usd: row.usd || 0, idr: row.idr || 0, kurs: row.kurs || 0,
    jalur: row.jalur || 'LDP', so: row.so || '', jo: row.jo || '', costing: row.costing || '',
    poErpIna: row.po_erp_ina || '', status: row.status || 'Open', receivedDate: row.received_date || '',
    driveFolder: row.drive_folder || '', files,
    driveUrl: (realFile || files[0] || {}).url || '',
  };
}

function toRow(r) {
  return {
    nopen: r.nopen || null, ppkek_date: r.date || null, eta: r.eta || null,
    contract_no: r.contractNo || null, supplier: r.supplier || null, address: r.address || null,
    invoice_no: r.invoiceNo || null, pl_no: r.plNo || null,
    usd: r.usd || 0, idr: r.idr || 0, kurs: r.kurs || 0,
    jalur: r.jalur === 'TLDDP' ? 'TLDDP' : 'LDP',
    so: r.so || '', jo: r.jo || '', costing: r.costing || '', po_erp_ina: r.poErpIna || '',
    status: r.status || 'Open', received_date: r.receivedDate || null,
    drive_folder: r.driveFolder || null, files: r.files || [],
  };
}

export async function fetchPpkek() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  // Paged: PostgREST silently caps an unbounded select at max-rows (1000).
  const { data, error } = await fetchAllPaged((a, b) => c.from('ppkek').select('*').order('created_at', { ascending: false }).range(a, b));
  if (error) { console.error('fetchPpkek failed:', error); return null; }
  return data.map(fromRow);
}

export async function insertPpkek(r) {
  if (!isConfigured()) return r;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.from('ppkek').insert(toRow(r)).select().single();
  if (error) throw error;
  return fromRow(data);
}

// Partial update (inline-edit cells, status changes, import-apply) — pass
// only the changed fields.
export async function updatePpkek(id, patch) {
  if (!isConfigured()) return;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const row = {};
  if ('so' in patch) row.so = patch.so;
  if ('jo' in patch) row.jo = patch.jo;
  if ('costing' in patch) row.costing = patch.costing;
  if ('poErpIna' in patch) row.po_erp_ina = patch.poErpIna;
  if ('status' in patch) row.status = patch.status;
  if ('receivedDate' in patch) row.received_date = patch.receivedDate;
  if ('files' in patch) row.files = patch.files;
  if ('driveFolder' in patch) row.drive_folder = patch.driveFolder;
  const { error } = await c.from('ppkek').update(row).eq('id', id);
  if (error) throw error;
}
