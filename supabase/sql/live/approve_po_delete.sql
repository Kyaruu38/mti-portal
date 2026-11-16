-- approve_po_delete
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 88401d344df5

CREATE OR REPLACE FUNCTION public.approve_po_delete(p_po_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'only wilbert can approve PO deletion'; end if;
  update public.pos set deleted_at = now() where id = p_po_id and delete_requested = true;
end;
$function$
