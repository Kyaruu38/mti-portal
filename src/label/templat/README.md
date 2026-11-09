# Templat artwork label

Satu templat = satu **tata letak** yang sudah DIUKUR dari artwork asli, bukan
ditebak. Isinya titik asal, lalu daftar medan dengan jarak `dX`/`dY` dari titik
asal itu, ukuran huruf dan fontnya.

## Templat dipilih lewat pasangan (pasar, ukuran stok label)

Bukan lewat pasar saja. Satu pasar memakai lebih dari satu ukuran stok, dan
ukuran stok yang berbeda adalah tata letak yang berbeda — bukan versi lebih
besar dari tata letak yang sama. PT saja punya tujuh ukuran stok.

Karena itu `items.label_size` harus satu ejaan (lihat
`supabase/sql/items_label_size_satu_ejaan.sql`): `261X111mm` dan `261x111mm`
yang terhitung dua kunci berarti satu di antaranya tidak menemukan templat.

## Yang sudah diukur

| berkas | pasar | stok | lembar | sumber |
|---|---|---|---|---|
| `bx-a4-tegak.json` | BX | — | A4 **tegak** 210×297 | 4 artwork: CHAOYANG EZ573, WESTLAKE WSA2, WESTLAKE AT161, YARTU AD528 |
| `pt-261x111.json` | PT | 261×111 mm | A4 **mendatar** 297×210 | 4 artwork: WESTLAKE DA23, TRAZANO AZ691, YARTU AZ828, WESTLAKE AZ599 |

## Yang belum ada

- PT `300x130mm` (17 baris), `300x100mm` (12), `110x280mm` (8), `90x280mm` (3),
  `180x100mm` (2), `130x300mm` (1)
- SNI — belum pernah diukur sama sekali, padahal datanya yang paling lengkap
  (125 baris punya ean + sni_no + npb3 + size + ply + tt)
- OEM — belum pernah diukur

Tiap templat baru butuh **3–4 artwork asli** dari stok itu. Bukan satu: dari
satu berkas tidak ada cara membedakan medan yang memang kaku dari medan yang
kebetulan ada di situ. Dua di antaranya sebaiknya MEREK YANG SAMA dengan isi
berbeda — itu yang membuktikan seluruh blok bergeser serempak, bukan per medan.

## Cara membuktikan sebuah blok kaku

Ukur tiap medan relatif ke titik asal di SETIAP berkas, lalu lihat SEBARANNYA.

- BX: dua WESTLAKE cuma beda geser serempak (+22,7 mm X, −3,6 mm Y)
- PT: dua WESTLAKE cuma beda titik asal (+4,54 mm X, +5,61 mm Y), dan seluruh
  offset relatifnya identik sampai 2 desimal

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
