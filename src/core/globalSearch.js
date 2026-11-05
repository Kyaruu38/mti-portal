// Cross-module lookup for the top-bar Global Search (see ui/layout.js). Pure
// function over the in-memory store — no DOM, no state mutation — so it's
// safe to call on every keystroke. The dropdown that renders these results
// is direct-DOM (not mount()-based) precisely so typing never re-renders
// the input itself; see layout.js's header() for that half.
//
// PO/PRF are documents this app generates, not files it archives to Drive —
// drive is deliberately always null for those two, not a bug.
//
// ROLE FILTERING
// --------------
// This used to sweep every store array with NO role check at all, while
// layout.js rendered the search box for everyone. RLS covered most of it — a
// role that cannot fetch a table has an empty array to search — but not all:
// prfs_read includes cania and visca (they raise PRFs), yet their
// REPORT_MODULES is deliberately ['Label','PO'] with no PRF, because the owner
// decided on 30 Jul that they create PRFs and get no payment visibility. Search
// handed them PRF numbers and suppliers anyway, straight past that decision.
//
// One uniform rule does not work here, and trying to find one is how you break
// something legitimate:
//   * "must hold the screen that displays it" would cut PO search from
//     cania/visca, who create POs all day and have PO in their report modules —
//     they simply have no approval screen.
//   * "must have the report module" would cut Invoice from sekar, who OWNS
//     invoice intake, because her modules are ['PPKEK','PRF'].
// So each type carries its own predicate, written next to the reason for it.
//
// `screen` is also the click target used by layout.js navigateTo(), kept here so
// the thing that decides visibility and the thing that decides where "Buka"
// lands can never drift apart.
import { allowedScreens, allowedReportModules } from '../auth/roles.js';

const hasScreen = (role, id) => allowedScreens(role).includes(id);
const hasModule = (role, m) => allowedReportModules(role).includes(m);

// NORMALISASI — kenapa pencocokan mentah tidak cukup di portal ini.
//
// Satu barang yang sama ditulis dengan empat ejaan berbeda di empat tempat,
// dan itu BUKAN kesalahan input yang bisa dibereskan sekali lalu selesai:
//
//   PO dari pemasok     295/80R22.5-18PR(152-149M)[CR976A]
//   lembar stok         295 80R22.5-18PR(152 149M)[CR976A]
//   nama berkas design  29580R22.5-18PR(152149M) CR976A
//   baris Mandarin      295/80R22.5-18PR（152-149M）【CR976A】西湖无内
//
// Dengan includes() biasa, mengetik ejaan mana pun cuma menemukan SATU dari
// empat. Orangnya lalu menyimpulkan datanya tidak ada — padahal keempatnya ada
// dan dia baru melihat seperempatnya. Itulah bentuk "banyak yang tidak ketemu".
//
// Jadi tiap medan dicocokkan DUA KALI: mentah (biar substring biasa dan
// Mandarin tetap jalan apa adanya) dan ternormalisasi.
//
// Cermin dari dsg_norm() di Supabase, dengan satu perbedaan yang disengaja:
// huruf Han TIDAK dibuang. dsg_norm memakainya untuk mencocokkan kode dan
// ukuran, sementara di sini 西湖 adalah kata kunci yang betul-betul diketik
// orang. Kalau dibuang, mengetik 西湖无内 akan ternormalisasi jadi string kosong.
//
// Bracket dan digit full-width ikut dilipat ke half-width lebih dulu: （）【】
// memang hilang karena bukan alnum, tapi １５２ bukan 152 bagi JavaScript, dan
// baris Mandarin di basis data ini memang memuatnya.
const lipatLebar = s => String(s).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const norm = s => lipatLebar(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z一-鿿]/g, '');

