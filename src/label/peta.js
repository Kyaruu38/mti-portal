// PETA MEDAN: dari satu baris `items` ke nilai yang tercetak di label.
//
// Semua aturan turunan ditaruh DI SINI, satu tempat, supaya bisa diadu ke
// artwork asli. Yang tersebar di banyak berkas tidak bisa diperiksa.
//
// Aturannya cuma tiga ragam:
//   kolom   — diambil apa adanya dari items
//   turunan — dihitung, dan tiap hitungan punya ujinya sendiri
//   tetap   — teks yang sama di tiap label keluarga itu
//
// Yang TIDAK ada: ragam "kira-kira". Medan yang tidak bisa diisi dikembalikan
// kosong BESERTA sebabnya, dan perender menandainya di proof. Nilai yang
// ditebak di label tidak kelihatan ditebak.

// Awalan GS1 milik MTI. Delapan digit, dan nomor ITEM adalah lima digit
// sisanya -- termasuk digit cek, yang kebetulan jatuh di posisi terakhir
// nomor item.
const AWALAN_MTI = '07216880';

// NOMOR ITEM TIDAK BISA DITURUNKAN DARI EAN SECARA UMUM, dan ini sudah
// diuji ke artwork asli, bukan diduga:
//
//   MTI      0721688034223 -> item 34223  (mulai posisi 8, MENCAKUP digit cek)
//   HERCULES 0688028983774 -> item 98377  (mulai posisi 7, TIDAK mencakup)
//
// Panjang awalan GS1 berbeda tiap perusahaan, jadi titik potongnya pindah.
// Memakai aturan MTI pada EAN HERCULES menghasilkan '83774' -- nomor item
// yang salah, tercetak di label, tanpa ada yang kelihatan aneh.
//
// Jadi: diturunkan HANYA untuk awalan MTI. Selain itu dikembalikan kosong
// dengan sebabnya. 202 dari 204 EAN di basis data berawalan MTI.
export function nomorItem(ean) {
  const e = String(ean || '').replace(/\D/g, '');
  if (!e) return { nilai: '', sebab: 'EAN kosong' };
  const e13 = e.length === 12 ? '0' + e : e;
  if (e13.length !== 13) return { nilai: '', sebab: `panjang EAN ${e.length}, bukan 12/13` };
  if (!e13.startsWith(AWALAN_MTI)) {
    return { nilai: '', sebab: `awalan GS1 bukan milik MTI (${e13.slice(0, 7)}…) — nomor item tidak bisa diturunkan` };
  }
  return { nilai: e13.slice(8), sebab: '' };
}

// items.ply menyimpan '18PR'. Sebagian label mencetak angkanya telanjang
// ('18') di sebelah tulisan 'Ply Rating' yang sudah ada di artworknya.
export function plyAngka(ply) {
  const m = String(ply || '').match(/^(\d{1,3})\s*PR$/i);
  if (m) return { nilai: m[1], sebab: '' };
  const n = String(ply || '').match(/^(\d{1,3})$/);
  if (n) return { nilai: n[1], sebab: '' };
  return { nilai: '', sebab: 'ply bukan bentuk "18PR"' };
}

// items.ply_block menyimpan 'J18': huruf jangkauan beban DAN lapisan,
// menempel. Yang tercetak di kotak "Load Range" cuma hurufnya.
export function jangkauanBeban(plyBlock) {
  const m = String(plyBlock || '').match(/^([A-Z])\s*\d{1,3}$/i);
  if (m) return { nilai: m[1].toUpperCase(), sebab: '' };
  return { nilai: '', sebab: 'ply_block bukan bentuk "J18"' };
}

// Baris spesifikasi di kepala label: dimensi dan lapisan disatukan.
export function specRingkas(size, ply) {
  const s = String(size || '').trim();
  const p = String(ply || '').trim();
  if (!s) return { nilai: '', sebab: 'size kosong' };
  if (!p) return { nilai: '', sebab: 'ply kosong' };
  return { nilai: `${s}-${p}`, sebab: '' };
}

