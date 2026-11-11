-- =====================================================================
-- sheet_sync_ping.sql
--
-- SINKRON 15 MENIT YANG BERHENTI TIDAK MEMBERI TAHU SIAPA PUN.
--
-- Sesudah otorisasinya beres, sinkron Sheet <-> portal jalan. Tapi waktu
-- diperiksa dari sisi basis data, jejaknya NOL -- dan itu bukan karena
-- gagal:
--
--   * arah TARIK (portal -> sheet) cuma membaca, jadi memang tidak
--     meninggalkan apa pun di basis data;
--   * arah KIRIM (sheet -> portal) cuma menulis kalau Qty Received atau
--     Arrival Date benar-benar berubah, jadi sinkron yang tidak menemukan
--     perubahan juga tidak meninggalkan apa pun.
--
-- Artinya "jalan" dan "mati total" KELIHATAN SAMA PERSIS dari portal.
-- Otorisasi yang kedaluwarsa, kuota Apps Script yang habis, trigger yang
-- terhapus, sheet yang diganti nama -- semuanya berhenti diam-diam, dan
-- yang menemukannya orang yang memakai angka basi untuk membeli.
--
-- Hari ini saja sudah dua kegagalan diam-diam yang bentuknya persis
-- begini: supplier_id yang tidak pernah diisi (26 PO November tidak
-- kelihatan oleh pemasoknya), dan layar izin Google yang menahan sinkron
-- ini sejak awal. Dua-duanya ketahuan dari mata orang, bukan dari portal.
--
-- Tabel ini satu baris per sheet, dan isinya cuma "kapan terakhir
-- menyapa". Yang membuatnya berguna bukan isinya, melainkan UMURNYA:
-- baris yang terakhir diperbarui 3 jam lalu untuk jadwal 15 menit adalah
-- kalimat yang jelas.
-- =====================================================================

create table if not exists public.sheet_sync_ping (
  nama        text primary key,
  terakhir    timestamptz not null default now(),
  baris_tarik int,
  baris_kirim int,
  catatan     text
);

alter table public.sheet_sync_ping enable row level security;
drop policy if exists ssp_read on public.sheet_sync_ping;
create policy ssp_read on public.sheet_sync_ping for select using (public.is_internal());
-- Tidak ada policy tulis: yang menulis cuma fungsi di bawah, dan dia
-- security definer. Jadi satu-satunya jalan menulis ke sini adalah lewat
-- token sheet yang sah.

create or replace function public.sheet_sync_ping(
  p_token text,
  p_tarik int default null,
  p_kirim int default null,
  p_catatan text default null
) returns timestamptz
language plpgsql security definer set search_path = public as $fn$
declare v_nama text;
begin
  select k.name into v_nama from public.sheet_keys k where k.token = p_token;
  if v_nama is null then
    raise exception 'token tidak dikenal';
  end if;
  insert into public.sheet_sync_ping (nama, terakhir, baris_tarik, baris_kirim, catatan)
  values (v_nama, now(), p_tarik, p_kirim, p_catatan)
  on conflict (nama) do update
    set terakhir = now(), baris_tarik = p_tarik, baris_kirim = p_kirim, catatan = p_catatan;
  return now();
end $fn$;

grant execute on function public.sheet_sync_ping(text,int,int,text) to anon, authenticated;

-- Pemeriksa: umur sapaan terakhir.
-- select nama, terakhir,
--        round(extract(epoch from now()-terakhir)/60) as menit_lalu,
--        baris_tarik, baris_kirim, catatan
--   from public.sheet_sync_ping order by terakhir desc;
