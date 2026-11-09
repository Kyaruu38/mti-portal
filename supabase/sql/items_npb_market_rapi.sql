-- =====================================================================
-- items_npb_market_rapi.sql                        9 Nov 2026
--
-- DUA MEDAN YANG MENENTUKAN APA YANG TERCETAK, DAN DUA-DUANYA SALAH.
--
-- Ketemu waktu menyiapkan generator artwork: generator memilih template
-- lewat items.market, dan mengisi dua baris teks NPB di label SNI lewat
-- items.npb1/npb3. Jadi keduanya diperiksa sebelum dipakai, bukan sesudah.
--
-- ---------------------------------------------------------------------
-- 1. NPB: SERI SERTIFIKAT DUDUK DI MEDAN BARIS PERTAMA.
--
-- Lembar order memisahkan keduanya dengan tegas, dan bentuknya beda jauh:
--     First line of NPB  = '99:2019'   / '100:2019'    <- nomor standar
--     Third line of NPB  = '1-132-003-26000603-5'      <- seri sertifikat
--
-- Di basis data: npb1 terisi 150 baris, dan 150 DARI 150 berbentuk SERI
-- SERTIFIKAT. Nol berbentuk nomor standar. npb3 kosong di seluruh 1.560
-- baris. Artinya seluruh isi npb1 sebenarnya baris KETIGA, dan baris
-- pertamanya tidak ada sama sekali.
--
-- Asalnya backfill v23.4: berkas master EAN cuma punya SATU kolom NPB
-- (serinya), dan SQL-nya menuliskannya ke npb1. Sisa dari kelas kesalahan
-- yang sama dengan geseran kolom yang sudah dicatat di
-- items_backfill_label.sql -- dan sekali lagi yang menemukannya adalah
-- LANGKAH BERIKUTNYA yang membaca datanya, bukan pemeriksaan sendiri.
--
-- Dipindah lewat BENTUK, bukan asumsi. Yang tidak berbentuk seri tidak
-- disentuh; kalau suatu hari npb1 berisi '100:2019' yang benar, dia tetap
-- di tempatnya.
-- ---------------------------------------------------------------------
update public.items
   set npb3 = npb1, npb1 = null, updated_at = now()
 where npb1 ~ '^[0-9]+(-[0-9]+){3,4}$';
-- hasil: npb1 0, npb3 150, semuanya berbentuk seri. npb1 akan terisi
-- sendiri dari lembar order berikutnya, yang memang membawa '100:2019'.

-- ---------------------------------------------------------------------
-- 2. MARKET: 87 EJAAN UNTUK ENAM KODE PASAR.
--
-- Diukur: 1.560 baris, 87 nilai market berbeda. 702 di antaranya
-- menyimpan PREFIKS PENUH nama barang -- '(ID-WL-TBR-PT)' -- sebagai kode
-- pasar. 32 baris isinya cuma tanda hubung. Cuma 540 yang bersih.
--
-- Sebabnya parser lebih memercayai kolom market lembar order daripada
-- hasil urai namanya (`kolom || parsed.market`), dan di sebagian lembar
-- kolom itu memang diisi prefiks penuh.
--
-- Kode pasarnya adalah SEGMEN TERAKHIR prefiks, aturan yang sudah dipakai
-- parseItemName() sejak awal. Diturunkan, bukan ditebak: 702 baris
-- menghasilkan tepat enam kode tanpa sisa --
--     SNI 291 | PT 200 | OEM 150 | BX 47 | ATD 12 | ZCTJ 2
--
-- 308 baris market-nya tetap NULL dan DIBIARKAN begitu: diperiksa, dan
-- SELURUH 308 itu tidak punya name_en maupun name_zh, jadi tidak ada
-- apa pun untuk diturunkan. Menebak pasar berarti menebak template, dan
-- template yang salah mencetak label yang salah.
-- ---------------------------------------------------------------------
update public.items
   set market = upper(btrim(regexp_replace(market, '^.*-([A-Za-z]+)\)$', '\1'))),
       updated_at = now()
 where market ~ '^\(ID-.*-[A-Za-z]+\)$';

update public.items set market = null, updated_at = now()
 where market ~ '^[—–-]+$' or btrim(coalesce(market,'')) = '';
-- hasil: 87 varian jadi 10 --
--   PT 439 | SNI 436 | (NULL) 308 | OEM 260 | BX 92 | ATD 13
--   EU 7 | PT-ST 2 | ZCTJ 2 | BX-PCR 1
-- PT-ST, BX-PCR, EU dan ZCTJ DIBIARKAN apa adanya: itu kode dari sumber,
-- bukan ejaan rusak, dan tidak ada dasar untuk melipatnya ke PT/BX.

-- ---------------------------------------------------------------------
-- KESIAPAN DATA PER PASAR SESUDAH DIRAPIKAN -- diukur, bukan diperkirakan.
-- Ini yang membatasi generator artwork, bukan perendernya.
--
--   PT  n=439 | ean 11  size 4   pola 436 load 276 ply 58  tt 58
--             | sni 0   npb3 0   | rr 0 wg 0 noise 0
--   SNI n=436 | ean 125 size 124 pola 432 load 336 ply 124 tt 124
--             | sni 125 npb3 125 | rr 0 wg 0 noise 0
--   OEM n=260 | ean 4   size 0   pola 256 load 129 ply 1   tt 1
--   BX  n=92  | ean 26  size 20  pola 92  load 66  ply 21  tt 21
--             | rr 9 wg 0 noise 9 ncl 9
--
-- Jadi: SNI yang datanya PALING lengkap (125 baris siap cetak), tapi
-- templatenya belum pernah diukur. BX yang templatenya sudah diukur dari
-- 4 artwork asli, tapi cuma 20 dari 92 baris punya size dan NOL punya
-- wet grip -- padahal wet grip tercetak persis di sebelah RR.
-- =====================================================================
