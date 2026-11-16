-- label_master_panen
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) ed9b7309ee82

CREATE OR REPLACE FUNCTION public.label_master_panen(p_rows jsonb, p_asal text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb; v_erp text; lama public.items%rowtype;
  v_baru int := 0; v_isi int := 0; v_ubah int := 0; v_lewat int := 0;
  jejak jsonb; k text[]; nilai text; sebelum text;
  medan text[][] := array[
    ['spec','spec'], ['brand','brand'], ['market','market'], ['ean','ean'],
    ['size','size'], ['pattern','pattern'], ['loadSpeed','load_speed'],
    ['pr','ply'], ['ttl','tt_tl'], ['ms','ms'], ['snow','snow_pos'],
    ['npb1','npb1'], ['npb3','npb3'], ['barcode','barcode'], ['sni','sni_no'],
    ['country','country'], ['rr','rr'], ['noise','noise'], ['noiseClass','noise_class'],
    ['wetGrip','wet_grip'], ['plyBlock','ply_block'], ['labelSize','label_size'],
    ['nameEn','name_en'], ['nameZh','name_zh']
  ];
begin
  if not public.is_internal() then
    raise exception 'label_master_panen: hanya untuk akun internal';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_erp := btrim(coalesce(r->>'erp',''));
    if v_erp = '' then v_lewat := v_lewat + 1; continue; end if;

    select * into lama from public.items where erp = v_erp;
    if not found then
      insert into public.items (erp) values (v_erp);
      select * into lama from public.items where erp = v_erp;
      v_baru := v_baru + 1;
    end if;

    jejak := '[]'::jsonb;
    foreach k slice 1 in array medan loop
      nilai := btrim(coalesce(r->>k[1],''));
      if nilai = '' then continue; end if;
      execute format('select coalesce(($1).%I::text,'''')', k[2]) into sebelum using lama;
      if sebelum = nilai then continue; end if;
      execute format('update public.items set %I = $1, updated_at = now() where erp = $2', k[2])
        using nilai, v_erp;
      if sebelum = '' then
        v_isi := v_isi + 1;
      else
        v_ubah := v_ubah + 1;
        jejak := jejak || jsonb_build_array(jsonb_build_object(
          'medan', k[2], 'dari', sebelum, 'jadi', nilai,
          'tanggal', to_char(now(),'YYYY-MM-DD HH24:MI'), 'asal', coalesce(p_asal,'-')));
      end if;
    end loop;

    if r ? 'hasTemplate' then
      update public.items set punya_template = (r->>'hasTemplate')::boolean where erp = v_erp;
    end if;
    update public.items
       set terakhir_dari = coalesce(p_asal, terakhir_dari),
           riwayat = case when jsonb_array_length(jejak) > 0
                          then coalesce(riwayat,'[]'::jsonb) || jejak else riwayat end
     where erp = v_erp;
  end loop;

  return jsonb_build_object('baru', v_baru, 'medan_terisi', v_isi,
                            'medan_berubah', v_ubah, 'dilewati_tanpa_erp', v_lewat);
end $function$
