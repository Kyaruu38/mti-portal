import pymupdf, re, os, sys, collections
MM = 25.4/72.0
U = sys.argv[1]
man = {}
for ln in open(os.path.join(U, 'manifest.txt'), encoding='utf-8', errors='replace'):
    if '\t' in ln:
        k, v = ln.rstrip('\n').split('\t', 1); man[k] = v
rows = []
for f in sorted(os.listdir(U)):
    if not f.endswith('.pdf'): continue
    nama = man.get(f, f)
    m = re.search(r'\(ID-(.+?)-(TBR|PCR|BIAS|OTR|ST)[-\s](BX|PT|SNI|OEM|0EM)', nama, re.I)
    merek = m.group(1) if m else '?'
    konst = m.group(2).upper() if m else '?'
    pasar = m.group(3).upper().replace('0EM','OEM') if m else '?'
    try:
        d = pymupdf.open(os.path.join(U, f)); pg = d[0]; r = pg.rect
        w, h = round(r.width*MM), round(r.height*MM)
        n = sum(len(l['spans']) for b in pg.get_text('dict')['blocks'] if b['type']==0 for l in b['lines'])
        hal = len(d)
    except Exception as e:
        w = h = n = hal = -1
    rows.append((f, pasar, konst, merek[:12], w, h, n, hal, nama))
print('%-5s %-4s %-5s %-12s %9s %5s %4s  %s' % ('br','psr','konst','merek','lembar mm','span','hal','nama'))
print('-'*118)
for r in rows:
    print('%-5s %-4s %-5s %-12s %4dx%-4d %5d %4d  %s' % (
        r[0][:5], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8][:46]))
print()
print('=== KELUARGA TEMPLAT : (pasar, konstruksi, lembar) ===')
c = collections.Counter((r[1], r[2], '%dx%d' % (r[4], r[5])) for r in rows)
for (p, k, l), n in sorted(c.items(), key=lambda x: (-x[1], x[0])):
    print('   %-4s %-5s %-10s  x%d' % (p, k, l, n))
print()
print('=== LEMBAR BERBEDA yang ditemukan: %d ===' % len(set('%dx%d'%(r[4],r[5]) for r in rows)))
