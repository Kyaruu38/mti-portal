import { h } from '../core/dom.js';
import { getState, setState, setUI, toast } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { card, sectionHead, badge, btn, icon, tombolFilter, nilaiFilter, saring, jumlahFilterAktif, hitunganSaring } from '../ui/components.js';
import { money, fmtDate, daysUntil, sumByCurrency, moneyMulti } from '../core/format.js';
import { outstandingPOs } from '../core/outstanding.js';
import { statusText } from '../core/statusText.js';
import { poDocument, ensureCap } from '../ui/documents.js';
import { wrapPrintable } from './approval.js';

function stat(label, value, sub, accent) {
  return card([
    h('div.stat-label', label),
    h('div.stat-num', { style: accent ? { color: 'var(--accent-tx)' } : {} }, value),
    h('div.stat-sub', sub),
  ], { pad: true });
}

const sameMonth = (d) => { const dt = new Date(d); const now = new Date(); return !isNaN(dt) && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); };

// Padanan barisTakCocok() untuk kartu dashboard. Kartu-kartu di sini deretan
// <div>, bukan <table>, dan <tr> yang dihasilkan helper di components.js akan
// dibuang browser tanpa suara — pesannya hilang persis waktu paling dibutuhkan.
// `kosong` dipakai kalau memang belum ada datanya sama sekali: "belum ada" dan
// "saringannya terlalu sempit" dua kabar yang berbeda, dan yang salah membacanya
// akan berhenti mencari.
function blokTakCocok(id, adaFilter, kosong) {
  const bersihkan = () => {
    const f = { ...(getState().ui.filters || {}) };
    delete f[id];
    setUI({ filters: f });
  };
  if (!adaFilter) return h('div', { style: { padding: '18px', color: 'var(--text-3)', fontSize: '12px' } }, kosong);
  return h('div.stack', { style: { gap: '8px', alignItems: 'center', padding: '22px 16px', color: 'var(--text-3)' } }, [
    h('div', { style: { fontSize: '12px', textAlign: 'center' } }, tr({
      id: 'Tidak ada data yang cocok dengan saringannya',
      en: 'No data matches the filter',
      zh: '没有符合筛选条件的数据',
    })),
    h('button.btn.btn-sm', { onClick: bersihkan },
      tr({ id: 'Bersihkan saringan', en: 'Clear filter', zh: '清除筛选' })),
  ]);
}

export function dashboardScreen() {
  const st = getState();
  const u = st.user;

  const header = h('div.row.wrap', { style: { alignItems: 'flex-end', justifyContent: 'space-between' } }, [
    h('div', [
      h('h1.page-h1', `${t('dash_greeting')}, ${u.name.split(' ')[0]}`),
      h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' } }, `${fmtDate(new Date())} · WIB · KEK Kendal`),
    ]),
    h('div.row.gap8.wrap', quickActions(st, u)),
  ]);

  let body;
  if (u.role === 'wilbert') body = wilbertBody(st);
  else if (u.role === 'cania' || u.role === 'visca') body = labelPoBody(st, u);
  else if (u.role === 'sekar') body = sekarBody(st);
  else if (u.role === 'financemti') body = financeBody(st);
  else if (u.role === 'cenjc') body = observerBody(st);
  else if (u.role === 'sona') body = sonaBody(st, u);
  // Still a real fallback: an unknown role reaching here gets the header and
  // nothing else rather than a thrown error. main.js already refuses to render
  // any screen for a role missing from ACCESS, so this is the second net.
  else body = [];

  return h('div.stack', [header, driveQueueBanner(st), ...body]);
}

// "THE FILE IS SAFE, IT JUST IS NOT ON DRIVE YET."
//
// This banner is the whole lesson of 27 July - 1 August written as a control.
// For five days every upload was refused by Google and the portal said "saved"
// each time, because the failure was flattened to a NULL nobody rendered. It
// cost five days of files and an hour with curl to find out.
//
// So a queue that is not empty is now impossible to miss, and the wording says
// the two things a person actually needs: the file is not lost, and Drive is
// the part that is broken. Shown to everyone who can upload — not only to the
// person who happened to be uploading when it broke, because that person may
// not sign in again this week.
function driveQueueBanner(st) {
  const q = st.driveQueue || [];
  if (!q.length) return null;
  const sebab = (q.find(r => r.last_error) || {}).last_error || '';
  return h('div.cfg-banner', {
    style: { display: 'block', background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)' },
  }, [
    h('div', { style: { fontWeight: 700 } }, [icon('warn', 14), ' ', tr({
      id: `${q.length} file belum sampai Google Drive — filenya AMAN, tersimpan di server dan akan dikirim otomatis begitu Drive bisa diakses lagi.`,
      en: `${q.length} file(s) have not reached Google Drive — they are SAFE on the server and will be sent automatically once Drive is reachable.`,
      zh: `${q.length} 个文件尚未送达 Google Drive — 文件已安全保存在服务器，Drive 恢复后将自动上传。`,
    })]),
    // The reason, verbatim. Not decoration: "invalid_grant" is the difference
    // between an expired token and a full disk, and guessing between them is
    // exactly what took an hour.
    sebab ? h('div.mono', { style: { fontSize: '10.5px', marginTop: '5px', opacity: 0.85 } },
      tr({ id: `Alasan terakhir: ${sebab}`, en: `Last error: ${sebab}`, zh: `最近错误：${sebab}` })) : null,
    h('div', { style: { fontSize: '10.5px', marginTop: '4px' } }, tr({
      id: 'Tidak perlu upload ulang. Portal mencoba lagi sendiri setiap kali ada yang login.',
      en: 'No need to re-upload. The portal retries by itself on every login.',
      zh: '无需重新上传。每次有人登录时门户都会自动重试。',
    })),
  ]);
}


