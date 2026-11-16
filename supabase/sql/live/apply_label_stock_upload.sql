-- apply_label_stock_upload
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) f861c68c3a93

CREATE OR REPLACE FUNCTION public.apply_label_stock_upload(p_upload jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_upload_id uuid;
  v_keys      text[];
begin
  -- Penjaga peran. Sebelumnya TIDAK ADA sama sekali: fungsi ini
  -- SECURITY DEFINER (berjalan sebagai postgres, melewati RLS) dan satu-satunya
  -- pertahanannya adalah badan ini. Daftar perannya mencerminkan capability
  -- labelStockWrite di src/auth/roles.js.
  if public.current_role() is null
     or public.current_role() not in ('wilbert', 'cania', 'visca', 'sona') then
    raise exception 'Akun % tidak boleh mengunggah stok label', coalesce(public.current_role(), '(tidak dikenal)')
      using errcode = 'insufficient_privilege';
  end if;
  -- CHANGED: was is_purchasing(), now is_label_staff() so sona can upload.
  if not public.is_label_staff() then
    raise exception 'only label staff may upload label stock';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'upload kosong — tidak ada baris untuk disimpan';
  end if;

  insert into public.label_stock_uploads
    (file_name, sheet_name, week_of, rows_total, rows_imported, rows_duplicate, rows_mismatch, duplicates)
  values (
    p_upload ->> 'file_name',
    p_upload ->> 'sheet_name',
    nullif(p_upload ->> 'week_of', '')::date,
    coalesce((p_upload ->> 'rows_total')::int, 0),
    coalesce((p_upload ->> 'rows_imported')::int, 0),
    coalesce((p_upload ->> 'rows_duplicate')::int, 0),
    coalesce((p_upload ->> 'rows_mismatch')::int, 0),
    coalesce(p_upload -> 'duplicates', '[]'::jsonb)
  )
  returning id into v_upload_id;

  insert into public.label_stock (
    spec_name, market_code, stock, planned_production, planned_sales, buffer_pct,
    requirement, surplus, reorder_status, suggested_qty, week_updated,
    calc_requirement, calc_surplus, calc_status, calc_suggested, has_mismatch,
    last_upload_id, last_seen_at, missing_from_last_upload, updated_at
  )
  select
    i ->> 'spec_name',
    coalesce(i ->> 'market_code', ''),
    coalesce((i ->> 'stock')::numeric, 0),
    coalesce((i ->> 'planned_production')::numeric, 0),
    coalesce((i ->> 'planned_sales')::numeric, 0),
    coalesce((i ->> 'buffer_pct')::numeric, 0),
    coalesce((i ->> 'requirement')::numeric, 0),
    coalesce((i ->> 'surplus')::numeric, 0),
    i ->> 'reorder_status',
    coalesce((i ->> 'suggested_qty')::numeric, 0),
    i ->> 'week_updated',
    (i ->> 'calc_requirement')::numeric,
    (i ->> 'calc_surplus')::numeric,
    i ->> 'calc_status',
    (i ->> 'calc_suggested')::numeric,
    coalesce((i ->> 'has_mismatch')::boolean, false),
    v_upload_id, now(), false, now()
  from jsonb_array_elements(p_items) i
  on conflict (spec_name, market_code) do update set
    stock              = excluded.stock,
    planned_production = excluded.planned_production,
    planned_sales      = excluded.planned_sales,
    buffer_pct         = excluded.buffer_pct,
    requirement        = excluded.requirement,
    surplus            = excluded.surplus,
    reorder_status     = excluded.reorder_status,
    suggested_qty      = excluded.suggested_qty,
    week_updated       = excluded.week_updated,
    calc_requirement   = excluded.calc_requirement,
    calc_surplus       = excluded.calc_surplus,
    calc_status        = excluded.calc_status,
    calc_suggested     = excluded.calc_suggested,
    has_mismatch       = excluded.has_mismatch,
    last_upload_id     = excluded.last_upload_id,
    last_seen_at       = excluded.last_seen_at,
    missing_from_last_upload = false,
    updated_at         = now();

  insert into public.label_stock_history (
    upload_id, spec_name, market_code, erp, stock, planned_production,
    planned_sales, buffer_pct, requirement, surplus, reorder_status, suggested_qty
  )
  select
    v_upload_id, s.spec_name, s.market_code, s.erp, s.stock, s.planned_production,
    s.planned_sales, s.buffer_pct, s.requirement, s.surplus, s.reorder_status, s.suggested_qty
  from public.label_stock s
  where s.last_upload_id = v_upload_id;

  select array_agg(coalesce(i ->> 'spec_name', '') || '||' || coalesce(i ->> 'market_code', ''))
    into v_keys
    from jsonb_array_elements(p_items) i;

  update public.label_stock
     set missing_from_last_upload = true
   where last_upload_id is distinct from v_upload_id
     and (spec_name || '||' || market_code) <> all (v_keys);

  return v_upload_id;
end;
$function$
