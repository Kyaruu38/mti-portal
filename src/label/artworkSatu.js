// ---------------------------------------------------------------------------
// SATU TEMPAT YANG MENYUSUN GANTIAN — dipakai layar satu-ERP MAUPUN jalur Excel.
//
// KENAPA MODUL INI ADA, DAN INI TEMUAN YANG TIDAK ENAK. Pencocokan isi
// (cocokkanIsi di sumberPdf.js) dibangun supaya merek yang templat
// koordinatnya tidak cocok tetap bisa disulih -- GOODRIDE dari 0 jadi 3,
// ARROYO dari ditolak jadi 4. Lalu ia TIDAK PERNAH DIPANGGIL DARI src/.
// Nol pemanggil. Satu-satunya yang menjalankannya adalah harness uji, jadi
// angkanya benar di laporan dan tidak ada apa pun di portal yang berubah.
//
// Terukur waktu menyaring 59 artwork asli: 21 dari 45 kombinasi yang bisa
// disulih punya koordinat cocok NOL dan hidup SEPENUHNYA dari pencocokan isi
// -- termasuk WESTLAKE SNI/TBR, CHAOYANG PT/TBR dan GOLDEN CROWN SNI/TBR.
// Di portal, 21 kombinasi itu gagal; di laporan uji, lulus.
//
// Jadi penyusunannya dipindah ke sini dan dipakai bersama. Dua jalur yang
// menyusun gantian sendiri-sendiri adalah dua jalur yang akan berbeda lagi.
//
// URUTANNYA: KOORDINAT DULU, ISI MENAMBAL. Koordinat lebih tepat KALAU
// templatnya memang diukur dari tata letak itu. Isi lebih tahan banting
// karena bentuk sebuah ukuran ban tidak berubah antar berkas. Yang dipakai
// menambal HANYA yang `pasti` -- calon tunggal atau berjangkar. Calon yang
// ragu dibiarkan kosong dan DILAPORKAN, karena menulis nilai di medan yang
// salah menghasilkan label rapi yang isinya tertukar, dan itu lebih
// berbahaya daripada medan yang dibiarkan.
// ---------------------------------------------------------------------------
import * as sp from './sumberPdf.js';
import { isiMedan } from './peta.js';
import { sulih } from './sulih.js';

/**
 * @returns {{gantian:Array, lewat:Array<string>, asal:Object<string,string>,
 *            nKoordinat:number, nIsi:number}}
 */
