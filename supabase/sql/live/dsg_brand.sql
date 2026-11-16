-- dsg_brand
-- DITANGKAP DARI PRODUKSI 2026-11-16 lewat pg_get_functiondef().
-- Ini CERMIN apa yang hidup, bukan niat. Kalau beda dengan file
-- rancangan di ../, yang HIDUP adalah yang di sini.
-- md5(prosrc-setara) 708ae335c908

CREATE OR REPLACE FUNCTION public.dsg_brand(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare n text; asli text; pre text; b text; p text[];
  daftar text[] := array[
    'AMERICANROADSTAR','TRUSTTRACKOVERALL','GOLDENCROWN','MASTERTRACK','FREECOUNTRY',
    'TRANSEAGLE','TRAVELSTAR','GRIPMASTER','BLACKARROW','XCELLENT','WESTLAKE','GOODRIDE',
    'HERCULES','EFFIPLUS','AGGRESSOR','SUPERMAX','TECHKING','BRANSALES','REDCLIFF',
    'RODOFORT','CHAOYANG','MICHELIN','TRAZANO','CAPITOL','IRONMAN','MIRAGE','SUDESTE',
    'ASCENDO','OMNIMAX','STRADAR','VANTAGE','WANLIAN','STRYKER','ARISUN','ANTINI',
    'ARROYO','NEBULA','SEDONA','TIANLI','UNITED','VITOUR','ASPIRA','TUCSON','ORNATE',
    'HIRUN','NIPON','ITARO','RISEN','DIDAR','YARTU','XBRI','TKV'
  ];
  -- nama China -> merek. 无内 (tubeless), 纳米高抓, 配套, 编织袋, 东南亚, 美国,
  -- 巴拉圭, 停用 BUKAN merek; itu keterangan produk/pasar, jangan dimasukkan.
  china text[][] := array[
    ['威狮','WESTLAKE'], ['西湖','WESTLAKE'], ['好运','GOODRIDE'], ['全诺','TRAZANO'],
    ['朝阳','CHAOYANG'], ['金冠','GOLDENCROWN'], ['力奔','NIPON'], ['欧耐特','ORNATE'],
    ['雅度','YARTU'], ['日升','RISEN'], ['天力','TIANLI'], ['路诚','TRUSTTRACKOVERALL']
  ];
  singkat text[][] := array[
    ['WL','WESTLAKE'], ['GR','GOODRIDE'], ['TN','TRAZANO'],
    ['JG','GOLDENCROWN'], ['YR','YARTU'], ['CY','CHAOYANG']
  ];
begin
  asli := coalesce(t, '');
  n := public.dsg_norm(asli);

  -- 1. prefix resmi paling dipercaya
  pre := upper(regexp_replace(coalesce(substring(asli from '\(ID-([A-Za-z0-9 _]+?)-'), ''), '[^A-Za-z0-9]', '', 'g'));
  if pre <> '' and pre <> 'TBR' and pre <> 'ID' then
    foreach p slice 1 in array singkat loop
      if pre = p[1] then return p[2]; end if;
    end loop;
    return pre;
  end if;

  -- 2. nama latin lengkap
  foreach b in array daftar loop
    if position(b in n) > 0 then return b; end if;
  end loop;

  -- 3. nama China
  foreach p slice 1 in array china loop
    if position(p[1] in asli) > 0 then return p[2]; end if;
  end loop;

  -- 4. singkatan, HANYA sebagai kata utuh di teks asli — supaya 'WL' tidak
  --    ikut tertangkap di tengah kata lain
  foreach p slice 1 in array singkat loop
    if asli ~* ('\m' || p[1] || '\M') then return p[2]; end if;
  end loop;

  return '';
end $function$
