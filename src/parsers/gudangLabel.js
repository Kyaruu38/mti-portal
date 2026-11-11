// =============================================================================
// DUA SUMBER GUDANG: stok WH Indonesia dan jadwal kirim WH China.
// -----------------------------------------------------------------------------
// Permintaan Sona TIDAK diurai di sini: bentuk lembarnya sama persis dengan
// lembar order label (market / ERP CODE / 规格 specification / 花纹 / 品牌 /
// TT/TL / QTY), jadi dia lewat parseLabelSheet() di excelLabels.js. Itu bukan
// soal hemat baris: parser itu yang memegang deteksi header bergeser, koreksi
// kolom QTY, dan jalur PERLU DICEK. Parser kedua untuk bentuk yang sama berarti
// lembar Sona kehilangan ketiganya, dan kehilangannya tidak akan kelihatan
// sampai ada baris yang hilang.
//
// Dua lembar di bawah bentuknya memang lain, dan dua-duanya kecil:
//
//   WH Indo  (sheet 'KCBB0101'), header di baris pertama:
//       物料名称 | 库存数量 | 实际数量
//       nama       stok sistem  hitungan fisik
//
//   WH China (sheet 'Sheet1'), BARIS PERTAMA JUDUL, header di baris KEDUA:
//       去单位物料名称 | 订单数量 | 发货时间(发货数量) | 单号
//       nama             dipesan    jadwal kirim         no dokumen
//
// Baris judul di lembar China itu yang membuat pencarian header tidak boleh
// dipaku ke baris 0. Dia dicari, bukan diasumsikan -- dan kalau tidak ketemu,
// lembarnya DITOLAK dengan menyebut apa yang dicari, bukan dibaca separuh.
// =============================================================================

import { parseNumber } from './numbers.js';
import { kunciGabung } from '../core/urgensi.js';

const teks = (v) => String(v ?? '').trim();
const num = (v) => { const n = parseNumber(v, 'id'); return Number.isFinite(n) ? n : null; };

const JUDUL = {
  nama:   [/物料名称/, /^nama/i, /material\s*name/i],
  sistem: [/库存数量/, /stok\s*sistem/i, /system\s*stock/i],
  fisik:  [/实际数量/, /jumlah\s*(aktual|fisik)/i, /actual/i],
  qty:    [/订单数量/, /jumlah\s*pesanan/i, /order\s*qty/i],
  jadwal: [/发货时间/, /waktu\s*pengirim/i, /shipping\s*time/i],
  dok:    [/单号/, /nomor\s*dokumen/i, /document\s*no/i],
};

function cocokJudul(sel) {
  const s = teks(sel).replace(/\s+/g, ' ');
  if (!s) return null;
  for (const [k, pola] of Object.entries(JUDUL)) if (pola.some(p => p.test(s))) return k;
  return null;
}

// Header DICARI di beberapa baris pertama, tidak dipaku ke baris 0 -- lembar
// China punya satu baris judul di atasnya, dan lembar yang diekspor ulang
// kadang punya dua.
export function cariHeader(rows, scan = 6) {
  let best = { idx: -1, map: {}, hits: 0 };
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const map = {}; let hits = 0;
    (rows[i] || []).forEach((sel, c) => {
      const k = cocokJudul(sel);
      if (k && map[k] == null) { map[k] = c; hits++; }
    });
    if (hits > best.hits) best = { idx: i, map, hits };
  }
  return best;
}

/**
 * Menebak lembar ini sumber yang mana. Dipakai kotak unggah untuk MENOLAK
 * berkas yang salah kotak sambil menyebut kotak yang benar -- pola yang sama
 * dengan layar Stok Label, dan alasannya sama: berkas yang salah kotak dibaca
 * separuh benar, dan separuh benar jauh lebih mahal daripada ditolak.
 */
export function kenaliSumber(rows) {
  const h = cariHeader(rows);
  if (h.idx < 0) return '';
  const m = h.map;
  if (m.nama != null && m.jadwal != null) return 'china';
  if (m.nama != null && (m.sistem != null || m.fisik != null)) return 'indo';
  return '';
}

function barisIsi(rows, mulai) {
  const out = [];
  for (let i = mulai; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r.some(c => teks(c) !== '')) continue;
    out.push({ i, r });
  }
  return out;
}

