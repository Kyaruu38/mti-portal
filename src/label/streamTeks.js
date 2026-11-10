// MEMBUANG TEKS LAMA DARI ARTWORK, BUKAN MENIMPANYA.
//
// Menimpa dengan persegi punya dua cacat yang dua-duanya terbukti di back
// test: latar artworknya tidak putih, jadi persegi putih membolongi
// desainnya; dan yang lebih berbahaya, teks lamanya TETAP ADA di lapisan
// teks PDF-nya. Siapa pun yang menyalin teksnya -- atau alat prepress yang
// membacanya -- masih mendapat nomor sertifikat NPB yang lama, sementara
// gambarnya terlihat benar.
//
// Jadi glifnya dihapus dari sumbernya. Begitu hilang, tidak ada yang perlu
// ditutup, dan persoalan warna latar lenyap dengan sendirinya.
//
// BISA DILAKUKAN karena strukturnya terbuka: content stream artwork ini
// ter-inflate jadi operator PDF biasa, dan teksnya ada sebagai string
// harfiah yang didahului matriks penempatannya:
//
//     0 -36.1716 35.63 0 106.6602 520.8833 Tm (10.00R20)Tj
//
// Angka matriks itu SAMA PERSIS dengan transform yang dilaporkan pdfjs, jadi
// medan yang mau dibuang bisa ditemukan lewat matriksnya -- bukan lewat
// pencocokan teks, yang akan salah sasaran begitu nilai yang sama muncul
// dua kali dengan arti berbeda.
//
// YANG DIHAPUS CUMA ISI STRINGNYA, operatornya dibiarkan utuh:
//     (10.00R20)Tj   ->  ()Tj
//     [(CR9)0(26)]TJ ->  [()]TJ
// Membuang operatornya sendiri berisiko merusak keadaan grafis di
// belakangnya; mengosongkan stringnya tidak menggambar apa pun dan tetap sah.

const TOLERANSI = 0.05;   // poin, untuk mencocokkan angka matriks

async function inflate(bytes) {
  if (typeof DecompressionStream === 'function') {
    const ds = new DecompressionStream('deflate');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  const { inflateSync } = await import('node:zlib');
  return new Uint8Array(inflateSync(Buffer.from(bytes)));
}

const keLatin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; };
const dariLatin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };

/**
 * Mencari semua penempatan teks (Tm) beserta operator penampilnya.
 * @returns [{ tm:[a,b,c,d,e,f], mulaiString, akhirString, jenis:'Tj'|'TJ', teks }]
 */