// Tiga kotak saja, sesuai tiga keterangan yang tertulis di barisnya. Kartu ini
// isinya belasan baris, jadi jendela saring berisi tujuh kotak akan lebih lama
// dibaca daripada daftarnya sendiri.
const MEDAN_PO_SAYA = (rows) => [
  { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => r.no },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
  // Opsinya teks lencana yang terbaca, dan hanya status yang benar-benar ada di
  // PO orang ini — pilihan yang pasti menghasilkan daftar kosong bukan pilihan.
  { kunci: 'status', label: t('col_status'), tipe: 'pilih', opsi: [...new Set(rows.map(r => statusText(r.status)).filter(Boolean))].sort(), ambil: r => statusText(r.status) },
];

// EVERY PO THIS PERSON RAISED — and its PDF, approved or not.
//
// The Approval Queue belongs to the Supervisor and must keep belonging to him:
// nobody approves their own purchase order. But the side effect was that a PO
// LEFT cania's screen the moment she pressed Generate. She could see a count on
// a tile and nothing else — no document, no way to answer a supplier ringing up
// about it, no way to tell an approved PO from a rejected one. The number just
// went from 1 to 0.
//
// So the list stays with her, and the PDF opens from here.
//
// Handing out the document before approval is safe by construction, not by
// convention: poDocument() prints the company chop ONLY when
// po.status === 'Approved' (ui/documents.js). An unapproved PO downloads as a
// plain unsigned sheet — which is exactly the thing worth having early, to
// check the figures with the supplier before it is sealed.
//
// Still no approve button here. That separation is the point.
function myPoCard(st, u) {
  const semua = st.pos.filter(p => p.by === u.username)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const medan = MEDAN_PO_SAYA(semua);
  const nilai = nilaiFilter('db-po');
  const tersaring = saring(semua, medan, nilai);
  // Disaring dulu baru dipotong: PO ke-13 tidak akan pernah ketemu kalau
  // urutannya dibalik.
  const mine = tersaring.slice(0, 12);
  // Dihitung dari SEMUA PO orang ini, bukan dari 12 yang tampil. Dulu ini
  // membaca daftar yang sudah dipotong, jadi yang punya 30 PO menunggu melihat
  // lencana mentok di angka yang kebetulan lolos ke 12 baris teratas.
  const pending = semua.filter(p => p.status === 'Menunggu Approval').length;
  const judul = tr({ id: 'PO Saya', en: 'My POs', zh: '我的采购单' });

  const openPdf = async (po) => {
    // Popup dulu, cap belakangan — lihat catatan di ui/documents.js.
    const w = window.open('', '_blank');
    if (!w) {
      toast({
        id: 'Popup diblokir — izinkan popup dulu buat buka PDF-nya',
        en: 'Popup blocked — allow popups to open the PDF',
        zh: '弹窗被拦截 — 请允许弹窗以打开 PDF',
      });
      return;
    }
    await ensureCap();
    const html = wrapPrintable(poDocument(po).outerHTML, `PO ${po.no}`);
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.onafterprint = () => w.close(); setTimeout(() => w.print(), 300); };
  };

  const tone = s => s === 'Approved' ? 'green' : s === 'Rejected' ? 'red' : 'amber';

  return card([
    sectionHead(h('div.row.gap8', [
      judul,
      badge(String(pending), pending ? 'accent' : 'gray'),
      hitunganSaring(tersaring.length, semua.length, { id: 'PO', en: 'PO', zh: '个采购单' }),
      tombolFilter({ id: 'db-po', medan, judul }),
    ]), null),
    ...mine.map(p => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)' } }, [
      h('div.grow', [
        h('div.mono', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, p.no),
        h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' } }, p.supplier),
      ]),
      h('div.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(p.total, p.currency)),
      badge(statusText(p.status), tone(p.status)),
      // Says plainly what you are about to get, so an unstamped sheet handed to
      // a supplier is a choice rather than a surprise.
      btn(p.status === 'Approved'
        ? tr({ id: 'PDF', en: 'PDF', zh: 'PDF' })
        : tr({ id: 'PDF draft', en: 'Draft PDF', zh: '草稿 PDF' }),
        { sm: true, iconName: 'download', onClick: () => openPdf(p) }),
    ])),
    mine.length ? null : blokTakCocok('db-po', jumlahFilterAktif(nilai) > 0, tr({
      id: 'Anda belum membuat PO.',
      en: 'You have not raised any PO yet.',
      zh: '您尚未创建采购单。',
    })),
    mine.length ? h('div', { style: { padding: '10px 18px', fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.5 } }, tr({
      id: 'PDF sebelum di-approve belum ada tanda tangan dan cap — aman dipakai untuk konfirmasi angka ke supplier, bukan sebagai PO resmi.',
      en: 'A PDF pulled before approval carries no signature or chop — fine for checking figures with the supplier, not as the official PO.',
      zh: '审批前导出的 PDF 无签章 — 可用于与供应商核对数据，但不能作为正式采购单。',
    })) : null,
  ]);
}

