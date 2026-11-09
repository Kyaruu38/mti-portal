-- =====================================================================
-- items_label_size_satu_ejaan.sql                  9 Nov 2026
--
-- UKURAN STOK LABEL DIPAKAI UNTUK MEMILIH TEMPLATE, JADI EJAANNYA HARUS SATU.
--
-- Sesudah 54 baris ukuran kertas dipindahkan ke label_size (v23.5), isinya
-- ditulis enam cara berbeda untuk hal yang sama:
--     '300*130mm'  '300X100MM'  '261X111mm'  '261x111mm'
--     '90x280mm'   '130 x 300 mm'
-- Pemisahnya '*', 'X' atau spasi; 'mm' kapital atau tidak.
--
-- Itu bukan soal rapi-rapian. Generator artwork memilih template lewat
-- PASANGAN (market, label_size) -- karena satu pasar punya lebih dari satu
-- ukuran stok, dan ukuran stok yang berbeda adalah TATA LETAK yang berbeda,
-- bukan versi lebih besar dari tata letak yang sama. '261X111mm' dan
-- '261x111mm' yang dihitung sebagai dua kunci berarti satu di antaranya
-- tidak menemukan template.
--
-- URUTAN ANGKANYA TIDAK DIUBAH. '130x300mm' dan '300x130mm' bisa saja label
-- yang sama ditulis terbalik, tapi bisa juga dua stok yang memang berbeda,
-- dan tidak ada apa pun di data ini yang bisa menjawabnya. Membalik urutan
-- berarti menebak, dan yang ditebak adalah template yang dipakai mencetak.
-- Dibiarkan terpisah dan dilaporkan.
-- ---------------------------------------------------------------------
update public.items
   set label_size = lower(regexp_replace(
         regexp_replace(btrim(label_size), '\s*[xX*×]\s*', 'x'), '\s*mm$', 'mm', 'i')),
       updated_at = now()
 where label_size is not null;

-- hasil, dan inilah gambaran sebenarnya untuk generator --
--   PT  300x130mm  17     <- belum ada artwork contoh
--   PT  300x100mm  12     <- belum ada
--   PT  261x111mm  10     <- SUDAH DIUKUR (4 artwork, 9 Nov 2026)
--   PT  110x280mm   8     <- belum ada
--   PT   90x280mm   3     <- belum ada
--   PT  180x100mm   2     <- belum ada
--   PT  130x300mm   1     <- belum ada; mungkin '300x130mm' terbalik, TIDAK DIPUTUSKAN
--   BX  247x90mm    1
--
-- Artinya 'template PT' bukan satu benda. PT punya TUJUH ukuran stok di
-- antara 53 baris yang punya label_size sama sekali -- 386 baris PT sisanya
-- belum punya. Empat artwork yang diukur semuanya 261x111mm, jadi yang
-- terbukti baru satu dari tujuh.
--
-- Cocok silang yang menguatkan ukurannya: keempat artwork mencetak sendiri
-- '261 mm' dan '111 mm' sebagai keterangan dimensi di tepi lembar, dan
-- SEPULUH baris items yang sama sekali tidak terlibat dalam pengukuran itu
-- menyimpan '261x111mm' di label_size. Dua sumber yang tidak saling tahu,
-- angka yang sama.
-- =====================================================================
