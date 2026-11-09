-- =====================================================================
-- items_label_bx.sql                              9 Nov 2026
--
-- TIGA KOLOM YANG SELAMA INI DIURAI LALU DIBUANG.
--
-- Permintaan Kyaru: "untuk rolling resistance, w grib, noise itu biasanya
-- ada pas di PO, makanya tiap ada PO baru gw mau lu ngelengkapin datanya
-- buat update database."
--
-- Dicek ke lembar ordernya sendiri (DETAIL_NEW_ITEM_BRANSALES_254X79mm.xlsx
-- dan 11月5nov.xlsx), bukan ditebak. Hasilnya: dari empat angka yang dia
-- sebut, TIGA sudah dipanen sejak label_master.sql --
--     RR     -> items.rr          'E'
--     噪音    -> items.noise       '75'
--     噪音等级 -> items.noise_class '3'
-- dan SATU tidak pernah sampai ke mana pun:
--     W1.24t -> (tidak ada kolomnya, tidak ada aliasnya)
--
-- W1.24t adalah CENGKERAMAN BASAH pada beban 1.24 ton, huruf A..E, dan di
-- label INMETRO/BX dia tercetak persis di sebelah RR. Jadi label BX tidak
-- bisa dirakit lengkap tanpa kolom ini -- yang baru kelihatan sekarang,
-- waktu artwork-nya mulai digenerate.
--
-- Dua kolom lain menyusul karena sebabnya sama -- sudah diurai parser,
-- tidak punya tujuan:
--     层级块  -> ply_block   'J18'  (BERBEDA dari items.ply '16PR')
--     SIZE   -> label_size  '254X79mm'
--
-- label_size BUKAN dimensi ban, dan itu intinya. Di lembar BX judul
-- kolomnya juga 'SIZE', tapi isinya ukuran KERTAS labelnya; di lembar SNI
-- bulanan judul yang sama persis berisi '10.00-20', dimensi ban yang
-- sebenarnya. Tanpa dipisah, '254X79mm' mendarat di items.size lalu
-- TERCETAK sebagai dimensi ban -- kelas kesalahan yang sudah pernah
-- terjadi dan dicatat di items_backfill_label.sql. Pemisahnya ada di
-- parsers/excelLabels.js (POLA_STOK_LABEL), diuji di test-panen-bx.mjs:
-- 15 periksa, termasuk bukti '10.00-20' tidak ikut tersingkir.
-- =====================================================================

alter table public.items
  add column if not exists wet_grip   text,  -- W1.24t  : 'E'  (A..E)
  add column if not exists ply_block  text,  -- 层级块   : 'J18'
  add column if not exists label_size text;  -- SIZE    : '254X79mm' (kertas)

comment on column public.items.wet_grip is
  'Cengkeraman basah / wet grip (W1.24t) pada beban 1.24 t, huruf A..E. Dicetak di label INMETRO/BX di sebelah RR. Dipanen dari kolom W1.24t lembar order.';
comment on column public.items.label_size is
  'Ukuran STOK KERTAS label, mis. 254X79mm. BUKAN dimensi ban -- dimensi ban ada di items.size.';
comment on column public.items.ply_block is
  'Kolom 层级块 lembar order, mis. J18. Berbeda dari items.ply yang berisi ply rating (16PR).';

-- ---------------------------------------------------------------------
-- BERSIH-BERSIH: ukuran kertas yang mungkin sudah nyangkut di items.size.
--
-- Sempit dengan sengaja -- hanya baris yang isinya BERBENTUK ukuran kertas
-- ('<angka> x <angka> mm'). Dimensi ban tidak pernah berbentuk begitu
-- ('295/80R22.5', '10.00-20', '7.50-16'), jadi tidak ada baris benar yang
-- bisa tersentuh. Pelajaran dari perbaikan backfill yang kelewat lebar:
-- 'where ply is not null' ikut menghantam 19 baris yang sudah benar.
-- ---------------------------------------------------------------------
update public.items
   set label_size = btrim(size),
       size = null,
       updated_at = now()
 where size ~* '^[0-9]+([.,][0-9]+)?\s*[x×*]\s*[0-9]+([.,][0-9]+)?\s*mm$';

-- ---------------------------------------------------------------------
-- RPC panen: tiga medan baru ditambahkan ke daftar `medan`.
-- Sisanya TIDAK DIUBAH, termasuk aturan "nilai kosong tidak pernah
-- menimpa" dan pencatatan perubahan ke items.riwayat.
-- ---------------------------------------------------------------------
create or replace function public.label_master_panen(p_rows jsonb, p_asal text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
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
      if nilai = '' then continue; end if;             -- kosong tidak pernah menimpa
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
end $fn$;
