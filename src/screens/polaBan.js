// =============================================================================
// LIBRARY POLA BAN — semua foto tapak yang kita punya, satu kartu per kode.
//
// Lahir dari satu pertanyaan yang tidak terjawab oleh v27.0: pencarian global
// bisa menemukan sebuah pola dan memberi tautan "Drive ↗", tapi tidak ada
// SATU TEMPAT pun untuk sekadar melihat-lihat. Orang yang tahu kodenya
// terlayani; orang yang cuma ingat "yang tapaknya kotak-kotak itu" tidak.
//
// Jadi layar ini dibuat untuk DILIHAT, bukan untuk dicari saja. Kisinya
// gambar, bukan tabel — karena yang membedakan satu pola dari yang lain adalah
// bentuknya, dan tidak ada kolom teks yang bisa menyampaikan itu.
//
// SATU KARTU = SATU KODE, bukan satu foto. Sebuah kode bisa punya tiga sudut
// (tapak, pakai pelek, tampak samping) dan menampilkannya sebagai tiga kartu
// terpisah membuat kisi penuh oleh ban yang sama. Kartunya memakai foto utama
// dari pola_foto; sudut lainnya muncul sebagai lencana kecil, dan semuanya
// terbuka waktu kartunya diklik.
// =============================================================================
import { h } from '../core/dom.js';
import { getState, setUI } from '../core/store.js';
import { t, tr } from '../i18n/index.js';
import { btn, driveLink, searchInput, gambarAman, modal, pager, pageSlice } from '../ui/components.js';
import { cariPola, gabungVarian, URUT_BENTUK } from '../core/polaFoto.js';

// Urutan sudut yang ditampilkan, dan namanya dalam bahasa orang yang membaca.
//
// Urutannya bukan abjad: tapak dulu karena itu yang dipakai label dan yang
// paling sering dicari, lalu pelek karena paling mirip ban sungguhan, lalu
// donat. Kalau sebuah kode cuma punya satu, yang itu yang muncul — tidak ada
// tempat kosong yang perlu diisi.
const BENTUK = [
  { kunci: 'tapak', label: tr({ id: 'Tapak', en: 'Tread', zh: '胎面' }) },
  { kunci: 'pelek', label: tr({ id: 'Pakai pelek', en: 'With rim', zh: '加轮辋' }) },
  { kunci: 'donat', label: tr({ id: 'Tampak samping', en: 'Side view', zh: '全侧' }) },
];
const NAMA_BENTUK = (b) => (BENTUK.find(x => x.kunci === b) || {}).label || b;

// Urutan label di atas HARUS sama dengan URUT_BENTUK di core/polaFoto.js —
// yang satu mengurutkan datanya, yang satu menamai hasilnya, dan kalau
// keduanya berbeda lencananya berurutan tidak sama dengan gambarnya. Dicek di
// sini sekali waktu modulnya dimuat, bukan dibiarkan jadi kejutan di layar.
if (BENTUK.map(x => x.kunci).join() !== URUT_BENTUK.join()) {
  console.error('polaBan: urutan BENTUK tidak cocok dengan URUT_BENTUK di core/polaFoto.js');
}

const gabung = (st) => gabungVarian(st.polaFoto, st.polaFotoVarian);

export function polaBanScreen() {
  const st = getState();
  const kueri = st.ui.polaCari || '';
  const semua = gabung(st);

  // PENCARIANNYA MEMAKAI ATURAN YANG SAMA dengan pencarian global dan artwork,
  // bukan indexOf sendiri. cariPola() tahu bahwa '+' dan '-' berarti sesuatu
  // di kode pola — CR926 dan CR926+ dua ban berbeda — dan menyalin logika itu
  // ke sini akan membuat dua tempat yang harus diperbaiki bersamaan nanti.
  //
  // Bedanya cuma ambangnya: di sini dua huruf sudah cukup, karena orang
  // sedang melihat-lihat dan hasil yang terlalu banyak masih berguna. Di
  // pencarian global ambangnya tiga, karena di sana hasilnya bercampur dengan
  // tipe lain.
  const bersih = String(kueri).replace(/[^0-9A-Za-z]/g, '');
  const hasil = bersih.length >= 2 ? cariPola(semua, kueri) : semua;

  const kotakCari = searchInput({
    id: 'pola-cari', value: kueri,
    placeholder: tr({
      id: 'Cari kode pola — AD717, CR926+, ST-100…',
      en: 'Search pattern code — AD717, CR926+, ST-100…',
      zh: '搜索花纹编号 — AD717、CR926+、ST-100…',
    }),
    onChange: v => setUI({ polaCari: String(v || ''), polaPage: 1 }),
  });
  kotakCari.style.width = '100%';

  // 24 per halaman, bukan PAGE_DEFAULT (10). Ini kisi gambar, bukan tabel:
  // sepuluh kartu meninggalkan ruang kosong di layar lebar dan memaksa orang
  // menekan "berikutnya" untuk melihat yang sebenarnya muat sekaligus.
  const PER_HALAMAN = 24;
  const potong = pageSlice(hasil, st.ui.polaPage || 1, PER_HALAMAN);

  return h('div.stack', { style: { gap: '12px' } }, [
    h('div.row.gap8', { style: { alignItems: 'center', flexWrap: 'wrap' } }, [
      h('div', { style: { flex: '1 1 320px', minWidth: '180px', maxWidth: '560px' } }, [kotakCari]),
      h('div.muted', { style: { fontSize: '13px' } }, [
        tr({
          id: `${hasil.length} pola · ${st.polaFotoVarian ? st.polaFotoVarian.length : 0} foto sudut lain`,
          en: `${hasil.length} patterns · ${st.polaFotoVarian ? st.polaFotoVarian.length : 0} extra angles`,
          zh: `${hasil.length} 个花纹 · ${st.polaFotoVarian ? st.polaFotoVarian.length : 0} 张其他角度`,
        }),
      ]),
    ]),

    hasil.length === 0 ? kosong(kueri) : h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '12px',
      },
    }, potong.items.map(p => kartu(p))),

    pager(potong, { onPage: n => setUI({ polaPage: n }) }),

    st.ui.polaBuka ? modalPola(st, semua.find(x => x.kode === st.ui.polaBuka)) : null,
  ]);
}

