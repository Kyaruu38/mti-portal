// Printable document renderers, reproduced 1:1 from the controlled sample templates:
//   - PO           -> samples/CGDD2509220096 PT BSN TECHNOLOGIES INDONESIA.xlsx
//   - Surat Jalan  -> samples/WL-CY-ORNATE*surat_jalan*.pdf (checklist PER ITEM)
//   - PRF          -> samples/PRF 5012014692 PT SRI TANG*.xlsx
// All render on WHITE paper regardless of theme (see print.css .paper).
import { h } from '../core/dom.js';
import { num, fmtDate } from '../core/format.js';
import { ccyDecimals, ppnFor, poTermDays, isAdvanceTerm } from '../core/format.js';
import { COMPANY, IMPORT_APPLICANT } from '../config.js';
import { CAP_MTI, LOGO_MTI } from '../assets/images.js';
import { amountInWords } from '../parsers/amountWords.js';

// Buyer block text taken verbatim from the BSN sample (real MTI details).
const BUYER = {
  name: 'PT.MATAHARI TIRE INDONESIA',
  address: 'Jalan Pareanom Nomor 17, Desa/Kelurahan Wonorejo, Kec. Kaliwungu, Kab. Kendal, Provinsi Jawa Tengah',
  tel: '85172070316',
};

