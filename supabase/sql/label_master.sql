-- =====================================================================
-- label_master.sql                      dijalankan: 6 Nov 2026
--
-- MASTER LABEL DIPANEN DARI LEMBAR ORDER, BUKAN DIISI DUA KALI.
--
-- Permintaan Kyaru: "ini semua datanya kan ada ya tiap kali req, coba
-- donk di update di data label jg". Memang ada, dan selama ini memang
-- terbuang: lembar order label memuat ukuran, pola, indeks beban,
-- lapisan, TT/TL, M+S, EAN dan dua baris NPB — satu-satunya tempat
-- angka-angka itu pernah dituliskan — lalu lembarnya selesai dipakai
-- dan isinya ikut selesai.
--
-- Tabel public.items sudah ada sejak awal dengan erp/spec/brand/market/
-- ms/rr/noise/ean/name_en/name_zh, dan berisi NOL baris. Bentuknya sudah
-- benar; yang tidak ada cuma yang mengisinya.
--
-- ATURAN YANG MENENTUKAN SEGALANYA: NILAI KOSONG TIDAK PERNAH MENIMPA.
-- Lembar order diisi seadanya — baris yang templatenya sudah ada sengaja
-- dibiarkan kosong kolom speknya, karena tinggal cetak ulang (kolom 模版
-- berisi ✅). Kalau kosong ikut ditulis, SATU order ulang akan menghapus
-- data yang dikumpulkan berbulan-bulan. Diuji: panen kedua dengan 13
-- kolom kosong menyentuh 0 medan.
--
-- PERUBAHAN ATAS NILAI YANG SUDAH ADA DICATAT, tidak diam-diam ditimpa.
-- EAN atau nomor NPB yang bergeser berarti label tercetak dengan nomor
-- sertifikat lama, dan tanpa catatan tidak ada yang bisa menelusurinya.
-- Tersimpan di items.riwayat: medan, dari, jadi, tanggal, asal (nomor PO).
--
-- Baris tanpa ERP DILEWATI, bukan disimpan dengan kunci kosong — master
-- ini berkunci ERP, dan baris tanpa kunci menumpuk jadi duplikat yang
-- tidak bisa dicocokkan ke apa pun.
--
-- Dipanggil dari screens/labelRequest.js SESUDAH PO-nya terbit, dengan
-- nomor PO sebagai `asal`. Kegagalannya tidak menjatuhkan apa pun: PO
-- sudah ada di titik itu, dan melempar error cuma akan membuat orangnya
-- mengira PO-nya batal lalu membuat PO kedua.
-- =====================================================================

alter table public.items
  add column if not exists size        text,   -- 规格 dimensi  : '7.50-16'
  add column if not exists pattern     text,   -- 花纹          : 'R8038'
  add column if not exists load_speed  text,   -- 速度级别/负荷指数 : '122/118J'
  add column if not exists ply         text,   -- 层级          : '14G'
  add column if not exists tt_tl       text,
  add column if not exists snow_pos    text,   -- 泥雪地牵引标识位置
  add column if not exists npb1        text,   -- NPB 第一行     : '100:2019'
  add column if not exists npb3        text,   -- NPB 第三行     : '1-132-003-26001522-5'
  add column if not exists barcode     text,   -- kolom BARCODE, TERPISAH dari ean
  add column if not exists sni_no      text,
  add column if not exists country     text,
  add column if not exists noise_class text,
  add column if not exists punya_template boolean,
  add column if not exists riwayat     jsonb not null default '[]'::jsonb,
  add column if not exists terakhir_dari text;

create unique index if not exists items_erp_uq on public.items (erp) where coalesce(erp,'') <> '';

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

-- Pemasok membaca master label HANYA untuk ERP yang ada di PO miliknya.
-- Bentuknya sengaja sama persis dengan designs_read_supplier: berkas Excel
-- yang dia terima dirakit dari kedua tabel ini, jadi batas keduanya harus
-- satu kalimat yang sama, bukan dua yang mirip.
drop policy if exists items_read_supplier on public.items;
create policy items_read_supplier on public.items for select using (
  public.is_supplier()
  and public.my_supplier_id() is not null
  and exists (
    select 1 from public.pos p, jsonb_array_elements(p.items) it
     where p.supplier_id = public.my_supplier_id()
       and p.status = 'Approved' and p.deleted_at is null
       and it->>'erp' = public.items.erp
  )
);
