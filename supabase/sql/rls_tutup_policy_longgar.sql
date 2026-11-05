-- =====================================================================
-- rls_tutup_policy_longgar.sql          dijalankan: 5 Nov 2026
--
-- SEMBILAN POLICY BACA YANG BERBUNYI "SIAPA PUN YANG LOGIN".
--
-- Ditemukan saat menyiapkan rencana akun portal untuk pemasok. Selama
-- semua akun milik orang dalam, `auth.uid() IS NOT NULL` dan `true`
-- tidak berbeda hasilnya dari daftar peran — jadi ini tidak pernah
-- terlihat sebagai masalah dan memang belum pernah jadi masalah.
--
-- Berubah total begitu ada SATU akun dari luar. Yang terbaca oleh akun
-- pemasok pertama yang berhasil login, tanpa satu pun layar dibuka:
--   suppliers     46 baris — SELURUHNYA punya nomor rekening, 18 punya SWIFT
--   label_prices  1.049 baris harga, mencakup 5 pemasok berbeda
--   items         kebetulan kosong hari ini
-- Harga pesaing dan nomor rekening 46 perusahaan, lewat anon key yang
-- memang dipublikasikan di config.js karena repo ini publik. RLS adalah
-- satu-satunya yang menjaganya.
--
-- PENYEMPITAN INI TIDAK MENGUBAH AKSES SATU AKUN PUN YANG ADA SEKARANG.
-- is_internal() memuat PERSIS 8 peran yang hari ini terdaftar di
-- profiles, jadi hasilnya identik untuk semua pemakai hari ini. Yang
-- berubah cuma satu: peran BARU tidak lagi ikut hanya karena dia
-- berhasil login. Dia harus disebut namanya.
--
-- Diperiksa sesudah diterapkan, dari sesi portal yang betul-betul login
-- sebagai wilbert: kesebelas tabel tetap terbaca. brand_map dan items
-- mengembalikan 0 baris karena tabelnya memang kosong (0 di server),
-- bukan karena ditolak.
-- =====================================================================

create or replace function public.is_internal() returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.current_role() = any (array[
    'wilbert','cania','visca','sekar','financemti','sona','cenjc','warehousemti'
  ]);
$fn$;

-- auth.uid() IS NOT NULL  ->  is_internal()
drop policy if exists suppliers_read      on public.suppliers;
create policy suppliers_read      on public.suppliers      for select using (public.is_internal());

drop policy if exists label_prices_read   on public.label_prices;
create policy label_prices_read   on public.label_prices   for select using (public.is_internal());

drop policy if exists items_read          on public.items;
create policy items_read          on public.items          for select using (public.is_internal());

drop policy if exists brandmap_read       on public.brand_map;
create policy brandmap_read       on public.brand_map      for select using (public.is_internal());

drop policy if exists dict_read           on public.desc_dict;
create policy dict_read           on public.desc_dict      for select using (public.is_internal());

drop policy if exists erp_tarikan_read    on public.erp_tarikan;
create policy erp_tarikan_read    on public.erp_tarikan    for select using (public.is_internal());

drop policy if exists label_settings_read on public.label_settings;
create policy label_settings_read on public.label_settings for select using (public.is_internal());

-- dua yang berbunyi `true` apa adanya
drop policy if exists label_gudang_read   on public.label_gudang;
create policy label_gudang_read   on public.label_gudang   for select using (public.is_internal());

drop policy if exists units_read          on public.units;
create policy units_read          on public.units          for select using (public.is_internal());

-- ---------------------------------------------------------------------
-- Pemeriksa. Harus mengembalikan nol baris; kalau tidak, ada policy baca
-- yang kembali longgar dan namanya akan disebut di sini.
-- ---------------------------------------------------------------------
-- select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid)
--   from pg_policy p
--   join pg_class c on c.oid = p.polrelid
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and p.polcmd in ('r','*')
--    and (pg_get_expr(p.polqual,p.polrelid) is null
--         or pg_get_expr(p.polqual,p.polrelid) ~* '^\s*true\s*$'
--         or pg_get_expr(p.polqual,p.polrelid) ~* 'auth\.uid\(\) IS NOT NULL');
