// Student helpdesk: raise a ticket and check its status.
// Client-side validation mirrors the server; the server is authoritative.

import { DEMO_MODE, TURNSTILE_SITE_KEY, functionUrl, publicHeaders } from '../config.js';
import { setting } from '../lib/content.js';
import { fmtDate, h, s, safeUrl } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { loadPracticeDb, savePracticeDb } from '../lib/practiceStore.js';

const CATEGORIES = [
  ['admission', 'Admission'],
  ['assignment', 'Assignment'],
  ['examination', 'Examination'],
  ['result', 'Result'],
  ['study-material', 'Study material (SLM)'],
  ['fees', 'Fees'],
  ['other', 'Other'],
];
const STATUS_LABEL = { open: 'Received', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

let turnstileLoading;
function loadTurnstile() {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ||= new Promise((resolve) => {
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    sc.async = true;
    sc.onload = () => resolve(window.turnstile || null);
    sc.onerror = () => resolve(null);
    document.head.append(sc);
  });
  return turnstileLoading;
}

/** Practice mode: tickets are kept in this browser so the admin console can answer them. */
async function practiceCall(payload) {
  await new Promise((r) => setTimeout(r, 300));
  const db = await loadPracticeDb();
  db.helpdesk_tickets ||= [];
  if (payload.action === 'submit') {
    const d = new Date();
    const reference = `ENG${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = d.toISOString();
    db.helpdesk_tickets.unshift({
      id: crypto.randomUUID(), reference, name: payload.name.trim(), email: payload.email.trim().toLowerCase(), phone: payload.phone,
      enrolment_no: payload.enrolment_no.trim(), program_code: payload.program_code || null, category: payload.category,
      subject: payload.subject.trim(), message: payload.message.trim(), status: 'open', public_reply: null, staff_note: null,
      assigned_to: null, consent_at: now, created_at: now, updated_at: now,
    });
    savePracticeDb(db);
    return { ok: true, reference, demo: true };
  }
  const ref = String(payload.reference || '').trim().toUpperCase();
  const email = String(payload.email || '').trim().toLowerCase();
  const tk = db.helpdesk_tickets.find((x) => x.reference === ref && x.email.toLowerCase() === email);
  if (!tk) return { error: 'No ticket matches that reference and email.' };
  const { reference, subject, category, status, public_reply, created_at, updated_at } = tk;
  return { ok: true, ticket: { reference, subject, category, status, public_reply, created_at, updated_at } };
}

async function call(payload) {
  if (DEMO_MODE) return practiceCall(payload);
  const res = await fetch(functionUrl('helpdesk'), { method: 'POST', headers: publicHeaders(), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({ error: 'Unexpected response from server.' }));
  if (!res.ok) return { ...data, error: data.error || `Request failed (${res.status})` };
  return data;
}

function field(label, input, hint) {
  const id = input.id;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    input,
    hint ? h('small', { class: 'hint' }, hint) : null,
    h('small', { class: 'field-error', id: `${id}-err`, 'aria-live': 'polite' }));
}

function setErrors(form, fields = {}) {
  form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  for (const [name, msg] of Object.entries(fields)) {
    const input = form.elements[name];
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const err = form.querySelector(`#${input.id}-err`);
    if (err) err.textContent = msg;
  }
}

function normalisePhone(p) {
  return String(p || '').replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '');
}

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(v.email.trim())) e.email = 'Please enter a valid email address.';
  if (!/^[A-Za-z0-9/-]{4,30}$/.test((v.enrolment_no || '').trim())) e.enrolment_no = t('Please enter your enrolment number.');
  if (!/^[6-9]\d{9}$/.test(normalisePhone(v.phone))) e.phone = t('Please enter a 10-digit mobile number.');
  if (v.consent !== 'yes') e.consent = t('Please tick the consent box.');
  if (!v.category) e.category = 'Please choose a category.';
  if (v.subject.trim().length < 4) e.subject = 'At least 4 characters.';
  if (v.message.trim().length < 10) e.message = 'Please describe your query (at least 10 characters).';
  return e;
}

