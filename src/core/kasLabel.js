// ---------------------------------------------------------------------------
// KAS LABEL — sisa PO yang belum pernah ditarik ke 采购申请.
//
// KENAPA ADA
// MOQ supplier 3000, kebutuhan sona 1000. PO-nya 3000 (tombol Mark Up), lalu
// 采购申请 di ERP dibuat bertahap mengikuti kiriman. Sisa yang belum ditarik
// itulah "kas": barangnya sudah dipesan dan sudah dicetak, tinggal ditagih
// bertahap. Waktu sona minta spek yang sama lagi, yang benar bukan membuat PO
// baru — yang benar menghabiskan kas dulu.
//
// KAS DIHITUNG, TIDAK DISIMPAN.
//
//     kas = qty baris PO − jumlah semua tarikan baris itu
//
// Tidak ada kolom saldo di mana pun. Saldo yang disimpan adalah angka yang
// suatu hari berbeda pendapat dengan berkas yang benar-benar keluar — satu
// ekspor yang gagal di tengah, satu perbaikan manual, dan tidak ada yang bisa
// membuktikan mana yang benar. Di sini riwayat tarikannya yang jadi kebenaran,
// dan kas cuma pengurangan.
//
// Efek samping yang kebetulan benar: PO yang dihapus atau dibatalkan membuat
// kasnya hilang sendiri, karena kas dihitung DARI baris PO yang masih ada.
//
// TIGA KAS YANG BEDA, JANGAN DICAMPUR
// Portal punya tiga hitungan sisa yang bunyinya mirip dan bergerak dengan
// kecepatan berbeda:
//
//   sisa PO      turun waktu BARANG DATANG      core/outstanding.js
//   kas          turun waktu EXCEL DITARIK      berkas ini
//   stok fisik   turun waktu DIPAKAI PRODUKSI   layar Label Stock
//
// Menggabungkannya jadi satu angka menghasilkan kalimat yang menenangkan orang
// tentang barang yang belum ada: PO 3000, excel ditarik 1000, barang belum
// datang — satu angka gabungan akan bilang "sisa 2000" ke orang yang sedang
// bertanya apakah gudangnya ada isinya.
// ---------------------------------------------------------------------------
import { getState } from './store.js';

const angka = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Semua tarikan untuk satu baris PO, urut tahap.
export function tarikanBaris(st, poId, lineId) {
  return (st.erpTarikan || [])
    .filter(t => t.poId === poId && t.lineId === lineId)
    .sort((a, b) => angka(a.tahap) - angka(b.tahap));
}

export function sudahDitarik(st, poId, lineId) {
  return tarikanBaris(st, poId, lineId).reduce((s, t) => s + angka(t.qty), 0);
}

// Sisa yang belum ditarik untuk SATU baris. Tidak pernah negatif di layar,
// tapi lihat kelebihanTarik() — angka negatif itu keadaan yang harus dilaporkan,
// bukan disembunyikan dengan clamp.
export function kasBaris(st, po, item) {
  return Math.max(0, angka(item.qty) - sudahDitarik(st, po.id, item.lineId));
}

// Ditarik LEBIH dari yang dipesan. Seharusnya mustahil — jendela ERP menolak
// sebelum menulis — tapi dua orang menarik bersamaan di dua tab masih bisa
// lolos, dan kalau itu terjadi yang salah adalah 采购申请 yang sudah masuk ERP.
// Dipisah dari kasBaris() supaya layarnya bisa MENYEBUTKANNYA, bukan
// menampilkan nol dan diam.
export function kelebihanTarik(st, po, item) {
  return Math.max(0, sudahDitarik(st, po.id, item.lineId) - angka(item.qty));
}

// Nomor tahap berikutnya untuk sebuah PO.
//
// Dihitung per PO, BUKAN per baris: satu tahap menarik semua baris yang ikut
// dalam satu berkas excel, jadi tahap 2 harus berbunyi 2 untuk setiap baris di
// berkas itu. Kalau dihitung per baris, sebuah SKU yang baru ikut di tahap
// ketiga akan tercatat sebagai tahapnya sendiri yang pertama, dan penanda di
// 备注 berbunyi '-1' untuk berkas yang jelas-jelas berkas ketiga.
export function tahapBerikut(st, poId) {
  const semua = (st.erpTarikan || []).filter(t => t.poId === poId);
  if (!semua.length) return 1;
  return Math.max(...semua.map(t => angka(t.tahap))) + 1;
}

// 'TN-WL-PT-0801-2'. Format diminta Kyaru: nomor PO, tanda hubung, urutan
// parsial. Kebetulan sama dengan pola sufiks Surat Jalan (PC/SJ/VII/001-1),
// jadi dua dokumen yang berbeda tetap terbaca dengan logika yang sama.
export function penandaTahap(po, tahap) {
  return `${String(po && po.no || 'PO')}-${tahap}`;
}

