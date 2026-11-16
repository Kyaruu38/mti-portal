-- apply_label_rencana
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 670d5d1b19b8

CREATE OR REPLACE FUNCTION public.apply_label_rencana(p_upload jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_upload_id uuid;
begin
  if not public.is_label_staff() then
    raise exception 'only label staff may upload label plans';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'upload kosong';
  end if;
  insert into public.label_stock_uploads
    (file_name, sheet_name, week_of, rows_total, rows_imported, rows_duplicate, rows_mismatch, duplicates)
  values (p_upload ->> 'file_name', p_upload ->> 'sheet_name', nullif(p_upload ->> 'week_of','')::date,
          coalesce((p_upload ->> 'rows_total')::int,0), coalesce((p_upload ->> 'rows_imported')::int,0),
          coalesce((p_upload ->> 'rows_duplicate')::int,0), coalesce((p_upload ->> 'rows_mismatch')::int,0),
          coalesce(p_upload -> 'duplicates','[]'::jsonb))
  returning id into v_upload_id;
  insert into public.label_stock
    (spec_name, market_code, stock, stock_sumber, planned_production, planned_sales, buffer_pct,
     requirement, surplus, reorder_status, suggested_qty,
     calc_requirement, calc_surplus, calc_status, calc_suggested, updated_at)
  select i ->> 'spec_name', coalesce(i ->> 'market_code',''), 0, 'tracker',
         coalesce((i ->> 'planned_production')::numeric,0), coalesce((i ->> 'planned_sales')::numeric,0),
         coalesce((i ->> 'buffer_pct')::numeric,0),
         coalesce((i ->> 'requirement')::numeric,0), coalesce((i ->> 'surplus')::numeric,0),
         i ->> 'reorder_status', coalesce((i ->> 'suggested_qty')::numeric,0),
         (i ->> 'calc_requirement')::numeric, (i ->> 'calc_surplus')::numeric,
         i ->> 'calc_status', (i ->> 'calc_suggested')::numeric, now()
  from jsonb_array_elements(p_items) i
  on conflict (spec_name, market_code) do update set
    planned_production = excluded.planned_production,
    planned_sales      = excluded.planned_sales,
    buffer_pct         = excluded.buffer_pct,
    requirement        = excluded.requirement,
    surplus            = excluded.surplus,
    reorder_status     = excluded.reorder_status,
    suggested_qty      = excluded.suggested_qty,
    calc_requirement   = excluded.calc_requirement,
    calc_surplus       = excluded.calc_surplus,
    calc_status        = excluded.calc_status,
    calc_suggested     = excluded.calc_suggested,
    updated_at         = now();
  return v_upload_id;
end;
$function$
