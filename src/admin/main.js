// /admin — zero-code console for department staff.
// Auth: Supabase Auth (JWT in sessionStorage, auto-refreshed). Every read and
// write below is re-checked by Row Level Security in the database, so the UI
// role checks are a convenience, not the security boundary.

import '@fontsource/cinzel/500.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/inter';
import '../styles/themes.css';
import '../styles/base.css';
import '../styles/admin.css';

import { createClient } from '@supabase/supabase-js';
import { DEMO_MODE, SUPABASE_ANON_KEY, SUPABASE_URL, functionUrl, storageUrl } from '../config.js';
import { clear, fmtDate, h, safeUrl } from '../lib/dom.js';
import { MODULES, SPECIAL } from './schema.js';
import { createPracticeClient } from './practiceClient.js';
import { resetPracticeDb } from '../lib/practiceStore.js';
import { THEMES } from '../lib/themes.js';

const app = document.getElementById('app');
const IDLE_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// PRACTICE MODE: with no Supabase keys configured, the console runs against a
// practice database kept in this browser (see practiceClient.js). Adding the
// two keys to .env switches it to the real, secured backend — nothing else.
const PRACTICE = DEMO_MODE;

// Capture invite / recovery links before the auth client consumes the URL hash.
const initialType = new URLSearchParams(location.hash.slice(1)).get('type');
let needsPassword = initialType === 'invite' || initialType === 'recovery';

const sb = PRACTICE
  ? createPracticeClient()
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

const state = { session: null, staff: null, module: null, publishTimer: 0 };

// ---------- UI helpers -------------------------------------------------------
const toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
document.body.append(toasts);
function toast(msg, kind = 'ok') {
  const t = h('div', { class: `toast ${kind}` }, msg);
  toasts.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 3500);
}
function friendly(error) {
  const m = error?.message || String(error);
  if (/row-level security|permission denied/i.test(m)) return 'You do not have permission for this action.';
  if (/duplicate key/i.test(m)) return 'An item with that code or address already exists.';
  if (/violates check constraint/i.test(m)) return 'One of the values is not in the expected format.';
  if (/JWT|expired/i.test(m)) return 'Your session expired — please sign in again.';
  return m;
}
const canAccess = (roles) => state.staff && roles.includes(state.staff.role);

// ---------- Publishing (snapshot to CDN) --------------------------------------
const publishStatus = h('span', { class: 'publish-status' });
async function publishNow() {
  clearTimeout(state.publishTimer);
  if (PRACTICE) {
    publishStatus.textContent = 'Saved in practice mode — refresh the website tab to see it';
    publishStatus.className = 'publish-status ok';
    return;
  }
  publishStatus.textContent = 'Publishing…';
  publishStatus.className = 'publish-status busy';
  const { data } = await sb.auth.getSession();
  try {
    const res = await fetch(functionUrl('publish-snapshot'), {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Publish failed (${res.status})`);
    publishStatus.textContent = `Live site updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    publishStatus.className = 'publish-status ok';
  } catch (e) {
    publishStatus.textContent = 'Publish failed — retry';
    publishStatus.className = 'publish-status error';
    toast(friendly(e), 'error');
  }
}
function schedulePublish() {
  clearTimeout(state.publishTimer);
  publishStatus.textContent = 'Changes pending…';
  publishStatus.className = 'publish-status busy';
  state.publishTimer = setTimeout(publishNow, 1500);
}

// ---------- Idle sign-out ------------------------------------------------------
let idleTimer = 0;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await sb.auth.signOut();
    toast('Signed out after 30 minutes of inactivity.', 'error');
  }, IDLE_MS);
}
['pointerdown', 'keydown', 'scroll'].forEach((ev) => window.addEventListener(ev, armIdle, { passive: true }));

// ---------- Auth screens -----------------------------------------------------------
function authShell(...children) {
  clear(app).append(h('main', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
    h('p', { class: 'kicker' }, 'Department of English'),
    h('h1', {}, 'Admin console'),
    ...children)));
}

function renderLogin(message) {
  const form = h('form', { class: 'stack-form' },
    h('div', { class: 'field' }, h('label', { for: 'email' }, 'Email'), h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'username', required: true })),
    h('div', { class: 'field' }, h('label', { for: 'pw' }, 'Password'), h('input', { id: 'pw', name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
    h('button', { class: 'btn btn-ink', type: 'submit' }, 'Sign in'),
    h('button', { class: 'linkish', type: 'button', onclick: () => renderForgot() }, 'Forgot password?'));
  const err = h('p', { class: 'form-msg', role: 'alert' }, message || '');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    err.textContent = '';
    const fd = new FormData(form);
    const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email')).trim(), password: String(fd.get('password')) });
    btn.disabled = false;
    if (error) err.textContent = 'Sign-in failed. Check your email and password.';
  });
  authShell(form, err, h('a', { class: 'back', href: '/' }, '← Back to the website'));
}

function renderForgot() {
  const form = h('form', { class: 'stack-form' },
    h('div', { class: 'field' }, h('label', { for: 'femail' }, 'Your staff email'), h('input', { id: 'femail', name: 'email', type: 'email', required: true })),
    h('button', { class: 'btn btn-ink', type: 'submit' }, 'Send reset link'),
    h('button', { class: 'linkish', type: 'button', onclick: () => renderLogin() }, 'Back to sign in'));
  const msg = h('p', { class: 'form-msg' });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sb.auth.resetPasswordForEmail(String(new FormData(form).get('email')).trim(), { redirectTo: `${location.origin}/admin/` });
    msg.textContent = 'If that address belongs to a staff account, a reset link is on its way.';
  });
  authShell(form, msg);
}

function renderSetPassword() {
  const form = h('form', { class: 'stack-form' },
    h('p', {}, 'Choose a strong password (at least 12 characters, with upper and lower case letters, a digit and a symbol).'),
    h('div', { class: 'field' }, h('label', { for: 'np' }, 'New password'), h('input', { id: 'np', name: 'p1', type: 'password', autocomplete: 'new-password', minlength: '12', required: true })),
    h('div', { class: 'field' }, h('label', { for: 'np2' }, 'Repeat password'), h('input', { id: 'np2', name: 'p2', type: 'password', autocomplete: 'new-password', minlength: '12', required: true })),
    h('button', { class: 'btn btn-ink', type: 'submit' }, 'Save password'));
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const p1 = String(fd.get('p1'));
    if (p1 !== String(fd.get('p2'))) return (msg.textContent = 'The passwords do not match.');
    if (!(p1.length >= 12 && /[a-z]/.test(p1) && /[A-Z]/.test(p1) && /\d/.test(p1) && /[^A-Za-z0-9]/.test(p1))) {
      return (msg.textContent = 'Please meet all the password requirements.');
    }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return (msg.textContent = friendly(error));
    needsPassword = false;
    history.replaceState(null, '', '/admin/');
    toast('Password saved.');
    boot();
  });
  authShell(form, msg);
}

