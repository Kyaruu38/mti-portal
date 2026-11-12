-- FOTO POLA BAN -> tabel pola_foto
-- Folder Drive: "FOTO POLA BAN" (1TVp0_jyfuir7NvJILF8w_tsxfixtVLjV)
-- 137 baris. Dibuat otomatis dari hasil unggah; JANGAN disunting tangan.
--
-- KENAPA TABEL SENDIRI, BUKAN KOLOM DI designs
-- Foto tapak itu milik POLA, bukan milik satu artwork. Satu pola (CR926)
-- dipakai puluhan baris design yang berbeda merek, ukuran dan pasar. Kolom di
-- designs berarti menyalin satu gambar yang sama ke puluhan baris, dan satu
-- foto yang lebih bagus berarti menyunting puluhan baris itu.
--
-- TABEL INI TIDAK MENYIMPAN MEREK, dan itu bukan kolom yang kelupaan.
-- Satu cetakan tapak yang sama dijual sebagai WESTLAKE, GOODRIDE, TRAZANO,
-- CHAOYANG dan YARTU sekaligus -- itu memang praktik pabriknya. Jadi
-- (kode pola) -> (foto) satu-ke-satu, sedangkan (kode pola) -> (merek)
-- satu-ke-banyak dan tidak boleh disimpulkan dari sini.
--
-- url_gambar memakai lh3.googleusercontent.com/d/<id>, yang HANYA tersaji
-- kalau foldernya "anyone with the link": permintaan <img> dari browser tidak
-- membawa identitas siapa pun, jadi berbagi ke akun per orang tidak cukup.
-- Pelajaran yang sama yang sudah kena ke kartu design. url_lihat tetap jalan
-- untuk yang punya akses.

create table if not exists public.pola_foto (
  kode        text primary key,
  kode_padat  text generated always as
                (upper(regexp_replace(kode, '[^A-Za-z0-9]', '', 'g'))) stored,
  drive_id    text not null,
  url_lihat   text generated always as
                ('https://drive.google.com/file/d/' || drive_id || '/view') stored,
  url_gambar  text generated always as
                ('https://lh3.googleusercontent.com/d/' || drive_id) stored,
  dibuat_pada timestamptz not null default now()
);

create index if not exists pola_foto_padat_idx on public.pola_foto (kode_padat);

alter table public.pola_foto enable row level security;

-- Dibaca siapa pun yang login. Foto tapak ban bukan data yang perlu dijaga:
-- barangnya dijual di pasar dan gambarnya ada di katalog pabrik. Yang dijaga
-- di portal ini angka dan harga.
drop policy if exists pola_foto_baca on public.pola_foto;
create policy pola_foto_baca on public.pola_foto
  for select using (auth.uid() is not null);

drop policy if exists pola_foto_tulis on public.pola_foto;
create policy pola_foto_tulis on public.pola_foto
  for all using (public.is_internal()) with check (public.is_internal());

