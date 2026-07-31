// Display text for STORED status values.
//
// Every status in this app is a string in Postgres, compared with === in a
// dozen places. So the value cannot be translated — only what is painted over
// it can. This is that layer, and the rule it enforces is one-directional:
// statusText() takes a stored value and returns something to show. Nothing here
// ever produces a value to store.
//
// It lives in core/ rather than in a screen because the same status shows up in
// PPKEK, Payment, Finance and Reports, and three copies of the same table is
// three chances for them to disagree about what "Diterima Finance" is called in
// English.
//
// An unknown status falls through to itself. A new stage added to the database
// then shows up untranslated — visible and fixable — rather than blank.

import { tr } from '../i18n/index.js';

const TEXT = {
  // PO / approval
  'Menunggu Approval':   { en: 'Awaiting Approval',   zh: '待审批' },
  'Approved':            { en: 'Approved',            zh: '已批准' },
  'Rejected':            { en: 'Rejected',            zh: '已拒绝' },
  // PRF / payment stages
  'Terbentuk':           { en: 'Created',             zh: '已创建' },
  // Stored as 'Diproses Wilbert' since day one; SHOWN as Supervisor. The `id`
  // override exists for exactly this: a stage named after a person outlives the
  // person holding the job, and renaming the stored value would mean rewriting
  // every invoice row, every PRF row and every audit line that mentions it —
  // history included. So the database keeps its word and the screen uses ours.
  'Diproses Wilbert':    { id: 'Diproses Supervisor', en: 'With Supervisor', zh: '主管处理中' },
  'Diterima Purchasing': { en: 'Received by Purchasing', zh: '采购已接收' },
  'Diterima Finance':    { en: 'Received by Finance', zh: '财务已接收' },
  'Paid':                { en: 'Paid',                zh: '已付款' },
  // PPKEK
  'Open':                { en: 'Open',                zh: '未结' },
  'Costed':              { en: 'Costed',              zh: '已核算' },
  'Closed':              { en: 'Closed',              zh: '已结案' },
  // label stock / designs
  'draft':               { en: 'draft',               zh: '草稿' },
  'active':              { en: 'active',              zh: '生效' },
  'BUY NOW':             { en: 'BUY NOW',             zh: '需采购' },
  'DO NOT BUY':          { en: 'DO NOT BUY',          zh: '暂不采购' },
  // supplier bank-account review
  'menunggu review':     { en: 'awaiting review',     zh: '待审核' },
  'disetujui wilbert':   { id: 'disetujui supervisor', en: 'approved by the supervisor', zh: '主管已批准' },
};

export function statusText(value) {
  const v = String(value == null ? '' : value);
  const e = TEXT[v];
  // `e.id` overrides the Indonesian display. Without it the stored string shows
  // through untouched, which is right for almost every status here and wrong
  // for the one named after a person.
  return e ? tr({ id: e.id || v, en: e.en, zh: e.zh }) : v;
}

// Payment terms are master data on the supplier row ('30 hari', 'Bayar di
// muka'), so the same one-directional rule applies: shown translated, stored
// exactly as chosen.
export function termsText(value) {
  const v = String(value == null ? '' : value);
  const m = v.match(/^(\d+)\s*hari$/i);
  if (m) return tr({ id: v, en: `${m[1]} days`, zh: `${m[1]} 天` });
  if (/^bayar di muka$/i.test(v)) return tr({ id: v, en: 'Payment in advance', zh: '预付款' });
  return v;
}
