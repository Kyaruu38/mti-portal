-- create_surat_jalan
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 6454707741c6

CREATE OR REPLACE FUNCTION public.create_surat_jalan(p_sj jsonb)
 RETURNS surat_jalan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item     jsonb;
  v_po       record;
  v_ordered  numeric;
  v_shipped  numeric;
  v_row      public.surat_jalan;
begin
  -- HANYA pemeriksaan NULL. Daftar perannya sudah ada di bawah dan
  -- TIDAK disentuh — yang bocor cuma logika tiga-nilai SQL: current_role()
  -- mengembalikan NULL untuk pemanggil tanpa profil, dan
  -- NULL not in ('wilbert','cania','visca') bernilai NULL, bukan TRUE, jadi
  -- cabang raise-nya tidak pernah jalan. Penjaga yang terbaca benar dan
  -- mandul persis untuk pemanggil yang paling perlu dihentikan.
  if public.current_role() is null then
    raise exception 'Akun tidak dikenal tidak boleh membuat surat jalan'
      using errcode = 'insufficient_privilege';
  end if;
  if public.current_role() not in ('wilbert', 'cania', 'visca') then
    raise exception 'only purchasing may create a surat jalan';
  end if;

  -- Kunci setiap PO yang dirujuk selama transaksi ini. Dua panggilan bersamaan
  -- jadi antre di sini, bukan sama-sama membaca total sebelum pengiriman.
  for v_po in
    select * from public.pos
     where id = any (select (jsonb_array_elements_text(p_sj -> 'poIds'))::uuid)
     for update
  loop
    null;
  end loop;

  -- Per baris: qty dipesan dari pos.items, yang sudah terkirim dari surat_jalan.
  for v_item in select * from jsonb_array_elements(p_sj -> 'items')
  loop
    select ((l ->> 'qty')::numeric - coalesce((l ->> 'receivedDirect')::numeric, 0)) into v_ordered
      from public.pos p, jsonb_array_elements(p.items) l
     where p.id = (v_item ->> 'poId')::uuid
       and l ->> 'lineId' = v_item ->> 'lineId';

    if v_ordered is null then
      raise exception 'PO line % not found on PO %', v_item ->> 'lineId', v_item ->> 'poId';
    end if;

    select coalesce(sum((i ->> 'qtyShipped')::numeric), 0) into v_shipped
      from (select * from public.surat_jalan where coalesce(status, 'aktif') <> 'batal') sj, jsonb_array_elements(sj.items) i
     where i ->> 'poId'   = v_item ->> 'poId'
       and i ->> 'lineId' = v_item ->> 'lineId';

    if v_shipped + (v_item ->> 'qtyShipped')::numeric > v_ordered + 0.000001 then
      raise exception
        'over-delivery blocked: line % ordered %, already shipped %, this document adds %',
        v_item ->> 'lineId', v_ordered, v_shipped, v_item ->> 'qtyShipped';
    end if;
  end loop;

  insert into public.surat_jalan (doc_no, no, supplier, po_no, items, created_by)
  values (
    p_sj ->> 'docNo', p_sj ->> 'no', p_sj ->> 'supplier',
    p_sj ->> 'poNo',  coalesce(p_sj -> 'items', '[]'::jsonb),
    public.current_username()          -- <-- YANG DITAMBAHKAN
  )
  returning * into v_row;

  return v_row;
end;
$function$
