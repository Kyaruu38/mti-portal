# HANDOVER — MTI PURCHASING PORTAL

> Lanjutan dari sesi 31 Juli 2026. Baca sebelum nyentuh kode.
> **Baseline: `80de49d`** (origin/main, 31 Juli). Semua di bawah ini udah live di GitHub Pages.
> Handover sebelumnya (`HANDOVER-31-Juli.md`, baseline `b586aff`) digantikan file ini.

---

## 1. APA YANG BERUBAH HARI INI

4 commit, dari `b586aff` → `80de49d`.

| Commit | Isi |
|---|---|
| `6408308` | PO Converter baca PDF layout INCLUSION (tadinya 0 item) + 2 bug parser |
| `8a64c45` | Akun `cenjc` (read-only) + capability gating yang selama ini nggak ada |
| `5fac5e2` | 2 regresi dari `8a64c45` + 1 crash lama di layar Payment |
| `80de49d` | Global Search bocor lintas-role + surat jalan lewat RPC |

### 1a. PO Converter — `inclusion gabungan.pdf` masuk 0 item

Bukan PDF-nya yang rusak. pdf.js baca file itu sempurna (124 item, CJK kebaca).
Layout INCLUSION naruh **harga di baris DI ATAS kode ERP**, ekor desimalnya
nyangkut di baris bawahnya. Parser cuma ngintip satu baris, nggak nemu harga,
buang barisnya. 5 dari 5 kebuang.

Perbaikan: pass kedua yang baca satu blok item utuh, **cuma jalan kalau baris
itu udah mau dibuang** — jadi layout ZC yang sudah jalan nggak mungkin berubah
(output ZC byte-identik). Batas blok diambil dari struktur dokumen (baris header
tabel di atas, baris 共计/增值税/费用总计 di bawah), bukan tebak-tebakan pixel.

Tiap batas ada karena tanpa dia hasilnya **angka salah, bukan error**:
batas atas bolong → item 1 kebaca qty `60 天付款` (nyomot termin pembayaran);
batas bawah bolong → item 5 kebaca qty `3.090.741.801,10` (nyomot grand total).

Hasil lawan file asli: 5/5 item, qty × harga = amount di semua baris, total item
= 共计 punya PDF-nya sendiri, PPN 11% dan 费用总计 dua-duanya cocok.

**Ini menutup utang teknis "pdf.js grouping baris" di handover lama** — dugaan
bahwa `Math.round(transform[5])` rapuh terbukti benar, dan sekarang ada
penanganannya. Tapi lihat section 6: layout supplier baru masih bisa bikin
masalah serupa.

### 1b. Dua bug lain yang kepancing waktu regresi

- **`Rp 1.000,-` kebaca minus 1000.** Strip di belakang koma itu notasi "nol sen"
  Indonesia, bukan tanda minus. Dukungan minus-di-belakang yang ditambahkan buat
  statement ERP (`1.000-`, itu memang negatif) kena juga ke notasi invoice.
  Sekarang cuma strip yang nempel langsung di **angka** yang dianggap minus.
- **Tabel angka Mandarin berhenti di 兆**, jadi nominal ≥ 10^16 nyetak kata
  literal `undefined` di baris amount-in-words PRF yang ke bank. Diperpanjang ke
  京 + fallback digit.

### 1c. Akun cenjc — dan kenapa 16 file kesentuh

**Temuan paling penting sesi ini: portal ini nggak pernah ngunci tombol tulis
pakai permission, cuma pakai "layarnya ada apa nggak".**

Selama ini aman kebetulan: tiap role yang bisa LIHAT satu layar memang juga
boleh nulis di situ. `suratJalan.js`, `ppkek.js`, dan `labelLibrary.js` **nol
pengecekan permission** — satu baris pun nggak ada. Begitu ada role yang punya
12 layar tapi nol hak tulis, lubangnya kebuka semua.

Yang paling parah `payment.js:35`:

```js
if (!canIntake && canPrf) { ...layar PRF-only... }
// tidak ada cabang !canIntake && !canPrf
```