insert into public.pola_foto (kode, drive_id) values
  ('AD153', '1u91zkBV-zT6UmJMVHHbGNT4YgFRzm8Pq'),
  ('AD528', '1msaFnRIgrdsPto6PV0h2078itfld9f73'),
  ('AD710A', '1ADwI9AsdWBPg_QDpCIvwTGzvTMNndC5l'),
  ('AD716', '148xtIqFCSUjF9wwDvAAa3PQ0jDSDlm1M'),
  ('AD717', '1D4Bv9MnhusWv2sy_9nmMG9XQL72tl0mr'),
  ('AD721', '1neYFUrHokMKK9daWKHfM7stnqf6Hvz04'),
  ('AD733', '1fw-5tqlzN3ufDPAY883grsqGa-7BA__k'),
  ('AD755', '1uvMht8FuehhwPB6Ek8a--YdTxHsZLixz'),
  ('AD759', '1LZAaVAfTOl1kxFN2WZQpfS4IWqAjTcVv'),
  ('AD781', '1zp5oOWS3TjA3MGiSnGlvLEXGHcsr_iXu'),
  ('AD818', '1C7lF9UB-RD0l6-TGZEoUwKzwp7Ss9q1I'),
  ('AS567', '17dNMxVOi9Q8oltkc-tI651IBxDIdaYkO'),
  ('AS578', '1MlKcqqzHlK9IEdXi-kLbM44DBRgqrYFH'),
  ('AS589', '1CRQXzq5gB4aXO4uF7MoRbqlYL0BQdYXA'),
  ('AS600', '1eqw8A7thMrJz9pdZdqw_zh-uNyI39cWj'),
  ('AS600+', '1qal2aZ8mT0toGmgqGkZ2soCqfOJK1Agm'),
  ('AS668', '1XeL6kl3RtPVKer24gfgRO54THIew7-1Y'),
  ('AS673', '1cAWxth0drvpqEK5HldP0boq4_ESt0hz6'),
  ('AS678', '1C7rFxVP60ClNGVmN2xSqv_o01TXqAThZ'),
  ('AS858', '1OpGZ75YP5skKDBhGq-Uf-6w7p9aGPInM'),
  ('AS868', '1w8Ft7yRhE7BOg1nLU__vMwWLb6sCoUMA'),
  ('AS898', '1iQoKY88of_29hWeIDZwWC7UrhLRPxple'),
  ('AT161', '1kF5E53uu583R6HOWTktAUlG7n611eveq'),
  ('AT167', '1I0UxXh-gu2w2LNwBz1nOcfeWOptD9PMz'),
  ('AT186', '1YL6fRC4ix-1GfJs-ermtYLNoawInVlWB'),
  ('AT196', '18u4gNCkcZGNEeiJIfUXRBx9YzYHm8pfS'),
  ('AT532', '17Adjj7FUQ4WHjC1JOHzB6AVASmcBgMmx'),
  ('AT552', '1Gswf8gYlW9g_biiqOI_aZ3Ue8F5-yve5'),
  ('AT557', '1nvjPe8pu7nlJggEc8dNNrOc0phGXAbcj'),
  ('AT563', '1VCQoxtPohO2DM-n2vUHHeUsFzee8SWo4'),
  ('AT566', '1qlvm4j281Y72FVlLYaKm8CJDO1Eolk0D'),
  ('AT570', '1swaiGD0ARpQPJIhuNqCtM_UU-MU1-ggG'),
  ('AT598', '1ffEtSKAWEWX01CagclYWtx1yFKxV3XUm'),
  ('AZ126T', '1mDGV-2LzD-GAOXXLSUwk-TqPnXI2ujpM'),
  ('AZ179', '1b1kvOeJ3QeHlRVl3iAK70e9DZB1F3dCx'),
  ('AZ183', '1ARuMIwRMSzkCcgiyz1cxh1R4A7iHjsKe'),
  ('AZ272', '1ymabbdK8PL-5KhzdAUce8D3PCO0Vfy7t'),
  ('AZ579', '1SQdkCr4poEddjWa5phYkpLS-gP--m51-'),
  ('AZ599', '11gfCft9KQQcxtSqX1WHGGwgn37IwzFh3'),
  ('AZ601', '1IqJKSAoI6Ks1XbTzxTu20w2JEywHVavr'),
  ('AZ676', '1q5-KsLojla55_FGrRJ96TQBwEuAizmi-'),
  ('AZ686', '1wYADwVF0u__t-nXAtfERpZLMa1Z8PwyM'),
  ('AZ691S', '1jh2pSW9dqn5Zb_wIX-LDwFPftWr_trxK'),
  ('AZ692', '1pfRDJJgxgxIwsOjyxR86FCGwOfoCHruo'),
  ('AZ697', '1V-vV651mweh9VGpc22eY0GHYgtiCGTzn'),
  ('AZ802S', '1mLy2wnd9KRNPCRqs74UZ29SiR5oghFA7'),
  ('AZ828', '1FizzhKCqL8o6dOPfU0Ikbw4ytAjTwPpB'),
  ('AZ850', '1WCYWr80TtXroVjjgWZPi1lz7shraCyZe'),
  ('CB332', '1ZKXJF4gCytwiwjB_sKPkwpCZNz_4a2rr'),
  ('CB905', '13TzfDsIO8Rj-pC5n6l_LdxqgTCaQz7du'),
  ('CB919', '154q09yCCRdALzfZMNSSlmkEqldLwIPaj'),
  ('CB972', '147c0fAAFCPyIpxQ5OdM8oEYEMB-CAwoU'),
  ('CB972E', '1nKJ1U7ppByjf0HvjzvcYGvfLDGHrupXE'),
  ('CB981', '1A-FFR-OEhTc_hoXg-lB3MpZZI8nhEGu1'),
  ('CL621', '1OrH72oJ592zn86d8MLxL5QuNtR86riZ-'),
  ('CL891', '1amvyirWsk9hOQexOpN04doh1tQOTt6AO'),
  ('CL956', '1FqoKVoeC0FHO2aTyyqdPh77ClSbK5OXV'),
  ('CL969', '1h096w70dVl6NJYZuHqg01hfq_FXUGrbA'),
  ('CM335', '1JUjn5LJAMlfsB_t-pnb24dqCLpYyBzRt'),
  ('CM912A', '1xsqG4G6msaTT0X4U6c7U9o4IwqLePdcm'),
  ('CM913', '1XBcQhTj47FZsxOsooTgCGe-FduiAGGsk'),
  ('CM913A', '1rhSXxEAfdZIs8vHtfu4GopGblGzCFdn7'),
  ('CM958', '1XGxS8vS3-zINFR4Ms4VrFrZtPgouvii4'),
  ('CM980', '19qbbF1aNvoyv_7kO_WrsBLizmfSbP30t'),
  ('CM983', '1DBfDvoajPsbQ8SwWhNOY9li1IkckwdKk'),
  ('CM986', '1f8bQZwDUr1V7bX6YUFzx3VWG6ox_WLA7'),
  ('CM988', '1HbIojEYkmNyaYGkfUtR-DlR0zTBZ4h_Y'),
  ('CM997', '1BuODzDTh_3Wy6FJTFCpaVx1vgqv9p-g_'),
  ('CM998', '1nwevTI4rBa8a18TLrbuvaYFGQeBUC7OL'),
  ('CR906', '19rEQff1BI7JVF-CilGuqofoSxkEEVibY'),
  ('CR915', '1Vto0xu6zNiPKcr9Oyk7bB6QANzLOMJHY'),
  ('CR918', '1bffsRTkosFrmHL_7E2hPrG2jINtZ0VOn'),
  ('CR926', '1c2nnb7-_Hb30omEmrWNvkkaz-Mab17qH'),
  ('CR926+', '1yfbSEq0-JOIyCh1fo-VUViv_WpKB1quH'),
  ('CR926B', '1cGOovnmYEhMXl5YQbvPvbgnoboOylAvq'),
  ('CR926D', '1E7kdQ_0G9O4JK4xjLDx2eSRQIgRFIWvH'),
  ('CR952', '12mSd4Gu_DHPJeHqHE9WcnL9iK2u3_Tvu'),
  ('CR960A', '1wDcaydKqTTDlRYUbe9zQA2GcqGawHvT5'),
  ('CR976A', '1aOd_9XCoucNDI_ILV3Db3NUAv-gaPBWI'),
  ('DA23', '1CmDXap59m5nvBbVRuNVm_fUbn5vW_K13'),
  ('DA24', '15pHC3eDlRU3bQXErrWyWH2lc9UsAz-XU'),
  ('DA25', '1JZpqEFeZ3IWVnX5t-qXi0rNxCWCotHRz'),
  ('DL21', '19qE32toRAqRfwhr9aV1ziI-9i5j7l0O5'),
  ('DL22', '1iu4_FMr0T2BudSjot2Bul1lBFen8FPTF'),
  ('DL26', '15aVlKMt4acyusKZbumlOw9GQtbXiRXKx'),
  ('EL36', '1UCiSEC1D1aq3V3DW_p7zwRHocnzlDviG'),
  ('EZ175', '1qJ8o8LIz0EUT8DoUthVHmkXqDr0aekWA'),
  ('EZ177', '1NKN8uHVcZdv-LeF5VesOzDo4mO_jTd1b'),
  ('EZ309', '1IR01obMHENM2VISYrKHYE6kYymLMfT20'),
  ('EZ310', '1pG05BT8ogT6MVHtox0F42coKSDxRNQK6'),
  ('EZ330', '1hphLrJOQTnV1GzHo901IB79DDioHtZ3k'),
  ('EZ336', '1N_xh-XIvp2DoG_cLds-JI4L8HEH1D6_g'),
  ('EZ345', '1rVaCMQgLpREUAWhJaRml7NHG0jSP4nC2'),
  ('EZ369', '1xA8S7X8S14FJuvtYSsgpVOEaFoXgJCIL'),
  ('EZ377', '16ol3RoDWTaGYV9AbnvrAek2MtE9Jsbx0'),
  ('EZ509', '1zbcV1zaifZyzziNVN-9pbwKSzTd5Y47b'),
  ('EZ573', '1zc4_B0lK8MTjM9uvesp9kSycNV9vvc15'),
  ('EZ835', '1l1Yx3JfD6lCuFtYMyXq8WaoCjmSs-mJ4'),
  ('EZ865', '1oIXumucZQkZ06Ugsi-4V8p2w2UjIe6tg'),
  ('EZ867', '1OjXuXafVYhASpuk5DTd9yHvynB1Bezr1'),
  ('EZ870', '1oyzDiQJYWelNTjaBUCZ3wjNKf2dbe9Wq'),
  ('G-118', '1-KapDjsufLeSuLThoIyYiLqFJ3AMrMtq'),
  ('L8056', '1mTS7I3jADTZT0JSTN98z4ov3i6xgEGPI'),
  ('M8086', '1MIRLA2Eybkohy_-MSMpwbzFCDqS2n-WC'),
  ('M8087', '1KOZT6R7EtrO5Yk8tJd60Fz-kDQ44ipPH'),
  ('M9096', '1d_dfEsYWPfeiG85_vd0neOC_hWy77jjD'),
  ('M9097', '1eANy9kegSxMs3nz0XeBCcrtj5GxsReJP'),
  ('MD752', '1CY_n1Tb0s8kvbmzqOtLTcPCyqJKmiSz7'),
  ('MD758', '1URbxB3maS5ZkCQEQuN7ABHayCmvaspg4'),
  ('MD777', '1AtmuBmPFdcSVGUGU8FDjPOb3wE-hVvk3'),
  ('R8037', '1ZKI08xrqnqpLG439gHJW7ZF34ya0jeJi'),
  ('R8038', '1_wErz7jZIfXB2WNoawbwsCa93ttObWlk'),
  ('R9037', '1mmvUHGiVQLnrzkiTzzLehqKWTEGzF8s5'),
  ('R9038', '1zQP4hLloiuBXYSa4xxXvJ2EceUqyUhQU'),
  ('SL11', '1qbIi95jTXDZfV2EtBJe8VSiDTjlD2-U2'),
  ('ST-100', '1W4qBG4M0pcpTTUr2_Hs7ttIQOLVHAYKI'),
  ('ST-100A', '1tf2YNNrB-x1NjOreNTZ_AFJD27HTacqR'),
  ('ST100', '1OKiYtcsS_jOXG0FAX6FZtCcAfFrkJDPX'),
  ('ST200', '1lryEaF2ZUdDqgDHOXBLedIMvNqL-bumK'),
  ('ST226', '1sRP0j2DwGiTMwKm-YSsmP_1tPh_qGmR3'),
  ('ST600', '1rkLugTq7MqnxWydfzR0ucG5Z9kA_TP5z'),
  ('STZC', '165szNEj0tw2VGyiNRHkY-qdZnHiaQoSG'),
  ('SU320', '1M6Q0x26bPNa4VFjYAzgwMAn-UXCUT5U7'),
  ('T-118', '1uAxgbf5yhWBHQTI1A0xJO9nSC1x7gEiS'),
  ('TL31', '1dLIJigonAD8XdR54R4buv3eqLm9WtG4i'),
  ('TL32', '1vk7b4vIwUfNx3e7ioKoTPSSgGoO5HidT'),
  ('TRAILER ST290', '12HLdZDuRtfGg7u-7dzGdjyiXC_8tJW-X'),
  ('WDA2', '1HYE08l1AkeMg_AY2fqr28RAPoO8GDPLa'),
  ('WDR1', '10gCDDXlYUqYZ7tSCpVkc-SdtTbQGaDXe'),
  ('WSA2', '11D4OoE99kDLrirPPvi9ujUdDkSWq4iN4'),
  ('WSR1', '1GNjORqAHIcXB3jtW_aTC6ds4iLId6dkY'),
  ('XC819', '1w4xCopufZRRUv6JvatH5gR5ZrpYkylo1'),
  ('Z-108', '16ZpuOj-aNpj2zPLpNLp_DTj5bCbc7RCe'),
  ('ZA12', '1W42XWWsoG7USnaO8lG_Euo5O4zy1jvyV'),
  ('ZA15', '1h3G9ntjxj7zgvOeaEOnNhu9QmLgAGo-S'),
  ('ZM41', '1MV6ZjxtiwEfud4JwkvefrxtVIvd6yzNY'),
  ('ZM42', '1cAiTOPNYdokg6O1n0Jvmh2oz7BCFp3AP')
