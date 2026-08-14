import { h } from '../core/dom.js';
import { getState, setState, setUI, toast, uid, logAudit } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, badge, btn, icon, dropzone, modal, checkRow, driveLink, statusTone, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, barisTakCocok, hitunganSaring } from '../ui/components.js';
import { money, num, ccyDecimals, fmtDate, fmtDateTime, daysUntil, similarity, normalize, sumByCurrency, moneyMulti, CURRENCIES } from '../core/format.js';
import { parsePaymentProof } from '../parsers/bankProof.js';
import { parseNumber } from '../parsers/numbers.js';
import { uploadToDrive } from '../core/drive.js';
import { linkOutbox } from '../core/driveOutbox.js';
import { can, isReadOnly } from '../auth/roles.js';
import { updatePrfStage, selisihPrf } from '../core/prfsApi.js';
import { blockWrite } from '../core/guard.js';
import { confirmPrfPaid } from '../core/paymentsApi.js';
import { isConfigured } from '../core/supabase.js';

// DISPLAY ONLY. PRF stage values are stored in Postgres and compared with ===
// throughout this file (and in prfsApi/paymentsApi); this lookup is used at the
// point of rendering and nowhere else. Anything unmapped falls through as-is.
const STAGE_TEXT = {
  'Diproses Wilbert': 'st_diproses_wilbert',
  'Diterima Finance': 'st_diterima_finance',
  'Paid': 'st_paid',
};
function stageLabel(s) { return STAGE_TEXT[s] ? t(STAGE_TEXT[s]) : s; }

// Kolom Kelengkapan menulis hitungan centangnya juga ("Diterima ✓ 4/4"), tapi
// yang membedakan barisnya cuma dua keadaan ini. Kalau hitungannya ikut jadi
// opsi, dropdownnya berisi lima baris yang menanyakan hal yang sama — jadi yang
// disaring keadaannya, bukan angkanya.
const kelengkapanTeks = p => (p.stage === 'Diterima Finance' || p.stage === 'Paid')
  ? tr({ id: 'Diterima', en: 'Received', zh: '已接收' })
  : tr({ id: 'Menunggu checklist', en: 'Awaiting checklist', zh: '等待单据核对' });

// Kotak-kotak jendela saring "PRF Masuk". Isinya mengikuti kolom yang benar-benar
// ada di tabelnya — menyaring lewat kolom yang tidak kelihatan membuat baris
// menghilang tanpa ada yang bisa menunjuk sebabnya.
//
// Opsi "Dari" diambil dari PRF yang BENAR-BENAR ADA, bukan dari daftar pengguna
// portal: yang pernah mengirim PRF ke Finance cuma segelintir dari daftar itu,
// dan setiap nama sisanya adalah pilihan yang pasti berakhir nol baris.
const MEDAN_PRF_MASUK = (semua) => [
  { kunci: 'no', label: tr({ id: 'PRF No', en: 'PRF No', zh: '付款申请单号' }), tipe: 'teks', mono: true, ambil: r => r.no },
  { kunci: 'by', label: tr({ id: 'Dari', en: 'From', zh: '来自' }), tipe: 'pilih', opsi: [...new Set((semua || []).map(p => p.by).filter(Boolean))].sort(), ambil: r => r.by },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
  { kunci: 'ccy', label: tr({ id: 'Ccy', en: 'Ccy', zh: '币种' }), tipe: 'pilih', opsi: CURRENCIES, ambil: r => r.currency },
  // Opsi memakai teks yang TERBACA di lencananya, bukan nama stage internalnya:
  // yang memilih di sini sedang menunjuk kolom yang dia lihat.
  {
    kunci: 'lengkap', label: tr({ id: 'Kelengkapan', en: 'Completeness', zh: '齐全度' }), tipe: 'pilih',
    opsi: [kelengkapanTeks({ stage: 'Diterima Finance' }), kelengkapanTeks({ stage: 'Diproses Wilbert' })],
    ambil: kelengkapanTeks,
  },
];