Role tanpa permission apa pun bikin kondisi itu `false`, jatuh ke layar intake
PENUH. **Akun paling nggak berhak justru dapat tombol paling banyak** — lebih
banyak dari cania/visca.

Capability baru, masing-masing mencerminkan policy RLS di tabel yang sama:

| Cap | Menjaga | Cermin RLS |
|---|---|---|
| `sjWrite` | buat surat jalan, kirim over-delivery, arsip ulang | `sj_rw` |
| `ppkekWrite` | dropzone PPKEK, edit sel inline, import-apply | `ppkek_rw` |
| `designWrite` | upload ke design library | `designs_write` |
| `poCreate` | generate PO (PO Converter + Label Request) | `pos_insert` |
| `labelParse` | parse Excel label ke item master | — |
| `readOnly` | penanda akun pemantau | — |

Yang paling licik bukan tombol: tiap baris register PPKEK punya 4 kotak isian
inline + dropdown status yang nyimpen pas blur. Gampang kelewat kalau ngaudit
layar dengan cara nyari tombol. Sekarang jadi teks biasa buat role tanpa
`ppkekWrite`.

**Bentuk `CAPS` berubah** dari `{cap: true/false}` per role jadi daftar nama yang
diberikan (`grant('editMaster labelStockWrite ...')`). Bentuk lama mengharuskan
tiap cap baru ditempel ke tujuh baris, dan kelewat satu baris kebaca sebagai
"sengaja ditolak". Sekarang apa pun yang nggak terdaftar = false.

**Tiga lapis pertahanan**, karena gating per-tombol itu yang bakal dilupain layar
berikutnya:

1. tombol disembunyiin capability
2. fungsi aksinya nolak lewat `core/guard.js` `blockWrite()` sambil teriak di
   console — **tombol yang kepencet itu artinya ada bug, jadi biar ketahuan**
3. RLS nolak di database

Lapis 2 juga nutup satu hal yang **RLS nggak bisa lihat**: `uploadToDrive()`.
Tiga alur upload ke Drive DULUAN sebelum nyentuh Postgres (bukti bayar, design
library, arsip surat jalan). Akun read-only yang write DB-nya ditolak benar
tetap bisa nyampah file ke Drive. Postgres nggak punya suara di situ.

**Sengaja TIDAK dijaga** (ada di komentar `guard.js`, jangan "dibenerin"):

- **ganti password sendiri** — tiap akun dibuat dengan `must_change_password`;
  kalau dijaga, akun baru terkunci permanen di login pertama
- **`logAudit`** — kalau suatu saat ada write yang lolos semua pagar, baris audit
  itu justru yang paling dibutuhkan buat nyari lubangnya

### 1d. Dua regresi dari `8a64c45`, ketemu waktu audit ulang

Keduanya kena **user lama**, bukan cuma cenjc. Lolos karena verifikasi commit itu
menghitung elemen `<button>` per layar — metode yang secara struktural buta ke
dropzone dan ke isi file Excel.

1. **wilbert kehilangan seluruh alur bukti transfer.** Dropzone bukti transfer
   dipagerin `markPaid`. Wilbert punya layar Finance tapi nggak punya `markPaid`,
   jadi dropzone-nya mati. Parahnya: `ui.proofMatch` cuma di-set di dalam
   `handleProof()`, yang cuma bisa dipicu dropzone — jadi panel kanan Finance
   **mati permanen**, tanpa toast, tanpa error. Salahnya: nyampur dua gate.
   Dropzone itu pintu masuk buat **baca** bukti; yang duitnya tombol "Confirm
   Paid", dan itu dari dulu memang di belakang `markPaid` terpisah. Sekarang
   dipagerin `isReadOnly`.
2. **sekar & financemti kehilangan jejak audit supplier di export Excel.**
   Diikat ke `auditEntities.has('po')`, dan mereka berdua nggak punya modul PO.
   Padahal finance itu justru yang eksekusi transfer — "rekening supplier X
   barusan diganti" itu sinyal anti-fraud paling relevan buat mereka. Sekarang
   syaratnya `auditEntities.size > 0`.

