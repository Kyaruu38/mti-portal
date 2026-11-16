-- sheet_label_push
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 985eb515688c

CREATE OR REPLACE FUNCTION public.sheet_label_push(p_token text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r jsonb; v_line text; v_qty numeric; v_tgl text;
  v_po_id uuid; v_po_no text; v_idx int; v_ordered numeric; v_sj numeric; v_pesan text; v_ok boolean;
  v_out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.sheet_keys where token = p_token) then
    raise exception 'token ditolak';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := nullif(btrim(coalesce(r ->> 'line_id','')), '');
    begin
      v_qty := nullif(btrim(coalesce(r ->> 'qty_terima','')), '')::numeric;
    exception when others then v_qty := null;
    end;
    v_tgl := left(nullif(btrim(coalesce(r ->> 'tgl_datang','')), ''), 10);
    v_ok := false; v_pesan := null; v_po_id := null;
    if v_line is null or v_qty is null then continue; end if;
    select p.id, p.no, (x.ord - 1)::int, (x.i ->> 'qty')::numeric
      into v_po_id, v_po_no, v_idx, v_ordered
      from public.pos p, jsonb_array_elements(p.items) with ordinality as x(i, ord)
     where p.source = 'label' and p.deleted_at is null and x.i ->> 'lineId' = v_line
     limit 1;
    if v_po_id is null then
      v_pesan := 'DITOLAK: baris tidak ditemukan di portal';
    else
      perform 1 from public.pos where id = v_po_id for update;
      select coalesce(sum(coalesce((x ->> 'qtyShipped')::numeric, 0)), 0) into v_sj
        from public.surat_jalan sj, jsonb_array_elements(sj.items) x
       where coalesce(sj.status,'aktif') <> 'batal' and x ->> 'lineId' = v_line;
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
end $function$
