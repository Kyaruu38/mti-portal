-- =============================================================================
-- backup_snapshot() DIRAMPINGKAN — backup mingguan berhenti kehabisan memori.
--
-- GEJALANYA: Edge Function db-backup mati di ~39 MB. Deno mem-parse seluruh
-- JSON itu jadi objek, lalu JSON.stringify() membangunnya lagi jadi teks, jadi
-- puncak pemakaiannya sekitar dua kali ukuran payload.
--
-- TIGA PENYUMBANG, DIUKUR BUKAN DITEBAK (6 Nov 2026):
--   drive_outbox   12 MB   21.010 baris, SEMUANYA status 'done', tertua 3 Agu
--   designs        11 MB   -> 1,9 MB kalau kolom thumb dikeluarkan
--   surat_jalan   4,9 MB   225 dari 225 barisnya menyimpan artwork sebagai
--                          base64 inline di items[].designUrl
--
-- YANG DIKECUALIKAN DI SINI, DAN KENAPA AMAN:
--   designs.thumb  -> 630 dari 634 baris SUDAH punya drive_url, jadi gambarnya
--                     ada di Drive. Baris yang drive_url-nya NULL thumb-nya
--                     TETAP DIIKUTKAN: untuk mereka ini satu-satunya salinan.
--                     Pengecualiannya per-baris, bukan per-kolom.
--   drive_outbox   -> hanya baris 'done' yang lebih tua dari 30 hari. Barisnya
--                     TIDAK dihapus dari database, cuma tidak ikut file backup.
--                     Isinya catatan antrean unggahan yang sudah selesai;
--                     jejak sebenarnya ada di drive_url tabel tujuannya.
--
-- surat_jalan SENGAJA TIDAK DISENTUH. Isinya rekaman apa yang benar-benar
-- dikirim pada hari itu, dan 4,9 MB masih muat begitu 20 MB di atas hilang.
-- Memperbaiki base64-nya adalah pekerjaan terpisah di sisi aplikasi.
--
-- APA PUN YANG DIKELUARKAN DICATAT DI DALAM FILENYA SENDIRI, di kunci
-- `dikecualikan`. Backup yang diam-diam tidak lengkap jauh lebih berbahaya
-- daripada backup yang gagal: yang gagal kelihatan, yang diam-diam tidak.
-- Alasan yang sama kenapa fungsi ini sejak awal menulis tabel kosong sebagai []
-- dan bukan menghilangkannya.
--
-- TETAP 0 ARGUMEN. Menambah parameter berdefault akan melahirkan DUA fungsi
-- bernama sama di PostgREST (yang lama tidak hilang oleh CREATE OR REPLACE),
-- dan pg_cron memanggilnya lewat PostgREST dengan body {} — ambigu berarti
-- backup mingguannya mati dengan cara yang baru.
-- =============================================================================

create or replace function public.backup_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
set statement_timeout to '240s'
as $function$
declare
  t record;
  rows_json jsonb;
  data jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
  n_tabel int := 0;
  sql_baris text;
  n_thumb int := 0;
  n_outbox int := 0;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname
  loop
    if t.tbl = 'designs' then
      sql_baris :=
        'select coalesce(jsonb_agg(case when x.drive_url is null then to_jsonb(x) '
        || 'else to_jsonb(x) - ''thumb'' end), ''[]''::jsonb) from public.designs x';
    elsif t.tbl = 'drive_outbox' then
      sql_baris :=
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.drive_outbox x '
        || 'where x.status is distinct from ''done'' or x.created_at > now() - interval ''30 days''';
    else
      sql_baris := format(
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x',
        t.tbl
      );
    end if;

    execute sql_baris into rows_json;

    data   := data   || jsonb_build_object(t.tbl, rows_json);
    counts := counts || jsonb_build_object(t.tbl, jsonb_array_length(rows_json));
    n_tabel := n_tabel + 1;
  end loop;

  select count(*) into n_thumb  from public.designs where drive_url is not null and thumb is not null;
  select count(*) into n_outbox from public.drive_outbox
    where status = 'done' and created_at <= now() - interval '30 days';

  return jsonb_build_object(
    'versi', 2,
    'skema', 'public',
    'dibuat_pada', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'jumlah_tabel', n_tabel,
    'jumlah_baris', counts,
    'dikecualikan', jsonb_build_object(
      'designs.thumb', jsonb_build_object(
        'baris', n_thumb,
        'sebab', 'base64 artwork; gambarnya ada di drive_url baris yang sama. Baris tanpa drive_url TIDAK dikecualikan.'
      ),
      'drive_outbox', jsonb_build_object(
        'baris', n_outbox,
        'sebab', 'antrean status done yang lebih tua dari 30 hari. Barisnya TETAP ADA di database, hanya tidak ikut file ini.'
      )
    ),
    'data', data
  );
end
$function$;

-- =============================================================================
-- backup_jumlah_baris() — PENJAGA YANG BERJALAN SEBELUM 22 MB DITARIK.
--
-- Edge Function-nya tidak lagi mem-parse snapshot (itu yang membunuhnya di
-- 39 MB: objek JS penuh + teks stringify-nya hidup bersamaan). Tapi penjaga
-- "snapshot kosong" dulu membaca jumlah_baris DARI objek yang sudah di-parse
-- itu. Jadi penghitungnya dipisah: murah, dipanggil lebih dulu, dan hasilnya
-- juga yang dipakai mengisi laporan per_tabel.
--
-- Angkanya sengaja jumlah baris SEBENARNYA di tabel, bukan jumlah baris yang
-- masuk file. Pertanyaan yang dijawab penjaga ini adalah "databasenya kosong
-- atau tidak", bukan "filenya berapa baris".
-- =============================================================================

create or replace function public.backup_jumlah_baris()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
set statement_timeout to '60s'
as $function$
declare
  t record;
  n bigint;
  hasil jsonb := '{}'::jsonb;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    execute format('select count(*) from public.%I', t.tbl) into n;
    hasil := hasil || jsonb_build_object(t.tbl, n);
  end loop;
  return hasil;
end
$function$;
