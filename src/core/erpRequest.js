// Template impor 采购申请明细 (CG3001) untuk ERP 中策 — dibuat dari PO label.
//
// KENAPA INI ADA
// -----------------------------------------------------------------------------
// Setelah PO label disetujui, isinya harus masuk lagi ke ERP grup sebagai
// 采购申请 — diketik ulang, baris per baris, oleh orang yang sama yang barusan
// membuatnya di portal. Kode material ERP-nya panjang, mirip satu sama lain, dan
// diawali nol: 010504580902ID, 01050458095388ID, 0105045809471ID. Salah satu
// digit tidak akan terlihat salah oleh siapa pun.
//
// Portal sudah memegang semuanya: kode ERP per SKU (label_stock.erp), jumlah
// yang disetujui, dan prioritasnya. Jadi filenya dibuat di sini.
//
// APA YANG SUDAH DIUJI LANGSUNG DI ERP-NYA, BUKAN DITEBAK
// -----------------------------------------------------------------------------
// 1. Berkasnya harus .xls BIFF8, sama seperti template resminya. SheetJS yang
//    sudah ada di importmap sanggup menulisnya — tidak ada pustaka baru.
// 2. TIGA kolom sensitif tipe selnya, dan salah satu saja membuat impor gagal:
//       物料编号  harus TEKS  — kalau jadi angka, nol depannya hilang dan
//                              kodenya tidak ketemu di master
//       申请数量  harus ANGKA
//       需求日期  harus TEKS 'YYYY-MM-DD' — kalau jadi tanggal Excel, dia
//                              tersimpan sebagai angka serial dan parsernya
//                              tidak mengenalinya
// 3. 物料名称 WAJIB TERISI, tapi ISINYA TIDAK DIPERIKSA. Server menjawab
//    "第[4]行的[物料名称]必须输入" untuk baris yang kosong, sementara baris
//    berisi nama yang sengaja dibuat ngawur diterima — lalu ERP MENIMPANYA
//    dengan nama master miliknya sendiri, dicari lewat 物料编号. Karena itu
//    portal boleh mengirim deskripsinya sendiri: yang menentukan cuma kodenya.
// 4. Baris 1 judul, baris 2 header, data mulai baris 3. Parsernya membaca
//    posisi, bukan nama kolom.
//
// YANG DISENGAJA: TIDAK MENERBITKAN FILE SETENGAH JADI
// -----------------------------------------------------------------------------
// Satu SKU tanpa kode ERP membatalkan seluruh berkas. Menghilangkan barisnya
// diam-diam menghasilkan file yang terlihat wajar, terunggah tanpa keluhan, dan
// baru ketahuan berminggu-minggu kemudian sebagai label yang tidak pernah
// dipesan. Lebih baik menolak sekarang dan menyebut SKU-nya.
import { downloadBlob } from './dom.js';
import { addDays } from './format.js';
import { leadDaysFor } from './labelOrders.js';

// Judul baris 1 dan header baris 2, disalin PERSIS dari template resmi
// (CG3001采购申请明细导入模板.xls). Jangan diterjemahkan, jangan dirapikan.
const JUDUL  = '采购申请明细';
const HEADER = ['物料编号', '物料名称', '规格型号', '单位', '申请数量', '项目编号', '项目名称', '需求日期', '备注(泰国必填用途)'];

// Satuan label di ERP. Portal menyimpannya sebagai '张/PC' di baris PO, tapi
// master ERP mengejanya tanpa garis miring.
const SATUAN_LABEL = '张PC';

export function isLabelPO(po) { return !!po && po.source === 'label'; }

// Tombolnya hanya untuk PO label yang SUDAH disetujui. Sebelum disetujui,
// angkanya masih bisa berubah — dan 采购申请 di ERP adalah dokumen resmi, bukan
// draft. PO non-label tidak pernah lewat jalur ini sama sekali.
export function canBuildErp(po) { return isLabelPO(po) && po.status === 'Approved'; }

