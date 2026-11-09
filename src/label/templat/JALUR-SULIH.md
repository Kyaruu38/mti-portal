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

## Salinan ganda: SUDAH otomatis — `tools/label/kembar.py`

Percobaan pertama meninggalkan `STRONG GUARD H-MW` yang basi di tulang
punggung karena peta medannya cuma mencatat salinan yang di panel. Di artwork
itu TIGA dari empat nilai muncul **dua kali**. Ini ragam gagal paling
berbahaya di jalur sulih: hasilnya kelihatan benar sekilas.

Teksnya tidak bisa dibaca, jadi salinan dicocokkan lewat **bentuknya**.

Jumlah simpul saja TIDAK CUKUP — diuji, dan dua teks berbeda bisa kebetulan
punya jumlah simpul sama (di artwork ini sebuah baris peringatan dan tulisan
merek yang diputar sama-sama 684 simpul). Jadi sesudah disaring lewat jumlah
simpul, bentuknya diadu titik per titik setelah dinormalkan ke kotak satuan,
**dicari lintas tiga ragam putaran**.

Kesalahan percobaan kedua dicatat juga: kedua salinan sempat "diluruskan"
dulu memakai tebakan arah yang sama, sehingga pasangan yang benar justru
tidak pernah bertemu. Sesudah diadu lintas-putaran, jarak pasangan yang benar
turun ke **0,0000–0,0009** sementara pasangan palsu tetap tertolak.

Hasilnya pada artwork OEM uji: pola, ukuran dan nomor item ketemu dua-dua
(panel + tulang punggung), pasangan palsu 684 ditolak.

## Barcode: SUDAH dibuat ulang — `tools/label/barcode.py`

EAN-13 dan UPC-A (UPC-A adalah EAN-13 dengan nol di depan, jadi lewat jalur
yang sama). Mendukung barcode yang dicetak memanjang ke bawah.

Diuji **bolak-balik**: pola 95 modul yang digambar DIBACA ULANG kembali jadi
angka. Enam kode diuji, semuanya kembali utuh; kode dengan digit cek salah
ditolak dengan pesan yang menyebut angka yang benar.

Pemeriksa silang yang berdiri sendiri: untuk item 98377 keluarannya
`688028983774`, **persis barcode yang tercetak di artwork aslinya** — padahal
HERCULES memakai awalan GS1 sendiri (688028), bukan 0721688 milik MTI. Jadi
aturan `awalan + nomor item 5 digit` berlaku lintas-perusahaan.

## Yang MASIH belum beres

**Huruf masih pendekatan.** Dipakai Helvetica-Bold, bukan huruf sempit miring
milik artworknya. Cukup untuk proof yang diperiksa manusia; TIDAK cukup untuk
cetak produksi. Ini satu-satunya lubang yang tersisa di jalur sulih.

## Pembagian kerja yang masuk akal

| | jalur | alasan |
|---|---|---|
| BX TBR, PT TBR, SNI TBR | **rakit dari templat** | design milik MTI, stabil, sudah terukur, sebar 0,00-1,1 mm |
| BX PCR, PT ST, SNI BIAS | rakit dari templat | masih design MTI, tinggal diukur kalau ada 3-4 sampel |
| semua OEM | **sulih** | design milik pelanggan, berubah di luar kendali MTI |

Artinya pertanyaan "butuh berapa templat lagi" terjawab: **tiga**, bukan
tujuh. Sisanya tidak butuh templat sama sekali.