export function susunGantian(templat, sumber, jangkar, baris) {
  const cocok = jangkar && jangkar.ok ? sp.cocokkanMedan(templat, sumber, jangkar) : [];
  const isi = sp.cocokkanIsi(templat, sumber, jangkar && jangkar.ok ? jangkar : { ok: false })
    .filter(x => x.ketemu);

  const pakai = new Map();
  const asal = {};
  for (const c of cocok) if (c.ketemu) { pakai.set(c.k, c); asal[c.k] = 'koordinat'; }
  for (const x of isi) {
    if (pakai.has(x.k)) continue;
    if (!x.pasti) continue;
    pakai.set(x.k, x); asal[x.k] = 'isi';
  }

  const gantian = [];
  const lewat = [];
  // MEDAN YANG DATANYA ADA TAPI TIDAK JADI DITULIS KE ARTWORKNYA.
  //
  // Dipakai halaman pedoman supaya ia tidak mencetak nilai yang DIMAKSUD
  // seolah itu nilai yang ADA di labelnya. Medan yang tidak disulih karena
  // nilai barunya SAMA dengan yang lama TIDAK masuk sini -- labelnya memang
  // sudah benar untuk medan itu.
  const takTersulih = new Set();
  // Medan yang KETEMU, datanya ADA, dan nilainya SUDAH SAMA dengan yang
  // tercetak. Dihitung terpisah karena "tidak ada yang perlu diganti" dan
  // "tidak ada yang bisa diganti" adalah dua keadaan yang berlawanan, dan
  // tanpa pembedaan ini yang pertama dilaporkan sebagai kegagalan.
  const sudahBenar = [];

  // Medan yang TIDAK ketemu sama sekali tetap disebut, bukan didiamkan —
  // KECUALI medan yang nilainya memang datang dari artworknya sendiri
  // (ukuran label, url merek, nomor revisi, label tetap). Medan itu tidak
  // pernah disulih dari data, jadi "tidak ketemu" untuknya bukan kabar apa
  // pun. Aturan yang sama dipakai di bawah waktu nilainya kosong.
  const dariData = (k) => {
    const med = (templat.medan || []).find(m => m.k === k);
    if (!med || med.tetap) return false;
    return String(isiMedan(med, baris).ragam || '').startsWith('kolom:');
  };
  for (const c of cocok) {
    if (c.ketemu || pakai.has(c.k)) continue;
    if (!dariData(c.k)) continue;
    lewat.push(`${c.k} — tidak ketemu di artworknya`);
    takTersulih.add(c.k);
  }
  for (const x of isi) {
    if (pakai.has(x.k) || x.pasti) continue;
    lewat.push(`${x.k} — isinya cocok tapi calonnya lebih dari satu${x.sebabRagu ? ' (' + x.sebabRagu + ')' : ''}, tidak ditulis`);
    if (dariData(x.k)) takTersulih.add(x.k);
  }

  for (const [k, c] of pakai) {
    const med = (templat.medan || []).find(m => m.k === k);
    if (!med) continue;
    if (med.tetap) continue;                       // label tetap tidak diganti data
    const nilai = isiMedan(med, baris);
    if (!nilai.nilai) {
      // MEDAN YANG NILAINYA MEMANG DATANG DARI ARTWORKNYA TIDAK DILAPORKAN
      // SEBAGAI DATA BOLONG. Ukuran label, url merek dan nomor revisi ada di
      // artworknya, bukan di baris Excel — menyebutnya "data kosong" berarti
      // tiap artwork yang sempurna tetap membawa empat peringatan palsu.
      //
      // Pelajaran yang sama sudah dibayar sekali di tempelPedoman: peringatan
      // yang salah lebih berbahaya daripada tidak ada peringatan, karena ia
      // mengajari orang mengabaikan seluruh daftarnya. Yang disebut di sini
      // hanya ragam 'kolom:' — yaitu yang benar-benar seharusnya ada di data.
      const ragam = String(nilai.ragam || '');
      if (!ragam.startsWith('kolom:')) continue;
      lewat.push(`${k} — ${nilai.sebab || 'data kosong'}`);
      continue;
    }
    if (nilai.nilai === c.lama) { sudahBenar.push(k); continue; }   // sudah benar, tidak perlu disentuh
    const tolak = sp.bolehGanti(k, c.lama, nilai.nilai);
    if (tolak) { lewat.push(`${k} — ${tolak}`); takTersulih.add(k); continue; }

    gantian.push({ ...c.kotak, nilai: nilai.nilai, putar: c.putar, arah: c.arah, tm: c.tm,
                   catatan: k, lama: c.lama, asal: asal[k] });

    // SALINAN GANDA dicari lewat TEKS LAMAnya. Nilai yang sama sering
    // tercetak dua kali -- di panel dan di tulang punggung -- dan satu
    // salinan yang terlewat berarti label membawa dua nilai yang saling
    // bertentangan sambil terlihat benar sekilas.
    for (const sal of sp.cariSalinan(sumber, c.lama, c.kotak)) {
      gantian.push({ ...sal.kotak, nilai: nilai.nilai, putar: sal.putar, arah: sal.arah,
                     tm: sal.tm, catatan: k + ' (salinan)', lama: c.lama, asal: asal[k] });
    }
  }

  // ---------------------------------------------------------------------
  // DAFTAR 'BELUM TERSULIH' DIHITUNG ULANG DARI SELURUH MEDAN TEMPLAT.
  //
  // Versi sebelumnya hanya mengumpulkan medan yang KETEMU lalu gagal. Medan
  // yang TIDAK KETEMU SAMA SEKALI tidak pernah masuk daftar, dan kalau
  // jangkarnya tidak ketemu `cocok` kosong sehingga loop itu tidak jalan
  // satu putaran pun.
  //
  // Akibatnya terlihat pada data MTI yang sebenarnya, ERP 010504044ID:
  // artworknya mencetak pola EZ336 dan Load Range L, pedomannya menuliskan
  // pattern CR926 dan load_range G -- TANPA satu pun tanda. Nama polanya di
  // artwork CHAOYANG itu KURVA, jadi tidak pernah ketemu, jadi tidak pernah
  // tercatat. Dokumen yang dipakai MEMERIKSA label kembali membenarkan
  // kesalahannya, lewat jalur yang berbeda dari yang sudah ditutup.
  //
  // Definisi yang kokoh, dan satu-satunya yang tidak punya celah: sebuah
  // medan BELUM TERSULIH kalau nilainya datang dari BARIS DATA, nilainya
  // ADA, dan medan itu tidak berakhir tertulis di artworknya -- apa pun
  // sebabnya, ketemu atau tidak.
  const tertulis = new Set(gantian.map(g => String(g.catatan).replace(/ \(salinan\)$/, '')));
  const benar = new Set(sudahBenar);
  const belum = [];
  for (const med of (templat.medan || [])) {
    if (!med || med.tetap) continue;
    if (tertulis.has(med.k) || benar.has(med.k)) continue;
    const nilai = isiMedan(med, baris);
    if (!nilai.nilai) continue;                    // kosong itu urusan 'bolong', bukan ini
    const ragam = String(nilai.ragam || '');
    // Yang nilainya memang datang dari artworknya tidak pernah 'belum tersulih'.
    if (ragam === 'tetap' || ragam.startsWith('aset') || ragam.startsWith('lapisan')) continue;
    belum.push(med.k);
  }

  return {
    gantian, lewat, asal, takTersulih: belum, sudahBenar,
    nKoordinat: Object.values(asal).filter(a => a === 'koordinat').length,
    nIsi: Object.values(asal).filter(a => a === 'isi').length,
  };
}

