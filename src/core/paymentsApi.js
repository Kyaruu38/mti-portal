// Supabase persistence for Payments. No direct insert/update/delete here —
// the ONLY way a payment row gets created in this app is via confirmPaid(),
// which must touch payments + prfs.stage + invoices.status together. That's
// exactly what confirm_prf_paid() (Postgres RPC, security definer) does in
// one transaction — see supabase_migration_finance_wiring.sql for why this
// can't safely be 3 separate client-side calls.
import { getClient, isConfigured } from './supabase.js';

function fromRow(row) {
  return { id: row.id, date: row.date, prf: row.prf, supplier: row.supplier, amount: row.amount, currency: row.currency, method: row.method, driveUrl: row.drive_url };
}

export async function fetchPayments() {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.from('payments').select('*').order('date', { ascending: false });
  if (error) { console.error('fetchPayments failed:', error); return null; }
  return data.map(fromRow);
}

// Returns the new payment's id (uuid) on success. Throws on any failure —
// including "PRF not in Diterima Finance" and "not authorized" — the RPC
// raises a real Postgres exception in both cases, nothing to paper over here.
export async function confirmPrfPaid(prfId, method, driveUrl) {
  if (!isConfigured()) return null;
  const c = await getClient();
  if (!c) throw new Error('Supabase client unavailable');
  const { data, error } = await c.rpc('confirm_prf_paid', { p_prf_id: prfId, p_method: method || 'transfer', p_drive_url: driveUrl || '' });
  if (error) throw error;
  return data;
}
