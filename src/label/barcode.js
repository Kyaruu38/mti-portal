// EAN-13 / UPC-A: pola batang dihitung dari kode, bukan diambil dari gambar.
//
// Kenapa ini ada di sini dan bukan dipinjam dari pustaka: artwork yang
// disulih membawa barcode LAMA kalau barcodenya tidak ikut digambar ulang,
// dan barcode lama jauh lebih berbahaya daripada tidak ada barcode sama
// sekali -- angka di bawah batangnya sudah benar, batangnya belum, dan tidak
// ada manusia yang memeriksa itu dengan mata.
//
// UPC-A adalah EAN-13 dengan nol di depan, jadi keduanya lewat jalur yang
// sama dan cuma berbeda cara menuliskan angkanya.

const L = ['0001101','0011001','0010011','0111101','0100011',
           '0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101',
           '0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100',
           '1001110','1010000','1000100','1001000','1110100'];
const PARITAS = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG',
                 'LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

export function digitCek(d12) {
  const n = String(d12).slice(0, 12).split('').map(Number);
  if (n.length !== 12 || n.some(Number.isNaN)) return null;
  const j = n.reduce((a, d, i) => a + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (j % 10)) % 10;
}

// Mengembalikan { kode, pola } atau MELEMPAR dengan sebab yang bisa dibaca.
//
// Sengaja melempar, bukan mengembalikan null: kode yang digit ceknya salah
// berarti datanya salah, dan menggambar batang apa pun di atas data yang
// salah cuma memindahkan kesalahannya ke tempat yang lebih sulit dilihat.
export function pola(kode) {
  let k = String(kode == null ? '' : kode).replace(/\D/g, '');
  if (k.length === 12 && digitCek(k.slice(0, 12)) !== Number(k[11])) k = '0' + k;
  else if (k.length === 12) k = '0' + k;
  if (k.length !== 13) throw new Error(`panjang kode ${k.length}, bukan 12 atau 13`);
  const cek = digitCek(k.slice(0, 12));
  if (cek !== Number(k[12])) {
    throw new Error(`digit cek salah: hitung ${cek}, tertulis ${k[12]}`);
  }
  const par = PARITAS[Number(k[0])];
  let s = '101';
  for (let i = 0; i < 6; i++) s += (par[i] === 'L' ? L : G)[Number(k[1 + i])];
  s += '01010';
  for (let i = 7; i < 13; i++) s += R[Number(k[i])];
  return { kode: k, pola: s + '101' };
}

// MEMBACA BALIK pola jadi angka. Dipakai ujinya untuk membuktikan bahwa yang
// digambar memang kode yang diminta -- bukan sekadar bahwa penggambarannya
// tidak melempar error.
export function bacaBalik(s) {
  if (typeof s !== 'string' || s.length !== 95) return null;
  if (s.slice(0, 3) !== '101' || s.slice(-3) !== '101' || s.slice(45, 50) !== '01010') return null;
  let par = '', kd = '';
  for (let i = 0; i < 6; i++) {
    const b = s.slice(3 + 7 * i, 10 + 7 * i);
    const li = L.indexOf(b), gi = G.indexOf(b);
    if (li >= 0) { par += 'L'; kd += li; }
    else if (gi >= 0) { par += 'G'; kd += gi; }
    else return null;
  }
  const d0 = PARITAS.indexOf(par);
  if (d0 < 0) return null;
  for (let i = 0; i < 6; i++) {
    const b = s.slice(50 + 7 * i, 57 + 7 * i);
    const ri = R.indexOf(b);
    if (ri < 0) return null;
    kd += ri;
  }
  return String(d0) + kd;
}

// Geometri batang dalam MILIMETER, relatif terhadap sudut kiri-atas barcode.
// Tidak menggambar apa pun sendiri: yang menggambar adalah perender, dan
// memisahkan keduanya membuat bagian yang menghitung bisa diuji tanpa PDF.
//
// putar=true untuk barcode yang dicetak memanjang ke bawah (batang mendatar).
export function batang(kode, { lebar, tinggi, putar = false } = {}) {
  const { kode: k, pola: s } = pola(kode);
  const X = lebar / 95;
  const zona = tinggi * 0.14;          // ruang untuk angka di bawah batang
  const out = [];
  for (let i = 0; i < 95; i++) {
    if (s[i] !== '1') continue;
    // batang penjaga memanjang melewati zona angka
    const penjaga = i < 3 || i >= 92 || (i >= 45 && i < 50);
    const p = tinggi - (penjaga ? 0 : zona);
    // `panjang` dan `penjaga` disertakan SECARA EKSPLISIT, bukan dibiarkan
    // disimpulkan dari l/t. Tanpa itu pemanggilnya harus tahu bahwa sumbu
    // panjang batang BERPINDAH saat diputar -- l waktu diputar, t waktu
    // tidak -- dan pengetahuan seperti itu yang akan salah dipakai suatu
    // hari, di tempat yang jauh dari sini. Ujinya menemukan ini.
    out.push(putar
      ? { x: 0, y: i * X, l: p, t: X, panjang: p, tebal: X, penjaga }
      : { x: i * X, y: 0, l: X, t: p, panjang: p, tebal: X, penjaga });
  }
  return {
    kode: k, pola: s, modul: X, zonaAngka: zona, batang: out,
    angka: [
      { teks: k[0],          dari: -9 * X, sampai: -1 * X },
      { teks: k.slice(1, 7), dari:  3 * X, sampai: 45 * X },
      { teks: k.slice(7),    dari: 50 * X, sampai: 92 * X },
    ],
  };
}
