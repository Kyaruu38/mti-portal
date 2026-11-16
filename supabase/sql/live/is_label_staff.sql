-- is_label_staff
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) c77f684b9353

CREATE OR REPLACE FUNCTION public.is_label_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select public.current_role() in ('wilbert', 'cania', 'visca', 'sona')
$function$
