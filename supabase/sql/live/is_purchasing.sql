-- is_purchasing
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 7382aa00fc27

CREATE OR REPLACE FUNCTION public.is_purchasing()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select public.current_role() in ('wilbert','cania','visca') $function$
