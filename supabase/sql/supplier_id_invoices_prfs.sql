-- =====================================================================
-- supplier_id_invoices_prfs.sql         dijalankan: 5 Nov 2026
-- (lanjutan dari pos_supplier_id.sql)
--
-- KENAPA invoices DAN prfs IKUT, BUKAN CUMA pos.
--
-- Mencetak ULANG sebuah PRF yang sudah terbit mencari pemasoknya lewat
-- NAMA (screens/payment.js baris 679 dan 711):
--     st.suppliers.find(s => s.name === prf.supplier) || { name: prf.supplier }
-- Cadangannya cuma membawa nama. Jadi kalau namanya meleset satu huruf,
-- PRF tercetak dengan baris bank KOSONG — ", ACC:  a/n. <nama>", alamat
-- '-', kontak '-'. Dokumen yang dipakai untuk membayar, tanpa nomor
-- rekening, dan tidak ada apa pun di layar yang memberi tahu.
--
-- Bahaya yang SATU TINGKAT LEBIH BURUK sudah tercatat di payment.js
-- baris 1825: find-by-name mengembalikan baris PERTAMA dengan nama itu,
-- sementara pembuatan pemasok tidak punya pemeriksaan keunikan. Pemasok
-- kedua bernama sama dengan rekening BERBEDA memenangkan pencarian itu,
-- dan PRF tercetak membawa rekening yang salah. openPrf() sudah
-- dibetulkan memakai id; jalur CETAK ULANG belum.
--
-- Maka sumbernya ditutup di basis data: setiap invoice dan PRF membawa
-- supplier_id sendiri, dan cetak ulang nanti membacanya lewat id.
--
-- Hasil backfill:
--     invoices  974 / 1050
--     prfs      922 /  998
--     pos       252 /  262
--
-- SISANYA DIBLOKIR OLEH DUA PASANG NAMA KEMBAR, bukan oleh pencocokan:
--     PT TANAH LUBRICUTING TECHNOLOGY INDONESIA  2 baris master
--         -> 67 invoice + 67 PRF + 1 PO menggantung
--         Isi uangnya IDENTIK (rekening ****7885, BCA, kota, TOP, PKP).
--         Yang berbeda cuma orang kontaknya: MR CHEN KANG (dibuat 4 Agu)
--         lawan AAN (13 Agu), dua-duanya oleh visca. Perlu satu jawaban
--         manusia: kontak mana yang berlaku.
--     NEWFORTUNE INTERNATIONAL HOLDING CO.,LTD   2 baris master
--         -> 9 invoice + 9 PRF menggantung
--         Diperiksa: SELURUH 14 kolom identik (1 nilai distinct), jadi
--         baris mana pun yang bertahan memberi rekening yang sama.
--         Penyebabnya ketahuan: namanya punya SPASI NYANGKUT di ujung.
--
-- 'PT AGRO LINO SEIAHTERA' (salah ketik I/J, 1 invoice + 1 PRF)
-- disambungkan ke 'PT AGRO LINO SEJAHTERA'. TEKS DOKUMENNYA TIDAK
-- DIUBAH — itu catatan sejarah; yang dibetulkan kaitannya.
-- =====================================================================

alter table public.invoices add column if not exists supplier_id uuid references public.suppliers(id);
alter table public.prfs     add column if not exists supplier_id uuid references public.suppliers(id);
create index if not exists invoices_supplier_id_idx on public.invoices (supplier_id);
create index if not exists prfs_supplier_id_idx     on public.prfs     (supplier_id);

-- Pencocokan toleran yang dipakai bersama. NULL kalau kandidatnya nol
-- ATAU lebih dari satu — menebak berarti satu dokumen pembayaran
-- menempel ke badan hukum yang salah.
create or replace function public.sup_cocok(p_nama text) returns uuid
language sql stable as $fn$
  select case
    when (select count(*) from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama))) = 1
      then (select s.id from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama)))
    when (select count(*) from public.suppliers s where upper(btrim(s.name))=upper(btrim(p_nama))) = 0
     and (select count(*) from public.suppliers s
           where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))
               = upper(regexp_replace(p_nama,'[^A-Za-z0-9]','','g'))) = 1
      then (select s.id from public.suppliers s
             where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))
                 = upper(regexp_replace(p_nama,'[^A-Za-z0-9]','','g')))
  end;
$fn$;

update public.invoices set supplier_id = public.sup_cocok(supplier) where supplier_id is null;
update public.prfs     set supplier_id = public.sup_cocok(supplier) where supplier_id is null;

update public.invoices set supplier_id = '348ad75c-97bd-4e22-8c01-0fd37e5152b4'
 where supplier_id is null and upper(btrim(supplier)) = 'PT AGRO LINO SEIAHTERA';
update public.prfs set supplier_id = '348ad75c-97bd-4e22-8c01-0fd37e5152b4'
 where supplier_id is null and upper(btrim(supplier)) = 'PT AGRO LINO SEIAHTERA';


-- =====================================================================
-- BELUM DIJALANKAN — menunggu keputusan pemilik.
--
-- Menghapus baris master pemasok adalah perubahan pada data yang dipakai
-- untuk MEMBAYAR, jadi ia tidak dijalankan tanpa persetujuan yang jelas.
-- Untuk NEWFORTUNE penggabungannya aman secara angka (14 kolom identik);
-- untuk PT TANAH, jalankan hanya SESUDAH memilih kontak yang berlaku.
-- =====================================================================
-- do $$
-- declare v_simpan uuid; v_buang uuid; r record;
-- begin
--   select id into v_simpan from public.suppliers
--    where btrim(name)='NEWFORTUNE INTERNATIONAL HOLDING CO.,LTD'
--    order by created_at limit 1;
--   select id into v_buang from public.suppliers
--    where btrim(name)='NEWFORTUNE INTERNATIONAL HOLDING CO.,LTD'
--      and id <> v_simpan limit 1;
--   select * into r from public.suppliers where id = v_buang;
--   insert into public.audit_log (username, entity, target, action, detail, status)
--   values ('wilbert','supplier', r.name, 'merge_duplicate',
--     'Baris kembar dihapus; seluruh kolom identik dengan '||v_simpan
--     ||'. Snapshot: bank='||coalesce(r.bank,'-')||', contact='||coalesce(r.contact,'-')
--     ||', phone='||coalesce(r.phone,'-')||', dibuat='||r.created_at, 'ok');
--   delete from public.suppliers where id = v_buang;
--   update public.suppliers set name = btrim(name) where name <> btrim(name);
-- end $$;
-- update public.invoices set supplier_id = public.sup_cocok(supplier) where supplier_id is null;
-- update public.prfs     set supplier_id = public.sup_cocok(supplier) where supplier_id is null;
-- update public.pos      set supplier_id = public.sup_cocok(supplier) where supplier_id is null;
