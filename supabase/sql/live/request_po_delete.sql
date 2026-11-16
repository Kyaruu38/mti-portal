-- request_po_delete
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) ea2b5560cf2f

CREATE OR REPLACE FUNCTION public.request_po_delete(p_po_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner text;
begin
  -- Menyalakan jalan keluar untuk pos_guard_approved(): permintaan hapus
  -- atas PO yang SUDAH disetujui itu sah, dan kepemilikannya diperiksa di
  -- bawah. Transaction-local, jadi mati sendiri di akhir transaksi.
  perform set_config('mti.po_permintaan_hapus', 'ya', true);
  select created_by into v_owner from public.pos where id = p_po_id;
  if v_owner is null then raise exception 'PO not found'; end if;
  if v_owner <> public.current_username() and not public.is_admin() then
    raise exception 'only the PO creator or admin may request deletion';
  end if;
  update public.pos set delete_requested = true, delete_reason = p_reason,
    delete_requested_by = public.current_username(), delete_requested_at = now()
  where id = p_po_id;
end;
$function$
