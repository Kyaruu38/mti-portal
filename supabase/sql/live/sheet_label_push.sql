-- sheet_label_push
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) e82faf8255fc
--
-- 2026-11-16: DIBENERIN karena sinkron pertama GAGAL dengan
--   57014 "canceling statement due to statement timeout".
--   Sebabnya: versi lama men-scan ULANG seluruh public.pos dan
--   public.surat_jalan (lewat jsonb_array_elements) untuk SETIAP
--   baris yang dikirim. 339 baris x scan penuh = lewat timeout.
--   Sekarang dua peta itu dibangun SEKALI ke temp table ber-index,
--   lalu tiap baris cuma lookup. Logika, pesan dan audit TIDAK diubah.
--   Catatan: kegagalan lama rollback bersih (tidak ada tulisan separuh).
--   Sisi Sheets juga dipecah per 100 baris sebagai pengaman kedua.

CREATE OR REPLACE FUNCTION public.sheet_label_push(p_token text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb; v_line text; v_qty numeric; v_tgl text;
  v_po_id uuid; v_po_no text; v_idx int; v_ordered numeric; v_sj numeric;
  v_pesan text; v_ok boolean;
  v_out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak';
  end if;

  create temporary table _pk_ln on commit drop as
    select p.id as po_id, p.no as po_no, (x.ord - 1)::int as idx,
           coalesce((x.i ->> 'qty')::numeric, 0) as ordered,
           x.i ->> 'lineId' as line_id
      from public.pos p, jsonb_array_elements(p.items) with ordinality as x(i, ord)
     where p.source = 'label' and p.deleted_at is null;
  create index on _pk_ln (line_id);

  create temporary table _pk_sj on commit drop as
    select y ->> 'lineId' as line_id,
           coalesce(sum(coalesce((y ->> 'qtyShipped')::numeric, 0)), 0) as qty_sj
      from public.surat_jalan sj, jsonb_array_elements(sj.items) y
     where coalesce(sj.status, 'aktif') <> 'batal'
     group by 1;
  create index on _pk_sj (line_id);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := nullif(btrim(coalesce(r ->> 'line_id','')), '');
    begin
      v_qty := nullif(btrim(coalesce(r ->> 'qty_terima','')), '')::numeric;
    exception when others then v_qty := null;
    end;
    v_tgl := left(nullif(btrim(coalesce(r ->> 'tgl_datang','')), ''), 10);
    v_ok := false; v_pesan := null; v_po_id := null;
    if v_line is null or v_qty is null then continue; end if;

    select l.po_id, l.po_no, l.idx, l.ordered
      into v_po_id, v_po_no, v_idx, v_ordered
      from _pk_ln l where l.line_id = v_line limit 1;

    if v_po_id is null then
      v_pesan := 'DITOLAK: baris tidak ditemukan di portal';
    else
      perform 1 from public.pos where id = v_po_id for update;
      select coalesce(s.qty_sj, 0) into v_sj from _pk_sj s where s.line_id = v_line;
      v_sj := coalesce(v_sj, 0);
      if v_sj > 0 then
        v_pesan := 'DIKUNCI: sudah ada surat jalan (' || v_sj || ') - ubah lewat portal';
      elsif v_qty < 0 then
        v_pesan := 'DITOLAK: qty negatif';
      elsif v_qty > v_ordered + 0.000001 then
        v_pesan := 'DITOLAK: ' || v_qty || ' lewat dari pesanan ' || v_ordered;
      else
        update public.pos
           set items = jsonb_set(
                 jsonb_set(items, array[v_idx::text, 'receivedDirect'], to_jsonb(v_qty)),
                 array[v_idx::text, 'receivedDirectAt'],
                 to_jsonb(coalesce(v_tgl, to_char(now(), 'YYYY-MM-DD'))))
         where id = v_po_id;
        v_ok := true; v_pesan := 'OK';
        insert into public.audit_log (username, entity, target, action, detail)
        values ('sheets-label', 'po', v_po_no, 'receive',
                'dari Google Sheets - baris ' || v_line || ' qty ' || v_qty);
      end if;
    end if;
    v_out := v_out || jsonb_build_array(
      jsonb_build_object('line_id', v_line, 'ok', v_ok, 'pesan', v_pesan));
  end loop;
  return v_out;
end $function$;
