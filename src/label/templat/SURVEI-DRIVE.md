# Survei 36 artwork dari Drive — 9 Nov 2026

Sampel bertingkat dari 630 design yang terindeks di `designs.drive_url`:
10 per pasar (BX, OEM, PT, SNI), diunduh lewat Chrome dan diukur satu per satu.

Dua anggapan awal **salah**, dan dua-duanya memperbesar pekerjaan kalau tidak
ketahuan sekarang.

## SALAH 1: "ukuran stok label adalah kunci templat"

36 berkas memakai **15 ukuran lembar berbeda**. Kalau lembar jadi kunci,
berarti 15+ templat.

Tapi lembar itu cuma **kanvas ekspor**, bukan labelnya. Artwork mencetak
sendiri ukuran label yang sebenarnya sebagai keterangan dimensi di tepinya:

| lembar | keterangan label | pasar |
|---|---|---|
| 252×125, 275×155 | **220×95** | SNI TBR |
| 210×297 | **254×79** | BX TBR dan BX PCR |
| 297×210 | **261×111** | PT TBR |

SNI 101×226 dan SNI 252×125 ternyata **satu templat yang sama**: tiap medan
cocok dalam ~0,4 mm (npb1 +10,45 lawan +10,29; konstruksi −142,11 lawan
−142,15; size −142,70 lawan −142,34). Yang berubah cuma lembar di sekitarnya.

Cocok silang yang berdiri sendiri: lembar order BX bernama
`DETAIL_NEW_ITEM_BRANSALES_254X79mm.xlsx`, dan enam artwork BX mencetak
`254 mm` dengan sebaran **0,00 mm**.

## SALAH 2: "satu pasar, satu templat"

BX TBR dan BX PCR **ukuran labelnya sama persis (254×79) tapi balok
medannya BERBEDA**:

| medan | BX TBR | BX PCR |
|---|---|---|
| `made_in` ukuran huruf | 4,2 | **4,9** |
| `size` | dY −38,5 dX −7,1 | **dY −42,7 dX −6,5** |
| `ply` | dY +108,1 dX +25,6 | **dY +116,4 dX +28,5** |
| `lebar_label` | dY +48,2 | **dY +56,2** |

Jadi kunci templat adalah **(pasar, konstruksi)**, dan ukuran label adalah
sifatnya, bukan kuncinya. Konstruksi yang muncul di sampel: TBR, PCR, BIAS,
OTR, ST.

## Kekakuan yang terbukti

| keluarga | sampel | merek berbeda | sebar dY | templat |
|---|---|---|---|---|
| BX TBR | 6 | 4 (TKV, WL, YR, NIPON) | **0,00 mm** | `bx-tbr.json` |
| SNI TBR | 5 | 3 (TN, CY, YR) | ≤1,1 mm | `sni-tbr.json` |
| PT TBR | 4 | 3 (WL, TN, YR) | ≤0,5 mm | `pt-tbr.json` |
| BX PCR | 2 | 1 | 0,00 mm | belum |

## 22% artwork TIDAK PUNYA LAPISAN TEKS

8 dari 36 berkas tidak bisa diukur lewat teks sama sekali, dan ada dua
ragamnya:

- **Ter-outline jadi kurva** — hurufnya jadi jalur vektor. d31 punya 2.310
  jalur, d33 851, d21 132, d19 102. Nol blok teks.
- **Diratakan jadi raster** — seluruh artwork jadi satu gambar tertanam.
  d22 dan d15.

Untuk keluarga ini pengukuran lewat teks tidak mungkin; butuh jalur gambar.
Yang paling terdampak **OEM**: tiga OEM TBR dan tiga OEM ST di sampel
semuanya tanpa teks.

## Keadaan per keluarga

| pasar | konstruksi | di sampel | templat |
|---|---|---|---|
| BX | TBR | 6 | ✅ |
| BX | PCR | 2 | ❌ blok beda dari TBR |
| PT | TBR | 7 | ✅ (5 di antaranya tanpa keterangan dimensi) |
| PT | ST | 1 | ❌ label 220×80 |
| SNI | TBR | 7 | ✅ |
| SNI | BIAS | 2 | ❌ |
| OEM | TBR | 3 | ❌ semua tanpa lapisan teks |
| OEM | ST | 3 | ❌ semua tanpa lapisan teks |
| OEM | BIAS | 1 | ❌ |
| OEM | OTR | 1 | ❌ lembar 90×60 |

Tiga templat yang ada menutup **20 dari 36 berkas sampel (56%)**.
