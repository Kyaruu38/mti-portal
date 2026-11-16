-- =====================================================================
-- designs_erp_kembar_dibereskan.sql            dijalankan: 16 Nov 2026
--
-- SATU ITEM SATU KODE — jadi ERP kembar itu DATA SALAH, bukan ambiguitas.
--
-- Dua kode ERP dipegang lebih dari satu kartu design. Sebelumnya keduanya
-- sengaja dibiarkan (lihat surat_jalan_gambar_ke_url.sql) karena tidak
-- ada di dalam data yang bisa memutuskan mana yang benar. Pemiliknya
-- kemudian menegaskan aturannya -- "ERP code itu gamungkin kembar karena
-- 1 item 1 code" -- dan mengirim tangkapan layar master ERP-nya. Dengan
-- sumber kebenaran di luar basis data, keduanya jadi bisa diputuskan.
--
-- KASUS 1 — 01050458085ID, dua ban yang BENAR-BENAR BERBEDA.
--   87fa4b80  TRAZANO  ID11R22.5-18PR(149/146L)[AZ850]   dibuat 20 Agu
--   b22c7f1a  ARISUN   ID12.00R20-18PR(154/151F)[CB919]  dibuat 24 Sep
-- Master ERP: 01050458085ID = (ID-ARISUN-TBR-SNI)ID12.00R20-18PR
-- (154/151F)[CB919]ARISUN. Cocok PERSIS dengan kartu ARISUN.
-- Maka ARISUN yang memegang kode itu; kartu TRAZANO yang salah.
-- ERP-nya DILEPAS, kartunya TIDAK dihapus -- kode TRAZANO yang benar
-- masih dicari pemiliknya. Ini kasus yang sudah tercatat sejak v23.x
-- sebagai "dua PO berbeda menagih barang berbeda dengan ERP yang sama"
-- dan dibiarkan terbuka sejak itu.
--
-- KASUS 2 — 0105045809342ID, satu barang dengan DUA KARTU.
--   86ad23f0  GOODRIDE  IDST175/80D13-6PR[ST600]  dibuat 05 Nov 01:44
--   e0742489  GOODRIDE  IDST175/80D13-6PR[ST600]  dibuat 13 Nov 07:29
-- spec, merek, pasar, versi, status: identik. Yang berbeda cuma berkas
-- Drive-nya (1_WNVpTg... lawan 1CQr2P-...), jadi ini bukan dua barang
-- melainkan satu barang yang artworknya diunggah dua kali. Master ERP
-- juga hanya memegang SATU kartu untuk kode ini.
-- Yang 13 Nov dipertahankan karena itu unggahan terbaru; yang 5 Nov
-- dilepas ERP-nya. Tidak ada kartu yang dihapus.
--
-- TIDAK ADA YANG DIHAPUS, SEMUA BISA DIBALIK. Kedua kartu tetap hidup,
-- cuma kehilangan kode ERP-nya, dan kode lamanya disimpan di
-- designs_erp_dilepas beserta alasannya. Keduanya tidak dirujuk satu
-- baris surat jalan pun (diperiksa sebelum disentuh), jadi tidak ada
-- dokumen yang berubah artinya.
--
-- HASIL: ERP kembar di tabel designs = NOL.
-- =====================================================================

create table if not exists public.designs_erp_dilepas (
  design_id    uuid primary key,
  erp_lama     text not null,
  spec         text,
  alasan       text,
  dilepas_pada timestamptz not null default now()
);
revoke all on public.designs_erp_dilepas from anon, authenticated;
alter table public.designs_erp_dilepas enable row level security;

insert into public.designs_erp_dilepas (design_id, erp_lama, spec, alasan)
select d.id, d.erp, d.spec,
  'ERP 01050458085ID milik ARISUN 12.00R20-18PR(154/151F)[CB919] menurut master ERP. Kartu TRAZANO ini menunggu kode yang benar.'
from public.designs d where d.id = '87fa4b80-f884-4c12-942d-ff4f12dfe181'
on conflict (design_id) do nothing;

insert into public.designs_erp_dilepas (design_id, erp_lama, spec, alasan)
select d.id, d.erp, d.spec,
  'Kartu kembar: spec identik dengan e0742489 (13 Nov). Master ERP hanya punya SATU kartu untuk kode ini. Yang lebih baru dipertahankan.'
from public.designs d where d.id = '86ad23f0-1836-4e04-9aca-41ece8d27b51'
on conflict (design_id) do nothing;

update public.designs set erp = null,
  catatan = 'ERP dilepas 16 Nov 2026 — kode 01050458085ID milik ARISUN menurut master ERP. Kode TRAZANO yang benar belum ditemukan.'
 where id = '87fa4b80-f884-4c12-942d-ff4f12dfe181';

update public.designs set erp = null,
  catatan = 'ERP dilepas 16 Nov 2026 — kartu kembar, spec identik. Kode 0105045809342ID dipegang kartu 13 Nov.'
 where id = '86ad23f0-1836-4e04-9aca-41ece8d27b51';

-- PEMERIKSA:
-- select erp, count(*) from public.designs where coalesce(erp,'')<>''
--  group by erp having count(*) > 1;   -- harus NOL baris
--
-- MEMBALIKKAN:
-- update public.designs d set erp = x.erp_lama
--   from public.designs_erp_dilepas x where x.design_id = d.id;