// `screens` is an ORDERED preference list, not a single destination: the same
// document lives on different screens for different roles. A PRF is opened from
// Payment by sekar and from Finance by financemti, and financemti holds neither
// Payment nor Reports — a single fixed target left them with a result they could
// see and no way to reach.
export const SEARCH_TYPES = {
  // Anyone who reviews POs (approval) or reports on them. Covers cania/visca,
  // who generate POs but never see the approval queue.
  // 'po-saya' ditambahkan, dan URUTANNYA penting: openTarget memakai layar
  // PERTAMA yang dipegang perannya. wilbert tetap mendarat di antrean
  // persetujuan; cania dan visca mendarat di PO Saya. Sebelum ini daftarnya
  // hanya ['approval'], jadi hasil pencarian PO milik cania muncul TANPA tombol
  // Buka sama sekali — kelihatan, tapi buntu.
  //
  // PO Saya membaca `selPO` selain `poSayaSel` justru untuk ini, dan dia mau
  // menampilkan PO siapa pun yang boleh dibaca — daftar di kirinya tetap hanya
  // PO miliknya, dan tombolnya tetap diputuskan bolehUrusSendiri().
  //
  // 'outstanding-po' ditambahkan paling belakang UNTUK GUDANG. Mereka memegang
  // satu layar yang isinya PO dan tidak bisa mencari satu pun nomor di
  // dalamnya; orang yang membongkar kardus dan memegang surat jalan di tangan
  // justru yang paling sering punya satu nomor PO dan perlu tahu barisnya.
  // Tidak ada data baru yang terbuka: nomor dan pemasok memang sudah tergambar
  // di layar itu. Yang perlu diingat, layar itu cuma memuat baris yang BELUM
  // lengkap datang, jadi PO yang sudah tutup akan mendarat di daftar yang tidak
  // memuatnya — sama sifatnya dengan antrean persetujuan milik wilbert.
  'PO': {
    screens: ['approval', 'po-saya', 'outstanding-po'],
    visible: r => hasScreen(r, 'approval') || hasScreen(r, 'po-saya') || hasScreen(r, 'outstanding-po') || hasModule(r, 'PO'),
  },
  // Invoice intake lives on Payment (sekar); overdue invoices show on Finance.
  'Invoice': { screens: ['payment', 'finance'], visible: r => hasScreen(r, 'payment') || hasScreen(r, 'finance') },
  // Straightforward: the screen is the only place these are used.
  'Surat Jalan': { screens: ['surat-jalan'], visible: r => hasScreen(r, 'surat-jalan') },
  // THE ONE THAT WAS LEAKING. Report module, not screen access — cania/visca
  // hold the Payment screen in PRF-generate-only mode, so a screen check would
  // have left the leak exactly as it was.
  'PRF': { screens: ['payment', 'finance'], visible: r => hasModule(r, 'PRF') },
  'PPKEK': { screens: ['ppkek'], visible: r => hasScreen(r, 'ppkek') },
  // DESIGN — 690 kartu yang sebelumnya TIDAK PERNAH bisa dicari sama sekali.
  //
  // Perpustakaan design justru yang paling butuh pencarian di antara semuanya:
  // dia satu-satunya layar yang isinya ratusan kartu gambar tanpa nomor
  // dokumen, jadi satu-satunya cara menemukan satu kartu adalah menggulir.
  // Targetnya libPreview, bukan cuma layarnya — hasil pencarian yang mendarat
  // di halaman 1 dari 69 halaman sama tidak berguna dengan tidak ada hasil.
  //
  // hasModule('Label') ikut supaya peran yang melaporkan label tanpa memegang
  // layar perpustakaannya tetap bisa MELIHAT hasilnya (tombol Buka-nya yang
  // nanti hilang lewat openTarget, bukan hasilnya yang disembunyikan).
  'Design': { screens: ['label-library'], visible: r => hasScreen(r, 'label-library') || hasModule(r, 'Label') },
  // LABEL STOCK — juga belum pernah bisa dicari.
  //
  // Ini satu-satunya tempat yang memetakan kode ERP ke spec, dan "ERP ini
  // barang apa" adalah pertanyaan yang paling sering dibawa orang ke kotak
  // pencarian. sona ikut dapat, dan itu memang benar: dia yang memegang rutin
  // mingguannya. Sebelum ini searchableTypes(sona) kosong sehingga kotak
  // pencariannya disembunyikan total — dia tidak bisa mencari di layar yang
  // justru dia sendiri yang isi.
  'Label Stock': { screens: ['label-stock'], visible: r => hasScreen(r, 'label-stock') },
};

