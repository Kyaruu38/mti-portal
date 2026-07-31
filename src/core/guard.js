// Read-only account backstop.
//
// WHY THIS EXISTS
// ---------------
// Every write in this app is supposed to be gated twice: the button is hidden by
// a capability (auth/roles.js CAPS) and the write is refused by RLS. Adding the
// cenjc observer account showed that the first layer had a hole and the second
// has a blind spot:
//
//   * The hole. Until cenjc, every role that could SEE a screen could also write
//     on it, so most write buttons were gated by ACCESS alone. suratJalan.js,
//     ppkek.js and labelLibrary.js contained no capability check at all. Real
//     capabilities now exist for those (sjWrite / ppkekWrite / designWrite), but
//     per-button gating is exactly the kind of thing a future screen forgets.
//
//   * The blind spot. RLS cannot see a Google Drive upload. Three flows upload
//     the file BEFORE the database write — finance.js's payment proof,
//     labelLibrary.js's design, suratJalan.js's archive — so a read-only account
//     whose DB write is correctly refused could still push files into the
//     company Drive. Postgres has no say in that.
//
// So this is a third layer, at the one place every write must pass through. It
// is a BACKSTOP, not the primary control: a button that reaches it is a bug, and
// the console line says so. The user still gets a plain explanation instead of a
// stack trace, per the standing rule that a side feature must degrade rather
// than hard-fail.
//
// This is CLIENT-SIDE and therefore not a security boundary — anyone with a
// console can call past it. RLS remains the real boundary for everything that
// touches Postgres; see supabase_migration_cenjc.sql, which grants cenjc SELECT
// and nothing else, and adds them to neither is_purchasing() nor
// is_label_staff().

// DELIBERATELY NOT GUARDED — do not "fix" these:
//
//   core/supabase.js updatePassword / screens/changePassword.js
//       Every account is created with must_change_password = true and is forced
//       to set a new password on first login. Guarding this would lock a
//       read-only account out of the portal permanently, on its first visit.
//       Changing your own password is not a write against company data.
//
//   core/store.js logAudit -> insertAuditLog
//       If a write ever does slip past every gate, the audit row is the single
//       most valuable thing to have written. Blocking it would suppress exactly
//       the record needed to find the hole.
//
//   screens/labelRequest.js upsertItems
//       Local state only, and its sole caller (parseNow) is guarded — guarding
//       it too would fire a second toast for one refused action.
//
//   masterData.js brandsTab / dictTab / itemsTab / unitsTab
//       Render functions. They merely REFERENCE deleteXRow inside a
//       confirmDeleteBtn that is already behind `editable`, and every one of
//       those delete functions carries its own guard.

import { getState, toast } from './store.js';
import { isReadOnly } from '../auth/roles.js';

/**
 * True when the current account may not write. Safe before login (no user yet).
 */
export function readOnlySession() {
  const u = getState().user;
  return !!u && isReadOnly(u.role);
}

