-- pos_guard_approved
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 7d6228d1f0e0

CREATE OR REPLACE FUNCTION public.pos_guard_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_boleh text[] := array['items'];
  v_lama  jsonb;
  v_baru  jsonb;
  v_beda  int;
begin
  if coalesce(old.status, '') <> 'Approved' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if public.current_role() = 'wilbert' then
    return new;
  end if;
  if coalesce(current_setting('mti.po_permintaan_hapus', true), '') = 'ya' then
    v_boleh := v_boleh || array['delete_requested', 'delete_reason',
                                'delete_requested_by', 'delete_requested_at'];
  end if;
  if (to_jsonb(new) - v_boleh) is distinct from (to_jsonb(old) - v_boleh) then
    raise exception 'PO % sudah disetujui — hanya Supervisor yang boleh mengubahnya (percobaan oleh %)',
      coalesce(old.no, '(tanpa nomor)'), coalesce(public.current_role(), '?')
      using errcode = 'insufficient_privilege';
  end if;
  v_lama := coalesce(old.items::jsonb, '[]'::jsonb);
  v_baru := coalesce(new.items::jsonb, '[]'::jsonb);
  if v_lama is distinct from v_baru then
    if jsonb_typeof(v_lama) <> 'array' or jsonb_typeof(v_baru) <> 'array' then
      raise exception 'PO % baris barangnya bukan daftar — data lama yang perlu dibetulkan Supervisor dulu',
        coalesce(old.no, '(tanpa nomor)')
        using errcode = 'insufficient_privilege';
    end if;
    if jsonb_array_length(v_lama) <> jsonb_array_length(v_baru) then
      raise exception 'PO % sudah disetujui — jumlah baris barangnya tidak boleh berubah (percobaan oleh %)',
        coalesce(old.no, '(tanpa nomor)'), coalesce(public.current_role(), '?')
        using errcode = 'insufficient_privilege';
    end if;
    select count(*) into v_beda
    from jsonb_array_elements(v_lama) with ordinality a(o, i)
    join jsonb_array_elements(v_baru) with ordinality b(n, j) on a.i = b.j
    where (a.o - 'receivedDirect' - 'receivedDirectAt' - 'lineId') is distinct from (b.n - 'receivedDirect' - 'receivedDirectAt' - 'lineId')
       or (coalesce(a.o->>'lineId', '') <> '' and coalesce(a.o->>'lineId','') is distinct from coalesce(b.n->>'lineId',''));
    if v_beda > 0 then
      raise exception 'PO % sudah disetujui — di baris barang hanya angka penerimaan yang boleh berubah, tapi % baris berubah di luar itu (percobaan oleh %)',
        coalesce(old.no, '(tanpa nomor)'), v_beda, coalesce(public.current_role(), '?')
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$function$
