# -*- coding: utf-8 -*-
"""Mengukur kotak barcode dari HASIL RENDER, bukan dari tebakan.

KENAPA DIRENDER, BUKAN DIBACA DARI CONTENT STREAM. Angka barcode-nya teks,
jadi kotaknya ketahuan dari lapisan teks. Tapi BATANGnya vektor: puluhan
persegi panjang yang digambar satu per satu, dan menghitung jangkauannya dari
operator PDF berarti menafsirkan geometri — termasuk transformasi yang sedang
berlaku saat itu. Dirender sekali, batangnya kelihatan sebagai tinta hitam di
atas kotak putih, dan jangkauannya tinggal diukur.

Yang dicari dua hal:
  - KOTAK PUTIH alas barcode-nya. Ini batas aman: menutup di dalamnya tidak
    pernah mengenai panel hijau, jadi batang lama bisa dihapus tanpa melubangi
    design.
  - JANGKAUAN TINTA di dalam kotak itu: batang + angkanya.

Keluarannya JSON dalam milimeter, sumbu-turun (y dari atas), sama dengan yang
dipakai seluruh jalur label.
"""
import json
import subprocess
import sys
import tempfile
import os

from PIL import Image


def ukur(pdf, kolom_x0, kolom_y0, kolom_x1, kolom_y1, dpi=150):
    """Mengembalikan kotak tinta barcode: batang + angkanya, bukan latarnya.

    YANG DIIKUTI TINTANYA, BUKAN LATARNYA. Dua versi sebelumnya mengikuti
    latar: melebar selama pikselnya kelabu. Di label SNI itu berhenti sendiri
    karena kotak barcodenya dikelilingi panel hijau. Di label BX seluruh
    lembarnya putih, jadi pelebarannya menelan logo WEST LAKE, pita ALL STEEL
    TUBELESS dan MADE IN INDONESIA -- dan sesudah dibatasi 30 mm pun masih
    menelan dua pita yang tepat di atas barcodenya.

    Yang membedakan barcode dari pita di atasnya bukan jaraknya, melainkan
    bahwa tintanya TIDAK NYAMBUNG. Jadi yang ditelusuri tintanya: mulai dari
    kolom angkanya, menyebar ke piksel gelap yang bertetangga, dengan
    toleransi celah kecil supaya batang-batang yang terpisah tipis tetap
    terhitung satu barcode. Pita yang dipisahkan ruang putih tidak akan
    pernah tercapai.
    """
    tmp = tempfile.mkdtemp(prefix='kotakbarcode-')
    awalan = os.path.join(tmp, 'h')
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-f', '1', '-l', '1', pdf, awalan],
                   check=True, capture_output=True)
    berkas = [os.path.join(tmp, f) for f in sorted(os.listdir(tmp)) if f.endswith('.png')]
    if not berkas:
        raise SystemExit('pdftoppm tidak menghasilkan gambar')
    im = Image.open(berkas[0]).convert('RGB')
    px = im.load()
    W, H = im.size
    ke_px = lambda v: int(round(v / 25.4 * dpi))
    ke_mm = lambda p: p / dpi * 25.4

    gelap = lambda c: (c[0] + c[1] + c[2]) / 3 < 150

    # Jendela kerja: kotak angkanya dilebarkan secukupnya untuk memuat batang
    # barcodenya, tidak lebih. EAN-13 tidak pernah lebih panjang dari ini.
    JENDELA_MM = 26.0
    j = ke_px(JENDELA_MM)
    x0 = max(0, ke_px(kolom_x0) - j); x1 = min(W - 1, ke_px(kolom_x1) + j)
    y0 = max(0, ke_px(kolom_y0) - j); y1 = min(H - 1, ke_px(kolom_y1) + j)

    # Celah yang masih dianggap nyambung. Batang barcode dipisahkan ruang
    # putih tipis; pita teks di atasnya dipisahkan ruang putih yang jauh
    # lebih lebar.
    CELAH_MM = 1.2
    celah = max(1, ke_px(CELAH_MM))

    benih = [(x, y)
             for x in range(max(x0, ke_px(kolom_x0)), min(x1, ke_px(kolom_x1)) + 1)
             for y in range(max(y0, ke_px(kolom_y0)), min(y1, ke_px(kolom_y1)) + 1)
             if gelap(px[x, y])]
    if not benih:
        raise SystemExit('tidak ada tinta di kolom angka barcode')

    sudah = set(benih)
    antre = list(benih)
    while antre:
        x, y = antre.pop()
        for dx in range(-celah, celah + 1):
            for dy in range(-celah, celah + 1):
                nx, ny = x + dx, y + dy
                if nx < x0 or nx > x1 or ny < y0 or ny > y1:
                    continue
                if (nx, ny) in sudah or not gelap(px[nx, ny]):
                    continue
                sudah.add((nx, ny))
                antre.append((nx, ny))

    xs = [p[0] for p in sudah]
    ys = [p[1] for p in sudah]
    tinta = {'x0': ke_mm(min(xs)), 'y0': ke_mm(min(ys)),
             'x1': ke_mm(max(xs) + 1), 'y1': ke_mm(max(ys) + 1)}
    # 'alas' dipertahankan sebagai batas aman penjepit, tapi sekarang
    # diturunkan dari tintanya sendiri, bukan dari warna latar.
    alas = {'x0': tinta['x0'] - 0.6, 'y0': tinta['y0'] - 0.6,
            'x1': tinta['x1'] + 0.6, 'y1': tinta['y1'] + 0.6}
    return {'alas': alas, 'tinta': tinta, 'dpi': dpi, 'piksel': len(sudah)}


if __name__ == '__main__':
    if len(sys.argv) < 6:
        print('pakai: kotak_barcode.py <pdf> <x0> <y0> <x1> <y1>  (mm, kolom angkanya)', file=sys.stderr)
        raise SystemExit(2)
    pdf = sys.argv[1]
    a, b, c, d = (float(v) for v in sys.argv[2:6])
    print(json.dumps(ukur(pdf, a, b, c, d)))