export function financeScreen() {
  const st = getState(); const ui = st.ui;
  const canReceive = can(st.user.role, 'financeReceive');
  const canPay = can(st.user.role, 'markPaid');

  // Overdue: invoices received-not-paid past due. Totaled PER CURRENCY — never merged.
  const overdue = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const overdueTotals = sumByCurrency(overdue);
  const banner = overdue.length ? h('div.cfg-banner', { style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', justifyContent: 'flex-start' } }, [
    icon('warn', 17), h('div.grow', [h('b', `${overdue.length} ${t('fn_overdue_banner')}`), tr({
      id: ` — total ${moneyMulti(overdueTotals)}. Tertua: ${overdue[0].supplier} (${overdue[0].no}).`,
      en: ` — total ${moneyMulti(overdueTotals)}. Oldest: ${overdue[0].supplier} (${overdue[0].no}).`,
      zh: ` — 合计 ${moneyMulti(overdueTotals)}。最久：${overdue[0].supplier}（${overdue[0].no}）。`,
    })]),
  ]) : null;

  const semuaPrf = st.prfs;
  const medanPrf = MEDAN_PRF_MASUK(semuaPrf);
  const nilaiPrf = nilaiFilter('fin-prf');
  const prfTersaring = saring(semuaPrf, medanPrf, nilaiPrf);
  // Judul kolomnya dipegang di satu tempat supaya colspan baris "tidak ada yang
  // cocok" di bawah ikut benar sendiri kalau kolomnya bertambah.
  const kepalaPrf = [
    tr({ id: 'PRF No', en: 'PRF No', zh: '付款申请单号' }),
    tr({ id: 'Dari', en: 'From', zh: '来自' }),
    t('col_supplier'), t('col_amount'),
    tr({ id: 'Ccy', en: 'Ccy', zh: '币种' }),
    tr({ id: 'Kelengkapan', en: 'Completeness', zh: '齐全度' }),
    t('col_action'),
  ];
  const prfIn = card([
    h('div.card-head', [
      h('div.card-title', t('fn_prf_in')),
      badge(String(st.prfs.filter(p => p.stage === 'Diproses Wilbert' || p.stage === 'Diterima Finance').length), 'accent'),
      hitunganSaring(prfTersaring.length, semuaPrf.length, { id: 'PRF', en: `PRF${semuaPrf.length === 1 ? '' : 's'}`, zh: '张' }),
      // Daftar ini tidak berhalaman, jadi tanpa kunciHalaman — tidak ada nomor
      // halaman yang bisa tertinggal di luar hasil saringannya.
      tombolFilter({ id: 'fin-prf', medan: medanPrf, judul: t('fn_prf_in') }),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepalaPrf.map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', prfTersaring.length ? prfTersaring.map(p => {
        const done = Object.values(p.receiveChecklist || {}).filter(Boolean).length;
        const received = p.stage === 'Diterima Finance' || p.stage === 'Paid';
        return h('tr', [
          h('td.mono.cell-strong', p.no), h('td', p.by), h('td', p.supplier),
          // num(p.amount, p.currency === 'USD' ? 2 : 0) sampai v15.11a — rupiah
          // dicetak NOL desimal di layar yang memutuskan pembayaran, jadi
          // 935.383.680,50 muncul sebagai 935.383.681 dan yang membacanya tidak
          // punya cara tahu ada yang hilang. Pembulatan dicabut dari seluruh
          // jalur uang di v15.11; baris ini terlewat.
          (() => {
            const cek = selisihPrf(p, st.invoices || []);
            const angka = num(p.amount, ccyDecimals());
            if (!cek.adaMasalah) return h('td.mono.r', angka);
            return h('td.mono.r', { style: { color: 'var(--st-red-tx)' } }, [
              h('div', angka),
              h('div', { style: { fontSize: '10px', fontWeight: 700, whiteSpace: 'normal', lineHeight: 1.4 } },
                cek.hilang.length
                  ? tr({
                      id: `≠ invoice — ${cek.hilang.length} invoice tidak ada lagi`,
                      en: `≠ invoice — ${cek.hilang.length} invoice(s) no longer exist`,
                      zh: `≠ 发票 — ${cek.hilang.length} 张发票已不存在`,
                    })
                  : tr({
                      id: `≠ invoice: ${num(cek.sumInvoice, ccyDecimals())}`,
                      en: `≠ invoice: ${num(cek.sumInvoice, ccyDecimals())}`,
                      zh: `≠ 发票：${num(cek.sumInvoice, ccyDecimals())}`,
                    })),
            ]);
          })(),
          h('td', badge(p.currency, p.currency === 'USD' ? 'accent' : 'navy')),
          // Kata di lencananya diambil dari kelengkapanTeks() yang sama dengan
          // yang mengisi dropdown saringnya, supaya keduanya tidak bisa lagi
          // berbunyi beda setelah salah satunya diedit sendirian.
          h('td', received
            ? badge(`${kelengkapanTeks(p)} ✓ ${done}/4`, 'green')
            : badge(kelengkapanTeks(p), 'amber')),
          h('td', p.stage === 'Paid' ? badge(stageLabel('Paid'), 'green') : (received ? h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, fmtDateTime(p.createdAt)) : (canReceive ? btn(t('fn_receive'), { sm: true, variant: 'primary', onClick: () => setUI({ receiveModal: p.id }) }) : badge(tr({ id: 'Menunggu Finance', en: 'Awaiting Finance', zh: '等待财务' }), 'amber')))),
        ]);
      }) : barisTakCocok(kepalaPrf.length, { id: 'fin-prf', adaFilter: jumlahFilterAktif(nilaiPrf) > 0 })),
    ])),
  ]);

  // The proof dropzone had NO capability check, and it uploads to Drive before
  // any database write, so RLS could not have stopped a read-only account.
  //
  // Gated on isReadOnly, NOT on canPay. Gating it on canPay was wrong and broke
  // wilbert: he holds this screen but not markPaid, so the dropzone went inert
  // for him — and since ui.proofMatch / ui.proofManual are set ONLY inside
  // handleProof(), the entire right-hand panel became permanently stuck on its
  // empty placeholder. He could no longer even LOOK at a transfer proof.
  //
  // The dropzone is an entry point for READING a proof (parse + fuzzy-match
  // against open PRFs); the actual money action is "Confirm Paid", which has
  // always been behind canPay separately (see :148 and :222). Those are two
  // different gates and conflating them cost the supervisor his review step.
  const dz = dropzone({
    title: t('fn_drop_proof'), sub: t('fn_drop_proof_sub'), accept: '.pdf', iconName: 'upload', compact: true,
    onFiles: f => handleProof(f[0]),
    disabled: isReadOnly(st.user.role),
    disabledNote: tr({ id: 'Akun ini cuma bisa memantau', en: 'This account can only monitor', zh: '此账号仅可查看' }),
  });
  const matchPanel = ui.proofMatch ? matchCard(ui.proofMatch) : (ui.proofManual ? manualCard(ui.proofManual) : card([h('div.card-pad', { style: { minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('span', { style: { fontSize: '12px', color: 'var(--text-3)' } }, t('fn_no_proof')))]));

  return h('div.stack', [
    banner,
    prfIn,
    h('div.grid', { style: { gridTemplateColumns: '1fr 1.5fr' } }, [dz, matchPanel]),
    historyCard(st),
    ui.receiveModal ? receiveModal(ui.receiveModal) : null,
  ]);
}

function receiveModal(prfId) {
  const st = getState(); const prf = st.prfs.find(p => p.id === prfId); if (!prf) return null;
  const cl = prf.receiveChecklist;
  const count = Object.values(cl).filter(Boolean).length;
  // Butir (b) berbunyi "salinan invoice supplier". Mencentangnya berarti
  // menyatakan kertas di tangan cocok dengan dokumen ini. Kalau portal SUDAH
  // TAHU keduanya tidak cocok, membiarkan centang itu masuk berarti portal
  // menyaksikan pernyataan yang ia tahu keliru dan diam saja.
  //
  // Ditahan HANYA untuk selisih nominal sungguhan, bukan untuk invoice yang
  // barisnya sudah tidak ada. Yang kedua bisa saja peninggalan lama yang tidak
  // ada hubungannya dengan angka, dan menahan Finance atas dasar itu akan
  // menghentikan pekerjaan hari ini demi masalah kemarin — dilaporkan, tidak
  // memblokir.
  const cekTerima = selisihPrf(prf, st.invoices || []);
  const bedaNominal = !cekTerima.hilang.length && Math.abs(Math.round(cekTerima.beda * 100)) > 0;
  const ok = count === 4 && !bedaNominal;
  return modal({
    title: t('fn_receive_modal'), subtitle: `${prf.no} · ${prf.supplier} · ${money(prf.amount, prf.currency)}`, width: 480, onClose: () => setUI({ receiveModal: null }),
    body: [
      bedaNominal ? h('div.cfg-banner', {
        style: { background: 'var(--st-red-bg)', color: 'var(--st-red-tx)', borderColor: 'var(--st-red-tx)', justifyContent: 'flex-start', marginBottom: '10px' },
      }, [
        icon('warn', 17),
        h('div.grow', { style: { whiteSpace: 'normal', lineHeight: 1.45 } }, [
          h('b', tr({ id: 'PRF ini tidak sama dengan invoicenya.', en: 'This PRF does not match its invoices.', zh: '此付款申请单与其发票不一致。' })),
          tr({
            id: ` PRF minta ${money(prf.amount, prf.currency)}, invoicenya sekarang ${money(cekTerima.sumInvoice, prf.currency)} — selisih ${money(Math.abs(cekTerima.beda), prf.currency)}. JANGAN diterima: minta purchasing membatalkan PRF ini dan membuat ulang dengan nomor baru.`,
            en: ` The PRF asks for ${money(prf.amount, prf.currency)} while its invoices now total ${money(cekTerima.sumInvoice, prf.currency)} — a difference of ${money(Math.abs(cekTerima.beda), prf.currency)}. Do NOT receive it: ask purchasing to cancel this PRF and raise a new one with a new number.`,
            zh: ` 本单申请 ${money(prf.amount, prf.currency)}，而其发票现合计 ${money(cekTerima.sumInvoice, prf.currency)} — 相差 ${money(Math.abs(cekTerima.beda), prf.currency)}。请勿接收：请采购作废本单并以新编号重新开具。`,
          }),
        ]),
      ]) : null,
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, t('fn_checklist_sub')),
      checkRow(cl.a, t('fn_chk_prf'), tr({ id: 'Signed payment request form', en: 'Signed payment request form', zh: '已签字的付款申请表' }), () => { cl.a = !cl.a; setState({}); }),
      checkRow(cl.b, t('fn_chk_inv'), tr({ id: 'Salinan invoice supplier', en: 'Supplier invoice copy', zh: '供应商发票复印件' }), () => { cl.b = !cl.b; setState({}); }),
      checkRow(cl.c, t('fn_chk_faktur'), tr({ id: 'Tax invoice', en: 'Tax invoice', zh: '税务发票' }), () => { cl.c = !cl.c; setState({}); }),
      checkRow(cl.d, t('fn_chk_erp'), tr({ id: 'Bukti entry ERP INA', en: 'ERP INA entry proof', zh: 'ERP INA 录入凭证' }), () => { cl.d = !cl.d; setState({}); }),
    ],
    footer: [
      h('span', { style: { fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', marginRight: 'auto' } }, [t('fn_completeness') + ' ', h('span.mono', { style: { color: 'var(--accent-tx)' } }, `${count}/4`)]),
      btn(t('cancel'), { onClick: () => setUI({ receiveModal: null }) }),
      btn(t('fn_receive_btn'), { variant: 'primary', disabled: !ok, onClick: () => receivePrf(prf) }),
    ],
  });
}

// Single-table stage advance (Diproses Wilbert -> Diterima Finance). No
// atomicity concern — only touches prfs — so a plain update is correct here,
// unlike confirmPaid() below.
async function receivePrf(prf) {
  if (blockWrite('terima PRF di Finance')) return;
  // Diperiksa ULANG saat diklik: tombolnya digambar dari state yang bisa
  // berumur beberapa detik, dan dalam detik-detik itu invoicenya bisa berubah.
  const cekKlik = selisihPrf(prf, getState().invoices || []);
  if (!cekKlik.hilang.length && Math.abs(Math.round(cekKlik.beda * 100)) > 0) {
    toast({
      id: `${prf.no} tidak sama dengan invoicenya (${money(prf.amount, prf.currency)} vs ${money(cekKlik.sumInvoice, prf.currency)}) — tidak diterima. Minta purchasing buat ulang PRF-nya.`,
      en: `${prf.no} does not match its invoices (${money(prf.amount, prf.currency)} vs ${money(cekKlik.sumInvoice, prf.currency)}) — not received. Ask purchasing to raise it again.`,
      zh: `${prf.no} 与其发票不一致（${money(prf.amount, prf.currency)} 对 ${money(cekKlik.sumInvoice, prf.currency)}）— 未接收。请采购重新开具。`,
    });
    setUI({ receiveModal: null });
    return;
  }
  prf.stage = 'Diterima Finance'; prf.receivedAt = new Date().toISOString();
  try {
    await updatePrfStage(prf.id, { stage: prf.stage, receivedAt: prf.receivedAt, receiveChecklist: prf.receiveChecklist });
  } catch (e) {
    console.error('Supabase PRF receive sync failed', e);
    toast({
      id: 'Tersimpan lokal, tapi gagal sync ke server: ' + (e.message || e),
      en: 'Saved locally, but syncing to the server failed: ' + (e.message || e),
      zh: '已本地保存，但同步到服务器失败：' + (e.message || e),
    });
    setUI({ receiveModal: null });
    return;
  }
  logAudit({ entity: 'prf', target: prf.no, action: 'finance_receive', detail: '4/4' });
  setUI({ receiveModal: null });
  toast({
    id: `${prf.no} diterima Finance — kelengkapan 4/4`,
    en: `${prf.no} received by Finance — checklist 4/4`,
    zh: `${prf.no} 已由财务接收 — 单据齐全 4/4`,
  });
}

async function handleProof(file) {
  if (blockWrite('upload bukti transfer')) return;
  if (!file) return;
  toast(t('loading'));
  try {
    const res = await parsePaymentProof(file);
    const st = getState();
    // res.manual is also set when a template DID match but its amount was
    // unreadable — better to ask for one retyped number than to auto-match on
    // payee similarity alone (see bankProof.parsePaymentProof).
    if (res.manual) { setUI({ proofManual: { file, fields: res.fields, amountUnreadable: !!res.amountUnreadable }, proofMatch: null }); return; }
    // Auto-match to a received PRF by amount + fuzzy payee (+PO no when available).
    const candidates = st.prfs.filter(p => p.stage === 'Diterima Finance');
    let best = null, bestScore = 0;
    for (const p of candidates) {
      let score = 0;
      if (Math.abs(p.amount - res.fields.amount) < 1) score += 0.6;
      score += 0.3 * similarity(p.supplier, res.fields.beneficiary);
      if (res.fields.poNo && (p.invoices || []).some(x => x.includes(res.fields.poNo))) score += 0.2;
      // PO no triple-match via linked POs
      if (res.fields.poNo && st.pos.some(po => po.contract === res.fields.poNo && po.supplier === p.supplier)) score += 0.15;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    const up = await uploadToDrive(file, '', file.name, 'Bukti Bayar');
    setUI({ proofMatch: { file, fields: res.fields, template: res.templateLabel, prf: best, confidence: Math.min(0.99, bestScore), driveUrl: up.url }, proofManual: null });
    if (!best) toast({
      id: 'Bukti terparse tapi tidak ada PRF cocok — pilih manual',
      en: 'Proof parsed but no matching PRF — pick one manually',
      zh: '凭证已解析，但没有匹配的付款申请单 — 请手工选择',
    });
  } catch (e) { console.error(e); toast({ id: 'Parse bukti gagal: ' + e.message, en: 'Proof parsing failed: ' + e.message, zh: '凭证解析失败：' + e.message }); }
}

function matchCard(m) {
  const canPay = can(getState().user.role, 'markPaid');
  if (!m.prf) return manualCard({ file: m.file, fields: m.fields });
  // Word picked first so the interpolation below stays identical in all three
  // languages (the amount test itself is untouched).
  const amtWord = Math.abs(m.prf.amount - m.fields.amount) < 1
    ? tr({ id: 'sama persis', en: 'matches exactly', zh: '完全一致' })
    : tr({ id: 'beda', en: 'differs', zh: '不一致' });
  return card([
    h('div.card-pad', { style: { border: '1.5px solid var(--accent)', borderRadius: '12px' } }, [
      h('div.row.gap8', [badge(t('fn_automatch'), 'accent'), h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, `${m.template || 'proof'} · ${m.file.name}`), h('span.mla', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--st-green-tx)' } }, tr({
        id: `Confidence ${Math.round(m.confidence * 100)}%`,
        en: `Confidence ${Math.round(m.confidence * 100)}%`,
        zh: `匹配度 ${Math.round(m.confidence * 100)}%`,
      }))]),
      h('div', { style: { fontSize: '14px', fontWeight: 800, marginTop: '12px' } }, tr({
        id: `Matched: ${m.prf.no} — ${m.prf.supplier}`,
        en: `Matched: ${m.prf.no} — ${m.prf.supplier}`,
        zh: `已匹配：${m.prf.no} — ${m.prf.supplier}`,
      })),
      h('div.mono', { style: { fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', marginTop: '4px' } }, `${money(m.fields.amount, m.fields.currency)} · ${m.fields.date}${m.fields.poNo ? ' · ' + m.fields.poNo : ''}`),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '8px' } }, tr({
        id: `Nominal ${amtWord} · payee match ${Math.round(similarity(m.prf.supplier, m.fields.beneficiary) * 100)}%${m.fields.poNo ? ' · PO ' + m.fields.poNo : ''}`,
        en: `Amount ${amtWord} · payee match ${Math.round(similarity(m.prf.supplier, m.fields.beneficiary) * 100)}%${m.fields.poNo ? ' · PO ' + m.fields.poNo : ''}`,
        zh: `金额${amtWord} · 收款方匹配 ${Math.round(similarity(m.prf.supplier, m.fields.beneficiary) * 100)}%${m.fields.poNo ? ' · PO ' + m.fields.poNo : ''}`,
      })),
      h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '14px' } }, [
        // Clicking "pilih lain" is an explicit rejection of the auto-match, so
        // the picker opens with nothing selected rather than re-suggesting.
        btn(t('fn_pick_other'), { onClick: () => { m.fields.prfId = ''; setUI({ proofManual: { file: m.file, fields: m.fields }, proofMatch: null }); } }),
        btn(t('fn_confirm_paid'), { variant: 'primary', disabled: !canPay, onClick: () => confirmPaid(m) }),
      ]),
    ]),
  ]);
}