// ---------- Dashboard shell ----------------------------------------------------------
const main = h('main', { class: 'admin-main', id: 'admin-main', tabindex: '-1' });

function renderShell() {
  const nav = h('nav', { class: 'admin-nav', 'aria-label': 'Console sections' },
    h('a', { href: '#home', class: 'nav-item' }, h('span', { 'aria-hidden': 'true' }, '⌂'), 'Dashboard'),
    MODULES.filter((m) => m.nav !== false && canAccess(m.roles)).map((m) => h('a', { href: `#${m.id}`, class: 'nav-item' }, h('span', { 'aria-hidden': 'true' }, m.icon), m.label)),
    h('hr'),
    SPECIAL.filter((m) => canAccess(m.roles)).map((m) => h('a', { href: `#${m.id}`, class: 'nav-item' }, h('span', { 'aria-hidden': 'true' }, m.icon), m.label)));

  clear(app).append(
    h('header', { class: 'admin-top' },
      h('div', { class: 'admin-brand' }, h('span', { class: 'crest-sm' }, 'EN'), h('div', {}, h('strong', {}, 'Department of English'), h('small', {}, 'Admin console'))),
      h('div', { class: 'admin-user' },
        publishStatus,
        canAccess(['admin', 'editor']) ? h('button', { class: 'btn', type: 'button', onclick: publishNow }, 'Publish now') : null,
        h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'View site'),
        h('span', { class: 'who' }, `${state.staff.full_name} · ${state.staff.role}`),
        h('button', { class: 'btn', type: 'button', onclick: () => sb.auth.signOut() }, 'Sign out'))),
    PRACTICE ? h('div', { class: 'practice-banner', role: 'note' },
      h('strong', {}, 'Practice mode. '),
      'Changes are saved only in this browser and appear on the website at localhost (refresh it). Uploaded files are not kept — use a Google Drive link to try documents. ',
      h('button', { class: 'linkish', type: 'button', onclick: () => {
        if (confirm('Erase all practice changes and start again from the sample content?')) { resetPracticeDb(); location.reload(); }
      } }, 'Reset practice data')) : null,
    h('div', { class: 'admin-body' }, nav, main));
  route();
}

