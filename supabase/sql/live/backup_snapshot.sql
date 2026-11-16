-- backup_snapshot
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 231cd0edce20

CREATE OR REPLACE FUNCTION public.backup_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET statement_timeout TO '240s'
AS $function$
declare
  t record;
  rows_json jsonb;
  data jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
  n_tabel int := 0;
  sql_baris text;
  n_thumb int := 0;
  n_outbox int := 0;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname
  loop
    if t.tbl = 'designs' then
      sql_baris :=
        'select coalesce(jsonb_agg(case when x.drive_url is null then to_jsonb(x) '
        || 'else to_jsonb(x) - ''thumb'' end), ''[]''::jsonb) from public.designs x';
    elsif t.tbl = 'drive_outbox' then
      sql_baris :=
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.drive_outbox x '
        || 'where x.status is distinct from ''done'' or x.created_at > now() - interval ''30 days''';
    else
      sql_baris := format(
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x',
        t.tbl
      );
    end if;

    execute sql_baris into rows_json;

    data   := data   || jsonb_build_object(t.tbl, rows_json);
    counts := counts || jsonb_build_object(t.tbl, jsonb_array_length(rows_json));
    n_tabel := n_tabel + 1;
  end loop;

  select count(*) into n_thumb  from public.designs where drive_url is not null and thumb is not null;
  select count(*) into n_outbox from public.drive_outbox
    where status = 'done' and created_at <= now() - interval '30 days';

  return jsonb_build_object(
    'versi', 2,
    'skema', 'public',
    'dibuat_pada', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'jumlah_tabel', n_tabel,
    'jumlah_baris', counts,
    'dikecualikan', jsonb_build_object(
      'designs.thumb', jsonb_build_object(
        'baris', n_thumb,
        'sebab', 'base64 artwork; gambarnya ada di drive_url baris yang sama. Baris tanpa drive_url TIDAK dikecualikan.'
      ),
      'drive_outbox', jsonb_build_object(
        'baris', n_outbox,
        'sebab', 'antrean status done yang lebih tua dari 30 hari. Barisnya TETAP ADA di database, hanya tidak ikut file ini.'
      )
    ),
    'data', data
  );
end
$function$