### 1f. Global Search + surat jalan (`80de49d`)

`core/globalSearch.js` menyapu semua array store **tanpa filter role**, dan
kotaknya dirender untuk semua akun. RLS menutup sebagian besar, tapi `prfs_read`
memasukkan cania & visca sementara `REPORT_MODULES` mereka sengaja tanpa PRF —
jadi search menyerahkan nomor PRF ke mereka, melewati keputusan 30 Juli.

Tidak ada satu aturan seragam yang benar di sini. "Harus punya layarnya"
memotong PO dari cania/visca yang memang membuat PO. "Harus punya modul
laporannya" memotong Invoice dari sekar yang MEMILIKI intake invoice. Jadi tiap
tipe punya predikatnya sendiri, ditulis di sebelah alasannya.

`screens` adalah daftar preferensi berurutan, bukan satu tujuan tetap: PRF
dibuka dari Payment oleh sekar dan dari Finance oleh financemti, dan financemti
tidak punya Payment maupun Reports.

Surat jalan sekarang lewat `create_surat_jalan()`, dan SQL-nya SUDAH
dijalankan — penjaga over-delivery aktif di level database (section 2).

### 1g. cania & visca TIDAK PERNAH bisa bikin PRF (ditemukan 31 Juli)

`invoices_read` tidak memasukkan mereka, sementara `prfBuilder()` mengambil
seluruh daftarnya dari `st.invoices`. RLS menyaring baris → PostgREST balas 200
dengan `[]` (bukan error) → `fetchInvoices()` return `[]` (bukan null) →
`if (invoicesFromServer)` truthy → `st.invoices = []` → builder kosong selamanya.
Tanpa error, tanpa toast, tanpa warning console.

Lolos berbulan-bulan karena **semua pengujian frontend memakai MODE DEMO**, yang
mengisi store dari seed tanpa menyentuh RLS. Fitur ini jalan sempurna di demo.
Produksi satu-satunya tempat yang berbeda.

**Aturan yang lahir dari ini: fitur apa pun yang bergantung pada data hasil
fetch TIDAK BISA dibuktikan lewat pengujian mode demo.**

### 1e. Crash lama di layar Payment (bukan dari commit mana pun sesi ini)

`poPpnPaid()` manggil `inv.poRef.replace(...)` padahal `invoicesApi.js` nulis
`po_ref: inv.poRef || null`, dan juga mengasumsikan `po.no` nggak kosong.
**Satu invoice tanpa PO Ref = seluruh layar Payment jadi kotak merah** — buat
sekar dan wilbert, bukan cuma pemantau. Sekarang fallback ke flag `ppnPaid`
invoice itu sendiri, persis yang sudah terjadi kalau lookup PO nggak ketemu.

---

## 2. SQL YANG UDAH DIJALANIN

Semua sudah kena, jangan diulang:

- `supabase_migration_bank_pending.sql` — staging rekening supplier
- `supabase_migration_guards.sql` — constraint status `pos_insert`
- `supabase_migration_label_stock.sql` — 4 tabel label + kolom `pos.priority`
- `supabase_migration_sona.sql` — `is_label_staff()` + constraint role
- **`supabase_cenjc_ALL.sql`** (31 Juli) — `is_observer()`, constraint role jadi
  7, 11 policy SELECT, profil cenjc. Verifikasi `supabase_cenjc_CEK.sql`
  **9/9 LULUS**.
- **`supabase_fix_prf_cania_visca.sql`** (31 Juli) — policy `invoices_read_prf`.
  Terverifikasi terpasang sebagai SELECT, `invoices_write` tidak berubah.
- **`supabase_cleanup_sj_test_CGDD2607200143.sql`** (31 Juli) — 3 surat jalan tes
  + 3 baris audit dihapus. Over-delivery seluruh database sekarang KOSONG.
