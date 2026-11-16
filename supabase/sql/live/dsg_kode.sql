-- dsg_kode
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 127270c4ba0d

CREATE OR REPLACE FUNCTION public.dsg_kode(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select public.dsg_norm(substring(replace(replace(coalesce(t,''), '【','['), '】',']') from '\[([^\]]+)\]'))
$function$
