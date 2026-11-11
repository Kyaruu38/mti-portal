-- =====================================================================
-- urgensi_label.sql
--
-- DAFTAR URGENSI LABEL: YANG DIPAKAI MEMBELI, BUKAN DAFTAR SONA.
--
-- Permintaan Kyaru, kata-katanya sendiri: "gw dan anak anak gw (cania,
-- visca, kevin) itu bisa ngelakuin ini, karena data yg sona kasih itu ga
-- akurat, jadi gw mau anak anak gw update yang mereka dpt dari gudang
-- dan dari sona di sort dan di jadiin 1 sesuai dengan urgensi nya jadi
-- gw purchasing bakal beli sesuai data ini bukan data sona".
--
-- Dua tabel, dan keduanya menjawab pertanyaan yang TIDAK BISA dijawab
-- oleh berkas Excel sekuat apa pun parsernya:
--
--   label_urgensi            apa yang orang-orangnya BETULKAN
--   label_urgensi_snapshot   bagaimana ETA BERGESER antar unggahan
--
-- Daftar gabungannya sendiri TIDAK disimpan, dan itu disengaja. Dia
-- hasil hitungan dari tiga berkas yang diunggah tiap periode; menyimpan
-- hasilnya berarti punya dua sumber kebenaran yang suatu hari berbeda,
-- dan yang salah justru yang akan dipakai membeli karena dia yang
-- tersimpan. Yang disimpan cuma yang tidak bisa dihitung ulang:
-- koreksi manusia, dan keadaan masa lalu.
--
-- KUNCINYA (ukuran, kode pola, ply), BUKAN NOMOR BARIS DAN BUKAN NAMA.
-- Nama barang ditulis tiga gaya berbeda di tiga berkas — merek kadang
-- Mandarin saja, indeks beban kadang hilang, ukuran '10.00-20' di satu
-- tempat dan '10.00R20' di tempat lain. Diukur: mencocokkan nama utuh
-- dapat 19%; kunci ini dapat 100% di sisi Sona dan 94-99% di sisi
-- gudang. Nomor baris lebih buruk lagi — berkasnya diunggah ulang tiap
-- periode dan urutannya berubah, jadi koreksi berindeks baris akan
-- menempel ke BARANG YANG SALAH pada unggahan berikutnya.
--
-- Kunci ini TIDAK dipakai menentukan merek. Satu spec ban dijual di
-- banyak merek, dan cara itu sudah dicoba lalu dibuang karena
-- menghasilkan 威狮=ARISUN dan 朝阳=GOODRIDE. Di sini dia cuma menjawab
-- "baris gudang mana yang bicara tentang barang yang sama".
--
-- KEVIN TIDAK PERLU PERAN BARU. Username kevin memakai alias peran
-- 'wilbert' (lihat src/auth/roles.js), jadi daftar peran di policy
-- bawah sudah memuatnya. Menambahkan peran bernama 'kevin' berarti
-- menyentuh ke-37 capability plus setiap policy yang menyebut nama
-- peran — dan tidak ada satu pun hak yang berbeda untuk dia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KOREKSI MANUSIA
--
-- fisik / butuh BOLEH NULL, dan null BERBEDA ARTINYA dari 0: null
-- berarti "tidak dikoreksi, pakai angka berkas", 0 berarti "gudang
-- sudah dihitung dan isinya memang nol". Menyamakannya membuat stok
-- nol yang sudah dipastikan orang tidak bisa dibedakan dari stok yang
-- belum pernah dilihat — dan yang pertama harus dibeli, yang kedua
-- harus dicek dulu.
--
-- Angka berkasnya TIDAK disimpan di sini. Dia dihitung ulang dari
-- berkas tiap kali, dan layarnya menampilkan dua-duanya berdampingan
-- ("Dua-duanya ditampilin, selisihnya ditandai"). Menyimpannya berarti
-- angka berkas beku yang akan berbeda dari berkas bulan depan.
-- ---------------------------------------------------------------------
create table if not exists public.label_urgensi (
  kunci      text primary key,
  fisik      numeric,
  butuh      numeric,
  catatan    text,
  oleh       text,
  pada       timestamptz not null default now(),
  -- Setiap perubahan DICATAT, tidak diam-diam ditimpa. Seluruh alasan
  -- tabel ini ada adalah "berkasnya salah dan kami betulkan"; tanpa
  -- jejak, enam bulan lagi tidak ada yang bisa menjawab siapa yang
  -- mengubah 4.000 jadi 400 dan kenapa.
  riwayat    jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------
-- 2. SNAPSHOT ETA
--
-- Yang diminta: "belum lagi ada update pergerakan buat shipment kita
-- juga kan". Pertanyaannya bukan "kapan ETA-nya" tapi "ETA-nya GESER
-- berapa hari sejak unggahan terakhir", dan itu tidak bisa dijawab oleh
-- satu berkas. Harus ada yang menyimpan keadaan sebelumnya.
--
-- Yang disimpan SESEDIKIT mungkin: per kunci, tanggal paling awal,
-- jumlah terjadwal, jumlah yang belum dijadwalkan. Menyimpan seluruh
-- barisnya berarti tiap unggahan menambah satu salinan penuh daftarnya.
--
-- PERIODENYA TIDAK DITENTUKAN, dan itu mengikuti kenyataannya:
-- "periodenya brp lama sekali ya ga nentu". Jadi tidak ada kolom bulan,
-- tidak ada unik per periode — yang ada cuma waktu unggahnya, dan
-- pergerakan dihitung antara dua snapshot yang BERURUTAN, apa pun
-- jaraknya.
-- ---------------------------------------------------------------------
create table if not exists public.label_urgensi_snapshot (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  oleh       text,
  berkas     text,
  eta        jsonb not null,
  ringkasan  jsonb
);

create index if not exists label_urgensi_snapshot_at on public.label_urgensi_snapshot (at desc);

-- ---------------------------------------------------------------------
-- 3. RLS
--
-- Baca: semua peran internal. Daftar urgensi adalah daftar yang dipakai
-- membeli, dan yang tidak boleh melihatnya cuma pemasok.
--
-- Tulis: purchasing saja — wilbert (termasuk kevin lewat alias peran),
-- cania, visca. SONA TIDAK IKUT, dan itu bukan kelalaian: seluruh
-- maksud tabel ini adalah mengoreksi angka yang dia berikan. Yang
-- dikoreksi tidak memegang pena koreksinya.
-- ---------------------------------------------------------------------
alter table public.label_urgensi          enable row level security;
alter table public.label_urgensi_snapshot enable row level security;

create or replace function public.is_urgensi_write() returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.current_role() = any (array['wilbert','cania','visca']);
$fn$;

drop policy if exists urgensi_read   on public.label_urgensi;
create policy urgensi_read   on public.label_urgensi   for select using (public.is_internal());
drop policy if exists urgensi_write  on public.label_urgensi;
create policy urgensi_write  on public.label_urgensi   for all    using (public.is_urgensi_write()) with check (public.is_urgensi_write());

drop policy if exists urgensi_snap_read  on public.label_urgensi_snapshot;
create policy urgensi_snap_read  on public.label_urgensi_snapshot for select using (public.is_internal());
drop policy if exists urgensi_snap_write on public.label_urgensi_snapshot;
create policy urgensi_snap_write on public.label_urgensi_snapshot for insert with check (public.is_urgensi_write());

-- Snapshot TIDAK BISA DIUBAH ATAU DIHAPUS oleh siapa pun lewat portal.
-- Dia catatan keadaan masa lalu, dan catatan yang bisa diedit tidak bisa
-- dipakai membuktikan pergerakan. Tidak ada policy update/delete sama
-- sekali — RLS menolak secara bawaan apa yang tidak disebut.

-- ---------------------------------------------------------------------
-- 4. UPSERT KOREKSI, dengan jejaknya
--
-- Dilakukan di fungsi, bukan di layar: layar yang menulis riwayat
-- sendiri akan menuliskannya HANYA dari layar itu, dan koreksi yang
-- masuk dari jalur lain (impor, perbaikan massal) kehilangan jejaknya
-- tanpa ada yang sadar.
--
-- NILAI YANG TIDAK DIKIRIM TIDAK DISENTUH. p_fisik dan p_butuh dipisah
-- dari penanda 'apakah medan ini ikut dikirim' lewat p_medan, karena
-- NULL di sini adalah NILAI YANG SAH ("batalkan koreksi, pakai angka
-- berkas") dan tidak bisa sekaligus berarti "jangan diubah".
-- ---------------------------------------------------------------------
create or replace function public.label_urgensi_koreksi(
  p_kunci text,
  p_medan text[],
  p_fisik numeric default null,
  p_butuh numeric default null,
  p_catatan text default null,
  p_oleh text default null
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_lama public.label_urgensi;
  v_jejak jsonb := '[]'::jsonb;
  v_fisik numeric;
  v_butuh numeric;
  v_catatan text;
begin
  if not public.is_urgensi_write() then
    raise exception 'peran % tidak boleh mengoreksi daftar urgensi', public.current_role();
  end if;
  if p_kunci is null or btrim(p_kunci) = '' then
    raise exception 'kunci kosong — baris tanpa kunci gabung tidak bisa dikoreksi';
  end if;

  select * into v_lama from public.label_urgensi where kunci = p_kunci;

  v_fisik   := case when 'fisik'   = any (p_medan) then p_fisik   else v_lama.fisik end;
  v_butuh   := case when 'butuh'   = any (p_medan) then p_butuh   else v_lama.butuh end;
  v_catatan := case when 'catatan' = any (p_medan) then p_catatan else v_lama.catatan end;

  if v_lama.kunci is null or v_lama.fisik is distinct from v_fisik then
    v_jejak := v_jejak || jsonb_build_array(jsonb_build_object(
      'medan','fisik','dari',v_lama.fisik,'jadi',v_fisik,
      'oleh',coalesce(p_oleh,public.current_role()),'pada',to_char(now(),'YYYY-MM-DD HH24:MI')));
  end if;
  if v_lama.kunci is null or v_lama.butuh is distinct from v_butuh then
    v_jejak := v_jejak || jsonb_build_array(jsonb_build_object(
      'medan','butuh','dari',v_lama.butuh,'jadi',v_butuh,
      'oleh',coalesce(p_oleh,public.current_role()),'pada',to_char(now(),'YYYY-MM-DD HH24:MI')));
  end if;

  insert into public.label_urgensi (kunci, fisik, butuh, catatan, oleh, pada, riwayat)
  values (p_kunci, v_fisik, v_butuh, v_catatan, coalesce(p_oleh, public.current_role()), now(), v_jejak)
  on conflict (kunci) do update
     set fisik   = v_fisik,
         butuh   = v_butuh,
         catatan = v_catatan,
         oleh    = coalesce(p_oleh, public.current_role()),
         pada    = now(),
         riwayat = coalesce(public.label_urgensi.riwayat,'[]'::jsonb) || v_jejak;

  return jsonb_build_object('kunci', p_kunci, 'medan_berubah', jsonb_array_length(v_jejak));
end $fn$;

-- Baris yang SELURUH koreksinya dibatalkan tidak perlu tinggal sebagai
-- baris kosong — tapi riwayatnya tetap. Jadi tidak ada delete di sini;
-- yang membatalkan koreksi mengirim NULL, dan barisnya tetap memegang
-- catatan bahwa dia pernah dikoreksi lalu dibatalkan.