- **`supabase_dedup_po_CGDD2607200143.sql`** (31 Juli) — 4 dari 5 PO kembar
  di-soft-delete. Sisa 1 aktif (`16b7d26a`, yang punya surat jalan), 0 yatim.

- **`supabase_migration_surat_jalan_rpc.sql`** (31 Juli) — `create_surat_jalan()`
  versi baru yang menyimpan `created_by` dari `current_username()` server.
  Terverifikasi: `simpan_pembuat = true`, `dari_server = true`.

  Diuji lawan replika Postgres 16 sebelum dikirim, 6 skenario:
  kirim pas 100/100 → sukses + `created_by` tersimpan · kelebihan 1 pcs →
  ditolak dengan pesan yang menyebut baris/dipesan/terkirim/ditambahkan ·
  cenjc → ditolak · sona → ditolak · lineId ngawur → ditolak dengan pesan jelas ·
  wilbert kirim pas → sukses.

  **Penjaga over-delivery sekarang AKTIF di level database.** Dua sesi bersamaan
  tidak bisa lagi menembusnya. Kalau suatu saat console menampilkan
  `[surat jalan] create_surat_jalan() not found`, berarti fungsinya hilang dari
  database — jalankan ulang file ini.

**Semua SQL sesi 31 Juli sudah dijalankan. Tidak ada yang menggantung.**

**Yang BELUM dijalanin (opsional):** blok `create_surat_jalan()` di `guards.sql`
— fungsinya sudah ada tapi **frontend belum disambungin**. Itu buat ngunci
over-delivery di level database. Guard client-side sudah ada, tapi dua sesi
terpisah masih bisa lolos.

### Catatan desain SQL cenjc yang penting buat sesi berikutnya

Beberapa tabel dijaga **satu policy `for all`** — satu predikat mengatur SELECT
dan tulis sekaligus (`ppkek_rw`, `sj_rw`, `label_stock_rw`, `label_uploads_rw`).
Melebarkan predikatnya buat ngasih akses baca = **ngasih hak tulis penuh**.

Yang dilakukan: **policy SELECT baru yang terpisah**. Policy RLS bersifat
permissive dan di-OR, jadi menambah policy select-only nggak menyentuh sisi
tulis sama sekali. Policy lama nggak diubah sedikit pun.

`cenjc` **tidak** ada di `is_purchasing()` maupun `is_label_staff()`. Jangan
digabung — itu jebakan yang sama persis yang dihindari waktu menambah sona.

---

## 3. AKUN (sekarang 7)

| Akun | Layar | Catatan |
|---|---|---|
| `wilbert` | Semua + approval | satu-satunya `approve` |
| `cania`, `visca` | Label, PO Converter, Stok Label, Surat Jalan, Master Data, Reports, PRF (generate only) | |
| `sekar` | PPKEK, Payment (intake + progress PRF read-only), Reports | |
| `financemti` | Finance | satu-satunya `markPaid` |
| `sona` | Dashboard, Label Purchasing, Stok Label | **bukan** `is_purchasing()` |
| **`cenjc`** | **12 layar, NOL hak tulis** | **bukan** `is_purchasing()` **maupun** `is_label_staff()` |

UID Auth cenjc: `be45695f-7562-4324-b0b6-bc3a5c2a9bb0` · `cenjc@mti.co.id`

**Bukti RLS cenjc** (diuji lawan replika Postgres 16 beneran, bukan dibaca doang):
baca **10/10 tabel**, tulis **ditolak 9/10**. Yang satu itu `audit_log`, memang
sengaja (lihat 1c). Cania diuji berbarengan sebagai pembanding — haknya persis
sama seperti sebelumnya.

Query verifikasinya juga **disabotase 4 kali** buat mastiin dia bukan pajangan:
cenjc diselipkan ke `is_purchasing`, policy observer diubah jadi `for all`, cenjc
disempilkan ke policy INSERT, sona dihapus dari constraint. **Keempatnya
ketangkap.** Balik normal → bersih lagi.

---

## 4. YANG HARUS DITES

