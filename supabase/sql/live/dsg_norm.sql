-- dsg_norm
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 24ff24051f5d
--
-- 2026-11-16: 无内 DILIPAT KE 'TL' SEBELUM APA PUN YANG LAIN.
--   无内 dan TL itu barang yang sama (tubeless) dan sebelum ini BUKAN
--   kunci yang sama. Han dibuang oleh pola [^A-Za-z0-9], jadi:
--       '[AR200]ARROYO无内'  ->  AR200ARROYO
--       '[AR200]ARROYO TL'   ->  AR200ARROYOTL     <- beda
--   Sekarang dua-duanya AR200ARROYOTL.
--
--   Diukur: 2.519 tulisan berbeda di items + designs + label_stock + pos
--   ternyata cuma 2.383 barang; 122 barang punya 2-3 ejaan.
--
--   DEPENDENSI DIPERIKSA DULU: tidak ada index, generated column, view,
--   matview atau constraint yang memakai dsg_norm — cuma fungsi lain
--   (dsg_kode, dsg_kembar, dsg_brand, design_cocok, dsg_katalog_*).
--   Jadi tidak ada index yang diam-diam jadi salah.
--
--   TAPI dsg_katalog.nrm ADALAH NILAI TERSIMPAN hasil fungsi ini, dan
--   1.192 dari 2.634 barisnya langsung jadi basi begitu fungsinya
--   diganti. dsg_katalog_segarkan() SUDAH dijalankan sesudah ini:
--   2.634 -> 2.634 baris (nol hilang), nrm basi 1.192 -> 0, nrm unik
--   2.354 -> 2.041 (313 kunci yang tadinya kepecah sekarang nyatu).
--   KALAU FUNGSI INI DIUBAH LAGI, SEGARKAN KATALOGNYA LAGI.

CREATE OR REPLACE FUNCTION public.dsg_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$ select upper(regexp_replace(replace(coalesce(t,''), '无内', 'TL'), '[^A-Za-z0-9]', '', 'g')) $function$;