export function bacaPenempatan(isi) {
  // PEMINDAI BERURUTAN, bukan pencocokan pola per Tm.
  //
  // Percobaan pertama mencari "Tm lalu penampil teks terdekat" dan cuma
  // menemukan 10 dari 18 tulisan. Sebabnya: satu Tm sering dipakai oleh
  // BEBERAPA tulisan yang digeser dengan Td/TD/T*, jadi yang ketemu hanya
  // tulisan pertama di tiap blok. Medan yang terlewat tidak akan terbuang,
  // dan nilai lamanya tetap tercetak di bawah yang baru.
  //
  // Jadi keadaan teksnya diikuti: Tm menetapkan matriks, Td/TD/T* menggeser
  // di ruang teks, dan tiap penampil teks mencatat posisi EFEKTIFnya sendiri.
  //
  // MATRIKS GAMBARNYA, BUKAN Tm MENTAHNYA. Ini yang membuat 15 dari 19 blangko
  // pertama masih membawa teks lama. pdf.js melaporkan matriks GABUNGAN
  // (Tm x CTM, sudah termasuk skala hurufnya); pemindai ini dulu melaporkan
  // angka Tm apa adanya. Di artwork GOODRIDE keduanya sama persis -- CTM-nya
  // identitas -- jadi jalur sulih terbukti benar di sana dan tidak ada yang
  // menunjukkan ada yang kurang. Begitu artworknya memakai `cm` (YARTU,
  // CHAOYANG, WESTLAKE, dan selusin lagi), angkanya tidak pernah cocok, tidak
  // ada glif yang terbuang, dan yang tertinggal data ban asalnya.
  //
  // Jadi q/Q/cm diikuti seperti penerjemah PDF sungguhan, dan tiap penempatan
  // membawa matriks efektifnya. Skala huruf (Tf) dibawa terpisah: sebagian
  // artwork memanggang ukurannya ke dalam Tm dengan Tf 1, sebagian memakai Tf
  // sungguhan, dan pencocoknya menerima keduanya.
  // ISI LARIK TJ DIBATASI ANGKA DAN STRING SAJA.
  //
  // Polanya dulu \[[\s\S]*?\] -- malas, tapi tetap menerima APA SAJA di
  // dalamnya. Di artwork BX, `[` bisa muncul jauh sebelum `]TJ` milik larik
  // yang sebenarnya, jadi satu potongan membentang melewati operator lain.
  // Yang terpotong bukan cuma teks datanya: logo WEST LAKE, pita ALL STEEL
  // TUBELESS, MADE IN INDONESIA dan separuh kata 'Prepared' ikut hilang dari
  // blangkonya. Ketahuan dari GAMBAR hasilnya, bukan dari angka -- angkanya
  // malah terlihat sehat: '13 medan dibuang'.
  //
  // Larik TJ menurut spec cuma berisi angka dan string, jadi itu yang
  // diizinkan. Larik yang berisi hal lain tidak akan cocok sama sekali, dan
  // tidak cocok jauh lebih aman daripada memotong kelebihan.
  const out = [];
  let tm = null, tx = 0, ty = 0, leading = 0, ukuran = 1;
  let ctm = [1, 0, 0, 1, 0, 0];
  const tumpukan = [];
  const kali = (A, B) => [
    A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3],
    A[4] * B[0] + A[5] * B[2] + B[4], A[4] * B[1] + A[5] * B[3] + B[5],
  ];
  const re = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)|(-?[\d.]+)\s+TL|(T\*)|(BT)|(ET)|(?:\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)\s*(Tj|')|\[(?:\s|-?[\d.]+|\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)*\]\s*(TJ)|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm|(q)[\s]|(Q)[\s]|\/[^\s/]+\s+(-?[\d.]+)\s+Tf/g;
  let m;
  while ((m = re.exec(isi)) !== null) {
    if (m[1] !== undefined) {                    // Tm
      tm = m.slice(1, 7).map(Number); tx = 0; ty = 0; continue;
    }
    if (m[7] !== undefined) {                    // Td / TD
      tx += Number(m[7]); ty += Number(m[8]);
      if (m[9] === 'TD') leading = -Number(m[8]);
      continue;
    }
    if (m[10] !== undefined) { leading = Number(m[10]); continue; }   // TL
    if (m[11]) { ty -= leading; continue; }                           // T*
    // BT MENYETEL MATRIKS TEKS JADI IDENTITAS, bukan mengosongkannya.
    //
    // Versi sebelumnya menyetelnya null dan baru mengisinya kalau ketemu Tm.
    // Di artwork BX, teksnya diposisikan dengan Td saja tanpa satu pun Tm --
    // itu sah menurut spec, karena BT sudah menyetel Tm jadi identitas. Yang
    // terjadi: pemindai membaca NOL penempatan di stream yang punya 38 blok
    // BT, jadi tidak ada glif yang bisa dibuang sama sekali. Seluruh keluarga
    // BX dan PT gagal karena satu baris ini.
    if (m[12]) { tm = [1, 0, 0, 1, 0, 0]; tx = 0; ty = 0; continue; }  // BT
    if (m[13]) { tm = null; continue; }                               // ET
    if (m[16] !== undefined) { ctm = kali(m.slice(16, 22).map(Number), ctm); continue; }  // cm
    if (m[22]) { tumpukan.push(ctm.slice()); continue; }                                  // q
    if (m[23]) { ctm = tumpukan.pop() || [1, 0, 0, 1, 0, 0]; continue; }                  // Q
    if (m[24] !== undefined) { ukuran = Number(m[24]); continue; }                        // Tf
    // penampil teks
    const jenis = m[14] || m[15];
    if (!jenis || !tm) continue;
    const potongan = m[0];
    // Posisi efektif = matriks teks digeser oleh Td/TD yang terkumpul.
    const e = tm[4] + tm[0] * tx + tm[2] * ty;
    const f = tm[5] + tm[1] * tx + tm[3] * ty;
    const digeser = [tm[0], tm[1], tm[2], tm[3], e, f];
    const efektif = kali(digeser, ctm);
    const berukuran = kali([ukuran, 0, 0, ukuran, 0, 0], efektif);
    out.push({
      tm: efektif,
      tmMentah: digeser,
      tmBerukuran: berukuran,
      jenis: jenis === "'" ? 'Tj' : jenis,
      mulai: m.index, akhir: m.index + potongan.length,
      potongan,
      teks: (potongan.match(/\((?:\\.|[^\\)])*\)/g) || [])
        .map(x => x.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''),
    });
  }
  return out;
}

