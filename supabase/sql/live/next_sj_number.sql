-- next_sj_number
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 9772a85b972e

CREATE OR REPLACE FUNCTION public.next_sj_number(p_po_ids text[], p_bucket text, p_month_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_base integer;
  v_shipment integer;
begin
  -- Penomoran dokumen adalah operasi TULIS. Peran pemantau tidak boleh
  -- memajukan deret yang keluar dari gedung ini di atas kertas.
  if public.current_role() is null or public.current_role() = 'cenjc' then
    raise exception 'Akun % tidak boleh menerbitkan nomor dokumen', coalesce(public.current_role(),'(tidak dikenal)');
  end if;
  -- Serialize ALL callers for this month's SJ numbering. SJ creation is a
  -- low-frequency manual action, so this trade-off (correctness over
  -- throughput) is fine, and it's what makes the reuse-or-draw-new-base
  -- decision below race-free even across POs bundled in different documents.
  perform pg_advisory_xact_lock(42, hashtext(p_bucket));

  -- Reuse the thread if ANY of these POs already belongs to one this month.
  select base_seq into v_base from public.sj_po_thread
    where po_id = any(p_po_ids) and bucket = p_bucket
    order by base_seq limit 1;

  if v_base is null then
    v_base := public.next_doc_seq('SJ-' || p_bucket);
  end if;

  -- Bind every PO in this document to that thread. A PO already bound (from
  -- an earlier document) keeps its original binding — we never reassign.
  insert into public.sj_po_thread (po_id, bucket, base_seq)
  select x, p_bucket, v_base from unnest(p_po_ids) as x
  on conflict (po_id, bucket) do nothing;

  -- Atomically bump the THREAD's shared shipment counter and read back the
  -- new value in one statement (same insert-on-conflict-returning pattern
  -- as next_doc_seq — race-free by Postgres's own row locking).
  insert into public.sj_thread_seq (bucket, base_seq, shipment_count)
  values (p_bucket, v_base, 1)
  on conflict (bucket, base_seq) do update set shipment_count = sj_thread_seq.shipment_count + 1
  returning shipment_count into v_shipment;

  return p_month_prefix || lpad(v_base::text, 3, '0') || '-' || v_shipment;
end;
$function$