function quickActions(st, u) {
  if (u.role === 'wilbert') {
    const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
    return [
      btn(t('quick_label'), { iconName: 'upload', onClick: () => setState({ screen: 'label-request' }) }),
      btn(t('quick_po_pdf'), { iconName: 'rep', onClick: () => setState({ screen: 'po-converter' }) }),
      btn(t('quick_review_appr') + (pending.length ? ` (${pending.length})` : ''), { variant: 'primary', onClick: () => setState({ screen: 'approval' }) }),
    ];
  }
  if (u.role === 'cania' || u.role === 'visca') {
    return [
      btn(t('quick_label'), { iconName: 'upload', onClick: () => setState({ screen: 'label-request' }) }),
      btn(t('quick_po_pdf'), { iconName: 'rep', onClick: () => setState({ screen: 'po-converter' }) }),
    ];
  }
  if (u.role === 'sekar') {
    return [
      btn(t('s_ppkek'), { iconName: 'box', onClick: () => setState({ screen: 'ppkek' }) }),
      btn(t('s_payment'), { iconName: 'card', onClick: () => setState({ screen: 'payment' }) }),
    ];
  }
  if (u.role === 'financemti') {
    return [btn(t('s_finance'), { iconName: 'dollar', variant: 'primary', onClick: () => setState({ screen: 'finance' }) })];
  }
  if (u.role === 'sona') {
    return [
      btn(tr({ id: 'Upload Stok', en: 'Upload Stock', zh: '上传库存' }), { iconName: 'upload', onClick: () => setState({ screen: 'label-stock' }) }),
      btn(tr({ id: 'Minta Label', en: 'Request Labels', zh: '申请标签' }), { iconName: 'tag', variant: 'primary', onClick: () => setState({ screen: 'label-request' }) }),
    ];
  }
  if (u.role === 'cenjc') {
    // Navigation only — every destination is read-only for this account.
    return [
      btn(tr({ id: 'Approval', en: 'Approval', zh: '审批' }), { iconName: 'check', onClick: () => setState({ screen: 'approval' }) }),
      btn(tr({ id: 'Surat Jalan', en: 'Surat Jalan', zh: '送货单' }), { iconName: 'box', onClick: () => setState({ screen: 'surat-jalan' }) }),
      btn(tr({ id: 'Reports', en: 'Reports', zh: '报表' }), { iconName: 'rep', variant: 'primary', onClick: () => setState({ screen: 'reports' }) }),
    ];
  }
  return [];
}

// Tanpa kotak Status: setiap baris di kartu ini pasti 'Menunggu Approval' —
// itu definisi daftarnya — jadi dropdown status cuma berisi satu pilihan yang
// tidak menyaring apa pun.
const MEDAN_ANTRE_DB = () => [
  { kunci: 'no', label: tr({ id: 'No. PO', en: 'PO No.', zh: '采购单号' }), tipe: 'teks', mono: true, ambil: r => r.no },
  { kunci: 'supplier', label: t('col_supplier'), tipe: 'teks', ambil: r => r.supplier },
  { kunci: 'by', label: tr({ id: 'Diajukan oleh', en: 'Submitted by', zh: '提交人' }), tipe: 'teks', ambil: r => r.by },
];

