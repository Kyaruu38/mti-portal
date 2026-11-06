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


-- =============================================================================
-- KOREKSI 6 Nov 2026 — LANGKAH 1 DI ATAS SEMPAT SALAH, DAN BEGINI CARANYA SALAH.
--
-- Payload dikirim dengan urutan medan:
--   1 erp ~ 2 ean ~ 3 sni ~ 4 npb ~ 5 ply ~ 6 load ~ 7 tt_tl ~ 8 ms ~ 9 pattern ~ 10 size
-- tapi alias di SQL-nya ditulis:
--   ... 4 ply, 5 load_speed, 6 tt_tl, 7 ms, 8 pattern, 9 ukuran, 10 npb
-- Mulai posisi 4 semuanya MUNDUR SATU. Akibatnya nomor NPB mendarat di kolom
-- ply, nomor ply di load_speed, indeks beban di tt_tl, dan UKURAN BAN mendarat
-- di kolom npb1.
--
-- `ean` dan `sni_no` ada di posisi 2 dan 3, jadi dua kolom itu SELALU benar —
-- sebelum maupun sesudah koreksi.
--
-- KENAPA BARU KETAHUAN: tidak ada yang memeriksanya. Angka hasil backfill
-- dilaporkan apa adanya ("size=186, pattern=1462") tanpa satu baris pun diadu
-- ke berkas sumbernya. Yang menemukannya adalah pekerjaan BERIKUTNYA — waktu
-- data ini dipanggil untuk membuat label, barisnya terbaca
-- 'size=CR926, ply=1-132-003-25001077-5'. Kalau tidak ada pekerjaan itu, yang
-- menemukannya adalah mesin cetak.
--
-- PELAJARANNYA, DAN INI YANG LEBIH PENTING DARI BUG-NYA:
-- backfill yang hanya dilaporkan sebagai JUMLAH BARIS tidak terbukti benar.
-- Satu baris harus dibaca ulang dan diadu ke sumbernya sebelum angka apa pun
-- dilaporkan. 1.541 baris yang semuanya salah kolom menghasilkan laporan yang
-- terbaca persis seperti 1.541 baris yang benar.
--
-- PERBAIKANNYA, dan kenapa perbaikan pertama ikut merusak:
-- Rotasi balik dijalankan dengan `where ply is not null`. Predikat itu kelewat
-- lebar: kolom ply juga diisi oleh panen v23.1, jadi 19 baris hasil panen yang
-- SUDAH BENAR ikut terputar. Dua percobaan berikutnya menggesernya lagi karena
-- keadaan awalnya sudah tidak bisa direkonstruksi.
--
-- Satu penyebab diam yang perlu diingat: SQL Editor Supabase MENAMPILKAN
-- DIALOG KONFIRMASI untuk UPDATE. Menekan "Run" hanya MEMBUKA dialognya —
-- statement-nya tidak jalan sampai "Run query" di dialog itu ditekan. Satu
-- rotasi dianggap sudah jalan padahal belum, dan itu yang membuat tebakan
-- berikutnya dibangun di atas keadaan yang salah.
--
-- KEADAAN AKHIR (diverifikasi, bukan diasumsikan):
--   189 baris master EAN  -> benar, diadu per baris ke xlsx sumbernya
--    19 baris hasil panen -> pattern & indeks beban DITURUNKAN ULANG dari spec
--                            (19/19 pola cocok isi kurung siku spec;
--                             11 dapat indeks beban, 8 dikosongkan jujur),
--                            size/ply/tt_tl/ms/npb dikosongkan
--     5 baris sisa        -> indeks beban dipindah dari ply ke load_speed
--  1.337 baris lain       -> tidak pernah tersentuh (ply-nya NULL)
--
-- Pemeriksaan penutup di seluruh 1.543 baris: ply tidak wajar 0, npb tidak
-- wajar 0, size tidak wajar 0, indeks beban tidak wajar 0, dan hanya 1 baris
-- yang polanya tidak sama persis dengan spec — itu beda huruf besar-kecil
-- ([AD733pro] lawan AD733PRO), bukan kerusakan.
-- =============================================================================