// 'YYYY-MM-DD' dari waktu LOKAL, bukan toISOString().
//
// toISOString() memakai UTC. Di WIB (UTC+7), tanggal 4 Agustus jam 05:00 pagi
// masih 3 Agustus menurut UTC — jadi 需求日期 mundur sehari tanpa ada yang
// menyadarinya, dan pemasoknya diberi tenggat yang salah.
export function tglLokal(d) {
  const t = (d instanceof Date) ? d : new Date(d);
  if (isNaN(t)) return '';
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// 需求日期 = tanggal disetujui + lead time prioritasnya.
//
// Angka lead time-nya diambil dari Label Settings (leadSuper 3 / leadUrgent 7 /
// leadNormal 14), BUKAN ditanam di sini — kalau suatu hari berubah, tidak perlu
// menunggu rilis portal.
//
// Basisnya tanggal APPROVE, bukan hari ini: dua orang yang mengunduh berkas dari
// PO yang sama di hari berbeda harus mendapat tanggal yang sama, kalau tidak
// berkas kedua diam-diam memundurkan tenggat yang sudah disepakati.
export function tanggalKebutuhan(st, po) {
  const basis = po.approvedAt ? new Date(po.approvedAt) : new Date();
  const hari = leadDaysFor(po.priority || 'Normal', st.labelSettings || {});
  return tglLokal(addDays(basis, hari));
}

// Kode ERP satu baris PO. Diambil dari barisnya sendiri kalau ada; kalau tidak,
// dicari di Label Stock lewat spec — PO lama dibuat sebelum kolom erp ikut
// disalin ke baris PO, dan menolaknya berarti fitur ini tidak berguna untuk
// PO mana pun yang sudah terlanjur ada.
function kodeErp(st, it) {
  const langsung = String(it.erp || '').trim();
  if (langsung) return langsung;
  const spec = String(it.dimension || it.d || '').trim().toLowerCase();
  if (!spec) return '';
  const hit = (st.labelStock || []).find(r => String(r.spec || '').trim().toLowerCase() === spec);
  return hit ? String(hit.erp || '').trim() : '';
}

// Nama yang dikirim ke kolom 物料名称.
//
// Boleh apa saja ASALKAN tidak kosong — ERP menimpanya dengan nama masternya
// sendiri (diuji, lihat catatan di atas). Jadi yang dipakai adalah keterangan
// paling informatif yang dipunya portal, supaya kalau seseorang membuka berkas
// ini di Excel dia masih tahu sedang melihat label apa.
function namaBaris(it) {
  return String(it.cn || it.d || it.dimension || '').trim() || '(label)';
}

// Susun barisnya. TIDAK melempar error dan TIDAK mengunduh apa pun — pemanggil
// yang memutuskan, karena dia yang tahu cara memberi tahu orangnya.
//
// Mengembalikan { baris, kurang, tanggal }:
//   baris   siap tulis, urut seperti di PO
//   kurang  baris yang kode ERP-nya tidak ketemu — kalau tidak kosong, JANGAN
//           membuat berkasnya
// PARSIAL (v15.6). Tiga argumen opsional, dan tanpa ketiganya fungsi ini
// berperilaku PERSIS seperti sebelumnya — satu berkas, qty penuh, 备注 berisi
// nomor PO. Itu disengaja: pemanggil lama tidak perlu tahu apa-apa soal kas.
//
//   opsi.qty      { [lineId]: jumlah }  jumlah yang ditarik tahap ini. Baris
//                                       yang tidak disebut, atau disebut <= 0,
//                                       TIDAK ikut ke berkasnya sama sekali —
//                                       satu berkas boleh memuat sebagian SKU.
//   opsi.tahap    nomor tahap. Kalau ada, 备注 dan nama berkas memakai penanda
//                 'NO-PO-tahap'. Tanpanya, 备注 tetap nomor PO polos.
//   opsi.tanggal  'YYYY-MM-DD' pengganti 需求日期. Tahap 2 dan 3 dikirim
//                 belakangan dan tenggatnya memang beda; tanpa ini ketiganya
//                 menulis tanggal approve + lead time yang sama persis, dan
//                 ERP menerima tiga permintaan yang seolah dibutuhkan di hari
//                 yang sama.
//
// `kurang` HANYA berisi baris yang benar-benar ikut ditarik. Kalau sebuah SKU
// tidak punya kode ERP tapi juga tidak diminta tahap ini, memblokir berkasnya
// berarti menahan tahap yang isinya sama sekali tidak bergantung padanya.
export function susunBarisErp(st, po, opsi = {}) {
  const pilih = opsi.qty || null;
  const tanggal = opsi.tanggal || tanggalKebutuhan(st, po);
  const penanda = opsi.tahap ? `${String(po.no || 'PO')}-${opsi.tahap}` : String(po.no || '');

  const baris = [];
  const kurang = [];

  for (const it of (po.items || [])) {
    // Berapa yang ditarik tahap ini. Tanpa `pilih`, seluruh qty baris PO —
    // perilaku lama, apa adanya.
    const minta = pilih ? Number(pilih[it.lineId]) || 0 : Number(it.qty) || 0;
    if (minta <= 0) continue;

    const erp = kodeErp(st, it);
    if (!erp) { kurang.push({ spec: it.dimension || it.d || '(tanpa nama)', qty: minta }); continue; }
    baris.push({
      erp,
      nama: namaBaris(it),
      spesifikasi: '',                    // 规格型号 — kosong di semua baris yang ERP-nya terima
      satuan: SATUAN_LABEL,
      qty: minta,
      proyekNo: '',                       // 项目编号 — kosong
      proyekNama: '',                     // 项目名称 — kosong
      tanggal,
      // 备注 — penanda tahap kalau parsial, nomor PO kalau tidak. Ini
      // SATU-SATUNYA tempat kedua sistem bisa disandingkan: tanpa penandanya,
      // tiga 采购申请 dari PO yang sama terbaca seperti tiga permintaan yang
      // tidak berhubungan, dan yang mencocokkannya enam bulan lagi harus
      // menebak.
      catatan: penanda,
      lineId: it.lineId,                  // tidak ditulis ke berkas — dipakai pemanggil untuk mencatat tarikan
    });
  }
  return { baris, kurang, tanggal, penanda };
}

// Tulis .xls BIFF8 dan unduh.
//
// Tipe selnya dipasang SATU PER SATU, bukan lewat aoa_to_sheet. aoa_to_sheet
// menebak tipe dari nilai JavaScript-nya, dan '010504580902ID' memang string —
// tapi begitu ada kode yang seluruhnya angka, tebakannya jadi numerik dan nol
// depannya hilang di dalam berkas. Menulis {t:'s'} secara eksplisit membuat
// tebakan itu tidak pernah terjadi.
export async function unduhTemplateErp(namaFile, baris) {
  const X = await import('xlsx');
  const ws = {};
  const tulis = (r, c, v, t) => { ws[X.utils.encode_cell({ r, c })] = { t, v }; };

  tulis(0, 0, JUDUL, 's');
  HEADER.forEach((h, c) => tulis(1, c, h, 's'));

  baris.forEach((b, i) => {
    const r = 2 + i;
    tulis(r, 0, String(b.erp),         's');   // WAJIB teks
    tulis(r, 1, String(b.nama),        's');
    tulis(r, 2, String(b.spesifikasi), 's');
    tulis(r, 3, String(b.satuan),      's');
    tulis(r, 4, Number(b.qty),         'n');   // WAJIB angka
    tulis(r, 5, String(b.proyekNo),    's');
    tulis(r, 6, String(b.proyekNama),  's');
    tulis(r, 7, String(b.tanggal),     's');   // WAJIB teks YYYY-MM-DD
    tulis(r, 8, String(b.catatan),     's');
  });

  ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 1 + baris.length, c: HEADER.length - 1 } });
  ws['!cols'] = [{ wch: 20 }, { wch: 52 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 20 }];

  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = X.write(wb, { bookType: 'biff8', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.ms-excel' }), namaFile);
}

// Nama berkas: nomor PO, supaya yang mengunggah tahu berkas ini milik PO mana
// tanpa membukanya. Garis miring dan titik dua tidak boleh ada di nama berkas
// Windows, dan No PO portal penuh dengan garis miring.
export function namaFileErp(po, tahap) {
  const dasar = tahap ? `${String(po.no || 'PO')}-${tahap}` : String(po.no || 'PO');
  const aman = dasar.replace(/[\\/:*?"<>|]/g, '-');
  return `CG3001 - ${aman}.xls`;
}
