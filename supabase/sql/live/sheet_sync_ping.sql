-- sheet_sync_ping
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 7ec302b3ff4a

CREATE OR REPLACE FUNCTION public.sheet_sync_ping(p_token text, p_tarik integer DEFAULT NULL::integer, p_kirim integer DEFAULT NULL::integer, p_catatan text DEFAULT NULL::text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nama text;
begin
  select k.name into v_nama from public.sheet_keys k where k.token = p_token;
  if v_nama is null then
    raise exception 'token tidak dikenal';
  end if;
  insert into public.sheet_sync_ping (nama, terakhir, baris_tarik, baris_kirim, catatan)
  values (v_nama, now(), p_tarik, p_kirim, p_catatan)
  on conflict (nama) do update
    set terakhir = now(), baris_tarik = p_tarik, baris_kirim = p_kirim, catatan = p_catatan;
  return now();
end $function$
