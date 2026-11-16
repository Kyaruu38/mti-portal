-- confirm_prf_paid
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) e79dd3bd9c0c

CREATE OR REPLACE FUNCTION public.confirm_prf_paid(p_prf_id uuid, p_method text, p_drive_url text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prf record;
  v_payment_id uuid;
begin
  -- Sama seperti create_surat_jalan: NULL not in (...) bernilai NULL,
  -- bukan TRUE. Fungsi ini menandai PRF LUNAS — uang.
  if public.current_role() is null then
    raise exception 'Akun tidak dikenal tidak boleh menandai PRF lunas'
      using errcode = 'insufficient_privilege';
  end if;
  if public.current_role() not in ('wilbert', 'financemti', 'sekar') then
    raise exception 'only finance/wilbert can confirm payment';
  end if;
  select * into v_prf from public.prfs where id = p_prf_id;
  if v_prf is null then
    raise exception 'PRF not found';
  end if;
  if v_prf.stage <> 'Diterima Finance' then
    raise exception 'PRF must be in "Diterima Finance" stage to confirm payment (currently "%")', v_prf.stage;
  end if;
  update public.prfs set stage = 'Paid', paid_at = now() where id = p_prf_id;
  update public.invoices
    set status = 'Paid'
    where no in (select jsonb_array_elements_text(v_prf.invoices));
  insert into public.payments (date, prf, supplier, amount, currency, method, drive_url)
  values (now(), v_prf.no, v_prf.supplier, v_prf.amount, v_prf.currency, p_method, p_drive_url)
  returning id into v_payment_id;
  return v_payment_id;
end;
$function$
