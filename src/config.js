import { VERSION } from './version.js';

// =============================================================================
// MTI Purchasing Portal — CONFIGURATION
// -----------------------------------------------------------------------------
// Fill these in to connect the app to your own Supabase project and Google Drive
// service-account Edge Function. Until then, the app runs fully in DEMO MODE
// (in-memory data only, seeded from the sample documents). See SETUP.md.
// =============================================================================

// -----------------------------------------------------------------------------
// SUPABASE  (auth + Postgres + RLS)
// Project URL + anon/public key (Dashboard -> Project Settings -> API).
// Leave either as '' to force DEMO MODE (in-memory, no network). FEATURES.useSupabase
// below stays false until both are set.
// -----------------------------------------------------------------------------
export const SUPABASE_URL = 'https://niastiawhhsyzudihlzw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYXN0aWF3aGhzeXp1ZGlobHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0OTA0NTMsImV4cCI6MjEwMDA2NjQ1M30.Nj-VUjvrAdraijnjO5MVJWHj-gpFLTn-8vX2ehV0IwU';

// -----------------------------------------------------------------------------
// GOOGLE DRIVE  (file storage via a service-account Supabase Edge Function)
// All uploads are proxied through an Edge Function that holds the service-account
// JSON server-side (the browser never sees the private key). See:
//   supabase/functions/drive-upload/index.ts  and  SETUP.md.
// If DRIVE_UPLOAD_URL is empty OR the function is not configured, uploads
// degrade gracefully: the app keeps working and records a local placeholder link.
// -----------------------------------------------------------------------------
export const DRIVE_UPLOAD_URL = `${SUPABASE_URL}/functions/v1/drive-upload`;
// Root "MTI Portal Files" folder in purchase.ptmti@gmail.com's Drive. The Edge
// Function creates/caches per-category subfolders under this (PPKEK, Invoice,
// Bukti Bayar, Surat Jalan, ...) — see supabase/functions/drive-upload/index.ts.
export const DRIVE_ROOT_FOLDER_ID = '1OwIcxTn03Uoi1kQLtAwFjbigRZhgXe63';

// -----------------------------------------------------------------------------
// APPLICANT printed on an IMPORT PRF.
//
// A PRF for an overseas supplier prints this name in "Applicant / 申请人"
// instead of the logged-in user, because the import desk belongs to one person
// and the counterparties know her by name. It is a PRINT rule only — the
// database still stores who actually created the PRF, and the audit trail
// still names them, so the question "who raised this?" always has a real
// answer regardless of what the paper says.
//
// Set to '' to switch it off and print the real user on every PRF.
// Domestic suppliers are never affected.
// -----------------------------------------------------------------------------
export const IMPORT_APPLICANT = 'ZHANG PEI YAN';

// -----------------------------------------------------------------------------
// Company constants (used in generated documents). Adjust if needed.
// -----------------------------------------------------------------------------
export const COMPANY = {
  name: 'PT. MATAHARI TIRE INDONESIA',
  short: 'MTI',
  plant: 'Kawasan Ekonomi Khusus Kendal',
  addressLines: [
    'Jl. Raya Industri Blok C-12, Kendal 51371',
    'Jawa Tengah, Indonesia',
  ],
  npwp: '01.234.567.8-051.000',
  tel: '+62 294 388 1200',
  email: 'purchasing@mti.co.id',
  // Single source in src/version.js — this alias stays so the PRF footer and
  // anything else reading COMPANY.version keeps working.
  version: VERSION,
};

// Login uses usernames mapped to internal emails (Supabase Auth uses email).
// TODO(you): after creating these 5 users in Supabase Auth with password 88888888,
// keep this mapping in sync (or change the domain).
export const EMAIL_DOMAIN = 'mti.co.id';

// Shared demo password (as specified). Only relevant to the DEMO login helper.
export const DEMO_PASSWORD = '88888888';

// Feature flags
export const FEATURES = {
  // When true and Supabase is configured, the app persists to Postgres.
  // When false OR unconfigured, everything stays in-memory (never localStorage).
  useSupabase: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  useDrive: Boolean(DRIVE_UPLOAD_URL),
};
