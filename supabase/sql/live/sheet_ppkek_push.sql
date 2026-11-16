-- sheet_ppkek_push
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 0656e93a1e34

CREATE OR REPLACE FUNCTION public.sheet_ppkek_push(p_token text, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r     jsonb;
  n     integer := 0;
  v_tgl date;
  kena  integer;
begin
  if not exists (select 1 from sheet_keys where name = 'ppkek' and token = p_token) then
    raise exception 'token sheet tidak dikenal';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    begin
      v_tgl := nullif(r->>'received_date', '')::date;
    exception when others then
      v_tgl := null;
    end;

    update public.ppkek p set
      so            = coalesce(nullif(r->>'so', ''),         p.so),
      jo            = coalesce(nullif(r->>'jo', ''),         p.jo),
      costing       = coalesce(nullif(r->>'costing', ''),    p.costing),
      po_erp_ina    = coalesce(nullif(r->>'po_erp_ina', ''), p.po_erp_ina),
      received_date = coalesce(v_tgl,                        p.received_date)
    where ltrim(p.nopen, '0') = ltrim(r->>'nopen', '0')
      and (
        coalesce(p.so, '')           is distinct from coalesce(nullif(r->>'so', ''),          coalesce(p.so, ''))
        or coalesce(p.jo, '')        is distinct from coalesce(nullif(r->>'jo', ''),          coalesce(p.jo, ''))
        or coalesce(p.costing, '')   is distinct from coalesce(nullif(r->>'costing', ''),     coalesce(p.costing, ''))
        or coalesce(p.po_erp_ina,'') is distinct from coalesce(nullif(r->>'po_erp_ina', ''),  coalesce(p.po_erp_ina, ''))
        or p.received_date           is distinct from coalesce(v_tgl, p.received_date)
      );

    -- Yang dihitung sekarang baris yang BENAR-BENAR berubah, bukan baris yang
    -- dikirim. Angka "257 terkirim" tadi terdengar seperti keberhasilan padahal
    -- nol di antaranya mendarat; laporan yang tidak bisa membedakan keduanya
    -- tidak layak dibaca.
    get diagnostics kena = row_count;
    n := n + kena;
  end loop;

  return n;
end;
$function$
