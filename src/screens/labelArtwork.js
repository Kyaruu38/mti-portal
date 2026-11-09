// ---------------------------------------------------------------------------
// ARTWORK OTOMATIS — satu layar yang membuat proof label dari data yang sudah
// ada di basis data.
//
// DUA JALUR, DAN KEDUANYA PERLU. Bukan satu jalur dengan cadangan.
//
//   SULIH   — menyunting artwork yang SUDAH ADA. Yang berubah antar produk
//             cuma segelintir medan; logo merek, warna, tanda SNI, kode QR,
//             blok peringatan dan foto ban adalah VEKTOR di artworknya dan
//             tidak bisa dibuat dari data. Sulih mempertahankan semuanya
//             karena memang tidak menyentuhnya. Untuk OEM ini SATU-SATUNYA
//             jalur: tata letaknya milik pelanggan, berbeda tiap merek, dan
//             berubah kapan pun pelanggannya mengubahnya.
//
//   TEMPLAT — merakit dari koordinat yang diukur. Hasilnya benar penempatan
//             datanya tapi TANPA logo dan warna, jadi gunanya memeriksa data,
//             bukan menghasilkan artwork siap cetak.
//
// KENAPA ARTWORK SUMBERNYA DIPILIH DARI DISK, BUKAN DITARIK DARI DRIVE.
// Diuji dari asal portal yang sebenarnya (kyaruu38.github.io): Drive
// memblokir CORS untuk byte PDF-nya pada kedua jalur unduhannya. Satu-satunya
// yang lolos mengembalikan PNG 1024 px — sekitar 88 dpi untuk lembar A4,
// tidak cukup untuk apa pun yang akan dicetak. Jadi berkasnya dibuka oleh
// orangnya. Itu juga bukan kerugian murni: untuk OEM, orang yang mengganti
// data memang sebaiknya melihat artwork mana yang sedang dia ubah.
//
// SEMUA KELUARAN DITANDAI ARTWORK OTOMATIS, di tanda air DAN di metadata
// berkasnya, karena berkasnya bisa lepas dari basis data ini dan begitu lepas
// tidak ada lagi yang membedakannya dari artwork asli.
// ---------------------------------------------------------------------------
import { h, clear } from '../core/dom.js';
import { getState, setUI, toast } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { badge, btn, field, searchInput } from '../ui/components.js';
import { pilihTemplat } from '../label/templat.js';
import { isiTemplat } from '../label/peta.js';

const muatTemplat = (berkas) =>
  fetch(new URL('../label/templat/' + berkas, import.meta.url)).then(r => r.json());

