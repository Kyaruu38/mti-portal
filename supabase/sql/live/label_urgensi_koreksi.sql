-- label_urgensi_koreksi
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 1521ea16bfe3

CREATE OR REPLACE FUNCTION public.label_urgensi_koreksi(p_kunci text, p_medan text[], p_fisik numeric DEFAULT NULL::numeric, p_butuh numeric DEFAULT NULL::numeric, p_catatan text DEFAULT NULL::text, p_oleh text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lama public.label_urgensi;
  v_jejak jsonb := '[]'::jsonb;
  v_fisik numeric;
  v_butuh numeric;
  v_catatan text;
begin
  if not public.is_urgensi_write() then
    raise exception 'peran % tidak boleh mengoreksi daftar urgensi', public.current_role();
  end if;
  if p_kunci is null or btrim(p_kunci) = '' then
    raise exception 'kunci kosong -- baris tanpa kunci gabung tidak bisa dikoreksi';
  end if;

  select * into v_lama from public.label_urgensi where kunci = p_kunci;

  v_fisik   := case when 'fisik'   = any (p_medan) then p_fisik   else v_lama.fisik end;
  v_butuh   := case when 'butuh'   = any (p_medan) then p_butuh   else v_lama.butuh end;
  v_catatan := case when 'catatan' = any (p_medan) then p_catatan else v_lama.catatan end;

  if v_lama.kunci is null or v_lama.fisik is distinct from v_fisik then
    v_jejak := v_jejak || jsonb_build_array(jsonb_build_object(
      'medan','fisik','dari',v_lama.fisik,'jadi',v_fisik,
      'oleh',coalesce(p_oleh,public.current_role()),'pada',to_char(now(),'YYYY-MM-DD HH24:MI')));
  end if;
  if v_lama.kunci is null or v_lama.butuh is distinct from v_butuh then
    v_jejak := v_jejak || jsonb_build_array(jsonb_build_object(
      'medan','butuh','dari',v_lama.butuh,'jadi',v_butuh,
      'oleh',coalesce(p_oleh,public.current_role()),'pada',to_char(now(),'YYYY-MM-DD HH24:MI')));
  end if;

  insert into public.label_urgensi (kunci, fisik, butuh, catatan, oleh, pada, riwayat)
  values (p_kunci, v_fisik, v_butuh, v_catatan, coalesce(p_oleh, public.current_role()), now(), v_jejak)
  on conflict (kunci) do update
     set fisik   = v_fisik,
         butuh   = v_butuh,
         catatan = v_catatan,
         oleh    = coalesce(p_oleh, public.current_role()),
         pada    = now(),
         riwayat = coalesce(public.label_urgensi.riwayat,'[]'::jsonb) || v_jejak;

  return jsonb_build_object('kunci', p_kunci, 'medan_berubah', jsonb_array_length(v_jejak));
end $function$
