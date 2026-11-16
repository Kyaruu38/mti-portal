-- surat_jalan: arahkan ulang 5 baris ke PO versi hidup
-- Dijalankan di produksi 2026-11-16. Sekali jalan, sudah selesai.
-- Disimpan sebagai catatan, BUKAN untuk dijalankan ulang.
--
-- MASALAHNYA
-- PO 'GR-WL-ARSN-ITR-CPTL-BXPTEU-2010' dihapus 2026-11-02 01:16
-- (cania request_delete 31 Okt, kevin approve_delete 2 Nov), lalu
-- DIBUAT ULANG 2026-11-02 06:45 dengan nomor dan 7 baris yang sama.
--   versi dihapus : 10db57b7-bd15-4f2c-9130-93f902a1743c
--   versi hidup   : e41b95c3-2265-4e0a-8fc6-8b48e7b8b4fe
-- Dua surat jalan sudah terbit SEBELUM itu dan masih menunjuk ke
-- lineId + poId versi lama:
--   PC/SJ/X/003-4 (23 Okt) 1 baris  2.000 pcs
--   PC/SJ/X/003-5 (27 Okt) 4 baris  8.000 pcs
-- Akibatnya 10.000 pcs yang sudah dikirim tidak terhitung di PO
-- manapun: qty_terima PO baru 0, baris tidak terkunci, dan sheet
-- LABEL ORDER TRACKER ikut salah. Tidak akan sembuh sendiri.
--
-- KENAPA AMAN DIPASANGKAN
-- Kedua versi PO sama-sama 7 baris, ERP-nya unik dan cocok 1:1,
-- qty tiap baris sama persis. Tidak ada tebakan.
-- Dicadangkan dulu ke public.sj_arah_ulang_backup (items lama utuh).
-- Baris SJ lain di dokumen yang sama (17 baris total, dari PO lain)
-- TIDAK disentuh - hanya 5 yang poId-nya versi lama.
--
-- HASIL
-- baris SJ yatim 5 -> 0 ; PO baru tercatat terima 10.000 (+3.000 dari
-- PC/SJ/XI/006-1 6 Nov yang memang sudah benar) ; 5 baris di sheet jadi
-- Complete dan terkunci, tanggalnya tanggal SJ asli (23 & 27 Okt).

begin;

create table if not exists public.sj_arah_ulang_backup (
  dibuat timestamptz default now(), sj_id uuid, sj_no text, items_lama jsonb);

insert into public.sj_arah_ulang_backup (sj_id, sj_no, items_lama)
select s.id, s.no, s.items from public.surat_jalan s
 where s.no in ('PC/SJ/X/003-4','PC/SJ/X/003-5');

with lama as (
  select x.i->>'lineId' as line_id, x.i->>'erp' as erp
    from public.pos p, jsonb_array_elements(p.items) x(i)
   where p.id = '10db57b7-bd15-4f2c-9130-93f902a1743c'
), baru as (
  select x.i->>'lineId' as line_id, x.i->>'erp' as erp
    from public.pos p, jsonb_array_elements(p.items) x(i)
   where p.id = 'e41b95c3-2265-4e0a-8fc6-8b48e7b8b4fe'
), peta as (
  select l.line_id as lama, b.line_id as baru from lama l join baru b on b.erp = l.erp
)
update public.surat_jalan s
   set items = (
     select jsonb_agg(
              case when pt.baru is not null
                   then jsonb_set(jsonb_set(y.i, '{lineId}', to_jsonb(pt.baru)),
                                  '{poId}', to_jsonb('e41b95c3-2265-4e0a-8fc6-8b48e7b8b4fe'::text))
                   else y.i end
              order by y.ord)
       from jsonb_array_elements(s.items) with ordinality as y(i, ord)
       left join peta pt on pt.lama = y.i->>'lineId')
 where s.no in ('PC/SJ/X/003-4','PC/SJ/X/003-5');

insert into public.audit_log (username, entity, target, action, detail)
values ('claude-perbaikan','surat_jalan','PC/SJ/X/003-4 + PC/SJ/X/003-5','repoint',
        '5 baris diarahkan dari PO GR-WL-ARSN-ITR-CPTL-BXPTEU-2010 versi dihapus (10db57b7) ke versi hidup (e41b95c3); cocok 1:1 lewat ERP, qty sama; cadangan di public.sj_arah_ulang_backup');

commit;

-- CARA BALIKIN kalau ternyata salah:
--   update public.surat_jalan s set items = b.items_lama
--     from public.sj_arah_ulang_backup b where b.sj_id = s.id;