function unduh(bytes, nama) {
  const b = new Blob([bytes], { type: 'application/pdf' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

function barisItems(erp) {
  return (getState().items || []).find(x => String(x.erp || '').trim() === String(erp || '').trim());
}

// Baris items memakai nama JS (loadSpeed); peta memakai nama kolom basis data
// (load_speed). Dialihkan di sini, di satu tempat, bukan di dalam peta —
// peta harus bisa diuji dengan baris yang dibaca langsung dari basis data.
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
  const ui = getState().ui || {};
  const erp = ui.artworkErp || '';
  const it = barisItems(erp);
  const baris = keKolom(it);
  const pilihan = it ? pilihTemplat({ nama: it.nameEn || it.spec, spec: it.spec, market: it.market }) : null;

  const wrap = h('div.stack', { style: { gap: '14px' } });

  wrap.appendChild(h('div.card', { style: { padding: '14px' } }, [
    // KOTAK INI HARUS searchInput, BUKAN inputEl, dan dua hal memaksanya.
    //
    // Pertama: onInput milik inputEl menyerahkan NILAInya, bukan event-nya
    // (lihat tanda tangannya di components.js). Versi pertama layar ini
    // membaca e.target.value, jadi tiap ketikan melempar TypeError, state-nya
    // tidak pernah terisi, dan layarnya diam saja — kotaknya terlihat
    // menerima ketikan karena itu DOM biasa, padahal tidak ada yang sampai.
    //
    // Kedua, dan ini yang sudah dicatat components.js sendiri: mount() tidak
    // punya diffing, jadi `onInput: v => setUI(...)` mengganti <input> yang
    // sedang diketik sebelum huruf KEDUA mendarat. searchInput menahan
    // ketikannya lalu merebut kembali fokus dan posisi karetnya sesudah
    // pohonnya dibangun ulang. Dia memang dibuat untuk persoalan ini.
    field(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编码' }),
      searchInput({
        id: 'artwork-erp', value: erp, mono: true, placeholder: '0105045809703ID',
        onChange: v => setUI({ artworkErp: String(v || '').trim() }),
      })),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' } }, tr({
      id: 'Ketik kode ERP yang ada di Master Data. Semua keluaran ditandai ARTWORK OTOMATIS.',
      en: 'Type an ERP code from Master Data. Every output is marked AUTOMATIC ARTWORK.',
      zh: '输入主数据中的 ERP 编码。所有输出均标记为自动生成图稿。',
    })),
  ]));

  if (!erp) return wrap;

  if (!it) {
    wrap.appendChild(h('div.card', { style: { padding: '14px' } },
      h('div', { style: { color: 'var(--danger)' } }, tr({
        id: `ERP ${erp} tidak ada di master item.`,
        en: `ERP ${erp} is not in the item master.`,
        zh: `ERP ${erp} 不在物料主数据中。`,
      }))));
    return wrap;
  }

  // ---- jalur templat ----
  const kartuTemplat = h('div.card', { style: { padding: '14px' } });
  kartuTemplat.appendChild(h('div', { style: { fontWeight: 700, marginBottom: '2px' } },
    tr({ id: 'Periksa data lewat templat', en: 'Check data against template', zh: '按模板核对数据' })));
  // LABEL JUJUR. Tombol ini sempat bernama "Buat proof", dan orang yang
  // menekannya mendapat halaman berisi teks hitam-putih tanpa logo, tanpa
  // warna, tanpa tanda SNI — lalu bertanya kenapa. Pertanyaannya wajar:
  // namanya menjanjikan artwork. Yang dihasilkan jalur ini cuma TEKS di
  // koordinat terukur, karena logo, blok warna, tanda SNI, QR dan blok
  // peringatan adalah VEKTOR di artworknya dan tidak ada di data mana pun.
  // Jadi gunanya memeriksa penempatan dan kelengkapan data, bukan mencetak.
  kartuTemplat.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px' } },
    tr({
      id: 'Keluarannya TEKS SAJA — tanpa logo, warna, tanda SNI atau QR, karena semua itu vektor di artworknya dan tidak ada di data. Untuk artwork utuh pakai jalur sulih di bawah.',
      en: 'The output is TEXT ONLY — no logo, colour, SNI mark or QR, because those are vectors in the artwork and exist in no data. For complete artwork use the substitution path below.',
      zh: '输出仅为文字 — 没有标志、颜色、SNI 标记或二维码，因为这些都是图稿中的矢量，不存在于任何数据中。完整图稿请使用下方的替换路径。',
    })));

  if (!pilihan.ok) {
    // Ditolak, dan SEBABNYA disebut. OEM ditolak bukan karena templatnya
    // belum dibuat melainkan karena designnya milik pelanggan — dan orang
    // yang membaca "belum ada templat" akan menunggu sesuatu yang tidak akan
    // pernah datang.
    kartuTemplat.appendChild(h('div.stack', { style: { gap: '6px' } }, [
      badge(tr({ id: 'Tidak bisa lewat templat', en: 'No template path', zh: '无法使用模板' }), 'gray'),
      h('div', { style: { fontSize: '12px' } }, pilihan.sebab),
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, tr({
        id: 'Pakai jalur sulih di bawah.', en: 'Use the substitution path below.', zh: '请使用下方的替换路径。',
      })),
    ]));
  } else {
    const status = h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)' } });
    kartuTemplat.appendChild(h('div.row.gap8', { style: { alignItems: 'center', marginBottom: '8px' } }, [
      badge(pilihan.kunci, 'blue'),
      h('span.mono', { style: { fontSize: '11px', color: 'var(--text-3)' } }, pilihan.berkas),
      pilihan.perluPeriksaLebih
        ? badge(tr({ id: 'sampel baru 1 merek', en: 'only 1 brand sampled', zh: '仅取样一个品牌' }), 'amber')
        : null,
    ]));
    kartuTemplat.appendChild(status);

    muatTemplat(pilihan.berkas).then(t => {
      const isi = isiTemplat(t, baris);
      clear(status);
      status.appendChild(h('div', {}, tr({
        id: `${isi.medan.length - isi.bolong.length} medan terisi, ${isi.bolong.length} bolong`,
        en: `${isi.medan.length - isi.bolong.length} fields filled, ${isi.bolong.length} missing`,
        zh: `已填 ${isi.medan.length - isi.bolong.length} 项，缺 ${isi.bolong.length} 项`,
      })));
      if (isi.bolong.length) {
        // Medan bolong disebut SATU PER SATU beserta sebabnya. Angka saja
        // ("3 bolong") tidak memberi tahu apa pun tentang apa yang harus
        // diisi, dan proofnya akan membawa kotak merah tanpa penjelasan.
        status.appendChild(h('ul', { style: { margin: '6px 0 0', paddingLeft: '16px', color: 'var(--danger)' } },
          isi.bolong.map(b => h('li', { style: { fontSize: '11px' } }, `${b.k} — ${b.sebab || 'kosong'}`))));
      }
    }).catch(e => { clear(status); status.appendChild(h('div', { style: { color: 'var(--danger)' } }, String(e.message || e))); });

    kartuTemplat.appendChild(h('div', { style: { marginTop: '10px' } },
      btn(tr({ id: 'Buat lembar periksa', en: 'Build check sheet', zh: '生成核对表' }), {
        variant: 'primary',
        onClick: async () => {
          try {
            const [t, { render }] = await Promise.all([muatTemplat(pilihan.berkas), import('../label/render.js')]);
            const r = await render(t, baris, { erp, dari: pilihan.berkas });
            unduh(r.pdf, `PERIKSA-DATA-${erp}.pdf`);
            toast(r.bolong.length
              ? tr({ id: `Proof dibuat, ${r.bolong.length} medan bolong ditandai merah`,
                     en: `Proof built, ${r.bolong.length} missing fields marked red`,
                     zh: `已生成校样，${r.bolong.length} 个缺失字段标红` })
              : tr({ id: 'Proof dibuat, semua medan terisi', en: 'Proof built, all fields filled', zh: '已生成校样，字段齐全' }));
          } catch (e) { toast(String(e.message || e)); }
        },
      })));
  }
  wrap.appendChild(kartuTemplat);

  // ---- jalur sulih ----
  const kartuSulih = h('div.card', { style: { padding: '14px' } });
  kartuSulih.appendChild(h('div', { style: { fontWeight: 700, marginBottom: '4px' } },
    tr({ id: 'Sulih artwork yang sudah ada', en: 'Substitute into existing artwork', zh: '在现有图稿上替换' })));
  kartuSulih.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginBottom: '10px' } }, tr({
    id: 'Buka berkas PDF artworknya dari komputer. Drive memblokir pengambilan byte PDF dari halaman web, jadi berkasnya tidak bisa ditarik sendiri.',
    en: 'Open the artwork PDF from your computer. Drive blocks fetching PDF bytes from a web page, so the file cannot be pulled automatically.',
    zh: '从电脑中打开图稿 PDF。Drive 阻止网页获取 PDF 字节，因此无法自动拉取文件。',
  })));
  const masukan = h('input', { type: 'file', accept: 'application/pdf', style: { fontSize: '12px' } });
  const lapor = h('div', { style: { fontSize: '11.5px', marginTop: '10px' } });
  masukan.addEventListener('change', async () => {
    const berkas = masukan.files && masukan.files[0];
    if (!berkas) return;
    clear(lapor);
    lapor.appendChild(h('div', { style: { color: 'var(--text-3)' } },
      tr({ id: 'Membaca artworknya…', en: 'Reading the artwork…', zh: '正在读取图稿…' })));
    try {
      if (!pilihan.ok) throw new Error(pilihan.sebab);
      const [{ itemTeks }, sp, { isiMedan }, { sulih }] = await Promise.all([
        import('../parsers/pdf.js'), import('../label/sumberPdf.js'),
        import('../label/peta.js'), import('../label/sulih.js'),
      ]);
      const t = await muatTemplat(pilihan.berkas);
      const buf = await berkas.arrayBuffer();
      const { items, tinggiPt } = await itemTeks(buf.slice(0));
      const sumber = sp.keMedanSumber(items, tinggiPt);
      if (!sumber.length) {
        // Artwork yang hurufnya sudah jadi kurva tidak punya lapisan teks
        // sama sekali. Jalur ini TIDAK BISA menebak letaknya dari situ, dan
        // menebak berarti menimpa bagian yang salah.
        throw new Error(tr({
          id: 'Berkas ini tidak punya lapisan teks — hurufnya sudah jadi kurva. Jalur sulih butuh berkas yang teksnya masih teks.',
          en: 'This file has no text layer — its letters are outlined curves. The substitution path needs a file whose text is still text.',
          zh: '该文件没有文字层 — 其字符已转为曲线。替换路径需要文字仍为文字的文件。',
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
        if (nilai.nilai === c.lama) continue;   // sudah sama, tidak perlu disentuh
        gantian.push({ ...c.kotak, nilai: nilai.nilai, putar: c.putar, arah: c.arah, catatan: c.k });
        // SALINAN GANDA: nilai yang sama sering tercetak dua kali. Dicari
        // lewat TEKS LAMAnya, bukan ditebak — satu yang terlewat berarti
        // label membawa dua nilai yang bertentangan dan terlihat benar.
        for (const sal of sp.cariSalinan(sumber, c.lama, c.kotak)) {
          gantian.push({ ...sal.kotak, nilai: nilai.nilai, putar: sal.putar, arah: sal.arah, catatan: c.k + ' (salinan)' });
        }
      }

      const eanBaru = isiMedan({ k: 'ean' }, baris).nilai;
      const r = await sulih(buf.slice(0), gantian, {
        erp, dari: `${berkas.name} · ${pilihan.berkas}`,
        // Barcode belum digambar ulang di jalur ini: letak batangnya harus
        // diukur dari berkasnya dulu, dan menggambar di tempat yang ditebak
        // akan menutupi barcode lama dengan yang baru tapi salah posisi.
      });
      unduh(r.pdf, `ARTWORK-OTOMATIS-${erp}.pdf`);

      clear(lapor);
      lapor.appendChild(h('div', { style: { color: 'var(--ok, #2e9e5b)' } },
        tr({ id: `${gantian.length} medan disulih, artwork diunduh`,
             en: `${gantian.length} fields substituted, artwork downloaded`,
             zh: `已替换 ${gantian.length} 个字段，图稿已下载` })));
      if (eanBaru) {
        lapor.appendChild(h('div', { style: { color: 'var(--warn, #e8a700)', marginTop: '4px' } },
          tr({ id: 'Barcode BELUM digambar ulang — masih barcode lama. Periksa sebelum dipakai.',
               en: 'The barcode was NOT regenerated — it is still the old one. Check before use.',
               zh: '条码尚未重新生成 — 仍是旧条码。使用前请检查。' })));
      }
      const semuaLewat = lewat.concat(r.gagal.map(g => `${g.catatan} — ${g.sebab}`));
      if (semuaLewat.length) {
        lapor.appendChild(h('div', { style: { marginTop: '6px', color: 'var(--danger)' } },
          tr({ id: 'Tidak tersulih:', en: 'Not substituted:', zh: '未替换：' })));
        lapor.appendChild(h('ul', { style: { margin: '2px 0 0', paddingLeft: '16px', color: 'var(--danger)' } },
          semuaLewat.map(x => h('li', { style: { fontSize: '11px' } }, x))));
      }
    } catch (e) {
      clear(lapor);
      lapor.appendChild(h('div', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    }
  });
  kartuSulih.appendChild(masukan);
  kartuSulih.appendChild(lapor);
  wrap.appendChild(kartuSulih);

  return wrap;
}
