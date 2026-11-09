-- =====================================================================
-- items_panen_artwork.sql                          9 Nov 2026
--
-- ARTWORK ADALAH SUMBER DATA, BUKAN CUMA SUMBER TATA LETAK.
--
-- Nama berkas artwork memuat ERP, dan lapisan teks PDF-nya memuat nilai
-- yang BENAR-BENAR TERCETAK di label. Diadu ke items untuk empat artwork
-- SNI yang dipakai mengukur templat:
--
--   COCOK  : load_speed (4/4), pattern (4/4), market, brand
--   KOSONG : size, ply, tt_tl, ean, npb1, npb3, label_size
--
-- Tujuh medan yang kosong itu SEMUANYA ada di artworknya. Jadi generator
-- artwork tidak bisa mencetak ulang label yang sudah pernah dicetak --
-- bukan karena tata letaknya tidak diketahui, tapi karena isinya tidak
-- pernah disimpan.
--
-- Dipanen lewat label_master_panen yang sama, dengan asal 'ARTWORK-SNI-9NOV'
-- supaya bisa ditelusuri dan dibalik. Hasilnya: 22 medan terisi, 0 tertimpa,
-- 0 baris baru.
--
-- TIAP NILAI DIBACA DARI LAPISAN TEKS PDF-nya, bukan diturunkan dari nama
-- berkas. Yang tidak terbaca tidak diisi.
--
-- EAN-nya dirakit dari potongan angka yang terpencar di kolom barcode yang
-- diputar, lalu DIUJI SENDIRI: keempatnya cocok dengan pola '07216880' +
-- nomor ITEM 5 digit, dan DIGIT CEK EAN-13-nya sah di keempatnya. Dua uji
-- yang saling bebas.
--
-- sni_no SENGAJA TIDAK DIISI. Yang tercetak di artwork cuma logo SNI dan
-- kode LEMBAGA SERTIFIKASI (LSPr-036-IDN) -- itu bukan nomor SNI produknya.
-- Mengisinya berarti menebak nomor sertifikat, kelas kesalahan yang sudah
-- tercatat dua kali di berkas-berkas ini.
--
-- 0105045809738ID stok labelnya BEDA (lembar 297x180, bukan 101x226) dan
-- lapisan teksnya cuma 5 span, jadi untuk dia HANYA ean yang diisi.
-- ---------------------------------------------------------------------
select public.label_master_panen('[
 {"erp":"0105045809703ID","size":"10.00R20","pr":"18PR","ttl":"ALL STEEL TUBE TYPE",
  "ean":"0721688043362","npb1":"99:2019","npb3":"1-132-003-26000603-5","labelSize":"101x226mm"},
 {"erp":"0105045809716ID","size":"11.00R20","pr":"18PR","ttl":"ALL STEEL TUBE TYPE",
  "ean":"0721688043485","npb1":"99:2019","npb3":"1-132-003-26000603-5","labelSize":"101x226mm"},
 {"erp":"0105045809319ID","size":"12.00R20","pr":"20PR","ttl":"ALL STEEL TUBE TYPE",
  "ean":"0721688038757","npb1":"99:2019","npb3":"1-132-003-26000135-5","labelSize":"101x226mm"},
 {"erp":"0105045809738ID","ean":"0721688043706"}
]'::jsonb, 'ARTWORK-SNI-9NOV');

-- DIBACA ULANG DAN DIADU MEDAN PER MEDAN ke artworknya, bukan dilaporkan
-- sebagai jumlah baris. 21 dari 21 cocok (size, ply, tt, ean, npb1, npb3,
-- label_size pada tiga ERP berstok 101x226).
--
-- Catatan pelajaran, sama dengan items_backfill_label.sql: yang menemukan
-- bahwa tujuh medan ini kosong BUKAN pemeriksaan sendiri, melainkan langkah
-- berikutnya yang mencoba MEMAKAI datanya.
-- =====================================================================
