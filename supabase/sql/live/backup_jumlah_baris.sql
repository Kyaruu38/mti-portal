-- backup_jumlah_baris
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) b60856ee0393

CREATE OR REPLACE FUNCTION public.backup_jumlah_baris()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET statement_timeout TO '60s'
AS $function$
declare
  t record;
  n bigint;
  hasil jsonb := '{}'::jsonb;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format('select count(*) from public.%I', t.tbl) into n;
    hasil := hasil || jsonb_build_object(t.tbl, n);
  end loop;
  return hasil;
end
$function$