on conflict (kode) do update set drive_id = excluded.drive_id;

-- NORMALISASI KHUSUS KODE POLA: '+' DIPERTAHANKAN.
--
-- Di nama merek, '+' dan '-' cuma hiasan ejaan. Di kode pola dia PEMBEDA, dan
-- buktinya ada di folder fotonya sendiri -- tiga pasang kode yang berbeda
-- hanya pada satu tanda baca, masing-masing dua gambar yang betul-betul beda:
--     CR926  / CR926+
--     AS600  / AS600+
--     ST-100 / ST100
-- Normalisasi yang membuang keduanya menjadikan ketiganya satu kunci, lalu
-- salah satunya memakai foto milik tetangganya tanpa ada yang tahu. Itu bukan
-- hasil pencarian yang kurang bagus, itu artwork yang salah gambar.
--
-- Cermin dari padatPola() di src/core/polaFoto.js. Kalau salah satunya diubah,
-- yang satunya harus ikut, dan test-pola-foto.mjs yang menjaganya.
create or replace function public.padat_pola(s text)
returns text language sql immutable as $fn$
  select upper(regexp_replace(coalesce(s,''), '[^A-Za-z0-9+]', '', 'g'));
$fn$;

alter table public.pola_foto add column if not exists kode_plus text;
update public.pola_foto set kode_plus = public.padat_pola(kode)
 where kode_plus is distinct from public.padat_pola(kode);
