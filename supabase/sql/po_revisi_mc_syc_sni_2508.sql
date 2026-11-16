-- MC-SYC-SNI-2508 — revisi kuantitas yang tidak pernah tercatat di portal
-- DIJALANKAN SEKALI, 16 Nov 2026. Catatan, bukan migrasi.
--
-- KENAPA
-- 26 Agustus 2026 di grup WeChat "PT Shengyou and PT MTI": Wilbert menulis
-- "@Cania 3 update PO nya jadi per item 3000 ya can / untuk yang ban motor",
-- lalu PO revisinya dikirim ke Sheng You sebagai PDF (PO MC-SYC-SNI-2508.pdf
-- dan PO GOLDEN 58P-MC-SYC-2608.pdf, 16:59). Cania merevisinya, tapi
-- "pas itu ada problem di portal dan ga ke catet" — PO barunya hilang.
--
-- Separuhnya ternyata mendarat: GOLDEN 58P-MC-SYC-2608 memang ada di portal
-- (26 Agt 16:57, 1 baris, qty 3000) sebagai PO terpisah dari
-- GOLDEN 58P-MC-SYC-2508 (qty 1000). Yang TIDAK mendarat revisi 2508-nya.
--
-- BUKTI, BUKAN TEBAKAN
-- Ekspor sheet SEBELUM sinkron pertama (Downloads\LABEL ORDER TRACKER - DATA.csv,
-- baris 2948-2951) sudah memakai angka revisi untuk KEEMPAT barisnya: 3.000
-- semua. Portal masih memegang 2.000 di dua baris. Jadi sheet dan PDF sepakat,
-- dan yang ketinggalan cuma basis datanya.
--
-- Ekspor yang sama juga menyelamatkan satu angka yang sudah hilang: baris
-- 01050458095388ID pernah berisi terima 3.000 tanggal 2026-09-07. Angka itu
-- DIHAPUS sendiri oleh sinkron 16 Nov — push-nya ditolak ("DITOLAK: 3000 lewat
-- dari pesanan 2000"), dan jalur tolak memang menimpa kolom J/K dengan nilai
-- portal. Benar sebagai perilaku, tapi artinya bukti penerimaannya ikut hilang
-- dari sheet. Dipulihkan dari ekspor itu, bukan dikarang.
--
-- YANG DIUBAH (harga satuan 850/pc TIDAK berubah)
--   items[0] 01050458095388ID  qty 2000 -> 3000,  a 1.700.000 -> 2.550.000
--   items[1] 010504580901ID    qty 2000 -> 3000,  a 1.700.000 -> 2.550.000
--   items[2] dan items[3] sudah 3000, tidak disentuh
--   subtotal 8.500.000 -> 10.200.000   (ppn 0, ppn_mode 'suspended')
--   total    8.500.000 -> 10.200.000
--
-- AKIBAT YANG DISENGAJA: items[1] punya surat jalan 2.000 (27 Okt), jadi
-- barisnya pindah dari "Complete" ke "Partial" — 1.000 memang masih kurang.
-- Itu bukan efek samping, itu isi revisinya.
--
-- Sesudah ini kolom J/K baris 05388ID diisi balik di sheet (3.000, 2026-09-07)
-- lalu _jalan() dijalankan: "1 baris dikirim balik (1 diterima)".

begin;

create table if not exists public.po_revisi_2508_backup as
  select now() as dicadangkan, p.*
    from public.pos p
   where p.no = 'MC-SYC-SNI-2508' and p.deleted_at is null;

-- Penjaganya sengaja ketat: kalau bentuk barisnya tidak persis seperti yang
-- sudah diperiksa, update-nya kena NOL baris dan bukan baris yang salah.
update public.pos p
   set items = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
                 p.items,
                 '{0,qty}', to_jsonb(3000)),
                 '{0,a}',   to_jsonb(2550000)),
                 '{1,qty}', to_jsonb(3000)),
                 '{1,a}',   to_jsonb(2550000)),
       subtotal = 10200000,
       total    = 10200000
 where p.no = 'MC-SYC-SNI-2508'
   and p.deleted_at is null
   and (p.items->0->>'erp') = '01050458095388ID'
   and (p.items->1->>'erp') = '010504580901ID'
   and (p.items->0->>'qty') = '2000'
   and (p.items->1->>'qty') = '2000'
   and (p.items->0->>'u')   = '850'
   and (p.items->1->>'u')   = '850';

commit;

-- Hasil sesudah dijalankan:
--   4 baris semuanya qty=3000 a=2550000; subtotal = total = jumlah baris
--   = 10.200.000; po_revisi_2508_backup berisi 1 baris.
--   Portal: 01050458095388ID terima 3000 tanggal 2026-09-07.
--   Sheet : I=3.000 di keempat baris, nol catatan "DITOLAK" tersisa.

-- ---------------------------------------------------------------------------
-- TABEL CADANGANNYA SUDAH DIBUANG 16 Nov 2026 atas permintaan Kyaru, SESUDAH
-- isinya dibandingkan baris per baris dengan catatan di atas dan sama persis:
--   0: 01050458095388ID qty=2000 u=850 a=1700000
--   1: 010504580901ID   qty=2000 u=850 a=1700000
--   2: 0105045809450ID  qty=3000 u=850 a=2550000
--   3: 010504580914ID   qty=3000 u=850 a=2550000
--   subtotal = total = 8.500.000
-- Jadi yang hilang cuma salinannya, bukan datanya: seluruh keadaan sebelum
-- revisi ada di berkas ini, dan blok di bawah mengembalikannya persis.
--
-- CARA MEMBALIKKAN (kalau PDF revisinya ternyata bukan 3000 per item):
-- buang tanda -- di depan tiap baris, lalu jalankan sekali.
--
-- begin;
-- update public.pos p
--    set items = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
--                  p.items,
--                  '{0,qty}', to_jsonb(2000)),
--                  '{0,a}',   to_jsonb(1700000)),
--                  '{1,qty}', to_jsonb(2000)),
--                  '{1,a}',   to_jsonb(1700000)),
--        subtotal = 8500000,
--        total    = 8500000
--  where p.no = 'MC-SYC-SNI-2508'
--    and p.deleted_at is null
--    and (p.items->0->>'erp') = '01050458095388ID'
--    and (p.items->1->>'erp') = '010504580901ID';
-- commit;
--
-- Catatan: membalikkan PO TIDAK membalikkan sheet. Penerimaan 3.000 tanggal
-- 2026-09-07 di baris 05388ID akan langsung ditolak lagi oleh sheet_label_push
-- ("3000 lewat dari pesanan 2000") dan kolom J/K-nya ikut dikosongkan lagi.
