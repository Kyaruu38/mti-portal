-- dsg_kembar
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 4c4d58bd5a08

CREATE OR REPLACE FUNCTION public.dsg_kembar(a text, b text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select public.dsg_norm(a) = public.dsg_norm(b)
      or ( public.dsg_kode(a) <> '' and public.dsg_kode(a) = public.dsg_kode(b)
           and length(public.dsg_sig(a)) >= 4 and length(public.dsg_sig(b)) >= 4
           and ( left(public.dsg_sig(a), length(public.dsg_sig(b))) = public.dsg_sig(b)
              or left(public.dsg_sig(b), length(public.dsg_sig(a))) = public.dsg_sig(a) )
           and public.dsg_brand(a) <> '' and public.dsg_brand(a) = public.dsg_brand(b) )
$function$