function wilbertBody(st) {
  const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
  const medanAntre = MEDAN_ANTRE_DB();
  const nilaiAntre = nilaiFilter('db-approval');
  const antre = saring(pending, medanAntre, nilaiAntre);
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));
  const unpaidPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const ppkekMonth = st.ppkek.length;

  return [
    h('div.grid.g4', [
      stat(t('dash_po_pending'), String(pending.length), tr({
        id: `${pending.length} menunggu`, en: `${pending.length} waiting`, zh: `${pending.length} 份待处理`,
      }), true),
      stat(t('dash_inv_due'), String(dueSoon.length), tr({
        id: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`,
        en: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`,
        zh: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} 份已逾期`,
      })),
      stat(t('dash_prf_unpaid'), String(unpaidPrf.length), moneyMulti(sumByCurrency(unpaidPrf))),
      stat(t('dash_ppkek_month'), String(ppkekMonth), tr({
        id: `${st.ppkek.filter(p => p.status === 'Open').length} menunggu costing`,
        en: `${st.ppkek.filter(p => p.status === 'Open').length} awaiting costing`,
        zh: `${st.ppkek.filter(p => p.status === 'Open').length} 份待核算成本`,
      })),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      card([
        sectionHead(h('div.row.gap8', [
          t('dash_pending_mine'),
          // Lencana ini dan kartu angka di atas tetap membaca `pending` yang
          // utuh: keduanya menjawab "berapa yang harus saya kerjakan", bukan
          // "berapa yang sedang saya lihat".
          badge(String(pending.length), 'accent'),
          hitunganSaring(antre.length, pending.length, { id: 'PO', en: 'PO', zh: '个采购单' }),
          tombolFilter({ id: 'db-approval', medan: medanAntre, judul: t('dash_pending_mine') }),
        ]),
          h('a.link', { onClick: () => setState({ screen: 'approval' }) }, t('dash_open_queue') + ' →')),
        ...antre.map(p => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)' } }, [
          h('div.grow', [
            h('div.mono', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, p.no),
            h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' } }, tr({
              id: `${p.supplier} · dari ${p.by}`, en: `${p.supplier} · from ${p.by}`, zh: `${p.supplier} · 来自 ${p.by}`,
            })),
          ]),
          h('div.mono', { style: { fontSize: '12.5px', fontWeight: 600 } }, money(p.total, p.currency)),
          badge(t('dash_awaiting_you'), 'amber'),
          btn(t('dash_review'), { sm: true, onClick: () => setState({ screen: 'approval', ui: { ...st.ui, selPO: p.id } }) }),
        ])),
        antre.length ? null : blokTakCocok('db-approval', jumlahFilterAktif(nilaiAntre) > 0, tr({
          id: 'Tidak ada PO menunggu approval.', en: 'No POs awaiting approval.', zh: '没有待审批的采购单。',
        })),
      ]),
      activityCard(st.audit.slice(0, 6)),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [chartCard(st), dueCard(st, dueSoon)]),
  ];
}

// cania and visca do the same JOB but not the same WORK, and this screen now
// says so. Every count below is scoped to the signed-in username, so the number
// on the tile is that person's own backlog rather than the pair's combined
// total — a shared figure tells neither of them whether they are behind.
//
// The one deliberate exception is the incoming label-request queue: it is a
// queue, not an assignment. Whoever picks it up owns it, so it is shown to both
// and labelled as the team's, not "yours".
function labelPoBody(st, u) {
  const mine = x => x === u.username;
  const myPending = st.pos.filter(p => mine(p.by) && p.status === 'Menunggu Approval');
  const mySj = (st.suratJalan || []).filter(s => mine(s.by));
  const myHandled = (st.labelRequests || []).filter(r => mine(r.handledBy) && r.status === 'PO Terbit');
  const queue = (st.labelRequests || []).filter(r => r.status === 'Diminta');
  const missingDesign = st.items.filter(i => !st.designs.some(d => d.erp === i.erp));

  return [
    // Sits above the personal tiles on purpose: an unclaimed request is the one
    // thing here that is nobody's yet, and therefore the easiest to leave.
    queue.length ? h('div.cfg-banner', {
      style: { background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)', cursor: 'pointer' },
      onClick: () => setState({ screen: 'label-request' }),
    }, tr({
      id: `${queue.length} request label menunggu diproses — belum ada yang ambil.`,
      en: `${queue.length} label requests waiting — nobody has picked them up.`,
      zh: `${queue.length} 份标签申请待处理 — 尚无人认领。`,
    })) : null,
    h('div.grid.g4', [
      stat(t('dash_my_po_pending'), String(myPending.length), tr({
        id: `${myPending.length} menunggu approval supervisor`,
        en: `${myPending.length} awaiting the supervisor's approval`,
        zh: `${myPending.length} 份等待主管审批`,
      }), true),
      stat(tr({ id: 'Request Saya Proses', en: 'Requests I Handled', zh: '我处理的申请' }), String(myHandled.length), tr({
        id: 'sudah jadi PO oleh saya', en: 'turned into a PO by me', zh: '由我开具采购单',
      })),
      stat(tr({ id: 'Surat Jalan Saya', en: 'My Delivery Notes', zh: '我的送货单' }), String(mySj.length), tr({
        id: 'dibuat oleh saya', en: 'created by me', zh: '由我创建',
      })),
      stat(t('dash_missing_design'), String(missingDesign.length), tr({
        id: 'item tanpa desain di library', en: 'items with no design in the library', zh: '设计库中无设计稿的物料',
      })),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      myPoCard(st, u),
      activityCard(st.audit.filter(a => a.user === u.username).slice(0, 6)),
    ]),
  ];
}

