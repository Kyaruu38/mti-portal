-- padat_pola
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 08d9f8b64ded

CREATE OR REPLACE FUNCTION public.padat_pola(s text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select upper(regexp_replace(coalesce(s,''), '[^A-Za-z0-9+]', '', 'g'));
$function$
