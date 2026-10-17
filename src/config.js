// Runtime configuration from Vite environment variables (see .env.example).
// Only PUBLIC values belong here — the anon key is safe to ship because every
// table is protected by Row Level Security.

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

/** Without a backend configured the portal runs on /data/demo-content.json. */
export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const SNAPSHOT_URL = DEMO_MODE ? '' : `${SUPABASE_URL}/storage/v1/object/public/snapshot/content.json`;

export function storageUrl(bucket, path) {
  if (!path) return null;
  if (DEMO_MODE) return null;
  const clean = String(path).split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${clean}`;
}

export function functionUrl(name) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

export function publicHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
}
