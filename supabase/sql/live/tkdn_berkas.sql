-- tkdn_berkas
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 26b8619c168b

CREATE OR REPLACE FUNCTION public.tkdn_berkas(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if p_token <> 'tkdn_fZbftNazHSg2kt4uNp' then
    raise exception 'token salah';
  end if;
  select jsonb_agg(x order by x->>'no') into v from (
    select jsonb_build_object(
      'no', b.no, 'nama', b.nama, 'ragu', b.ragu, 'nopen', b.nopen,
      'tgl', to_char(p.ppkek_date,'YYYY-MM-DD'),
      'invoice', p.invoice_no, 'supplier', p.supplier,
      'berkas', coalesce((
         select jsonb_agg(jsonb_build_object(
                  'nama', f->>'name',
                  'id', substring(f->>'url' from '/d/([A-Za-z0-9_-]+)')))
           from jsonb_array_elements(p.files) f
          where coalesce((f->>'placeholder')::boolean,false) = false
            and (f->>'url') ~ '/d/[A-Za-z0-9_-]+'), '[]'::jsonb)
    ) as x
    from public.tkdn_bahan b
    left join public.ppkek p on p.nopen = b.nopen
  ) t;
  return coalesce(v,'[]'::jsonb);
end $function$
