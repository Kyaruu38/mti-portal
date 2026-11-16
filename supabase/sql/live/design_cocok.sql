-- design_cocok
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 637884fda3ee

CREATE OR REPLACE FUNCTION public.design_cocok(p_nama text)
 RETURNS TABLE(erp text, spec text, cara text)
 LANGUAGE sql
 STABLE
AS $function$
  with f as (
    select regexp_replace(p_nama, '\.(pdf|PDF)$', '') as nama
  ), k as (
    select public.dsg_norm(nama) n, public.dsg_kode(nama) kd,
           public.dsg_sig(nama) sg, public.dsg_brand(nama) br from f
  ),
  persis as (
    select t.erp, t.spec, 'persis'::text as cara
      from public.dsg_katalog t, k where t.nrm = k.n
  ),
  longgar as (
    select t.erp, t.spec, 'kode+ukuran+merek'::text as cara
      from public.dsg_katalog t, k
     where k.kd <> '' and t.kode = k.kd
       and length(t.sig) >= 4 and length(k.sg) >= 4
       and ( left(k.sg, length(t.sig)) = t.sig or left(t.sig, length(k.sg)) = k.sg )
       and k.br <> '' and t.merek = k.br
  )
  select erp, spec, cara from persis
  union all
  select erp, spec, cara from longgar where not exists (select 1 from persis)
$function$
