-- prfs_guard_nominal
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 77fb7020f7ba

CREATE OR REPLACE FUNCTION public.prfs_guard_nominal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.stage is distinct from 'Terbentuk' then
    if new.amount is distinct from old.amount
    or new.lines is distinct from old.lines
    or new.invoices is distinct from old.invoices
    or new.no is distinct from old.no
    or new.supplier is distinct from old.supplier
    or new.currency is distinct from old.currency then
      raise exception
        'PRF % sudah di tahap "%": nominal, rincian, dan daftar invoicenya tidak boleh diubah lagi. Batalkan PRF ini dan buat ulang, supaya nomornya baru.',
        old.no, old.stage using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$function$
