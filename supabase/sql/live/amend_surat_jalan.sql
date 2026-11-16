-- amend_surat_jalan
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) a67162a35107

CREATE OR REPLACE FUNCTION public.amend_surat_jalan(p_id uuid, p_items jsonb)
 RETURNS surat_jalan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.surat_jalan; v_item jsonb; v_po uuid; v_ordered numeric; v_shipped numeric;
begin
  if not public.is_purchasing() then raise exception 'only purchasing may amend a surat jalan'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items kosong - pakai revoke_surat_jalan untuk membatalkan'; end if;
  select * into v_row from public.surat_jalan where id = p_id for update;
  if not found then raise exception 'surat jalan tidak ditemukan'; end if;
  if coalesce(v_row.status, 'aktif') = 'batal' then raise exception 'surat jalan % sudah dibatalkan - tidak bisa diubah', v_row.no; end if;
  perform 1 from public.pos where id in (select distinct (i ->> 'poId')::uuid from jsonb_array_elements(p_items) i where i ->> 'poId' is not null) for update;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_po := (v_item ->> 'poId')::uuid;
    -- JATAHNYA DIKURANGI YANG SUDAH DITANDAI MANUAL di layar PO Outstanding.
    -- Penerimaan punya DUA pintu (surat jalan + receivedDirect) dan keduanya
    -- dijumlahkan di core/outstanding.js. Penjaga yang cuma menghitung surat
    -- jalan akan mengizinkan sisa yang sudah terpakai lewat pintu satunya.
    select ((l ->> 'qty')::numeric - coalesce((l ->> 'receivedDirect')::numeric, 0)) into v_ordered
      from public.pos p, jsonb_array_elements(p.items) l
     where p.id = v_po and l ->> 'lineId' = v_item ->> 'lineId';
    if v_ordered is null then raise exception 'baris % tidak ada di PO', v_item ->> 'lineId'; end if;
    select coalesce(sum((i ->> 'qtyShipped')::numeric), 0) into v_shipped
      from public.surat_jalan sj, jsonb_array_elements(sj.items) i
     where sj.id <> p_id and coalesce(sj.status, 'aktif') <> 'batal'
       and i ->> 'poId' = v_item ->> 'poId' and i ->> 'lineId' = v_item ->> 'lineId';
    if v_shipped + coalesce((v_item ->> 'qtyShipped')::numeric, 0) > v_ordered + 0.000001 then
      raise exception 'over-delivery blocked: line % allowance % already shipped % this document adds %',
        v_item ->> 'lineId', v_ordered, v_shipped, v_item ->> 'qtyShipped'; end if;
  end loop;
  update public.surat_jalan set items = p_items, amended_by = public.current_username(), amended_at = now()
   where id = p_id returning * into v_row;
  return v_row;
end $function$
