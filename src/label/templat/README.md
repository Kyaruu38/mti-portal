# Templat artwork label

Satu templat = satu **tata letak** yang sudah DIUKUR dari artwork asli, bukan
ditebak. Isinya titik asal, lalu daftar medan dengan jarak `dX`/`dY` dari titik
asal itu, ukuran huruf dan fontnya.

## Templat dipilih lewat pasangan (pasar, KONSTRUKSI)

Bukan lewat ukuran lembar, dan bukan lewat ukuran label. Diuji pada 36 artwork
dari Drive (lihat `SURVEI-DRIVE.md`):

- **Ukuran lembar bukan kunci.** 36 berkas memakai 15 ukuran lembar berbeda,
  tapi lembar itu cuma kanvas ekspor. SNI di lembar 101×226 dan di lembar
  252×125 ternyata SATU templat: tiap medan cocok dalam ~0,4 mm.
- **Ukuran label juga bukan kunci.** BX TBR dan BX PCR labelnya sama persis
  (254×79) tapi balok medannya berbeda — `size` bergeser 4,2 mm, `ply`
  8,3 mm, dan ukuran huruf `made_in` 4,2 lawan 4,9.

Konstruksi yang muncul: **TBR, PCR, BIAS, OTR, ST**.

`items.label_size` tetap berguna sebagai pemeriksa silang (artwork mencetak
sendiri ukuran labelnya sebagai keterangan dimensi), dan ejaannya tetap harus
satu — lihat `supabase/sql/items_label_size_satu_ejaan.sql`.

## Yang sudah diukur

| berkas | pasar | konstruksi | label | sampel | sebar dY |
|---|---|---|---|---|---|
| `bx-tbr.json` | BX | TBR | 254×79 | 4 awal + **6 dari Drive, 4 merek** | **0,00 mm** |
| `pt-tbr.json` | PT | TBR | 261×111 | 4 artwork, 3 merek | ≤0,5 mm |
| `sni-tbr.json` | SNI | TBR | 220×95 | 3 awal + **5 dari Drive, 3 merek** | ≤1,1 mm |

Tiga templat ini menutup **20 dari 36 berkas sampel (56%)**.

## Yang belum ada

- PT `300x130mm` (17 baris), `300x100mm` (12), `110x280mm` (8), `90x280mm` (3),
  `180x100mm` (2), `130x300mm` (1)
- **BX PCR** — label 254×79 sama dengan BX TBR tapi baloknya BEDA. Punya 2 sampel.
- **PT ST** — label 220×80. Punya 1 sampel.
- **SNI BIAS**, **OEM TBR**, **OEM ST**, **OEM BIAS**, **OEM OTR** — belum ada.

### 22% artwork tidak punya lapisan teks sama sekali

8 dari 36 berkas sampel tidak bisa diukur lewat teks: hurufnya sudah
ter-outline jadi kurva (satu berkas punya 2.310 jalur vektor, nol blok teks),
atau seluruh artworknya diratakan jadi satu gambar raster. Yang paling
terdampak OEM — tiga OEM TBR dan tiga OEM ST di sampel semuanya begitu.

Untuk keluarga itu pengukuran lewat teks tidak mungkin; butuh jalur gambar.

Tiap templat baru butuh **3–4 artwork asli** dari stok itu. Bukan satu: dari
satu berkas tidak ada cara membedakan medan yang memang kaku dari medan yang
kebetulan ada di situ. Dua di antaranya sebaiknya MEREK YANG SAMA dengan isi
berbeda — itu yang membuktikan seluruh blok bergeser serempak, bukan per medan.

## Cara membuktikan sebuah blok kaku

Ukur tiap medan relatif ke titik asal di SETIAP berkas, lalu lihat SEBARANNYA.

- BX: dua WESTLAKE cuma beda geser serempak (+22,7 mm X, −3,6 mm Y)
- PT: dua WESTLAKE cuma beda titik asal (+4,54 mm X, +5,61 mm Y), dan seluruh
  offset relatifnya identik sampai 2 desimal
- SNI: paling tegas. Dua GOODRIDE **titik asalnya sama persis** (59,83 / 184,94)
  dan tiap medan cocok sampai 2 desimal; YARTU — merek ketiga — titik asalnya
  beda 0,02 dan 0,06 mm