/**
 * Stok WH Indonesia.
 *
 * DUA ANGKA DIBAWA DUA-DUANYA, dan itu inti layar ini: 库存数量 adalah angka
 * SISTEM dan 实际数量 adalah HASIL HITUNG ORANG di gudang. Yang dipakai
 * membeli angka fisiknya, tapi selisihnya yang memberi tahu seberapa jauh
 * sistemnya salah -- dan menyimpan satu angka saja membuang pertanyaan itu
 * selamanya. Pemiliknya menyebutnya sendiri: "Dua-duanya ditampilin,
 * selisihnya ditandai".
 */
export function parseWhIndo(rows) {
  const h = cariHeader(rows);
  if (h.idx < 0 || h.map.nama == null) {
    return { ok: false, error: 'Header tidak ketemu — dicari kolom 物料名称 (nama barang) dan 库存数量 / 实际数量.' };
  }
  const baris = [], perluCek = [];
  for (const { i, r } of barisIsi(rows, h.idx + 1)) {
    const nama = teks(r[h.map.nama]);
    const sistem = h.map.sistem == null ? null : num(r[h.map.sistem]);
    const fisik = h.map.fisik == null ? null : num(r[h.map.fisik]);
    const sebab = [];
    // Nama tanpa kunci gabung TIDAK bisa dipertemukan dengan baris Sona mana
    // pun, jadi stoknya tidak akan pernah ikut dihitung. Itu kehilangan yang
    // harus kelihatan, bukan baris yang pantas dibuang diam-diam.
    if (!nama) sebab.push('nama_kosong');
    else if (!kunciGabung(nama)) sebab.push('nama_tanpa_kunci');
    if (sistem == null && fisik == null) sebab.push('dua_angka_kosong');
    if (sebab.length) perluCek.push({ baris: i + 1, nama, sebab, sistemMentah: teks(r[h.map.sistem]), fisikMentah: teks(r[h.map.fisik]) });
    if (!nama) continue;
    baris.push({ nama, sistem, aktual: fisik, _row: i + 1, cek: sebab });
  }
  return { ok: true, baris, perluCek, headerRow: h.idx + 1 };
}

/**
 * Jadwal kirim WH China.
 *
 * Kolom 发货时间(发货数量) isinya TEKS BANYAK BARIS di satu sel:
 *     '2026/11/20(1060)\n2026/11/07(1060)'
 *     '等送货通知(500)'
 * Dibawa APA ADANYA ke core/urgensi.js, yang menguraikannya. Diurai di sini
 * berarti dua tempat yang tahu bentuk teks itu, dan yang satu suatu hari akan
 * ketinggalan waktu bentuknya berubah.
 */
export function parseWhChina(rows) {
  const h = cariHeader(rows);
  if (h.idx < 0 || h.map.nama == null || h.map.jadwal == null) {
    return { ok: false, error: 'Header tidak ketemu — dicari kolom 去单位物料名称 (nama) dan 发货时间 (waktu pengiriman).' };
  }
  const baris = [], perluCek = [];
  for (const { i, r } of barisIsi(rows, h.idx + 1)) {
    const nama = teks(r[h.map.nama]);
    const qty = h.map.qty == null ? null : num(r[h.map.qty]);
    const jadwal = teks(r[h.map.jadwal]);
    const sebab = [];
    if (!nama) sebab.push('nama_kosong');
    else if (!kunciGabung(nama)) sebab.push('nama_tanpa_kunci');
    // Jadwal kosong BUKAN kerusakan: barang yang sudah dipesan tapi belum
    // dijadwalkan memang tidak punya tanggal, dan itu keadaan yang sah.
    // urgensi.js menyebutnya 'ETA belum dijadwalkan' dan tetap menampilkannya.
    if (qty == null && !jadwal) sebab.push('tanpa_qty_dan_jadwal');
    if (sebab.length) perluCek.push({ baris: i + 1, nama, sebab, qtyMentah: teks(r[h.map.qty]), jadwalMentah: jadwal });
    if (!nama) continue;
    baris.push({ nama, qty, jadwal, dok: h.map.dok == null ? '' : teks(r[h.map.dok]), _row: i + 1, cek: sebab });
  }
  return { ok: true, baris, perluCek, headerRow: h.idx + 1 };
}
