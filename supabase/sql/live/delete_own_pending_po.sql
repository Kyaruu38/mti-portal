-- delete_own_pending_po
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 73c345e25671

CREATE OR REPLACE FUNCTION public.delete_own_pending_po(p_po_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner  text;
  v_status text;
  v_no     text;
begin
  select created_by, status, no
    into v_owner, v_status, v_no
  from public.pos
  where id = p_po_id and deleted_at is null;
  if not found then
    raise exception 'PO tidak ditemukan atau sudah dihapus'
      using errcode = 'no_data_found';
  end if;
  if v_owner is distinct from public.current_username() then
    raise exception 'PO % bukan milikmu — hanya pembuatnya yang boleh menghapus sendiri', coalesce(v_no, '(tanpa nomor)')
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(v_status, '') <> 'Menunggu Approval' then
    raise exception 'PO % statusnya % — penghapusan harus lewat Request Delete dan disetujui Supervisor', coalesce(v_no, '(tanpa nomor)'), coalesce(v_status, '(kosong)')
      using errcode = 'insufficient_privilege';
  end if;
  update public.pos
     set deleted_at          = now(),
         delete_requested    = false,
         delete_reason       = coalesce(nullif(btrim(p_reason), ''), 'dihapus sendiri oleh pembuat sebelum approval'),
         delete_requested_by = public.current_username(),
         delete_requested_at = now()
   where id = p_po_id;
end;
$function$
