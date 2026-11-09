# Jalur SULIH — untuk keluarga yang tidak punya templat

Survei 36 artwork (`SURVEI-DRIVE.md`) meninggalkan tujuh keluarga tanpa
templat. Mencoba mengukur templat untuk semuanya adalah jalan yang salah,
dan dua temuan menjelaskan kenapa.

## Temuan 1: OEM bukan satu lubang, tapi satu lubang per MEREK PELANGGAN

Artwork OEM adalah design **milik pelanggan**, bukan milik MTI. Dibandingkan
langsung:

| | HERCULES (OEM TBR) | TRAVELSTAR (OEM TBR) |
|---|---|---|
| tata letak | tulang punggung kiri diputar + panel putih | pita hitam atas + blok biru |
| warna | merah marun + oranye | hitam + biru |
| awalan EAN | `0721688` | **`810223`** |

Awalan EAN-nya saja sudah beda — itu nomor GS1 perusahaan lain. Jadi tidak
ada "templat OEM". Yang ada sebanyak merek pelanggannya, dan berubah kapan
pun pelanggannya mengubah designnya.

## Temuan 2: artwork tanpa lapisan teks TETAP bisa diukur

22% artwork sampel tidak punya teks sama sekali. Tapi yang hilang cuma
HURUFNYA, bukan geometrinya.

Yang ditemukan dari berkas aslinya: huruf yang di-outline **tidak** disimpan
satu jalur per huruf, melainkan digabung jadi **satu jalur majemuk per baris
teks** — satu jalur dengan ratusan segmen. Jadi kotak batas jalur itu SUDAH
kotak batas medannya.

`tools/label/ukur_outline.py` menyaringnya: banyak segmen (huruf punya
ratusan simpul; bingkai dan blok warna cuma 1-8) dan ukuran yang masuk akal
untuk teks. Pada satu artwork OEM tanpa teks sama sekali, itu mengembalikan
**59 medan** dengan koordinat dan tinggi persis.

Nama medannya tidak ikut terbaca — dan memang tidak perlu dibaca. Artworknya
dirender jadi gambar, dilihat, lalu tiap kotak hasil ukur diberi nama. Mesin
memberi geometri, manusia memberi nama.

## Jalannya: SULIH, bukan RAKIT ULANG

Untuk keluarga ini, merakit dari templat bukan cuma sulit — itu salah
sasaran. Yang berubah antar produk cuma segelintir medan; sisanya (logo,
peringatan, warna, tata letak pelanggan) harus tetap PERSIS.

Jadi: ambil artwork yang sudah ada, tutup kotak medan yang berubah pada
koordinat hasil ukur, tulis nilai barunya. `tools/label/sulih.py`.

Berlaku untuk artwork berteks MAUPUN yang sudah jadi kurva, karena
koordinatnya diukur dari geometrinya.

**Terbukti**: satu artwork OEM HERCULES dengan NOL lapisan teks, delapan
medan tersulih (nomor item, ukuran, indeks beban, pola — masing-masing di
panel dan di tulang punggung yang diputar). Logo, peringatan, warna dan tata
letak utuh.

### Ukuran huruf dipaskan, tidak ditebak

Diperkecil sampai muat kotaknya. Kalau sebuah medan tidak muat pada ukuran
terkecil yang masih terbaca, itu **dilaporkan, bukan dipaksakan** — nilai
yang terpotong di label lebih berbahaya daripada proof yang ditolak.

## Tiga hal yang BELUM beres, dan harus dibaca sebelum dipakai

1. **Salinan ganda.** Percobaan pertama meninggalkan `STRONG GUARD H-MW`
   yang basi di tulang punggung karena peta medannya cuma mencatat salinan
   yang di panel. Di artwork ini TIGA dari empat nilai muncul **dua kali**.
   Peta medan per keluarga harus mencatat SETIAP salinan; satu yang
   terlewat berarti label tercetak dengan dua nilai yang saling bertentangan.
   Ini ragam gagal yang paling berbahaya di jalur ini karena hasilnya
   kelihatan benar sekilas.

2. **Barcode belum dibuat ulang.** Proof masih membawa batang barcode lama.
   Angka dan batangnya harus digambar ulang dari `items.ean`.

3. **Huruf masih pendekatan.** Dipakai Helvetica-Bold, bukan huruf sempit
   miring milik artworknya. Cukup untuk proof yang diperiksa manusia; TIDAK
   cukup untuk cetak produksi.

## Pembagian kerja yang masuk akal

| | jalur | alasan |
|---|---|---|
| BX TBR, PT TBR, SNI TBR | **rakit dari templat** | design milik MTI, stabil, sudah terukur, sebar 0,00-1,1 mm |
| BX PCR, PT ST, SNI BIAS | rakit dari templat | masih design MTI, tinggal diukur kalau ada 3-4 sampel |
| semua OEM | **sulih** | design milik pelanggan, berubah di luar kendali MTI |

Artinya pertanyaan "butuh berapa templat lagi" terjawab: **tiga**, bukan
tujuh. Sisanya tidak butuh templat sama sekali.
