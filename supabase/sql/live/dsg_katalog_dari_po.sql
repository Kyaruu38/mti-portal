-- dsg_katalog_dari_po
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 71cba94288c7

CREATE OR REPLACE FUNCTION public.dsg_katalog_dari_po()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare it jsonb;
begin
  for it in select jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) loop
    perform public.dsg_katalog_tambah(it->>'erp', it->>'d');   -- nama Inggris
    perform public.dsg_katalog_tambah(it->>'erp', it->>'cn');  -- nama Mandarin
  end loop;
  return new;
end $function$
