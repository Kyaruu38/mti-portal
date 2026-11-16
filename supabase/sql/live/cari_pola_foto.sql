-- cari_pola_foto
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 3a66ae09179e

CREATE OR REPLACE FUNCTION public.cari_pola_foto(p_cari text)
 RETURNS TABLE(kode text, drive_id text, url_lihat text, url_gambar text, pas boolean)
 LANGUAGE sql
 STABLE
AS $function$
  with k as (
    select upper(btrim(coalesce(p_cari,''))) as mentah,
           public.padat_pola(p_cari)         as plus,
           upper(regexp_replace(coalesce(p_cari,''),'[^A-Za-z0-9]','','g')) as polos
  )
  select p.kode, p.drive_id, p.url_lihat, p.url_gambar,
         (upper(p.kode) = k.mentah or p.kode_plus = k.plus) as pas
    from public.pola_foto p, k
   where k.polos <> ''
     and ( upper(p.kode) = k.mentah
        or p.kode_plus   = k.plus
        or p.kode_plus like k.plus || '%'
        or k.plus   like p.kode_plus || '%'
        or p.kode_padat = k.polos )
   order by (upper(p.kode) = k.mentah) desc,
            (p.kode_plus = k.plus)     desc,
            length(p.kode_plus),
            p.kode
   limit 20;
$function$
