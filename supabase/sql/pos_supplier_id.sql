-- =====================================================================
-- pos_supplier_id.sql                   dijalankan: 5 Nov 2026
--
-- KOLOM PEMILIK YANG SELAMA INI TIDAK PERNAH ADA.
--
-- Sebelum ini TIDAK ADA SATU PUN kolom supplier_id di seluruh basis data.
-- Delapan tabel menyebut pemasok sebagai TEKS NAMA:
--   pos, prfs, invoices, payments, ppkek, surat_jalan,
--   label_prices, label_complaints
--
-- Selama cuma orang dalam yang memakai portal, itu tidak pernah terasa.
-- Dua hal membuatnya terasa sekarang:
--
--   1. Rencana akun pemasok. Policy "pemasok hanya melihat PO miliknya"
--      harus bersandar pada sesuatu. Nama teks bukan sesuatu — basis data
--      ini memuat DUA baris pemasok dengan nama yang identik, jadi nama
--      tidak bisa menjawab "baris ini milik siapa".
--
--   2. Pembetulan ejaan menjadi BERBAHAYA. Master memuat salah ketik
--      'PT KOLABORASI CHEMICAL INDUSTRIY INDONESIA', dan ejaan salah itu
--      sudah menempel di 2 PRF dan 2 invoice. Membetulkannya di master —
--      yang kelihatan seperti perbaikan sepele — justru MEMUTUS keempat
--      dokumen itu dari master pemasoknya, karena satu-satunya kaitan
--      yang ada adalah kecocokan teks. Hal yang sama berlaku untuk empat
--      nama pemasok yang punya spasi nyangkut di ujungnya.
--
-- Jadi urutannya: supplier_id dulu, baru ejaan. Sesudah kolom ini terisi,
-- nama tinggal label tampilan dan membetulkannya tidak memutus apa pun.
--
-- PERUBAHANNYA MENAMBAH, TIDAK MENGUBAH. Kolomnya nullable, tidak ada
-- satu pun nilai lama yang ditulis ulang, dan pos.supplier tetap apa
-- adanya — dokumen PO yang sudah dikirim ke pemasok mencetak teks itu,
-- dan dokumen bersegel tidak boleh berubah isinya di belakang punggung
-- orang. ("Yang sudah terjadi biarlah terjadi.")
--
-- Hasil backfill: 252 dari 262 PO tersambung (96,2%).
-- Sepuluh sisanya SENGAJA dibiarkan NULL, bukan ditebak:
--   SAMATOR INDO GAS                            4 PO  belum ada di master
--   PT Kolaborasi Chemical Industry Indonesia   2 PO  master salah ketik
--   PT TANAH LUBRICUTING TECHNOLOGY             2 PO  kurang kata INDONESIA
--   PT INDONESIA LIPU ELECTROMECHANICAL         1 PO  belum ada di master
--   PT TANAH LUBRICUTING TECHNOLOGY INDONESIA   1 PO  master punya 2 baris
-- Menebak di sini berarti satu PO menempel ke badan hukum yang salah,
-- dan badan hukum itulah yang nanti dibayar.
-- =====================================================================

alter table public.pos      add column if not exists supplier_id uuid references public.suppliers(id);
alter table public.profiles add column if not exists supplier_id uuid references public.suppliers(id);
create index if not exists pos_supplier_id_idx on public.pos (supplier_id);

with k as (
  select p.id as po_id,
         (select s.id   from public.suppliers s where upper(btrim(s.name)) = upper(btrim(p.supplier)) limit 1) as persis,
         (select count(*) from public.suppliers s where upper(btrim(s.name)) = upper(btrim(p.supplier)))        as n_persis,
         (select s.id   from public.suppliers s
           where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))
               = upper(regexp_replace(p.supplier,'[^A-Za-z0-9]','','g')) limit 1)                               as norm,
         (select count(*) from public.suppliers s
           where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g'))
               = upper(regexp_replace(p.supplier,'[^A-Za-z0-9]','','g')))                                       as n_norm
    from public.pos p
)
update public.pos p
   set supplier_id = case
         when k.n_persis = 1                 then k.persis
         when k.n_persis = 0 and k.n_norm = 1 then k.norm
       end
  from k where k.po_id = p.id;

-- Pemeriksa: PO yang belum tersambung, beserta nama yang tertulis di PO.
-- select supplier, count(*) from public.pos where supplier_id is null
--  group by 1 order by 2 desc;