// The screen THIS role should be taken to for this type, or null if none of the
// candidates is available to them. sona could previously search a PO and click
// through to the approval screen she has no access to, landing on the
// "belum punya hak akses" box.
export function openTarget(role, type) {
  const cfg = SEARCH_TYPES[type];
  if (!cfg || !role) return null;
  return cfg.screens.find(id => hasScreen(role, id)) || null;
}

export function canOpen(role, type) { return !!openTarget(role, type); }

// True when this role can search for nothing at all. layout.js hides the
// box entirely rather than offering a field that always answers "no results".
export function searchableTypes(role) {
  return Object.keys(SEARCH_TYPES).filter(k => SEARCH_TYPES[k].visible(role));
}

// KUOTA PER TIPE, BUKAN POTONGAN DI UJUNG.
//
// Dulu seluruh hasil didorong ke satu array berurutan per tipe — PO dulu,
// Design paling akhir — lalu .slice(0, 15). Konsekuensinya tidak kelihatan dari
// kodenya tapi fatal: begitu 15 PO cocok, Invoice, PRF, Surat Jalan dan Design
// TIDAK PERNAH muncul, berapa pun cocoknya. Dan kata yang dipakai orang di
// portal ini — nama pemasok, kode ERP, kode pola — memang cocok ke banyak PO
// sekaligus. Jadi tipe yang paling sering kalah justru yang paling spesifik.
//
// Sekarang tiap tipe punya kuotanya sendiri lalu digabung BERGILIRAN, jadi
// baris pertama dari setiap tipe selalu kebagian tempat sebelum baris kedua
// tipe mana pun.
const KUOTA_PER_TIPE = 6;
const MAKS_HASIL = 24;