function manualCard(m) {
  const st0 = getState();
  const canPay = can(st0.user.role, 'markPaid');
  const f = m.fields;
  // Every PRF finance could legitimately be paying. The operator picks ONE;
  // nothing is inferred.
  //
  // This used to be:
  //   prfs.find(amount matches) || prfs.find(stage === 'Diterima Finance')
  // The `||` fallback dropped BOTH the amount test and any supplier test, so a
  // mistyped nominal silently selected whatever PRF happened to be first in
  // the array — and confirm_prf_paid() then marked that PRF (and all of its
  // linked invoices) Paid. The RPC couldn't catch it: its guard only checks
  // that the PRF is in 'Diterima Finance', which the wrong PRF also satisfies.
  const candidates = st0.prfs.filter(p => p.stage === 'Diterima Finance');
  const amountKnown = Number.isFinite(f.amount);
  // Pre-select only on an exact amount hit — a hint, never a decision.
  if (f.prfId === undefined) {
    const exact = amountKnown ? candidates.filter(p => Math.abs(p.amount - f.amount) < 1) : [];
    f.prfId = exact.length === 1 ? exact[0].id : '';
  }
  const chosen = candidates.find(p => p.id === f.prfId) || null;

  const prfSelect = h('select.input', {
    onChange: e => { f.prfId = e.target.value; setUI({}); },
  }, [
    h('option', { value: '', selected: !f.prfId }, candidates.length
      ? tr({ id: '— pilih PRF —', en: '— pick a PRF —', zh: '— 选择付款申请单 —' })
      : tr({ id: '— tidak ada PRF di stage Diterima Finance —', en: '— no PRF at the Received by Finance stage —', zh: '— 没有处于“财务已接收”阶段的付款申请单 —' })),
    ...candidates.map(p => h('option', { value: p.id, selected: p.id === f.prfId },
      `${p.no} · ${p.supplier} · ${money(p.amount, p.currency)}`)),
  ]);

  const mismatch = chosen && amountKnown && Math.abs(chosen.amount - f.amount) >= 1;

  return card([h('div.card-pad', [
    h('div.row.gap8', [
      badge(t('fn_manual_proof'), 'amber', { iconName: 'warn' }),
      h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, m.file.name),
      m.amountUnreadable ? badge(tr({ id: 'Nominal tidak terbaca', en: 'Amount unreadable', zh: '金额无法识别' }), 'red', { iconName: 'warn' }) : null,
    ]),
    m.amountUnreadable
      ? h('div', { style: { fontSize: '11px', color: 'var(--st-red-tx)', marginTop: '8px' } },
          tr({
            id: 'Template banknya dikenali, tapi nominalnya gagal diparse. Ketik ulang manual dari bukti aslinya.',
            en: 'The bank template was recognised, but the amount could not be parsed. Retype it manually from the original proof.',
            zh: '已识别银行模板，但金额解析失败。请对照原始凭证手工重新输入。',
          }))
      : null,
    h('div.grid.g3', { style: { marginTop: '12px' } }, [
      h('div', [h('div.field-label', t('fn_proof_amount')), h('input.input.mono', {
        value: amountKnown ? f.amount : '',
        placeholder: '2.862.720.000',
        // parseNumber understands both 1.234.567,89 and 1,234,567.89 and
        // yields NaN (not 0) for junk, so a typo can't read as "zero".
        // Commit on BLUR (not per keystroke — mount() has no diffing) so the
        // mismatch warning and the pre-select actually re-evaluate. Previously
        // nothing re-rendered when the amount changed, so a retyped amount left
        // a stale PRF selected and the "nominal beda" warning never appeared.
        onBlur: e => {
          const next = parseNumber(e.target.value);
          if (next === f.amount || (Number.isNaN(next) && Number.isNaN(f.amount))) return;
          f.amount = next;
          f.prfId = undefined;   // re-run the amount-based pre-select
          setUI({});
        },
      })]),
      h('div', [h('div.field-label', t('fn_proof_payee')), h('input.input', { value: f.beneficiary || '', onInput: e => (f.beneficiary = e.target.value) })]),
      h('div', [h('div.field-label', t('fn_proof_date')), h('input.input.mono', { value: f.date || '', onInput: e => (f.date = e.target.value) })]),
    ]),
    h('div', { style: { marginTop: '12px' } }, [
      h('div.field-label', tr({ id: 'PRF yang dibayar *', en: 'PRF being paid *', zh: '所付款的付款申请单 *' })),
      prfSelect,
      mismatch
        ? h('div', { style: { fontSize: '10.5px', color: 'var(--st-amber-tx)', marginTop: '6px', fontWeight: 700 } },
            tr({
              id: `Nominal bukti ${money(f.amount, chosen.currency)} ≠ nominal PRF ${money(chosen.amount, chosen.currency)} — pastikan ini memang benar.`,
              en: `Proof amount ${money(f.amount, chosen.currency)} ≠ PRF amount ${money(chosen.amount, chosen.currency)} — make sure this is really correct.`,
              zh: `凭证金额 ${money(f.amount, chosen.currency)} ≠ 付款申请单金额 ${money(chosen.amount, chosen.currency)} — 请确认无误。`,
            }))
        : null,
    ]),
    h('div.row.gap8', { style: { justifyContent: 'flex-end', marginTop: '14px' } }, [
      btn(t('fn_confirm_paid'), {
        variant: 'primary',
        // An unparseable amount used to leave the button enabled: parseNumber
        // returned NaN, amountKnown went false, the mismatch check silently
        // short-circuited, and confirming marked the PRF Paid for ITS OWN
        // amount against a proof nobody had read.
        disabled: !canPay || !chosen || !amountKnown,
        onClick: () => confirmPaidManual(m.file, f, chosen),
      }),
    ]),
  ])]);
}