// Dicocokkan ke matriks efektif ATAU ke matriks efektif yang sudah dikali
// ukuran hurufnya: artwork yang memanggang ukurannya ke dalam Tm (Tf 1) dan
// artwork yang memakai Tf sungguhan dua-duanya dilaporkan pdf.js dengan angka
// akhir yang sama, tapi di streamnya ditulis berbeda.
const samaMatriks = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= TOLERANSI);
const cocokTm = (p, b) => samaMatriks(p.tm, b)
  || (p.tmBerukuran && samaMatriks(p.tmBerukuran, b))
  || (p.tmMentah && samaMatriks(p.tmMentah, b));

/**
 * Mengosongkan isi string pada penempatan yang matriksnya cocok.
 * @param {Uint8Array} streamTerdekompresi
 * @param {Array<number[]>} daftarTm  matriks medan yang mau dibuang
 * @returns {{ isi:Uint8Array, dibuang:number, takKetemu:number[][] }}
 */
export function buangTeks(isiStr, daftarTm) {
  const tempat = bacaPenempatan(isiStr);
  const sasaran = [];
  const takKetemu = [];
  for (const tm of daftarTm) {
    const t = tempat.find(p => cocokTm(p, tm));
    if (t) sasaran.push(t); else takKetemu.push(tm);
  }
  // SATU POSISI HANYA BOLEH DIPOTONG SEKALI.
  //
  // Daftar tm yang masuk bisa memuat penempatan yang SAMA dua kali --
  // pencarian salinan ganda mengembalikan kemunculan lain dari nilai yang
  // sama, dan kalau penyaring "kecuali yang ini" meleset sedikit, yang asli
  // ikut terbawa. Memotong posisi yang sama dua kali membuat potongan kedua
  // memakai indeks yang sudah basi, dan streamnya rusak di tengah: Tm
  // kehilangan angkanya dan PDF-nya tidak bisa dibaca lagi.
  //
  // Back test menemukannya sebagai 'Tm: expected 6 args, received 2'.
  const unik = [];
  const dipakai = new Set();
  for (const s of sasaran) {
    if (dipakai.has(s.mulai)) continue;
    dipakai.add(s.mulai);
    unik.push(s);
  }
  // Dikerjakan dari BELAKANG supaya indeks yang di depannya tidak bergeser.
  unik.sort((a, b) => b.mulai - a.mulai);
  // Tumpang tindih juga ditolak: dua penempatan yang rentangnya beririsan
  // tidak mungkin keduanya benar, dan memotong keduanya merusak stream.
  let hasil = isiStr, batasBawah = Infinity, dipotong = 0;
  for (const s of unik) {
    if (s.akhir > batasBawah) continue;
    // Dikosongkan MENURUT JENIS STRINGNYA. Artwork BX menulis teksnya sebagai
    // string heksadesimal <0048...>; menggantinya dengan () tetap sah, tapi
    // mengganti dengan <> membuat berkasnya tetap seragam dengan aslinya.
    const heks = /^</.test(s.potongan.trim());
    const kosong = heks ? '<>' : '()';
    const bersih = s.jenis === 'Tj' ? kosong + 'Tj' : '[' + kosong + ']TJ';
    hasil = hasil.slice(0, s.mulai) + bersih + hasil.slice(s.akhir);
    batasBawah = s.mulai;
    dipotong++;
  }
  return { isi: hasil, dibuang: dipotong, takKetemu };
}

/**
 * Mengambil content stream halaman pertama sebagai teks, sudah ter-inflate.
 */
export async function ambilIsi(doc, pdfLib) {
  const pg = doc.getPage(0);
  const c = pg.node.Contents();
  const refs = c && c.constructor && c.constructor.name === 'PDFArray' ? c.asArray() : [c];
  let gabung = '';
  const sumber = [];
  for (const ref of refs) {
    const s = doc.context.lookup(ref);
    if (!s || !s.getContents) continue;
    const mentah = s.getContents();
    let teks;
    try { teks = keLatin1(await inflate(mentah)); }
    catch { teks = keLatin1(mentah); }          // sebagian PDF tidak terkompresi
    sumber.push({ ref, panjang: teks.length });
    gabung += teks;
  }
  return { isi: gabung, refs, sumber };
}

