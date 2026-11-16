-- sheet_label_pull_ringkas
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc) 93c1502ba22b
--
-- KENAPA ADA
-- "1 jam ok, tapi pangkas payload nya juga dulu" (Kyaru).
--
-- sheet_label_pull mengirim SELURUH kolom PO tiap tarikan: 728 kB sekali
-- jalan, 23 kali sehari. Padahal yang benar-benar BISA berubah antar
-- tarikan cuma enam medan -- qty_terima, tgl_datang, invoice, status,
-- terkunci_sj, line_id. Sisanya (supplier, deskripsi, ukuran, qty order)
-- cuma berubah kalau PO-nya memang diubah orang lewat portal.
--
-- Fungsi ini mengembalikan yang enam itu saja: 262 kB, bukan 728 kB.
-- Diukur, bukan ditaksir: 1.512 baris di kedua-duanya.
-- Proyeksi egress tarikan per jam: 512 MB -> 198 MB per bulan
-- (23 tarikan ringkas + 1 tarikan penuh per hari).
--
-- KENAPA MASIH ADA TARIKAN PENUH SEKALI SEHARI
-- Medan statis BISA berubah -- orang mengubah deskripsi atau qty order
-- lewat portal -- dan tarikan ringkas tidak membawanya. Sehari adalah
-- batas paling lama sheet boleh salah soal itu. Tanggalnya disimpan di
-- PropertiesService ('penuh_terakhir'), bukan di sini.
--
-- SYARAT PAKAI, DAN INI DIJAGA DI "Sinkron Portal.gs" BUKAN DI SINI
-- Jalur ringkas MENYERAH dan jatuh ke tarikan penuh kalau ada line_id di
-- portal yang belum ada di sheet: itu PO baru, dan kolom statisnya cuma
-- datang dari tarikan penuh.
-- Kebalikannya BUKAN alasan menyerah. Baris sheet yang line_id-nya hilang
-- dari portal berarti PO-nya dihapus, dan sheet menyimpan baris itu
-- selamanya -- versi pertama menyerah di situ juga, dan akibatnya jalur
-- ringkas TIDAK PERNAH jalan sekali pun: satu PO dihapus sudah cukup untuk
-- mematikannya permanen. Sekarang barisnya ditandai di tempat
-- ('Dihapus di portal'), persis seperti yang dilakukan tarikan penuh.

CREATE OR REPLACE FUNCTION public.sheet_label_pull_ringkas(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak';
  end if;
  with li as (
    select p.no as po_no, x.i as it
      from public.pos p, jsonb_array_elements(p.items) as x(i)
     where p.source = 'label' and p.deleted_at is null
  ),
  sj as (
    select y ->> 'lineId' as line_id,
           sum(coalesce((y ->> 'qtyShipped')::numeric, 0)) as qty_sj,
           max(s.created_at)::date as tgl_sj
      from public.surat_jalan s, jsonb_array_elements(s.items) y
     where coalesce(s.status, 'aktif') <> 'batal'
     group by 1
  ),
  inv as (
    select po_ref, string_agg(distinct no, ', ') as inv_no
      from public.invoices where po_ref is not null group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'line_id', li.it ->> 'lineId',
      'qty_terima', coalesce(sj.qty_sj, 0) + coalesce((li.it ->> 'receivedDirect')::numeric, 0),
      'tgl_datang', coalesce(
          to_char(greatest(sj.tgl_sj, nullif(li.it ->> 'receivedDirectAt','')::date), 'YYYY-MM-DD'),
          to_char(sj.tgl_sj, 'YYYY-MM-DD'),
          left(nullif(li.it ->> 'receivedDirectAt',''), 10)),
      'invoice', coalesce(inv.inv_no, ''),
      'terkunci_sj', (coalesce(sj.qty_sj, 0) > 0),
      'status', case
          when coalesce(sj.qty_sj,0) + coalesce((li.it ->> 'receivedDirect')::numeric,0) <= 0
            then 'Not arrived / 未到货'
          when coalesce(sj.qty_sj,0) + coalesce((li.it ->> 'receivedDirect')::numeric,0)
               >= coalesce((li.it ->> 'qty')::numeric, 0)
            then 'Complete / 已齐'
          else 'Partial / 部分到货' end
    )), '[]'::jsonb) into v_out
  from li
  left join sj  on sj.line_id = li.it ->> 'lineId'
  left join inv on inv.po_ref = li.po_no;
  return v_out;
end $function$;
