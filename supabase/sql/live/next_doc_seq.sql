-- next_doc_seq
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) e463022a8e5e

CREATE OR REPLACE FUNCTION public.next_doc_seq(p_bucket text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    declare
      v_next integer;
    begin
      if public.current_role() is null or public.current_role() = 'cenjc' then
        raise exception 'Akun % tidak boleh menerbitkan nomor dokumen', coalesce(public.current_role(), '(tidak dikenal)');
      end if;
      insert into public.doc_seq (bucket, seq) values (p_bucket, 1)
        on conflict (bucket) do update set seq = doc_seq.seq + 1
        returning seq into v_next;
      return v_next;
    end
    $function$
