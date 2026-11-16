# `supabase/sql/live/` — cermin produksi

Satu berkas per fungsi, isinya keluaran `pg_get_functiondef()` apa adanya,
ditangkap dari basis data produksi pada **16 Nov 2026**.

## Kenapa folder ini ada

Pada 12 Nov 2026 dua PO hilang tanpa satu pesan pun. Penyebabnya bukan kode
yang salah — berkas di repo sudah memegang versi yang benar sejak 11 Nov
09:53. Yang tidak pernah terjadi adalah **menjalankannya ke basis data**.
Perbaikannya selesai di berkas sementara basis datanya tetap memegang yang
rusak, dan **tidak ada apa pun yang membandingkan keduanya**.

Folder ini adalah pembandingnya.

## Aturan bacanya

Berkas di `../` adalah **rancangan**: apa yang kita maksudkan.
Berkas di sini adalah **kenyataan**: apa yang benar-benar berjalan.

Kalau keduanya beda, **yang di sini yang sedang dipakai orang.** Jangan
pernah menganggap rancangan menang hanya karena dia ada di git.

## Yang ditemukan waktu folder ini pertama dibuat

- **63 fungsi hidup di produksi, tapi cuma 19 punya berkas rancangan.**
  44 sisanya — termasuk `create_surat_jalan`, `confirm_prf_paid`,
  `approve_po_delete`, `apply_label_stock_upload` — tidak bisa dibangun
  ulang dari repo kalau basis datanya hilang. Sekarang bisa.
- `dsg_brand` di produksi mengenali **52 merek**; rancangan di repo cuma
  **18**. Menjalankan berkas rancangan akan menghapus 35 deteksi merek.
  Rancangannya sudah ditulis balik agar cocok.
- `sheet_sync_ping` ada di repo sejak 11 Nov tapi **tidak pernah dipasang**.
  Sudah dipasang 16 Nov dan diverifikasi dari katalog.

## Cara memakainya

Sebelum menjalankan berkas apa pun dari `../` ke produksi, baca dulu
padanannya di sini. Kalau yang di sini lebih panjang atau lebih baru,
**berhenti** — kemungkinan besar kamu akan menurunkan produksi.

Segarkan folder ini sesudah setiap perubahan DDL:

```sql
select p.proname as nama, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind in ('f','p')
order by p.proname;
```

Export CSV dari SQL editor, lalu pecah satu berkas per baris.

**Tidak ada rahasia di folder ini** — sudah disisir untuk kunci API, JWT,
service_role, dan nilai token. `jalankan_backup()` membaca secret-nya dari
tabel `backup_config` saat jalan, tidak pernah dari kode.
