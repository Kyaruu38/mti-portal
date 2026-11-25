// ---------------------------------------------------------------------------
// PETA ARTWORK DASAR — hasil penyaringan 59 artwork asli, disimpan sebagai data.
//
// APA ISINYA. Untuk tiap (keluarga templat + merek): berkas Drive mana yang
// mewakili keluarga itu, dan APAKAH berkas itu benar-benar bisa disulih.
// Angka-angkanya datang dari alat/dasar/uji-dasar.mjs, yang menjalankan rantai
// yang sama persis dengan jalur artwork di portal — sampai BACA ULANG: nilai
// yang disulih harus terbaca kembali di lapisan teks keluarannya. Bukan
// "fungsinya tidak melempar".
//
// KENAPA PUTUSANNYA IKUT DISIMPAN, BUKAN CUMA ID BERKASNYA. Sebelas dari 59
// artwork itu hurufnya sudah jadi KURVA — lapisan teksnya nol potong, dan
// tidak ada metode sulih apa pun yang bisa menyentuhnya. Tanpa peta ini,
// satu-satunya cara mengetahuinya adalah menunggu prosesnya gagal di tengah
// jalan, tiap kali, untuk tiap orang. Dengan peta ini layarnya bisa bilang di
// muka, dengan sebab yang menyebut persoalannya.
//
// KENAPA ID BERKASNYA AMAN ADA DI REPO PUBLIK — dan artworknya TIDAK. Yang
// tersimpan di sini cuma id Drive dan angka hasil ukur; berkasnya sendiri
// tetap di Drive, di belakang izin Drive dan di belakang drive-download yang
// menolak id yang tidak terdaftar sebagai artwork. Menerbitkan aset merek
// orang lain di repo publik tidak dilakukan, dan itu keputusan yang sama
// dengan yang sudah tertulis di .gitignore untuk alat/aset/.
//
// YANG DIPAKAI KALAU ERP-NYA SUDAH PUNYA ARTWORK SENDIRI: bukan peta ini.
// designs.drive_url milik ERP itu lebih tepat daripada wakil keluarganya, dan
// jalur di dasar.js memakainya lebih dulu. Peta ini untuk ERP BARU — yang
// belum punya design, yang justru paling sering butuh artwork dibuatkan.
//
// Dibuat ulang dengan: node alat/dasar/uji-dasar.mjs  (lihat alat/dasar/)
// ---------------------------------------------------------------------------
import { ejaanResmi } from '../parsers/brandMap.js';

/**
 * p = putusan, d = id Drive wakil keluarga, n = jumlah design di kombinasi ini,
 * r = /Rotate halamannya, s = sebab ditolak, b = [nilai terbaca, nilai disulih]
 * saat disaring.
 */
