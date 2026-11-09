// MEMILIH TEMPLAT: (pasar, konstruksi) -> berkas templat.
//
// Kunci ini bukan tebakan. Diukur dari 51 artwork asli (lihat
// templat/SURVEI-DRIVE.md): ukuran LEMBAR bukan kunci -- SNI di lembar
// 101x226 dan 252x125 ternyata templat yang sama; dan ukuran LABEL juga
// bukan -- BX TBR dan BX PCR sama-sama 254x79 tapi baloknya berbeda.
//
// ATURAN YANG MENENTUKAN SEGALANYA: kalau tidak ada templat yang cocok,
// fungsinya MENOLAK dan menyebut sebabnya. Tidak ada templat cadangan, tidak
// ada yang "paling mirip". Templat yang salah mencetak label yang salah, dan
// label yang salah tidak kelihatan salah sampai sudah menempel di ban.

export const TEMPLAT = {
  'BX/TBR':  'bx-tbr.json',
  'BX/PCR':  'bx-pcr.json',
  'PT/TBR':  'pt-tbr.json',
  'PT/PCR':  'pt-pcr.json',
  'PT/ST':   'pt-st.json',
  // SNI memakai SATU templat untuk TBR dan BIAS: diuji pada 6 artwork BIAS
  // dari 3 merek di empat ukuran lembar, offsetnya cocok dalam ~0,6 mm.
  // Yang membedakan cuma ISI medan konstruksi.
  'SNI/TBR': 'sni.json',
  'SNI/BIAS': 'sni.json',
};

// Templat yang sampelnya baru satu merek. Boleh dipakai, TAPI pemanggilnya
// diberi tahu supaya proofnya ditandai perlu-periksa-lebih.
export const BARU_SATU_MEREK = new Set(['PT/PCR']);

// Konstruksi dibaca dari PREFIKS nama barang: '(ID-WL-TBR-PT)'.
// Bukan dari ukuran, bukan dari pola. Prefiks itu satu-satunya tempat
// konstruksi dituliskan secara eksplisit.
const KONSTRUKSI = ['TBR', 'PCR', 'BIAS', 'OTR', 'ST'];

export function konstruksiDari(teks) {
  const s = String(teks || '');
  const m = s.match(/\(\s*ID-.*?-(TBR|PCR|BIAS|OTR|ST)[-\s]/i);
  if (m) return m[1].toUpperCase();
  // Cadangan: kadang prefiksnya tidak lengkap tapi konstruksinya tetap
  // tertulis sebagai kata utuh di antara tanda hubung.
  for (const k of KONSTRUKSI) {
    if (new RegExp('(^|[-\\s(])' + k + '([-\\s)]|$)', 'i').test(s)) return k;
  }
  return '';
}

export function pasarDari(teks, pasarKolom) {
  // Kolom pasar lebih dipercaya KALAU bentuknya memang kode pasar. Sebagian
  // lembar order mengisinya dengan prefiks penuh '(ID-WL-TBR-PT)', dan itu
  // dilipat ke segmen terakhirnya -- aturan yang sama dengan kodePasar() di
  // parsers/excelLabels.js.
  const k = String(pasarKolom || '').trim();
  const pre = k.match(/^\(\s*ID-.*?-([A-Za-z]+)\s*\)$/);
  if (pre) return pre[1].toUpperCase();
  if (k && !/^[—–-]+$/.test(k)) return k.toUpperCase();
  const m = String(teks || '').match(/\(\s*ID-.*?-([A-Za-z]+)\s*\)/);
  return m ? m[1].toUpperCase() : '';
}

// Mengembalikan { ok:true, kunci, berkas, perluPeriksaLebih }
//        atau   { ok:false, sebab, kunci }
export function pilihTemplat({ nama, spec, market } = {}) {
  const teks = [nama, spec].filter(Boolean).join(' ');
  const pasar = pasarDari(teks, market);
  const konst = konstruksiDari(teks);

  if (!pasar) return { ok: false, sebab: 'pasar tidak diketahui', kunci: '' };
  if (!konst) return { ok: false, sebab: 'konstruksi tidak diketahui (TBR/PCR/BIAS/OTR/ST)', kunci: pasar + '/?' };

  const kunci = pasar + '/' + konst;

  // OEM TIDAK PERNAH lewat templat, dan ini bukan karena templatnya belum
  // dibuat. Artwork OEM adalah design MILIK PELANGGAN: dua berkas OEM TBR
  // dari pelanggan berbeda tata letaknya berbeda total, sampai awalan EAN
  // perusahaannya pun berbeda. Merakitnya dari templat berarti mencetak
  // design yang bukan milik pelanggan itu.
  if (pasar === 'OEM') {
    return { ok: false, sebab: 'OEM memakai jalur sulih, bukan templat (design milik pelanggan)', kunci };
  }

  const berkas = TEMPLAT[kunci];
  if (!berkas) return { ok: false, sebab: 'belum ada templat untuk ' + kunci, kunci };

  return { ok: true, kunci, berkas, perluPeriksaLebih: BARU_SATU_MEREK.has(kunci) };
}
