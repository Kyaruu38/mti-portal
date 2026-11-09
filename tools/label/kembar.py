# MENEMUKAN SALINAN GANDA DI ARTWORK YANG TEKSNYA SUDAH JADI KURVA.
#
# Kenapa ini penting: nilai yang sama sering dicetak DUA KALI di satu label
# (di panel dan di tulang punggung yang diputar). Kalau peta medan cuma
# mencatat satu salinan, yang satu lagi tertinggal dengan nilai LAMA -- dan
# hasilnya label yang membawa dua nilai bertentangan, yang sekilas terlihat
# benar. Itu ragam gagal paling berbahaya di jalur sulih.
#
# Teksnya tidak bisa dibaca, jadi dicocokkan lewat BENTUKNYA.
#
# Jumlah simpul saja TIDAK CUKUP: diuji, dan dua teks berbeda bisa kebetulan
# punya jumlah simpul sama (di satu artwork, sebuah baris peringatan dan
# tulisan merek yang diputar sama-sama 684). Jadi sesudah disaring lewat
# jumlah simpul, bentuknya DIADU titik per titik setelah dinormalkan ke
# kotak satuan -- dua salinan teks yang sama akan menumpuk hampir sempurna
# berapa pun skalanya, sementara dua teks berbeda tidak.
import pymupdf, sys, math

def titik_jalur(g):
    t = []
    for it in g.get('items', []):
        for v in it[1:]:
            if isinstance(v, pymupdf.Point): t.append((v.x, v.y))
            elif isinstance(v, pymupdf.Rect): t += [(v.x0, v.y0), (v.x1, v.y1)]
    return t

# TIGA ragam: apa adanya, diputar +90, diputar -90.
#
# Arah putarnya TIDAK ditebak dari bentuk kotaknya. Itu kesalahan percobaan
# pertama: kedua salinan sama-sama "diluruskan" lebih dulu memakai tebakan
# yang sama, sehingga pasangan yang benar justru tidak pernah bertemu.
# Yang dilakukan sekarang: tiap pasangan diadu pada SEMUA kombinasi
# ragam, lalu diambil jarak terkecilnya.
def ragam(t):
    if len(t) < 4: return []
    out = []
    for m in ((lambda x, y: (x, y)), (lambda x, y: (y, -x)), (lambda x, y: (-y, x))):
        u = [m(x, y) for (x, y) in t]
        xs = [p[0] for p in u]; ys = [p[1] for p in u]
        w = max(xs)-min(xs); h = max(ys)-min(ys)
        if w <= 0 or h <= 0: continue
        x0, y0 = min(xs), min(ys)
        out.append([((p[0]-x0)/w, (p[1]-y0)/h) for p in u])
    return out

def _d(a, b):
    if len(a) != len(b): return 9.9
    return sum(math.hypot(p[0]-q[0], p[1]-q[1]) for p, q in zip(a, b)) / len(a)

def jarak(ra, rb):
    if not ra or not rb: return 9.9
    return min(_d(a, b) for a in ra for b in rb)

def cari(path, min_seg=20, ambang=0.01):
    d = pymupdf.open(path); pg = d[0]
    MM = 25.4/72.0; medan = []
    for g in pg.get_drawings():
        n = len(g.get('items', []))
        if n < min_seg: continue
        r = g['rect']; w, h = r.width*MM, r.height*MM
        if w <= 0 or h <= 0 or (w > 250 and h > 120): continue
        putar = h > w*1.6 and h > 20
        t = titik_jalur(g)
        medan.append({'seg': n, 'x': round(r.x0*MM,2), 'y': round(r.y1*MM,2),
                      'l': round(w,2), 't': round(h,2), 'putar': putar,
                      'bentuk': ragam(t)})
    gugus = []
    dipakai = set()
    for i, a in enumerate(medan):
        if i in dipakai or not a['bentuk']: continue
        grup = [i]
        for j in range(i+1, len(medan)):
            if j in dipakai: continue
            b = medan[j]
            if b['seg'] != a['seg'] or not b['bentuk']: continue
            if jarak(a['bentuk'], b['bentuk']) < ambang:
                grup.append(j); dipakai.add(j)
        dipakai.add(i)
        if len(grup) > 1: gugus.append([medan[k] for k in grup])
    return medan, gugus

if __name__ == '__main__':
    for p in sys.argv[1:]:
        medan, gugus = cari(p)
        print('### %s :: %d medan :: %d nilai muncul lebih dari sekali' % (
            p.split('/')[-1], len(medan), len(gugus)))
        for g in gugus:
            print('    seg=%-4d x%d :' % (g[0]['seg'], len(g)))
            for m in g:
                print('        x=%7.2f y=%7.2f %6.2fx%-5.2f %s' % (
                    m['x'], m['y'], m['l'], m['t'], 'PUTAR' if m['putar'] else 'datar'))
        print()
