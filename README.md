# MTI Purchasing Portal

Internal purchasing web app for **PT. Matahari Tire Indonesia** (KEK Kendal).
Single-page app, **no build step**, deployable to **GitHub Pages**. Auth + data via
**Supabase** (with Row Level Security); file storage via **Google Drive** through a
service-account Edge Function. All parsing is **rule-based** (zero paid AI).

> Quick start: `npm run start` → open <http://localhost:5173> → login `wilbert` / `88888888`.
> Full cloud setup in **[SETUP.md](./SETUP.md)**.

## Highlights

- **Trilingual** UI (Indonesian / English / Mandarin) with a header switcher; the
  preference is saved per account.
- **5 roles**, role-gated menus (hidden) + RLS (blocked): `wilbert` (full + approvals),
  `cania`/`visca` (label, PO converter, master data), `sekar` (PPKEK + payment,
  payment-status read-only), `financemti` (finance only).
- **Design system** faithful to `design/MTI Purchasing Portal.dc.html` (navy `#1B3A6B`,
  orange `#F26722`, Plus Jakarta Sans, IBM Plex Mono, light + dark themes).

## Modules

1. **Label (jalur 1)** — Excel upload, multi-sheet picker, rule-based parse with the
   **shifted-PR-header** auto-fix, brand mapping (威狮→WESTLAKE …), design-library check,
   supplier assignment → grouped POs, PO generator (payment term + PPN choice, unit 张).
   Plus the **Label Design Library** and the **Surat Jalan Verifikasi** generator
   (matches the sample format, printable on white paper).
2. **PO Converter (jalur 2)** — parses the ZC ERP PO PDF (rejects scans), popup for
   payment terms / contract no / PPN, generates the English-first PO (unit 条).
3. **Approval flow** — cania/visca POs → "Menunggu Approval"; wilbert approves →
   embeds the **company seal** (`cap_mti.png`) + signature; capped PO downloadable.
4. **PPKEK (jalur 3)** — RAR/ZIP extract in-browser, PDF parse (LDP/TLDDP auto-tab),
   Drive upload per doc, editable register, **round-trip Excel** (hidden row-ID →
   diff preview → apply), 2-tab LDP/TLDDP report.
5. **Payment / PRF** — invoice intake, faktur-pajak reminder (only when PO PPN=Dibayar),
   PRF builder with currency split, **amount-in-words in EN + ZH** (rule-based),
   bank details always from supplier master (anti-fraud), learning description dict,
   4-stage state machine with full timestamp/user log.
6. **Finance dashboard** — overdue banner, 4-item receive checklist, payment-proof
   **parser registry** (Standard Chartered + ICBC BI-FAST, unknown → manual),
   amount + fuzzy-payee (+ PO no) auto-match → confirm → Paid → filed to Drive.
   `sekar` sees paid/unpaid read-only.

Every module is **exportable to Excel** with live Drive hyperlinks; full audit trail.

## Project layout

```
index.html                     # importmap (CDN deps) + mounts the app
supabase_schema.sql            # all tables + RLS policies
SETUP.md                       # exactly what to configure manually
.nojekyll                      # serve src/ on GitHub Pages
supabase/functions/drive-upload/index.ts   # service-account Drive proxy (Edge Function)
src/
  config.js                    # SUPABASE_* / DRIVE_* placeholders (TODO)
  main.js                      # bootstrap + render loop + router
  core/                        # dom, store (in-memory), format, supabase, drive, xlsx, seed, icons
  i18n/                        # dict.js (id/en/zh) + index.js
  auth/                        # roles.js (access + caps) + session.js
  parsers/                     # excelLabels, zcPoPdf, ppkekPdf, bankProof (registry),
                               # amountWords, brandMap, itemName, pdf, archive
  ui/                          # components, layout, documents (Contract/Surat Jalan/PRF)
  screens/                     # one file per module
  styles/                      # tokens.css (theme), app.css, print.css
  assets/images.js             # base64 logo + seal
```

## Tech notes

- No bundler: bare imports resolve via the `<script type="importmap">` in `index.html`
  (Supabase, SheetJS/xlsx, pdf.js, JSZip, libarchive.js from CDN). Self-host these for
  air-gapped use.
- Rule-based parsers were validated against the real files in `samples/` (label Excel
  incl. the shifted-PR sheet, PPKEK LDP/TLDDP, the Standard Chartered proof, the PRF).