// Tabel induk. Kunci = nama medan di berkas templat.
export const ATURAN = {
  size:          { kolom: 'size' },
  pattern:       { kolom: 'pattern' },
  pattern_besar: { kolom: 'pattern' },
  pattern_atas:  { kolom: 'pattern' },
  load_speed:    { kolom: 'load_speed' },
  konstruksi:    { kolom: 'tt_tl' },
  ms:            { kolom: 'ms' },
  ean:           { kolom: 'ean' },
  npb1:          { kolom: 'npb1' },
  npb3:          { kolom: 'npb3' },
  sni_no:        { kolom: 'sni_no' },
  noise_db:      { kolom: 'noise' },
  rolling_resistance: { kolom: 'rr' },
  wet_grip:      { kolom: 'wet_grip' },

  ply:           { turunan: 'plyAngka',       dari: ['ply'] },
  ply_angka:     { turunan: 'plyAngka',       dari: ['ply'] },
  load_range:    { turunan: 'jangkauanBeban', dari: ['ply_block'] },
  item_no:       { turunan: 'nomorItem',      dari: ['ean'] },
  item_no_spine: { turunan: 'nomorItem',      dari: ['ean'] },
  spec_atas:     { turunan: 'specRingkas',    dari: ['size', 'ply'] },
  spec_spine:    { turunan: 'specRingkas',    dari: ['size', 'ply'] },

  // Teks yang sama di tiap label keluarga itu; nilainya ada di berkas
  // templat sebagai `tetap`, bukan di sini.
  lembaga: { tetap: true }, label_ply: { tetap: true }, label_load: { tetap: true },
  made_in: { tetap: true }, lebar_label: { tetap: true }, tinggi_label: { tetap: true },
  callout_mm: { tetap: true }, callout_452: { tetap: true }, revisi: { tetap: true },

  // Bukan dari data: lapisan persetujuan dan aset merek.
  customer: { lapisan: 'persetujuan' }, blok_setuju: { lapisan: 'persetujuan' },
  ttd: { lapisan: 'persetujuan' }, url_merek: { aset: 'merek' },
};

const TURUNAN = { nomorItem, plyAngka, jangkauanBeban, specRingkas };

// Mengisi satu medan templat dari satu baris items.
// Selalu mengembalikan { nilai, sebab, ragam } -- tidak pernah melempar, dan
// tidak pernah mengarang. Perender yang memutuskan apa yang dilakukan pada
// medan yang kosong; tugasnya di sini cuma jujur.
export function isiMedan(medan, baris) {
  const k = medan && medan.k;
  const a = ATURAN[k];
  if (!a) return { nilai: '', sebab: `medan '${k}' tidak ada di peta`, ragam: 'tak dikenal' };
  if (a.tetap)   return { nilai: medan.tetap || '', sebab: '', ragam: 'tetap' };
  if (a.lapisan) return { nilai: '', sebab: '', ragam: 'lapisan:' + a.lapisan };
  if (a.aset)    return { nilai: '', sebab: '', ragam: 'aset:' + a.aset };
  if (a.kolom) {
    const v = baris ? baris[a.kolom] : '';
    const s = v == null ? '' : String(v).trim();
    return { nilai: s, sebab: s ? '' : `items.${a.kolom} kosong`, ragam: 'kolom:' + a.kolom };
  }
  const f = TURUNAN[a.turunan];
  const arg = a.dari.map(c => (baris ? baris[c] : ''));
  const r = f(...arg);
  return { nilai: r.nilai, sebab: r.sebab, ragam: 'turunan:' + a.turunan };
}

// Mengisi SELURUH medan sebuah templat, dan melaporkan yang tidak terisi.
export function isiTemplat(templat, baris) {
  const medan = (templat && templat.medan) || [];
  const hasil = [];
  for (const m of medan) {
    if (m.peran === 'titik asal') continue;
    const r = isiMedan(m, baris);
    hasil.push({ k: m.k, ...r });
  }
  const bolong = hasil.filter(x => !x.nilai && !x.ragam.startsWith('lapisan') && !x.ragam.startsWith('aset'));
  return { medan: hasil, bolong, lengkap: bolong.length === 0 };
}
