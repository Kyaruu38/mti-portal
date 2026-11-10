// ---------------------------------------------------------------------------
// ARTWORK OTOMATIS — satu layar, satu alur, sesedikit mungkin kata.
//
// VERSI SEBELUMNYA TERLALU RAMAI DAN ITU BUKAN SOAL SELERA. Dua kartu, empat
// paragraf penjelasan dan dua lencana, untuk sesuatu yang intinya tiga
// langkah: ketik ERP, pilih berkas artworknya, selesai. Orangnya menekan
// tombol yang salah dua kali berturut-turut lalu bertanya kenapa artworknya
// hitam-putih — layar yang perlu dijelaskan sesudahnya adalah layar yang
// gagal menjelaskan dirinya sendiri.
//
// Sekarang: satu kartu, satu alur. Hal yang tidak dibutuhkan 90% waktu —
// lembar periksa data — turun jadi satu tautan kecil di kaki.
//
// BEBAN YANG DULU DILEMPAR KE ORANGNYA, SEKARANG DIBANTU. Artwork sumbernya
// harus dibuka dari disk, karena Drive memblokir pengambilan byte PDF dari
// halaman web — diuji dari asal portal yang sebenarnya, dan satu-satunya
// jalur yang lolos mengembalikan PNG 1024 px, sekitar 88 dpi untuk A4. Tapi
// basis data TAHU artwork mana yang benar untuk ERP itu (designs.drive_url),
// jadi tautannya ditampilkan langsung. Orangnya tidak perlu mencari.
// ---------------------------------------------------------------------------
import { h, clear } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { badge, btn, field, searchInput, driveLink } from '../ui/components.js';
import { pilihTemplat } from '../label/templat.js';
import { isiTemplat, isiMedan } from '../label/peta.js';
import * as dasar from '../label/dasar.js';

const muatTemplat = (berkas) =>
  fetch(new URL('../label/templat/' + berkas, import.meta.url)).then(r => r.json());

