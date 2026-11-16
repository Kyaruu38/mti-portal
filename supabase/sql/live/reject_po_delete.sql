-- reject_po_delete
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 655167391948

CREATE OR REPLACE FUNCTION public.reject_po_delete(p_po_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'only wilbert can reject PO deletion'; end if;
  update public.pos set delete_requested = false, delete_reason = null,
    delete_requested_by = null, delete_requested_at = null
  where id = p_po_id;
end;
$function$
