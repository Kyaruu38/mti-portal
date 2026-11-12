// FOTO POLA BAN — aturan pencocokan kode pola ke foto tapak.
//
// KENAPA INI TABEL SENDIRI, BUKAN KOLOM DI `designs`.
// Foto tapak itu milik POLA, bukan milik satu artwork. Satu pola (CR926)
// dipakai oleh puluhan baris design yang berbeda merek, ukuran dan pasar;
// menaruh url-nya di `designs` berarti menyalin satu gambar yang sama ke 30
// baris, dan begitu ada foto yang lebih bagus harus mengubah 30 baris itu.
// Di sini satu pola = satu baris, dan yang lain menyambung lewat kodenya.
//
// APA YANG TIDAK DILAKUKAN DI SINI.
// Tabel ini TIDAK menyimpan merek. Foto tapak tidak bisa menentukan merek:
// satu cetakan tapak yang sama dijual sebagai WESTLAKE, GOODRIDE, TRAZANO,
// CHAOYANG dan YARTU sekaligus — itu memang praktik pabriknya, bukan data
// yang kurang. Jadi (kode pola) -> (foto) itu satu-ke-satu, sedangkan
// (kode pola) -> (merek) itu satu-ke-banyak dan tidak boleh disimpulkan dari
// sini. Lihat juga src/label/templat/pt-tbr.json: "foto ban" terdaftar
// sebagai aset yang TIDAK bisa dibuat generator, dan tabel inilah isinya.
//
// url_gambar memakai lh3.googleusercontent.com/d/<id>. Itu hanya tersaji
// kalau foldernya "anyone with the link": permintaan <img> dari browser TIDAK
// membawa identitas siapa pun, jadi berbagi ke akun per orang tidak cukup —
// pelajaran yang sama yang sudah kena ke kartu design (lihat core/drive.js).
// Kalau foldernya belum dibuka, url_lihat tetap jalan untuk yang punya akses.
//
// Berkas ini SENGAJA tidak mengimpor supabase.js: aturan pencocokannya harus
// bisa diuji tanpa menyalakan basis data. Yang menarik datanya ada di
// core/polaFotoApi.js — pembagian yang sama dengan urgensi.js / urgensiApi.js.

// TIGA TINGKAT KEKETATAN, dan alasan tiap-tiapnya.
//
// Ini satu-satunya tempat di portal yang tidak boleh memakai normalisasi
// biasa. Di nama merek, '+' dan '-' cuma hiasan ejaan. Di kode pola dia
// PEMBEDA, dan buktinya ada di folder fotonya sendiri:
//
//   CR926  dan CR926+   -> dua berkas, dua gambar berbeda
//   AS600  dan AS600+   -> dua berkas, dua gambar berbeda
//   ST-100 dan ST100    -> dua berkas, dua gambar berbeda
//
// Normalisasi yang membuang keduanya menjadikan tiga pasang itu satu kunci,
// lalu salah satunya memakai foto milik yang lain TANPA ADA YANG TAHU. Itu
// bukan hasil pencarian yang kurang bagus, itu artwork yang salah gambar.
//
// Jadi:
//   ketat  — buang spasi/titik/garis-miring saja; '+' dan '-' dipertahankan.
//            Dipakai untuk "sama persis". Ini yang membedakan ST-100 dari ST100.
//   plus   — buang '-' juga, '+' tetap. Cermin public.padat_pola() di Supabase.
//   polos  — buang semuanya. Cuma jaring terakhir untuk MENAMPILKAN kandidat,
//            tidak pernah untuk menyimpulkan kecocokan.
export const padatKetat = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9+-]/g, '');
export const padatPola  = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9+]/g, '');
export const padatPolos = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// CARI FOTO UNTUK SATU KODE POLA.
//
// Urutan tingkatnya yang penting, bukan cuma cocok atau tidak:
//   0  sama persis (ketat)                  -> pas
//   1  sama setelah '-' dibuang             -> pas, TAPI lihat catatan ambigu
//   2  kode tersimpan awalan dari yang dicari   ("AS858Pro" -> foto "AS858")
//   3  yang dicari awalan dari kode tersimpan   ("CR926" -> CR926+, CR926B, ...)
//   4  sama setelah semuanya dibuang        -> kandidat saja
//
// `pas` dikembalikan apa adanya supaya pemakainya memutuskan sendiri:
// menempelkan foto ke artwork hanya boleh pakai yang pas, sedangkan kotak
// pencarian boleh menampilkan kandidat.
export function cariPola(daftar, cari) {
  const ketat = padatKetat(cari);
  const plus = padatPola(cari);
  const polos = padatPolos(cari);
  if (!polos) return [];
  const out = [];
  for (const p of daftar || []) {
    const pKetat = p.kodeKetat ?? padatKetat(p.kode);
    const pPlus = p.kodePlus ?? padatPola(p.kode);
    const pPolos = p.kodePolos ?? padatPolos(p.kode);
    let tingkat;
    if (pKetat === ketat) tingkat = 0;
    else if (pPlus === plus) tingkat = 1;
    else if (plus.startsWith(pPlus)) tingkat = 2;
    else if (pPlus.startsWith(plus)) tingkat = 3;
    else if (pPolos === polos) tingkat = 4;
    else continue;
    out.push({ ...p, tingkat, pas: tingkat <= 1 });
  }
  out.sort((a, b) => a.tingkat - b.tingkat || a.kode.length - b.kode.length || a.kode.localeCompare(b.kode));
  return out;
}

