// POST /functions/v1/inkwell  { question: string, history?: {role:'user'|'assistant', text:string}[] }
// Retrieval-grounded answers over programmes, documents and the knowledge base.
// Uses a FREE Google Gemini API key if GEMINI_API_KEY is set; otherwise (or on
// any AI failure/quota exhaustion) falls back to an extractive answer so the
// companion never goes dark during exam-season spikes.
import { clientFingerprint, handleError, HttpError, json, preflight, readJson, sha256 } from '../_shared/http.ts';
import { cleanText } from '../_shared/sanitize.ts';
import { serviceClient } from '../_shared/supabase.ts';

type Hit = { source: string; title: string; body: string; rank: number };
type Turn = { role: 'user' | 'assistant'; text: string };

const DEFAULT_PROMPT =
  "You are the Muse (Ask the Muse), study companion of the Department of English at BAOU. " +
  'Use ONLY the CONTEXT for university facts; if it is missing, say so and point to the Helpdesk. ' +
  'For literary questions use accurate scholarly knowledge. Be concise (under 220 words).';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function extractive(question: string, hits: Hit[]): string {
  if (!hits.length) {
    return 'I could not find that in the department’s published material yet. Please raise a query in the Helpdesk section, and the department will reply to you there.';
  }
  const words = new Set(question.toLowerCase().match(/[a-zऀ-૿]{4,}/g) ?? []);
  const parts = hits.slice(0, 3).map((h) => {
    const sentences = h.body.split(/(?<=[.!?])\s+/);
    const scored = sentences
      .map((s, i) => ({ s, i, score: [...words].filter((w) => s.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, 2)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.s);
    return `${h.title}: ${scored.join(' ')}`;
  });
  return `From the department’s material:\n\n${parts.join('\n\n')}`;
}

async function askGemini(system: string, question: string, context: string, history: Turn[]): Promise<string | null> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return null;
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          ...history.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.text }] })),
          { role: 'user', parts: [{ text: `CONTEXT:\n${context || '(no matching department material)'}\n\nQUESTION: ${question}` }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });
    if (!r.ok) {
      console.warn('gemini status', r.status);
      return null;
    }
    const out = await r.json();
    const text = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
    return text || null;
  } catch (e) {
    console.warn('gemini error', String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const body = await readJson(req, 24_000);
    const question = cleanText(body.question, 600, { multiline: true });
    if (question.length < 3) throw new HttpError(422, 'Please ask a question of at least a few words.');

    const rawHistory = (Array.isArray(body.history) ? body.history : []) as { role?: unknown; text?: unknown }[];
    const history: Turn[] = rawHistory
      .slice(-6)
      .map((t): Turn => ({
        role: t?.role === 'assistant' ? 'assistant' : 'user',
        text: cleanText(t?.text, 1200, { multiline: true }),
      }))
      .filter((t) => t.text);

    const sb = serviceClient();
    const fp = await clientFingerprint(req);
    const { data: allowed } = await sb.rpc('hit_rate_limit', {
      p_bucket: 'inkwell', p_key: fp, p_limit: 20, p_window_seconds: 600,
    });
    if (allowed === false) throw new HttpError(429, 'The Inkwell needs a short rest — please ask again in a few minutes.');

    // Popular first questions are answered from cache (saves free-tier AI quota during spikes).
    const qHash = await sha256(question.toLowerCase().replace(/\s+/g, ' '));
    if (!history.length) {
      const { data: cached } = await sb.from('inkwell_cache').select('answer, sources, mode, created_at').eq('q_hash', qHash).maybeSingle();
      if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
        return json(req, { answer: cached.answer, sources: cached.sources, mode: cached.mode, cached: true });
      }
    }

    const { data: hitsRaw, error } = await sb.rpc('inkwell_search', { q: question, k: 6 });
    if (error) throw error;
    const hits = ((hitsRaw ?? []) as Hit[]).filter((h) => h.body);
    const context = hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.body}`).join('\n\n').slice(0, 9000);

    const { data: promptRow } = await sb.from('site_settings').select('value').eq('key', 'inkwell_system_prompt').maybeSingle();
    const system = typeof promptRow?.value === 'string' && promptRow.value.trim() ? promptRow.value : DEFAULT_PROMPT;

    const ai = await askGemini(system, question, context, history);
    const answer = ai ?? extractive(question, hits);
    const mode = ai ? 'ai' : 'library';
    const sources = hits.slice(0, 4).map((h) => ({ title: h.title, source: h.source }));

    if (!history.length) {
      await sb.from('inkwell_cache').upsert({ q_hash: qHash, answer, sources, mode, created_at: new Date().toISOString() });
    }
    return json(req, { answer, sources, mode });
  } catch (e) {
    return handleError(req, e);
  }
});
