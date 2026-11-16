-- design_import
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) cb311192a237

CREATE OR REPLACE FUNCTION public.design_import(p_token text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb; v_id text; v_nama text; v_bersih text; v_thumb text; v_tgl text;
  v_erp text; v_spec text; v_cara text; v_n int; v_daftar text;
  v_brand text; v_market text; v_catatan text; v_pakai text;
  v_pesan text; v_out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_id   := nullif(btrim(coalesce(r ->> 'drive_id','')), '');
    v_nama := nullif(btrim(coalesce(r ->> 'nama','')), '');
    v_thumb:= nullif(btrim(coalesce(r ->> 'thumb','')), '');
    v_tgl  := left(nullif(btrim(coalesce(r ->> 'tanggal','')), ''), 10);
    if v_id is null or v_nama is null then continue; end if;
    if v_thumb is null then v_thumb := 'https://drive.google.com/thumbnail?id=' || v_id || '&sz=w400'; end if;
    v_bersih := regexp_replace(v_nama, '\.(pdf|PDF)$', '');
    v_erp := null; v_spec := null; v_cara := null; v_catatan := null; v_pesan := null;

    if public.design_sudah_ada(v_id) then
      v_pesan := 'LEWAT: file ini sudah ada di library';
    else
      -- SATU panggilan saja. Sebelumnya dipanggil dua kali per baris dan
      -- menyapu pos.items + label_stock mentah-mentah tiap kali; 20 baris per
      -- batch sudah cukup untuk kena statement timeout PostgREST.
      select count(distinct c.erp), min(c.erp), min(c.spec), min(c.cara), string_agg(distinct c.erp, ', ')
        into v_n, v_erp, v_spec, v_cara, v_daftar
        from public.design_cocok(v_nama) c;

      if coalesce(v_n,0) = 1 then
        null;
      elsif coalesce(v_n,0) > 1 then
        v_cara := 'ambigu';
        v_catatan := 'AMBIGU: cocok ke ' || v_n || ' ERP (' || v_daftar || ') - pilih sendiri';
        v_erp := null; v_spec := null;
      else
        v_cara := 'tidak ketemu'; v_erp := null; v_spec := null;
      end if;

      if v_erp is not null then
        select spec into v_pakai from public.designs where erp = v_erp limit 1;
        if v_pakai is not null then
          if public.dsg_kembar(coalesce(v_spec, v_bersih), v_pakai) then
            v_pesan := 'LEWAT: kembar dengan kartu ber-ERP ' || v_erp;
            v_out := v_out || jsonb_build_array(jsonb_build_object(
              'drive_id', v_id, 'nama', v_bersih, 'erp', null, 'pesan', v_pesan));
            continue;
          end if;
          v_catatan := 'BENTROK: ERP ' || v_erp || ' sudah dipakai kartu "' || left(v_pakai, 90) || '"';
          v_cara := 'bentrok'; v_erp := null;
        end if;
      end if;

      v_brand  := nullif(public.dsg_brand(v_nama), '');
      v_market := upper(coalesce(substring(v_nama from '\(ID-[A-Za-z0-9 _]+-[A-Za-z]+-([A-Za-z0-9]+)\)'), ''));
      insert into public.designs (erp, spec, brand, market, ver, updated, drive_url, thumb, status, riwayat, catatan)
      values (v_erp, coalesce(v_spec, v_bersih), coalesce(v_brand, '—'),
              coalesce(nullif(v_market, ''), '—'), 'v1',
              coalesce(v_tgl, to_char(now(), 'YYYY-MM-DD')),
              'https://drive.google.com/file/d/' || v_id || '/view',
              v_thumb, 'draft', '[]'::jsonb, v_catatan);
      v_pesan := 'MASUK (' || v_cara || ')';
      insert into public.audit_log (username, entity, target, action, detail)
      values ('import-drive', 'design', coalesce(v_erp, v_bersih), 'tambah',
              'impor folder design Drive - ' || v_bersih);
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'drive_id', v_id, 'nama', v_bersih, 'erp', v_erp, 'pesan', v_pesan));
  end loop;
  return v_out;
end $function$