// LABEL VIEW — the account that owns the weekly workbook and asks for reprints.
//
// Everything here answers one of two questions, because those are the only two
// this job has: "what am I short of" and "did purchasing act on what I asked
// for". Deliberately no supplier, no price, no PO value — sona does not choose
// suppliers and showing her figures she cannot act on is noise, not access.
function sonaBody(st, u) {
  const rows = st.labelStock || [];
  const buyNow = rows.filter(r => r.status === 'BUY NOW');
  const dontBuy = rows.filter(r => r.status === 'OVERSTOCK' || r.status === 'IDLE STOCK');
  const mine = (st.labelRequests || []).filter(r => r.by === u.username);
  const openReq = mine.filter(r => r.status === 'Diminta');
  const uploads = st.labelUploads || [];
  const last = uploads[0] || null;   // fetchLabelUploads orders newest first
  const sinceUpload = last ? -daysUntil(last.at) : null;

  // The reminder is the only thing on this screen that asks for an action, so
  // it goes first and it only appears when it is actually true. A banner that
  // is always there stops being read within a week.
  const stale = sinceUpload == null || sinceUpload >= 7;
  const reminder = stale ? h('div.cfg-banner', {
    style: { background: 'var(--st-amber-bg)', color: 'var(--st-amber-tx)', borderColor: 'var(--st-amber-tx)', cursor: 'pointer' },
    onClick: () => setState({ screen: 'label-stock' }),
  }, sinceUpload == null
    ? tr({
        id: 'Belum pernah upload Label Inventory Tracker. Angka di bawah masih kosong sampai file pertama masuk.',
        en: 'The Label Inventory Tracker has never been uploaded. The figures below stay empty until the first file arrives.',
        zh: '尚未上传标签库存跟踪表。在首次上传前，下方数据将保持为空。',
      })
    : tr({
        id: `Upload terakhir ${sinceUpload} hari lalu (${fmtDate(last.at)}). Stok di bawah ini seumur itu juga.`,
        en: `Last upload was ${sinceUpload} days ago (${fmtDate(last.at)}). The stock below is exactly that old.`,
        zh: `上次上传在 ${sinceUpload} 天前（${fmtDate(last.at)}）。下方库存数据即为当时的数据。`,
      })) : null;

  return [
    reminder,
    h('div.grid.g4', [
      stat(tr({ id: 'SKU Label', en: 'Label SKUs', zh: '标签 SKU' }), String(rows.length),
        last ? tr({
          id: `terakhir diperbarui ${fmtDate(last.at)}`,
          en: `last updated ${fmtDate(last.at)}`,
          zh: `最后更新 ${fmtDate(last.at)}`,
        }) : tr({ id: 'belum ada data', en: 'no data yet', zh: '暂无数据' })),
      stat(tr({ id: 'Harus Dicetak', en: 'Must Reprint', zh: '需补印' }), String(buyNow.length),
        tr({ id: 'stok di bawah kebutuhan', en: 'stock below requirement', zh: '库存低于需求量' }), true),
      stat(tr({ id: 'Jangan Pesan', en: 'Do Not Order', zh: '暂勿下单' }), String(dontBuy.length),
        tr({ id: 'berlebih atau tidak terpakai', en: 'overstocked or unused', zh: '库存过剩或未使用' })),
      stat(tr({ id: 'Request Berjalan', en: 'Open Requests', zh: '进行中的申请' }), String(openReq.length),
        tr({
          id: `${mine.length} total dikirim`, en: `${mine.length} sent in total`, zh: `累计发送 ${mine.length} 份`,
        })),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      stockTrendCard(st),
      myRequestsCard(st, mine),
    ]),
  ];
}

// Total label stock per upload day. Reads st.labelTrend, which is null/empty
// until supabase_label_trend_view.sql is created — and then simply says so,
// rather than drawing a chart out of nothing.
function stockTrendCard(st) {
  const pts = (st.labelTrend || []).slice(-8);
  const max = Math.max(...pts.map(p => p.stock), 0);

  return card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } }, [
        h('div.card-title', tr({ id: 'Pergerakan Stok Label', en: 'Label Stock Movement', zh: '标签库存走势' })),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
          tr({ id: 'ribu lembar', en: 'thousand pcs', zh: '千张' })),
      ]),
      pts.length >= 2
        ? h('div.row', { style: { alignItems: 'flex-end', gap: '18px', height: '150px', marginTop: '16px', padding: '0 8px' } }, pts.map((p, i) => {
            const barPx = max > 0 ? Math.max(4, Math.round((p.stock / max) * 120)) : 4;
            const isLast = i === pts.length - 1;
            return h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, [
              h('span.mono', { style: { fontSize: '10px', color: isLast ? 'var(--accent-tx)' : 'var(--text-3)' } }, (p.stock / 1000).toFixed(0)),
              h('div', {
                style: { width: '100%', maxWidth: '46px', height: barPx + 'px', background: isLast ? 'var(--accent)' : 'var(--bar)', opacity: isLast ? 1 : 0.55, borderRadius: '5px 5px 2px 2px' },
                title: `${p.sku} SKU · ${p.buyNow} BUY NOW`,
              }),
              h('span', { style: { fontSize: '10px', fontWeight: 600, color: 'var(--text-3)' } }, fmtDate(p.day)),
            ]);
          }))
        : h('div', { style: { padding: '44px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 } },
            tr({
              id: 'Grafik muncul setelah dua kali upload atau lebih — satu titik bukan pergerakan.',
              en: 'The chart appears after two or more uploads — a single point is not a trend.',
              zh: '至少上传两次后才会显示图表 — 单个数据点不构成走势。',
            })),
    ]),
  ]);
}

const LR_TONE = { 'Diminta': 'amber', 'PO Terbit': 'green', 'Ditolak': 'red' };

