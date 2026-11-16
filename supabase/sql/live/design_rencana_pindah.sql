-- design_rencana_pindah
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) c9f875bced74

CREATE OR REPLACE FUNCTION public.design_rencana_pindah(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id::text,
           'drive_id', substring(d.drive_url from 'file/d/([A-Za-z0-9_-]+)'),
           'nama_baru', public.dsg_nama_file(d.erp, d.spec)) order by d.erp nulls last), '[]'::jsonb)
    into v
    from public.designs d
   where d.thumb like 'https://drive.google.com/thumbnail%'
     and d.drive_asal is null
     and d.drive_url like '%file/d/%';
  return v;
end $function$
