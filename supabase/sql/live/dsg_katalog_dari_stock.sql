-- dsg_katalog_dari_stock
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) a3be6953b021

CREATE OR REPLACE FUNCTION public.dsg_katalog_dari_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform public.dsg_katalog_tambah(new.erp, new.spec_name);
  return new;
end $function$
