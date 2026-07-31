# PPKEK — hasil bongkar sample asli (31 Juli 2026)

Sample: `PPKEK SPPB 010259 GOSUBKK80466109 26ID09962.rar` (RAR5, 10 file).
Semua di bawah ini dibaca dari file aslinya, bukan dugaan.

---

## 1. YANG DIMAU KYARU

Drop ZIP/RAR ke portal → file naik ke Drive → datanya kecatat otomatis ke Excel
dengan bentuk `PPKEK DECEMBER.xlsx` (2 tab LDP/TLDDP, **satu baris per BARANG**,
22 kolom).

Rangkanya sudah ada. Yang kurang ada tiga, dan urutannya penting.

---

## 2. KENAPA SEKARANG SALAH

### 2a. Supplier kebaca "Pemasok" — regex nangkep judul kolom

`src/parsers/ppkekPdf.js:48`

```js
out.supplier = grab(/(?:Pemasok|Supplier|Penjual|Seller)[^\n:：]*[:：]?\s*([A-Z][A-Za-z0-9 .,&()\-]{3,})/);
```

Teks PPKEK halaman 1:

```
15| 2. Eksportir LN/Penjual        3. Pemasok        <- baris JUDUL KOLOM
22| c. Nama : NIPPON SEIRO (THAILAND)  c. Nama :
24| CO., LTD. LTD.
```

Regex nemu `Penjual` di baris 15, lewatin ` 3. `, nangkep `Pemasok`. Itu judul
kolom sebelahnya. Nama aslinya di baris 22+24, kepecah dua.

Formulir PPKEK itu **3 kolom digepengin jadi baris teks** — kelas masalah yang
sama persis dengan PDF INCLUSION.

### 2b. Nilai IDR kebaca 1 — angka aslinya ada, cuma polanya beda

PPKEK halaman 1:

```
86| 7. Nilai Pabean - USD : 21.600,00
88| 8. Nilai Pabean - IDR : 387.439.200,00
```

Regex sekarang nyari `Nilai (Pabean|IDR|Rupiah)`. Yang ada di dokumen
`Nilai Pabean - IDR` (ada tanda hubung + spasi di antara). Perlu dicek ulang
lawan sample, bukan ditebak.

### 2c. Nopen — TERNYATA BENAR, jangan diutak-atik

```
4| ... 3. NOMOR PENDAFTARAN : 010259 TANGGAL : 31-07-2026
```

`grab(/Nomor Pendaftaran[^\d]*([\d\-]+)/i)` → `010259`. Benar.
Nilai `009444` / `004718` di register yang ada sekarang kemungkinan besar juga
benar — nopen memang 6 digit berawalan nol. Jangan "diperbaiki".

### 2d. Baris barang keparse tapi DIBUANG sebelum disimpan

`ppkekPdf.js` mengisi `out.items[]`, tapi `ppkekApi.js` `toRow()` tidak punya
kolom untuk itu. Jadi setiap baris barang hilang di titik simpan.

Sama nasibnya: `ppkekNo` (kolom "PPKEK No." di workbook).

---

## 3. PETA FIELD — dari mana tiap kolom workbook diambil

**TEMUAN PALING PENTING: baca supplier & alamat dari SPPB, bukan dari PPKEK.**
SPPB itu dokumen satu kolom, bersih, dan selalu ada di bundel yang sama:

```
SPPB baris 13-17:
  2. PENGIRIM BARANG
  b. Nama   : NIPPON SEIRO (THAILAND) CO., LTD.
  c. Alamat : NO.700/15 MOO 7 TAMBON KHAOKHANSONG AMPHUR SRIRACHA CHONBURI 20110
```

Satu baris, satu nilai. Tidak perlu gulat dengan formulir 3 kolom.

| Kolom workbook | Sumber | Lokasi di sample |
|---|---|---|
| Nopen | PPKEK hal.1 | br.4 `NOMOR PENDAFTARAN : 010259` |
| PPKEK Date | PPKEK hal.1 | br.4 `TANGGAL : 31-07-2026` |
| ETA | PPKEK hal.1 | br.67 `d. Perkiraan Tanggal Tiba : 31-07-2026` |
| Contract No. | PPKEK lembar lanjutan | br.139-142 tabel dokumen |
| **Item Name** | PPKEK `M. DATA BARANG` | br.104-107, perlu rakit ulang |
| **Item Code** | idem | `MTI-I-S-010206917ID` |
| **Suplier Name** | **SPPB** | br.16 |
| **Address** | **SPPB** | br.17 |
| Invoice No. | PPKEK lembar lanjutan | br.140 `Invoice IVO2607010 17-07-2026` |
| **Unit Cost** | PPKEK `M. DATA BARANG` | `1800.0000` |
| **Total Cost** | idem | `21.600,00` (amount CIF USD) |
| PPN | PPKEK `N. PUNGUTAN NEGARA` | br.117 kolom Ditangguhkan `42,619,000` |
| **Unit** | PPKEK `M. DATA BARANG` | `12.0000 TNE` |
| PL No | PPKEK lembar lanjutan | br.139 `Packing List IVO2607010` |
| PPKEK No. | PPKEK hal.1 | br.4 `NOMOR PENGAJUAN : 201039B6864D9...` |
| PPKEK Status | diketik manual | — |
| SO / JO / Costing / PO ERP INA | diketik manual | — |
| Tanggal Aktual Diterima | diketik manual | — |
| Jalur (tab LDP/TLDDP) | PPKEK hal.1 | br.3 & br.8 `LDP` |

