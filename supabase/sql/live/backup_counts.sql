-- backup_counts
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 0eda7bc2eb73

CREATE OR REPLACE FUNCTION public.backup_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  t record; n bigint; out_json jsonb := '{}'::jsonb;
begin
  for t in
    select c.relname as tbl
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  loop
    execute format('select count(*) from public.%I', t.tbl) into n;
    out_json := out_json || jsonb_build_object(t.tbl, n);
  end loop;
  return out_json;
end
$function$