/**
 * Menulis kembali content stream, TANPA kompresi.
 *
 * Sengaja tidak dikompres ulang: itu menghindari ketergantungan pada pustaka
 * deflate di browser, dan berkasnya memang jadi lebih besar -- yang untuk
 * sebuah proof bukan harga yang mahal dibanding nomor sertifikat lama yang
 * masih bisa disalin dari berkasnya.
 */
export function tulisIsi(doc, pdfLib, isiBaru) {
  const { PDFName, PDFRawStream, PDFDict } = pdfLib;
  const pg = doc.getPage(0);
  const data = dariLatin1(isiBaru);
  const dict = PDFDict.withContext(doc.context);
  dict.set(PDFName.of('Length'), doc.context.obj(data.length));
  const stream = PDFRawStream.of(dict, data);
  const ref = doc.context.register(stream);
  pg.node.set(PDFName.of('Contents'), ref);
  return data.length;
}

// ---------------------------------------------------------------------------
// BAGIAN ISI: content stream halaman DAN Form XObject di dalamnya.
//
// KENAPA INI ADA, DAN KENAPA ambilIsi() SAJA TIDAK CUKUP.
//
// ambilIsi() cuma membaca Contents halaman. Di artwork GOODRIDE itu memang
// seluruh isinya, jadi jalur sulih terbukti benar di sana dan tidak ada yang
// menunjukkan ada yang kurang. Begitu panen dijalankan ke 19 merek, 15 di
// antaranya meninggalkan teks lama di blangkonya.
//
// Sebabnya: sebagian designer menaruh blok teksnya di FORM XOBJECT -- stream
// terpisah yang dipanggil halaman lewat operator Do. pdf.js tetap melaporkan
// teksnya (dia merender semuanya), jadi medannya KETEMU dan kotaknya benar;
// yang tidak ketemu matriksnya, karena matriksnya tidak ada di stream
// halaman. Di artwork YARTU: 11 blok BT di halaman, 24 potongan teks terbaca.
// Tiga belas potongan itu ada di XObject.
//
// Akibatnya bukan cuma blangko kotor. Di jalur sulih portal, medan yang
// glifnya gagal dibuang akan DITIMPA persegi penutup -- dan karena latar
// artworknya tidak putih, penutupnya membolongi design. Jadi ini memperbaiki
// dua hal sekaligus.
//
// Tiap bagian disunting DI TEMPATNYA SENDIRI. Menggabung semuanya jadi satu
// string seperti ambilIsi() tidak bisa dipakai di sini: offset hasil
// potongannya harus kembali ke stream asalnya, dan XObject tidak boleh
// dilebur ke dalam halaman -- dia dipanggil dari tempat lain juga.
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<Array<{jenis:'halaman'|'xobject', nama:string, ref:any, isi:string}>>}
 */
export async function ambilBagian(doc, pdfLib, { halaman = 0 } = {}) {
  const { PDFName } = pdfLib;
  const pg = doc.getPage(halaman);
  const bagian = [];
  const sudah = new Set();

  const bacaStream = async (ref) => {
    const s = doc.context.lookup(ref);
    if (!s || !s.getContents) return null;
    const mentah = s.getContents();
    try { return keLatin1(await inflate(mentah)); }
    catch { return keLatin1(mentah); }
  };

  // DIAMBIL SEBAGAI RUJUKAN, BUKAN SEBAGAI OBJEKNYA. pg.node.Contents()
  // mengembalikan stream yang sudah ditelusuri; menulis balik ke situ berarti
  // memanggil context.assign() dengan objek, bukan nomor objek, dan tabel
  // silang PDF-nya rusak tanpa pesan yang menyebut sebabnya.
  const cRaw = pg.node.get(PDFName.of('Contents'));
  const cNyata = doc.context.lookup(cRaw);
  const refs = cNyata && cNyata.constructor && cNyata.constructor.name === 'PDFArray'
    ? cNyata.asArray() : [cRaw];
  for (const ref of refs) {
    if (!ref) continue;
    const isi = await bacaStream(ref);
    if (isi != null) bagian.push({ jenis: 'halaman', nama: 'Contents', ref, isi });
  }

  // XObject ditelusuri sampai dua tingkat. Lebih dalam dari itu belum pernah
  // ditemui di 19 artwork yang dipanen, dan menelusuri tanpa batas pada berkas
  // yang saling menunjuk akan berputar selamanya.
  const telusuri = async (res, dalam) => {
    if (!res || !res.lookup || dalam > 2) return;
    const xo = res.lookup(PDFName.of('XObject'));
    if (!xo || !xo.keys) return;
    for (const k of xo.keys()) {
      const ref = xo.get(k);
      const kunci = String(ref);
      if (sudah.has(kunci)) continue;
      sudah.add(kunci);
      const s = doc.context.lookup(ref);
      if (!s || !s.getContents) continue;
      // Cuma Form XObject yang punya operator teks; Image XObject isinya piksel.
      const sub = s.dict && s.dict.lookup ? s.dict.lookup(PDFName.of('Subtype')) : null;
      if (sub && String(sub) !== '/Form') continue;
      const isi = await bacaStream(ref);
      if (isi != null) bagian.push({ jenis: 'xobject', nama: k.asString ? k.asString() : String(k), ref, isi });
      const subRes = s.dict && s.dict.lookup ? s.dict.lookup(PDFName.of('Resources')) : null;
      await telusuri(subRes, dalam + 1);
    }
  };
  await telusuri(pg.node.Resources(), 0);

  return bagian;
}

