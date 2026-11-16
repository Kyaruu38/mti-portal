-- sup_cocok
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 388e095f540e

CREATE OR REPLACE FUNCTION public.sup_cocok(p_nama text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select case
    when (select count(*) from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama))) = 1
      then (select s.id from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama)))
    when (select count(*) from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama))) = 0
     and (select count(*) from public.suppliers s where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))=upper(regexp_replace(p_nama,'[^A-Za-z0-9]','','g'))) = 1
      then (select s.id from public.suppliers s where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))=upper(regexp_replace(p_nama,'[^A-Za-z0-9]','','g')))
  end;
$function$
