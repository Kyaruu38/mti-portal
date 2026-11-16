-- dsg_sig
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) ee7d2d893349

CREATE OR REPLACE FUNCTION public.dsg_sig(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(
           split_part(replace(replace(coalesce(t,''),'【','['),'】',']'), '[', 1),
           '[^0-9]', '', 'g')
$function$
