# Panduan Sona — Bagian 2: Stok Label

**Portal:** kyaruu38.github.io/mti-portal
**Login:** `sona` → menu **Stok Label**
**Versi:** v13.1

> Bagian 1 (Label Request) ada di file terpisah. Bagian ini yang **sebelum**-nya: menentukan label mana yang perlu dicetak.

---

## Urutannya, sekali lihat

```
1. Update Excel Label Inventory Tracker  (seperti biasa)
2. Upload ke portal
3. Buka tab BUY NOW           ← ini daftar belanjanya
4. Pindah ke Label Request, centang, kirim ke Purchasing
```

Langkah 3 dan 4 yang baru. Sebelumnya daftar itu cuma ada di kepala dan di Excel.

---

## 1 · Upload

Menu kiri → **Stok Label**.

Tarik file **Label Inventory Tracker (.xlsx)** ke kotak di atas. Portal baca sheet **"Master Tracker"**.

**Angkanya tetap punya Excel.** Portal tidak mengubah satu sel pun — dia menyimpan, lalu **menghitung ulang sendiri** dan membandingkan. Kalau hasilnya beda dengan yang tertulis, dia bilang:

> ⚠️ *"18 baris angkanya beda dari hasil hitung ulang"*

Yang dipakai **tetap angka Excel**. Itu bukan tuduhan bahwa Excel-nya salah — itu pemberitahuan bahwa ada rumus yang mungkin keinjek, atau kolom yang tanpa sengaja ke-*paste* jadi angka mati. Kalau muncul, kabari Wilbert; jangan diabaikan tapi juga jangan panik.

Sebelum tersimpan muncul **preview**: apa yang berubah dibanding upload sebelumnya. Baca sebentar, baru **Simpan**.

---

## 2 · Enam tab, dan gunanya masing-masing

| Tab | Untuk apa |
|---|---|
| **Master Tracker** | Semua SKU apa adanya |
| **BUY NOW** | **Ini daftar belanjanya.** Stok di bawah kebutuhan |
| **DO NOT BUY** | Berlebih atau tidak terpakai — jangan pesan, habiskan dulu |
| **Order Tracking** | PO label yang sedang jalan: telat berapa hari, sudah sampai belum |
| **Cocokkan ERP** | Kerjaan sekali saja — lihat bagian 4 |
| **Riwayat Upload** | Siapa upload apa, kapan |

Kartu di bagian atas layar meringkas semuanya: total stok, total kebutuhan, berapa yang harus beli, berapa berlebih, berapa nganggur.

---

## 3 · Kenapa suatu SKU masuk BUY NOW

Portal memakai aturan yang sama persis dengan yang selama ini ada di Excel — sudah dicocokkan dengan **984 baris** dan **nol beda pendapat**:

| Keadaan | Status |
|---|---|
| Tidak ada rencana produksi | **IDLE STOCK** — stok menganggur |
| Stok kurang dari kebutuhan | **BUY NOW** — perlu dipesan |
| Stok ≥ 2× kebutuhan | **OVERSTOCK** — berlebih |
| Selain itu | **SUFFICIENT** — aman |

```
kebutuhan = rencana produksi × (1 + buffer)
sisa      = stok − kebutuhan
saran     = kekurangan, dibulatkan ke atas ke kelipatan MOQ (500)
```

Contoh nyata: kurang **12.141** lembar, MOQ 500 → saran pesan **12.500**.

Angka **2×** untuk OVERSTOCK itu keputusan bisnis, bukan hukum alam. Bisa diubah di Master Data tanpa mengubah program.

---

## 4 · Cocokkan ERP — sekali saja, tapi wajib

Kolom **Material Code** di Excel kosong untuk semua baris. Artinya portal tidak tahu "nama spec panjang ini = kode barang yang mana".

Sebagian besar sudah diisi otomatis oleh Wilbert. Sisanya muncul di tab **Cocokkan ERP** untuk ditinjau satu per satu.

**Ini bukan kerjaan Sona** — ini kerjaan Wilbert/Cania. Tapi Sona perlu tahu kenapa tab itu ada: **tanpa kode ERP, tab Order Tracking tidak bisa menghubungkan PO ke SKU.** Layarnya ada, isinya tidak akan pernah terisi.

Portal **tidak pernah** memasang kode ERP tebakan sendiri. Kode yang salah berarti pengiriman barang lain tercatat masuk ke SKU ini — lebih buruk daripada tidak tersambung, karena tidak ada yang akan curiga.

---

## 5 · Kalau ada SKU kembar

Kalau nama spec dan market code sama persis muncul dua kali, portal **menahan semua barisnya**:

> ⚠️ *"3 spec muncul lebih dari sekali (6 baris). Baris ini TIDAK diimpor."*

Tidak digabung (itu mengarang angka stok), tidak dibuang (itu menghilangkan satu diam-diam). Sisanya tetap masuk, jadi rutinitas mingguan tidak terhambat.

Yang perlu Sona lakukan: **benarkan di Excel-nya**, lalu upload ulang.

> Sejak v13.1, dua nama yang **cuma beda spasi** juga dianggap kembar. Contoh nyata yang pernah lolos berbulan-bulan:
> ```
> ID10.00R20-18PR(149/146F)[CB332]  朝阳    ← dua spasi
> ID10.00R20-18PR(149/146F)[CB332]朝阳      ← tanpa spasi
> ```
> Satu label, dua baris. Stok dan kebutuhannya terbagi dua, jadi status BUY NOW-nya dihitung dari separuh angka sebenarnya.

---

## 6 · Pengingat upload

Kalau upload terakhir sudah lewat **7 hari**, muncul pengingat oranye di Dashboard:

> *"Upload terakhir 9 hari lalu (23 Jul). Stok di bawah ini seumur itu juga."*

Itu bukan omelan — itu pemberitahuan bahwa angka yang sedang dilihat orang lain sudah seminggu umurnya, dan keputusan beli yang diambil dari situ ikut seumur itu.

---

## Kalau ada masalah

| Kejadian | Lakukan |
|---|---|
| Sheet tidak terbaca | Nama sheet-nya harus **"Master Tracker"**. Kolom "Spec Name" dan "Current Label Stock" wajib ada |
| Angka tidak masuk akal | Cek dulu di Excel. Portal menampilkan apa adanya — kalau salah di sana, salah juga di sini |
| Ada spanduk kuning "angkanya beda" | Bukan error. Kabari Wilbert, sertakan screenshot |
| Muncul spanduk "file belum sampai Google Drive" | Filenya **aman**, tersimpan di server. Portal mengirim sendiri saat Drive bisa diakses lagi. Tidak perlu upload ulang |
| Layar terlihat aneh | `Ctrl + Shift + R` |

---

## Yang Sona **tidak** kerjakan di layar ini

- ❌ Mencocokkan kode ERP (itu Wilbert / Cania)
- ❌ Membuat PO label (itu Cania / Visca — lihat Bagian 1)
- ❌ Mengubah angka stok langsung di portal — sumbernya tetap Excel

Portal ini **cermin dari Excel**, bukan penggantinya. Yang berubah: sekarang cerminnya bisa dilihat semua orang, dan dia menghitung ulang sendiri untuk memastikan tidak ada yang meleset.