Yang **tebal** = belum pernah disimpan sama sekali.

### Blok barang, dan kenapa ini bagian tersulit

```
103| No  Kode HS  Uraian Barang  Kode  Jumlah  Harga  Satuan  Amount  Nilai Pabean  Negara  Jenis Bayar  Ref Dok  Tanggal
104| 3404909 RUBBER ANTIOZONE WAX MTI-I-S- 21.600, 387.439.20 TH - Penanggu D2026-
105| 1   12.0000   1800.0000   TNE
106| 0 OZOACE-0013 0102069 00 0,00 THAILAND han BM 99K-
107| 17ID 001857051
```

Satu barang, kepecah 4 baris, tiap kolom kepotong di tempat berbeda
(`3404909` + `0` = HS 34049090; `MTI-I-S-` + `0102069` + `17ID` = kode barang;
`Penanggu` + `han BM`).

**Baris teks tidak cukup — harus pakai koordinat x/y**, sama seperti perbaikan
INCLUSION. Rekonstruksi yang benar untuk sample ini:

```
No            : 1
Kode HS       : 34049090
Uraian Barang : RUBBER ANTIOZONE WAX OZOACE-0013
Kode Barang   : MTI-I-S-010206917ID
Jumlah/Satuan : 12.0000 TNE
Harga Satuan  : 1800.0000
Amount (CIF)  : USD 21.600,00
Nilai Pabean  : IDR 387.439.200,00
Negara        : THAILAND
Jenis Bayar   : Penangguhan BM
Ref Dok       : D2026-99K-001857051 / 2026-07-23
```

Cek silang: 12 × 1.800 = 21.600 ✓ · 21.600 × 17.937 (kurs) = 387.439.200 ✓
Dua invarian itu **wajib dipakai sebagai tes** — kalau hasil parse tidak
memenuhinya, parse-nya salah.

---

## 4. RENCANA KERJA — 3 batch, urut

**Batch 1 — parser** (butuh sample; sudah ada)
- supplier + alamat dari SPPB
- nilai IDR/USD, kurs, PPN dari PPKEK hal.1
- blok `M. DATA BARANG` dengan koordinat x/y → `items[]` lengkap
- `ppkekNo`
- Tes: kedua invarian di atas + 7 baris yang sudah ada di produksi

**Batch 2 — penyimpanan** (SQL, diusulkan, dijalankan Kyaru)
- kolom `ppkek_no text`
- kolom `items jsonb` (pola sama dengan `pos.items`)
- kolom `ppn numeric`
- migrasi tidak merusak 7 baris lama — kolom baru nullable

**Batch 3 — export**
- satu baris per BARANG, bukan per dokumen
- 22 kolom persis workbook
- tab LDP/TLDDP tetap (sudah benar sekarang)

Jangan digabung. Batch 1 tanpa Batch 2 tetap membuang datanya; Batch 3 tanpa
Batch 1 menghasilkan file rapi berisi "Pemasok".

---

## 5. CATATAN

- **RAR5.** Sample ini RAR5. Portal pakai `libarchive.js` WASM self-hosted
  (`vendor/libarchive/`), yang mendukung RAR5. `7z` dan `unrar-free` TIDAK —
  keduanya menghasilkan file 0 byte tanpa error. Kalau nanti ada laporan
  "upload RAR gagal", curigai ini dulu, dan uji dengan sample yang sama.
- **Satu bundel = 10 file**, hanya 2 yang perlu diparse (PPKEK + SPPB).
  Sisanya (invoice, BL, packing list, COO) tetap diupload ke Drive apa adanya.
- Kolom `PPN` di `PPKEK DECEMBER.xlsx` kosong di 3.574 baris. Jadi kalau hasil
  akhir kolom itu kosong, belum tentu portal gagal — bisa jadi memang tidak
  pernah diisi.

*Dibongkar 31 Juli 2026 dari sample asli. Belum ada kode yang ditulis.*