// Manual path: archive the proof to Drive too. It used to pass driveUrl: ''
// unconditionally, so a manually-matched payment was recorded with no proof
// attached. uploadToDrive() never throws — it degrades to a placeholder — so
// this can't block the confirmation.
async function confirmPaidManual(file, fields, prf) {
  if (blockWrite('tandai PRF lunas')) return;
  if (!prf) { toast({ id: 'Pilih PRF yang dibayar dulu', en: 'Pick the PRF being paid first', zh: '请先选择要支付的付款申请单' }); return; }
  const up = await uploadToDrive(file, '', file.name, 'Bukti Bayar');
  confirmPaid({ file, fields, prf, driveUrl: up.url });
}

// This is the one operation in Batch 2 that touches 3 tables in one business
// action (payments insert + prfs.stage + every linked invoice.status). In
// production that's the confirm_prf_paid() Postgres RPC — one transaction,
// all-or-nothing by Postgres's own guarantee, not by convention here. Local
// state is only mutated AFTER the RPC confirms success; if it throws,
// nothing below runs and nothing local changes — matching what actually
// happened server-side (everything rolled back).
async function confirmPaid(m) {
  if (blockWrite('tandai PRF lunas')) return;
  const st = getState(); const prf = m.prf;
  const method = m.template || 'transfer';
  const driveUrl = m.driveUrl || '';

  let paymentId = uid('pay'); // demo mode fallback id
  if (isConfigured()) {
    try {
      paymentId = await confirmPrfPaid(prf.id, method, driveUrl);
      // The payment row is created by the RPC, so this is the first moment its
      // id exists. A transfer proof that missed Drive now finds its way back.
      await linkOutbox(m.outboxId, 'payments', paymentId, 'url');
    } catch (e) {
      console.error('confirm_prf_paid RPC failed — nothing changed (transaction rolled back)', e);
      toast({
        id: 'Gagal konfirmasi pembayaran: ' + (e.message || e),
        en: 'Failed to confirm payment: ' + (e.message || e),
        zh: '确认付款失败：' + (e.message || e),
      });
      return;
    }
  }

  prf.stage = 'Paid'; prf.paidAt = new Date().toISOString();
  st.payments.unshift({ id: paymentId, date: prf.paidAt, prf: prf.no, supplier: prf.supplier, amount: prf.amount, currency: prf.currency, method, driveUrl });
  (prf.invoices || []).forEach(no => { const inv = st.invoices.find(i => i.no === no); if (inv) inv.status = 'Paid'; });
  logAudit({ entity: 'prf', target: prf.no, action: 'mark_paid', detail: money(prf.amount, prf.currency) });
  setUI({ proofMatch: null, proofManual: null });
  toast({
    id: `Pembayaran dikonfirmasi — ${prf.no} ditandai PAID`,
    en: `Payment confirmed — ${prf.no} marked PAID`,
    zh: `付款已确认 — ${prf.no} 已标记为 PAID`,
  });
}

