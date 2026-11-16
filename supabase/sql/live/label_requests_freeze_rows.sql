-- label_requests_freeze_rows
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 1977961e0f7d

CREATE OR REPLACE FUNCTION public.label_requests_freeze_rows()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.rows is distinct from old.rows then
    raise exception 'baris permintaan tidak bisa diubah setelah dikirim';
  end if;
  if new.requested_by is distinct from old.requested_by then
    raise exception 'pemohon tidak bisa diubah';
  end if;
  if auth.uid() is not null and public.current_role() = 'sona' then
    if old.status is distinct from 'Diminta' or new.status is distinct from 'Ditolak' then
      raise exception 'sona hanya bisa membatalkan permintaannya sendiri yang masih Diminta' using errcode = 'insufficient_privilege';
    end if;
    if new.assigned_supplier is distinct from old.assigned_supplier or new.po_no is distinct from old.po_no then
      raise exception 'supplier dan nomor PO tidak bisa diubah lewat jalur pembatalan' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $function$
