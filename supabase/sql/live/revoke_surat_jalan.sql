-- revoke_surat_jalan
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 9ccaf018c6ee

CREATE OR REPLACE FUNCTION public.revoke_surat_jalan(p_id uuid, p_reason text)
 RETURNS surat_jalan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.surat_jalan;
begin
  if not public.is_purchasing() then raise exception 'only purchasing may revoke a surat jalan'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'alasan wajib diisi'; end if;
  select * into v_row from public.surat_jalan where id = p_id for update;
  if not found then raise exception 'surat jalan tidak ditemukan'; end if;
  if coalesce(v_row.status, 'aktif') = 'batal' then raise exception 'surat jalan % sudah dibatalkan', v_row.no; end if;
  update public.surat_jalan set status='batal', revoked_by=public.current_username(), revoked_at=now(), revoke_reason=btrim(p_reason)
   where id = p_id returning * into v_row;
  return v_row;
end $function$
