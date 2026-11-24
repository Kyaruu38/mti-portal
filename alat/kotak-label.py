"""Mencari KOTAK LABEL di dalam lembar artwork, dari garis keyline magenta.

KENAPA KEYLINE, BUKAN TEPI HALAMAN. Artwork cetak selalu memuat hal di LUAR
labelnya: panah ukuran, kotak approval percetakan ("CUSTOMER / Prepared /
Checked / Approved"), tanda potong. Memotong aset dengan acuan halaman ikut
membawa semua itu, dan hasilnya berbeda tiap berkas karena letak labelnya di
lembar memang berpindah.

Keyline-nya justru yang menandai batas label. Warnanya seragam karena itu
warna TEKNIS, bukan warna desain: diukur (236, 0, 140) dan nilainya SAMA
PERSIS di templat PT dan BX, dua tata letak yang sama sekali berbeda.

MENGUJI DIRINYA SENDIRI. Artwork mencantumkan ukurannya sendiri sebagai teks
("261 mm", "79 mm"). Kotak yang ditemukan di sini menghasilkan angka yang
sama tanpa pernah membaca teks itu — jadi kalau suatu hari keduanya berbeda,
yang salah ketahuan tanpa ada yang harus memeriksanya dengan mata.
"""
import json
import sys

from PIL import Image

KEYLINE = (236, 0, 140)
TOLERANSI = 45


def kotak_label(path, warna=KEYLINE, toleransi=TOLERANSI):
    im = Image.open(path).convert('RGB')
    px = im.load()
    W, H = im.size
    tr, tg, tb = warna
    xs, ys = [], []
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if abs(r - tr) < toleransi and abs(g - tg) < toleransi and abs(b - tb) < toleransi:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return {'x0': min(xs), 'y0': min(ys), 'x1': max(xs), 'y1': max(ys), 'lebar_px': W, 'tinggi_px': H}


def warna_di(path, titik):
    """Mengambil warna pada titik-titik PECAHAN kotak label.

    Pecahan, bukan piksel mutlak: itu yang membuat satu definisi berlaku di
    semua merek dengan templat yang sama, karena letak labelnya di lembar
    berpindah tapi tata letak DI DALAM labelnya tidak.
    """
    im = Image.open(path).convert('RGB')
    px = im.load()
    k = kotak_label(path)
    if not k:
        return {}
    lebar = k['x1'] - k['x0']
    tinggi = k['y1'] - k['y0']
    out = {}
    for nama, (fx, fy) in titik.items():
        x = min(k['x1'] - 1, max(k['x0'], int(k['x0'] + fx * lebar)))
        y = min(k['y1'] - 1, max(k['y0'], int(k['y0'] + fy * tinggi)))
        r, g, b = px[x, y]
        out[nama] = {'rgb': [r, g, b], 'hex': '#%02X%02X%02X' % (r, g, b)}
    return out


if __name__ == '__main__':
    raster = sys.argv[1]
    dpi = float(sys.argv[2]) if len(sys.argv) > 2 else 110.0
    titik = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    k = kotak_label(raster)
    if not k:
        print(json.dumps({'ok': False, 'sebab': 'keyline magenta tidak ditemukan'}))
        sys.exit(1)
    mm = 25.4 / dpi
    print(json.dumps({
        'ok': True,
        'kotak_px': k,
        'dpi': dpi,
        'label_mm': {'lebar': round((k['x1'] - k['x0']) * mm, 1), 'tinggi': round((k['y1'] - k['y0']) * mm, 1)},
        'lembar_mm': {'lebar': round(k['lebar_px'] * mm, 1), 'tinggi': round(k['tinggi_px'] * mm, 1)},
        'warna': warna_di(raster, titik),
    }, ensure_ascii=False))


