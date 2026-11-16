-- jalankan_backup
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 539141a2f685

CREATE OR REPLACE FUNCTION public.jalankan_backup()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
declare
  cfg public.backup_config%rowtype;
  req_id bigint;
begin
  select * into cfg from public.backup_config where id = 1;
  if not found then
    raise exception 'backup_config belum diisi — jalankan BAGIAN 2 dulu';
  end if;
  if cfg.fungsi_url like '%GANTI%' or cfg.secret like '%GANTI%' then
    -- Gagal keras, bukan diam-diam. Jadwal yang memanggil URL berisi kata
    -- "GANTI" akan gagal setiap minggu tanpa ada yang melihatnya, dan orang
    -- baru sadar saat backupnya dibutuhkan.
    raise exception 'backup_config masih berisi nilai contoh. Isi URL dan secret yang sebenarnya.';
  end if;

  select net.http_post(
    url     := cfg.fungsi_url,
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'X-Backup-Secret',  cfg.secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000     -- ekspor 23 tabel butuh waktu
  ) into req_id;

  return req_id;
end
$function$