function myRequestsCard(st, mine) {
  const items = mine.slice(0, 5);
  return card([
    sectionHead(tr({ id: 'Request Saya', en: 'My Requests', zh: '我的申请' }),
      h('a.link', { onClick: () => setState({ screen: 'label-request' }) },
        tr({ id: 'Label Request →', en: 'Label Request →', zh: '标签申请 →' }))),
    h('div', { style: { padding: '4px 18px 12px' } }, items.map(r => h('div.row.gap8', { style: { padding: '10px 0', borderBottom: '1px solid var(--border)' } }, [
      h('div.grow', [
        h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, `${r.rows.length} baris · ${r.sheet || '—'}`),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
          // The PO number is the answer to the only question this table is asked.
          r.poNo ? `PO ${r.poNo}` : fmtDate(r.at)),
      ]),
      badge(statusText(r.status), LR_TONE[r.status] || 'gray'),
    ]))),
    items.length ? null : h('div', { style: { padding: '16px 18px', fontSize: '12px', color: 'var(--text-3)' } },
      tr({
        id: 'Belum ada request. Buka Label Request untuk mengirim yang pertama.',
        en: 'No requests yet. Open Label Request to send the first one.',
        zh: '暂无申请。打开“标签申请”以发送第一份。',
      })),
  ]);
}

function sekarBody(st) {
  const ppkekMonth = st.ppkek.filter(p => sameMonth(p.date));
  const outstandingPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));

  return [
    h('div.grid.g4', [
      stat(t('dash_ppkek_month'), String(ppkekMonth.length), tr({
        id: `${ppkekMonth.filter(p => p.status === 'Open').length} menunggu costing`,
        en: `${ppkekMonth.filter(p => p.status === 'Open').length} awaiting costing`,
        zh: `${ppkekMonth.filter(p => p.status === 'Open').length} 份待核算成本`,
      }), true),
      stat(t('dash_prf_outstanding'), String(outstandingPrf.length), moneyMulti(sumByCurrency(outstandingPrf))),
      stat(t('dash_inv_due'), String(dueSoon.length), tr({
        id: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`,
        en: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} overdue`,
        zh: `${dueSoon.filter(i => daysUntil(i.due) < 0).length} 份已逾期`,
      })),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      activityCard(st.audit.filter(a => a.user === st.user.username).slice(0, 6)),
    ]),
  ];
}

function financeBody(st) {
  const receivedMonth = st.prfs.filter(p => p.receivedAt && sameMonth(p.receivedAt));
  const overdue = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const outstanding = st.prfs.filter(p => p.stage !== 'Paid');
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));

  return [
    h('div.grid.g4', [
      stat(t('dash_prf_received_month'), String(receivedMonth.length), tr({
        id: 'diterima bulan ini', en: 'received this month', zh: '本月已接收',
      }), true),
      stat(t('dash_overdue_total'), String(overdue.length), moneyMulti(sumByCurrency(overdue))),
      stat(t('dash_prf_unpaid'), String(outstanding.length), moneyMulti(sumByCurrency(outstanding))),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      activityCard(st.audit.slice(0, 6)),
    ]),
  ];
}