// The 43 action names the 46 call sites pass, translated in ONE place.
//
// Kept as a lookup rather than pushed out to the call sites because `what` is
// also the console warning and the thing you grep for when a read-only account
// reaches a button it should not have — an Indonesian phrase there is the key
// that ties the toast, the console line and the source together. Translating at
// the call sites would have meant editing 46 early-return guards and losing
// that. A phrase missing from this table falls back to itself, so adding a new
// blockWrite() can never break: worst case one word stays Indonesian.
const ACTIONS = {
  'approve PO':                        { en: 'approving the PO', zh: '批准采购单' },
  'reject PO':                         { en: 'rejecting the PO', zh: '拒绝采购单' },
  'request hapus PO':                  { en: 'requesting PO deletion', zh: '申请删除采购单' },
  'approve hapus PO':                  { en: 'approving the PO deletion', zh: '批准删除采购单' },
  'reject hapus PO':                   { en: 'rejecting the PO deletion', zh: '拒绝删除采购单' },
  'simpan perubahan PO':               { en: 'saving the PO changes', zh: '保存采购单修改' },
  'generate PO dari PDF':              { en: 'generating a PO from the PDF', zh: '从 PDF 生成采购单' },
  'generate PO label':                 { en: 'generating the label PO', zh: '生成标签采购单' },
  'cocokkan kode ERP':                 { en: 'matching the ERP code', zh: '匹配 ERP 编码' },
  'cocokkan kode ERP massal':          { en: 'bulk-matching ERP codes', zh: '批量匹配 ERP 编码' },
  'buat surat jalan':                  { en: 'creating the Surat Jalan', zh: '创建送货单' },
  'simpan surat jalan':                { en: 'saving the Surat Jalan', zh: '保存送货单' },
  'arsipkan ulang surat jalan':        { en: 're-archiving the Surat Jalan', zh: '重新归档送货单' },
  'simpan supplier':                   { en: 'saving the supplier', zh: '保存供应商' },
  'putuskan usulan rekening':          { en: 'deciding on the bank account proposal', zh: '处理银行账号变更申请' },
  'tambah brand map':                  { en: 'adding a brand mapping', zh: '新增品牌对照' },
  'ubah brand map':                    { en: 'editing the brand mapping', zh: '修改品牌对照' },
  'hapus brand map':                   { en: 'deleting the brand mapping', zh: '删除品牌对照' },
  'tambah kamus':                      { en: 'adding a dictionary entry', zh: '新增词典条目' },
  'ubah kamus':                        { en: 'editing the dictionary entry', zh: '修改词典条目' },
  'hapus kamus':                       { en: 'deleting the dictionary entry', zh: '删除词典条目' },
  'simpan item master':                { en: 'saving the master item', zh: '保存物料主数据' },
  'hapus item master':                 { en: 'deleting the master item', zh: '删除物料主数据' },
  'tambah unit':                       { en: 'adding a unit', zh: '新增单位' },
  'ubah unit':                         { en: 'editing the unit', zh: '修改单位' },
  'hapus unit':                        { en: 'deleting the unit', zh: '删除单位' },
  'upload file label':                 { en: 'uploading the label file', zh: '上传标签文件' },
  'parse label Excel':                 { en: 'parsing the label Excel', zh: '解析标签 Excel' },
  'upload desain label':               { en: 'uploading the label design', zh: '上传标签设计' },
  'upload file stok label':            { en: 'uploading the label stock file', zh: '上传标签库存文件' },
  'simpan upload stok label':          { en: 'saving the label stock upload', zh: '保存标签库存上传' },
  'upload faktur pajak':               { en: 'uploading the tax invoice', zh: '上传税务发票' },
  'simpan invoice':                    { en: 'saving the invoice', zh: '保存发票' },
  'serahkan invoice ke Wilbert':       { en: 'handing the invoice to the supervisor', zh: '将发票移交主管' },
  'hapus invoice':                     { en: 'deleting the invoice', zh: '删除发票' },
  'hapus PRF':                         { en: 'deleting the PRF', zh: '删除付款申请单' },
  'kembalikan invoice ke tahap 1':     { en: 'moving the invoice back to stage 1', zh: '将发票退回第 1 阶段' },
  'tandai PRF diterima':               { en: 'marking PRFs as received', zh: '标记付款申请单已收到' },
  'kirim request label':               { en: 'sending the label request', zh: '发送标签申请' },
  'kirim PRF':                         { en: 'submitting the PRF', zh: '提交付款申请单' },
  'terima PRF di Finance':             { en: 'receiving the PRF in Finance', zh: '财务接收付款申请单' },
  'tandai PRF lunas':                  { en: 'marking the PRF paid', zh: '标记付款申请单已付' },
  'upload bukti transfer':             { en: 'uploading the transfer proof', zh: '上传转账凭证' },
  'import arsip PPKEK':                { en: 'importing the PPKEK archive', zh: '导入报关压缩包' },
  'tambah baris register PPKEK':       { en: 'adding a PPKEK register row', zh: '新增报关登记行' },
  'ubah register PPKEK':               { en: 'editing the PPKEK register', zh: '修改报关登记册' },
  'import update register PPKEK':      { en: 'importing PPKEK register updates', zh: '导入报关登记册更新' },
  'terapkan perubahan register PPKEK': { en: 'applying the PPKEK register changes', zh: '应用报关登记册修改' },
};

/**
 * Refuse an action for a read-only account.
 *
 * Returns true when the action was BLOCKED, so call sites read as an early exit:
 *
 *     if (blockWrite('buat surat jalan')) return;
 *
 * Deliberately does not throw: several call sites are event handlers with no
 * catch, and an exception there would take the screen down with it.
 *
 * @param {string} what  Indonesian action name; also the ACTIONS lookup key
 * @returns {boolean}    true = blocked, caller must stop
 */
export function blockWrite(what) {
  if (!readOnlySession()) return false;
  const role = (getState().user || {}).role;
  const a = ACTIONS[what] || {};
  // A reachable button is the bug worth finding, so name it loudly for whoever
  // is looking at the console — the toast alone would be invisible in a report.
  // Always the Indonesian key here, whatever language the screen is in: this
  // line is for grepping the source, not for reading.
  console.warn(`[guard] write blocked for read-only role "${role}": ${what}. A button for this should not have been reachable — gate it with a capability in auth/roles.js.`);
  toast({
    id: `Akun ${role} cuma bisa memantau — ${what} tidak dijalankan.`,
    en: `The ${role} account is view-only — ${a.en || what} was not performed.`,
    zh: `${role} 账号仅可查看 — 未执行${a.zh || what}。`,
  });
  return true;
}
