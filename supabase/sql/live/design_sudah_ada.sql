-- design_sudah_ada
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 9d1ec28c9b82

CREATE OR REPLACE FUNCTION public.design_sudah_ada(p_drive_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (select 1 from public.designs
                  where drive_url like '%' || p_drive_id || '%'
                     or drive_asal = p_drive_id)
$function$
