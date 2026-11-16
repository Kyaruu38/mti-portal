-- dsg_katalog_segarkan
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 1ac3ba817c3b

CREATE OR REPLACE FUNCTION public.dsg_katalog_segarkan()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare v_lama int; v_baru int;
begin
  select count(*) into v_lama from public.dsg_katalog;

  create temp table _kat_baru on commit drop as
  with mentah as (
    -- PO: nama Inggris (d) DAN nama Mandarin (cn), dua-duanya diindeks
    select it->>'erp' as erp, it->>'d' as spec from public.pos p, jsonb_array_elements(p.items) it
    union all
    select it->>'erp' as erp, it->>'cn' as spec from public.pos p, jsonb_array_elements(p.items) it
    union all
    select erp, spec_name as spec from public.label_stock
  )
  select distinct
         trim(erp) as erp,
         trim(spec) as spec,
         public.dsg_norm(spec)  as nrm,
         public.dsg_kode(spec)  as kode,
         public.dsg_sig(spec)   as sig,
         public.dsg_brand(spec) as merek
    from mentah
   where coalesce(trim(erp),'') <> '' and coalesce(trim(spec),'') <> '';

  select count(*) into v_baru from _kat_baru;

  delete from public.dsg_katalog;
  insert into public.dsg_katalog (erp, spec, nrm, kode, sig, merek)
       select erp, spec, nrm, kode, sig, merek from _kat_baru;

  analyze public.dsg_katalog;

  return jsonb_build_object(
    'sebelum', v_lama, 'sesudah', v_baru,
    'erp', (select count(distinct erp) from public.dsg_katalog),
    'ada_mandarin', (select count(*) from public.dsg_katalog where spec ~ '[\u4e00-\u9fff]'),
    'tanpa_merek', (select count(*) from public.dsg_katalog where coalesce(merek,'')='')
  );
end $function$