**Belum ada satu manusia pun yang beneran pakai fitur-fitur ini.** Semua
verifikasi pakai browser otomatis di mode demo (Playwright, 63 render layar × 7
role, nol error runtime). Itu bukan pengganti orang beneran.

### A. Yang KENA USER LAMA — prioritas nomor satu

Dua ini pernah rusak dan sudah dibenerin, tapi belum diverifikasi manusia:

- [ ] **wilbert → Finance**: panel kanan hidup, dropzone bukti transfer bisa
      di-drop (bukan abu-abu)
- [ ] **sekar → PPKEK**: kolom SO / JO / Costing / PO ERP masih **bisa diketik**
      dan tersimpan pas klik ke luar kotak
- [ ] **sekar & wilbert → Payment**: layar intake muncul UTUH (dropzone + tabel
      invoice + tombol Add Invoice + PRF builder)
- [ ] **financemti → Finance**: masih bisa terima PRF + tandai lunas
- [ ] **sona → Stok Label**: upload mingguan masih jalan

### B. Akun cenjc (incognito baru, F12 kebuka)

- [ ] Login → diminta ganti password
- [ ] Menu **persis 12** item
- [ ] Buka ke-12 layarnya satu per satu — console **bersih**
- [ ] Dashboard: kartu "Yang sedang nyangkut" terisi, "Aktivitas Terbaru"
      menampilkan nama **orang lain** (bukan kosong)
- [ ] Approval → PO **Approved**: ada Download PDF, **nggak ada**
      Approve/Reject/Edit
- [ ] PPKEK: kolom SO/JO/Costing/PO ERP tampil sebagai **teks**
- [ ] Master Data: **nggak ada** Add/Edit/Hapus, tombol History **tetap ada**
- [ ] Console: `__MTI__` harus `undefined`

### C. PO Converter

- [ ] Drop `inclusion gabungan.pdf` → harus **5 item**, subtotal
      `3.090.741.801,10`, nol baris kebuang
- [ ] Drop PDF ZC yang lama → harus tetap seperti sebelumnya

### D. Regresi lama (masih berlaku)

- [ ] PO PPN "Dibayar" → Edit → Save tanpa ubah apa-apa → total **nggak turun 11%**
- [ ] Buat PRF → Kirim ke Wilbert → tombol PDF jalan
- [ ] Ctrl+P di Dashboard/Reports → kecetak isinya
- [ ] Ganti rekening supplier → PRF tetap cetak rekening **LAMA** → Reject →
      rekening lama tetap aktif

---

## 5. YANG NUNGGU KEPUTUSAN

### 5 pasang SKU dobel — masih nunggu sona

10 baris, dikarantina, **nggak masuk database**. Kalau dibiarkan apa adanya,
4 SKU masuk BUY NOW padahal stoknya lebih — **5.500 pcs salah beli, 8% dari
rencana belanja**.

| Baris Excel | Stock | Spec |
|---|---|---|
| 191 ↔ 903 | 7.700 / 80 | `ID295/80R22.5-18PR(152/149M)[AS678]威狮无内` |
| 314 ↔ 933 | 3.000 / 2.000 | `ID10.00R20-18PR(149/146J)[AZ850]雅度` |
| 315 ↔ 939 | 300 / 7.174 | `ID11.00R20-18PR(152/149F)[CB972]雅度` |
| 318 ↔ 960 | 10.000 / 3.000 | `ID12.00R20-22PR(158/155F)[EZ310 pro]雅度` |
| 320 ↔ 965 | 3.200 / 10.850 | `ID12.00R24-20PR(160/157F)[CB972]雅度` |

⚠️ **JANGAN asal hapus salah satu** — stocknya beda, dua-duanya kemungkinan nyata.
⚠️ **JANGAN nyari duplikat pakai Spec Name doang** — ada 24 spec yang muncul di
beberapa market code, itu **valid**. Duplikat = Spec Name **DAN** Market Code
dua-duanya sama.

### Trigger audit `suppliers` — SUDAH DICEK, AMAN

