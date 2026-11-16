-- is_internal
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) a2eb4cacbbd6

CREATE OR REPLACE FUNCTION public.is_internal()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() = any (array[
    'wilbert','cania','visca','sekar','financemti','sona','cenjc','warehousemti'
  ]);
$function$
