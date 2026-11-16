-- pos_guard_status
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 910c1603197f

CREATE OR REPLACE FUNCTION public.pos_guard_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status      is distinct from old.status
  or new.approved_by is distinct from old.approved_by
  or new.approved_at is distinct from old.approved_at then
    if auth.uid() is not null and public.current_role() <> 'wilbert' then
      raise exception 'Hanya Supervisor yang boleh mengubah status PO (percobaan oleh %)',
        coalesce(public.current_role(), '?') using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $function$