/**
 * Membuang glif pada daftar matriks, di SELURUH bagian. Tiap bagian dipotong
 * dengan buangTeks() yang sudah ada, jadi aturan dedupe dan penolakan rentang
 * bertumpuk tetap berlaku apa adanya.
 */
export function buangDiBagian(bagian, daftarTm) {
  const sisa = new Set(daftarTm.map(t => JSON.stringify(t)));
  let dibuang = 0;
  const hasil = [];
  for (const b of bagian) {
    const mau = daftarTm.filter(t => sisa.has(JSON.stringify(t)));
    if (!mau.length) { hasil.push({ ...b, berubah: false }); continue; }
    const r = buangTeks(b.isi, mau);
    dibuang += r.dibuang;
    // Yang BERHASIL dibuang di bagian ini tidak perlu dicari lagi di bagian
    // lain. Yang tidak ketemu di sini masih mungkin ada di bagian berikutnya.
    const takKetemuDiSini = new Set(r.takKetemu.map(t => JSON.stringify(t)));
    for (const t of mau) {
      const k = JSON.stringify(t);
      if (!takKetemuDiSini.has(k)) sisa.delete(k);
    }
    hasil.push({ ...b, isi: r.isi, berubah: r.dibuang > 0 });
  }
  return { bagian: hasil, dibuang, takKetemu: [...sisa].map(s => JSON.parse(s)) };
}

/** Menulis kembali tiap bagian yang berubah, di tempatnya sendiri. */
export function tulisBagian(doc, pdfLib, bagian) {
  const { PDFName, PDFRawStream, PDFDict } = pdfLib;
  let ditulis = 0;
  for (const b of bagian) {
    if (!b.berubah) continue;
    const data = dariLatin1(b.isi);
    const lama = doc.context.lookup(b.ref);
    const dict = PDFDict.withContext(doc.context);
    // Kunci lain stream aslinya DIBAWA, karena Form XObject menyimpan BBox,
    // Matrix dan Resources di dict yang sama. Membuang salah satunya berarti
    // XObject itu tidak bisa digambar lagi — halamannya jadi kosong di bagian
    // itu, dan yang hilang bagian designnya.
    if (lama && lama.dict && lama.dict.keys) {
      for (const k of lama.dict.keys()) {
        const nama = k.asString ? k.asString() : String(k);
        if (nama === '/Length' || nama === '/Filter' || nama === '/DecodeParms') continue;
        dict.set(k, lama.dict.get(k));
      }
    }
    dict.set(PDFName.of('Length'), doc.context.obj(data.length));
    const stream = PDFRawStream.of(dict, data);
    // Objeknya DITIMPA di nomor yang sama, bukan didaftarkan sebagai objek
    // baru: XObject dipanggil lewat nama di Resources, dan kalau objek baru
    // yang dibuat, yang dipanggil tetap yang lama.
    // Hanya rujukan yang bisa ditimpa. Kalau yang terbawa objeknya langsung
    // (PDF yang menaruh Contents sebagai stream sebaris), bagian itu DILEWATI
    // dan dilaporkan lewat nilai kembaliannya — lebih baik satu bagian tidak
    // tersunting daripada berkas yang tabel silangnya rusak.
    if (!b.ref || typeof b.ref.objectNumber !== 'number') continue;
    doc.context.assign(b.ref, stream);
    ditulis++;
  }
  return ditulis;
}
