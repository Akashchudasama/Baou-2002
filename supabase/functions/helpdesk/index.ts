// POST /functions/v1/helpdesk
//   { action: "submit", name, email, phone, enrolment_no, program_code?, category, subject, message, consent: true, website?, turnstile_token? }
//   { action: "status", reference, email }
import { clientFingerprint, handleError, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { cleanText, isEmail, oneOf } from '../_shared/sanitize.ts';
import { serviceClient } from '../_shared/supabase.ts';

const CATEGORIES = ['admission', 'assignment', 'examination', 'result', 'study-material', 'fees', 'other'] as const;

async function verifyTurnstile(token: unknown, ipHash: string): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) return; // optional: enable by setting the secret
  if (typeof token !== 'string' || token.length > 4096) throw new HttpError(400, 'Please complete the verification check.');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('idempotency_key', crypto.randomUUID());
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const out = await r.json().catch(() => ({}));
  if (!out.success) {
    console.warn('turnstile failed', ipHash.slice(0, 8), out['error-codes']);
    throw new HttpError(400, 'Verification failed — please retry.');
  }
}

async function submit(req: Request, body: Record<string, unknown>) {
  const sb = serviceClient();
  const ipHash = await clientFingerprint(req);

  // Honeypot: real users never fill the hidden "website" field.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json(req, { ok: true, reference: 'ENG-RECEIVED' });
  }

  const { data: allowed } = await sb.rpc('hit_rate_limit', {
    p_bucket: 'helpdesk', p_key: ipHash, p_limit: 5, p_window_seconds: 3600,
  });
  if (allowed === false) throw new HttpError(429, 'Too many tickets from this connection. Please try again in an hour.');

  await verifyTurnstile(body.turnstile_token, ipHash);

  const name = cleanText(body.name, 80);
  const email = cleanText(body.email, 254).toLowerCase();
  const enrolment = cleanText(body.enrolment_no, 30);
  // Indian mobile number: accept spaces, +91 or a leading 0, store 10 digits.
  const phone = cleanText(body.phone, 20).replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '');
  const program = cleanText(body.program_code, 20);
  const category = oneOf(body.category, CATEGORIES);
  const subject = cleanText(body.subject, 140);
  const message = cleanText(body.message, 3000, { multiline: true });

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Please enter your name.';
  if (!isEmail(email)) errors.email = 'Please enter a valid email address.';
  if (!/^[A-Za-z0-9/-]{4,30}$/.test(enrolment)) errors.enrolment_no = 'Please enter your enrolment number (letters, digits, / and - only).';
  if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = 'Please enter a 10-digit mobile number.';
  if (body.consent !== true) errors.consent = 'Please agree to the use of your details for this query.';
  if (program && !/^[A-Za-z0-9-]{2,20}$/.test(program)) errors.program_code = 'Unknown programme.';
  if (!category) errors.category = 'Please choose a category.';
  if (subject.length < 4) errors.subject = 'Please add a short subject (at least 4 characters).';
  if (message.length < 10) errors.message = 'Please describe your query (at least 10 characters).';
  if (Object.keys(errors).length) return json(req, { error: 'Please correct the highlighted fields.', fields: errors }, 422);

  const { data, error } = await sb
    .from('helpdesk_tickets')
    .insert({
      name, email, phone, enrolment_no: enrolment, program_code: program || null,
      category, subject, message, ip_hash: ipHash, consent_at: new Date().toISOString(),
    })
    .select('reference')
    .single();
  if (error) throw error;
  // Occasionally remove personal details of long-closed tickets (data minimisation).
  if (Math.random() < 0.05) sb.rpc('purge_helpdesk_personal_data', { months: 6 }).then(() => {}, () => {});
  return json(req, { ok: true, reference: data.reference });
}

async function status(req: Request, body: Record<string, unknown>) {
  const sb = serviceClient();
  const ipHash = await clientFingerprint(req);
  const { data: allowed } = await sb.rpc('hit_rate_limit', {
    p_bucket: 'helpdesk-status', p_key: ipHash, p_limit: 30, p_window_seconds: 600,
  });
  if (allowed === false) throw new HttpError(429, 'Too many lookups. Please wait a few minutes.');

  const reference = cleanText(body.reference, 30).toUpperCase();
  const email = cleanText(body.email, 254).toLowerCase();
  if (!/^ENG[0-9]{4}-[A-Z0-9]{8}$/.test(reference) || !isEmail(email)) {
    throw new HttpError(422, 'Enter the ticket reference (e.g. ENG2610-1A2B3C4D) and the email you used.');
  }
  const { data } = await sb
    .from('helpdesk_tickets')
    .select('reference, subject, category, status, public_reply, created_at, updated_at, email')
    .eq('reference', reference)
    .maybeSingle();
  // Same response for "not found" and "wrong email" — no enumeration.
  if (!data || data.email.toLowerCase() !== email) throw new HttpError(404, 'No ticket matches that reference and email.');
  const { email: _omit, ...ticket } = data;
  return json(req, { ok: true, ticket });
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const body = await readJson(req);
    if (body.action === 'submit') return await submit(req, body);
    if (body.action === 'status') return await status(req, body);
    throw new HttpError(400, 'Unknown action');
  } catch (e) {
    return handleError(req, e);
  }
});
