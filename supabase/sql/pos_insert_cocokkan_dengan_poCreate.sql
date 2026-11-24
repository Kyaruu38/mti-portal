-- =====================================================================
-- pos_insert_cocokkan_dengan_poCreate.sql        dijalankan: 24 Nov 2026
--
-- PEMBAGIAN KERJA YANG CUMA DIJAGA JAVASCRIPT.
--
-- Keputusan pemilik, 31 Juli 2026, tertulis di src/auth/roles.js:
-- "sona ASKS, she does not raise the PO" — kapabilitas poCreate dicabut
-- dari sona. Dia yang meminta label, purchasing yang menerbitkan PO-nya.
--
-- Di browser itu memang ditegakkan: tombolnya tidak ada. Tapi policy-nya
-- berbunyi:
--
--   pos_insert => is_label_staff()
--                 AND (status = 'Menunggu Approval'
--                      OR (is_admin() AND status = 'Approved'))
--
-- dan is_label_staff() = visca + cania + wilbert + SONA. Jadi basis data
-- tetap menerima INSERT PO dari akun sona. Satu-satunya yang mencegahnya
-- adalah tidak adanya tombol — dan portal ini situs statis dengan anon key
-- publik, jadi siapa pun yang pegang login sona bisa mengirim INSERT-nya
-- langsung ke PostgREST tanpa pernah membuka portalnya.
--
-- Akibatnya diredam, bukan ditutup: status terpaksa 'Menunggu Approval',
-- jadi PO-nya tetap harus disetujui. Yang hilang adalah batasnya sendiri.
--
-- is_purchasing() = visca + cania + wilbert — PERSIS pemegang poCreate.
-- Jadi policy ini sekarang mengatakan hal yang sama dengan roles.js,
-- bukan sesuatu yang kebetulan mirip.
--
-- YANG TIDAK DISENTUH, dan sengaja:
--   * is_label_staff() sendiri. label_stock.ALL memakainya, dan itu MEMANG
--     pekerjaan mingguan sona. Mengeluarkan dia dari fungsinya akan
--     mematikan rutinitas stok label — memperbaiki satu hal dengan
--     merusak satu hal lain.
--   * pos_read. sona tetap boleh MELIHAT PO; dia memang perlu, karena
--     permintaan labelnya berakhir jadi PO yang harus dia lacak.
--   * Cabang is_admin() untuk status 'Approved'. wilbert menerbitkan PO
--     yang langsung disetujui; itu tidak berubah.
--
-- DIPERIKSA SEBELUM DIJALANKAN: tidak ada fungsi, trigger, atau RPC di
-- repo ini yang menyisipkan ke public.pos (dicari di seluruh *.sql), dan
-- di sisi kode hanya ada DUA pemanggil insertPO() — screens/labelRequest.js
-- dan screens/poConverter.js — yang dua-duanya sudah digerbangi poCreate.
-- Jadi tidak ada jalur sah yang kehilangan haknya karena perubahan ini.
--
-- DIVERIFIKASI SESUDAH DIJALANKAN, dibaca ulang dari pg_policies:
--   pos_insert [INSERT] => (is_purchasing() AND ((status = 'Menunggu
--   Approval') OR (is_admin() AND (status = 'Approved'))))
-- =====================================================================

drop policy if exists pos_insert on public.pos;

create policy pos_insert on public.pos for insert with check (
  public.is_purchasing()
  and (
    status = 'Menunggu Approval'
    or (public.is_admin() and status = 'Approved')
  )
);
