// ---------------------------------------------------------------------------
// PO PEMASOK — satu-satunya layar yang dilihat akun dari LUAR perusahaan.
//
// Isinya PO miliknya sendiri, dan untuk tiap barisnya: artwork label yang
// harus dicetak. Itu seluruh alasan akun pemasok ada.
//
// YANG TIDAK ADA DI SINI, DAN KENAPA
//   - Tidak ada tombol tulis apa pun. CAPS.supplier kosong, jadi can()
//     menjawab false untuk kapabilitas apa pun — termasuk yang baru ditulis
//     besok. Dan tidak ada satu pun policy INSERT/UPDATE/DELETE untuk peran
//     ini di basis data, jadi tombol yang entah bagaimana muncul pun tidak
//     akan menghasilkan apa-apa.
//   - Tidak ada daftar pemasok, harga pemasok lain, komplain, atau
//     perpustakaan design penuh. Bukan disembunyikan — memang TIDAK TERKIRIM.
//     RLS di server cuma mengirim PO dengan supplier_id miliknya dan design
//     yang ERP-nya dipakai di PO itu (lihat supabase/sql/rls_peran_pemasok.sql).
//     Layar ini menggambar apa yang sampai; dia bukan penjaganya.
//
// GAMBAR ARTWORK ADALAH ACUAN, BUKAN BERKAS CETAK — dan itu ditulis di layar,
// bukan diasumsikan. `thumb` lebarnya 400px; dicetak selebar 85mm itu sekitar
// 120 dpi, cukup untuk memastikan "ini kah designnya?" dan tidak cukup untuk
// apa pun yang keluar dari mesin cetak. Pemasok yang mengira ini berkas
// produksi akan mencetak label buram untuk seluruh pesanan, dan yang pertama
// tahu adalah gudang saat barangnya datang. Maka tautan ke berkas aslinya
// ditaruh persis di sebelah gambarnya.
//
// SATU ERP = SATU DESIGN. Aturan pemiliknya, dan di layar ini aturan itu
// ditegakkan secara terlihat: kalau satu ERP ternyata menunjuk lebih dari satu
// kartu, yang digambar BUKAN salah satunya melainkan kotak merah yang
// menyebutkan semuanya. Memilih diam-diam berarti mengirim artwork yang salah
// ke pemasok, dan itu baru ketahuan setelah labelnya tercetak ribuan lembar.
// ---------------------------------------------------------------------------
import { h } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { card, badge, btn, pager, pageSlice, PAGE_DEFAULT } from '../ui/components.js';
import { num, fmtDate } from '../core/format.js';
import { tr } from '../i18n/index.js';
import { writeWorkbook } from '../core/xlsx.js';

// Kartu design untuk satu baris PO. Mengembalikan BENTUKNYA, bukan cuma
// kartunya, supaya pemanggil tidak perlu menebak-nebak kenapa hasilnya null.
function cariDesign(erp) {
  const kode = String(erp || '').trim();
  if (!kode) return { jenis: 'kosong' };
  const semua = (getState().designs || []).filter(d => String(d.erp || '').trim() === kode);
  if (!semua.length) return { jenis: 'belum-ada' };
  if (semua.length > 1) return { jenis: 'ganda', daftar: semua };
  return { jenis: 'ada', d: semua[0] };
}