export function globalSearch(st, q) {
  const mentah = String(q || '').trim();
  if (!mentah) return [];
  const qLower = mentah.toLowerCase();
  const qNorm = norm(mentah);

  // Lapis ternormalisasi hanya dipakai dari 3 karakter ke atas. Di bawah itu
  // dia merugikan: norm('a') = 'A' akan cocok ke hampir setiap baris di basis
  // data, dan hasil pencarian yang memuat segalanya sama tidak berguna dengan
  // yang memuat nol. Substring mentah tetap jalan untuk 1-2 karakter.
  const pakaiNorm = qNorm.length >= 3;
  const hit = s => {
    if (s == null) return false;
    const v = String(s);
    if (v.toLowerCase().includes(qLower)) return true;
    return pakaiNorm && norm(v).includes(qNorm);
  };
  // Mencari di beberapa medan sekaligus.
  const hitAny = (...xs) => xs.some(hit);

  // A file/driveUrl is only worth linking to once it's a real webViewLink —
  // uploadToDrive() placeholders (`drive-pending://`, `drive-error://`) are
  // not openable, same guard ui/components.js's driveLink() already applies
  // everywhere else a Drive link is shown.
  const realUrl = u => (u && !String(u).startsWith('drive-')) ? u : null;

  // Role of the CURRENT session. A missing user (pre-login) can search nothing.
  const role = st.user ? st.user.role : null;
  const may = type => !!role && SEARCH_TYPES[type].visible(role);

  // Satu keranjang per tipe, masing-masing berhenti di kuotanya sendiri.
  const keranjang = new Map();
  const taruh = (type, r) => {
    let arr = keranjang.get(type);
    if (!arr) { arr = []; keranjang.set(type, arr); }
    if (arr.length < KUOTA_PER_TIPE) arr.push(r);
  };
  const penuh = type => (keranjang.get(type) || []).length >= KUOTA_PER_TIPE;

  if (may('PO')) for (const p of st.pos || []) {
    if (penuh('PO')) break;
    // Kepala dokumennya dulu — nomor PO, kontrak, nama pemasok.
    if (hitAny(p.no, p.contract, p.supplier, p.supplierZh)) {
      taruh('PO', { type: 'PO', id: p.no, sub: p.supplier, ref: p, drive: null });
      continue;
    }
    // BARIS DI DALAMNYA. Ini lubang terbesarnya: kode ERP dan nama barang
    // hidup di dalam po.items dan tidak pernah dicari sama sekali, padahal
    // justru itu yang diketik orang — nomor PO-nya yang sedang dia cari.
    // `cn` ikut karena separuh baris di basis data ini bernama Mandarin saja.
    const it = (p.items || []).find(x => x && hitAny(x.erp, x.d, x.cn, x.dimension));
    if (it) {
      // Sub-barisnya menyebut BARIS MANA yang cocok, bukan nama pemasok.
      // Satu PO bisa memuat 40 baris; tanpa ini orangnya melihat nomor PO
      // muncul entah kenapa dan harus membuka dokumennya untuk tahu sebabnya.
      taruh('PO', {
        type: 'PO', id: p.no, ref: p, drive: null,
        sub: [it.erp, it.d || it.cn].filter(Boolean).join(' · ') || p.supplier,
      });
    }
  }

  if (may('Invoice')) for (const i of st.invoices || []) {
    if (penuh('Invoice')) break;
    if (hitAny(i.no, i.supplier, i.poRef)) {
      taruh('Invoice', { type: 'Invoice', id: i.no, sub: i.supplier, ref: i, drive: realUrl(i.files && i.files[0] && i.files[0].url) });
    }
  }

  if (may('Surat Jalan')) for (const s of st.suratJalan || []) {
    if (penuh('Surat Jalan')) break;
    if (hitAny(s.no, s.docNo, s.supplier, s.poNo)) {
      taruh('Surat Jalan', { type: 'Surat Jalan', id: s.no, sub: s.supplier, ref: s, drive: realUrl(s.driveUrl) });
    }
  }

  if (may('PRF')) for (const p of st.prfs || []) {
    if (penuh('PRF')) break;
    if (hitAny(p.no, p.supplier)) {
      taruh('PRF', { type: 'PRF', id: p.no, sub: p.supplier, ref: p, drive: null });
    }
  }

  if (may('PPKEK')) for (const k of st.ppkek || []) {
    if (penuh('PPKEK')) break;
    // contractNo ikut: nomor kontrak itu yang menyambungkan PPKEK ke PO-nya,
    // dan orang yang memegang satu PPKEK biasanya sedang menelusuri ke sana.
    if (hitAny(k.nopen, k.supplier, k.contractNo)) {
      taruh('PPKEK', { type: 'PPKEK', id: k.nopen, sub: k.supplier, ref: k, drive: realUrl(k.driveUrl) });
    }
  }

  if (may('Design')) for (const d of st.designs || []) {
    if (penuh('Design')) break;
    if (hitAny(d.erp, d.spec, d.brand, d.market)) {
      // Kartu tanpa ERP itu nyata — 101 dari 690 — jadi id-nya jatuh ke spec
      // daripada menampilkan '—' yang tidak bisa dipakai mengenali apa pun.
      taruh('Design', {
        type: 'Design', id: d.erp || d.spec, ref: d, drive: realUrl(d.driveUrl),
        sub: d.erp ? d.spec : [d.brand, d.market].filter(Boolean).join(' · '),
      });
    }
  }

  if (may('Label Stock')) for (const s of st.labelStock || []) {
    if (penuh('Label Stock')) break;
    if (hitAny(s.erp, s.spec, s.market)) {
      taruh('Label Stock', {
        type: 'Label Stock', id: s.erp || s.spec, ref: s, drive: null,
        sub: [s.spec, s.market].filter(Boolean).join(' · '),
      });
    }
  }

  // Gabung bergiliran: baris ke-n dari setiap tipe, lalu baris ke-(n+1).
  const hasil = [];
  const arrs = [...keranjang.values()];
  for (let i = 0; i < KUOTA_PER_TIPE && hasil.length < MAKS_HASIL; i++) {
    for (const arr of arrs) {
      if (i < arr.length) {
        hasil.push(arr[i]);
        if (hasil.length >= MAKS_HASIL) break;
      }
    }
  }
  return hasil;
}