// ============================================================================
// PURCHASE ORDER — mirrors the BSN spreadsheet layout exactly.
// (Used by BOTH jalur-1 label POs and jalur-2 converter POs.)
// NOTE: the sample title cell reads "采购合同/Purchase Contract"; per the fix
// request the title is rendered as "订单 / Purchase Order".
// ============================================================================
export function poDocument(po) {
  const dp = ccyDecimals(po.currency);
  const approved = po.status === 'Approved';
  // Same helper the stored total goes through (core/format.js) — the printed
  // document and pos.ppn can no longer drift apart.
  const ppn11 = ppnFor(po.subtotal, po.ppnMode);
  const total = po.subtotal + ppn11;
  const poNo = po.contract || po.no;
  // null => the term isn't a day count (e.g. "Payment in Advance"). Render the
  // real clause instead of inventing "30 days".
  // THREE cases, not two:
  //   a day count      -> "N days after Invoice"
  //   explicit advance -> the prepayment clause
  //   anything else    -> print po.terms VERBATIM.
  // Collapsing (b) and (c) meant a legacy "T/T 45 days after B/L date" contract
  // printed as "Payment in Advance" — commercially the wrong direction, on a
  // sealed document.
  const topN = poTermDays(po.terms);
  const termLine = topN != null
    ? ['3.付款条件：收到发票后' + topN + '天。', '   Payment Terms: ' + topN + ' days after Invoice.']
    : isAdvanceTerm(po.terms)
      ? ['3.付款条件：预付款。', '   Payment Terms: Payment in Advance.']
      : ['3.付款条件：' + (po.terms || '—') + '。', '   Payment Terms: ' + (po.terms || '—') + '.'];

  // 7 numbered bilingual terms (verbatim from the sample), PO no embedded in #1.
  const terms = [
    ['1.送货单据：送货单，账单，发票原件，收据原件(单据需注明订单编号: ' + poNo + '）',
     '   Delivery documents：Delivery Note、bill、Original invoice、Original receipt（Must with the PO No.: ' + poNo + '）'],
    ['2.化学品送货需携带检测报告。',
     '   Chemical need to provide the test report for every shipment.'],
    termLine,
    ['4.质保期从收货日计起，质保期内如货物有质量问题可退换货物。',
     '   The warranty starts from the day when customer receive the merchandise. If there is any quality problem, the customer can change and return cargos within the warranty.'],
    ['5.如无法按时送货提前通知采购，因晚送货造成的损失，每天按合同额2%处以罚金，在订单款中扣除。',
     '   If the delivery cannot be made on time, the procurement department should be notified in advance. Any losses caused by late delivery will be fined 2% of the contract amount per day, which will be deducted from the order payment.'],
    ['6.送货时间和地点：周一到周六 9:00-17:00 MTI公司仓库。',
     '   Delivery time and place: 9:00-17:00 from Monday to Saturday, MTI company warehouse.'],
    ['7.该合同遵循双方签订并盖章的供方产品质量保证协议书和其他协议的所有条款。',
     '   This contract should abide by the regulations of the supplier Quality Guarantee Agreement and the other Agreement which signed and sealed by both parties.'],
  ];

  const bd = '1px solid #111827';
  // overflowWrap + wordBreak: jaring pengaman. Kalau suatu hari ada mata uang
  // atau deskripsi yang lebih panjang dari yang diperkirakan, dia MEMBUNGKUS
  // dan barisnya jadi lebih tinggi — kelihatan, dan bisa diperbaiki. Tanpa ini
  // dia luber ke luar area cetak dan hilang diam-diam, yang persis kejadian
  // kemarin. Salah yang kelihatan selalu lebih baik daripada salah yang rapi.
  const cell = (extra) => ({
    border: bd, padding: '5px 8px', fontSize: '10px', color: '#111827',
    verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word',
    ...extra,
  });
  const gray = { background: '#F3F4F6', fontWeight: 700 };

  // LEBAR KERTAS DIUKUR DARI KERTASNYA, BUKAN DIKIRA-KIRA
  // -------------------------------------------------------------------------
  // Sebelumnya 760px. A4 itu 210mm; dengan @page margin 10mm di dua sisi yang
  // benar-benar bisa dicetak tinggal 190mm — sekitar 718px. Jadi 42px paling
  // kanan setiap halaman jatuh di luar area cetak dan dipotong Chrome tanpa
  // suara. Yang hilang justru kolom paling kanan: Amount. "3,430,723,399"
  // tercetak "3,430,723,39" — angka yang MASIH TERBACA sebagai angka, cuma
  // salah satu digit lebih kecil. Dokumen bersegel yang dikirim ke supplier.
  //
  // Dinyatakan dalam mm supaya terikat ke ukuran kertasnya, bukan ke tebakan
  // piksel yang ikut berubah kalau margin @page disetel ulang.
  return h('div.paper', { style: { width: '190mm', maxWidth: '100%', padding: '30px 34px', color: '#111827', boxSizing: 'border-box' } }, [
    // Letterhead
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '4px' } }, [
      h('img', { src: LOGO_MTI, style: { height: '30px' } }),
      h('div', { style: { fontSize: '15px', fontWeight: 800, letterSpacing: '.02em' } }, COMPANY.name),
    ]),
    // Title
    h('div', { style: { textAlign: 'center', fontSize: '15px', fontWeight: 800, letterSpacing: '.04em', margin: '4px 0 10px' } }, '订单 / Purchase Order'),

    // Seller (left) + document meta (right)
    h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } }, h('tbody', [
      h('tr', [
        h('td', { style: cell({ width: '62%', whiteSpace: 'pre-line', lineHeight: 1.5 }) },
          `The seller/卖方: ${po.supplier}\nContact Name/联系人：${po.contact || '-'}\nAddress/地址 ${po.address || '-'}\nTel/电话： ${po.phone || '-'}\nThe Buyer/买方: ${BUYER.name}\nAdd/地址; ${BUYER.address}\nTel/电话: ${BUYER.tel}`),
        h('td', { style: cell({ whiteSpace: 'pre-line', lineHeight: 1.6 }) },
          `No/号码: ${po.no}\nContract No/合同号: ${poNo}\nDate/日期： ${isoDate(po.createdAt)}`),
      ]),
    ])),

    // Goods
    h('div', { style: { fontSize: '10.5px', fontWeight: 700, margin: '10px 0 4px' } }, '货物如下/Goods as follows:'),
    h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } }, [
      // Lebar kolom dihitung dari isi TERPANJANG yang mungkin, bukan dari
      // tampilan yang enak dilihat. Rupiah tanpa desimal itu 13 karakter
      // ("3,430,723,399"); di IBM Plex Mono 10px kira-kira 78px, ditambah
      // padding 16px jadi 94px. Dengan 13% dari 650px isi kertas cuma dapat
      // 84px — kurang 10px, dan tableLayout:fixed tidak mengizinkan selnya
      // melebar, jadi kelebihannya luber lalu terpotong.
      //
      // Amount 18% dan Price 15%; sisanya diambil dari Description yang memang
      // membungkus dengan sendirinya.
      h('colgroup', [15, 22, 11, 9, 8, 15, 20].map(w => h('col', { style: { width: w + '%' } }))),
      h('thead', h('tr', [
        th('ERP Code'), th('Description'), th('Dimension'), th('Quantity', 'right'), th('Unit'), th('Price', 'right'), th('Amount', 'right'),
      ])),
      h('tbody', [
        ...po.items.map(li => h('tr', [
          td(li.erp || '-', {}, true), td(li.d || li.desc || ''), td(li.dimension || li.spec || ''),
          td(num(li.qty), { textAlign: 'right' }, true), td(li.unit || po.unit || '张/PC', { textAlign: 'center' }),
          td(num(li.u, dp), { textAlign: 'right' }, true), td(num(li.a, dp), { textAlign: 'right' }, true),
        ])),
        totalRow('共计(不含税）/In total(exclude PPN)：', num(po.subtotal, dp)),
        totalRow('增值税/PPN 11%：', po.ppnMode === 'paid' ? num(ppn11, dp) : '0'),
        totalRow('费用总计/Amount：', num(total, dp)),
      ]),
    ]),

    // Terms 1..7
    h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '-1px', tableLayout: 'fixed' } }, h('tbody', terms.map(pair =>
      h('tr', h('td', { style: cell({ whiteSpace: 'pre-line', lineHeight: 1.45, fontSize: '9px' }) }, pair[0] + '\n' + pair[1]))))),

    // Signature blocks: 买方 BUYER (MTI, gets the seal on approval) + 卖方 SELLER.
    // No person names ever — the seal image already bakes in the authorized signature.
    h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '-1px', tableLayout: 'fixed' } }, h('tbody', [
      h('tr', [
        h('td', { style: cell({ ...gray, width: '50%', textAlign: 'center' }) }, '买方 BUYER'),
        h('td', { style: cell({ ...gray, textAlign: 'center' }) }, '卖方 SELLER'),
      ]),
      h('tr', [
        h('td', { style: cell({ height: '78px', position: 'relative', textAlign: 'center' }) }, [
          h('div', { style: { fontSize: '9.5px', color: '#374151', marginTop: '52px' } }, BUYER.name),
          approved ? h('img', { src: CAP_MTI, style: { position: 'absolute', right: '14px', top: '2px', width: '78px', height: '78px', objectFit: 'contain', opacity: 0.9, mixBlendMode: 'multiply' } }) : null,
        ]),
        h('td', { style: cell({ height: '78px', textAlign: 'center' }) }, h('div', { style: { fontSize: '9.5px', color: '#374151', marginTop: '52px' } }, po.supplier || '')),
      ]),
    ])),

    // Footer
    h('div', { style: { fontSize: '8.5px', color: '#6B7280', marginTop: '8px', textAlign: 'right' } }, h('span.mono', po.no)),
  ]);

  // Judul kolom 9px, isinya tetap 10px. "Quantity" di 10px butuh ~45px
  // sementara kolomnya 42px, jadi dia pecah jadi "Quanti/ty" — judul kolom
  // yang terbelah di tengah kata pada dokumen resmi.
  function th(label, align) { return h('th', { style: cell({ ...gray, fontSize: '9px', textAlign: align === 'right' ? 'right' : 'left' }) }, label); }
  function td(v, extra, mono) { return h('td', { style: cell({ ...(extra || {}), fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit' }) }, v); }
  function totalRow(label, val) {
    return h('tr', [
      h('td', { colspan: 6, style: cell({ textAlign: 'right', fontWeight: 700 }) }, label),
      h('td', { style: cell({ textAlign: 'right', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }) }, val),
    ]);
  }
}

// topDaysOf() removed — it matched the first digit run ANYWHERE in po.terms,
// so a term with no leading day count picked up the embedded contract number
// and printed it as the payment term. Replaced by poTermDays() in
// core/format.js, which anchors to the start and returns null instead of
// silently defaulting to 30.
function isoDate(d) { const dt = new Date(d); return isNaN(dt) ? String(d) : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }

// ============================================================================
// SURAT JALAN VERIFIKASI — checklist is PER ITEM (matches the sample PDF).
// ============================================================================
const SJ_CHECKS = [
  ['Warna sesuai approved', '颜色符合批准样'],
  ['Posisi tulisan sesuai', '文字位置正确'],
  ['Ukuran sesuai', '尺寸符合'],
  ['Jumlah sesuai', '数量符合'],
  ['Kerekatan sesuai', '黏着力符合'],
];

function paperHeader() {
  return h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
    h('div', [
      h('img', { src: LOGO_MTI, style: { height: '34px' } }),
      h('div', { style: { fontSize: '10.5px', fontWeight: 800, color: '#111827', marginTop: '6px' } }, COMPANY.name),
    ]),
    h('div', { style: { textAlign: 'right', fontSize: '9.5px', color: '#4B5563', lineHeight: 1.6 } }, [
      ...COMPANY.addressLines.flatMap(l => [l, h('br')]),
      `T ${COMPANY.tel} · ${COMPANY.email}`,
    ]),
  ]);
}

export function suratJalanPaper(sj) {
  return h('div.paper', { style: { width: '790px' } }, [
    paperHeader(),
    h('div', { style: { height: '2.5px', background: '#1B3A6B', marginTop: '12px' } }),
    h('div', { style: { height: '2px', background: '#F26722', marginTop: '2px', width: '180px' } }),
    // Dokumennya sengaja DIBIARKAN seperti semula. Penanda "internal" hidup di
    // menu samping, bukan di kertasnya — yang perlu tahu ini dokumen internal
    // adalah orang yang MEMBUKA layarnya, bukan gudang yang sudah memegang
    // lembarannya. Judul dokumen sudah menyebut "VERIFIKASI LABEL", dan
    // menambah blok merah di atasnya cuma memakan ruang halaman yang sudah pas.
    h('div', { style: { textAlign: 'center', marginTop: '20px' } }, [
      h('div', { style: { fontSize: '14.5px', fontWeight: 800, letterSpacing: '.08em', color: '#111827' } }, 'DOKUMEN VERIFIKASI LABEL / PACKAGING（标签到货核对文件）'),
      h('div', { style: { fontSize: '10px', letterSpacing: '.16em', color: '#6B7280', marginTop: '2px' } }, 'LABEL & PACKAGING VERIFICATION DOCUMENT'),
      h('div.mono', { style: { fontSize: '10px', color: '#374151', marginTop: '6px' } }, `No. Dok: ${sj.docNo}`),
    ]),
    h('table', { style: { marginTop: '16px' } }, h('tbody', [
      h('tr', [ktd('No. Surat Jalan 送货单编号'), vtd(sj.no, true), ktd('Tanggal 日期'), vtd(fmtDate(sj.date), true)]),
      h('tr', [ktd('Supplier 供应商'), vtd(sj.supplier), ktd('No. PO 订单编号'), vtd(sj.poNo, true)]),
    ])),
    h('div', { style: { fontSize: '10px', fontWeight: 800, letterSpacing: '.1em', color: '#374151', margin: '18px 0 8px' } }, 'RINCIAN ITEM · ITEM DETAILS'),
    // Each item block ends with ITS OWN checklist + Catatan line (per sample).
    // .sj-item carries `break-inside: avoid` (print.css + wrapPrintable's inline
    // style) so a card is never sliced across a page break — the warehouse
    // checklist must always sit on the same page as the item it verifies.
    // The doc no. is repeated per card so pages 2+ stay identifiable.
    ...sj.items.map((it, idx) => h('div.sj-item', { style: { border: '1px solid #D1D5DB', borderRadius: '4px', padding: '12px', marginBottom: '10px' } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } }, [
        h('div', { style: { fontSize: '9px', fontWeight: 800, color: '#6B7280' } }, `ITEM ${idx + 1} · Approved Design Reference`),
        h('div.mono', { style: { fontSize: '8px', color: '#9CA3AF' } }, `${sj.docNo} · ${idx + 1}/${sj.items.length}`),
      ]),
      h('div', { style: { display: 'flex', gap: '14px' } }, [
        h('span', { style: { width: '110px', minHeight: '150px', borderRadius: '2px', background: it.designUrl && !it.designUrl.startsWith('drive-') ? '#fff' : 'repeating-linear-gradient(45deg,#EDEAE1 0 5px,#E2DED2 5px 10px)', border: '1px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' } },
          it.designUrl && !it.designUrl.startsWith('drive-') ? h('img', { src: it.designUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : h('span.mono', { style: { fontSize: '7px', color: '#6B7280', writingMode: 'vertical-rl' } }, 'label design')),
        h('div', { style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 18px', alignContent: 'start' } }, [
          kv('No. ERP ERP物料编号', it.erp, true),
          kv('Nama 物料名字', it.name),
          kv('Warna 颜色', it.warna || '—'),
          kv('Qty Order 到货数量', num(it.qty) + ' ' + (it.unit || '张'), true),
        ]),
      ]),
      // Per-item checklist
      h('div', { style: { fontSize: '9px', fontWeight: 800, letterSpacing: '.06em', color: '#374151', margin: '10px 0 5px' } }, 'CHECKLIST VERIFIKASI GUDANG · 仓库员核对'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px' } }, SJ_CHECKS.map(c =>
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', color: '#1F2937' } }, [
          h('span', { style: { width: '11px', height: '11px', border: '1.5px solid #6B7280', borderRadius: '2px', display: 'inline-block' } }),
          `${c[0]} ${c[1]}`,
        ]))),
      h('div', { style: { fontSize: '9px', color: '#374151', marginTop: '8px' } }, ['Catatan 注: ', h('span', { style: { display: 'inline-block', width: '80%', borderBottom: '1px solid #9CA3AF', height: '12px' } })]),
    ])),
    // Signature blocks ONCE at the end.
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '20px' } }, [
      sig('Dibuat oleh Purchasing 制单人采购部', sj.by || 'Purchasing'),
      sig('Diterima Gudang 接收人仓库部', '(………………  ………………)'),
    ]),
  ]);
}

