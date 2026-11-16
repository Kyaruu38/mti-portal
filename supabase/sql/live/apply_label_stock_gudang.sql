-- apply_label_stock_gudang
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 562fc5718331

CREATE OR REPLACE FUNCTION public.apply_label_stock_gudang(p_gudang text, p_upload jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_upload_id uuid;
begin
  if not public.is_label_staff() then
    raise exception 'only label staff may upload label stock';
  end if;
  if p_gudang is null or p_gudang = '' then
    raise exception 'gudang wajib dipilih';
  end if;
  if not exists (select 1 from public.label_gudang g where g.kode = p_gudang and g.aktif) then
    raise exception 'gudang % tidak dikenal', p_gudang;
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'upload kosong';
  end if;
  insert into public.label_stock_uploads
    (file_name, sheet_name, week_of, rows_total, rows_imported, rows_duplicate, rows_mismatch, duplicates, gudang)
  values (p_upload ->> 'file_name', p_upload ->> 'sheet_name', nullif(p_upload ->> 'week_of','')::date,
          coalesce((p_upload ->> 'rows_total')::int,0), coalesce((p_upload ->> 'rows_imported')::int,0),
          coalesce((p_upload ->> 'rows_duplicate')::int,0), coalesce((p_upload ->> 'rows_mismatch')::int,0),
          coalesce(p_upload -> 'duplicates','[]'::jsonb), p_gudang)
  returning id into v_upload_id;
  insert into public.label_stock_gudang
    (spec_name, market_code, gudang, stock, last_upload_id, last_seen_at, missing_from_last_upload, updated_at)
  select i ->> 'spec_name', coalesce(i ->> 'market_code',''), p_gudang,
         coalesce((i ->> 'stock')::numeric,0), v_upload_id, now(), false, now()
  from jsonb_array_elements(p_items) i
  on conflict (spec_name, market_code, gudang) do update set
    stock = excluded.stock, last_upload_id = excluded.last_upload_id,
    last_seen_at = excluded.last_seen_at, missing_from_last_upload = false, updated_at = now();
  update public.label_stock_gudang s set missing_from_last_upload = true
   where s.gudang = p_gudang and s.last_upload_id is distinct from v_upload_id;
  insert into public.label_stock (spec_name, market_code, stock, stock_sumber, updated_at)
  select distinct i ->> 'spec_name', coalesce(i ->> 'market_code',''), 0, 'gudang', now()
  from jsonb_array_elements(p_items) i
  on conflict (spec_name, market_code) do nothing;
  update public.label_stock m
     set stock = t.jml, stock_sumber = 'gudang', last_upload_id = v_upload_id,
         last_seen_at = now(), missing_from_last_upload = false, updated_at = now()
    from (select g.spec_name, g.market_code, sum(g.stock) as jml
            from public.label_stock_gudang g
           where (g.spec_name, g.market_code) in (
                 select i ->> 'spec_name', coalesce(i ->> 'market_code','')
                   from jsonb_array_elements(p_items) i)
           group by g.spec_name, g.market_code) t
   where m.spec_name = t.spec_name and m.market_code = t.market_code;
  insert into public.label_stock_history
    (upload_id, spec_name, market_code, erp, stock, planned_production, planned_sales,
     buffer_pct, requirement, surplus, reorder_status, suggested_qty)
  select v_upload_id, s.spec_name, s.market_code, s.erp, s.stock, s.planned_production,
         s.planned_sales, s.buffer_pct, s.requirement, s.surplus, s.reorder_status, s.suggested_qty
  from public.label_stock s where s.last_upload_id = v_upload_id;
  return v_upload_id;
end;
$function$
