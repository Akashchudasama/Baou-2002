// The portal's data layer. Nothing in the UI is hard-coded: every string a
// department member might change arrives through here.
//
// Read path (fastest first):
//   1. sessionStorage copy (instant repeat visits, stale-while-revalidate)
//   2. snapshot/content.json on Supabase Storage CDN (published from /admin)
//   3. public_content() RPC on PostgREST (if the snapshot is unavailable)
//   4. practice database (/data/demo-content.json + edits made in practice
//      mode), used only when no backend is configured

import { DEMO_MODE, SNAPSHOT_URL, SUPABASE_URL, publicHeaders } from '../config.js';
import { buildPublicContent, loadPracticeDb } from './practiceStore.js';

const CACHE_KEY = 'baou-eng-content-v1';
const FRESH_MS = 2 * 60 * 1000;

function timeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(content) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), content }));
  } catch { /* quota or private mode */ }
}

function isValid(c) {
  return c && typeof c === 'object' && Array.isArray(c.sections) && c.settings && typeof c.settings === 'object';
}

async function fetchJson(url, init, ms) {
  const res = await fetch(url, { ...init, signal: timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = await res.json();
  if (!isValid(data)) throw new Error('Malformed content');
  return data;
}

async function fetchFresh() {
  if (DEMO_MODE) return buildPublicContent(await loadPracticeDb());
  try {
    return await fetchJson(SNAPSHOT_URL, { cache: 'no-cache' }, 5000);
  } catch (e) {
    console.warn('[content] snapshot unavailable, using live RPC', e.message);
    return fetchJson(`${SUPABASE_URL}/rest/v1/rpc/public_content`, { method: 'POST', headers: publicHeaders(), body: '{}' }, 8000);
  }
}

/** Removes announcements outside their display window (snapshot may be up to a minute old). */
export function normalise(content) {
  const now = Date.now();
  const c = { ...content };
  for (const k of ['daily', 'messages', 'announcements', 'programs', 'program_courses', 'enrolments', 'documents', 'faculty', 'pantheon', 'toppers', 'links', 'result_notices', 'gallery', 'alumni']) {
    c[k] = Array.isArray(c[k]) ? c[k] : [];
  }
  c.announcements = c.announcements.filter((a) => {
    const s = a.starts_at ? Date.parse(a.starts_at) : null;
    const e = a.ends_at ? Date.parse(a.ends_at) : null;
    return (!s || s <= now) && (!e || e > now);
  });
  c.settings = c.settings || {};
  c.helpdesk_stats = c.helpdesk_stats || { total: 0, resolved: 0 };
  return c;
}

/**
 * Loads content. Resolves as soon as any usable copy exists; if it served a
 * cached copy it revalidates in the background and calls onUpdate on change.
 */
export async function loadContent({ onUpdate } = {}) {
  if (DEMO_MODE) return normalise(await fetchFresh()); // practice edits show immediately
  const cached = readCache();
  if (cached && isValid(cached.content)) {
    const age = Date.now() - cached.at;
    if (age > FRESH_MS) {
      fetchFresh()
        .then((fresh) => {
          writeCache(fresh);
          if (fresh.generated_at !== cached.content.generated_at) onUpdate?.(normalise(fresh));
        })
        .catch(() => {});
    }
    return normalise(cached.content);
  }
  const fresh = await fetchFresh();
  writeCache(fresh);
  return normalise(fresh);
}

/** Setting accessor with fallback; arrays/strings are returned as stored. */
export function setting(content, key, fallback = '') {
  const v = content?.settings?.[key];
  return v == null || v === '' ? fallback : v;
}

/** Parses "Label | https://url" lines from a settings array. */
export function linkList(value) {
  return (Array.isArray(value) ? value : [])
    .map((line) => String(line).split('|').map((x) => x.trim()))
    .filter(([label, url]) => label && url)
    .map(([label, url]) => ({ label, url }));
}

/** Published links for a placement (optionally for one programme). */
export function linksFor(content, placement, programCode) {
  return (content.links || []).filter((l) => l.placement === placement && (!programCode || !l.program_code || l.program_code === programCode));
}

/** Turns a Google Drive share link into its clean preview link; other https links pass through. */
export function documentHref(doc, storageUrlFn) {
  const ext = doc.external_url || doc.url;
  if (ext) {
    const m = String(ext).match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{10,})/);
    return m ? `https://drive.google.com/file/d/${m[1]}/view` : ext;
  }
  return storageUrlFn(doc.file_path);
}
