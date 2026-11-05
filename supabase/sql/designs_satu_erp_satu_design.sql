-- =====================================================================
-- designs_satu_erp_satu_design.sql      dijalankan: 5 Nov 2026
--
-- Aturan dari pemilik: SATU ERP = SATU DESIGN. Pembagian pasar sudah
-- diurus oleh kode market di dalam spec-nya sendiri, jadi satu ERP yang
-- punya dua kartu adalah duplikat, bukan varian.
--
-- Sebelum ini 62 ERP punya lebih dari satu kartu (132 kartu terlibat).
-- Bentuknya hampir seragam: kode market yang ditulis beberapa cara untuk
-- design yang SAMA — 'BX', 'BX-PCR', 'PCR-BX' — ditambah salinan
-- berakhiran '(1)' dan beda spasi. Aturan yang sama persis yang dipakai
-- untuk penggabungan 77 kartu pada 4 Nov.
--
-- 61 ERP digabung. Penggabungannya TIDAK MEMBUANG apa pun: setiap kartu
-- yang dihapus ditulis lebih dulu ke `riwayat` kartu yang dipertahankan,
-- lengkap dengan drive_url, thumb, spec dan market aslinya — jadi tautan
-- artwork lama tetap bisa ditelusuri. Kartu yang dipertahankan dipilih
-- dari kelengkapan datanya, bukan dari urutan: punya drive_url, lalu
-- punya thumb, lalu punya market, lalu updated terbaru.
--
-- SATU TIDAK DIGABUNG, DAN SENGAJA. ERP 01050458085ID dipakai oleh dua
-- PRODUK YANG BERBEDA:
--     ARISUN  12.00R20-18PR (154/151F) [CB919]
--     TRAZANO 11R22.5-18PR  (149/146L) [AZ850]
-- Itu bukan beda ejaan, itu dua ban yang berlainan berbagi satu kode
-- ERP. Menggabungkannya berarti memilih salah satu artwork untuk
-- dikirim ke pemasok, dan yang salah baru ketahuan setelah labelnya
-- tercetak ribuan lembar. Kartunya ditandai BENTROK supaya merah di
-- Design Library, dan menunggu keputusan orang.
--
-- Hasil: 690 kartu -> 622. Tersisa 1 ERP ganda (yang di atas).
-- =====================================================================

do $$
declare r record; v_simpan uuid; v_erp text;
begin
  for v_erp in
    select erp from public.designs
     where coalesce(erp,'') <> '' and erp <> '01050458085ID'
     group by erp having count(*) > 1
  loop
    select id into v_simpan from public.designs
     where erp = v_erp
     order by (coalesce(drive_url,'') <> '') desc,
              (coalesce(thumb,'')     <> '') desc,
              (coalesce(market,'')    <> '') desc,
              updated desc nulls last,
              length(coalesce(spec,'')) desc,
              created_at asc
     limit 1;

    for r in select * from public.designs where erp = v_erp and id <> v_simpan loop
      update public.designs
         set riwayat = coalesce(riwayat,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
               'ver', coalesce(r.ver,'salinan'), 'oleh','gabung-1erp-1design',
               'tanggal', to_char(now(),'YYYY-MM-DD'),
               'driveUrl', r.drive_url, 'thumb', r.thumb,
               'spec', r.spec, 'market', r.market,
               'catatan','Digabung: 1 ERP = 1 design. Kartu ini ejaan/kode market berbeda untuk design yang sama.'))
       where id = v_simpan;
      delete from public.designs where id = r.id;
    end loop;
  end loop;

  update public.designs
     set catatan = 'BENTROK: ERP 01050458085ID dipakai dua produk BERBEDA '
                || '(ARISUN 12.00R20 dan TRAZANO 11R22.5) — perlu keputusan, bukan penggabungan'
   where erp = '01050458085ID';
end $$;

-- Pemeriksa: harus menyisakan tepat satu baris, yaitu 01050458085ID.
-- select erp, count(*) from public.designs
--  where coalesce(erp,'') <> '' group by erp having count(*) > 1;