/**
 * Satu artwork, dari byte sumber sampai PDF hasil sulih.
 *
 * `itemTeks` disuntikkan, bukan diimpor: pemanggilnya di portal memakai
 * parsers/pdf.js (pdfjs lewat CDN), dan harness uji memakai pdfjs lokal.
 * Mengimpornya di sini mengikat modul ini ke salah satunya.
 *
 * @returns {Promise<{pdf:Uint8Array, gantian, lewat, nKoordinat, nIsi, laporan}>}
 */
export async function artworkSatu({ bytes, templat, berkasTemplat, baris, erp = '', dari = '', itemTeks, tandai = true }) {
  const { items, tinggiPt } = await itemTeks(bytes.slice(0));
  const sumber = sp.keMedanSumber(items, tinggiPt);
  if (!sumber.length) {
    throw new Error('artworknya tidak punya lapisan teks — hurufnya sudah jadi kurva, jalur ini butuh berkas yang teksnya masih teks');
  }
  const j = sp.cariJangkar(sumber, berkasTemplat);
  const susun = susunGantian(templat, sumber, j, baris);
  // NOL GANTIAN TIDAK OTOMATIS BERARTI GAGAL.
  //
  // Terlihat pada data MTI yang sebenarnya: ERP 010504061ID dilaporkan gagal
  // dengan "tidak ada medan yang bisa disulih", padahal artwork dasar untuk
  // GOODRIDE SNI/TBR memang DIPANEN DARI ERP ITU SENDIRI -- jadi setiap
  // nilainya sudah benar dan tidak ada yang perlu disentuh. Artwork yang
  // sudah tepat dilaporkan sebagai kegagalan, dan orangnya akan mencari
  // sebab yang tidak ada.
  //
  // Gagal yang sebenarnya: tidak ada medan yang KETEMU sama sekali.
  if (!susun.gantian.length && !susun.sudahBenar.length) {
    throw new Error(j.ok
      ? 'jangkarnya ketemu tapi tidak ada medan yang bisa disulih dari data baris ini'
      : 'jangkar tidak ketemu dan pencocokan isi tidak memberi calon yang pasti: ' + j.sebab);
  }
  const r = await sulih(bytes.slice(0), susun.gantian, { erp, dari, tandai });
  // LAPORAN SULIH IKUT DIBACA, dan ini bukan kehati-hatian berlebihan.
  // sulih() menolak gantian yang kotaknya di luar halaman atau yang tidak
  // muat di kotaknya, dan penolakan itu terjadi SESUDAH susunGantian selesai.
  // Tanpa menyambungkannya balik, medan yang ditolak di sini tetap tercatat
  // 'tersulih' dan pedomannya akan mencetak nilainya tanpa tanda.
  const ditolak = (r.laporan || []).filter(x => x && x.muat === false)
    .map(x => String(x.catatan || '').replace(/ \(salinan\)$/, ''))
    .filter(Boolean);
  const takTersulih = [...new Set([...(susun.takTersulih || []), ...ditolak])];
  return { pdf: r.pdf, laporan: r.laporan, ...susun, takTersulih };
}
