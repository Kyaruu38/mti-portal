-- =====================================================================
-- designs_asal_artwork.sql                         9 Nov 2026
--
-- ARTWORK BUATAN MESIN HARUS TERLIHAT BUATAN MESIN.
--
-- Permintaan Kyaru: "ntr kalo yg lu bikin artworknya kasih status automatic
-- artwork ya bukan artwork asli".
--
-- TIDAK DITUMPANGKAN KE designs.status, DAN ITU DISENGAJA.
--
-- status memegang DAUR HIDUP. Diperiksa: seluruh 634 baris berstatus
-- 'draft', dan bawaan kolomnya 'active'. Kalau asal-usul ikut menumpang di
-- situ, artwork hasil generate yang suatu hari naik jadi 'active' akan
-- KEHILANGAN penandanya -- dan artwork otomatis yang tidak lagi terlihat
-- otomatis persis keadaan yang diminta untuk dicegah. Jadi medannya sendiri,
-- yang tidak bisa terhapus oleh perubahan daur hidup.
--
-- 634 baris yang ada SEMUANYA buatan manusia, jadi bawaan 'asli' sudah benar
-- dan tidak ada satu baris pun yang berubah artinya.
-- ---------------------------------------------------------------------
alter table public.designs
  add column if not exists asal_artwork text not null default 'asli',
  add column if not exists dibuat_dari  text,
  add column if not exists dibuat_pada  timestamptz;

alter table public.designs drop constraint if exists designs_asal_artwork_cek;
alter table public.designs add constraint designs_asal_artwork_cek
  check (asal_artwork in ('asli','otomatis'));

comment on column public.designs.asal_artwork is
  'asli = dibuat manusia. otomatis = digenerate sistem dan BELUM tentu boleh dicetak. TIDAK boleh ikut berubah saat status daur hidup berubah.';
comment on column public.designs.dibuat_dari is
  'untuk asal_artwork=otomatis: templat atau artwork sumber yang dipakai, mis. pt-tbr.json atau ERP artwork yang disulih.';

-- Penjaganya diuji, bukan sekadar dipasang: penyisipan dengan nilai 'entah'
-- ditolak, dan barisnya terbukti tidak mendarat.
--
-- Keadaan sesudah dijalankan: asli 634, otomatis 0.

-- ---------------------------------------------------------------------
-- PENANDANYA ADA DI EMPAT TEMPAT, BUKAN SATU.
--
-- Berkas PDF-nya bisa lepas dari basis data -- diunduh, dikirim lewat chat,
-- disimpan ulang -- dan begitu lepas, kolom ini tidak ikut. Yang tertinggal
-- cuma berkasnya, dan di titik itu tidak ada yang membedakannya dari artwork
-- asli kecuali apa yang tertulis DI DALAMNYA. Maka:
--
--   1. kolom ini                        (basis data)
--   2. tanda air ungu di kaki halaman   (ikut berkasnya)
--   3. metadata PDF: judul, subjek,     (ikut berkasnya)
--      kata kunci, pembuat
--   4. lencana ungu di kartu dan panel  (layar Label Library)
--
-- Yang (2) dan (3) ditulis tools/label/sulih.py dan dibuktikan dengan
-- membaca ulang berkas hasilnya sendiri.
--
-- WARNANYA UNGU, SENGAJA BUKAN MERAH. Merah di layar itu sudah berarti
-- 'ERP bentrok'. Dua sebab berbeda dengan warna sama membuat orang berhenti
-- membedakan keduanya.
--
-- Di penandaKartu(), 'otomatis' DIPERIKSA DULUAN sebelum ERP ganda dan
-- catatan: dari semua hal yang bisa salah pada sebuah kartu, cuma ini yang
-- membuatnya tidak boleh dicetak apa pun keadaan lainnya.
-- =====================================================================
