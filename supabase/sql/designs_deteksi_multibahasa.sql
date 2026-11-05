-- =====================================================================
-- designs_deteksi_multibahasa.sql
-- Deteksi merek/spec label tetap jalan baik nama di Excel pakai
-- bahasa Inggris, Mandarin, singkatan, atau campuran.
--
-- Dijalankan: 2026-11-05  (sudah diterapkan ke project niastiawhhsyzudihlzw)
-- File ini arsip/versioning saja — tidak perlu dijalankan ulang.
-- Catatan: body dsg_brand di bawah ditulis ulang dari sumber yang sama
-- yang di-apply ke Supabase (pembacaan balik via pg_get_functiondef
-- diblok filter konten), jadi logikanya identik tapi bukan dump mentah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. dsg_brand(): 4 lapis deteksi merek (EN / Mandarin / singkatan)
-- ---------------------------------------------------------------------
create or replace function public.dsg_brand(t text) returns text
language plpgsql immutable as $fn$
declare
  asli text := coalesce(t, '');
  nrm  text := upper(regexp_replace(coalesce(t,''), '[^A-Za-z0-9]', '', 'g'));
  pfx  text;
  p    text[];
  i    int;
  singkat text[][] := array[
    ['WL','WESTLAKE'], ['GR','GOODRIDE'], ['TN','TRAZANO'],
    ['JG','GOLDENCROWN'], ['YR','YARTU'], ['CY','CHAOYANG'],
    ['NIPON','NIPON'], ['ORNATE','ORNATE'], ['ARISUN','ARISUN'],
    ['OMNIMAX','OMNIMAX'], ['VITOUR','VITOUR'], ['RISEN','RISEN'],
    ['TIANLI','TIANLI'], ['TRUSTTRACK','TRUSTTRACK'],
    ['BLACKARROW','BLACKARROW'], ['TRANSEAGLE','TRANSEAGLE'],
    ['XCELLENT','XCELLENT'], ['TKV','TKV']
  ];
  daftar text[] := array[
    'WESTLAKE','GOODRIDE','TRAZANO','CHAOYANG','GOLDENCROWN','NIPON',
    'ORNATE','YARTU','RISEN','TIANLI','TRUSTTRACK','ARISUN','OMNIMAX',
    'VITOUR','TRANSEAGLE','BLACKARROW','XCELLENT','TKV'
  ];
  china text[][] := array[
    ['威狮','WESTLAKE'], ['西湖','WESTLAKE'],
    ['好运','GOODRIDE'],  ['全诺','TRAZANO'],
    ['朝阳','CHAOYANG'],  ['金冠','GOLDENCROWN'],
    ['力奔','NIPON'],     ['欧耐特','ORNATE'],
    ['雅度','YARTU'],     ['日升','RISEN'],
    ['天力','TIANLI'],    ['路诚','TRUSTTRACK']
  ];
begin
  -- lapis 1: prefix resmi "(ID-XXX-" paling dipercaya
  pfx := (regexp_match(asli, '[(]ID-([A-Za-z0-9]+)-'))[1];
  if pfx is not null and upper(pfx) not in ('TBR','ID') then
    for i in 1 .. array_length(singkat, 1) loop
      if upper(pfx) = singkat[i][1] then return singkat[i][2]; end if;
    end loop;
    return upper(pfx);
  end if;

  -- lapis 2: nama latin lengkap
  for i in 1 .. array_length(daftar, 1) loop
    if nrm like '%' || daftar[i] || '%' then return daftar[i]; end if;
  end loop;

  -- lapis 3: nama Mandarin
  for i in 1 .. array_length(china, 1) loop
    if position(china[i][1] in asli) > 0 then return china[i][2]; end if;
  end loop;

  -- lapis 4: singkatan, hanya kalau berdiri sebagai kata utuh
  --          (biar "WL" tidak ikut kena di kata seperti "BOWL")
  foreach p slice 1 in array singkat loop
    if asli ~* ('\m' || p[1] || '\M') then return p[2]; end if;
  end loop;

  return '';
end $fn$;

-- ---------------------------------------------------------------------
-- 2. Katalog pencocokan: indeks nama Inggris DAN Mandarin sekaligus
--    pos.items -> 'd'  = nama Inggris
--    pos.items -> 'cn' = nama Mandarin
--    label_stock.spec_name
-- ---------------------------------------------------------------------
create unique index if not exists dsg_katalog_erp_spec_uq
  on public.dsg_katalog (erp, spec);