// MONITORING VIEW — for an account whose whole job is to see where things are
// stuck, and which can change none of it.
//
// Deliberately different from every other body on this screen: the others answer
// "what should I do next", filtering activity to the viewer's own username. This
// one answers "where is the pipeline blocked", so it shows EVERY user's activity
// and counts documents by how long they have been waiting rather than by who
// owns them. Filtering by username here would have made the account useless.
function observerBody(st) {
  const pending = st.pos.filter(p => p.status === 'Menunggu Approval');
  const overdueInv = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) < 0);
  const dueSoon = st.invoices.filter(i => i.status !== 'Paid' && daysUntil(i.due) <= 7).sort((a, b) => new Date(a.due) - new Date(b.due));
  const unpaidPrf = st.prfs.filter(p => p.stage !== 'Paid');
  const ppkekOpen = st.ppkek.filter(r => r.status !== 'Closed');
  // Undelivered goods, from the same source Surat Jalan uses — never a second
  // implementation, so the two screens cannot disagree about what is outstanding.
  const outstanding = outstandingPOs(st);
  // `r.status`, matching labelStock.js's own BUY NOW tab exactly — the tracker's
  // status field, not the recomputed one, so this tile and that tab can never
  // report different numbers for the same data.
  const buyNow = (st.labelStock || []).filter(r => r.status === 'BUY NOW');

  // Age of the oldest thing waiting in each queue — the number that actually
  // says whether a queue is moving.
  const ageOf = iso => { const d = daysUntil(iso); return isNaN(d) ? null : -d; };
  const oldestPending = pending
    .map(p => ageOf(p.createdAt)).filter(v => v != null)
    .reduce((a, b) => Math.max(a, b), 0);
  const oldestPrf = unpaidPrf
    .map(p => ageOf(p.createdAt)).filter(v => v != null)
    .reduce((a, b) => Math.max(a, b), 0);

  // `label` and `sub` are painted straight into the row and read nowhere else;
  // `screen` is the routing key and stays untouched.
  const empty = tr({ id: 'kosong', en: 'empty', zh: '无' });
  const stuck = [
    {
      label: tr({ id: 'PO menunggu approval supervisor', en: "POs awaiting the supervisor's approval", zh: '等待主管审批的采购单' }),
      n: pending.length,
      sub: pending.length ? tr({ id: `paling lama ${oldestPending} hari`, en: `oldest ${oldestPending} days`, zh: `最久已等待 ${oldestPending} 天` }) : empty,
      screen: 'approval',
    },
    {
      label: tr({ id: 'PO barang belum lengkap dikirim', en: 'POs not fully delivered', zh: '货物尚未交齐的采购单' }),
      n: outstanding.length,
      sub: tr({
        id: `${outstanding.reduce((a, x) => a + x.lines.filter(l => l.outstanding > 0).length, 0)} baris item`,
        en: `${outstanding.reduce((a, x) => a + x.lines.filter(l => l.outstanding > 0).length, 0)} item lines`,
        zh: `${outstanding.reduce((a, x) => a + x.lines.filter(l => l.outstanding > 0).length, 0)} 个物料行`,
      }),
      screen: 'surat-jalan',
    },
    {
      label: tr({ id: 'Invoice lewat jatuh tempo', en: 'Invoices past due', zh: '已过付款期的发票' }),
      n: overdueInv.length,
      sub: overdueInv.length ? moneyMulti(sumByCurrency(overdueInv)) : empty,
      screen: 'payment',
    },
    {
      label: tr({ id: 'PRF belum dibayar', en: 'PRFs not yet paid', zh: '尚未付款的付款申请单' }),
      n: unpaidPrf.length,
      sub: unpaidPrf.length ? tr({
        id: `${moneyMulti(sumByCurrency(unpaidPrf))} · paling lama ${oldestPrf} hari`,
        en: `${moneyMulti(sumByCurrency(unpaidPrf))} · oldest ${oldestPrf} days`,
        zh: `${moneyMulti(sumByCurrency(unpaidPrf))} · 最久已等待 ${oldestPrf} 天`,
      }) : empty,
      screen: 'finance',
    },
    {
      label: tr({ id: 'PPKEK belum Closed', en: 'PPKEK not yet Closed', zh: '尚未结案的报关单' }),
      n: ppkekOpen.length,
      sub: tr({
        id: `${ppkekOpen.filter(r => r.status === 'Open').length} belum costing`,
        en: `${ppkekOpen.filter(r => r.status === 'Open').length} not costed`,
        zh: `${ppkekOpen.filter(r => r.status === 'Open').length} 份未核算成本`,
      }),
      screen: 'ppkek',
    },
    {
      label: tr({ id: 'SKU label perlu dibeli', en: 'Label SKUs that need buying', zh: '需采购的标签 SKU' }),
      n: buyNow.length,
      sub: buyNow.length
        ? tr({ id: 'status BUY NOW di tracker', en: 'BUY NOW status in the tracker', zh: '跟踪表中状态为 BUY NOW' })
        : tr({ id: 'stok aman', en: 'stock is fine', zh: '库存充足' }),
      screen: 'label-stock',
    },
  ];

  return [
    h('div.grid.g4', [
      stat(tr({ id: 'PO menunggu approval', en: 'POs Awaiting Approval', zh: '待审批采购单' }), String(pending.length),
        pending.length
          ? tr({ id: `paling lama ${oldestPending} hari`, en: `oldest ${oldestPending} days`, zh: `最久已等待 ${oldestPending} 天` })
          : tr({ id: 'antrian kosong', en: 'queue empty', zh: '队列为空' }), !!pending.length),
      stat(tr({ id: 'Invoice overdue', en: 'Overdue Invoices', zh: '逾期发票' }), String(overdueInv.length),
        overdueInv.length ? moneyMulti(sumByCurrency(overdueInv)) : tr({ id: 'tidak ada', en: 'none', zh: '无' })),
      stat(tr({ id: 'PRF belum lunas', en: 'Unpaid PRFs', zh: '未结清付款申请单' }), String(unpaidPrf.length),
        unpaidPrf.length ? moneyMulti(sumByCurrency(unpaidPrf)) : tr({ id: 'tidak ada', en: 'none', zh: '无' })),
      stat(tr({ id: 'PPKEK belum Closed', en: 'PPKEK Not Closed', zh: '未结案报关单' }), String(ppkekOpen.length), tr({
        id: `${ppkekOpen.filter(r => r.status === 'Open').length} belum costing`,
        en: `${ppkekOpen.filter(r => r.status === 'Open').length} not costed`,
        zh: `${ppkekOpen.filter(r => r.status === 'Open').length} 份未核算成本`,
      })),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' } }, [
      card([
        sectionHead(h('div.row.gap8', [
          tr({ id: 'Yang sedang nyangkut', en: 'What is stuck right now', zh: '当前卡住的事项' }),
          badge(tr({ id: 'Read-only', en: 'Read-only', zh: '只读' }), 'gray', { iconName: 'eye' }),
        ]), null),
        ...stuck.map(row => h('div.row.gap14', { style: { padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }, onClick: () => setState({ screen: row.screen }) }, [
          h('div.grow', [
            h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, row.label),
            h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, row.sub),
          ]),
          badge(String(row.n), row.n ? 'amber' : 'green'),
        ])),
      ]),
      // EVERY user, not just this one — see the note above this function.
      activityCard(st.audit.slice(0, 8)),
    ]),
    h('div.grid', { style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } }, [
      dueCard(st, dueSoon),
      chartCard(st),
    ]),
  ];
}

