-- =============================================================================
-- pola_foto_varian — sudut pandang LAIN dari pola ban yang sama.
--
-- Tabel `pola_foto` memegang SATU foto per kode: yang dipakai layar artwork
-- waktu sebuah kode cocok persis. Tabel ini memegang sisanya.
--
-- Kenapa tabel terpisah, bukan kolom `bentuk` di pola_foto:
--
--   pola_foto punya satu baris per kode dan seluruh v27.0 bergantung pada itu.
--   cari_pola_foto() mengembalikan satu baris, fotoPas() di klien memutuskan
--   "cocok" atau "ambigu" dari jumlah baris yang pas, dan artwork memakai
--   hasilnya langsung. Menambah baris ke tabel itu — satu per sudut — membuat
--   setiap kode terlihat AMBIGU oleh kode yang sudah jalan, dan artwork yang
--   tadinya benar mulai menolak memilih. Perilaku yang rusak bukan di layar
--   baru, tapi di layar lama yang tidak disentuh siapa-siapa.
--
--   Jadi: pola_foto tetap "satu kode, satu foto utama". Yang di sini variannya.
--
-- BENTUK hanya tiga, dan namanya menyebut apa yang terlihat, bukan istilah
-- dari nama berkas aslinya (胎面/全侧/加轮辋 — tapak/tampak samping/pakai
-- pelek). Nama Mandarin itu tidak dipakai di sini dengan sengaja: yang membuka
-- layar ini orang gudang dan pembelian, bukan yang membuat berkasnya.
--
--   tapak  — strip tapak saja, tidak ada pelek. Yang dipakai label.
--   pelek  — tiga perempat, pelek kelihatan. Yang paling mirip ban sungguhan.
--   donat  — tampak samping penuh, bundar.
--
-- Satu kode TIDAK WAJIB punya ketiganya. Banyak yang cuma punya satu atau dua,
-- karena memang cuma itu yang ada di arsip. Layar library menampilkan apa
-- adanya dan tidak menandai yang kurang sebagai kesalahan.
-- =============================================================================

-- url_lihat dan url_gambar DITURUNKAN dari drive_id, bukan disimpan sendiri --
-- persis seperti pola_foto. Alasannya sudah terbukti di tabel itu: dua kolom
-- yang bisa diisi bebas berarti suatu hari ada baris yang drive_id-nya diganti
-- tapi url-nya tidak, dan yang terlihat di layar gambar LAMA dengan tautan
-- BARU. Generated column membuat keadaan itu tidak bisa ada.
create table if not exists public.pola_foto_varian (
  kode        text not null,
  bentuk      text not null check (bentuk in ('tapak', 'pelek', 'donat')),
  drive_id    text not null,
  url_lihat   text generated always as
                ('https://drive.google.com/file/d/' || drive_id || '/view') stored,
  url_gambar  text generated always as
                ('https://lh3.googleusercontent.com/d/' || drive_id) stored,
  dibuat_pada timestamptz not null default now(),
  primary key (kode, bentuk)
);

-- Dicari per kode dari layar library, selalu. Indeks pada kolom pertama PK
-- sudah cukup, tapi urutannya dieja supaya rencana kuerinya tidak bergantung
-- pada urutan kolom PK yang bisa berubah kalau tabelnya pernah diubah.
create index if not exists pola_foto_varian_kode_idx on public.pola_foto_varian (kode);

alter table public.pola_foto_varian enable row level security;

-- SELECT terbuka untuk semua yang login, sama seperti pola_foto. Foto tapak
-- ban bukan data rahasia — yang rahasia harga dan pemasoknya, dan tidak ada
-- satu pun di tabel ini. Menguncinya per peran cuma akan membuat orang gudang
-- membuka layar kosong tanpa tahu kenapa.
drop policy if exists pola_foto_varian_baca on public.pola_foto_varian;
create policy pola_foto_varian_baca on public.pola_foto_varian
  for select to authenticated using (true);

-- TULIS TIDAK DIBUKA DARI KLIEN. Isi tabel ini datang dari unggahan massal ke
-- Drive, bukan dari layar. Kalau nanti ada layar yang menambah foto, kebijakan
-- insert-nya ditulis waktu itu dan dibatasi ke peran yang memang mengunggah —
-- bukan dibuka sekarang "untuk jaga-jaga".

comment on table public.pola_foto_varian is
  'Sudut pandang lain dari pola ban. Foto utama tetap di pola_foto.';