/** 3D ring: share of queries resolved so far (totals only — never ticket details). */
function resolutionRing(stats) {
  const total = Number(stats?.total) || 0;
  const done = Math.min(Number(stats?.resolved) || 0, total);
  if (total < 1) return null;
  const pct = Math.round((done / total) * 100);
  const R = 52;
  const C = 2 * Math.PI * R;
  const ring = (cls, dash) => s('circle', { cx: '70', cy: '70', r: String(R), class: cls, 'stroke-dasharray': `${dash} ${C}` });
  const layers = [0, 1, 2, 3, 4, 5].map((z) =>
    s('svg', { viewBox: '0 0 140 140', class: 'ring-layer', style: { '--z': String(z) }, 'aria-hidden': 'true' },
      ring('ring-track', C), ring(z === 5 ? 'ring-fill top' : 'ring-fill', (C * pct) / 100)));
  return h('section', { class: 'card ring-card', 'aria-label': `${pct}% of queries resolved` },
    h('div', { class: 'ring-3d', style: { '--pct': String(pct) } }, layers, h('div', { class: 'ring-label' }, h('strong', {}, `${pct}%`), h('span', {}, t('resolved')))),
    h('div', {},
      h('h2', { class: 'card-title small' }, t('Queries resolved so far')),
      h('p', {}, `${done.toLocaleString('en-IN')} ${t('of')} ${total.toLocaleString('en-IN')} ${t('queries have been answered and closed by the department.')}`),
      h('p', { class: 'meta' }, t('Totals only. No learner’s details are ever shown here.'))));
}

