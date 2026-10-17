// Shared HTTP helpers for Edge Functions: CORS allow-list, JSON responses, client fingerprint.

const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  // In production set ALLOWED_ORIGINS="https://english.baou.edu.in,https://<project>.pages.dev"
  const ok = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function originAllowed(req: Request): boolean {
  if (allowed.length === 0) return true;
  const origin = req.headers.get('origin');
  return !origin || allowed.includes(origin);
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  if (!originAllowed(req)) return json(req, { error: 'Origin not allowed' }, 403);
  return null;
}

export async function readJson(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Salted SHA-256 of the client IP — we never store raw IPs. */
export async function clientFingerprint(req: Request): Promise<string> {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    ((req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown');
  const salt = Deno.env.get('IP_HASH_SALT') ?? 'baou-english';
  return sha256(`${salt}:${ip}`);
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function handleError(req: Request, e: unknown): Response {
  if (e instanceof HttpError) return json(req, { error: e.message }, e.status);
  console.error(e);
  return json(req, { error: 'Something went wrong. Please try again shortly.' }, 500);
}
