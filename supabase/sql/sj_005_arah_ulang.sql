-- PC/SJ/X/005-1 — satu baris surat jalan diarahkan ke PO versi hidup
-- DIJALANKAN SEKALI, 17 Nov 2026. Catatan, bukan migrasi.
--
-- BENTUKNYA SAMA PERSIS DENGAN PERBAIKAN 16 Nov, DAN ITU YANG PENTING.
-- PO 'OMNIMAX SYC-OEM-1210' dihapus 14 Okt 09:37 lalu dibuat ulang dengan
-- NOMOR YANG SAMA 14 Okt 10:45. Surat jalannya tetap memegang poId dan
-- lineId milik versi yang sudah mati. Dari layar tidak ada yang terlihat
-- aneh: nomor PO-nya ada, barangnya ada, angkanya ada.
--
-- Sapuan 16 Nov menutup dengan "0 yatim" dan baris ini TIDAK tertangkap.
-- Sebabnya pantas dicatat: sapuan itu memeriksa surat jalan yang terkait PO
-- yang sedang dibenahi, bukan SELURUH tabel. Pemeriksaan yang ruang
-- lingkupnya menyempit diam-diam akan melaporkan nol dengan jujur dan tetap
-- salah. Sapuan 17 Nov memeriksa semuanya: 37 dokumen, dua arah (poId mati
-- dan lineId yatim).
--
-- KENAPA PASANGANNYA YAKIN, bukan ditebak:
--   * ERP 0105045809601ID muncul DUA kali di PO hidup (a9fbf098):
--       idx 1  qty 3000   lineId ln_ec9a480c...
--       idx 10 qty 270    lineId ln_90770b81...
--     ERP saja ambigu; qty yang memutuskan.
--   * Baris surat jalannya qty 3000 -> pasangannya idx 1.
--   * Baris ber-ERP sama di PO yang DIHAPUS juga qty 3000, lineId
--     ln_6cd3af1c... — persis yang dipegang surat jalan itu. Pemetaan 1:1.
--   * ln_ec9a480c BELUM dipakai surat jalan mana pun, jadi mengarahkan ke
--     sana tidak membuat satu kiriman terhitung dua kali. Ini diperiksa
--     SEBELUM menulis, bukan sesudah.
--
-- Hasil sesudah dijalankan: sj_po_mati 0, sj_lineid_yatim 0, 37 dokumen.
-- Cadangan: public.sj_005_arah_ulang_backup (1 baris).

begin;

create table if not exists public.sj_005_arah_ulang_backup as
  select now() as dicadangkan, s.* from public.surat_jalan s where s.no = 'PC/SJ/X/005-1';

with hidup as (
  select p.id::text as po_id, x.i ->> 'lineId' as line_id
    from public.pos p, jsonb_array_elements(p.items) x(i)
   where p.deleted_at is null
     and p.no = 'OMNIMAX SYC-OEM-1210'
     and x.i ->> 'erp' = '0105045809601ID'
     and (x.i ->> 'qty')::numeric = 3000
)
update public.surat_jalan s
   set items = jsonb_set(
                 jsonb_set(s.items, '{0,poId}',   to_jsonb((select po_id   from hidup))),
                 '{0,lineId}', to_jsonb((select line_id from hidup)))
 where s.no = 'PC/SJ/X/005-1'
   and (s.items->0->>'erp') = '0105045809601ID'
   and (s.items->0->>'qty') = '3000'
   and (s.items->0->>'lineId') like 'ln_6cd3af1c%'
   and (select count(*) from hidup) = 1;   -- nol atau dua kandidat = tidak menulis apa pun

commit;