function kotakArtwork(hasil) {
  const bingkai = (isi, warna) => h('div', {
    style: {
      border: '1px solid ' + (warna || 'var(--border)'), borderRadius: '8px',
      background: 'var(--surface2)', minHeight: '120px', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center',
    },
  }, isi);

  if (hasil.jenis === 'ada') {
    const d = hasil.d;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
      bingkai(d.thumb
        ? h('img', {
            src: d.thumb, alt: d.spec || d.erp,
            style: { maxWidth: '100%', maxHeight: '190px', objectFit: 'contain', borderRadius: '4px' },
          })
        : h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
            id: 'Gambar belum tersedia', en: 'No preview available', zh: '暂无预览',
          }))),
      h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.5 } }, [
        d.market ? h('span', [badge(d.market, 'gray'), ' '] ) : null,
        d.ver ? h('span', tr({ id: `Versi ${d.ver}`, en: `Version ${d.ver}`, zh: `版本 ${d.ver}` })) : null,
        d.updated ? h('span', ' · ' + fmtDate(d.updated)) : null,
      ]),
      // Tautan ke berkas ASLI. Kalimat di bawahnya bukan basa-basi: lihat
      // catatan di kepala berkas ini.
      d.driveUrl && !String(d.driveUrl).startsWith('drive-')
        ? h('div', [
            h('a.link', { href: d.driveUrl, target: '_blank', rel: 'noopener', style: { fontSize: '11px', fontWeight: 700 } },
              tr({ id: 'Buka berkas cetak ↗', en: 'Open print file ↗', zh: '打开印刷文件 ↗' })),
            h('div', { style: { fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' } }, tr({
              id: 'Gambar di atas acuan visual — cetak dari berkas ini.',
              en: 'The image above is a visual reference — print from this file.',
              zh: '上方图片仅供核对 — 请使用此文件印刷。',
            })),
          ])
        : h('div', { style: { fontSize: '10px', color: 'var(--st-amber-tx)' } }, tr({
            id: 'Berkas cetak belum diunggah — minta ke MTI.',
            en: 'Print file not uploaded yet — ask MTI for it.',
            zh: '印刷文件尚未上传 — 请向 MTI 索取。',
          })),
    ]);
  }

  if (hasil.jenis === 'ganda') {
    return bingkai(h('div', { style: { fontSize: '11px', color: 'var(--st-red-tx)', lineHeight: 1.6 } }, [
      h('div', { style: { fontWeight: 800 } }, tr({
        id: `ADA ${hasil.daftar.length} DESIGN UNTUK ERP INI`,
        en: `${hasil.daftar.length} DESIGNS FOR THIS ERP`,
        zh: `此 ERP 有 ${hasil.daftar.length} 个设计`,
      })),
      h('div', { style: { marginTop: '4px' } }, tr({
        id: 'Jangan dicetak dulu — tanya MTI yang mana.',
        en: 'Do not print yet — ask MTI which one.',
        zh: '请先不要印刷 — 请向 MTI 确认。',
      })),
    ]), 'var(--st-red-tx)');
  }

  return bingkai(h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
    id: 'Design belum ada di sistem', en: 'Artwork not in the system yet', zh: '系统中尚无设计稿',
  })));
}

function barisItem(it) {
  const hasil = cariDesign(it.erp);
  return h('div.p-keep', {
    style: {
      display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(220px,.75fr)', gap: '16px',
      padding: '14px 0', borderTop: '1px solid var(--border)', alignItems: 'start',
    },
  }, [
    h('div', { style: { minWidth: 0 } }, [
      h('div.mono', { style: { fontSize: '12.5px', fontWeight: 800 } }, it.erp || '—'),
      h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '3px', lineHeight: 1.5 } }, it.d || it.cn || '—'),
      it.d && it.cn ? h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' } }, it.cn) : null,
      h('div', { style: { marginTop: '7px', fontSize: '12px' } }, [
        h('span', { style: { color: 'var(--text-3)' } }, tr({ id: 'Jumlah: ', en: 'Quantity: ', zh: '数量：' })),
        h('span.mono', { style: { fontWeight: 800 } }, num(it.qty || 0)),
        h('span', { style: { color: 'var(--text-3)' } }, ' ' + (it.unit || '')),
      ]),
    ]),
    kotakArtwork(hasil),
  ]);
}

async function unduhExcel(po) {
  const aoa = [
    ['PO', po.no],
    ['Contract', po.contract || '-'],
    [tr({ id: 'Tanggal', en: 'Date', zh: '日期' }), fmtDate(po.createdAt)],
    [],
    ['ERP', tr({ id: 'Deskripsi', en: 'Description', zh: '描述' }), '中文', tr({ id: 'Jumlah', en: 'Quantity', zh: '数量' }),
     tr({ id: 'Satuan', en: 'Unit', zh: '单位' }), 'Market', tr({ id: 'Versi design', en: 'Design version', zh: '设计版本' }),
     tr({ id: 'Berkas cetak', en: 'Print file', zh: '印刷文件' })],
  ];
  const tautan = [];
  (po.items || []).forEach((it, i) => {
    const hasil = cariDesign(it.erp);
    const d = hasil.jenis === 'ada' ? hasil.d : null;
    const ket = hasil.jenis === 'ada'
      ? (d.driveUrl && !String(d.driveUrl).startsWith('drive-') ? 'Drive' : '-')
      : hasil.jenis === 'ganda' ? tr({ id: 'PERLU KONFIRMASI', en: 'NEEDS CONFIRMATION', zh: '需确认' })
      : tr({ id: 'belum ada', en: 'not available', zh: '暂无' });
    aoa.push([it.erp || '', it.d || '', it.cn || '', Number(it.qty) || 0, it.unit || '',
              d ? (d.market || '') : '', d ? (d.ver || '') : '', ket]);
    if (d && d.driveUrl && !String(d.driveUrl).startsWith('drive-')) {
      // Baris data dimulai di baris 7 (1-indeks), kolom H.
      tautan.push({ sheet: 'PO', cell: 'H' + (7 + i), url: d.driveUrl, text: 'Drive' });
    }
  });
  await writeWorkbook(`${String(po.no).replace(/\//g, '-')}.xlsx`,
    [{ name: 'PO', aoa, cols: [{ wch: 18 }, { wch: 52 }, { wch: 34 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 13 }, { wch: 14 }] }],
    tautan);
  toast({ id: `${po.no} diunduh`, en: `${po.no} downloaded`, zh: `${po.no} 已下载` });
}