function kartu(p) {
  return h('div.card', {
    style: {
      padding: '8px', cursor: 'pointer', display: 'flex',
      flexDirection: 'column', gap: '6px', alignItems: 'stretch',
    },
    onClick: () => setUI({ polaBuka: p.kode }),
  }, [
    // TINGGI GAMBAR DIKUNCI, lebarnya ikut kisi. Foto tapak itu tinggi-kurus
    // (rasio sekitar 1:3) dan foto donat hampir bujur sangkar; tanpa tinggi
    // tetap, kisinya bergerigi dan matanya kehilangan baris.
    h('div', {
      style: {
        height: '150px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden', background: 'var(--bg-2)',
        borderRadius: '6px',
      },
    }, [
      gambarAman({
        src: p.urlGambar, alt: p.kode,
        style: { maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' },
      }),
    ]),
    h('div', { style: { fontWeight: '600', fontSize: '13px', textAlign: 'center' } }, [p.kode]),
    p.varian.length
      ? h('div.row.gap4', { style: { justifyContent: 'center', flexWrap: 'wrap' } },
          p.varian.map(v => h('span', {
            style: {
              fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
              background: 'var(--bg-2)', color: 'var(--text-2)', whiteSpace: 'nowrap',
            },
          }, [NAMA_BENTUK(v.bentuk)])))
      : h('div.muted', { style: { fontSize: '10px', textAlign: 'center' } }, [
          tr({ id: '1 sudut', en: '1 angle', zh: '1 个角度' }),
        ]),
  ]);
}

function modalPola(st, p) {
  if (!p) return null;
  const close = () => setUI({ polaBuka: null });
  // Foto utama ikut masuk daftar sudut, di depan. Dia BUKAN kasus khusus di
  // mata orang yang melihat — cuma satu foto lagi dari ban yang sama — dan
  // memperlakukannya berbeda di sini berarti sudut yang kebetulan jadi utama
  // tampil lebih besar tanpa alasan.
  const semuaSudut = [{ bentuk: null, urlGambar: p.urlGambar, urlLihat: p.urlLihat }].concat(p.varian);
  return modal({
    title: p.kode,
    onClose: close,
    body: h('div.stack', { style: { gap: '12px' } }, [
      h('div', {
        style: {
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(semuaSudut.length, 3)}, 1fr)`, gap: '12px',
        },
      }, semuaSudut.map(v => h('div.stack', { style: { gap: '6px', alignItems: 'center' } }, [
        h('div', {
          style: {
            height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', background: 'var(--bg-2)', borderRadius: '6px', width: '100%',
          },
        }, [
          gambarAman({
            src: v.urlGambar, alt: p.kode,
            style: { maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' },
          }),
        ]),
        h('div.muted', { style: { fontSize: '12px' } }, [
          v.bentuk ? NAMA_BENTUK(v.bentuk) : tr({ id: 'Foto utama', en: 'Main photo', zh: '主图' }),
        ]),
        v.urlLihat ? driveLink(v.urlLihat) : null,
      ]))),
    ]),
    footer: h('div.row.gap8', [btn(t('close'), { onClick: close })]),
  });
}

function kosong(kueri) {
  return h('div.card', { style: { padding: '24px', textAlign: 'center' } }, [
    h('div.muted', {}, [
      String(kueri || '').trim()
        ? tr({
            id: `Tidak ada pola yang cocok dengan "${kueri}".`,
            en: `No pattern matches "${kueri}".`,
            zh: `没有匹配 "${kueri}" 的花纹。`,
          })
        // Kosong TANPA kueri berarti tabelnya belum terisi, bukan pencarian
        // yang gagal. Dua keadaan yang berbeda, dan menyamakan pesannya akan
        // membuat orang mengetik ulang kodenya berkali-kali.
        : tr({
            id: 'Belum ada foto pola ban. Tabel pola_foto masih kosong.',
            en: 'No tyre pattern photos yet. The pola_foto table is empty.',
            zh: '还没有轮胎花纹照片。pola_foto 表为空。',
          }),
    ]),
  ]);
}