create or replace function public.dsg_katalog_tambah(p_erp text, p_spec text)
returns void language sql security definer as $fn$
  insert into public.dsg_katalog (erp, spec, nrm, kode, sig, merek)
  select trim(p_erp), trim(p_spec),
         public.dsg_norm(p_spec), public.dsg_kode(p_spec),
         public.dsg_sig(p_spec),  public.dsg_brand(p_spec)
   where coalesce(trim(p_erp),'') <> '' and coalesce(trim(p_spec),'') <> ''
  on conflict (erp, spec) do nothing;
$fn$;

-- rebuild penuh (dipakai sekali waktu migrasi / kalau mau reset)
create or replace function public.dsg_katalog_segarkan()
returns jsonb language plpgsql security definer as $fn$
declare v_lama int; v_baru int;
begin
  select count(*) into v_lama from public.dsg_katalog;

  create temp table _kat_baru on commit drop as
  with mentah as (
    select it->>'erp' as erp, it->>'d'  as spec from public.pos p, jsonb_array_elements(p.items) it
    union all
    select it->>'erp' as erp, it->>'cn' as spec from public.pos p, jsonb_array_elements(p.items) it
    union all
    select erp, spec_name as spec from public.label_stock
  )
  select distinct trim(erp) as erp, trim(spec) as spec,
         public.dsg_norm(spec) as nrm, public.dsg_kode(spec) as kode,
         public.dsg_sig(spec)  as sig, public.dsg_brand(spec) as merek
    from mentah
   where coalesce(trim(erp),'') <> '' and coalesce(trim(spec),'') <> '';

  select count(*) into v_baru from _kat_baru;

  delete from public.dsg_katalog;
  insert into public.dsg_katalog (erp, spec, nrm, kode, sig, merek)
       select erp, spec, nrm, kode, sig, merek from _kat_baru;
  analyze public.dsg_katalog;

  return jsonb_build_object('sebelum', v_lama, 'sesudah', v_baru,
    'erp', (select count(distinct erp) from public.dsg_katalog));
end $fn$;

-- ---------------------------------------------------------------------
-- 3. Trigger: PO / label_stock baru langsung masuk katalog
--    -> upload Excel baru otomatis kedeteksi, tanpa refresh manual
-- ---------------------------------------------------------------------
create or replace function public.dsg_katalog_dari_po()
returns trigger language plpgsql security definer as $fn$
declare it jsonb;
begin
  for it in select jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) loop
    perform public.dsg_katalog_tambah(it->>'erp', it->>'d');   -- Inggris
    perform public.dsg_katalog_tambah(it->>'erp', it->>'cn');  -- Mandarin
  end loop;
  return new;
end $fn$;

create or replace function public.dsg_katalog_dari_stock()
returns trigger language plpgsql security definer as $fn$
begin
  perform public.dsg_katalog_tambah(new.erp, new.spec_name);
  return new;
end $fn$;

drop trigger if exists trg_dsg_katalog_po on public.pos;
create trigger trg_dsg_katalog_po
  after insert or update of items on public.pos
  for each row execute function public.dsg_katalog_dari_po();

drop trigger if exists trg_dsg_katalog_stock on public.label_stock;
create trigger trg_dsg_katalog_stock
  after insert or update of spec_name, erp on public.label_stock
  for each row execute function public.dsg_katalog_dari_stock();

-- ---------------------------------------------------------------------
-- 4. Kamus merek Mandarin -> Latin (dipakai di dsg_brand)
-- ---------------------------------------------------------------------
--   威狮 / 西湖  -> WESTLAKE          好运   -> GOODRIDE
--   全诺        -> TRAZANO           朝阳   -> CHAOYANG
--   金冠        -> GOLDENCROWN       力奔   -> NIPON
--   欧耐特      -> ORNATE            雅度   -> YARTU
--   日升        -> RISEN             天力   -> TIANLI
--   路诚        -> TRUSTTRACK
--
-- Bukan merek (sengaja diabaikan):
--   无内 (tubeless), 纳米高抓, 配套, 编织袋, 专用标签, 综合型,
--   东南亚, 美国, 巴拉圭, 停用
--
-- Singkatan (hanya cocok sebagai kata utuh, biar "WL" tidak kena "BOWL"):
--   WL, GR, TN, JG, YR, CY
--
-- Hasil back-test 2026-11-05 (mock PO, sudah dihapus lagi):
--   spec Mandarin        -> ketemu (persis)
--   ERP Mandarin-only    -> ketemu lewat pencarian Inggris
--   singkatan WL + 【】  -> ketemu
--   力奔 -> NIPON        -> ketemu
-- Katalog: 2.358 baris / 1.502 ERP (dari 1.753 / 1.454 sebelumnya)