export function poPemasokScreen() {
  const st = getState();
  // Daftarnya APA ADANYA dari store. Tidak ada penyaringan per pemasok di
  // sini, dan itu disengaja: yang menyaring adalah RLS, dan menyaring ulang
  // di klien cuma melahirkan kesan bahwa klien ikut menjaga — sehingga
  // seseorang suatu hari melonggarkan yang di server karena "toh disaring di
  // layar". Kalau baris milik orang lain sampai muncul di sini, yang rusak
  // policy-nya, dan layar ini memang harus memperlihatkannya.
  const daftar = (st.pos || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const selId = st.ui.poPemasokSel || (daftar[0] && daftar[0].id);
  const po = daftar.find(p => p.id === selId) || daftar[0];
  const hal = pageSlice(daftar, st.ui.poPemasokPage || 1, Number(st.ui.poPemasokSize) || PAGE_DEFAULT);

  if (!daftar.length) {
    return card([
      h('div.card-head', [h('div.card-title', tr({ id: 'PO Saya', en: 'My POs', zh: '我的采购单' }))]),
      h('div', { style: { padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12.5px', lineHeight: 1.6 } }, tr({
        id: 'Belum ada PO yang terbit untuk akun ini.',
        en: 'No purchase orders have been issued for this account yet.',
        zh: '尚无为此账号开具的采购单。',
      })),
    ]);
  }

  const rel = card([
    h('div.card-head', [
      h('div.card-title', tr({ id: 'PO Saya', en: 'My POs', zh: '我的采购单' })),
      badge(String(daftar.length), 'gray'),
    ]),
    h('div', { style: { padding: '10px 12px' } }, [
      h('div', hal.items.map(p => h('div', {
        style: {
          padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
          background: p.id === (po && po.id) ? 'var(--surface2)' : 'transparent',
          border: '1px solid ' + (p.id === (po && po.id) ? 'var(--border-strong)' : 'transparent'),
        },
        onClick: () => setUI({ poPemasokSel: p.id }),
      }, [
        h('div.mono', { style: { fontSize: '12px', fontWeight: 800 } }, p.no),
        h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' } },
          `${fmtDate(p.createdAt)} · ${(p.items || []).length} ${tr({ id: 'baris', en: 'lines', zh: '行' })}`),
      ]))),
      pager(hal, {
        onPage: n => setUI({ poPemasokPage: n }),
        onSize: n => setUI({ poPemasokSize: n, poPemasokPage: 1 }),
      }),
    ]),
  ]);

  const isi = po ? card([
    h('div.card-head.lengket', [
      h('div.grow', [
        h('div.card-title.mono', po.no),
        h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } },
          `${fmtDate(po.createdAt)}${po.contract ? ' · ' + po.contract : ''}${po.delivery ? ' · ' + po.delivery : ''}`),
      ]),
      h('div.mla', btn(tr({ id: 'Unduh Excel', en: 'Download Excel', zh: '下载 Excel' }),
        { iconName: 'download', sm: true, onClick: () => unduhExcel(po) })),
    ]),
    h('div', { style: { padding: '12px 16px 16px' } }, [
      h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', paddingBottom: '8px' } }, tr({
        id: 'Periksa artwork tiap baris sebelum mencetak. Kalau ada yang tidak cocok dengan yang Anda pegang, hubungi MTI dulu.',
        en: 'Check the artwork on every line before printing. If any of it differs from what you hold, contact MTI first.',
        zh: '印刷前请核对每一行的设计稿。如与您持有的版本不符，请先联系 MTI。',
      })),
      ...(po.items || []).map(barisItem),
    ]),
  ]) : null;

  return h('div', {
    style: { display: 'grid', gridTemplateColumns: 'minmax(230px,300px) minmax(0,1fr)', gap: '16px', alignItems: 'start' },
  }, [rel, isi]);
}
