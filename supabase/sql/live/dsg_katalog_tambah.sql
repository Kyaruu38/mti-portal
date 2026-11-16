-- dsg_katalog_tambah
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) eb8ff6aee536

CREATE OR REPLACE FUNCTION public.dsg_katalog_tambah(p_erp text, p_spec text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  insert into public.dsg_katalog (erp, spec, nrm, kode, sig, merek)
  select trim(p_erp), trim(p_spec),
         public.dsg_norm(p_spec), public.dsg_kode(p_spec),
         public.dsg_sig(p_spec),  public.dsg_brand(p_spec)
   where coalesce(trim(p_erp),'') <> '' and coalesce(trim(p_spec),'') <> ''
  on conflict (erp, spec) do nothing;
$function$
