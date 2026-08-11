// Siapa boleh mengapakan sebuah PO. SATU rumah untuk aturannya.
//
// Aturannya dipakai di DUA layar — Approval (punya wilbert) dan PO Saya (punya
// cania & visca) — dan sebuah aturan hak akses yang disalin ke dua tempat
// adalah dua aturan yang suatu hari berbeda pendapat. Yang kalah dalam
// perselisihan itu selalu sisi yang lebih KETAT, karena sisi yang ketat
// menghasilkan keluhan hari itu juga dan sisi yang longgar tidak menghasilkan
// apa-apa sampai terlambat. Yang diperbaiki adalah yang berisik, dan yang
// berisik bukan yang berbahaya.
//
// Ini lapisan PERTAMA dari tiga (tombol → guard.js → RLS + trigger). Dia
// menyembunyikan tombol, bukan menegakkan apa pun. Yang menegakkan ada di
// basis data: pos_update, pos_guard_approved_trg, dan RPC
// delete_own_pending_po yang memeriksa kepemilikan DAN status terhadap baris
// yang sesungguhnya. Lihat supabase_po_edit_hapus.sql.
import { can, isReadOnly } from '../auth/roles.js';
import { UUID_RE } from './supabase.js';
import { getState, setState, toast, logAudit } from './store.js';
import { blockWrite } from './guard.js';
import { tr } from '../i18n/index.js';
import { deleteOwnPendingPo, requestPoDelete } from './posApi.js';

// Boleh membenahi dan membuang PO ini sendiri, tanpa mengantre ke supervisor?
//
// KEPEMILIKAN dan STATUS, bukan peran saja. `poCreate` menjawab "boleh bikin
// PO", bukan "boleh mengubah PO INI"; tanpa pemeriksaan kepemilikan, cania
// akan bisa membuang PO buatan visca yang belum disetujui.
//
// `!can(approve)` di depan dengan sengaja. Tanpa itu wilbert ikut masuk (dia
// memegang poCreate dan bisa jadi pembuat PO-nya), dan di layar Approval dua
// hal terjadi sekaligus: cabang supervisor menang sehingga dia tidak dapat
// tombol Hapus, DAN pemeriksaan `!bolehUrusSendiri` mencabut Request Delete
// miliknya. Dia jadi tidak punya jalan menghapus sama sekali untuk PO buatan
// sendiri yang kembali ke antrean karena diedit komersial. Jalur supervisor
// dibiarkan persis seperti sebelumnya.
//
// isReadOnly() diperiksa dengan alasan yang sama seperti di canRequestDelete:
// akun read-only tidak memegang capability apa pun, tapi begitu ada satu PO
// yang `by`-nya kebetulan cocok dengan username-nya — baris seed, hasil impor,
// akun yang di-rename — tombolnya muncul lagi. Kepemilikan menjawab "ini
// punyaku", tidak pernah "aku boleh menulis".
//
// UUID_RE: PO yang belum tersinkron ke server tidak punya baris untuk diubah
// atau dihapus di sana. Menawarkan tombolnya cuma menjanjikan yang tidak bisa
// ditepati.
// `!po.deleteRequested`: kalau ada permintaan hapus yang MASIH MENGGANTUNG,
// PO-nya sedang diperebutkan dan tombol Hapus langsung di sebelah spanduk
// "menunggu approval Wilbert" adalah dua kontrol yang saling membantah. Bisa
// terjadi lewat dua jalan: wilbert mengajukan hapus atas PO pending buatan
// cania, atau PO yang sudah disetujui dan sudah diminta hapus dikembalikan ke
// antrean oleh edit komersial — savePoEdit() mengembalikan statusnya tapi tidak
// pernah membersihkan delete_requested. Menahan tombolnya di sini menutup
// keduanya tanpa menyentuh basis data; begitu wilbert menolak atau menyetujui
// permintaannya, tombolnya balik.
export function bolehUrusSendiri(st, po) {
  if (!st || !po) return false;
  const peran = st.user && st.user.role;
  return po.status === 'Menunggu Approval'
    && !po.deleteRequested
    && UUID_RE.test(String(po.id))
    && po.by === (st.user && st.user.username)
    && !isReadOnly(peran)
    && !can(peran, 'approve')
    && can(peran, 'poCreate');
}