export const PETA_DASAR = {
  "BX/PCR|TRAZANO": { p:'LOLOS', d:'1MFGsT-8v-RyzqYaqlV7DWxffCaqOuwH1', n:7, b:[5,5] },
  "BX/PCR|WESTLAKE": { p:'LOLOS', d:'1b5jQoCSKM86-1RvR9Vef-hVuUBln4wkg', n:4, b:[5,5] },
  "BX/TBR|ARISUN": { p:'TOLAK', d:'16fKPZl9abz7e6R1WcnaFy5Xz9m4zwcGU', n:1, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "BX/TBR|BRANSALES": { p:'LOLOS', d:'1qX8MTGcSP6p18d7Du_JVRdlA5IBjNvR4', n:2, b:[1,1] },
  "BX/TBR|CHAOYANG": { p:'LOLOS', d:'1JJWVw2JU_bnRZV8RlakHeiippNACDzIW', n:4, b:[4,4] },
  "BX/TBR|GOLDEN CROWN": { p:'LOLOS', d:'1aFEDY4DOFqYfP60TDaOUu7nwsAmn1ZaB', n:4, b:[4,4] },
  "BX/TBR|GRIPMASTER": { p:'LOLOS', d:'1NoRvbTbZalj0Yb3GYe__IJebizE_FQ70', n:4, b:[1,1] },
  "BX/TBR|ITARO": { p:'LOLOS', d:'1LKpKUj5mXtuaK3-v8LN7S_8bvqgqVhyY', n:1, b:[2,2] },
  "BX/TBR|NIPON": { p:'LOLOS', d:'1_LBfDE6szxf5MgRkNIKTjizKh_jLj7jg', n:6, b:[2,2] },
  "BX/TBR|ORNATE": { p:'LOLOS', d:'1YCIbTK-iJaC4nhqX3stxlGtFPo_FKjMU', n:1, b:[2,2] },
  "BX/TBR|SUDESTE": { p:'LOLOS', d:'11YRcPH0P3k1kPpuoVKpXX26KuO0t8IaR', n:1, b:[2,2] },
  "BX/TBR|TKV": { p:'LOLOS', d:'13GRWFYIBIEEs_P4nAQUaB4Lz0ZCuLuUw', n:1, b:[2,2] },
  "BX/TBR|TRAZANO": { p:'TOLAK', d:'1SF7EGP2gJxf5nXWatVI8tNfVbfrbIRE5', n:2, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "BX/TBR|WESTLAKE": { p:'LOLOS', d:'17K2J5w-CcjyJT3nWZKcSWeqxJmy5eOn5', n:8, b:[2,2] },
  "BX/TBR|YARTU": { p:'LOLOS', d:'1nsK74JYyk9l3t_o8O3-qiRHDs1WS1a89', n:2, b:[4,4] },
  "PT/PCR|WESTLAKE": { p:'LOLOS-SEBAGIAN', d:'10cqkOnT2ApAj4eQNqEkGRQUgn-J4ldfw', n:4, s:"2/3 nilai terbaca", b:[2,3] },
  "PT/ST|ARISUN": { p:'LOLOS', d:'1BBtBccZQOSBJbN72Qi3hf7IFezPxetur', n:6, b:[1,1] },
  "PT/ST|GOODRIDE": { p:'LOLOS', d:'15-3bG6s_VOPk--zxyKWDJU74xSiIOke3', n:18, b:[4,4] },
  "PT/ST|HI-RUN": { p:'LOLOS', d:'1klohzWgReH5h4hVrPwmcyvRNt1aIKKPf', n:7, b:[1,1] },
  "PT/ST|REDCLIFF": { p:'LOLOS', d:'1gOQ3N3eP3FvgJOYai4aYNJs3z4zosJRO', n:1, b:[1,1] },
  "PT/ST|SUPERMAX": { p:'LOLOS', d:'1PtrMNH3Hu82J1luGLxfr0kKXMvGHK5Kx', n:1, b:[2,2] },
  "PT/ST|TRAVELSTAR": { p:'TOLAK', d:'1mdlBormz19esiUBBN4r2AMP4aYIgBcx3', n:4, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "PT/ST|WESTLAKE": { p:'LOLOS', d:'1V336f8khiXYfvH6lavJSLARFTIYxQS2s', n:6, b:[2,2] },
  "PT/TBR|AGGRESSOR": { p:'LOLOS', d:'1pzPp_oFna7x0dyfbX4zx9p5eh5SulHBt', n:1, b:[7,7] },
  "PT/TBR|AMERICAN ROADSTAR": { p:'LOLOS', d:'1H-SwfvGVxTyjs8COTuCecUNoKCcrqz9w', n:17, b:[2,2] },
  "PT/TBR|ARISUN": { p:'LOLOS', d:'1jZ_pSIlS1smXT_1NTAud2AXoxxWYjb0F', n:5, b:[6,6] },
  "PT/TBR|ARROYO": { p:'LOLOS', d:'16EcvY07HnYlcX_Dq-j9pru9mTBd0MFMh', n:18, b:[2,2] },
  "PT/TBR|CAPITOL": { p:'LOLOS', d:'1EekL0aZwW5qONWjsJVR7qZRlDeUEVuV8', n:34, b:[3,3] },
  "PT/TBR|CHAOYANG": { p:'LOLOS', d:'1WQw9sAHHu2HEKGSO1-6Kw_wLk-OWfk5g', n:1, b:[5,5] },
  "PT/TBR|GOODRIDE": { p:'LOLOS', d:'1GNxkHqDkqBTqpxCklAJ_D_xxYMpvyFVj', n:17, b:[6,6] },
  "PT/TBR|HERCULES": { p:'TOLAK', d:'1doBLvPj7r81EFKG6y_Gr1kMYVFdRGlZB', n:2, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "PT/TBR|IRONMAN": { p:'TOLAK', d:'1229YpSAQ8r_KIPEL0PnScXYxXwcgw7-m', n:1, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "PT/TBR|MASTERTRACK": { p:'LOLOS', d:'1eu1E10lU3NfVCI2h9_s8cw3usjXDsdx5', n:5, b:[1,1] },
  "PT/TBR|REDCLIFF": { p:'LOLOS', d:'1hNlERb1OCusvSeqXnOWTXIEmQQzvPbTD', n:2, b:[1,1] },
  "PT/TBR|SUPERMAX": { p:'TOLAK', d:'1JYEs12QZcgCKwGN-LmIojJbUAA8L6eVV', n:4, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "PT/TBR|TRAZANO": { p:'LOLOS', d:'1WaDqZZFTNLokWoZQw34yxRfcBObkbOP3', n:6, b:[5,5] },
  "PT/TBR|WESTLAKE": { p:'LOLOS', d:'1jzOSNgRw5fTkGr1dh23c-r9ZMCFsfRN2', n:25, b:[6,6] },
  "PT/TBR|YARTU": { p:'LOLOS-SEBAGIAN', d:'1bIY5SntchBlqZj6zGZb-OqvRdDYuoTCh', n:5, s:"4/5 nilai terbaca", b:[4,5] },
  "SNI/BIAS|CHAOYANG": { p:'LOLOS-SEBAGIAN', d:'1-XKNAjR_mLdU3ZRx-qPn6i2OHTcCX3Ug', n:5, r:270, s:"6/7 nilai terbaca", b:[6,7] },
  "SNI/BIAS|GOLDEN CROWN": { p:'LOLOS', d:'1DRsv6LiqOVTegpGbW52cgiERLljIfhzB', n:1, b:[1,1] },
  "SNI/BIAS|GOODRIDE": { p:'LOLOS', d:'1dAggXxavtpe6wKprMa0JFBn7N5ZmFsbF', n:1, b:[5,5] },
  "SNI/BIAS|HERCULES": { p:'TOLAK', d:'1DM-uLBz3FxMzwiacpwwBlatNVbYDpJ8a', n:1, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "SNI/BIAS|TRAZANO": { p:'LOLOS', d:'19WPvqREDD0H_G3ryJaWA5iESYcGM3O-2', n:3, r:270, b:[7,7] },
  "SNI/BIAS|WESTLAKE": { p:'LOLOS', d:'1UAG0RICcXmZcQLftDQus1PTrb7wzw4OW', n:3, b:[2,2] },
  "SNI/BIAS|YARTU": { p:'LOLOS', d:'1BczOPmMSlMOvFVyxQC6TAsjajveDNUKA', n:3, r:270, b:[7,7] },
  "SNI/TBR|ARISUN": { p:'LOLOS-SEBAGIAN', d:'1qmM-FEjIJlQS7LYDWEQn6liBjP17Ihh_', n:8, s:"6/7 nilai terbaca", b:[6,7] },
  "SNI/TBR|CHAOYANG": { p:'LOLOS', d:'1vtG070nLYDvRqwRh0Y8HeI7IvttsxhVk', n:20, b:[5,5] },
  "SNI/TBR|EFFIPLUS": { p:'LOLOS', d:'1kawNv11_OKJq3GDPbY9dBfpuOa6O1np3', n:1, b:[1,1] },
  "SNI/TBR|GOLDEN CROWN": { p:'LOLOS', d:'1ulFjNa9CvKW0Mwnm0Uxn_7xMl2gXRdGF', n:1, b:[5,5] },
  "SNI/TBR|GOODRIDE": { p:'LOLOS', d:'1QJ7gErUTNplJxhFOpMHd9SCsmWDeDke1', n:5, r:270, b:[5,5] },
  "SNI/TBR|TECHKING": { p:'LOLOS', d:'13Jh4tpbFtHQwh9c6N9fm5cccXTwXcdsn', n:3, b:[3,3] },
  "SNI/TBR|TIANLI": { p:'LOLOS', d:'1pT-IzC-CeDPqEf1IjCDUM9BbpNkt8CqW', n:2, b:[5,5] },
  "SNI/TBR|TRAZANO": { p:'LOLOS', d:'1tnRKwqqObW8dF-Am6vmPMy1pSN-7VM5r', n:9, r:270, b:[5,5] },
  "SNI/TBR|TRUST TRACK": { p:'LOLOS', d:'1HfJQ7wsa-zO8KMabF8iqsHvTTv_0n439', n:1, b:[1,1] },
  "SNI/TBR|UNITED": { p:'LOLOS', d:'1eF_TVwbpWZpkN9cNURz2uHbu943l3TLi', n:1, b:[3,3] },
  "SNI/TBR|VITOUR": { p:'TOLAK', d:'1iYcd-EvNNmb1pcpJqb17EZxTGLrGjvNk', n:2, s:"lapisan teks KOSONG — seluruh hurufnya kurva" },
  "SNI/TBR|WESTLAKE": { p:'LOLOS', d:'1ryY9hRXZXaPpMQsmYICQJSUX17xsGEPt', n:13, b:[6,6] },
  "SNI/TBR|YARTU": { p:'LOLOS', d:'1av3TMrzLy79iDAVWIFDCaVSk2Tw1-xmZ', n:17, r:270, b:[4,4] },
};

/** Kunci peta: keluarga templat + merek dengan EJAAN RESMI-nya. */
export function kunciPeta(kunciTemplat, merek) {
  if (!kunciTemplat) return '';
  const m = String(merek || '').trim();
  if (!m) return '';
  return kunciTemplat + '|' + (ejaanResmi(m) || m.toUpperCase().replace(/\s+/g, ' '));
}

/** @returns {{putusan,driveId,sebab,bisa}|null} */
export function lihatPeta(kunciTemplat, merek) {
  const v = PETA_DASAR[kunciPeta(kunciTemplat, merek)];
  if (!v) return null;
  return {
    putusan: v.p, driveId: v.d || null, sebab: v.s || '',
    putaran: v.r || 0, design: v.n || 0, terbaca: v.b || null,
    bisa: v.p !== 'TOLAK',
  };
}
