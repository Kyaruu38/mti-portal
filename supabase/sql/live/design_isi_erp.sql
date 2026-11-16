-- design_isi_erp
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 2e1eda2f1df4

CREATE OR REPLACE FUNCTION public.design_isi_erp(p_token text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; v_d text; v_e text; v_id uuid; v_erp_lama text; v_pakai text;
        n_isi int := 0; n_lewat int := 0; n_bentrok int := 0; n_hilang int := 0;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_d := nullif(btrim(coalesce(r ->> 'd','')), '');
    v_e := nullif(btrim(coalesce(r ->> 'e','')), '');
    if v_d is null or v_e is null then continue; end if;
    select id, erp into v_id, v_erp_lama from public.designs
     where drive_asal = v_d or drive_url like '%' || v_d || '%' limit 1;
    if v_id is null then n_hilang := n_hilang + 1; continue; end if;
    if coalesce(v_erp_lama,'') <> '' then n_lewat := n_lewat + 1; continue; end if;
    select spec into v_pakai from public.designs where erp = v_e limit 1;
    if v_pakai is not null then
      update public.designs
         set catatan = 'BENTROK: ERP ' || v_e || ' sudah dipakai kartu "' || left(v_pakai, 90) || '"'
       where id = v_id;
      n_bentrok := n_bentrok + 1;
    else
      update public.designs set erp = v_e, catatan = null where id = v_id;
      n_isi := n_isi + 1;
    end if;
  end loop;
  insert into public.audit_log (username, entity, target, action, detail)
  values ('import-drive', 'design', 'batch', 'isi erp',
          n_isi || ' ERP diisi dari list PO ERP, ' || n_bentrok || ' bentrok, ' || n_lewat || ' sudah ada');
  return jsonb_build_object('diisi', n_isi, 'bentrok', n_bentrok, 'sudah_ada', n_lewat, 'tidak_ketemu', n_hilang);
end $function$