function activityCard(items) {
  return card([
    h('div.card-head', h('div.card-title', t('dash_recent'))),
    h('div', { style: { padding: '6px 18px 14px' } }, items.length ? items.map((a, i) => h('div.row.gap8', { style: { padding: '9px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' } }, [
      h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: 'var(--st-blue-tx)', marginTop: '5px', flexShrink: 0 } }),
      h('div.grow', { style: { fontSize: '11.8px', color: 'var(--text-2)', lineHeight: 1.45 } }, [
        h('b', { style: { color: 'var(--text)' } }, a.user), ' ', `${a.action} — ${a.target || a.detail || ''}`,
      ]),
      h('span.mono', { style: { fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' } }, fmtDate(a.at)),
    ])) : h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, '—')),
  ]);
}

function dueCard(st, dueSoon) {
  return card([
    sectionHead(t('dash_due_soon'), h('a.link', { onClick: () => setState({ screen: st.user.role === 'financemti' ? 'finance' : 'payment' }) },
      tr({ id: 'Payment →', en: 'Payment →', zh: '付款 →' }))),
    h('div', { style: { padding: '4px 18px 12px' } }, dueSoon.slice(0, 4).map(i => {
      const d = daysUntil(i.due);
      const tone = d < 0 ? 'red' : d <= 1 ? 'amber' : 'gray';
      // Display label only — the tone above is decided from `d`, not from this text.
      const lbl = d < 0 ? tr({ id: `Overdue ${-d}h`, en: `Overdue ${-d}d`, zh: `逾期 ${-d} 天` })
        : d === 0 ? tr({ id: 'Hari ini', en: 'Today', zh: '今天' })
        : d === 1 ? tr({ id: 'Besok', en: 'Tomorrow', zh: '明天' })
        : fmtDate(i.due);
      return h('div.row.gap8', { style: { padding: '10px 0', borderBottom: '1px solid var(--border)' } }, [
        h('div.grow', [h('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text)' } }, i.supplier), h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, i.no)]),
        h('div.mono', { style: { fontSize: '12px', fontWeight: 600 } }, money(i.amount, i.currency)),
        badge(lbl, tone),
      ]);
    })),
    dueSoon.length ? null : h('div', { style: { padding: '16px 18px', fontSize: '12px', color: 'var(--text-3)' } }, '—'),
  ]);
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
// Same twelve slots, per language — chart axis labels only.
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// Real last-6-calendar-months IDR PO totals, derived from st.pos — this used
// to be a hardcoded literal array (never wired to any data, seed or real).
// Only sums IDR POs, matching the chart's own "IDR miliar" axis label; this
// doesn't attempt multi-currency aggregation (out of scope here — see B1's
// sumByCurrency/moneyMulti for the pattern this would follow if that's ever
// wanted for this chart specifically).
function chartCard(st) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: tr({ id: MONTHS_ID[d.getMonth()], en: MONTHS_EN[d.getMonth()], zh: MONTHS_ZH[d.getMonth()] }),
      year: d.getFullYear(), month: d.getMonth(),
    });
  }
  const totals = months.map(m => st.pos
    .filter(p => p.currency === 'IDR')
    .filter(p => { const d = new Date(p.createdAt); return !isNaN(d) && d.getMonth() === m.month && d.getFullYear() === m.year; })
    .reduce((s, p) => s + (p.total || 0), 0) / 1e9);
  const max = Math.max(...totals, 0);
  const hasData = totals.some(v => v > 0);

  return card([
    h('div.card-pad', [
      h('div.row', { style: { justifyContent: 'space-between', alignItems: 'baseline' } }, [
        h('div.card-title', t('dash_po_value')),
        h('div.mono', { style: { fontSize: '10.5px', color: 'var(--text-3)' } },
          tr({ id: 'IDR miliar', en: 'IDR billion', zh: 'IDR 十亿' })),
      ]),
      hasData
        ? h('div.row', { style: { alignItems: 'flex-end', gap: '26px', height: '150px', marginTop: '16px', padding: '0 8px' } }, months.map((m, i) => {
            const barPx = max > 0 ? Math.max(4, Math.round((totals[i] / max) * 120)) : 4;
            const isLast = i === months.length - 1;
            return h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, [
              h('span.mono', { style: { fontSize: '10px', color: isLast ? 'var(--accent-tx)' : 'var(--text-3)' } }, totals[i].toFixed(1)),
              h('div', { style: { width: '100%', maxWidth: '46px', height: barPx + 'px', background: isLast ? 'var(--accent)' : 'var(--bar)', opacity: isLast ? 1 : 0.55, borderRadius: '5px 5px 2px 2px' } }),
              h('span', { style: { fontSize: '10px', fontWeight: 600, color: 'var(--text-3)' } }, m.label),
            ]);
          }))
        : h('div', { style: { padding: '48px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)' } },
            tr({ id: 'Belum ada data PO', en: 'No PO data yet', zh: '暂无采购单数据' })),
    ]),
  ]);
}
