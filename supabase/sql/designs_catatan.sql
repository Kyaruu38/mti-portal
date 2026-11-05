-- Penanda hasil impor massal folder design Drive.
--   AMBIGU  : nama file cocok ke lebih dari satu kode ERP, mesin tidak menebak.
--   BENTROK : kode ERP-nya sudah dipakai kartu lain.
-- Kolom ini hanya dibaca layar Design Library untuk memberi bingkai kuning/merah.
-- Boleh dikosongkan lewat tombol Edit begitu ERP-nya dibetulkan.
alter table public.designs add column if not exists catatan text;