// PO yang dibuat oleh yang sedang login. Dipakai layar PO Saya dan kartu
// "PO Saya" di Dashboard supaya keduanya menampilkan himpunan yang sama —
// dulu dashboard menyaringnya sendiri dan tidak ada yang menjamin keduanya
// sepakat.
//
// URUTANNYA ikut di sini, bukan di pemanggilnya. Dashboard memotong daftarnya
// di 12 baris; kalau urutannya ditentukan pemanggil, satu layar bisa memotong
// dari ujung yang berbeda dengan yang lain dan "12 PO terbaru" jadi 12 PO
// sembarang. Terbaru di atas, karena yang baru dibuat itu yang sedang diurus.
//
// .filter() sudah mengembalikan array baru, jadi .sort() di sini tidak
// menyentuh st.pos.
export function poMilikku(st) {
  const aku = st.user && st.user.username;
  return (st.pos || [])
    .filter(p => p.by === aku)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// ---------------------------------------------------------------------------
// hapusPoSendiri — SATU tindakan, dipakai dua layar.
//
// Aturan izinnya sudah dipindah ke sini supaya tidak ada dua salinan; lalu
// TINDAKAN yang dijaga aturan itu dibiarkan tersalin verbatim di dua layar,
// yang mengulangi kesalahan yang sama satu tingkat di bawahnya. Keduanya
// bahkan sudah sempat menyimpang: satu memanggil `UUID_RE.test(po.id)` dan
// satunya `UUID_RE.test(String(po.id))`, dan kalimat konfirmasinya berbeda —
// dua peringatan berbeda untuk RPC yang sama persis.
//
// `bersihkan` dipanggil sesudah barisnya hilang, supaya tiap layar bisa
// mengosongkan kunci pilihannya sendiri (selPO vs poSayaSel) tanpa fungsi ini
// perlu tahu layar mana yang memanggilnya.
export async function hapusPoSendiri(po, { bersihkan } = {}) {
  const st = getState();
  if (blockWrite('hapus PO sendiri')) return false;
  if (!UUID_RE.test(String(po.id))) {
    toast({
      id: 'PO ini belum tersinkron ke server — tidak ada yang bisa dihapus di sana',
      en: 'This PO never synced to the server — there is nothing there to delete',
      zh: '该采购单未同步到服务器 — 服务器上没有可删除的内容',
    });
    return false;
  }
  // Alasannya diminta — bukan basa-basi konfirmasi, tapi karena PO yang lenyap
  // dari Reports tanpa jejak adalah lubang di catatan, dan enam bulan lagi yang
  // menelusurinya perlu jawaban. Nomornya sendiri justru BEBAS dipakai lagi:
  // pos_no_unik itu unique index PARSIAL, `ON pos (no) WHERE deleted_at IS NULL`.
  const alasan = prompt(tr({
    id: `Hapus PO ${po.no}? Barisnya hilang dari semua layar dan dari Reports; nomornya bebas dipakai lagi. Alasan:`,
    en: `Delete PO ${po.no}? The row disappears from every screen and from Reports; the number becomes reusable. Reason:`,
    zh: `删除采购单 ${po.no}？该行将从所有页面和报表中消失；编号可再次使用。原因：`,
  }));
  if (!alasan || !alasan.trim()) return false;
  try {
    await deleteOwnPendingPo(po.id, alasan.trim());
    const idx = st.pos.indexOf(po);
    if (idx >= 0) st.pos.splice(idx, 1);
    logAudit({ entity: 'po', target: po.no, action: 'delete_own_pending', detail: alasan.trim() });
    toast({ id: `PO ${po.no} dihapus`, en: `PO ${po.no} deleted`, zh: `采购单 ${po.no} 已删除` });
    if (bersihkan) bersihkan();
    return true;
  } catch (e) {
    console.error('deleteOwnPendingPo gagal', e);
    // Server yang menolak, bukan layar. Kalau statusnya berubah jadi Approved di
    // sela-sela, pesan penolakannya datang dari RPC dan menyebutkan itu.
    toast({ id: 'Gagal hapus PO: ' + (e.message || e), en: 'Failed to delete PO: ' + (e.message || e), zh: '删除采购单失败：' + (e.message || e) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// PERMINTAAN HAPUS — jalur untuk PO yang SUDAH disetujui.
//
// Dipisah dari hapusPoSendiri dengan sengaja: yang itu untuk PO yang belum
// ditandatangani siapa pun dan boleh lenyap tanpa bertanya; yang ini untuk
// dokumen yang sudah dicap, dan cuma wilbert yang boleh mengakhirinya.
//
// Ini nyaris jadi cacat v15.4 yang KEDUA. Tombolnya cuma ada di layar
// Approval, dan cania serta visca tidak punya layar itu — jadi PO mereka yang
// sudah disetujui dengan harga salah tidak punya JALAN SAMA SEKALI untuk
// dicabut, sementara nilainya terus ikut terhitung di Reports. Persis bentuk
// kesalahan yang sama, satu nilai status di sebelahnya.
export function bolehMintaHapus(st, po) {
  if (!st || !po) return false;
  const peran = st.user && st.user.role;
  return UUID_RE.test(String(po.id))
    && !po.deleteRequested
    && !isReadOnly(peran)
    && (po.by === (st.user && st.user.username) || can(peran, 'approve'))
    // Kalau dia sudah boleh menghapusnya langsung, dua tombol berbeda yang
    // menuju hal yang sama cuma bikin orang menebak mana yang benar.
    && !bolehUrusSendiri(st, po);
}

export async function mintaHapusPo(po) {
  if (blockWrite('request hapus PO')) return false;
  const alasan = prompt(tr({ id: 'Alasan hapus PO ini?', en: 'Reason for deleting this PO?', zh: '删除该采购单的原因？' }));
  if (!alasan || !alasan.trim()) return false;
  try {
    await requestPoDelete(po.id, alasan.trim());
    po.deleteRequested = true; po.deleteReason = alasan.trim();
    logAudit({ entity: 'po', target: po.no, action: 'request_delete', detail: alasan.trim() });
    toast({
      id: `Request hapus PO ${po.no} diajukan — menunggu approval supervisor`,
      en: `Delete request for PO ${po.no} submitted — awaiting supervisor approval`,
      zh: `采购单 ${po.no} 删除申请已提交 — 等待主管审批`,
    });
    setState({});
    return true;
  } catch (e) {
    console.error('requestPoDelete gagal', e);
    toast({ id: 'Gagal ajukan request hapus: ' + (e.message || e), en: 'Failed to submit delete request: ' + (e.message || e), zh: '提交删除申请失败：' + (e.message || e) });
    return false;
  }
}