export function renderHelpdesk(content) {
  const programmes = content.programs || [];
  const statusOut = h('div', { class: 'status-out', 'aria-live': 'polite' });
  const result = h('div', { class: 'ticket-result', 'aria-live': 'polite' });
  let turnstileId = null;
  const tsHost = h('div', { class: 'turnstile' });

  const form = h('form', { class: 'card form', novalidate: true },
    h('h2', { class: 'card-title small' }, t('Raise a query')),
    h('div', { class: 'form-grid' },
      field(t('Full name'), h('input', { id: 'hd-name', name: 'name', autocomplete: 'name', maxlength: '80', required: true })),
      field(t('Enrolment number'), h('input', { id: 'hd-enrol', name: 'enrolment_no', maxlength: '30', inputmode: 'text', required: true, autocomplete: 'off' })),
      field(t('Registered email'), h('input', { id: 'hd-email', name: 'email', type: 'email', autocomplete: 'email', maxlength: '254', required: true }), t('The email you gave the university. Replies are linked to it.')),
      field(t('Mobile number'), h('input', { id: 'hd-phone', name: 'phone', type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', maxlength: '16', required: true, placeholder: '98XXXXXXXX' })),
      field(t('Programme'), h('select', { id: 'hd-prog', name: 'program_code' },
        h('option', { value: '' }, t('Not specific')),
        programmes.map((p) => h('option', { value: p.code }, `${p.code} — ${p.title}`)))),
      field(t('Category'), h('select', { id: 'hd-cat', name: 'category', required: true },
        h('option', { value: '' }, t('Choose…')),
        CATEGORIES.map(([v, l]) => h('option', { value: v }, l))))),
    field(t('Subject'), h('input', { id: 'hd-subj', name: 'subject', maxlength: '140', required: true })),
    field(t('Your query'), h('textarea', { id: 'hd-msg', name: 'message', rows: '6', maxlength: '3000', required: true })),
    // honeypot — hidden from people, tempting to bots
    h('div', { class: 'hp', 'aria-hidden': 'true' },
      h('label', { for: 'hd-website' }, 'Website'),
      h('input', { id: 'hd-website', name: 'website', tabindex: '-1', autocomplete: 'off' })),
    h('div', { class: 'field field-consent' },
      h('label', { class: 'consent', for: 'hd-consent' },
        h('input', { id: 'hd-consent', name: 'consent', type: 'checkbox', value: 'yes', required: true }),
        h('span', {}, t('I agree that the department may use these details only to answer this query. Name, email, mobile and enrolment number are removed six months after the query is closed.'))),
      h('small', { class: 'field-error', id: 'hd-consent-err', 'aria-live': 'polite' })),
    tsHost,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-ink', type: 'submit' }, t('Submit query'))),
    result);

  loadTurnstile().then((ts) => {
    if (ts && tsHost.isConnected) turnstileId = ts.render(tsHost, { sitekey: TURNSTILE_SITE_KEY, theme: 'light' });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form).entries());
    const errs = validate(v);
    setErrors(form, errs);
    if (Object.keys(errs).length) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = t('Sending…');
    result.replaceChildren();
    const token = turnstileId !== null && window.turnstile ? window.turnstile.getResponse(turnstileId) : undefined;
    const out = await call({ action: 'submit', ...v, phone: normalisePhone(v.phone), consent: v.consent === 'yes', turnstile_token: token });
    btn.disabled = false;
    btn.textContent = t('Submit query');
    if (turnstileId !== null) window.turnstile?.reset(turnstileId);
    if (out.ok) {
      form.reset();
      result.replaceChildren(h('div', { class: 'callout success' },
        h('p', {}, out.demo ? 'Practice mode — the query is saved in this browser only, so you can answer it from the admin console. Ticket reference:' : t('Your query has been received. Please note your ticket reference:')),
        h('p', { class: 'reference' }, out.reference),
        h('p', { class: 'muted' }, t('Use it with your registered email to check the reply.'))));
    } else {
      setErrors(form, out.fields || {});
      result.replaceChildren(h('p', { class: 'callout error' }, out.error || 'Could not send your query.'));
    }
  });

  const statusForm = h('form', { class: 'card form', novalidate: true },
    h('h2', { class: 'card-title small' }, t('Track a ticket')),
    field(t('Ticket reference'), h('input', { id: 'st-ref', name: 'reference', placeholder: 'ENG2610-1A2B3C4D', maxlength: '30', required: true, autocapitalize: 'characters' })),
    field(t('Email used'), h('input', { id: 'st-email', name: 'email', type: 'email', autocomplete: 'email', required: true })),
    h('div', { class: 'form-actions' }, h('button', { class: 'btn', type: 'submit' }, t('Check status'))),
    statusOut);

  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(statusForm).entries());
    statusOut.replaceChildren(h('p', { class: 'muted' }, 'Looking up…'));
    const out = await call({ action: 'status', reference: v.reference.trim(), email: v.email.trim() });
    if (!out.ok) {
      statusOut.replaceChildren(h('p', { class: 'callout error' }, out.error));
      return;
    }
    const t = out.ticket;
    statusOut.replaceChildren(h('div', { class: 'ticket' },
      h('p', {}, h('span', { class: `status-pill s-${t.status}` }, STATUS_LABEL[t.status] || t.status), ' ', t.reference),
      h('p', { class: 'meta' }, `${t.subject} · raised ${fmtDate(t.created_at)} · updated ${fmtDate(t.updated_at)}`),
      t.public_reply
        ? h('blockquote', { class: 'reply' }, h('p', {}, t.public_reply), h('cite', {}, 'Department of English'))
        : h('p', { class: 'muted' }, 'No reply yet — the department will respond here.')));
  });

  const email = setting(content, 'contact_email');
  const phone = setting(content, 'contact_phone');
  const mail = email ? safeUrl(`mailto:${email}`) : null;
  const tel = phone ? safeUrl(`tel:${String(phone).replace(/[^+\d]/g, '')}`) : null;

  return h('div', { class: 'helpdesk' },
    resolutionRing(content.helpdesk_stats),
    h('div', { class: 'grid grid-2-1' }, form,
      h('div', { class: 'stack' }, statusForm,
        h('aside', { class: 'card contact' },
          h('h2', { class: 'card-title small' }, t('Department office')),
          setting(content, 'contact_address') ? h('p', {}, setting(content, 'contact_address')) : null,
          setting(content, 'office_hours') ? h('p', { class: 'meta' }, setting(content, 'office_hours')) : null,
          mail ? h('p', {}, h('a', { href: mail, class: 'link' }, email)) : null,
          tel ? h('p', {}, h('a', { href: tel, class: 'link' }, phone)) : null))));
}
