-- =============================================================================
-- "1 ERP = 1 DESIGN" — SISA PELANGGARAN TERAKHIR, DAN KENAPA CUMA SEPARUHNYA
-- YANG BOLEH DIBERESKAN SENDIRI.
--
-- Sesudah penggabungan v23.0, tinggal SATU ERP yang dipegang lebih dari satu
-- kartu: 01050458085ID, dipegang TIGA kartu.
--
--   87fa4b80  TRAZANO  (ID-TN-TBR-SNI)ID11R22.5-18PR(149/146L)[AZ850] TRAZANO TL
--   e4cdb703  TRAZANO  (ID-TN-TBR SNI)ID11R22.5− 18PR(149/146L)[AZ850] TRAZANO TL
--   b22c7f1a  ARISUN   (ID-ARISUN-TBR-SNI)ID12.00R20-18PR(154/151F)[CB919]ARISUN
--
-- DUA PERTAMA ADALAH BAN YANG SAMA, DITULIS DUA CARA. Bedanya cuma 'TBR SNI'
-- lawan 'TBR-SNI', tanda minus Unicode (U+2212) lawan hubung biasa, dan satu
-- spasi. Merek, ukuran, lapisan, indeks beban dan kode pola identik. Itu boleh
-- diberesi tanpa bertanya.
--
-- YANG KETIGA BUKAN URUSAN KARTU, ITU KESALAHAN KODE YANG SUDAH TERLANJUR
-- DIPAKAI MEMBELI. Dua PO berbeda menagih barang berbeda dengan ERP yang sama:
--   SNI-BSN-2409                  -> ARISUN 12.00R20
--   TRAZANO AZ850-BCL-SNI-2008    -> TRAZANO 11R22.5
-- label_stock menyebut ERP ini ARISUN; designs menyebutnya TRAZANO. Memilih
-- salah satunya berarti mengirim artwork yang salah ke mesin cetak untuk yang
-- satunya lagi. Tidak ada di data ini yang bisa menjawab mana yang benar —
-- yang tahu adalah orang yang memberi kode itu. JADI TIDAK DISENTUH.
--
-- TIDAK ADA YANG DIHAPUS. Kartu ejaan ganda cuma DILEPAS ERP-nya dan diberi
-- catatan yang menyebut kartu mana yang memegang ERP itu sekarang, supaya
-- keputusannya bisa dibalik kalau ternyata keliru.
-- =============================================================================

update designs set
  erp = null,
  catatan = coalesce(nullif(catatan,'') || ' | ', '') ||
    'ERP 01050458085ID dilepas 6 Nov 2026: kartu ini ejaan ganda dari kartu TRAZANO yang sama (TBR SNI vs TBR-SNI, tanda minus Unicode). Kartu yang dipegang ERP-nya: 87fa4b80. Tidak ada yang dihapus - kembalikan ERP-nya kalau ternyata ini memang kartu yang berbeda.',
  updated = now()
where id::text like 'e4cdb703%';

-- Baris items untuk ERP yang bentrok ditandai supaya tidak dipakai mencetak
-- sebelum manusianya memutuskan.
update items set
  terakhir_dari = 'BENTROK - ERP ini dipakai DUA produk berbeda: ARISUN 12.00R20 (PO SNI-BSN-2409) dan TRAZANO 11R22.5 (PO TRAZANO AZ850-BCL-SNI-2008). Jangan dipakai mencetak sebelum diputuskan.',
  updated_at = now()
where erp = '01050458085ID';
