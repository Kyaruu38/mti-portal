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
import { badge, btn, field, inputEl } from '../ui/components.js';
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
    field(tr({ id: 'Kode ERP', en: 'ERP code', zh: 'ERP 编码' }),
      inputEl({
        value: erp, placeholder: '0105045809703ID',
        onInput: e => setUI({ artworkErp: e.target.value.trim() }),
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
  kartuTemplat.appendChild(h('div', { style: { fontWeight: 700, marginBottom: '8px' } },
    tr({ id: 'Rakit dari templat', en: 'Build from template', zh: '从模板生成' })));

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
      btn(tr({ id: 'Buat proof', en: 'Build proof', zh: '生成校样' }), {
        variant: 'primary',
        onClick: async () => {
          try {
            const [t, { render }] = await Promise.all([muatTemplat(pilihan.berkas), import('../label/render.js')]);
            const r = await render(t, baris, { erp, dari: pilihan.berkas });
            unduh(r.pdf, `ARTWORK-OTOMATIS-${erp}-templat.pdf`);
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
  kartuSulih.appendChild(masukan);
  kartuSulih.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '8px' } }, tr({
    id: 'Peta medan per keluarga belum ada di layar ini — sulih masih dijalankan lewat alat di tools/label.',
    en: 'Per-family field maps are not in this screen yet — substitution still runs through tools/label.',
    zh: '本界面尚无按系列的字段映射 — 替换仍通过 tools/label 运行。',
  })));
  wrap.appendChild(kartuSulih);

  return wrap;
}