// ---------------------------------------------------------------------------
// Baris kas untuk layar Kas Label dan untuk banner di Label Request.
//
// Satu entri PER BARIS PO, bukan per PO: satu PO bisa memuat beberapa SKU dan
// masing-masing punya kode ERP, nama, dan sisanya sendiri.
//
// HANYA PO label yang SUDAH disetujui. PO yang belum disetujui angkanya masih
// bisa berubah, jadi menyebutnya "kas" berarti menjanjikan barang yang belum
// tentu dipesan. Syaratnya sengaja sama persis dengan canBuildErp() — kalau
// kas muncul untuk PO yang belum bisa diekspor, orangnya melihat saldo yang
// tombolnya tidak ada.
// ---------------------------------------------------------------------------
export function barisKas(st, { hanyaBersisa = true } = {}) {
  const out = [];
  for (const po of (st.pos || [])) {
    if (po.source !== 'label' || po.status !== 'Approved') continue;
    for (const it of (po.items || [])) {
      const dipesan = angka(it.qty);
      if (dipesan <= 0) continue;
      const ditarik = sudahDitarik(st, po.id, it.lineId);
      const sisa = Math.max(0, dipesan - ditarik);
      const lebih = Math.max(0, ditarik - dipesan);
      // `|| lebih > 0`: baris yang DITARIK MELEBIHI pesanannya punya sisa nol,
      // jadi saringan "hanya yang bersisa" membuangnya — dan itu justru baris
      // yang paling perlu dilihat orang. Kelebihan tarik berarti 采购申请 yang
      // sudah masuk ERP lebih besar dari PO-nya; menyembunyikannya di balik
      // saringan berarti satu-satunya tempat yang bisa memberitahu diam.
      // Ketahuan oleh tesnya sendiri, bukan oleh yang menulisnya.
      if (hanyaBersisa && sisa <= 0 && lebih <= 0) continue;
      const riwayat = tarikanBaris(st, po.id, it.lineId);
      out.push({
        poId: po.id,
        poNo: po.no,
        lineId: it.lineId,
        supplier: po.supplier || '',
        erp: String(it.erp || '').trim(),
        nama: String(it.cn || it.d || it.dimension || '').trim() || '(label)',
        dimension: it.dimension || '',
        dipesan,
        ditarik,
        sisa,
        lebih,
        tahapTerakhir: riwayat.length ? angka(riwayat[riwayat.length - 1].tahap) : 0,
        tanggalPo: po.approvedAt || po.createdAt || null,
        riwayat,
      });
    }
  }
  // Terbaru di atas — yang baru dipesan itu yang sedang diurus.
  return out.sort((a, b) => new Date(b.tanggalPo || 0) - new Date(a.tanggalPo || 0));
}

// Kas yang cocok untuk sebuah kode ERP. Dipakai banner di Label Request:
// "spek ini masih punya kas 2000 di PO-X, hubungi supplier dulu".
//
// Dicocokkan pada kode ERP dan BUKAN pada nama atau spesifikasi. Nama label
// diketik manusia dan berbeda-beda ejaannya; kode ERP adalah identitas SKU-nya
// di sistem grup, dan itu satu-satunya yang tidak bisa ditulis dua cara.
export function kasUntukErp(st, erp) {
  const kunci = String(erp || '').trim().toUpperCase();
  if (!kunci) return [];
  return barisKas(st).filter(k => k.erp.toUpperCase() === kunci);
}

export function totalKas(daftar) {
  return (daftar || []).reduce((s, k) => s + angka(k.sisa), 0);
}

// Dipakai jendela ERP sebelum menulis. Mengembalikan daftar pelanggaran, bukan
// boolean — pemanggil harus bisa menyebut BARIS MANA yang kelebihan, karena
// "tidak boleh" tanpa menyebut yang mana memaksa orang menebak.
export function langgarKas(st, po, permintaan) {
  const langgar = [];
  for (const [lineId, minta] of Object.entries(permintaan || {})) {
    const it = (po.items || []).find(x => x.lineId === lineId);
    // Baris yang TIDAK ADA di PO itu pelanggaran, bukan alasan untuk melewatinya.
    // `continue` di sini berarti draf basi — baris yang dihapus dari PO lewat
    // Edit sementara jendelanya terbuka — LOLOS tanpa diperiksa sama sekali,
    // dan pemeriksaan terakhir sebelum menulis justru diam untuk keadaan yang
    // paling pantas dihentikan.
    if (!it) {
      if (angka(minta) > 0) langgar.push({ lineId, erp: '(baris tidak ada di PO)', minta: angka(minta), sisa: 0 });
      continue;
    }
    const sisa = kasBaris(st, po, it);
    if (angka(minta) > sisa) {
      langgar.push({ lineId, erp: it.erp || '', minta: angka(minta), sisa });
    }
  }
  return langgar;
}

// Dipanggil sesudah tarikan tersimpan supaya layar tidak perlu memuat ulang
// semuanya dari server. Menambah ke state lokal DENGAN bentuk yang sama seperti
// yang dikembalikan fromRow() di erpTarikanApi.
export function catatTarikanLokal(baris) {
  const st = getState();
  if (!st.erpTarikan) st.erpTarikan = [];
  st.erpTarikan.push(...baris);
}