### Jangkar yang baik adalah yang ISINYA TETAP

SNI memakai `LSPr-036-IDN` (kode lembaga sertifikasi) sebagai titik asal justru
karena teksnya tidak pernah berubah antar produk. Jangkar yang isinya
berubah-ubah ikut bergeser saat tulisannya memanjang, dan itu masuk ke sebaran
setiap medan lain sebagai derau.

## Teks diputar: ukur UJUNGNYA, bukan titik mulainya

Medan yang diputar 90° dan panjangnya ikut isi (`spec_spine`) titik mulainya
bergeser saat tulisannya memanjang. Yang stabil ujungnya:

| | sebar titik mulai | sebar titik ujung |
|---|---|---|
| `spec_spine` (PT) | 8,40 mm | **1,13 mm** |

Jadi medan itu dirender rata-kanan sepanjang sumbunya. Ini DIUKUR, bukan
diasumsikan — dan dikuatkan oleh TRAZANO dan YARTU yang `spec`-nya sama persis
(`325/95R24-22PR`) dan jatuh dalam 0,49 mm.

## Yang bukan teks

Logo merek, kode pola (mis. `DA23`), foto ban, ikon gandar dan batang barcode
adalah **vektor** di berkas aslinya. Tidak bisa dirender dari data; harus
diambil dari aset merek. Warna pun ikut merek (WESTLAKE hijau tua + oranye,
YARTU hitam + abu).

Proof untuk diperiksa manusia boleh memakai pendekatan font. Cetak produksi
tidak.

## EAN = `07216880` + nomor ITEM 5 digit

Terbukti di dua artwork (`34223` → `0721688034223`, `33202` → `0721688033202`),
digit ceknya sah di keduanya, dan 202 dari 204 EAN di basis data ikut pola yang
sama. Jadi medan `ITEM NO.` — yang tidak ada kolomnya di `items` — bisa
DITURUNKAN dari `items.ean`, bukan diminta lagi.

Dua yang tidak ikut pola adalah IRONMAN `688028986409` dan `688028986287`:
panjangnya 12, dan diperiksa keduanya **UPC-A yang sah** (UPC-A memang EAN-13
dengan nol di depan). Bukan data rusak — tapi perender harus menangani 12 digit
juga, bukan hanya 13.


## Arah perataan diukur, tidak diasumsikan

| templat | medan | sebar titik mulai | sebar titik ujung | kesimpulan |
|---|---|---|---|---|
| PT | `spec_spine` (putar) | 8,40 mm | **1,13 mm** | rata kanan |
| SNI | `spec_atas` (datar) | 0,97 mm | **0,34 mm** | rata kanan |
| SNI | `size`, `load_speed`, `pattern_besar` (putar) | **0,03–0,09 mm** | — | rata kiri |

Di SNI tiga medan putar itu panjangnya jelas berbeda antar berkas namun titik
mulainya identik, jadi rata-kiri bukan tebakan.

## Satu medan yang TIDAK bisa dihitung dari data

`pattern_besar` di templat SNI ukuran hurufnya 17,44 pada CR926 MAX dan EZ835,
tapi 20,01 pada EZ345 — padahal EZ345 dan EZ835 sama-sama lima huruf. Jadi
bukan auto-fit menurut panjang teks, melainkan disetel tangan per desain.

Proof harus menandai medan ini **perlu-periksa**, bukan diam-diam memakai salah
satu angka.

## Artwork juga sumber data, bukan cuma sumber tata letak

Nama berkas artwork memuat ERP, dan lapisan teks PDF-nya memuat nilai yang
tercetak. Untuk empat artwork SNI, `items` sudah benar pada `load_speed` dan
`pattern` — dan **kosong** pada `size`, `ply`, `tt_tl`, `ean`, `npb1`, `npb3`
dan `label_size`, yang semuanya ada di artworknya.

Dipanen lewat `label_master_panen` yang sama dengan `asal = 'ARTWORK-SNI-9NOV'`:
22 medan terisi, **0 tertimpa**, lalu dibaca ulang dan diadu medan per medan ke
artworknya — 21 dari 21 cocok.

`sni_no` TIDAK diisi: yang tercetak di artwork hanya logo SNI dan kode lembaga
sertifikasi, bukan nomor SNI produknya.