Sempat divonis "LUBANG" oleh query pemeriksaan yang SALAH. Query itu mencari
string literal `old.bank` / `old.acct` di badan fungsi; trigger sebenarnya
membandingkan `to_jsonb(OLD)` lawan `to_jsonb(NEW)` dan mencatat SETIAP field
yang berubah sebagai `key: lama -> baru`.

Diuji lawan replika dengan trigger yang disalin persis. Hasil nyata:

```
acct: 1234567890 -> 8000095938300; bank: BCA -> CIMB NIAGA      <- diganti
acct: 8000095938300 -> 1234567890; bank: CIMB NIAGA -> BCA      <- ditolak
```

Nilai rekening lama tersimpan di kedua arah, termasuk penolakan. **Kontrol
anti-fraud utuh. Tidak ada yang perlu diperbaiki.**

### Usulan rekening yang masih menggantung

`PT WILSON TUNGGAL PERKASA` → CIMB NIAGA `8000095938300`,
`bank_change_pending = true`. Menunggu keputusan Wilbert di Master Data →
Suppliers. Supplier karet; `PT.WINS TUNGGAL PERDANA` (supplier label) adalah
perusahaan yang berbeda meski namanya mirip — sudah dikonfirmasi.

### Angka "N kandidat ERP tersedia" belum pernah dilaporkan

Buka Stok Label → tab **Cocokkan ERP**, catat angkanya. Kalau **0**, artinya Item
Master, Design Library, dan PO lama semuanya kosong → matching dan Order Tracking
**nggak bisa jalan sama sekali**. Ini bukan bug, konsekuensi kolom Material Code
kosong 984 baris. **Lapor angkanya.**

---

## 6. UTANG TEKNIS

| Item | Catatan |
|---|---|
| **`pos.no` tanpa constraint unik** | **BARU.** CGDD2607200143 tercatat **LIMA KALI** — wilbert menekan Generate di PO Converter 5x pada 21 Juli dalam 3,5 jam. Nomor PO diketik manual (keputusan Anda), dan tidak ada yang mencegah nomor yang sama masuk dua kali. Reports menghitung nilainya 5x (Rp 226 juta vs Rp 45 juta) sampai dibereskan hari ini. Usulan constraint ada di PART 4 `supabase_dedup_po_CGDD2607200143.sql` — **jangan dipasang sebelum** pesan error di poConverter.js dibikin manusiawi, kalau tidak orang ketemu pesan mentah Postgres. |
| Penomoran surat jalan | PART 4 reset counter TIDAK dijalankan, karena `PC/SJ/VII/002-1` (21 Juli, wilbert) masih hidup. Nomor berikutnya akan melompat, bukan salah. |
| Rekening supplier kebaca semua akun | `suppliers_read` = `auth.uid() is not null`. Termasuk sona. **Bukan** dibuka oleh cenjc — sudah begitu dari awal. Kalau mau diperketat, itu perubahan yang kena semua role. |
| `pdf.js` grouping baris | Sebagian tertutup oleh `6408308`, tapi masih `Math.round(transform[5])`. Layout supplier baru masih bisa bikin masalah serupa. Kalau ada PO keparse aneh, curigai ini dulu. |
| Upload Drive sebelum tulis DB | 3 alur (bukti bayar, design, arsip surat jalan) upload duluan. Kalau tulis DB gagal, filenya yatim di Drive tanpa baris yang nunjuk. |
| `prfTrackingCard(st, readonly)` | Parameter `readonly` nggak dipakai di badan fungsi. Parameter mati, menyesatkan. |
| Nggak ada parser invoice | `payment.js` sengaja nggak punya parser PDF invoice (beda dari PO Converter). Intake invoice 100% ketik manual. |

---

## 7. ATURAN KERJA (masih berlaku)

