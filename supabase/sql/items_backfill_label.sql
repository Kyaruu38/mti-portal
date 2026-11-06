-- =============================================================================
-- BACKFILL public.items — MASTER LABEL YANG SELAMA INI BERISI 9 BARIS.
--
-- v23.1 membuat panen data label dari lembar order, dan panen itu jalan — tapi
-- dia cuma nyala SESUDAH PO TERBIT. Jadi sejak v23.1 rilis, yang masuk cuma
-- 9 ERP, dan dari 9 itu cuma 1 yang punya EAN. Tabel yang seharusnya jadi
-- master teks cetak label berisi 9 baris sementara sistemnya mengenal 1.474
-- ERP. Data lamanya tidak pernah di-backfill; tidak ada yang pernah menulis
-- langkah itu.
--
-- DIJALANKAN 6 Nov 2026. Hasil: 9 -> 1.541 baris.
--
-- ATURAN YANG DIPEGANG DI SELURUH BERKAS INI: coalesce(yang_ada, yang_baru).
-- Nilai yang SUDAH ada tidak pernah ditimpa, sekali pun sumber barunya
-- kelihatan lebih lengkap. Backfill yang menimpa adalah cara paling rapi untuk
-- menghapus data berbulan-bulan tanpa ada yang sadar.
-- =============================================================================

-- LANGKAH 1 — EAN / SNI / NPB dari master "EAN-13 CODE 印尼 nomor barcode.xlsx".
--
-- Berkas itu 4.995 baris, TAPI cuma 193 baris yang punya ERP CODE (190 unik).
-- 4.805 sisanya punya EAN, SNI dan NPB lengkap tapi dikunci dengan NAMA BARANG,
-- bukan ERP. Mencocokkannya lewat nama berarti menebak, dan yang ditebak di
-- sini adalah nomor sertifikat yang tercetak di label — persis kelas kesalahan
-- yang sudah pernah menggigit di jalur PRF (cari-pemasok-lewat-nama, v23.0).
-- Jadi yang dimuat HANYA yang berkunci ERP. Sisanya pekerjaan tersendiri yang
-- butuh daftar usulan + persetujuan manusia, bukan satu UPDATE.
--
-- Payload dikirim sebagai teks ber-pemisah '~' lalu dipecah di SQL:
--   erp ~ ean ~ sni ~ npb ~ ply ~ load_speed ~ tt_tl ~ ms ~ pattern ~ size
-- Nilai '/' di kolom SNI/NPB berarti "tidak berlaku" di berkas aslinya, jadi
-- dibaca sebagai NULL, bukan sebagai string '/'.
--
--   insert into items (erp, ean, sni_no, npb1, ply, load_speed, tt_tl, ms, pattern, size, terakhir_dari)
--   select ... from src
--   on conflict (erp) do update set
--     ean = coalesce(items.ean, excluded.ean), ... ;
--
-- Hasil langkah 1: 9 -> 199 baris; 191 punya EAN, 150 SNI, 185 NPB.

-- LANGKAH 2 — spec / brand / market untuk SELURUH ERP yang dikenal sistem.
with sumber as (
  select erp, nullif(spec,'') as spec, nullif(brand,'') as brand, nullif(market,'') as market, 1 as prio, 'designs' as dari
    from designs where erp is not null and erp <> ''
  union all
  select erp, nullif(spec_name,''), null, nullif(market_code,''), 2, 'label_stock'
    from label_stock where erp is not null and erp <> ''
  union all
  select erp, nullif(spec,''), nullif(merek,''), null, 3, 'dsg_katalog'
    from dsg_katalog where erp is not null and erp <> ''
), agg as (
  select erp,
         (array_remove(array_agg(spec   order by prio), null))[1] as spec,
         (array_remove(array_agg(brand  order by prio), null))[1] as brand,
         (array_remove(array_agg(market order by prio), null))[1] as market,
         string_agg(distinct dari, '+') as dari
  from sumber group by erp
)
insert into items (erp, spec, brand, market, terakhir_dari)
select erp, spec, brand, market, 'backfill ' || dari || ' (6 Nov 2026)' from agg
on conflict (erp) do update set
  spec   = coalesce(items.spec,   excluded.spec),
  brand  = coalesce(items.brand,  excluded.brand),
  market = coalesce(items.market, excluded.market),
  updated_at = now();

-- LANGKAH 3 — pattern dan load index DITURUNKAN dari spec, bukan ditebak.
--
-- Kode pola selalu ada di dalam kurung siku TERAKHIR: ...[AZ850] TRAZANO TL.
-- Indeks beban selalu berbentuk 149/146L di dalam kurung biasa. Dua bentuk itu
-- kaku, jadi boleh diturunkan.
--
-- UKURAN (size) SENGAJA TIDAK DITURUNKAN DARI NAMA. parseItemName() memang
-- mengembalikan potongan dimensi, tapi untuk nama seperti
-- 'ID295/80R22.5-18PR(150/147M)[ECOPLUS]XBRI无内' keluarannya 'ID295/80R22.5-18'
-- — bukan dimensi, dan akan tercetak apa adanya di label kalau dipakai. Kolom
-- kosong lebih jujur: yang kosong kelihatan dan bisa dilengkapi, yang salah
-- bentuk lolos sampai ke mesin cetak. Alasan yang sama sudah ditulis di v23.1.
with tebak as (
  select erp,
         nullif(substring(spec from '\[([^\]]+)\][^\[]*$'), '') as pola,
         nullif((regexp_match(spec, '\(([0-9]{2,3}/[0-9]{2,3}[A-Z])\)'))[1], '') as beban
  from items where spec is not null
)
update items i set
  pattern    = coalesce(i.pattern, t.pola),
  load_speed = coalesce(i.load_speed, t.beban),
  updated_at = now()
from tebak t
where t.erp = i.erp
  and (t.pola is not null or t.beban is not null)
  and (i.pattern is null or i.load_speed is null);

-- Hasil akhir 6 Nov 2026:
--   items 1.541 baris | spec 1.519 | brand 1.484 | market 1.243
--                     | pattern 1.462 | load_speed 948
--                     | ean 191 | sni 150 | npb 185 | size 186
