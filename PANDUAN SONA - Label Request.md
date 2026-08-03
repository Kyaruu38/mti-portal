# Panduan Sona — Label Request

**Portal:** kyaruu38.github.io/mti-portal
**Login:** `sona`
**Versi:** v11.0

---

## Yang berubah, dan kenapa

Dulu satu tombol ngerjain dua hal sekaligus: milih supplier **dan** nerbitin PO. Tombol itu ada di layar Sona, jadi Sona yang nerbitin PO — padahal supplier dan PO itu urusan Cania & Visca.

Sekarang dipisah:

| Sona | Cania / Visca |
|---|---|
| Upload file label mingguan | Terima permintaannya |
| Pilih baris yang mau dicetak | Pilih supplier |
| **Kirim ke Purchasing** | **Terbitkan PO** |

Permintaan Sona **tersimpan utuh** — file apa, sheet mana, baris apa aja, jam berapa. Jadi kalau nanti ada label yang salah cetak, bisa dicek: yang diminta emang itu apa bukan.

---

## Langkah-langkahnya

### 1 · Masuk

Buka portal → isi username `sona` dan password → **Masuk**.

Di menu kiri ada tiga: **Dashboard**, **Label Request**, **Stok Label**.
Klik **Label Request**.

---

### 2 · Upload file Excel

Layarnya punya 3 tahap di atas: `1 Upload File` → `2 Pilih Sheet` → `3 Preview & Assign`.

**Tarik file Excel-nya** ke kotak putus-putus di tengah, atau klik kotaknya buat browse.

> File `.xlsx` atau `.xls`. Nama file bebas — nama Mandarin juga tidak apa-apa.

---

### 3 · Pilih sheet

Portal baca semua sheet di dalam file itu dan nampilin daftarnya, lengkap sama jumlah barisnya:

```
○ Sheet1              1 baris data
● PO LOCAL            5 baris data     [Disarankan]
○ 缺货加急             1 baris data
```

Yang ada tulisan **Disarankan** itu tebakan portal — biasanya bener, tapi **tetap dicek**. Kalau salah, klik sheet yang bener.

Klik **Parse Sheet →**

> Salah pilih sheet? Klik **Ganti file** atau **Kembali**, ga ada yang rusak.

---

### 4 · Periksa hasilnya

Sekarang keliatan semua baris yang kebaca: spec, brand, qty, ada desainnya atau engga.

Di atas ada ringkasan:
- **"2 baris discan · 2 order terdeteksi"**
- **"2 tanpa desain · 2 item baru"** ← perhatiin yang ini

Tanda yang perlu dicek:

| Tanda | Artinya |
|---|---|
| 🔴 **No Design** | Belum ada file desain buat item ini |
| 🟠 **NEW ITEM** | Item ini baru, belum pernah ada di master |

Dua-duanya **bukan error** — cuma pemberitahuan. Tapi kalau semua barisnya "NEW ITEM" padahal harusnya barang lama, kemungkinan sheet-nya salah. Balik ke tahap 2.

Ada kotak **Filter spec / ERP…** kalau barisnya banyak.

---

### 5 · Centang yang mau diminta

Centang kotak di kiri tiap baris. Mau semua? Centang kotak paling atas di header tabel.

**Yang ga dicentang, ga dikirim.** Jadi kalau ada baris yang belum pasti, biarin ga dicentang dulu.

---

### 6 · Kirim ke Purchasing

Di bawah muncul panel oranye: **"2 baris dipilih"**.

Klik **✓ Kirim ke Purchasing**.

Muncul notifikasi:

> *2 baris dikirim ke Purchasing — mereka yang assign supplier & bikin PO*

Selesai. Layarnya balik ke tahap 1.

> **Sona ga milih supplier.** Dropdown supplier emang sengaja ga ditampilin — itu bagian Cania & Visca.

---

### 7 · Pantau statusnya

Di layar Label Request ada tabel **Request Saya**:

| File | Sheet | Qty | Dikirim | Supplier | PO | Status |
|---|---|---|---|---|---|---|
| 7.31 label.xlsx | PO LOCAL | 2 | 31 Jul 16:20 | — | — | 🟠 **Diminta** |

Tiga kemungkinan statusnya:

| Status | Artinya |
|---|---|
| 🟠 **Diminta** | Udah dikirim, Purchasing belum ambil |
| 🟢 **PO Terbit** | Udah jadi PO — kolom Supplier dan PO keisi |
| 🔴 **Ditolak** | Ga diproses, alasannya ada di catatan |

Kalau udah **PO Terbit**, nomor PO-nya keliatan di situ. **Ga perlu nanya siapa-siapa.**

---

## Kalau ada masalah

| Kejadian | Lakukan |
|---|---|
| Sheet-nya kosong / baris ga kebaca | Balik ke tahap 2, coba sheet lain. Kolom QTY harus angka — baris tanpa angka QTY dilewati |
| Salah centang, udah terkirim | Kabarin Cania/Visca sebelum PO terbit. Request ga bisa dihapus (memang disengaja), tapi bisa ditandai **Ditolak** |
| Tombol "Kirim ke Purchasing" ga ada | Cek pojok kanan atas — pastikan login sebagai `sona` |
| Muncul "Gagal kirim request ke server" | Requestnya **tidak** tersimpan. Cek internet, ulangi. Jangan dianggap terkirim |
| Layar kelihatan aneh / ga update | `Ctrl + Shift + R` (hard refresh) |

---

## Yang Sona **tidak** kerjakan

- ❌ Pilih supplier
- ❌ Terbitkan PO
- ❌ Hapus request yang sudah dikirim

Bukan karena ga dipercaya — tapi supaya kalau ada label salah, jelas siapa minta apa dan siapa mutusin apa. Kalau satu orang ngerjain dua-duanya, ga ada catatan yang bisa dicek.

---

## Bahasa

Pojok kanan atas ada tombol **ID · EN · 中**. Seluruh layar ikut ganti, termasuk notifikasi.
