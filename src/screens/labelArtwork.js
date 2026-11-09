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

  // LANGKAH SATU-SATUNYA: pilih berkasnya.
  kartu.appendChild(h('div', { style: { fontSize: '12px', marginBottom: '6px' } },
    tr({ id: 'Pilih berkas artwork aslinya — datanya diganti di dalamnya, logo dan warnanya tidak disentuh.',
         en: 'Pick the original artwork file — the data is replaced inside it; logo and colours are untouched.',
         zh: '选择原始图稿文件 — 数据在其内部被替换，标志与颜色不受影响。' })));

  const masukan = h('input', { type: 'file', accept: 'application/pdf', style: { fontSize: '12px' } });
  const lapor = h('div', { style: { fontSize: '11.5px', marginTop: '10px' } });
  masukan.addEventListener('change', async () => {
    const berkas = masukan.files && masukan.files[0];
    if (!berkas) return;
    clear(lapor);
    lapor.appendChild(h('div', { style: { color: 'var(--text-3)' } },
      tr({ id: 'Membaca artworknya…', en: 'Reading the artwork…', zh: '正在读取图稿…' })));
    try {
      const [{ itemTeks }, sp, { sulih }] = await Promise.all([
        import('../parsers/pdf.js'), import('../label/sumberPdf.js'), import('../label/sulih.js'),
      ]);
      const t = await muatTemplat(pilihan.berkas);
      const buf = await berkas.arrayBuffer();
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
        gantian.push({ ...c.kotak, nilai: nilai.nilai, putar: c.putar, arah: c.arah, tm: c.tm, catatan: c.k });
        // Salinan ganda dicari lewat TEKS LAMAnya: satu yang terlewat berarti
        // label membawa dua nilai yang bertentangan sambil terlihat benar.
        for (const sal of sp.cariSalinan(sumber, c.lama, c.kotak)) {
          gantian.push({ ...sal.kotak, nilai: nilai.nilai, putar: sal.putar, arah: sal.arah, tm: sal.tm, catatan: c.k + ' (salinan)' });
        }
      }

      const r = await sulih(buf.slice(0), gantian, { erp, dari: `${berkas.name} · ${pilihan.berkas}` });
      unduh(r.pdf, `ARTWORK-OTOMATIS-${erp}.pdf`);

      clear(lapor);
      lapor.appendChild(h('div', { style: { fontWeight: 700, color: 'var(--ok, #2e9e5b)' } },
        tr({ id: `Jadi — ${gantian.length} medan diganti, berkasnya terunduh`,
             en: `Done — ${gantian.length} fields replaced, file downloaded`,
             zh: `完成 — 已替换 ${gantian.length} 个字段，文件已下载` })));
      lapor.appendChild(h('div', { style: { color: 'var(--warn, #e8a700)', marginTop: '4px' } },
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
    } catch (e) {
      clear(lapor);
      lapor.appendChild(h('div', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    }
  });
  kartu.appendChild(masukan);
  kartu.appendChild(lapor);

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
