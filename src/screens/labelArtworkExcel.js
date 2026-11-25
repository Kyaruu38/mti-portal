// ---------------------------------------------------------------------------
// ARTWORK DARI LEMBAR EXCEL — tanpa mengetik satu kode ERP pun.
//
// "gw mau tinggal masukin excel (bukan erp ID) jadi ada datanya semua, then
// bisa click auto generate". Itu persis alur di berkas ini: jatuhkan lembar,
// lihat daftarnya, tekan sekali.
//
// APA YANG SEBENARNYA MENAHAN SELAMA INI, dan ini layak dikatakan terus terang
// karena pernah terdengar seperti "harus pakai templat". Bukan templat: yang
// tidak ada di kolom mana pun adalah GAMBARNYA -- logo, warna merek, tanda
// SNI, QR, blok peringatan, piktogram. Semuanya vektor di artworknya. Dari
// Excel saja yang bisa dibuat cuma lembar data, halaman putih yang memang
// sudah ditolak. Jadi datanya dari Excel, gambarnya dari artwork yang sudah
// ada -- dan sejak drive-download ada, artworknya ditarik sendiri dari Drive.
// Tidak ada seorang pun yang memilih berkas lagi.
//
// LEMBAR YANG DITERIMA SAMA DENGAN LEMBAR ORDER LABEL yang sudah dipakai
// layar Permintaan Label. Bukan format baru. Membuat format kedua berarti
// orang gudang harus tahu lembar mana untuk layar mana, dan itu cara
// menambah pekerjaan sambil mengaku menguranginya.
// ---------------------------------------------------------------------------
import { h, clear } from '../core/dom.js';
import { getState, toast } from '../core/store.js';
import { tr } from '../i18n/index.js';
import { btn } from '../ui/components.js';
import { readWorkbook } from '../core/xlsx.js';
import { parseLabelSheet } from '../parsers/excelLabels.js';
import { pilihTemplat } from '../label/templat.js';
import { lihatPeta } from '../label/dasarPeta.js';

const muatTemplat = (berkas) =>
  fetch(new URL('../label/templat/' + berkas, import.meta.url)).then(r => r.json());

