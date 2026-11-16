-- pemasok_punya_akun
-- DIBUAT 2026-11-16. Baru, bukan tangkapan dari fungsi lama.
-- md5(prosrc-setara) 92f446254dce
--
-- KENAPA ADA
-- "intinya gw gamau ada kita bikin PO terus suplier ga nerima ya" (Kyaru).
-- Policy pos_read_supplier mencocokkan PO ke pemasok lewat supplier_id
-- MILIK AKUN. Pemasok yang tidak punya akun berarti tidak ada yang
-- mencocokkan, dan PO-nya diam di portal dengan status Approved yang dari
-- sisi dalam terlihat sudah beres.
--
-- Diukur waktu ini dibuat, atas 266 PO hidup:
--     0  belum di-approve            (sehat)
--     7  tanpa supplier_id           semuanya converter
--    41  pemasok tanpa akun          converter, 13 pemasok
--     4  PO LABEL tanpa akun pemasok  <- PT GAOHE STIKER INDONESIA, 11 Nov
-- Keempat PO GAOHE itu sudah Approved dan tidak bisa dilihat siapa pun di
-- sisi pemasok. Yang converter DIBIARKAN dengan sengaja: pemasok bahan
-- baku, kemasan dan gas memang tidak memakai portal (keputusan Kyaru),
-- dan memperingatkan mereka akan membuat peringatannya menyala terus
-- sampai tidak ada yang membacanya lagi.
--
-- KENAPA FUNGSI, BUKAN VIEW
-- profiles punya satu policy SELECT: (id = auth.uid() OR is_admin()).
-- kevin yang meng-approve tidak bisa membaca baris orang lain, jadi view
-- biasa akan mengembalikan kosong dan peringatannya menyala di SEMUA
-- baris. SECURITY DEFINER, dan yang dikembalikan DAFTAR UUID saja -- tidak
-- ada nama, peran, atau apa pun tentang orangnya.
--
-- Dipakai: src/core/pemasokAkunApi.js -> st.pemasokBerakun ->
-- src/screens/approval.js. Gagal ambil = null = TIDAK memperingatkan apa
-- pun; peringatan palsu lebih buruk daripada tidak ada peringatan.

CREATE OR REPLACE FUNCTION public.pemasok_punya_akun()
 RETURNS setof uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct p.supplier_id
    from public.profiles p
   where p.supplier_id is not null
     and coalesce(p.role,'') = 'supplier'
$function$;

revoke all on function public.pemasok_punya_akun() from public, anon;
grant execute on function public.pemasok_punya_akun() to authenticated;
