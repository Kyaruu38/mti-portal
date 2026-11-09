# Artwork yang teksnya SUDAH DIJADIKAN KURVA tetap bisa diukur.
#
# Yang ditemukan dari berkas aslinya: huruf-huruf TIDAK disimpan satu jalur
# per huruf, melainkan DIGABUNG jadi satu jalur majemuk per BARIS TEKS --
# satu jalur dengan ratusan segmen. Jadi kotak batas jalur itu SUDAH kotak
# batas medannya, dan tidak perlu pengelompokan sama sekali.
#
# Penyaringnya: banyak segmen (huruf punya banyak simpul; bingkai dan blok
# warna cuma 1-8), dan ukurannya masuk akal untuk teks.
import pymupdf, sys
MM = 25.4/72.0

def medan(path, min_segmen=20):
    d = pymupdf.open(path); pg = d[0]; R = pg.rect
    out = []
    for g in pg.get_drawings():
        n = len(g.get('items', []))
        if n < min_segmen: continue
        r = g['rect']; w, h = r.width*MM, r.height*MM
        if w <= 0 or h <= 0 or (w > 250 and h > 120): continue
        putar = h > w * 1.6 and h > 20
        out.append({'x0': round(r.x0*MM,2), 'y0': round(r.y0*MM,2),
                    'x1': round(r.x1*MM,2), 'y1': round(r.y1*MM,2),
                    'l': round(w,2), 't': round(h,2), 'seg': n,
                    'ukuran': round(h if not putar else w, 2), 'putar': putar})
    out.sort(key=lambda m: (-m['y1'], m['x0']))
    return R, out

if __name__ == '__main__':
    for p in sys.argv[1:]:
        R, m = medan(p)
        print('### %s :: %.0fx%.0f mm :: %d medan terdeteksi' % (p.split('/')[-1], R.width*MM, R.height*MM, len(m)))
        for x in m:
            print('   x=%7.2f y=%7.2f  l=%7.2f t=%6.2f  ukuran=%5.2f %-5s seg=%4d' % (
                x['x0'], x['y1'], x['l'], x['t'], x['ukuran'], 'PUTAR' if x['putar'] else 'datar', x['seg']))
        print()