// ============================================================================
// PRF — Payment Request Form (mirrors the SRI TANG spreadsheet template).
// ============================================================================
export function prfPaper(prf, supplier, lines) {
  const dp = ccyDecimals(prf.currency);
  const words = amountInWords(prf.amount, prf.currency);
  const bd = '1px solid #111827';
  const L = (extra) => ({ border: bd, padding: '6px 9px', fontSize: '9.5px', color: '#111827', background: '#F3F4F6', fontWeight: 700, whiteSpace: 'pre-line', verticalAlign: 'top', width: '18%', ...extra });
  const V = (extra) => ({ border: bd, padding: '6px 9px', fontSize: '10px', color: '#111827', verticalAlign: 'top', whiteSpace: 'pre-line', ...extra });
  const bank = supplier ? `${supplier.bank || ''}, ACC: ${supplier.acct || ''} a/n. ${supplier.name}` : (prf.bank || '-');
  const descLines = (lines || []).map(l => `${l.no} — ${l.desc}`).join('\n');
  // APPLICANT on an IMPORT PRF is the person who owns the import, not whoever
  // pressed the button. Kyaru raises these himself, but the import desk is
  // Zhang Pei Yan's, and the people on the other side of this document deal
  // with her — a name they do not recognise is a phone call, every time.
  //
  // This changes the PRINTED name only. `prf.by` is untouched in the database
  // and the audit trail still records the real user who created the PRF, so
  // "who actually did this" stays answerable. A document naming one person
  // while the log names another is fine precisely because the log is the one
  // nobody can edit — it would stop being fine the moment the log was made to
  // agree with the paper.
  const applicant = (supplier && supplier.overseas && IMPORT_APPLICANT)
    ? IMPORT_APPLICANT
    : (prf.by || '');

  return h('div.paper', { style: { width: '1040px', padding: '26px 32px', color: '#111827' } }, [
    h('table', { style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' } }, h('tbody', [
      // Title rows
      h('tr', h('td', { colspan: 4, style: { border: bd, padding: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 800 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' } }, [h('img', { src: LOGO_MTI, style: { height: '22px' } }), COMPANY.name]))),
      h('tr', h('td', { colspan: 4, style: { border: bd, padding: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 800, whiteSpace: 'pre-line' } }, 'Payment Request Form\n付 款 申 请 单')),
      // Requesting dept + GM approval
      h('tr', [
        h('td', { style: L() }, 'Requesting Department\n申请部门'),
        h('td', { style: V() }, '经营管理部 / Procurement'),
        h('td', { style: L({ width: '20%' }) }, 'Approval of General Manager\n总经理审批：'),
        h('td', { style: V() }, ''),
      ]),
      h('tr', [
        h('td', { style: L() }, 'Applicant\n申 请 人'),
        h('td', { style: V() }, applicant),
        h('td', { style: L({ width: '20%' }) }, 'Date of Completion\n填制日期：'),
        h('td', { style: V() }, fmtDate(prf.createdAt)),
      ]),
      // Payee details — ALL from master supplier
      row2('Full name of payee\n收款人全称', supplier ? supplier.name : prf.supplier),
      row2('Company address\n公司地址', supplier ? (supplier.address || supplier.city || '-') : '-'),
      row2('Contact information\n联系方式', supplier ? `${supplier.contact || ''} ${supplier.phone || ''}`.trim() : '-'),
      row2('Bank and account number\n开户银行及账号', bank),
      row2('Bank address\n银行地址', supplier ? (supplier.bankAddress || '-') : '-'),
      // A SWIFT recorded but never printed is a SWIFT nobody can act on — the
      // bank executing an overseas transfer needs it on the instruction. Only
      // rendered when the supplier has one, so a domestic PRF is unchanged.
      supplier && supplier.swift ? row2('SWIFT / BIC', supplier.swift) : null,
      // Amount in words + numeric
      h('tr', [
        h('td', { style: L() }, 'Amount of payment (in capitals)\n付款金额 （大写）'),
        h('td', { style: V() }, `${words.en}\n${words.zh}`),
        h('td', { style: L({ width: '20%' }) }, 'Amount of payment (lower case)\n付款金额 （小写）'),
        h('td', { style: V({ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }) }, `${prf.currency} ${num(prf.amount, dp)}`),
      ]),
      row2('Payment method\n付款方式', 'Online banking\n网银支付'),
      row2('Description of Payment\n付款说明', descLines || (prf.description || '-')),
    ])),
    // Signature row (three roles, per sample)
    h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '-1px', tableLayout: 'fixed' } }, h('tbody', [
      h('tr', [
        h('td', { style: { border: bd, padding: '6px 9px', fontSize: '9px', fontWeight: 700, whiteSpace: 'pre-line', height: '58px', verticalAlign: 'top' } }, 'Manager of the Using Department\n使用部门经理：'),
        h('td', { style: { border: bd, padding: '6px 9px', fontSize: '9px', fontWeight: 700, whiteSpace: 'pre-line', verticalAlign: 'top' } }, 'Branch Leader\n分管领导：'),
        h('td', { style: { border: bd, padding: '6px 9px', fontSize: '9px', fontWeight: 700, whiteSpace: 'pre-line', verticalAlign: 'top' } }, 'Finance Manager\n财务经理：'),
      ]),
    ])),
    // prf.no is empty on the PREVIEW: the register number is only allocated at
    // submit time (screens/payment.js submitPrf) so browsing the preview can't
    // burn numbers and leave gaps in the register. Say so rather than printing
    // a blank.
    h('div.mono', { style: { fontSize: '8px', color: '#9CA3AF', marginTop: '8px', textAlign: 'right' } }, `${prf.no || '(nomor terbit saat dikirim)'} · MTI Purchasing Portal · ${COMPANY.version}`),
  ]);

  function row2(label, val) { return h('tr', [h('td', { style: L() }, label), h('td', { colspan: 3, style: V() }, val)]); }
}

