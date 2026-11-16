-- trg_audit_log
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 05ec37a1c8b0

CREATE OR REPLACE FUNCTION public.trg_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_target text;
  v_detail text;
  v_old jsonb;
  v_new jsonb;
begin
  v_old := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end;
  v_new := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end;

  v_target := coalesce(
    (coalesce(v_new, v_old))->>'no',
    (coalesce(v_new, v_old))->>'name',
    (coalesce(v_new, v_old))->>'id'
  );

  if TG_OP = 'INSERT' then
    v_detail := 'created';
  elsif TG_OP = 'DELETE' then
    v_detail := 'deleted';
  else
    select string_agg(format('%s: %s -> %s', o.key, o.value, n.value), '; ')
    into v_detail
    from jsonb_each_text(v_old) o
    join jsonb_each_text(v_new) n on o.key = n.key
    where o.value is distinct from n.value;
    v_detail := coalesce(v_detail, 'no field changes');
  end if;

  insert into public.audit_log (username, entity, target, action, detail, status)
  values (public.current_username(), TG_TABLE_NAME, v_target, lower(TG_OP), left(v_detail, 500), null);

  return coalesce(NEW, OLD);
end;
$function$