function route() {
  const id = location.hash.slice(1) || 'home';
  app.querySelectorAll('.nav-item').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${id}`));
  const mod = MODULES.find((m) => m.id === id);
  if (mod && canAccess(mod.roles)) return crudModule(mod);
  if (id === 'daily' && canAccess(['admin', 'editor'])) return dailyModule();
  if (id === 'enrolment' && canAccess(['admin', 'editor'])) return enrolmentModule();
  if (id === 'helpdesk' && canAccess(['admin', 'helpdesk'])) return helpdeskModule();
  if (id === 'settings' && canAccess(['admin', 'editor'])) return settingsModule();
  if (id === 'staff' && canAccess(['admin'])) return staffModule();
  if (id === 'audit' && canAccess(['admin'])) return auditModule();
  return homeModule();
}
window.addEventListener('hashchange', () => state.staff && route());

function panel(title, help, ...children) {
  clear(main).append(...[h('h1', { class: 'panel-title' }, title), help ? h('p', { class: 'panel-help' }, help) : null, ...children].flat(Infinity).filter(Boolean));
  main.focus({ preventScroll: true });
}

// ---------- Home ---------------------------------------------------------------------
async function homeModule() {
  const counts = h('div', { class: 'stat-row' });
  panel('Dashboard', `Welcome, ${state.staff.full_name}. Choose a section on the left. Every change you save is published to the live site within a minute.`, counts);
  const queries = [];
  if (canAccess(['admin', 'helpdesk'])) queries.push(['Open tickets', sb.from('helpdesk_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']), '#helpdesk']);
  if (canAccess(['admin', 'editor'])) {
    queries.push(['Announcements', sb.from('announcements').select('id', { count: 'exact', head: true }).eq('published', true), '#announcements']);
    queries.push(['Published PDFs', sb.from('documents').select('id', { count: 'exact', head: true }).eq('published', true), '#documents']);
    queries.push(['Video lectures', sb.from('videos').select('id', { count: 'exact', head: true }), '#videos']);
  }
  if (canAccess(['admin', 'editor'])) {
    dailyCoverageSummary().then(({ scheduled, drafts }) => {
      if (scheduled >= 14 && !drafts) return;
      counts.after(h('a', { class: `callout ${scheduled < 7 ? 'error' : ''} dash-alert`, href: '#daily' },
        `Word of the Day: ${scheduled} of the next 14 days approved.`, drafts ? ` ${drafts} draft(s) waiting for approval.` : '', ' Open the Daily Calendar →'));
    });
  }
  const results = await Promise.all(queries.map((q) => q[1]));
  counts.append(...results.map((r, i) => h('a', { class: 'stat', href: queries[i][2] }, h('strong', {}, String(r.count ?? '—')), h('span', {}, queries[i][0]))));
}

// ---------- Generic CRUD ---------------------------------------------------------------
async function loadOptions(field) {
  if (field.options) return field.options;
  const { table, value, label } = field.optionsFrom;
  const { data } = await sb.from(table).select('*').order(value === 'id' ? 'created_at' : value, { ascending: value !== 'id' }).limit(500);
  return (data || []).map((r) => [r[value], label(r)]);
}

function toLocalInput(iso, type) {
  if (!iso) return '';
  if (type === 'date') return String(iso).slice(0, 10);
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function youtubeId(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : undefined; // undefined => invalid
}

function slugifyFile(name) {
  return name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';
}

/** Downsizes large photos in the browser (max 1600 px, JPEG) so pages stay light for slow connections. */
async function shrinkImage(file, max = 1600) {
  if (typeof createImageBitmap !== 'function') return file;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 450 * 1024) { bmp.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  return blob && blob.size < file.size ? blob : file;
}

async function checkFile(file, kind) {
  const limits = { pdf: 20 * 1048576, image: 5 * 1048576 };
  if (file.size > limits[kind]) throw new Error(`File is too large (max ${limits[kind] / 1048576} MB).`);
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join('');
  if (kind === 'pdf') {
    if (file.type !== 'application/pdf' || !hex.startsWith('255044462d')) throw new Error('Please choose a genuine PDF file.');
    return { ext: 'pdf', type: 'application/pdf' };
  }
  if (hex.startsWith('ffd8ff')) return { ext: 'jpg', type: 'image/jpeg' };
  if (hex.startsWith('89504e47')) return { ext: 'png', type: 'image/png' };
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return { ext: 'webp', type: 'image/webp' };
  throw new Error('Please choose a JPG, PNG or WebP image.');
}

async function buildForm(mod, row, defaults = {}) {
  const back = () => (mod.back ? mod.back() : crudModule(mod));
  const isNew = !row;
  const pk = mod.pk || 'id';
  const values = row ? { ...row } : { ...Object.fromEntries(mod.fields.filter((f) => 'default' in f).map((f) => [f.name, f.default])), ...defaults };
  const pendingDeletes = [];
  const form = h('form', { class: 'editor', novalidate: true });
  const controls = {};

  for (const f of mod.fields) {
    const id = `f-${f.name}`;
    let input;
    const val = values[f.name];
    switch (f.type) {
      case 'textarea':
        input = h('textarea', { id, name: f.name, rows: String(f.rows || 3), maxlength: f.max ? String(f.max) : null });
        input.value = val ?? '';
        break;
      case 'lines':
        input = h('textarea', { id, name: f.name, rows: '4' });
        input.value = Array.isArray(val) ? val.join('\n') : '';
        break;
      case 'number':
        input = h('input', { id, name: f.name, type: 'number', step: f.step || '1', min: f.min ?? null, max: f.max ?? null });
        input.value = val ?? '';
        break;
      case 'bool':
        input = h('input', { id, name: f.name, type: 'checkbox' });
        input.checked = !!val;
        break;
      case 'date':
      case 'datetime':
        input = h('input', { id, name: f.name, type: f.type === 'date' ? 'date' : 'datetime-local' });
        input.value = toLocalInput(val, f.type);
        break;
      case 'select': {
        input = h('select', { id, name: f.name });
        const opts = await loadOptions(f);
        input.append(h('option', { value: '' }, f.blank || 'Choose…'), ...opts.map(([v, l]) => h('option', { value: v }, l)));
        input.value = val ?? '';
        break;
      }
      case 'youtube':
        input = h('input', { id, name: f.name, type: 'text', placeholder: 'https://youtu.be/… or 11-character ID' });
        input.value = val ?? '';
        break;
      case 'file': {
        const current = h('div', { class: 'file-current' });
        const showCurrent = () => {
          const url = storageUrl(f.bucket, values[f.name]);
          current.replaceChildren(url
            ? h('span', {}, f.kind === 'image' ? h('img', { src: url, alt: '', class: 'thumb' }) : null, h('a', { href: url, target: '_blank', rel: 'noopener' }, values[f.name].split('/').pop()))
            : h('span', { class: 'muted' }, 'No file uploaded yet.'));
        };
        showCurrent();
        const picker = h('input', { id, type: 'file', accept: f.kind === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp' });
        const progress = h('small', { class: 'hint' });
        picker.addEventListener('change', async () => {
          const file = picker.files?.[0];
          if (!file) return;
          try {
            let { ext, type } = await checkFile(file, f.kind);
            let body = file;
            if (f.kind === 'image') {
              progress.textContent = 'Preparing image…';
              body = await shrinkImage(file);
              if (body !== file) { ext = 'jpg'; type = 'image/jpeg'; }
            }
            const folder = f.folder || form.elements[f.folderFrom]?.value || 'misc';
            const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID().slice(0, 8)}-${slugifyFile(file.name)}.${ext}`;
            progress.textContent = 'Uploading…';
            const { error } = await sb.storage.from(f.bucket).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false });
            if (error) throw error;
            if (values[f.name] && values[f.name] !== row?.[f.name]) pendingDeletes.push([f.bucket, values[f.name]]); // replaced an unsaved upload
            values[f.name] = path;
            if (f.sizeField) values[f.sizeField] = body.size;
            progress.textContent = 'Uploaded — remember to Save.';
            showCurrent();
          } catch (e) {
            progress.textContent = '';
            toast(friendly(e), 'error');
          } finally {
            picker.value = '';
          }
        });
        input = h('div', { class: 'file-field' }, current, picker, progress);
        break;
      }
      default:
        input = h('input', { id, name: f.name, type: f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text', maxlength: f.max ? String(f.max) : null, pattern: f.pattern || null });
        input.value = val ?? '';
    }
    if (f.createOnly && !isNew) input.disabled = true;
    if (f.adminOnly && state.staff.role !== 'admin') input.disabled = true;
    controls[f.name] = input;
    form.append(h('div', { class: `field ${f.type === 'bool' ? 'field-check' : ''}` },
      f.type === 'bool' ? [input, h('label', { for: id }, f.label)] : [h('label', { for: id }, f.label + (f.required ? ' *' : '')), input],
      f.hint ? h('small', { class: 'hint' }, f.hint) : null));
  }

  function collect() {
    const out = {};
    const errors = [];
    for (const f of mod.fields) {
      if (f.createOnly && !isNew) continue;
      if (f.adminOnly && state.staff.role !== 'admin') continue;
      const el = controls[f.name];
      let v;
      switch (f.type) {
        case 'bool': v = el.checked; break;
        case 'number': v = el.value === '' ? null : Number(el.value); break;
        case 'lines': v = el.value.split('\n').map((x) => x.trim()).filter(Boolean); break;
        case 'date': v = el.value || null; break;
        case 'datetime': v = el.value ? new Date(el.value).toISOString() : null; break;
        case 'file': v = values[f.name] || null; break;
        case 'youtube': {
          v = youtubeId(el.value);
          if (v === undefined) errors.push(`${f.label}: not a recognisable YouTube link.`);
          break;
        }
        default: v = el.value.trim() || null;
      }
      if (f.required && (v === null || v === '' || (Array.isArray(v) && !v.length))) errors.push(`${f.label} is required.`);
      if (f.requiredUnless && !v && !(controls[f.requiredUnless]?.value || '').trim()) errors.push(`Add a ${f.label} or a link.`);
      if (f.mustBeTrue && v !== true) errors.push('Please confirm that written consent has been received.');
      if (f.type === 'number' && v !== null && (Number.isNaN(v) || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) errors.push(`${f.label} must be between ${f.min} and ${f.max}.`);
      if (typeof v === 'string' && f.max && v.length > f.max) errors.push(`${f.label} is too long.`);
      if (typeof v === 'string' && f.pattern && !new RegExp(f.pattern).test(v)) errors.push(`${f.label} is not in the expected format.`);
      if (f.type === 'url' && v && !/^https:\/\/\S+$/i.test(v)) errors.push(`${f.label} must start with https://`);
      if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors.push(`${f.label} is not a valid email.`);
      out[f.name] = v;
      if (f.sizeField) out[f.sizeField] = values[f.sizeField] ?? null;
    }
    return { out, errors };
  }

  const save = h('button', { class: 'btn btn-ink', type: 'submit' }, isNew ? 'Create' : 'Save changes');
  const del = isNew ? null : h('button', { class: 'btn btn-danger', type: 'button' }, 'Delete');
  form.append(h('div', { class: 'editor-actions' }, save, h('button', { class: 'btn', type: 'button', onclick: back }, 'Cancel'), del));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { out, errors } = collect();
    if (errors.length) return toast(errors.join(' '), 'error');
    save.disabled = true;
    const q = isNew ? sb.from(mod.table).insert(out) : sb.from(mod.table).update(out).eq(pk, row[pk]);
    const { error } = await q;
    save.disabled = false;
    if (error) return toast(friendly(error), 'error');
    // remove files that were replaced
    for (const f of mod.fields.filter((x) => x.type === 'file')) {
      if (row?.[f.name] && row[f.name] !== out[f.name]) pendingDeletes.push([f.bucket, row[f.name]]);
    }
    for (const [bucket, path] of pendingDeletes) await sb.storage.from(bucket).remove([path]);
    toast(isNew ? 'Created.' : 'Saved.');
    if (!mod.noPublish) schedulePublish();
    back();
  });

  del?.addEventListener('click', async () => {
    if (!confirm('Delete this item permanently? This cannot be undone.')) return;
    const { error } = await sb.from(mod.table).delete().eq(pk, row[pk]);
    if (error) return toast(friendly(error), 'error');
    for (const f of mod.fields.filter((x) => x.type === 'file')) {
      if (row[f.name]) await sb.storage.from(f.bucket).remove([row[f.name]]);
    }
    toast('Deleted.');
    if (!mod.noPublish) schedulePublish();
    back();
  });

  return form;
}