// Kotak-kotak jendela saring Payment History.
//
// Opsi Metode datang dari pembayaran yang sudah tercatat, bukan dari daftar
// baku: isinya label template bank yang kebaca dari buktinya (dan 'transfer'
// kalau tidak ada satu pun yang cocok), jadi daftar bakunya memang tidak ada di
// mana pun — satu-satunya sumber yang jujur adalah riwayatnya sendiri.
//
// Valuta ikut disaring walaupun tidak punya kolom sendiri: money() menulis
// kodenya di depan nominal, jadi yang dipilih di sini tetap terbaca di layar.
const MEDAN_BAYAR = (semua) => [
  { kunci: 'tgl', label: t('col_date'), tipe: 'tanggal', ambil: r => r.date },
  { kunci: 'prf', label: 'PRF', tipe: 'teks', mono: true, ambil: r => r.prf },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
  { kunci: 'ccy', label: tr({ id: 'Valuta', en: 'Currency', zh: '币种' }), tipe: 'pilih', opsi: CURRENCIES, ambil: r => r.currency },
  { kunci: 'metode', label: tr({ id: 'Metode', en: 'Method', zh: '方式' }), tipe: 'pilih', opsi: [...new Set((semua || []).map(p => p.method).filter(Boolean))].sort(), ambil: r => r.method },
];

