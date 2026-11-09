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
  const out = [];
  let tm = null, tx = 0, ty = 0, leading = 0;
  const re = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)|(-?[\d.]+)\s+TL|(T\*)|(BT)|(ET)|\((?:\\.|[^\\)])*\)\s*(Tj|')|\[[\s\S]*?\]\s*(TJ)/g;
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
    if (m[12]) { tm = null; tx = 0; ty = 0; continue; }               // BT
    if (m[13]) { tm = null; continue; }                               // ET
    // penampil teks
    const jenis = m[14] || m[15];
    if (!jenis || !tm) continue;
    const potongan = m[0];
    // Posisi efektif = matriks teks digeser oleh Td/TD yang terkumpul.
    const e = tm[4] + tm[0] * tx + tm[2] * ty;
    const f = tm[5] + tm[1] * tx + tm[3] * ty;
    out.push({
      tm: [tm[0], tm[1], tm[2], tm[3], e, f],
      jenis: jenis === "'" ? 'Tj' : jenis,
      mulai: m.index, akhir: m.index + potongan.length,
      potongan,
      teks: (potongan.match(/\((?:\\.|[^\\)])*\)/g) || [])
        .map(x => x.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''),
    });
  }
  return out;
}

const cocokTm = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= TOLERANSI);

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
    const t = tempat.find(p => cocokTm(p.tm, tm));
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
    const bersih = s.jenis === 'Tj' ? '()Tj' : '[()]TJ';
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
