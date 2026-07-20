// Demo seed data. Used in DEMO MODE (no Supabase) and as first-run fixtures.
// Grounded in the design mockup's demo data + the sample documents.

import { getState, setState, uid } from './store.js';
import { DEFAULT_BRAND_MAP } from '../parsers/brandMap.js';
import { addDays } from './format.js';

const iso = (d) => new Date(d).toISOString();
const daysFromNow = (n) => iso(addDays(new Date(), n));

export function seedIfEmpty() {
  const st = getState();
  if (st.suppliers.length) return; // already seeded

  const suppliers = [
    { id: uid('sup'), name: 'PT WINAR SUMBER REJEKI', city: 'Semarang', address: 'Kec. Bandungan, Kab. Semarang, Jawa Tengah', contact: 'Budi Hartono', phone: '+62 811-2900-441', bank: 'BCA', acct: '018-xxxx-1194', bankAddress: 'BCA KCU Semarang, Jl. Pemuda No. 90-92, Semarang', pkp: true, top: '45 hari', overseas: false, nameZh: '' },
    { id: uid('sup'), name: 'PT WINS TUNGGAL PERDANA', city: 'Semarang', address: 'Jl. Industri Raya IV No. 21, Kawasan Industri Terboyo, Semarang', contact: 'Lina Kusuma', phone: '+62 812-2774-905', bank: 'Mandiri', acct: 'xxxx-8802', bankAddress: 'Bank Mandiri KC Semarang Pemuda, Jl. Pemuda No. 73, Semarang', pkp: true, top: '30 hari', overseas: false, nameZh: '' },
    { id: uid('sup'), name: 'CV LANCAR JAYA PACKINDO', city: 'Kendal', address: 'Jl. Raya Kaliwungu KM 19, Kendal', contact: 'Agus Salim', phone: '+62 815-7622-018', bank: 'BCA', acct: 'xxxx-8841', bankAddress: 'BCA KCP Kaliwungu, Kendal', pkp: false, top: '30 hari', overseas: false, nameZh: '', bankChangePending: true },
    { id: uid('sup'), name: 'PT SINAR LABELINDO PRATAMA', city: 'Semarang', address: 'Kawasan Industri Candi Blok 8 No. 5, Semarang', contact: 'Ratna Dewi', phone: '+62 813-9034-772', bank: 'BRI', acct: 'xxxx-3310', bankAddress: 'BRI KC Semarang Pattimura', pkp: true, top: '60 hari', overseas: false, nameZh: '' },
    { id: uid('sup'), name: 'Qingdao Runda Packaging Co., Ltd.', city: 'Qingdao, CN', address: 'No. 88 Heilongjiang Rd, Chengyang District, Qingdao, Shandong, China', contact: 'Ms. Wang Lei', phone: 'wang@qdrunda.cn', bank: 'Bank of China', acct: 'xxxx-2207', bankAddress: 'Bank of China, Qingdao Branch, Shandong, China', pkp: false, top: 'T/T 45 days B/L', overseas: true, nameZh: '青岛润达包装有限公司' },
    { id: uid('sup'), name: 'PT BSN TECHNOLOGIES INDONESIA', city: 'Kendal', address: 'Jl. Parang Garuda, Kawasan Industri Kendal, 12, Wonorejo, Kaliwungu, Kab. Kendal, Jawa Tengah 51371', contact: 'Ms. Mandy', phone: '+62 811-2696-088', bank: 'BCA', acct: 'xxxx-5521', bankAddress: 'BCA KCP Kaliwungu, Kendal', pkp: true, top: '30 hari', overseas: false, nameZh: '' },
    { id: uid('sup'), name: 'PT KARYA PRIMA KEMASAN', city: 'Semarang', address: 'Kawasan Industri Wijayakusuma, Semarang', contact: 'Hendra', phone: '+62 812-2900-113', bank: 'BCA', acct: 'xxxx-7781', bankAddress: 'BCA KCU Semarang', pkp: true, top: '45 hari', overseas: false, nameZh: '' },
    { id: uid('sup'), name: 'Continental Handels GmbH', city: 'Hannover, DE', address: 'Vahrenwalder Str. 9, 30165 Hannover, Germany', contact: 'Mr. Klaus Weber', phone: 'k.weber@conti-handels.de', bank: 'Deutsche Bank', acct: 'DE89-xxxx-3021', bankAddress: 'Deutsche Bank AG, Hannover, Germany', pkp: false, top: 'T/T 60 days B/L', overseas: true, nameZh: '' },
  ];

  const bySup = (name) => suppliers.find(s => s.name === name);

  const designs = [
    { id: uid('dsg'), erp: 'LBL-0295-VN', spec: 'ID295/80R22.5 · 18PR', brand: 'MATAROAD', market: 'Vietnam', ver: 'v3', updated: '12 Mar 2026', driveUrl: '', color: '#1B3A6B', status: 'active' },
    { id: uid('dsg'), erp: 'LBL-0315-VN', spec: 'ID315/80R22.5 · 20PR', brand: 'MATAROAD', market: 'Vietnam', ver: 'v2', updated: '02 Feb 2026', driveUrl: '', color: '#1B3A6B', status: 'active' },
    { id: uid('dsg'), erp: 'LBL-0211-PH', spec: 'ID11R22.5 · 16PR', brand: 'HARIMAU', market: 'Philippines', ver: 'v1', updated: 'hari ini', driveUrl: '', color: '#F26722', status: 'draft' },
    { id: uid('dsg'), erp: 'LBL-1200-ME', spec: 'ID12.00R24 · 20PR', brand: 'SOLARIS', market: 'Middle East', ver: 'v5', updated: '28 Jun 2026', driveUrl: '', color: '#B48A1F', status: 'active' },
    { id: uid('dsg'), erp: 'LBL-0296-BR', spec: 'ID295/80R22.5 · 18PR TL', brand: 'ARJUNA', market: 'Brazil', ver: 'v1', updated: 'INMETRO ✓', driveUrl: '', color: '#1F8A4C', status: 'active' },
    { id: uid('dsg'), erp: 'LBL-1000-ID', spec: 'ID10.00R20 · 16PR', brand: 'HARIMAU', market: 'Domestic · SNI', ver: 'v4', updated: '05 Mei 2026', driveUrl: '', color: '#F26722', status: 'active' },
  ];

  const items = designs.map(d => ({
    id: uid('itm'), erp: d.erp, spec: d.spec, brand: d.brand, market: d.market,
    unit: '张', ms: '', rr: '', noise: '', ean: '', nameEn: `${d.brand} ${d.spec}`, nameZh: '',
  }));

  // IMPORTANT: seeded PO ids are STABLE literals, not uid() (which embeds
  // Date.now() and would mint a different id per page load). Surat Jalan
  // rows persisted to Supabase reference a PO by this id — if it changed
  // every session, outstanding-qty tracking would never match across users
  // even though the shipment data itself synced correctly.
  const pos = [
    { id: 'po_seed_0148', no: 'MTI/PO/VII/2026/0148', contract: 'CGDD2607170080', supplier: 'Qingdao Runda Packaging Co., Ltd.', supplierZh: '青岛润达包装有限公司',
      address: 'No. 88 Heilongjiang Rd, Chengyang District, Qingdao, Shandong, China',
      currency: 'USD', amount: 48782, subtotal: 48782, ppn: 0, ppnMode: 'suspended', total: 48782,
      terms: 'T/T 45 days after B/L date', delivery: 'FOB Qingdao — Aug 2026', unit: '条',
      by: 'cania', status: 'Menunggu Approval', createdAt: daysFromNow(-0.1), source: 'converter',
      items: [
        { d: 'Tire label — MATAROAD ID295/80R22.5 (Vietnam)', cn: '轮胎标签', qty: 620000, u: 0.027, a: 16740 },
        { d: 'Tire label — MATAROAD ID315/80R22.5 (Vietnam)', cn: '轮胎标签', qty: 540000, u: 0.0295, a: 15930 },
        { d: 'Flap tag — HARIMAU ID11R22.5 (Philippines)', cn: '垫带吊牌', qty: 380000, u: 0.0424, a: 16112 },
      ] },
    { id: 'po_seed_0147', no: 'MTI/PO/VII/2026/0147', contract: '', supplier: 'PT WINS TUNGGAL PERDANA', supplierZh: '',
      address: 'Jl. Industri Raya IV No. 21, Kawasan Industri Terboyo, Semarang',
      currency: 'IDR', amount: 486200650, subtotal: 486200650, ppn: 0, ppnMode: 'suspended', total: 486200650,
      terms: '45 days after invoice received', delivery: 'Loco Kendal — Jul 2026', unit: '张',
      by: 'visca', status: 'Menunggu Approval', createdAt: daysFromNow(-0.25), source: 'label',
      items: [
        { d: 'Carton box 1200×400×280 — export twin pack', cn: '外包装纸箱', qty: 96000, u: 4320, a: 414720000 },
        { d: 'Stretch film 50cm × 300m — 23μ', cn: '缠绕膜', qty: 1450, u: 49297, a: 71480650 },
      ] },
    { id: 'po_seed_0146', no: 'MTI/PO/VII/2026/0146', contract: '', supplier: 'PT SINAR LABELINDO PRATAMA', supplierZh: '',
      address: 'Kawasan Industri Candi Blok 8 No. 5, Semarang',
      currency: 'IDR', amount: 152440000, subtotal: 152440000, ppn: 0, ppnMode: 'paid', total: 152440000,
      terms: '60 days after invoice received', delivery: 'Loco Kendal — Agu 2026', unit: '张',
      by: 'cania', status: 'Approved', approvedAt: daysFromNow(-0.5), approvedBy: 'wilbert', createdAt: daysFromNow(-1), source: 'label',
      items: [
        { d: 'Sticker label — HARIMAU domestic 10.00R20', cn: '不干胶标签', qty: 1150000, u: 118, a: 135700000 },
        { d: 'Inner tag BX — bilingual', cn: '内标签', qty: 62000, u: 270, a: 16740000 },
      ] },
    { id: 'po_seed_0144', no: 'MTI/PO/VII/2026/0144', contract: '', supplier: 'CV LANCAR JAYA PACKINDO', supplierZh: '',
      address: 'Jl. Raya Kaliwungu KM 19, Kendal',
      currency: 'IDR', amount: 89750000, subtotal: 89750000, ppn: 0, ppnMode: 'suspended', total: 89750000,
      terms: '30 days after invoice received', delivery: 'Loco Kendal — Jul 2026', unit: '张',
      by: 'visca', status: 'Approved', approvedAt: daysFromNow(-1.5), approvedBy: 'wilbert', createdAt: daysFromNow(-2), source: 'label',
      items: [
        { d: 'Pallet kayu ISPM-15 — 110×110', cn: '木托盘', qty: 550, u: 145000, a: 79750000 },
        { d: 'Strapping band PET 19mm', cn: '打包带', qty: 200, u: 50000, a: 10000000 },
      ] },
  ];

  const invoices = [
    { id: uid('inv'), no: 'INV/WSR/2607/0455', supplier: 'PT WINAR SUMBER REJEKI', poRef: 'PO 0139', currency: 'IDR', amount: 996000000, due: daysFromNow(5), faktur: '010.005-26.11230841', ppnPaid: true, status: 'Diproses Wilbert' },
    { id: uid('inv'), no: 'INV/WSR/2607/0461', supplier: 'PT WINAR SUMBER REJEKI', poRef: 'PO 0141', currency: 'IDR', amount: 660000000, due: daysFromNow(12), faktur: '010.005-26.11230918', ppnPaid: true, status: 'Diproses Wilbert' },
    { id: uid('inv'), no: 'INV-2607-0331', supplier: 'PT WINS TUNGGAL PERDANA', poRef: 'PO 0136', currency: 'IDR', amount: 486200000, due: daysFromNow(1), faktur: '', ppnPaid: true, status: 'Diterima Purchasing' },
    { id: uid('inv'), no: 'INV/SLP/2606/0288', supplier: 'PT SINAR LABELINDO PRATAMA', poRef: 'PO 0128', currency: 'IDR', amount: 152440000, due: daysFromNow(-12), faktur: '010.005-26.11229104', ppnPaid: true, status: 'Diterima Finance' },
    { id: uid('inv'), no: 'INV/LJP/2606/0250', supplier: 'CV LANCAR JAYA PACKINDO', poRef: 'PO 0122', currency: 'IDR', amount: 89750000, due: daysFromNow(-17), faktur: '010.005-26.11227732', ppnPaid: false, status: 'Paid' },
    { id: uid('inv'), no: 'INV-RUNDA-2607-08', supplier: 'Qingdao Runda Packaging Co., Ltd.', poRef: 'CGDD2607170080', currency: 'USD', amount: 48782, due: daysFromNow(20), faktur: '', ppnPaid: false, status: 'Diproses Wilbert' },
    { id: uid('inv'), no: 'INV-RUNDA-2607-11', supplier: 'Qingdao Runda Packaging Co., Ltd.', poRef: 'CGDD2607170091', currency: 'CNY', amount: 352000, due: daysFromNow(18), faktur: '', ppnPaid: false, status: 'Diproses Wilbert' },
    { id: uid('inv'), no: 'INV-CONTI-2607-03', supplier: 'Continental Handels GmbH', poRef: 'CGDD2607150044', currency: 'EUR', amount: 41850.5, due: daysFromNow(25), faktur: '', ppnPaid: false, status: 'Diproses Wilbert' },
  ];

  const prfs = [
    { id: uid('prf'), no: 'PRF/PC/VII/012', supplier: 'PT WINAR SUMBER REJEKI', by: 'sekar', currency: 'IDR', amount: 1656000000, stage: 'Diterima Finance', receiveChecklist: { a: false, b: false, c: false, d: false }, invoices: ['INV/WSR/2607/0455', 'INV/WSR/2607/0461'], createdAt: daysFromNow(-0.4) },
    { id: uid('prf'), no: 'PRF/PC/VII/011', supplier: 'PT WINS TUNGGAL PERDANA', by: 'sekar', currency: 'IDR', amount: 486200000, stage: 'Diterima Finance', receiveChecklist: { a: true, b: true, c: true, d: true }, invoices: ['INV-2607-0331'], createdAt: daysFromNow(-1) },
    { id: uid('prf'), no: 'PRF/PC/VII/010', supplier: 'Qingdao Runda Packaging Co., Ltd.', by: 'cania', currency: 'USD', amount: 48782, stage: 'Diterima Finance', receiveChecklist: { a: true, b: true, c: true, d: true }, invoices: ['INV-RUNDA-2607-08'], createdAt: daysFromNow(-2) },
  ];

  const payments = [
    { id: uid('pay'), date: daysFromNow(-3), prf: 'PRF/PC/VII/009', supplier: 'PT KARYA PRIMA KEMASAN', amount: 842300000, currency: 'IDR', method: 'BCA — transfer', driveUrl: '' },
    { id: uid('pay'), date: daysFromNow(-9), prf: 'PRF/PC/VII/008', supplier: 'PT WINAR SUMBER REJEKI', amount: 1204500000, currency: 'IDR', method: 'BCA — transfer', driveUrl: '' },
    { id: uid('pay'), date: daysFromNow(-15), prf: 'PRF/PC/VII/007', supplier: 'Qingdao Runda Packaging Co., Ltd.', amount: 36410, currency: 'USD', method: 'Mandiri — TT valas', driveUrl: '' },
  ];

  const ppkek = [
    { id: uid('pk'), nopen: '040300-001284', date: daysFromNow(-2), supplier: 'Qingdao Runda Packaging', usd: 48760, idr: 792106200, jalur: 'LDP', contractNo: 'CGDD2607170080', kurs: 16245, so: '', jo: '', costing: '', poErpIna: '', status: 'Open' },
    { id: uid('pk'), nopen: '040300-001271', date: daysFromNow(-5), supplier: 'Shandong Haohua Rubber Co.', usd: 112480, idr: 1829468720, jalur: 'LDP', contractNo: '', kurs: 16265, so: 'SO-11208', jo: 'JO-3341', costing: 'CST-0782', poErpIna: 'PO-INA-5521', status: 'Costed' },
    { id: uid('pk'), nopen: '040300-001266', date: daysFromNow(-8), supplier: 'PT WINAR SUMBER REJEKI', usd: 0, idr: 996000000, jalur: 'TLDDP', contractNo: '', kurs: 0, so: 'SO-11195', jo: 'JO-3328', costing: 'CST-0779', poErpIna: 'PO-INA-5512', status: 'Costed' },
    { id: uid('pk'), nopen: '040300-001252', date: daysFromNow(-12), supplier: 'Zhejiang Yongkang Mould Co.', usd: 36410, idr: 590724450, jalur: 'LDP', contractNo: '', kurs: 16224, so: 'SO-11183', jo: 'JO-3302', costing: 'CST-0771', poErpIna: 'PO-INA-5498', status: 'Closed' },
  ];

  const descDict = [
    { en: 'Natural Rubber SIR 20', zh: '天然橡胶 SIR 20' },
    { en: 'Tire label MATAROAD', zh: '轮胎标签 MATAROAD' },
    { en: 'Carton box export twin pack', zh: '出口双联装纸箱' },
    { en: 'Stretch film', zh: '缠绕膜' },
  ];

  const units = ['张', '条', '千克kg', 'set'].map(code => ({ id: uid('unit'), code }));

  const audit = [
    { id: uid('aud'), at: daysFromNow(-1), user: 'visca', entity: 'supplier', target: 'CV LANCAR JAYA PACKINDO', action: 'bank_change', detail: 'BCA ····8841 (dari BRI ····2290)', status: 'menunggu review' },
    { id: uid('aud'), at: daysFromNow(-47), user: 'cania', entity: 'supplier', target: 'CV LANCAR JAYA PACKINDO', action: 'top_change', detail: '30 hari (dari 45 hari)', status: 'disetujui wilbert' },
    { id: uid('aud'), at: daysFromNow(-96), user: 'cania', entity: 'supplier', target: 'CV LANCAR JAYA PACKINDO', action: 'contact_update', detail: 'Agus Salim · +62 815-7622-018', status: '' },
    { id: uid('aud'), at: daysFromNow(-180), user: 'visca', entity: 'supplier', target: 'CV LANCAR JAYA PACKINDO', action: 'create', detail: 'Registrasi awal · Non-PKP · BRI ····2290', status: '' },
  ];

  // Enrich POs with seller contact/phone (for the PO document seller block) and
  // ensure each item carries an ERP code + dimension for the PO table + a stable
  // lineId (erp is not reliably unique — needed to track outstanding qty per line).
  pos.forEach(po => {
    const s = bySup(po.supplier);
    if (s) { po.contact = s.contact; po.phone = s.phone; if (!po.address) po.address = s.address || s.city; }
    po.items.forEach((it, idx) => {
      if (it.erp == null) it.erp = '';
      if (it.dimension == null) it.dimension = ((it.d || '').match(/ID[\d.\/R x-]+/i) || [''])[0].trim();
      it.lineId = `${po.id}:${idx}`;
    });
  });

  setState({
    suppliers, designs, items, units, pos, invoices, prfs, payments, ppkek, descDict, audit,
    brandMap: DEFAULT_BRAND_MAP.slice(),
    labelBatches: [],
    suratJalan: [],
  });
}
