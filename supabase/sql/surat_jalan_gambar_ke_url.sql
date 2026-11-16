-- =====================================================================
-- surat_jalan_gambar_ke_url.sql                dijalankan: 16 Nov 2026
--
-- GAMBAR LABEL YANG SAMA TERSIMPAN TIGA KALI — INI SALINAN KETIGANYA.
--
-- Lanjutan designs_thumb_ke_url.sql hari yang sama. Di sana kolom
-- designs.thumb turun dari 8,9 MB jadi 104 kB. Berkas ini mengurus
-- salinan berikutnya: surat_jalan.items, 5,7 MB untuk 32 baris saja --
-- sekitar 180 kB per surat jalan.
--
-- suratJalan.js:102 menyalin design.thumb ke dalam tiap baris item waktu
-- surat jalannya dibuat. Waktu thumb masih base64, yang tersalin base64.
-- Karena designs sudah dibereskan lebih dulu, surat jalan BARU otomatis
-- menyalin URL -- jadi berkas ini hanya mengurus yang terlanjur ada.
--
-- PENCOCOKANNYA LEWAT erp, DAN YANG RAGU TIDAK DISENTUH. Dari 268 item
-- yang memegang base64:
--   261  erp-nya dipegang TEPAT SATU design yang thumb-nya sudah URL
--          -> ditulis ulang
--     2  erp-nya dipegang LEBIH DARI SATU design  -> dibiarkan
--     1  erp-nya tidak ada di tabel designs       -> dibiarkan
--     4  design-nya ada tapi thumb-nya masih base64 (4 baris tanpa
--        drive_url yang memang sengaja tidak pernah disentuh) -> dibiarkan
-- Tujuh baris itu tetap base64 dengan sengaja. Menebak gambar mana yang
-- benar untuk erp kembar berarti mencetak gambar yang salah di surat
-- jalan, dan itu lebih mahal daripada 7 baris gemuk.
--
-- TEMUAN SUSULAN: TIGA BARIS MEMAKAI FORMAT LAMA YANG MEMANG RUSAK.
-- Waktu hasilnya diuji, 3 dari 20 contoh GAGAL dimuat. Ternyata bukan
-- hasil tulisan ulang ini, melainkan 3 item yang sejak dulu memegang
-- https://drive.google.com/thumbnail?id=... -- alamat yang MENGALIH dan
-- hanya berhasil untuk peramban yang sedang masuk sebagai pemilik
-- berkasnya. Itu persis bug yang diperbaiki v24.10 di tabel designs.
-- Tabel designs memang bersih sekarang (nol baris format lama), tapi
-- surat_jalan TIDAK PERNAH IKUT DIBERESKAN waktu itu. Pemasok yang
-- membuka ketiga baris itu melihat gambar rusak sejak v24.10 sampai hari
-- ini. Ketiganya ikut ditulis ulang di sini.
--
-- DIUJI, BUKAN DIASUMSIKAN. Contoh URL hasilnya dimuat lewat <img>
-- dengan crossOrigin='anonymous' dan referrerPolicy='no-referrer' --
-- permintaan tanpa cookie, setara mata pemasok. Semua yang diuji muat.
--
-- HASIL: lh3 267, format lama 0, base64 7, total item tetap 274 (nol
-- item hilang). Tabel surat_jalan 6.064 kB -> 232 kB sesudah vacuum full.
--
-- TIDAK ADA KODE YANG BERUBAH. Layar membaca it.designUrl seperti biasa;
-- isinya sekarang URL, bukan 20-an kB base64.
-- =====================================================================

-- 1. SALINAN YANG BISA DIBALIK, dibuat lebih dulu.
create table if not exists public.surat_jalan_items_backup (
  id           uuid primary key,
  items        jsonb not null,
  disalin_pada timestamptz not null default now()
);
revoke all on public.surat_jalan_items_backup from anon, authenticated;
alter table public.surat_jalan_items_backup enable row level security;
-- Tanpa policy: aplikasi tidak bisa membacanya, jadi nol egress.

insert into public.surat_jalan_items_backup (id, items)
select s.id, s.items from public.surat_jalan s
where s.items::text like '%data:image%'
on conflict (id) do nothing;

-- 2. base64 -> URL, hanya untuk erp yang dipegang TEPAT SATU design.
with pecah as (
  select s.id, e.ord, e.it
  from public.surat_jalan s,
       lateral jsonb_array_elements(s.items) with ordinality as e(it, ord)
), peta as (
  select erp, max(thumb) as thumb
  from public.designs where coalesce(erp,'') <> ''
  group by erp having count(*) = 1 and max(thumb) like 'http%'
), baru as (
  select p.id, jsonb_agg(
           case when p.it->>'designUrl' like 'data:%' and m.thumb is not null
                then jsonb_set(p.it, '{designUrl}', to_jsonb(m.thumb))
                else p.it end order by p.ord) as items
  from pecah p left join peta m on m.erp = p.it->>'erp'
  group by p.id
)
update public.surat_jalan s set items = b.items
from baru b where b.id = s.id and s.items::text like '%data:image%';

-- 3. Format thumbnail Drive lama -> lh3. Sisa pekerjaan v24.10.
with pecah as (
  select s.id, e.ord, e.it
  from public.surat_jalan s,
       lateral jsonb_array_elements(s.items) with ordinality as e(it, ord)
), baru as (
  select p.id, jsonb_agg(
    case when p.it->>'designUrl' like '%drive.google.com/thumbnail%'
              and substring(p.it->>'designUrl' from 'id=([A-Za-z0-9_-]{20,})') is not null
         then jsonb_set(p.it, '{designUrl}', to_jsonb(
                'https://lh3.googleusercontent.com/d/'
                || substring(p.it->>'designUrl' from 'id=([A-Za-z0-9_-]{20,})')
                || '=w400'))
         else p.it end order by p.ord) as items
  from pecah p group by p.id
)
update public.surat_jalan s set items = b.items
from baru b where b.id = s.id and s.items::text like '%drive.google.com/thumbnail%';

-- 4. Kembalikan ruangnya. JALANKAN SENDIRIAN -- SQL editor membungkus
--    banyak pernyataan dalam satu transaksi, dan VACUUM tidak bisa di
--    dalam transaksi (25001).
-- vacuum full public.surat_jalan;

-- PEMERIKSA (jangan percaya pesan Success):
-- select
--  (select count(*) from public.surat_jalan s, lateral jsonb_array_elements(s.items) it
--    where it->>'designUrl' like 'https://lh3%') as lh3_baik,
--  (select count(*) from public.surat_jalan s, lateral jsonb_array_elements(s.items) it
--    where it->>'designUrl' like '%drive.google.com/thumbnail%') as format_lama_sisa,
--  (select count(*) from public.surat_jalan s, lateral jsonb_array_elements(s.items) it
--    where it->>'designUrl' like 'data:%') as base64_sisa,
--  (select count(*) from public.surat_jalan s, lateral jsonb_array_elements(s.items) it) as total_item;
-- Harapan: 267 / 0 / 7 / 274.
--
-- MEMBALIKKAN:
-- update public.surat_jalan s set items = b.items
--   from public.surat_jalan_items_backup b where b.id = s.id;