create index if not exists pola_foto_plus_idx on public.pola_foto (kode_plus);

-- Tipe kembaliannya berubah dari versi pertama, dan create-or-replace tidak
-- bisa mengubah tipe kembalian (42P13). Jadi dijatuhkan lebih dulu.
drop function if exists public.cari_pola_foto(text);

create or replace function public.cari_pola_foto(p_cari text)
returns table (kode text, drive_id text, url_lihat text, url_gambar text, pas boolean)
language sql stable security invoker as $fn$
  with k as (
    select upper(btrim(coalesce(p_cari,''))) as mentah,
           public.padat_pola(p_cari)         as plus,
           upper(regexp_replace(coalesce(p_cari,''),'[^A-Za-z0-9]','','g')) as polos
  )
  select p.kode, p.drive_id, p.url_lihat, p.url_gambar,
         (upper(p.kode) = k.mentah or p.kode_plus = k.plus) as pas
    from public.pola_foto p, k
   where k.polos <> ''
     and ( upper(p.kode) = k.mentah          -- sama persis apa adanya
        or p.kode_plus   = k.plus            -- sama setelah '-' dibuang
        or p.kode_plus like k.plus || '%'     -- "CR926" -> CR926+, CR926B, ...
        or k.plus   like p.kode_plus || '%'   -- "AS858Pro" -> foto AS858
        or p.kode_padat = k.polos )           -- jaring terakhir
   order by (upper(p.kode) = k.mentah) desc,
            (p.kode_plus = k.plus)     desc,
            length(p.kode_plus),
            p.kode
   limit 20;
$fn$;

grant execute on function public.cari_pola_foto(text) to authenticated;
grant execute on function public.padat_pola(text) to authenticated;

-- Periksa
select (select count(*) from public.pola_foto)                                as jumlah,
       (select jsonb_agg(kode) from public.cari_pola_foto('CR926'))            as cr926,
       (select jsonb_agg(kode) from public.cari_pola_foto('ST100'))            as st100,
       (select jsonb_agg(kode) from public.cari_pola_foto('CM88'))             as cm88_harus_null,
       (select jsonb_agg(x) from (select kode_plus, array_agg(kode) kode
                                    from public.pola_foto group by 1
                                   having count(*) > 1) x)                     as perlu_dipastikan;