function historyCard(st) {
  const semua = st.payments;
  const medan = MEDAN_BAYAR(semua);
  const nilai = nilaiFilter('fin-bayar');
  const tersaring = saring(semua, medan, nilai);
  const kepala = [
    t('col_date'), 'PRF', t('col_supplier'), t('col_amount'),
    tr({ id: 'Metode', en: 'Method', zh: '方式' }),
    tr({ id: 'Bukti', en: 'Proof', zh: '凭证' }),
  ];
  return card([
    h('div.card-head', [
      h('div.card-title', t('fn_history')),
      hitunganSaring(tersaring.length, semua.length, {
        id: 'pembayaran', en: `payment${semua.length === 1 ? '' : 's'}`, zh: '笔付款',
      }),
      // Tanpa kunciHalaman: riwayat ini tidak berhalaman.
      tombolFilter({ id: 'fin-bayar', medan, judul: t('fn_history') }),
      h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({ id: 'bukti tersimpan di Drive', en: 'proofs stored on Drive', zh: '凭证保存在 Drive' })),
    ]),
    h('div.tbl-wrap', h('table.tbl', [
      h('thead', h('tr', kepala.map((c, i) => h('th' + (i === 3 ? '.r' : ''), c)))),
      h('tbody', tersaring.length ? tersaring.map(p => h('tr', [
        h('td.mono', fmtDate(p.date)), h('td.mono.cell-strong', p.prf), h('td', p.supplier),
        h('td.mono.r', money(p.amount, p.currency)), h('td', p.method), h('td', driveLink(p.driveUrl)),
      ])) : barisTakCocok(kepala.length, { id: 'fin-bayar', adaFilter: jumlahFilterAktif(nilai) > 0 })),
    ])),
  ]);
}
