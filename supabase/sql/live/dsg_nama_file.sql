-- dsg_nama_file
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) f96bc609f95c

CREATE OR REPLACE FUNCTION public.dsg_nama_file(p_erp text, p_spec text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select left(
    btrim(regexp_replace(
      replace(
        case when coalesce(p_erp,'') <> '' then p_erp || ' - ' else '(TANPA ERP) ' end
        || coalesce(nullif(p_spec,''), 'tanpa nama'),
      '/', '-'),
      '\s+', ' ', 'g')
    ), 180) || '.pdf'
$function$
