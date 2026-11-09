# JALUR SULIH: menyunting artwork yang SUDAH ADA, bukan merakitnya ulang.
#
# Untuk keluarga tanpa templat -- dan untuk OEM, yang tata letaknya milik
# PELANGGAN dan berbeda tiap merek -- merakit dari templat bukan jalan yang
# benar. Yang berubah antar produk cuma segelintir medan; sisanya (logo,
# peringatan, warna, tata letak) harus tetap PERSIS seperti aslinya.
#
# Berlaku untuk artwork berteks MAUPUN yang teksnya sudah jadi kurva, karena
# koordinatnya diukur dari GEOMETRINYA, bukan dibaca dari teksnya.
#
# Ukuran huruf DIPASKAN ke kotaknya, tidak ditebak: diperkecil sampai muat.
# Kalau sebuah medan tidak muat pada ukuran terkecil yang masih terbaca, itu
# DILAPORKAN, bukan dipaksakan -- nilai yang terpotong di label lebih
# berbahaya daripada proof yang ditolak.
import pymupdf, sys, json
PT = 72/25.4

def _pas(pg, rect, teks, font, warna, rotate, maks):
    uk = maks
    while uk >= 3.0:
        sisa = pg.insert_textbox(rect, teks, fontname=font, fontsize=uk,
                                 color=warna, align=0, rotate=rotate)
        if sisa >= 0:
            return uk
        uk -= 0.5
    return None

# PENANDA "ARTWORK OTOMATIS" DITULIS DI EMPAT TEMPAT, bukan satu.
#
# Berkasnya bisa lepas dari basis datanya -- diunduh, dikirim lewat chat,
# disimpan ulang -- dan begitu lepas, kolom designs.asal_artwork tidak ikut.
# Yang tertinggal cuma berkasnya sendiri, dan di titik itu tidak ada apa pun
# yang membedakannya dari artwork asli kecuali apa yang tertulis DI DALAMNYA.
#
# Jadi: (1) tanda air yang terlihat, (2) metadata PDF, (3) kata kunci PDF,
# dan (4) kolom di basis data (diurus pemanggilnya). Tiga yang pertama ikut
# ke mana pun berkasnya pergi.
def sulih(sumber, tujuan, gantian, tandai=True, dari=None, erp=None):
    d = pymupdf.open(sumber); pg = d[0]
    lapor = []
    for g in gantian:
        r = pymupdf.Rect(g['x0']*PT, g['y0']*PT, g['x1']*PT, g['y1']*PT)
        pg.draw_rect(r, color=None, fill=tuple(g.get('latar', (1, 1, 1))), overlay=True)
        rot = 90 if g.get('putar') else 0
        # kotak diperlonggar sedikit ke arah panjangnya supaya huruf tidak terjepit
        kerja = pymupdf.Rect(r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1)
        maks = (kerja.width if g.get('putar') else kerja.height) * 1.05
        uk = _pas(pg, kerja, g['nilai'], g.get('font', 'hebo'),
                  tuple(g.get('warna', (0, 0, 0))), rot, maks)
        lapor.append({'medan': g.get('catatan', '?'), 'nilai': g['nilai'],
                      'ukuran_pt': uk, 'muat': uk is not None})
    if tandai:
        w, h = pg.rect.width, pg.rect.height
        baris = 'ARTWORK OTOMATIS - DIBUAT MESIN, BELUM DIPERIKSA MANUSIA'
        if dari: baris += '  |  dari: ' + str(dari)
        pg.insert_textbox(pymupdf.Rect(0, h-26, w, h-6), baris,
                          fontname='hebo', fontsize=8.5, color=(0.48, 0.25, 0.89), align=1)
        d.set_metadata({
            'title':    'ARTWORK OTOMATIS' + (' - ' + str(erp) if erp else ''),
            'subject':  'Artwork dibuat mesin, BUKAN artwork asli. Belum diperiksa manusia '
                        'dan belum boleh dipakai mencetak.',
            'keywords': 'artwork-otomatis; bukan-artwork-asli; belum-diperiksa'
                        + ('; dari=' + str(dari) if dari else '')
                        + ('; erp=' + str(erp) if erp else ''),
            'author':   'MTI Purchasing Portal (otomatis)',
            'creator':  'tools/label/sulih.py',
        })
    d.save(tujuan)
    return lapor

if __name__ == '__main__':
    lap = sulih(sys.argv[1], sys.argv[2], json.load(open(sys.argv[3])))
    for l in lap:
        print('  %-34s %-22s %s' % (l['medan'], l['nilai'],
              ('%.1f pt' % l['ukuran_pt']) if l['muat'] else 'TIDAK MUAT'))