function cell(v) {
  if (v === true) return h('span', { class: 'tag ok' }, 'Live');
  if (v === false) return h('span', { class: 'tag' }, 'Hidden');
  if (v == null || v === '') return h('span', { class: 'muted' }, '—');
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(v))) return fmtDate(v, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return String(v).length > 90 ? `${String(v).slice(0, 90)}…` : String(v);
}

async function crudModule(mod) {
  const pk = mod.pk || 'id';
  const body = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  const search = h('input', { type: 'search', placeholder: 'Filter…', 'aria-label': 'Filter list', class: 'filter' });
  const add = h('button', { class: 'btn btn-ink', type: 'button' }, 'Add new');
  panel(mod.label, mod.help, h('div', { class: 'toolbar' }, search, add), body);

  let q = sb.from(mod.table).select('*').limit(500);
  for (const [col, asc] of mod.order || []) q = q.order(col, { ascending: asc, nullsFirst: false });
  const { data, error } = await q;
  if (error) return body.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));

  const openEditor = async (row) => {
    const form = await buildForm(mod, row);
    panel(`${row ? 'Edit' : 'New'} · ${mod.label}`, mod.help, form);
    form.querySelector('input, textarea, select')?.focus();
  };
  add.addEventListener('click', () => openEditor(null));

  const table = h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, mod.list.map((c) => h('th', { scope: 'col' }, c.replace(/_/g, ' '))), h('th', {}, h('span', { class: 'sr-only' }, 'Actions')))));
  const tbody = h('tbody');
  const fill = () => {
    const term = search.value.trim().toLowerCase();
    const rows = data.filter((r) => !term || mod.list.some((c) => String(r[c] ?? '').toLowerCase().includes(term)));
    tbody.replaceChildren(...rows.map((r) => h('tr', {},
      mod.list.map((c) => h('td', {}, cell(r[c]))),
      h('td', { class: 'actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => openEditor(r), 'aria-label': `Edit ${r[mod.list[0]]}` }, 'Edit')))));
    if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: String(mod.list.length + 1), class: 'muted' }, 'Nothing here yet.')));
  };
  search.addEventListener('input', fill);
  table.append(tbody);
  fill();
  body.replaceChildren(h('div', { class: 'table-wrap' }, table), h('p', { class: 'meta' }, `${data.length} item(s) · key: ${pk}`));
}

// ---------- Daily Calendar (Word of the Day, Today in Literature) ------------------
const DAILY_MOD = MODULES.find((m) => m.id === 'daily_items');
const DAILY_HEADERS = ['Type', 'Date', 'Repeat every year (MM-DD)', 'Reserve', 'Title', 'Meaning', 'Gujarati', 'Hindi', 'Example', 'Source'];
let dailyTab = 'word';