function unduh(bytes, nama) {
  const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = u; a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

/**
 * Baris Excel memakai nama JS (loadSpeed, ttl, pr); peta medan memakai nama
 * KOLOM BASIS DATA (load_speed, tt_tl, ply). Dialihkan di SATU tempat, sama
 * seperti keKolom() di layar satu-ERP -- dua penerjemah yang berbeda adalah
 * dua penerjemah yang suatu hari akan berbeda isinya.
 */
export function keKolomExcel(x) {
  if (!x) return null;
  return {
    erp: x.erp || '', market: x.market || '', spec: x.spec || '', nameEn: x.nameEn || '',
    brand: x.brand || '', size: x.size || '', pattern: x.pattern || '',
    load_speed: x.loadSpeed || '', ply: x.pr || '', ply_block: x.plyBlock || '',
    tt_tl: x.ttl || '', ms: x.ms || '', ean: x.ean || '',
    npb1: x.npb1 || '', npb3: x.npb3 || '', sni_no: x.sni || '',
    rr: x.rr || '', wet_grip: x.wetGrip || '', noise: x.noise || '', noise_class: x.noiseClass || '',
  };
}

/**
 * Menilai satu baris SEBELUM apa pun dibuat: templatnya ketemu? artworknya
 * ada dan bisa dipakai? Dipakai untuk pratinjau daftarnya, supaya yang tidak
 * akan jadi terlihat lebih dulu -- bukan sesudah menunggu 40 baris selesai.
 */
export function nilaiBaris(b) {
  const p = pilihTemplat({ nama: b.nameEn || b.spec, spec: b.spec, market: b.market });
  if (!p || !p.ok) return { bisa: false, sebab: p && p.sebab ? p.sebab : 'templat tidak ketemu', kunci: (p && p.kunci) || '' };
  if (!b.brand) return { bisa: false, sebab: 'baris ini tidak punya merek', kunci: p.kunci };
  const pt = lihatPeta(p.kunci, b.brand);
  if (pt && !pt.bisa) return { bisa: false, sebab: pt.sebab, kunci: p.kunci, merekTahu: true };
  if (!pt) return { bisa: true, hati: true, kunci: p.kunci, sebab: 'merek ini belum pernah disaring — hasilnya belum pasti' };
  return { bisa: true, kunci: p.kunci };
}

export function kartuArtworkExcel() {
  const kartu = h('div.card', { style: { padding: '14px' } });
  const masukan = h('input', { type: 'file', accept: '.xlsx,.xls', style: { fontSize: '12px' } });
  const daftar = h('div', { style: { marginTop: '10px', fontSize: '11.5px' } });
  const kaki = h('div', { style: { marginTop: '10px' } });

  let barisSiap = [];

  kartu.appendChild(h('div', { style: { fontWeight: 700, marginBottom: '2px' } },
    tr({ id: 'Dari lembar Excel — banyak sekaligus', en: 'From an Excel sheet — many at once', zh: '从 Excel 表格 — 一次多个' })));
  kartu.appendChild(h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '8px' } },
    tr({ id: 'Lembar order label yang biasa. Tidak perlu mengetik ERP, tidak perlu memilih berkas artwork — artworknya ditarik sendiri dari Drive per merek.',
         en: 'The usual label order sheet. No ERP typing, no artwork file to pick — the artwork is pulled from Drive per brand.',
         zh: '就是平常的标签订单表。无需输入 ERP，无需选择图稿文件 — 图稿按品牌自动从 Drive 拉取。' })));
  kartu.appendChild(masukan);
  kartu.appendChild(daftar);
  kartu.appendChild(kaki);

  masukan.addEventListener('change', async () => {
    const berkas = masukan.files && masukan.files[0];
    clear(daftar); clear(kaki); barisSiap = [];
    if (!berkas) return;
    daftar.appendChild(h('div', { style: { color: 'var(--text-3)' } },
      tr({ id: 'Membaca lembarnya…', en: 'Reading the sheet…', zh: '正在读取表格…' })));
    try {
      const st = getState();
      const wb = await readWorkbook(berkas);
      const hasil = parseLabelSheet(wb.rows(wb.sheetNames[0]), {
        brandMap: st.brandMap || [],
        knownErps: new Set((st.items || []).map(x => String(x.erp || '').trim())),
        master: st.items || [],
      });
      if (!hasil.ok) throw new Error(hasil.error || 'lembarnya tidak terbaca');

      const baris = (hasil.items || []).map(keKolomExcel);
      if (!baris.length) throw new Error('tidak ada baris yang terbaca di lembar ini');

      const dinilai = baris.map(b => ({ b, n: nilaiBaris(b) }));
      barisSiap = dinilai.filter(x => x.n.bisa).map(x => x.b);
      const tidak = dinilai.filter(x => !x.n.bisa);

      clear(daftar);
      daftar.appendChild(h('div', { style: { marginBottom: '6px' } }, [
        h('b', {}, String(barisSiap.length)),
        document.createTextNode(' ' + tr({ id: 'baris siap dibuat', en: 'rows ready to build', zh: '行可生成' })),
        tidak.length ? h('span', { style: { color: 'var(--warn, #e8a700)', marginLeft: '8px' } },
          `· ${tidak.length} ` + tr({ id: 'tidak bisa', en: 'cannot', zh: '无法生成' })) : null,
      ].filter(Boolean)));

      // YANG TIDAK BISA DISEBUT SATU PER SATU, SEBELUM apa pun dibuat.
      // Mengetahui "ARROYO hurufnya kurva" sesudah menunggu 40 baris selesai
      // tidak membantu siapa pun; mengetahuinya sekarang membuat orangnya
      // bisa memutuskan lanjut atau mengurus artworknya dulu.
      if (tidak.length) {
        const ul = h('ul', { style: { margin: '4px 0 0 16px', color: 'var(--text-3)' } });
        for (const x of tidak.slice(0, 12)) {
          ul.appendChild(h('li', {}, `${x.b.erp || x.b.spec || '(tanpa ERP)'} — ${x.n.sebab}`));
        }
        if (tidak.length > 12) ul.appendChild(h('li', {}, `… ${tidak.length - 12} lagi`));
        daftar.appendChild(ul);
      }

      if (!barisSiap.length) return;

      const tombol = btn(tr({ id: `Buat ${barisSiap.length} artwork`, en: `Build ${barisSiap.length} artworks`, zh: `生成 ${barisSiap.length} 份图稿` }), {
        variant: 'primary',
        onClick: async () => {
          tombol.disabled = true;
          clear(kaki);
          const kabarEl = h('div', { style: { fontSize: '11.5px', color: 'var(--text-3)' } }, '…');
          kaki.appendChild(kabarEl);
          try {
            const [{ artworkBanyak }, { itemTeks }, { unduhArtwork }] = await Promise.all([
              import('../label/artworkBanyak.js'),
              import('../parsers/pdf.js'),
              import('../core/driveUnduh.js'),
            ]);
            const petaDrive = new Map((st.designs || [])
              .filter(d => d.erp && d.driveUrl).map(d => [String(d.erp).trim(), d.driveUrl]));

            const r = await artworkBanyak(barisSiap, {
              pilihTemplat, muatTemplat, itemTeks, unduh: unduhArtwork,
              cariDrive: (b) => petaDrive.get(String(b.erp || '').trim()) || '',
              kabar: (sudah, dari, erp) => {
                kabarEl.textContent = tr({ id: `${sudah}/${dari} — ${erp}`, en: `${sudah}/${dari} — ${erp}`, zh: `${sudah}/${dari} — ${erp}` });
              },
            });

            clear(kaki);
            kaki.appendChild(h('div.row.gap8', { style: { alignItems: 'center', flexWrap: 'wrap' } }, [
              h('span', { style: { fontWeight: 700, color: 'var(--ok, #2e9e5b)' } },
                tr({ id: `${r.berhasil.length} artwork jadi, ${r.jumlahHalaman} halaman`,
                     en: `${r.berhasil.length} artworks built, ${r.jumlahHalaman} pages`,
                     zh: `生成 ${r.berhasil.length} 份图稿，共 ${r.jumlahHalaman} 页` })),
              h('a', { href: URL.createObjectURL(new Blob([r.pdf], { type: 'application/pdf' })), target: '_blank',
                       style: { fontSize: '11.5px', fontWeight: 700 } },
                tr({ id: 'buka dulu ↗', en: 'open it first ↗', zh: '先打开查看 ↗' })),
              h('span.mla', {}, btn(tr({ id: 'Unduh PDF', en: 'Download PDF', zh: '下载 PDF' }), {
                variant: 'primary', sm: true,
                onClick: () => { unduh(r.pdf, `ARTWORK-BORONGAN-${new Date().toISOString().slice(0, 10)}.pdf`); toast(tr({ id: 'Terunduh', en: 'Downloaded', zh: '已下载' })); },
              })),
            ]));

            // Yang gagal DI TENGAH jalan tetap disebut per baris. Berkasnya
            // sudah jadi untuk sisanya; menyembunyikan yang gagal berarti
            // orangnya mengira semuanya ada di dalam berkas itu.
            if (r.gagal.length) {
              const ul = h('ul', { style: { margin: '6px 0 0 16px', color: 'var(--warn, #e8a700)', fontSize: '11.5px' } });
              for (const g of r.gagal) ul.appendChild(h('li', {}, `${g.erp} — ${g.sebab}`));
              kaki.appendChild(ul);
            }
            const adaBolong = r.berhasil.filter(b => (b.lewat || []).length);
            if (adaBolong.length) {
              kaki.appendChild(h('div', { style: { marginTop: '6px', fontSize: '11px', color: 'var(--text-3)' } },
                tr({ id: `${adaBolong.length} artwork punya medan yang tidak terisi — halaman pedoman di tiap artwork menyebut medan mana.`,
                     en: `${adaBolong.length} artworks have unfilled fields — the guide page in each one names which.`,
                     zh: `${adaBolong.length} 份图稿有未填字段 — 每份的指引页都列明了具体字段。` })));
            }
          } catch (e) {
            clear(kaki);
            kaki.appendChild(h('div', { style: { color: 'var(--danger)', whiteSpace: 'pre-wrap', fontSize: '11.5px' } },
              String(e.message || e)));
          } finally {
            tombol.disabled = false;
          }
        },
      });
      kaki.appendChild(tombol);
    } catch (e) {
      clear(daftar);
      daftar.appendChild(h('div', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    }
  });

  return kartu;
}