def pita_kepala(path, kotak=None, bagian_min=0.03, bagian_maks=0.34):
    """Mencari PITA KEPALA: pita warna merek di bagian atas label.

    Ketiga artwork yang bisa diperiksa langsung — WESTLAKE PT/TBR, WESTLAKE
    BX/TBR, GOODRIDE PT/ST — sama-sama menaruh logo mereknya di dalam satu
    pita warna penuh di tepi ATAS label. Itu bukan kebetulan tata letak; itu
    tempat logo diletakkan supaya terbaca dari jauh.

    DICARI LEWAT PERGANTIAN WARNA DOMINAN, bukan lewat "bukan putih".
    Percobaan pertama memakai bagian piksel yang bukan putih, dan itu gagal
    tepat di WESTLAKE PT/TBR: badan labelnya oranye PENUH, jadi tiap baris
    nilainya 1 dari atas sampai bawah dan pitanya tidak pernah berhenti.
    Warna dominan per baris membedakan keduanya: hijau tua di pita kepala,
    oranye di badan, dan batasnya adalah baris pertama yang berganti.

    Dikembalikan None kalau pitanya tidak masuk akal — menebak letak logo
    lebih buruk daripada mengaku tidak tahu, karena logo yang salah potong
    tetap terlihat seperti logo.
    """
    from collections import Counter
    im = Image.open(path).convert('RGB')
    px = im.load()
    k = kotak or kotak_label(path)
    if not k:
        return None
    x0, y0, x1, y1 = k['x0'], k['y0'], k['x1'], k['y1']
    lebar, tinggi = x1 - x0, y1 - y0
    if lebar < 10 or tinggi < 10:
        return None

    langkah = max(1, lebar // 160)

    def ember(y):
        c = Counter()
        for x in range(x0 + 2, x1 - 2, langkah):
            r, g, b = px[x, y]
            # Dibulatkan ke kelipatan 16: anti-alias membuat satu bidang
            # warna jadi puluhan nilai yang berbeda tipis, dan tanpa
            # pembulatan tidak ada warna yang pernah jadi dominan.
            c[(r // 16, g // 16, b // 16)] += 1
        return c

    def dominan(y):
        c = ember(y)
        return c.most_common(1)[0][0] if c else None

    def bagian_badan(y, w):
        c = ember(y)
        n = sum(c.values())
        return (c.get(w, 0) / n) if n else 0.0

    mulai = y0 + 3
    w0 = dominan(mulai)
    if w0 is None:
        return None
    # Putih di baris pertama berarti labelnya memang tidak berpita kepala.
    if all(v >= 14 for v in w0):
        return None

    # BATASNYA WARNA BADAN, BUKAN WARNA PITANYA SENDIRI.
    #
    # Percobaan sebelumnya memanjangkan pita selama warna dominannya SAMA
    # dengan baris pertama, dan itu kependekan di BX/TBR: logo WEST LAKE-nya
    # oranye dan selebar hampir seluruh label, jadi di baris-baris yang
    # melewati logo warna dominannya berganti jadi oranye dan pitanya
    # berhenti di tengah logonya sendiri -- 8 mm, bukan 21 mm.
    #
    # Yang menandai akhir pita bukan hilangnya warna pita, melainkan
    # munculnya warna BADAN. Jadi badannya diukur dulu di tengah label, dan
    # pitanya memanjang selama warnanya belum menjadi warna badan itu.
    # PITANYA DIUKUR TERHADAP DIRINYA SENDIRI, bukan terhadap satu angka tetap.
    #
    # Dua percobaan sebelumnya gagal di dua artwork yang berbeda, dan
    # dua-duanya gagal DIAM -- angkanya terlihat wajar, logonya yang salah
    # potong:
    #
    #   "berhenti saat warna dominan berganti" -> GOODRIDE PT/ST kependekan
    #   10 mm, karena hurufnya PUTIH di atas hijau dan putih itu juga warna
    #   badan labelnya; begitu baris memotong tulisan GOODRIDE, pitanya
    #   berhenti di tengah logonya sendiri.
    #
    #   "berhenti saat warna badan menguasai 70% baris" -> WESTLAKE PT/TBR
    #   tidak pernah berhenti, karena badannya oranye hanya 60% lebar baris:
    #   sisanya bar hijau di kiri dan blok peringatan putih di kanan.
    #
    # Yang tidak berubah di ketiganya: baris pertama pita DIKUASAI warna
    # pitanya, dan baris badan pertama tidak. Jadi ukurannya relatif --
    # pita berlanjut selama warna pitanya masih memegang sebagian besar
    # porsi yang dipegangnya di baris pertama. Huruf setebal apa pun tidak
    # cukup untuk menjatuhkannya sampai sepertiga.
    w0_bagian = bagian_badan(mulai, w0)
    batas = w0_bagian * 0.25
    y = mulai
    while y < y1 - 3 and bagian_badan(y, w0) >= batas:
        y += 1
    bagian = (y - y0) / tinggi
    if bagian < bagian_min or bagian > bagian_maks:
        return None
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y, 'warna_pita': [v * 16 + 8 for v in w0]}