// ---- shared small paper cell helpers (Surat Jalan) ----
function ktd(label) { return h('td', { style: { padding: '6px 9px', fontSize: '9.5px', color: '#6B7280', background: '#F9FAFB', border: '1px solid #D1D5DB', width: '20%' } }, label); }
function vtd(val, mono) { return h('td', { style: { padding: '6px 9px', fontSize: '10.5px', fontWeight: 700, color: '#111827', border: '1px solid #D1D5DB', fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit' } }, val); }
function kv(label, val, mono) { return h('div', [h('span', { style: { display: 'block', fontSize: '8.5px', color: '#6B7280' } }, label), h('span', { style: { fontSize: '11px', fontWeight: 700, color: '#111827', fontFamily: mono ? "'IBM Plex Mono',monospace" : 'inherit' } }, val)]); }
function sig(role, name) { return h('div', { style: { textAlign: 'center' } }, [h('div', { style: { fontSize: '9px', color: '#6B7280' } }, role), h('div', { style: { height: '58px', borderBottom: '1px solid #9CA3AF' } }), h('div', { style: { fontSize: '9.5px', fontWeight: 700, color: '#111827', marginTop: '4px' } }, name), h('div', { style: { fontSize: '8.5px', color: '#6B7280' } }, 'Nama & tanggal')]); }
