-- =====================================================================
-- pos_supplier_id_trigger.sql            dijalankan: 11 Nov 2026
--
-- PO BARU TIDAK PERNAH TERSAMBUNG KE PEMASOKNYA, DAN PEMASOKNYA TIDAK
-- MELIHATNYA SAMA SEKALI.
--
-- Ditemukan dari layar: akun PT WINS TUNGGAL PERDANA menampilkan 49 PO
-- dengan yang terbaru 26 Oktober, sementara layar purchasing memegang PO
-- untuk pemasok yang sama tertanggal 6 November. Dihitung di basis data:
--
--     2026-11   36 PO,  26 supplier_id NULL
--     2026-10   76 PO,   0 NULL
--     2026-09   54 PO,   0 NULL
--     2026-08   38 PO,   0 NULL
--
-- Nol di bulan-bulan lama bukan karena jalurnya benar, melainkan karena
-- pos_supplier_id.sql MENGISINYA SEKALI pada 5 Nov. Yang lahir sesudah
-- itu lahir kosong: toRow() di src/core/posApi.js menulis `supplier`
-- (nama, teks) tapi TIDAK PERNAH menulis `supplier_id`. Dan policy
-- pos_read_supplier mencocokkan lewat supplier_id, bukan nama — jadi
-- setiap PO baru tidak kelihatan oleh pemasoknya, tanpa satu pun pesan
-- kesalahan di mana pun.
--
-- DIPERBAIKI DI BASIS DATA, BUKAN DI LAYAR. Menambal toRow() cuma
-- menutup satu jalur; impor, perbaikan massal, dan layar berikutnya yang
-- menulis ke pos akan melakukan kesalahan yang sama lagi. Trigger ini
-- berlaku untuk SEMUA jalur, termasuk yang belum ditulis.
--
-- TIDAK PERNAH MENEBAK. Nama dicocokkan persis dulu; kalau nol yang
-- cocok, baru dicoba bentuk yang dibuang tanda bacanya. Kalau yang cocok
-- LEBIH DARI SATU, supplier_id dibiarkan NULL — arah yang aman, karena
-- NULL berarti pemasok tidak melihat PO itu, sedangkan tebakan yang
-- salah berarti pemasok melihat PO MILIK PESAINGNYA.
--
-- SATU BUG KETAHUAN WAKTU DIUJI, DAN KALAU TIDAK DIUJI AKIBATNYA FATAL.
-- Versi pertama fungsi ini memakai `min(s.id)` atas kolom uuid. Postgres
-- tidak punya min(uuid): fungsinya melempar 42883 pada SETIAP insert dan
-- update ke tabel pos — artinya tidak ada satu pun PO yang bisa dibuat
-- lagi. Ketahuan oleh uji insert di dalam transaksi yang di-rollback,
-- bukan oleh "Success. No rows returned" yang muncul waktu fungsinya
-- dipasang.
--
-- Diperiksa sesudah diterapkan: 2026-11 36 PO, 0 NULL. Seluruh bulan 0.
-- Uji insert (di-rollback): supplier_id terisi dan ID-nya benar.
--
-- Yang SENGAJA tetap NULL: 5 PO atas nama SAMATOR INDO GAS. Nama itu
-- tidak ada di public.suppliers sama sekali — bukan pemasok label, tidak
-- punya akun, jadi tidak ada siapa pun yang seharusnya melihatnya.
-- =====================================================================

create or replace function public.pos_isi_supplier_id() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_n int; v_nama text;
begin
  -- Nama tidak berubah dan ID-nya sudah ada: jangan disentuh. Kalau
  -- dihitung ulang tiap update, ID yang pernah disetel tangan untuk
  -- membereskan nama kembar akan terhapus diam-diam.
  if tg_op = 'UPDATE'
     and new.supplier_id is not null
     and new.supplier is not distinct from old.supplier then
    return new;
  end if;
  if new.supplier is null or btrim(new.supplier) = '' then
    return new;
  end if;

  v_nama := upper(btrim(new.supplier));
  select count(*) into v_n from public.suppliers s where upper(btrim(s.name)) = v_nama;
  if v_n = 1 then
    select s.id into v_id from public.suppliers s where upper(btrim(s.name)) = v_nama limit 1;
    new.supplier_id := v_id;
    return new;
  end if;

  -- Cadangan hanya kalau cocok-persis NOL. Kalau cocok-persis lebih dari
  -- satu, pencocokan longgar tidak akan membuat jawabannya lebih pasti.
  if v_n = 0 then
    v_nama := upper(regexp_replace(new.supplier,'[^A-Za-z0-9]','','g'));
    select count(*) into v_n from public.suppliers s
      where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = v_nama;
    if v_n = 1 then
      select s.id into v_id from public.suppliers s
        where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = v_nama limit 1;
      new.supplier_id := v_id;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists pos_isi_supplier_id_trg on public.pos;
create trigger pos_isi_supplier_id_trg
  before insert or update of supplier, supplier_id on public.pos
  for each row execute function public.pos_isi_supplier_id();

-- Susulan untuk yang sudah terlanjur lahir kosong.
with k as (
  select p.id as po_id,
    (select s.id from public.suppliers s where upper(btrim(s.name)) = upper(btrim(p.supplier)) limit 1) as persis,
    (select count(*) from public.suppliers s where upper(btrim(s.name)) = upper(btrim(p.supplier))) as n_persis,
    (select s.id from public.suppliers s where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = upper(regexp_replace(p.supplier,'[^A-Za-z0-9]','','g')) limit 1) as norm,
    (select count(*) from public.suppliers s where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = upper(regexp_replace(p.supplier,'[^A-Za-z0-9]','','g'))) as n_norm
  from public.pos p where p.supplier_id is null
)
update public.pos p
   set supplier_id = case when k.n_persis = 1 then k.persis
                          when k.n_persis = 0 and k.n_norm = 1 then k.norm end
  from k
 where k.po_id = p.id
   and (k.n_persis = 1 or (k.n_persis = 0 and k.n_norm = 1));

-- Pemeriksa:
-- select to_char(created_at,'YYYY-MM') bulan, count(*) total,
--        count(*) filter (where supplier_id is null) sid_null
--   from public.pos where source='label' and deleted_at is null
--  group by 1 order by 1 desc;