function unduh(bytes, nama) {
  const b = new Blob([bytes], { type: 'application/pdf' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

const samaErp = (a, b) => String(a || '').trim() === String(b || '').trim();

// Baris items memakai nama JS (loadSpeed); peta memakai nama kolom basis data
// (load_speed). Dialihkan di sini, di satu tempat, supaya peta tetap bisa
// diuji dengan baris yang dibaca langsung dari basis data.
function keKolom(it) {
  if (!it) return null;
  return {
    erp: it.erp, size: it.size, pattern: it.pattern, load_speed: it.loadSpeed,
    ply: it.ply, ply_block: it.plyBlock, tt_tl: it.ttTl, ms: it.ms,
    ean: it.ean, npb1: it.npb1, npb3: it.npb3, sni_no: it.sniNo,
    rr: it.rr, wet_grip: it.wetGrip, noise: it.noise, noise_class: it.noiseClass,
  };
}

export function labelArtworkScreen() {
  const st = getState();
  const ui = st.ui || {};
  const erp = ui.artworkErp || '';
  const it = (st.items || []).find(x => samaErp(x.erp, erp));
  const design = (st.designs || []).find(x => samaErp(x.erp, erp));
  const baris = keKolom(it);
  const pilihan = it ? pilihTemplat({ nama: it.nameEn || it.spec, spec: it.spec, market: it.market }) : null;

  const wrap = h('div.stack', { style: { gap: '12px' } });

  wrap.appendChild(h('div.card', { style: { padding: '14px' } },
    field(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编码' }),
      // searchInput, bukan inputEl: mount() tidak punya diffing, jadi onInput
      // yang memanggil setUI mengganti <input> yang sedang diketik sebelum
      // huruf kedua mendarat.
      searchInput({
        id: 'artwork-erp', value: erp, mono: true, placeholder: '0105045809703ID',
        onChange: v => setUI({ artworkErp: String(v || '').trim() }),
      }))));

  if (!erp) return wrap;

  if (!it) {
    wrap.appendChild(h('div.card', { style: { padding: '14px', color: 'var(--danger)' } },
      tr({ id: `ERP ${erp} tidak ada di master item.`,
           en: `ERP ${erp} is not in the item master.`,
           zh: `ERP ${erp} 不在物料主数据中。` })));
    return wrap;
  }

  const kartu = h('div.card', { style: { padding: '14px' } });

  // Baris identitas: siapa ini, templat apa, dan artwork aslinya di mana.
  kartu.appendChild(h('div.row.gap8', { style: { alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' } }, [
    h('span.mono', { style: { fontSize: '12.5px', fontWeight: 700 } }, it.erp),
    it.brand ? badge(it.brand, 'blue') : null,
    pilihan && pilihan.ok ? badge(pilihan.kunci, 'gray') : null,
    pilihan && pilihan.ok && pilihan.perluPeriksaLebih
      ? badge(tr({ id: 'sampel baru 1 merek', en: 'only 1 brand sampled', zh: '仅取样一个品牌' }), 'amber')
      : null,
    h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } }, it.spec || ''),
    design && design.driveUrl
      ? h('span.mla', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } },
            tr({ id: 'artwork aslinya:', en: 'its artwork:', zh: '其图稿：' })),
          driveLink(design.driveUrl),
        ])
      : null,
  ]));

  if (!pilihan.ok) {
    kartu.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--danger)' } }, pilihan.sebab));
    wrap.appendChild(kartu);
    return wrap;
  }

  // ARTWORK DASAR: dipilih SEKALI per merek+keluarga, sesudah itu tidak
  // ditanyakan lagi. Inilah yang membuat layar ini benar-benar "ketik ERP ->
  // artwork keluar" dan bukan "pilih berkas lagi, lagi, dan lagi".
  const kunciDasar = dasar.kunciDasar(pilihan.kunci, it.brand);

  const barisDasar = h('div', { style: { fontSize: '12px', marginBottom: '6px' } });
  const masukan = h('input', { type: 'file', accept: 'application/pdf', style: { fontSize: '12px' } });
  const lapor = h('div', { style: { fontSize: '11.5px', marginTop: '10px' } });

  async function jalankan(buf, namaBerkas, { simpanDasar = false } = {}) {
    clear(lapor);
    lapor.appendChild(h('div', { style: { color: 'var(--text-3)' } },
      tr({ id: 'Membuat artworknya…', en: 'Building the artwork…', zh: '正在生成图稿…' })));
    try {
      const [{ itemTeks, renderThumb }, sp, { sulih }] = await Promise.all([
        import('../parsers/pdf.js'), import('../label/sumberPdf.js'), import('../label/sulih.js'),
      ]);
      const t = await muatTemplat(pilihan.berkas);
      const { items, tinggiPt } = await itemTeks(buf.slice(0));
      const sumber = sp.keMedanSumber(items, tinggiPt);
      if (!sumber.length) {
        throw new Error(tr({
          id: 'Berkas ini tidak punya lapisan teks — hurufnya sudah jadi kurva. Jalur ini butuh berkas yang teksnya masih teks.',
          en: 'This file has no text layer — its letters are outlined curves. This path needs a file whose text is still text.',
          zh: '该文件没有文字层 — 其字符已转为曲线。此路径需要文字仍为文字的文件。',
        }));
      }
      const j = sp.cariJangkar(sumber, pilihan.berkas);
      if (!j.ok) throw new Error(j.sebab);
      const cocok = sp.cocokkanMedan(t, sumber, j);

      const gantian = [];
      const lewat = [];
      for (const c of cocok) {
        if (!c.ketemu) { lewat.push(`${c.k} — tidak ketemu di artworknya`); continue; }
        const med = t.medan.find(m => m.k === c.k);
        const nilai = isiMedan(med, baris);
        if (!nilai.nilai) { lewat.push(`${c.k} — ${nilai.sebab || 'data kosong'}`); continue; }
        if (nilai.nilai === c.lama) continue;
        // Posisinya benar belum berarti isinya sebanding -- lihat PENJAGA.
        const tolak = sp.bolehGanti(c.k, c.lama, nilai.nilai);
        if (tolak) { lewat.push(`${c.k} — ${tolak}`); continue; }
        gantian.push({ ...c.kotak, nilai: nilai.nilai, putar: c.putar, arah: c.arah, tm: c.tm, catatan: c.k, lama: c.lama });
        // Salinan ganda dicari lewat TEKS LAMAnya: satu yang terlewat berarti
        // label membawa dua nilai yang bertentangan sambil terlihat benar.
        for (const sal of sp.cariSalinan(sumber, c.lama, c.kotak)) {
          gantian.push({ ...sal.kotak, nilai: nilai.nilai, putar: sal.putar, arah: sal.arah, tm: sal.tm, catatan: c.k + ' (salinan)' });
        }
      }

      const r = await sulih(buf.slice(0), gantian, { erp, dari: `${namaBerkas} · ${pilihan.berkas}` });

      // ARTWORK DASARNYA BARU DISIMPAN SESUDAH BERHASIL DIPAKAI, bukan saat
      // dipilih. Berkas yang hurufnya sudah jadi kurva, atau yang jangkarnya
      // tidak ketemu, akan gagal di langkah-langkah di atas -- menyimpannya
      // sebagai dasar berarti tiap ERP berikutnya di merek ini gagal otomatis
      // tanpa ada yang pernah menekan apa pun.
      if (simpanDasar && kunciDasar) {
        try { await dasar.simpan(pilihan.kunci, it.brand, { bytes: buf, nama: namaBerkas, erpAsal: erp }); } catch { /* cache gagal bukan alasan membatalkan artworknya */ }
      }

      // ---- STASIUN PERIKSA ----------------------------------------------
      // Versi sebelumnya langsung mengunduh berkasnya dan selesai. Jadi
      // pertanyaan "gw kalo mau check hasilnya gimana?" tidak punya jawaban
      // di dalam portal: berkasnya sudah di folder Unduhan, artwork aslinya
      // ada di Drive, dan membandingkannya berarti membuka dua jendela lalu
      // mengingat-ingat. Tidak ada orang yang memeriksa 13 medan dengan cara
      // itu; yang terjadi adalah berkasnya dipakai tanpa diperiksa.
      //
      // Sekarang hasilnya TIDAK langsung terunduh. Yang muncul: dua gambar
      // berdampingan, daftar tiap nilai lama -> baru, dan tautan membuka
      // kedua PDF di tab terpisah -- pembaca PDF bawaan browser jauh lebih
      // baik untuk memeriksa daripada apa pun yang bisa dibuat di sini,
      // karena bisa dizoom dan teksnya bisa dicari. Mengunduh jadi tombol
      // yang ditekan SESUDAH diperiksa, bukan akibat samping.
      clear(lapor);

      const simpanBlob = [];
      const tautanBlob = (bytes, nama) => {
        const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        simpanBlob.push(u);
        return u;
      };
      // Blob URL-nya dilepas setelah 15 menit: tab yang sudah dibuka tetap
      // hidup selama itu, dan tidak menahan dua PDF di memori selamanya.
      setTimeout(() => simpanBlob.forEach(u => URL.revokeObjectURL(u)), 15 * 60 * 1000);

      const perubahan = gantian.filter(g => !String(g.catatan).includes('salinan'));

      // TAUTAN MEMBUKA BERKASNYA DIBUAT DI SINI, SEBELUM PRATINJAUNYA.
      //
      // Dulu tautannya ikut dibangun di dalam blok pratinjau. Di uji jsdom
      // pratinjaunya menggantung -- tidak berhasil, tidak juga gagal -- dan
      // yang tertinggal di layar cuma tulisan "menggambar pratinjau..." tanpa
      // satu pun jalan membuka berkasnya. Cara memeriksa yang paling penting
      // tidak boleh bergantung pada bagian yang paling mungkin gagal.
      const hrefHasil = tautanBlob(r.pdf);
      const hrefAsli = tautanBlob(buf.slice(0));

      lapor.appendChild(h('div.row.gap8', { style: { alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' } }, [
        h('span', { style: { fontWeight: 700, color: 'var(--ok, #2e9e5b)' } },
          tr({ id: `${perubahan.length} medan diganti — periksa dulu`,
               en: `${perubahan.length} fields replaced — check it first`,
               zh: `已替换 ${perubahan.length} 个字段 — 请先核对` })),
        h('a', { href: hrefHasil, target: '_blank', style: { fontSize: '11.5px', fontWeight: 700 } },
          tr({ id: 'buka hasilnya ↗', en: 'open the result ↗', zh: '打开结果 ↗' })),
        h('a', { href: hrefAsli, target: '_blank', style: { fontSize: '11.5px', color: 'var(--text-3)' } },
          tr({ id: 'buka aslinya ↗', en: 'open the original ↗', zh: '打开原件 ↗' })),
        h('span.mla', {}, btn(tr({ id: 'Unduh PDF', en: 'Download PDF', zh: '下载 PDF' }), {
          variant: 'primary', sm: true,
          onClick: () => { unduh(r.pdf, `ARTWORK-OTOMATIS-${erp}.pdf`); toast(tr({ id: 'Terunduh', en: 'Downloaded', zh: '已下载' })); },
        })),
      ]));

      // DUA GAMBAR BERDAMPINGAN. Yang ditangkap mata dalam sedetik -- warna
      // hilang, blok bergeser, tulisan menimpa tetangganya -- tidak ada di
      // daftar medan mana pun. Setiap cacat yang pernah lolos di jalur ini
      // ketahuan dari gambarnya, bukan dari angka.
      const kolom = (judul, src, hrefPdf, catatan) => h('div', { style: { flex: '1 1 240px', minWidth: '200px' } }, [
        h('div.row.gap8', { style: { alignItems: 'baseline', marginBottom: '4px' } }, [
          h('span', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' } }, judul),
          h('a', { href: hrefPdf, target: '_blank', style: { fontSize: '10.5px', marginLeft: 'auto' } },
            tr({ id: 'buka di tab baru', en: 'open in new tab', zh: '在新标签页打开' })),
        ]),
        h('a', { href: hrefPdf, target: '_blank', style: { display: 'block' } },
          h('img', { src, alt: judul, style: { width: '100%', display: 'block', background: '#fff', border: '1px solid var(--line)', borderRadius: '4px' } })),
        catatan ? h('div', { style: { fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px' } }, catatan) : null,
      ]);

      const gambar = h('div.row.gap12', { style: { alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '10px' } },
        h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } },
          tr({ id: 'menggambar pratinjau…', en: 'drawing preview…', zh: '正在绘制预览…' })));
      lapor.appendChild(gambar);

      if (perubahan.length) {
        // TABEL LAMA -> BARU. Ini yang tidak bisa dilihat dari gambarnya:
        // apakah nilai yang mendarat memang nilai yang dimaksud. Tiap baris
        // bisa dicocokkan ke Master Data tanpa membuka berkasnya.
        lapor.appendChild(h('div', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '3px' } },
          tr({ id: 'Yang diganti', en: 'What was replaced', zh: '替换内容' })));
        lapor.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '2px 8px', alignItems: 'baseline', marginBottom: '10px' } },
          perubahan.map(g => [
            h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, g.catatan),
            h('span.mono', { style: { fontSize: '11px', textDecoration: 'line-through', opacity: 0.65 } }, String(g.lama == null ? '' : g.lama)),
            h('span', { style: { fontSize: '10.5px', color: 'var(--text-3)' } }, '→'),
            h('span.mono', { style: { fontSize: '11px', fontWeight: 700 } }, String(g.nilai)),
          ])));
      }

      lapor.appendChild(h('div', { style: { color: 'var(--warn, #e8a700)' } },
        tr({ id: 'Barcode masih yang lama — belum digambar ulang. Periksa sebelum dipakai.',
             en: 'The barcode is still the old one — not yet regenerated. Check before use.',
             zh: '条码仍是旧的 — 尚未重新生成。使用前请检查。' })));

      const semua = lewat.concat((r.gagal || []).map(g => `${g.catatan} — ${g.sebab}`));
      if (semua.length) {
        lapor.appendChild(h('details', { style: { marginTop: '6px' } }, [
          h('summary', { style: { cursor: 'pointer', color: 'var(--danger)' } },
            tr({ id: `${semua.length} medan tidak diganti`, en: `${semua.length} fields not replaced`, zh: `${semua.length} 个字段未替换` })),
          h('ul', { style: { margin: '4px 0 0', paddingLeft: '16px', color: 'var(--danger)' } },
            semua.map(x => h('li', { style: { fontSize: '11px' } }, x))),
        ]));
      }

      // Pratinjaunya digambar BELAKANGAN dan kegagalannya tidak mematikan
      // apa pun: merender dua halaman PDF makan waktu, dan daftar medan di
      // atas sudah bisa dibaca sementara gambarnya belum jadi.
      try {
        // DIBERI BATAS WAKTU. Perender PDF yang menggantung bukan hal
        // mustahil, dan "menggambar pratinjau..." yang tidak pernah berubah
        // adalah layar yang berbohong tentang keadaannya sendiri.
        const batas = new Promise((_, tolak) => setTimeout(
          () => tolak(new Error(tr({ id: 'kelamaan', en: 'timed out', zh: '超时' }))), 25000));
        const [imgAsli, imgBaru] = await Promise.race([
          Promise.all([renderThumb(buf.slice(0), 420), renderThumb(r.pdf.slice().buffer, 420)]),
          batas,
        ]);
        clear(gambar);
        gambar.appendChild(kolom(tr({ id: 'SEBELUM — artwork aslinya', en: 'BEFORE — the original artwork', zh: '之前 — 原始图稿' }),
          imgAsli, hrefAsli, namaBerkas));
        gambar.appendChild(kolom(tr({ id: 'SESUDAH — hasil otomatis', en: 'AFTER — automatic result', zh: '之后 — 自动结果' }),
          imgBaru, hrefHasil, tr({ id: 'bertanda ARTWORK OTOMATIS di pita bawah',
                                           en: 'marked ARTWORK OTOMATIS on the bottom band',
                                           zh: '底部条带标有 ARTWORK OTOMATIS' })));
      } catch (e2) {
        clear(gambar);
        gambar.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, [
          tr({ id: 'Pratinjau gagal digambar (' + String(e2.message || e2) + ') — buka berkasnya langsung: ',
               en: 'Preview could not be drawn (' + String(e2.message || e2) + ') — open the files directly: ',
               zh: '预览无法绘制（' + String(e2.message || e2) + '）— 请直接打开文件：' }),
          h('a', { href: hrefHasil, target: '_blank' }, tr({ id: 'hasilnya', en: 'the result', zh: '结果' })),
        ]));
      }
    } catch (e) {
      clear(lapor);
      lapor.appendChild(h('div', { style: { color: 'var(--danger)' } }, String(e.message || e)));
      if (simpanDasar) return;
      // Artwork dasar yang tersimpan ternyata tidak bisa dipakai: jalan
      // keluarnya ditawarkan di tempat, bukan disuruh cari sendiri.
      lapor.appendChild(h('div', { style: { marginTop: '6px' } },
        h('a', { href: '#', style: { fontSize: '11.5px' }, onClick: async (ev) => { ev.preventDefault(); await gantiDasar(); } },
          tr({ id: 'pilih artwork dasar yang lain', en: 'pick a different base artwork', zh: '选择其他基础图稿' }))));
    }
  }

  async function gantiDasar() {
    if (kunciDasar) { try { await dasar.hapus(pilihan.kunci, it.brand); } catch { /* memang belum ada */ } }
    clear(lapor);
    clear(barisDasar);
    barisDasar.appendChild(h('span', {},
      tr({ id: `Pilih artwork ${it.brand || ''} ${pilihan.kunci} sekali — sesudah ini tidak ditanya lagi.`,
           en: `Pick a ${it.brand || ''} ${pilihan.kunci} artwork once — you will not be asked again.`,
           zh: `选择一份 ${it.brand || ''} ${pilihan.kunci} 图稿即可 — 之后不会再询问。` })));
    masukan.value = '';
    masukan.style.display = '';
  }

  masukan.addEventListener('change', async () => {
    const berkas = masukan.files && masukan.files[0];
    if (!berkas) return;
    await jalankan(await berkas.arrayBuffer(), berkas.name, { simpanDasar: true });
  });

  kartu.appendChild(barisDasar);
  kartu.appendChild(masukan);
  kartu.appendChild(lapor);

  // ---- JALANNYA LAYAR INI ------------------------------------------------
  // Ada artwork dasar untuk merek+keluarga ini -> artworknya LANGSUNG dibuat,
  // tanpa satu klik pun. Belum ada -> minta sekali, dan katakan dengan jelas
  // bahwa ini sekali saja.
  (async () => {
    const d = kunciDasar ? await dasar.cari(pilihan.kunci, it.brand) : null;
    clear(barisDasar);
    if (!kunciDasar) {
      barisDasar.appendChild(h('span', { style: { color: 'var(--warn, #e8a700)' } },
        tr({ id: 'Item ini tidak punya merek di Master Data, jadi artwork dasarnya tidak bisa diingat — artwork dasar harus per merek, kalau tidak logo merek lain yang ikut tercetak.',
             en: 'This item has no brand in Master Data, so its base artwork cannot be remembered — base artwork must be per brand, otherwise another brand\u2019s logo gets printed.',
             zh: '该物料在主数据中没有品牌，因此无法记住其基础图稿 — 基础图稿必须按品牌区分，否则会印上其他品牌的标志。' })));
      masukan.style.display = '';
      return;
    }
    if (!d) {
      barisDasar.appendChild(h('span', {},
        tr({ id: `Artwork dasar ${it.brand} ${pilihan.kunci} belum ada. Pilih sekali — ERP ${it.brand} ${pilihan.kunci} berikutnya langsung jadi tanpa ditanya.`,
             en: `No base artwork for ${it.brand} ${pilihan.kunci} yet. Pick one once — the next ${it.brand} ${pilihan.kunci} ERP builds straight away.`,
             zh: `尚无 ${it.brand} ${pilihan.kunci} 的基础图稿。选择一次即可 — 下一个 ${it.brand} ${pilihan.kunci} 的 ERP 将直接生成。` })));
      masukan.style.display = '';
      return;
    }
    masukan.style.display = 'none';
    barisDasar.appendChild(h('span.row.gap8', { style: { alignItems: 'baseline', flexWrap: 'wrap' } }, [
      h('span', { style: { color: 'var(--text-3)', fontSize: '11px' } },
        tr({ id: 'artwork dasar:', en: 'base artwork:', zh: '基础图稿：' })),
      h('span.mono', { style: { fontSize: '11px' } }, d.nama || kunciDasar),
      h('a', { href: '#', style: { fontSize: '11px' }, onClick: (ev) => { ev.preventDefault(); gantiDasar(); } },
        tr({ id: 'ganti', en: 'change', zh: '更换' })),
    ]));
    await jalankan(d.bytes.slice(0), d.nama || kunciDasar, { simpanDasar: false });
  })().catch(e => {
    clear(barisDasar);
    barisDasar.appendChild(h('span', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    masukan.style.display = '';
  });

  // KAKI: kelengkapan data, dan lembar periksa sebagai TAUTAN kecil.
  // Ini yang tidak dibutuhkan 90% waktu, jadi tidak boleh sebesar tombol
  // utamanya — versi sebelumnya memberinya tombol oranye dan itu yang
  // dipencet orang dua kali.
  const kaki = h('div', { style: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' } });
  const ringkas = h('span', { style: { fontSize: '11px', color: 'var(--text-3)' } },
    tr({ id: 'memeriksa data…', en: 'checking data…', zh: '正在核对数据…' }));
  kaki.appendChild(h('div.row.gap12', { style: { alignItems: 'center', flexWrap: 'wrap' } }, [
    ringkas,
    h('a', {
      href: '#', style: { fontSize: '11px', marginLeft: 'auto' },
      onClick: async (e) => {
        e.preventDefault();
        try {
          const [t, { render }] = await Promise.all([muatTemplat(pilihan.berkas), import('../label/render.js')]);
          const r = await render(t, baris, { erp, dari: pilihan.berkas });
          unduh(r.pdf, `PERIKSA-DATA-${erp}.pdf`);
          toast(tr({ id: 'Lembar periksa diunduh (teks saja, bukan artwork)',
                     en: 'Check sheet downloaded (text only, not artwork)',
                     zh: '核对表已下载（仅文字，非图稿）' }));
        } catch (err) { toast(String(err.message || err)); }
      },
    }, tr({
      id: 'unduh lembar periksa data (teks saja, bukan artwork)',
      en: 'download data check sheet (text only, not artwork)',
      zh: '下载数据核对表（仅文字，非图稿）',
    })),
  ]));
  kartu.appendChild(kaki);

  muatTemplat(pilihan.berkas).then(t => {
    const isi = isiTemplat(t, baris);
    clear(ringkas);
    const siap = isi.medan.length - isi.bolong.length;
    ringkas.appendChild(h('span', { style: { color: isi.bolong.length ? 'var(--warn, #e8a700)' : 'var(--text-3)' } },
      tr({ id: `${siap} medan siap · ${isi.bolong.length} kurang`,
           en: `${siap} fields ready · ${isi.bolong.length} missing`,
           zh: `${siap} 个字段就绪 · ${isi.bolong.length} 个缺失` })));
    if (isi.bolong.length) {
      ringkas.appendChild(h('details', { style: { display: 'inline-block', marginLeft: '8px' } }, [
        h('summary', { style: { cursor: 'pointer', fontSize: '11px' } },
          tr({ id: 'yang mana', en: 'which ones', zh: '哪些' })),
        h('ul', { style: { margin: '4px 0 0', paddingLeft: '16px' } },
          isi.bolong.map(b => h('li', { style: { fontSize: '11px' } }, `${b.k} — ${b.sebab || 'kosong'}`))),
      ]));
    }
  }).catch(() => {});

  wrap.appendChild(kartu);
  return wrap;
}
