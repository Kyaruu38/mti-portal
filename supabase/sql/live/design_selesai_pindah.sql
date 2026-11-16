-- design_selesai_pindah
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) e0e2da6f8694

CREATE OR REPLACE FUNCTION public.design_selesai_pindah(p_token text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; n int := 0; v_baru text; v_thumb text;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_baru  := r ->> 'drive_baru';
    v_thumb := nullif(btrim(coalesce(r ->> 'thumb','')), '');
    update public.designs d
       set drive_asal = coalesce(d.drive_asal, substring(d.drive_url from 'file/d/([A-Za-z0-9_-]+)')),
           drive_url  = 'https://drive.google.com/file/d/' || v_baru || '/view',
           -- getThumbnail() sering null untuk salinan yang baru dibuat: Drive
           -- membuat thumbnailnya belakangan. Kalau kosong, arahkan ke
           -- thumbnail SALINAN KITA, jangan biarkan menunjuk berkas Cania.
           thumb      = coalesce(v_thumb, 'https://drive.google.com/thumbnail?id=' || v_baru || '&sz=w400'),
           updated    = to_char(now(), 'YYYY-MM-DD')
     where d.id = (r ->> 'id')::uuid;
    if found then n := n + 1; end if;
  end loop;
  insert into public.audit_log (username, entity, target, action, detail)
  values ('import-drive', 'design', 'batch', 'pindah drive', n || ' desain dipindah ke Drive purchase.ptmti');
  return jsonb_build_object('diupdate', n);
end $function$