// FOTO YANG BOLEH DIPAKAI OTOMATIS.
//
// Dipisah dari cariPola() supaya tidak ada yang kebetulan memakai kandidat
// sebagai hasil. Dan yang paling penting: KALAU AMBIGU, JAWABANNYA NULL.
//
// Mencari "ST100" ketika folder memuat ST-100 dan ST100 akan menemukan dua
// baris yang dua-duanya sah disebut "pas". Memilih yang pertama berarti benar
// separuh waktu dan salah separuh waktu, dan yang salah itu tidak kelihatan
// dari mana pun — artwork-nya sudah tercetak sebelum ada yang sadar. Jadi di
// sini ambigu ditolak dan dikembalikan ke orangnya untuk dipilih, aturan yang
// sama dengan medan excel yang tidak terbaca: ditanyakan, bukan ditebak.
//
// Sama persis (tingkat 0) tetap menang walaupun ada saingan di tingkat 1 —
// orang yang mengetik "ST-100" lengkap dengan garisnya memang memaksudkan itu.
export function fotoPas(daftar, kode) {
  const h = cariPola(daftar, kode);
  if (!h.length || !h[0].pas) return null;
  if (h[0].tingkat === 0) {
    // Dua baris tidak bisa sama-sama tingkat 0: kodeKetat-nya identik berarti
    // kode-nya identik, dan `kode` itu primary key. Jadi ini sudah tunggal.
    return h[0];
  }
  // Tingkat 1: tolak kalau lebih dari satu baris sampai di situ.
  return h.filter(x => x.tingkat === 1).length === 1 ? h[0] : null;
}

// Kode pola yang bertabrakan setelah '-' dibuang. Dipakai layar/laporan untuk
// menunjukkan pasangan yang perlu dipastikan manusianya: betul dua tapak
// berbeda, atau salah satunya salah tulis.
export function polaAmbigu(daftar) {
  const peta = new Map();
  for (const p of daftar || []) {
    const k = p.kodePlus ?? padatPola(p.kode);
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(p.kode);
  }
  return [...peta.entries()].filter(([, v]) => v.length > 1)
    .map(([kunci, kode]) => ({ kunci, kode: kode.slice().sort() }));
}

// Menarik kode pola dari spec. Di portal ini kode pola ditulis di dalam kurung
// siku di ujung spec:  295/80R22.5-18PR(152-149M)[CR976A]
// Kurung siku full-width 【】 ikut, karena baris Mandarin memakai itu.
const KURUNG = /[\[【]\s*([^\]】]+?)\s*[\]】]\s*$/;
export function kodeDariSpec(spec) {
  const m = KURUNG.exec(String(spec ?? '').trim());
  return m ? m[1].trim() : '';
}
