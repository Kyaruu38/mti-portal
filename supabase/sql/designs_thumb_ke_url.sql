-- =====================================================================
-- designs_thumb_ke_url.sql                     dijalankan: 16 Nov 2026
--
-- PORTAL INI PUNYA TANGGAL MATI, DAN SEBABNYA SATU KOLOM.
--
-- Supabase menandai organisasi ini melewati kuota: egress 6,55 GB dari
-- jatah 5 GB (131%). Masa tenggangnya habis 13 Des 2026; sesudah itu
-- permintaan ke portal dijawab HTTP 402. Semua metrik lain lapang --
-- basis data 73 MB dari 500 MB, storage 9 MB dari 1 GB, Edge Function
-- 5.214 dari 500.000, dan pemakainya DUA BELAS orang dari jatah 50.000.
-- Yang lewat cuma egress: data yang keluar.
--
-- Dua belas orang tidak bisa menarik 6,5 GB dengan mengetik. Yang
-- menariknya login mereka: auth/session.js memuat ~20 tabel UTUH setiap
-- kali seseorang masuk, dan designs sendirian 13 MB -- 8,9 MB di
-- antaranya kolom `thumb`, gambar base64 yang ditanam di dalam Postgres.
-- fetchDesigns() memanggil select('*'), jadi tiap login menyeret seluruh
-- 8,9 MB itu. Dua belas orang, dua kali login sehari, tiga puluh hari:
-- sekitar 18 GB. Angka 6,55 GB jatuh nyaman di dalam amplop itu.
--
-- INI BUKAN TEMUAN BARU. v23.x sudah menulisnya sendiri: "designs 11 MB,
-- yang 9 MB-nya kolom thumb" dan "gambar label yang sama tersimpan TIGA
-- KALI di sistem ini". Waktu itu yang diperbaiki BACKUP-nya --
-- backup_snapshot() berhenti ikut membawa thumb, 39 MB jadi 22 MB.
-- Jalur BACA portalnya tidak pernah ikut diperbaiki. Backup berhenti
-- menarik thumb; aplikasinya masih menariknya setiap hari sejak itu.
--
-- POLANYA JUGA SUDAH ADA. v24.10 menulis ulang 240 baris dari URL
-- thumbnail Drive yang mengalih ke lh3.googleusercontent.com/d/<id>=w400,
-- yang melayani gambarnya langsung. Berkas ini melakukan hal yang sama
-- untuk 404 baris yang masih memegang base64 -- bukan gagasan baru,
-- melainkan pekerjaan v24.10 yang diselesaikan sampai habis.
--
-- KENAPA AMAN DIHAPUS: gambarnya tidak hilang, cuma berhenti disalin.
-- 644 dari 648 baris designs punya drive_url, jadi berkasnya memang ada
-- di Drive. designImage() di labelLibrary.js membaca d.thumb lebih dulu,
-- dan sesudah berkas ini d.thumb tetap terisi -- isinya URL 60-an
-- karakter, bukan 22 kB base64. TIDAK ADA KODE YANG PERLU BERUBAH.
--
-- EMPAT BARIS SENGAJA TIDAK DISENTUH. Empat baris memegang thumb base64
-- TANPA drive_url yang berpola. Untuk mereka base64 itu satu-satunya
-- salinan yang ada, jadi menghapusnya berarti menghapus gambarnya.
-- Aturan yang sama persis dipakai backup_snapshot() v23.x.
--
-- DIUJI SEBELUM DIJALANKAN, bukan sesudah: 60 berkas contoh diambil acak
-- dari 404 itu lalu dimuat lewat <img> dengan crossOrigin='anonymous'
-- dan referrerPolicy='no-referrer' -- permintaan TANPA cookie, setara
-- mata pemasok yang tidak login ke akun pemilik berkas. 60 dari 60 muat
-- pada lebar 400 px. Itu pemeriksaan yang tidak dilakukan v24.10 dan
-- justru jadi sebab bug-nya: alamat lama berhasil hanya KARENA peramban
-- yang membukanya sedang masuk sebagai pemilik berkasnya.
-- =====================================================================

-- 1. SALINAN YANG BISA DIBALIK. Dibuat lebih dulu, bukan sesudah.
create table if not exists public.designs_thumb_base64_backup (
  id          uuid primary key,
  thumb       text not null,
  disalin_pada timestamptz not null default now()
);

-- alter default privileges di Supabase memberi `authenticated` jauh lebih
-- banyak daripada yang disangka (label_prices dulu ternyata membawa INSERT,
-- UPDATE, TRUNCATE). Jadi dicabut dulu, baru diberi yang seharusnya --
-- dan di sini yang seharusnya adalah: tidak ada.
revoke all on public.designs_thumb_base64_backup from anon, authenticated;
alter table public.designs_thumb_base64_backup enable row level security;
-- Tanpa policy sama sekali: RLS menutup semuanya. Hanya service_role dan
-- SQL editor yang bisa membacanya, dan memang cuma itu yang perlu.

insert into public.designs_thumb_base64_backup (id, thumb)
select d.id, d.thumb from public.designs d
where d.thumb like 'data:%'
on conflict (id) do nothing;

-- 2. TULIS ULANG. Hanya baris yang base64 DAN punya id berkas Drive.
update public.designs d
   set thumb = 'https://lh3.googleusercontent.com/d/'
               || substring(d.drive_url from '/d/([A-Za-z0-9_-]{20,})')
               || '=w400'
 where d.thumb like 'data:%'
   and d.drive_url ~ '/d/[A-Za-z0-9_-]{20,}';

-- 3. Kembalikan ruangnya ke sistem berkas. update meninggalkan baris mati;
--    tanpa ini ukuran tabelnya tidak turun dan egress-nya ikut tidak turun.
vacuum full public.designs;
analyze public.designs;

-- PEMERIKSA (jalankan terpisah, jangan percaya pesan Success):
-- select count(*) filter (where thumb like 'data:%') as sisa_base64,
--        count(*) filter (where thumb like 'http%')  as sudah_url,
--        count(*) as total,
--        pg_size_pretty(pg_total_relation_size('public.designs')) as ukuran
--   from public.designs;
-- Harapan: sisa_base64 = 4, sudah_url = 644, ukuran turun dari 13 MB.
--
-- MEMBALIKKAN (kalau gambarnya ternyata tidak muat di mata pemasok):
-- update public.designs d set thumb = b.thumb
--   from public.designs_thumb_base64_backup b where b.id = d.id;
