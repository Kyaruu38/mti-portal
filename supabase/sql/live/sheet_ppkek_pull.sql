-- sheet_ppkek_pull
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) b834ede15175

CREATE OR REPLACE FUNCTION public.sheet_ppkek_pull(p_token text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from sheet_keys where name = 'ppkek' and token = p_token) then
    raise exception 'token sheet tidak dikenal';
  end if;

  return query
  select to_jsonb(r) from (
    select
      p.nopen                                             as nopen,
      to_char(p.ppkek_date, 'DD-MM-YYYY')                 as ppkek_date,
      to_char(p.eta,        'DD-MM-YYYY')                 as eta,
      coalesce(p.contract_no, '')                         as contract_no,
      coalesce(e->>'name', '')                            as item_name,
      coalesce(e->>'code', '')                            as item_code,
      coalesce(p.supplier, '')                            as supplier,
      coalesce(p.address, '')                             as address,
      coalesce(p.invoice_no, '')                          as invoice_no,
      coalesce(e->>'price', '')                           as unit_cost,
      coalesce(e->>'amount', '')                          as total_cost,
      coalesce(p.valuta, 'USD')                           as valuta,
      coalesce(e->>'qty', '')                             as qty,
      coalesce(e->>'unit', '')                            as unit,
      coalesce(p.pl_no, '')                               as pl_no,
      coalesce(p.ppkek_no, '')                            as ppkek_no,
      coalesce(p.so, '')                                  as so,
      coalesce(p.jo, '')                                  as jo,
      coalesce(p.costing, '')                             as costing,
      coalesce(p.po_erp_ina, '')                          as po_erp_ina,
      to_char(p.received_date, 'DD-MM-YYYY')              as received_date,
      coalesce(p.jalur, 'LDP')                            as jalur,
      p.nopen || '|' || coalesce(e->>'code', '') || '|'
        || coalesce(nullif(e->>'no', ''), t.ord::text)    as kunci
    from public.ppkek p
    cross join lateral jsonb_array_elements(coalesce(p.items, '[]'::jsonb))
      with ordinality as t(e, ord)
    where (p_from is null or p.ppkek_date >= p_from)
      and (p_to   is null or p.ppkek_date <= p_to)
    order by p.ppkek_date, p.nopen, t.ord
  ) r;
end;
$function$
