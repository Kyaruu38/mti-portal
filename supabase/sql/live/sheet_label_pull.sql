-- sheet_label_pull
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 4a6f20da2ab8
--
-- 2026-11-16: 6 field dibuang supaya payload turun 1.047 kB -> 728 kB.
--   Dibuang: supplier_full, po_status, deskripsi_cn, satuan, qty_sj, qty_direct.
--   Alasan: tidak satupun dipakai "Sinkron Portal.gs" (satu-satunya pemakai
--   RPC ini). Egress tarikan per jam turun 737 MB -> 512 MB per bulan.
--   Kalau nanti ada yang butuh field itu lagi, tambahkan balik di sini.

CREATE OR REPLACE FUNCTION public.sheet_label_pull(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak';
  end if;
  with li as (
    select p.id as po_id, p.no as po_no, p.supplier as sup,
           p.created_at as dibuat, x.i as it, (x.ord - 1)::int as idx
      from public.pos p, jsonb_array_elements(p.items) with ordinality as x(i, ord)
     where p.source = 'label' and p.deleted_at is null
  ),
  sj as (
    select y ->> 'lineId' as line_id,
           sum(coalesce((y ->> 'qtyShipped')::numeric, 0)) as qty_sj,
           max(s.created_at)::date as tgl_sj
      from public.surat_jalan s, jsonb_array_elements(s.items) y
     where coalesce(s.status, 'aktif') <> 'batal'
     group by 1
  ),
  inv as (
    select po_ref, string_agg(distinct no, ', ') as inv_no
      from public.invoices where po_ref is not null group by 1
  ),
  baris as (
    select jsonb_build_object(
      'supplier', case
          when li.sup ilike '%BINTANG CAHAYA%' then 'BCL'
          when li.sup ilike '%WINS%' then 'WINS'
          when li.sup ilike '%SHENG YOU%' then 'SHENGYOU'
          when li.sup ilike '%BSN%' then 'BSN'
          when li.sup ilike '%WANLIAN%' then 'WANLIAN'
          else li.sup end,
      'po_mti', li.po_no,
      'erp_id', li.it ->> 'erp',
      'deskripsi', li.it ->> 'd',
      'ukuran', li.it ->> 'dimension',
      'bulan_order', to_char(li.dibuat, 'YYYY-MM'),
      'qty_order', coalesce((li.it ->> 'qty')::numeric, 0),
      'qty_terima', coalesce(sj.qty_sj, 0) + coalesce((li.it ->> 'receivedDirect')::numeric, 0),
      'tgl_datang', coalesce(
          to_char(greatest(sj.tgl_sj, nullif(li.it ->> 'receivedDirectAt','')::date), 'YYYY-MM-DD'),
          to_char(sj.tgl_sj, 'YYYY-MM-DD'),
          left(nullif(li.it ->> 'receivedDirectAt',''), 10)),
      'invoice', coalesce(inv.inv_no, ''),
      'terkunci_sj', (coalesce(sj.qty_sj, 0) > 0),
      'status', case
          when coalesce(sj.qty_sj,0) + coalesce((li.it ->> 'receivedDirect')::numeric,0) <= 0
            then 'Not arrived / 未到货'
          when coalesce(sj.qty_sj,0) + coalesce((li.it ->> 'receivedDirect')::numeric,0)
               >= coalesce((li.it ->> 'qty')::numeric, 0)
            then 'Complete / 已齐'
          else 'Partial / 部分到货' end,
      'po_id', li.po_id::text,
      'line_id', li.it ->> 'lineId'
    ) as j, li.dibuat, li.po_no, li.idx
    from li
    left join sj  on sj.line_id = li.it ->> 'lineId'
    left join inv on inv.po_ref = li.po_no
  )
  select coalesce(jsonb_agg(j order by dibuat, po_no, idx), '[]'::jsonb) into v_out from baris;
  return v_out;
end $function$;