function istISO(offsetDays = 0) {
  const base = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function coverage(items, kind) {
  return Array.from({ length: 14 }, (_, i) => {
    const iso = istISO(i);
    const md = iso.slice(5);
    const hits = items.filter((x) => x.kind === kind && x.published !== false && (x.show_on === iso || (kind === 'almanac' && x.month_day === md)));
    const approved = hits.filter((x) => x.status === 'approved');
    return { iso, hits, state: approved.length ? 'ok' : hits.length ? 'draft' : 'empty' };
  });
}

async function dailyCoverageSummary() {
  const { data } = await sb.from('daily_items').select('*').limit(2000);
  const days = coverage(data || [], 'word');
  return { scheduled: days.filter((d) => d.state === 'ok').length, drafts: (data || []).filter((x) => x.status === 'draft').length };
}

async function dailyModule() {
  DAILY_MOD.back = () => dailyModule();
  const isAdmin = state.staff.role === 'admin';
  const { data: all, error } = await sb.from('daily_items').select('*').order('sort_order', { ascending: true }).limit(2000);
  if (error) return panel('Daily Calendar', null, h('p', { class: 'callout error' }, friendly(error)));
  const items = all || [];
  const kind = dailyTab;
  const days = coverage(items, kind);
  const reserve = items.filter((x) => x.kind === kind && x.is_reserve);
  const okCount = days.filter((d) => d.state === 'ok').length;
  const drafts = items.filter((x) => x.status === 'draft');

  const edit = async (row, defaults) => {
    const form = await buildForm(DAILY_MOD, row, defaults);
    panel(`${row ? 'Edit' : 'New'} · Daily item`, DAILY_MOD.help, form);
  };
  const approve = async (ids) => {
    const { error: e } = await sb.from('daily_items').update({ status: 'approved' }).in('id', ids);
    if (e) return toast(friendly(e), 'error');
    toast(`${ids.length} item(s) approved.`);
    schedulePublish();
    dailyModule();
  };

  const tabs = h('div', { class: 'chips' }, [['word', 'Word of the Day'], ['almanac', 'Today in Literature']].map(([v, l]) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === kind), onclick: () => { dailyTab = v; dailyModule(); } }, l)));

  const grid = h('div', { class: 'cal-grid' }, days.map((d) => {
    const label = new Date(`${d.iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const first = d.hits[0];
    return h('button', { type: 'button', class: `cal-day cal-${d.state}`, onclick: () => (first ? edit(first) : edit(null, { kind, show_on: d.iso })) },
      h('span', { class: 'cal-date' }, label),
      h('span', { class: 'cal-title' }, first ? first.title : (kind === 'word' && reserve.length ? 'Reserve will be used' : 'Empty — add')),
      h('span', { class: 'cal-state' }, d.state === 'ok' ? 'Approved' : d.state === 'draft' ? 'Waiting for approval' : 'Not scheduled'));
  }));

  const fill = h('button', { class: 'btn', type: 'button' }, 'Fill empty days from reserve');
  fill.addEventListener('click', async () => {
    if (kind !== 'word') return toast('Today in Literature uses anniversaries that repeat every year; add those as entries.', 'error');
    const empty = days.filter((d) => d.state === 'empty');
    if (!empty.length) return toast('All 14 days already have an entry.');
    if (!reserve.length) return toast('Add some reserve words first.', 'error');
    const used = new Set(items.filter((x) => x.kind === 'word' && x.show_on).map((x) => x.title));
    const pool = [...reserve.filter((r) => !used.has(r.title)), ...reserve.filter((r) => used.has(r.title))];
    const rows = empty.map((d, i) => {
      const r = pool[i % pool.length];
      return { kind: 'word', show_on: d.iso, is_reserve: false, title: r.title, meaning: r.meaning, gujarati: r.gujarati, hindi: r.hindi, example: r.example, source: r.source, status: isAdmin ? 'approved' : 'draft', sort_order: 0, published: true };
    });
    const { error: e } = await sb.from('daily_items').insert(rows);
    if (e) return toast(friendly(e), 'error');
    toast(`${rows.length} day(s) filled${isAdmin ? '' : ' as drafts for approval'}.`);
    schedulePublish();
    dailyModule();
  });

  const picker = h('input', { type: 'file', accept: '.xlsx,.csv', id: 'daily-file', class: 'sr-only' });
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      const [head, ...body] = await readRows(file);
      const idx = (name) => (head || []).findIndex((x) => String(x ?? '').trim().toLowerCase().startsWith(name));
      const col = { type: idx('type'), date: idx('date'), md: idx('repeat'), res: idx('reserve'), title: idx('title'), meaning: idx('meaning'), gu: idx('gujarati'), hi: idx('hindi'), ex: idx('example'), src: idx('source') };
      if (col.type < 0 || col.title < 0) throw new Error(`The first row must contain the headings: ${DAILY_HEADERS.join(', ')}.`);
      const val = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
      const toIso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim());
      const rows = [];
      const problems = [];
      body.forEach((r, n) => {
        if (!r.some((x) => String(x ?? '').trim())) return;
        const type = val(r, col.type).toLowerCase().startsWith('w') ? 'word' : 'almanac';
        const show_on = col.date >= 0 ? toIso(r[col.date]) : '';
        const month_day = val(r, col.md);
        const is_reserve = /^y/i.test(val(r, col.res));
        const title = val(r, col.title);
        if (!title) return problems.push(`Row ${n + 2}: title missing`);
        if (show_on && !/^\d{4}-\d{2}-\d{2}$/.test(show_on)) return problems.push(`Row ${n + 2}: date like 2026-11-05`);
        if (month_day && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(month_day)) return problems.push(`Row ${n + 2}: repeat date like 05-07`);
        if (!show_on && !month_day && !is_reserve) return problems.push(`Row ${n + 2}: give a date, a repeat date, or mark it as reserve`);
        rows.push({ kind: type, show_on: show_on || null, month_day: month_day || null, is_reserve, title, meaning: val(r, col.meaning) || null, gujarati: val(r, col.gu) || null, hindi: val(r, col.hi) || null, example: val(r, col.ex) || null, source: val(r, col.src) || null, status: 'draft', sort_order: 0, published: true });
      });
      if (!rows.length) throw new Error(problems[0] || 'No rows found.');
      const { error: e } = await sb.from('daily_items').insert(rows);
      if (e) throw e;
      toast(`${rows.length} item(s) imported as drafts — an administrator approves them.${problems.length ? ` ${problems.length} row(s) skipped.` : ''}`);
      if (problems.length) toast(problems.slice(0, 5).join(' · '), 'error');
      dailyModule();
    } catch (e) {
      toast(friendly(e), 'error');
    }
  });
  const template = () => {
    const sample = [
      ['word', istISO(1), '', 'no', 'Metaphor', 'A figure of speech that describes one thing as if it were another.', 'રૂપક', 'रूपक', '"All the world\'s a stage" is a metaphor.', ''],
      ['almanac', '', '05-07', 'no', 'Birth anniversary of Rabindranath Tagore (1861)', 'Poet, novelist and educator.', '', '', '', ''],
    ];
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [DAILY_HEADERS, ...sample].map((r) => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'daily-calendar-template.csv';
    document.body.append(a);
    a.click();
    a.remove();
  };

  const listRows = (rows) => (rows.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, ['When', 'Title', 'Status', ''].map((c) => h('th', {}, c)))),
        h('tbody', {}, rows.map((r) => h('tr', {},
          h('td', {}, r.show_on || (r.month_day ? `Every ${r.month_day}` : 'Reserve')),
          h('td', {}, r.title),
          h('td', {}, h('span', { class: `tag ${r.status === 'approved' ? 'ok' : 's-in_progress'}` }, r.status)),
          h('td', { class: 'actions' },
            isAdmin && r.status !== 'approved' ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => approve([r.id]) }, 'Approve') : null,
            h('button', { class: 'btn btn-sm', type: 'button', onclick: () => edit(r) }, 'Edit')))))))
    : h('p', { class: 'muted' }, 'Nothing here yet.'));

  const kindRows = items.filter((x) => x.kind === kind);
  const upcoming = kindRows.filter((x) => x.show_on && x.show_on >= istISO(0)).sort((a, b) => (a.show_on < b.show_on ? -1 : 1));
  const recurring = kindRows.filter((x) => x.month_day).sort((a, b) => (a.month_day < b.month_day ? -1 : 1));
  const kindDrafts = drafts.filter((x) => x.kind === kind);

  panel('Daily Calendar', 'Plan at least the next 14 days. Days without an approved entry use the reserve pool, so the Home page is never empty. Editors write drafts; an administrator approves.',
    tabs,
    h('div', { class: `callout ${okCount >= 14 ? 'success' : okCount >= 7 ? '' : 'error'}` },
      `${okCount} of the next 14 days have an approved entry.`,
      kindDrafts.length ? ` ${kindDrafts.length} draft(s) waiting for approval.` : ''),
    grid,
    h('div', { class: 'toolbar' },
      h('div', { class: 'editor-actions' },
        h('button', { class: 'btn btn-ink', type: 'button', onclick: () => edit(null, { kind, show_on: istISO(0) }) }, 'Add entry'),
        kind === 'word' ? fill : null,
        isAdmin && kindDrafts.length ? h('button', { class: 'btn', type: 'button', onclick: () => approve(kindDrafts.map((x) => x.id)) }, `Approve all drafts (${kindDrafts.length})`) : null),
      h('div', { class: 'editor-actions' },
        h('button', { class: 'btn', type: 'button', onclick: template }, 'Download template'),
        h('label', { class: 'btn', for: 'daily-file' }, 'Upload Excel / CSV'), picker)),
    kindDrafts.length ? [h('h2', { class: 'mini' }, 'Waiting for approval'), listRows(kindDrafts)] : null,
    kind === 'word' ? [h('h2', { class: 'mini' }, 'Scheduled'), listRows(upcoming)] : [h('h2', { class: 'mini' }, 'Anniversaries (repeat every year)'), listRows(recurring)],
    h('h2', { class: 'mini' }, `Reserve pool (${reserve.length})`), listRows(reserve));
}

// ---------- Enrolment (Excel / CSV import) ----------------------------------------
const ENROL_HEADERS = ['Programme code', 'Academic year', 'Semester', 'Male', 'Female', 'Transgender'];
const HEADER_MAP = {
  'programme code': 'program_code', 'program code': 'program_code', programme: 'program_code', program: 'program_code',
  'academic year': 'academic_year', year: 'academic_year', semester: 'semester', sem: 'semester',
  male: 'male', female: 'female', transgender: 'transgender',
};

function downloadTemplate(codes) {
  const sample = codes.slice(0, 2).flatMap((code) => [1, 2].map((sem) => [code, '2026-27', sem, 0, 0, 0]));
  const csv = [ENROL_HEADERS, ...sample].map((r) => r.join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'enrolment-template.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function readRows(file) {
  if (file.size > 2 * 1048576) throw new Error('The sheet is too large (max 2 MB).');
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return readSheet(file);
  }
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(',').map((x) => x.replace(/^"|"$/g, '').trim()));
  }
  throw new Error('Choose an Excel (.xlsx) or CSV file.');
}

function validateEnrolment(rows, codes) {
  const [head, ...body] = rows;
  const keys = (head || []).map((x) => HEADER_MAP[String(x ?? '').trim().toLowerCase()]);
  const missing = ['program_code', 'academic_year', 'semester', 'male', 'female'].filter((k) => !keys.includes(k));
  if (missing.length) throw new Error(`The first row must contain the column headings: ${ENROL_HEADERS.join(', ')}.`);
  const out = [];
  body.forEach((r, i) => {
    if (!r.some((x) => String(x ?? '').trim())) return;
    const o = {};
    keys.forEach((k, j) => { if (k) o[k] = r[j]; });
    const row = {
      program_code: String(o.program_code ?? '').trim(),
      academic_year: String(o.academic_year ?? '').trim(),
      semester: Number(o.semester),
      male: Number(o.male ?? 0),
      female: Number(o.female ?? 0),
      transgender: Number(o.transgender ?? 0),
    };
    const errs = [];
    if (!codes.includes(row.program_code)) errs.push('unknown programme code');
    if (!/^[0-9]{4}(-[0-9]{2,4})?$/.test(row.academic_year)) errs.push('year like 2026-27');
    if (!Number.isInteger(row.semester) || row.semester < 1 || row.semester > 10) errs.push('semester 1–10');
    for (const k of ['male', 'female', 'transgender']) if (!Number.isInteger(row[k]) || row[k] < 0) errs.push(`${k} must be a whole number`);
    out.push({ line: i + 2, row, errs });
  });
  return out;
}

async function enrolmentModule() {
  const { data: progs } = await sb.from('programs').select('*').order('sort_order', { ascending: true });
  const codes = (progs || []).map((p) => p.code);
  const preview = h('div');
  const existing = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  const picker = h('input', { type: 'file', accept: '.xlsx,.csv', id: 'enrol-file' });

  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      const checked = validateEnrolment(await readRows(file), codes);
      const good = checked.filter((x) => !x.errs.length);
      const bad = checked.filter((x) => x.errs.length);
      const importBtn = h('button', { class: 'btn btn-ink', type: 'button' }, `Import ${good.length} row(s)`);
      importBtn.disabled = !good.length;
      importBtn.addEventListener('click', async () => {
        importBtn.disabled = true;
        const { error } = await sb.from('enrolments').upsert(good.map((x) => x.row), { onConflict: 'program_code,academic_year,semester' });
        if (error) { importBtn.disabled = false; return toast(friendly(error), 'error'); }
        toast(`${good.length} enrolment row(s) saved.`);
        schedulePublish();
        enrolmentModule();
      });
      preview.replaceChildren(
        h('h2', { class: 'mini' }, `Preview — ${file.name}`),
        bad.length ? h('div', { class: 'callout error' }, `${bad.length} row(s) have problems and will be skipped: `,
          bad.slice(0, 8).map((x) => h('div', {}, `Row ${x.line}: ${x.errs.join(', ')}`))) : null,
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, ['Programme', 'Year', 'Semester', 'Male', 'Female', 'Transgender', 'Total'].map((c) => h('th', {}, c)))),
          h('tbody', {}, good.slice(0, 60).map(({ row: r }) => h('tr', {},
            [r.program_code, r.academic_year, r.semester, r.male, r.female, r.transgender, r.male + r.female + r.transgender].map((v) => h('td', {}, String(v)))))))),
        h('div', { class: 'editor-actions' }, importBtn, h('button', { class: 'btn', type: 'button', onclick: () => preview.replaceChildren() }, 'Cancel')));
    } catch (e) {
      toast(e.message || 'Could not read that file.', 'error');
    }
  });

  panel('Enrolment (Excel)', 'Learners per programme, academic year and semester. Fill the template in Excel, save it, then upload it here. Rows for the same programme, year and semester are updated, not duplicated.',
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', type: 'button', onclick: () => downloadTemplate(codes) }, 'Download template'),
      h('label', { class: 'btn btn-ink', for: 'enrol-file' }, 'Upload Excel / CSV'), picker),
    preview, h('h2', { class: 'mini' }, 'Saved figures'), existing);
  picker.classList.add('sr-only');

  const { data, error } = await sb.from('enrolments').select('*').order('academic_year', { ascending: false }).order('program_code', { ascending: true }).order('semester', { ascending: true }).limit(1000);
  if (error) return existing.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));
  existing.replaceChildren(data.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, ['Programme', 'Year', 'Semester', 'Male', 'Female', 'Transgender', 'Total', ''].map((c) => h('th', {}, c)))),
    h('tbody', {}, data.map((r) => h('tr', {},
      [r.program_code, r.academic_year, r.semester, r.male, r.female, r.transgender, r.male + r.female + r.transgender].map((v) => h('td', {}, String(v))),
      h('td', { class: 'actions' }, h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => {
        if (!confirm('Delete this row?')) return;
        const { error: e } = await sb.from('enrolments').delete().eq('id', r.id);
        if (e) return toast(friendly(e), 'error');
        schedulePublish();
        enrolmentModule();
      } }, 'Delete'))))))) : h('p', { class: 'muted' }, 'No figures yet. Download the template to begin.'));
}

// ---------- Helpdesk ---------------------------------------------------------------------
const STATUSES = [['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']];

async function helpdeskModule(filter = 'active') {
  const body = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  const tabs = h('div', { class: 'chips' }, [['active', 'Active'], ...STATUSES, ['all', 'All']].map(([v, l]) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === filter), onclick: () => helpdeskModule(v) }, l)));
  const search = h('input', { type: 'search', placeholder: 'Search reference, email, name, subject…', class: 'filter', 'aria-label': 'Search tickets' });
  panel('Helpdesk Tickets', 'Queries from learners. A public reply is visible to the learner when they track their ticket; internal notes are staff-only.', tabs, search, body);

  let q = sb.from('helpdesk_tickets').select('*').order('created_at', { ascending: false }).limit(300);
  if (filter === 'active') q = q.in('status', ['open', 'in_progress']);
  else if (filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  if (error) return body.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));

  const tbody = h('tbody');
  const fill = () => {
    const t = search.value.trim().toLowerCase();
    const rows = data.filter((r) => !t || [r.reference, r.email, r.name, r.subject, r.enrolment_no, r.phone].some((x) => String(x ?? '').toLowerCase().includes(t)));
    tbody.replaceChildren(...rows.map((r) => h('tr', { class: `st-${r.status}` },
      h('td', {}, h('code', {}, r.reference)),
      h('td', {}, r.subject),
      h('td', {}, r.name),
      h('td', {}, r.category),
      h('td', {}, h('span', { class: `tag s-${r.status}` }, r.status.replace('_', ' '))),
      h('td', {}, fmtDate(r.created_at)),
      h('td', { class: 'actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => ticketDetail(r, filter) }, 'Open')))));
    if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: '7', class: 'muted' }, 'No tickets.')));
  };
  search.addEventListener('input', fill);
  fill();
  body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, ['Reference', 'Subject', 'Learner', 'Category', 'Status', 'Received', ''].map((c) => h('th', { scope: 'col' }, c)))), tbody)));
}

function ticketDetail(t, backFilter) {
  const status = h('select', { id: 't-status' }, STATUSES.map(([v, l]) => h('option', { value: v }, l)));
  status.value = t.status;
  const reply = h('textarea', { id: 't-reply', rows: '6', maxlength: '3000' });
  reply.value = t.public_reply || '';
  const note = h('textarea', { id: 't-note', rows: '3', maxlength: '3000' });
  note.value = t.staff_note || '';
  let assigned = t.assigned_to;
  const redacted = Boolean(t.redacted_at);
  const mail = redacted ? null : safeUrl(`mailto:${t.email}?subject=${encodeURIComponent(`[${t.reference}] ${t.subject}`)}`);
  const tel = t.phone && !redacted ? safeUrl(`tel:+91${t.phone}`) : null;

  const save = h('button', { class: 'btn btn-ink', type: 'button' }, 'Save');
  save.addEventListener('click', async () => {
    save.disabled = true;
    const { error } = await sb.from('helpdesk_tickets').update({
      status: status.value, public_reply: reply.value.trim() || null, staff_note: note.value.trim() || null, assigned_to: assigned,
    }).eq('id', t.id);
    save.disabled = false;
    if (error) return toast(friendly(error), 'error');
    toast('Ticket updated.');
    helpdeskModule(backFilter);
  });

  panel(`Ticket ${t.reference}`, null,
    h('div', { class: 'ticket-grid' },
      h('section', { class: 'card-plain' },
        h('h2', {}, t.subject),
        redacted ? h('p', { class: 'callout' }, `Personal details were removed on ${fmtDate(t.redacted_at)} (retention period ended). Subject, category and status are kept for statistics.`) : null,
        h('dl', { class: 'kv' },
          [['Learner', t.name], ['Registered email', t.email], ['Mobile', tel ? h('a', { href: tel, class: 'link' }, t.phone) : t.phone], ['Enrolment no.', t.enrolment_no], ['Programme', t.program_code],
          ['Consent given', t.consent_at ? fmtDate(t.consent_at, { dateStyle: 'medium', timeStyle: 'short' }) : null],
          ['Category', t.category], ['Received', fmtDate(t.created_at, { dateStyle: 'medium', timeStyle: 'short' })],
          ['Last update', fmtDate(t.updated_at, { dateStyle: 'medium', timeStyle: 'short' })]].filter(([, v]) => v).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
        h('h3', { class: 'mini' }, 'Message'),
        h('p', { class: 'message' }, t.message)),
      h('section', { class: 'card-plain' },
        h('div', { class: 'field' }, h('label', { for: 't-status' }, 'Status'), status),
        h('div', { class: 'field' }, h('label', { for: 't-reply' }, 'Public reply (learner sees this)'), reply),
        h('div', { class: 'field' }, h('label', { for: 't-note' }, 'Internal note (staff only)'), note),
        h('p', { class: 'meta' }, assigned ? (assigned === state.staff.user_id ? 'Assigned to you.' : 'Assigned to a colleague.') : 'Unassigned.'),
        h('div', { class: 'editor-actions' },
          save,
          h('button', { class: 'btn', type: 'button', onclick: (e) => { assigned = state.staff.user_id; e.currentTarget.textContent = 'Assigned to me (save to keep)'; } }, 'Assign to me'),
          mail ? h('a', { class: 'btn', href: mail }, 'Email learner') : null,
          tel ? h('a', { class: 'btn', href: tel }, 'Call learner') : null,
          h('button', { class: 'btn', type: 'button', onclick: () => helpdeskModule(backFilter) }, 'Back')))));
}

// ---------- Settings --------------------------------------------------------------------------
async function settingsModule() {
  const body = h('div', { class: 'settings' }, h('p', { class: 'muted' }, 'Loading…'));
  panel('Site Settings', 'Texts that appear across the site: names, hero, overview, contact details, Inkwell greeting. Lists take one item per line.', body);
  const { data, error } = await sb.from('site_settings').select('*').order('sort_order');
  if (error) return body.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));
  body.replaceChildren(...data.map((row) => {
    const id = `s-${row.key}`;
    const v = row.value;
    let input;
    let read;
    if (row.key === 'default_theme') {
      input = h('select', { id }, THEMES.map((t) => h('option', { value: t.id }, `${t.name} — ${t.tagline}`)));
      input.value = typeof v === 'string' ? v : 'parchment';
      read = () => input.value;
    } else if (row.key === 'enabled_themes') {
      const chosen = new Set(Array.isArray(v) ? v : THEMES.map((t) => t.id));
      const boxes = THEMES.map((t) => {
        const cb = h('input', { type: 'checkbox', value: t.id, id: `${id}-${t.id}` });
        cb.checked = chosen.has(t.id);
        return h('label', { class: 'theme-check', for: `${id}-${t.id}` }, cb,
          h('span', { class: 'dot', style: { background: t.accent, boxShadow: `inset 0 0 0 3px ${t.paper}, 0 0 0 1px ${t.brass}` } }), t.name);
      });
      input = h('div', { class: 'theme-checks', id }, boxes);
      read = () => {
        const ids = [...input.querySelectorAll('input:checked')].map((x) => x.value);
        if (!ids.length) throw new Error('Choose at least one theme.');
        return ids;
      };
    } else if (Array.isArray(v)) {
      input = h('textarea', { id, rows: String(Math.min(10, Math.max(3, v.length + 1))) });
      input.value = v.join('\n');
      read = () => input.value.split('\n').map((x) => x.trim()).filter(Boolean);
    } else if (typeof v === 'boolean') {
      input = h('input', { id, type: 'checkbox' });
      input.checked = v;
      read = () => input.checked;
    } else if (typeof v === 'number') {
      input = h('input', { id, type: 'number', step: 'any' });
      input.value = String(v);
      read = () => Number(input.value);
    } else if (v && typeof v === 'object') {
      input = h('textarea', { id, rows: '6', class: 'mono' });
      input.value = JSON.stringify(v, null, 2);
      read = () => JSON.parse(input.value);
    } else {
      const long = String(v ?? '').length > 70;
      input = long ? h('textarea', { id, rows: String(Math.min(10, Math.ceil(String(v).length / 80) + 1)) }) : h('input', { id, type: 'text' });
      input.value = v ?? '';
      read = () => input.value.trim();
    }
    const btn = h('button', { class: 'btn btn-sm', type: 'button' }, 'Save');
    btn.addEventListener('click', async () => {
      let value;
      try {
        value = read();
      } catch (err) {
        return toast(err instanceof SyntaxError ? 'That is not valid JSON.' : err.message, 'error');
      }
      btn.disabled = true;
      const { error: e } = await sb.from('site_settings').update({ value }).eq('key', row.key);
      btn.disabled = false;
      if (e) return toast(friendly(e), 'error');
      toast(`Saved “${row.label || row.key}”.`);
      if (row.is_public) schedulePublish();
    });
    return h('div', { class: 'setting' },
      h('div', { class: 'setting-head' }, h('label', { for: id }, row.label || row.key), h('code', {}, row.key), row.is_public ? null : h('span', { class: 'tag' }, 'private')),
      input, h('div', {}, btn));
  }));
}

// ---------- Staff ------------------------------------------------------------------------------
async function staffModule() {
  const body = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  const invite = h('form', { class: 'invite' },
    h('h2', { class: 'mini' }, 'Invite a colleague'),
    h('div', { class: 'invite-row' },
      h('input', { name: 'full_name', placeholder: 'Full name', required: true, 'aria-label': 'Full name' }),
      h('input', { name: 'email', type: 'email', placeholder: 'Official email', required: true, 'aria-label': 'Email' }),
      h('select', { name: 'role', 'aria-label': 'Role' }, h('option', { value: 'editor' }, 'Editor — content'), h('option', { value: 'helpdesk' }, 'Helpdesk — tickets'), h('option', { value: 'admin' }, 'Administrator — everything')),
      h('button', { class: 'btn btn-ink', type: 'submit' }, 'Send invitation')));
  invite.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (PRACTICE) return toast('Invitations need the live backend. In practice mode you are the only (sample) administrator.', 'error');
    const fd = Object.fromEntries(new FormData(invite).entries());
    const { data: s } = await sb.auth.getSession();
    const res = await fetch(functionUrl('staff-admin'), {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite', ...fd }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return toast(out.error || 'Invitation failed.', 'error');
    toast('Invitation sent.');
    staffModule();
  });
  panel('Staff & Roles', 'Administrators manage everything; editors manage content and settings; helpdesk staff answer tickets. Deactivate rather than delete to keep the audit trail.', invite, body);

  const { data, error } = await sb.from('staff').select('*').order('created_at');
  if (error) return body.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));
  body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, ['Name', 'Email', 'Role', 'Active', ''].map((c) => h('th', { scope: 'col' }, c)))),
    h('tbody', {}, data.map((r) => {
      const role = h('select', { 'aria-label': `Role for ${r.full_name}` }, ['admin', 'editor', 'helpdesk'].map((x) => h('option', { value: x }, x)));
      role.value = r.role;
      const active = h('input', { type: 'checkbox', 'aria-label': `${r.full_name} active` });
      active.checked = r.active;
      const btn = h('button', { class: 'btn btn-sm', type: 'button' }, 'Save');
      btn.addEventListener('click', async () => {
        const { error: e } = await sb.from('staff').update({ role: role.value, active: active.checked }).eq('user_id', r.user_id);
        if (e) return toast(friendly(e), 'error');
        toast('Staff record updated.');
      });
      return h('tr', {}, h('td', {}, r.full_name), h('td', {}, r.email), h('td', {}, role), h('td', {}, active), h('td', { class: 'actions' }, btn));
    })))));
}

// ---------- Audit ------------------------------------------------------------------------------
async function auditModule() {
  const body = h('div', {}, h('p', { class: 'muted' }, 'Loading…'));
  panel('Audit Log', 'The latest 200 changes made through the console.', body);
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(200);
  if (error) return body.replaceChildren(h('p', { class: 'callout error' }, friendly(error)));
  body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, ['When', 'Who', 'Table', 'Action', 'Item'].map((c) => h('th', { scope: 'col' }, c)))),
    h('tbody', {}, data.map((r) => h('tr', {},
      h('td', {}, fmtDate(r.at, { dateStyle: 'medium', timeStyle: 'short' })), h('td', {}, r.actor_email || 'system'),
      h('td', {}, r.table_name), h('td', {}, r.action), h('td', {}, h('code', {}, String(r.row_id ?? '').slice(0, 36)))))))));
}

// ---------- Boot -------------------------------------------------------------------------------
let booting = false;
async function boot() {
  if (booting) return;
  booting = true;
  try {
    await bootInner();
  } finally {
    booting = false;
  }
}

async function bootInner() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  if (!state.session) return renderLogin();
  if (needsPassword) return renderSetPassword();

  const { data: staff, error } = await sb.from('staff').select('*').eq('user_id', state.session.user.id).maybeSingle();
  if (error || !staff || !staff.active) {
    await sb.auth.signOut();
    return renderLogin('This account does not have console access. Please contact the department administrator.');
  }
  state.staff = staff;
  armIdle();
  renderShell();
}

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    state.staff = null;
    renderLogin();
  } else if (event === 'PASSWORD_RECOVERY') {
    needsPassword = true;
    renderSetPassword();
  } else if (event === 'SIGNED_IN' && !state.staff && !needsPassword) {
    setTimeout(boot, 0); // never await Supabase calls inside this callback
  }
});

boot();
