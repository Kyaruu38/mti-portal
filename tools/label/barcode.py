# BARCODE EAN-13 / UPC-A: digambar ulang dari items.ean.
#
# Proof yang membawa barcode LAMA lebih berbahaya daripada proof tanpa
# barcode sama sekali: angkanya di bawah batang sudah benar, batangnya
# belum, dan tidak ada manusia yang memeriksa itu dengan mata.
#
# UPC-A (12 digit) adalah EAN-13 dengan nol di depan, jadi dikodekan lewat
# jalur yang sama dan cuma berbeda cara menuliskan angkanya.
import pymupdf

L = ['0001101','0011001','0010011','0111101','0100011',
     '0110001','0101111','0111011','0110111','0001011']
G = ['0100111','0110011','0011011','0100001','0011101',
     '0111001','0000101','0010001','0001001','0010111']
R = ['1110010','1100110','1101100','1000010','1011100',
     '1001110','1010000','1000100','1001000','1110100']
PARITAS = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG',
           'LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

def digit_cek(d12):
    n = [int(c) for c in d12]
    return (10 - sum(n[i] * (1 if i % 2 == 0 else 3) for i in range(12)) % 10) % 10

def pola(kode):
    k = ''.join(ch for ch in str(kode) if ch.isdigit())
    if len(k) == 12 and digit_cek(k[:12]) != int(k[11]):
        k = '0' + k                      # UPC-A: nol depannya memang dibuang saat dicetak
    if len(k) == 12: k = '0' + k
    if len(k) != 13: raise ValueError('panjang kode %d, bukan 12/13' % len(k))
    if digit_cek(k[:12]) != int(k[12]):
        raise ValueError('digit cek salah: hitung %d, tertulis %s' % (digit_cek(k[:12]), k[12]))
    par = PARITAS[int(k[0])]
    s = '101'
    for i, c in enumerate(k[1:7]):
        s += (L if par[i] == 'L' else G)[int(c)]
    s += '01010'
    for c in k[7:]:
        s += R[int(c)]
    return s + '101', k

def baca_balik(s):
    # Memeriksa hasil gambar sendiri: pola dibaca ulang jadi angka.
    if len(s) != 95 or s[:3] != '101' or s[-3:] != '101' or s[45:50] != '01010':
        return None
    kiri = [s[3+7*i:10+7*i] for i in range(6)]
    kanan = [s[50+7*i:57+7*i] for i in range(6)]
    par = ''; kd = ''
    for b in kiri:
        if b in L: par += 'L'; kd += str(L.index(b))
        elif b in G: par += 'G'; kd += str(G.index(b))
        else: return None
    if par not in PARITAS: return None
    d0 = PARITAS.index(par)
    for b in kanan:
        if b not in R: return None
        kd += str(R.index(b))
    return str(d0) + kd

def gambar(pg, kode, x0, y0, lebar, tinggi, mm=True, warna=(0,0,0), latar=(1,1,1),
           angka=True, putar=False):
    """putar=True untuk barcode yang dicetak memanjang ke bawah (batangnya
    mendatar). Yang berubah cuma pemetaan sumbunya; pola 95 modulnya sama."""
    PT = 72/25.4 if mm else 1
    s, k = pola(kode)
    X = (lebar*PT) / 95.0
    zona_angka = (tinggi*PT) * 0.14 if angka else 0
    if putar:
        bersih = pymupdf.Rect(x0*PT, y0*PT - 10*X, x0*PT + tinggi*PT, y0*PT + lebar*PT + 7*X)
    else:
        bersih = pymupdf.Rect(x0*PT - 10*X, y0*PT, x0*PT + lebar*PT + 7*X, y0*PT + tinggi*PT)
    pg.draw_rect(bersih, color=None, fill=latar, overlay=True)
    for i, b in enumerate(s):
        if b != '1': continue
        # batang penjaga memanjang melewati zona angka
        panjang = (i < 3) or (i >= 92) or (45 <= i < 50)
        h = tinggi*PT - (0 if panjang else zona_angka)
        if putar:
            rr = pymupdf.Rect(x0*PT, y0*PT + i*X, x0*PT + h, y0*PT + (i+1)*X)
        else:
            rr = pymupdf.Rect(x0*PT + i*X, y0*PT, x0*PT + (i+1)*X, y0*PT + h)
        pg.draw_rect(rr, color=None, fill=warna, overlay=True)
    if angka:
        uk = max(3.0, zona_angka * 0.95)
        def tulis(teks, a, b):
            if putar:
                rr = pymupdf.Rect(x0*PT + tinggi*PT - uk*1.3, y0*PT + a,
                                  x0*PT + tinggi*PT + uk*0.4, y0*PT + b)
                pg.insert_textbox(rr, teks, fontname='cour', fontsize=uk,
                                  color=warna, align=1, rotate=90)
            else:
                dasar = y0*PT + tinggi*PT
                rr = pymupdf.Rect(x0*PT + a, dasar - uk*1.05, x0*PT + b, dasar + uk*0.35)
                pg.insert_textbox(rr, teks, fontname='cour', fontsize=uk, color=warna, align=1)
        tulis(k[0],   -9*X,  -1*X)
        tulis(k[1:7],  3*X,  45*X)
        tulis(k[7:],  50*X,  92*X)
    return k, s
