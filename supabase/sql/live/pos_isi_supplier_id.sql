-- pos_isi_supplier_id
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 54cf1f390d3d

CREATE OR REPLACE FUNCTION public.pos_isi_supplier_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_n int; v_nama text;
begin
  if tg_op = 'UPDATE'
     and new.supplier_id is not null
     and new.supplier is not distinct from old.supplier then
    return new;
  end if;
  if new.supplier is null or btrim(new.supplier) = '' then
    return new;
  end if;

  v_nama := upper(btrim(new.supplier));
  select count(*) into v_n from public.suppliers s where upper(btrim(s.name)) = v_nama;
  if v_n = 1 then
    select s.id into v_id from public.suppliers s where upper(btrim(s.name)) = v_nama limit 1;
    new.supplier_id := v_id;
    return new;
  end if;

  if v_n = 0 then
    v_nama := upper(regexp_replace(new.supplier,'[^A-Za-z0-9]','','g'));
    select count(*) into v_n from public.suppliers s
      where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = v_nama;
    if v_n = 1 then
      select s.id into v_id from public.suppliers s
        where upper(regexp_replace(s.name,'[^A-Za-z0-9]','','g')) = v_nama limit 1;
      new.supplier_id := v_id;
    end if;
  end if;
  return new;
end $function$
