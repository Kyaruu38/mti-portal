-- =====================================================================
-- rls_peran_pemasok.sql                 dijalankan: 5 Nov 2026
--
-- PERAN 'supplier': MELIHAT PO MILIKNYA SENDIRI DAN DESIGN DI DALAMNYA.
-- Nol kemampuan tulis. Prasyaratnya pos_supplier_id.sql dan
-- supplier_id_invoices_prfs.sql — tanpa kolom pemilik, policy di bawah
-- tidak punya apa pun untuk dibandingkan.
--
-- SATU ANGKA YANG MENGUBAH UKURAN PEKERJAAN INI: pemasok LABEL cuma
-- LIMA, bukan 46. 214 PO label seluruhnya tersambung ke lima baris
-- master. Jadi yang perlu dibuatkan akun lima, dan lima itu pula yang
-- diuji satu per satu di bawah.
--
-- KENAPA DEFAULTNYA SUDAH AMAN. pos_read dan designs_read berupa daftar
-- putih nama peran, jadi peran baru tidak ikut hanya karena dia ada —
-- dia harus disebut. Yang TIDAK aman adalah policy yang syaratnya cuma
-- "sudah login", dan itu dibereskan lebih dulu di
-- rls_tutup_policy_longgar.sql (sembilan policy) ditambah satu lagi yang
-- ketahuan saat sapuan terakhir di sini:
--     label_complaints.lc_read  ->  current_role() IS NOT NULL
-- Komplain kualitas label menyebut pemasok mana yang labelnya bermasalah;
-- dibiarkan, satu pemasok membaca keluhan tentang pesaingnya.
--
-- my_supplier_id() MENGEMBALIKAN NULL KALAU AKUNNYA BELUM DITAUTKAN, dan
-- itu disengaja: NULL tidak pernah sama dengan apa pun, jadi akun
-- pemasok yang lupa ditautkan melihat NOL baris. Kalau perbandingannya
-- dibalik atau NULL-nya dianggap 'cocokkan semua', kesalahan
-- administrasi sekecil itu membuka seluruh basis data. Syarat
-- `is not null` ditulis eksplisit di ketiga policy, bukan diandaikan.
--
-- DIUJI UNTUK KELIMA PEMASOK sebelum satu akun pun dibuat:
--   PT BSN TECHNOLOGIES INDONESIA  52 PO, 211 design, 1 baris master
--   PT WINS TUNGGAL PERDANA        49 PO, 159 design, 1 baris master
--   CV BINTANG CAHAYA LABEL        44 PO, 181 design, 1 baris master
--   PT SHENG YOU CORP              31 PO,  93 design, 1 baris master
--   PT WANLIAN TEKNOLOGI TAPE      10 PO,  10 design, 1 baris master
-- Kebocoran PO milik pemasok lain: 0. Kebocoran design: 0.
-- Sapuan akhir atas SELURUH policy baca: tidak tersisa satu pun yang bisa
-- dilewati akun pemasok. Dicek juga dari sesi wilbert yang betul-betul
-- login: ketujuh tabel tetap terbaca seperti biasa.
-- =====================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array[
  'wilbert','cania','visca','sekar','financemti','sona','cenjc','warehousemti','supplier'
]));

create or replace function public.is_supplier() returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.current_role() = 'supplier';
$fn$;

create or replace function public.my_supplier_id() returns uuid
language sql stable security definer set search_path = public as $fn$
  select p.supplier_id from public.profiles p where p.id = auth.uid();
$fn$;

-- PO: miliknya, sudah disetujui, belum dihapus.
drop policy if exists pos_read_supplier on public.pos;
create policy pos_read_supplier on public.pos for select using (
  public.is_supplier()
  and public.my_supplier_id() is not null
  and supplier_id = public.my_supplier_id()
  and status = 'Approved'
  and deleted_at is null
);

-- Design: HANYA yang ERP-nya dipakai di PO miliknya. Bukan 622 kartu.
drop policy if exists designs_read_supplier on public.designs;
create policy designs_read_supplier on public.designs for select using (
  public.is_supplier()
  and public.my_supplier_id() is not null
  and exists (
    select 1 from public.pos p, jsonb_array_elements(p.items) it
     where p.supplier_id = public.my_supplier_id()
       and p.status = 'Approved' and p.deleted_at is null
       and it->>'erp' = public.designs.erp
  )
);

-- Master pemasok: barisnya sendiri saja. Di tabel inilah nomor rekening
-- 45 perusahaan lain tinggal.
drop policy if exists suppliers_read_supplier on public.suppliers;
create policy suppliers_read_supplier on public.suppliers for select using (
  public.is_supplier()
  and public.my_supplier_id() is not null
  and id = public.my_supplier_id()
);

-- Ketemu saat sapuan terakhir; bukan bagian peran pemasok, tapi lubang
-- yang sama bentuknya.
drop policy if exists lc_read on public.label_complaints;
create policy lc_read on public.label_complaints for select using (public.is_internal());

-- ---------------------------------------------------------------------
-- BELUM DILAKUKAN, dan masing-masing butuh keputusan tersendiri:
--   * membuat akun auth + baris profiles untuk kelima pemasok
--     (profiles.supplier_id WAJIB diisi; tanpa itu akunnya melihat nol
--      baris — gagal ke arah aman, tapi tetap gagal)
--   * layar pemasok di portal + daftar ACCESS/CAPS untuk peran 'supplier'
--   * tidak ada policy INSERT/UPDATE/DELETE untuk peran ini, dan memang
--     belum boleh ada
-- ---------------------------------------------------------------------