1. Tarik repo dulu, baca file aslinya. Jangan ngedit berdasar asumsi.
2. **Jangan jalanin SQL.** Boleh usul, Kyaru yang review & jalanin.
3. Commit lokal boleh, **PUSH TIDAK**. Kasih hash + list file + command push.
4. Jangan 2 sesi agent barengan di file yang sama.
5. Fitur inti nggak boleh crash gara-gara fitur pinggiran. Degrade graceful.
6. Test = incognito fresh + console kebuka.
7. **Verifikasi lawan sample asli, bukan lawan ekspektasi.**
8. Invariant di `CLAUDE.md` section "Invariants added 2026-07". Baca sebelum ngoding.
9. **BARU:** kalau nambah capability, cek dampaknya ke **tiap role yang sudah
   ada**, bukan cuma role baru. Lihat 1d — dua regresi lahir dari melewatkan ini.
10. **BARU:** ngitung tombol bukan verifikasi. Dropzone itu `<div>`, isi Excel
    nggak keliatan dari DOM, dan permission bisa hilang tanpa mengubah jumlah
    elemen apa pun.
11. **BARU:** SQL apa pun — termasuk yang cuma SELECT — dijalankan dulu lawan
    replika Postgres lokal sebelum dikirim. Lihat section 9.
12. **BARU:** mode demo mengisi store tanpa lewat RLS. Fitur yang bergantung
    pada data hasil fetch nggak bisa dibuktikan di mode demo. Kalau sebuah role
    diberi hak MEMBUAT sesuatu, cek juga policy SELECT untuk semua yang perlu
    DIBACA supaya bisa membuatnya.

---

## 8. YANG MAU DIKERJAIN BERIKUTNYA

<!-- ISI SETELAH TES MANUSIA -->
1.
2.
3.

---

## 9. CATATAN JUJUR DARI SESI 31 JULI

Agent nambah role read-only dan bilang "tidak ada role yang kehilangan apa pun",
dengan bukti hitungan tombol per layar di 7 role. **Klaim itu salah.** Waktu
disuruh audit ulang, ketemu dua regresi yang kena user lama — salah satunya
matiin seluruh panel Finance milik wilbert tanpa pesan error apa pun.

Yang bikin lolos bukan kurang teliti, tapi **alat ukurnya yang salah**: dropzone
itu `<div>` bukan `<button>`, jadi jumlah tombol tetap identik walaupun fiturnya
sudah mati. Dan isi file Excel sama sekali nggak terlihat dari DOM.

Pelajarannya sama dengan 30 Juli, dan sekarang terbukti dua kali: **agent tidak
bisa menjadi verifikator terakhir untuk pekerjaannya sendiri.** Yang nangkap
kedua-duanya adalah review terpisah yang sengaja mencari kerusakan, bukan
mencari konfirmasi.

Untuk sesi berikutnya: kalau agent bilang "sudah diverifikasi", tanya **dengan
cara apa** dan **apa yang metode itu tidak bisa lihat.**

### Dua SQL yang salah di sesi yang sama

1. File cleanup memakai `p.contract = 'CGDD2607200143'`. Nomor itu ada di kolom
   `no`; `contract` berisi `TN-YR-WL-SPRMX-BXPTOEM-0609`. Predikatnya cocok ke
   NOL baris — PART 1 kosong, PART 2 menghapus nol, dan PART 4 tetap menampilkan
   9 baris seolah penghapusannya gagal. Jawabannya ada di screenshot yang sudah
   dikirim Kyaru sendiri.
2. Pemeriksaan trigger audit mencari string `old.acct` dan memvonis "LUBANG"
   pada kontrol anti-fraud yang sebenarnya baik-baik saja.

Pola keduanya identik: **memeriksa berdasarkan bentuk yang diharapkan, bukan
bentuk yang ada.** Persis kesalahan yang aturan nomor 7 larang, cuma pindah dari
parser ke SQL.

Postgres tersedia di sandbox agent. **Sejak 31 Juli, tidak ada SQL yang boleh
dikirim tanpa dieksekusi dulu lawan replika** — termasuk query yang "cuma
membaca", karena query baca yang salah menghasilkan kesimpulan yang salah.

---

*Disiapkan 31 Juli 2026 · baseline `5fac5e2`*
