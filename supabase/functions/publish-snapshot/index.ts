// POST /functions/v1/publish-snapshot   (Authorization: Bearer <staff JWT>)
// Freezes all public content into snapshot/content.json on Supabase Storage.
// Public visitors read that one CDN-cached file instead of querying the
// database — thousands of concurrent learners cost the database nothing.
import { handleError, json, preflight } from '../_shared/http.ts';
import { requireStaff, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const staff = await requireStaff(req, ['admin', 'editor']);
    const sb = serviceClient();
    const { data, error } = await sb.rpc('public_content');
    if (error) throw error;

    const payload = JSON.stringify({ ...data, published_by: staff.full_name });
    const blob = new Blob([payload], { type: 'application/json' });
    const { error: upErr } = await sb.storage.from('snapshot').upload('content.json', blob, {
      upsert: true,
      contentType: 'application/json',
      cacheControl: Deno.env.get('SNAPSHOT_CACHE_SECONDS') ?? '60',
    });
    if (upErr) throw upErr;

    return json(req, { ok: true, generated_at: data.generated_at, bytes: payload.length });
  } catch (e) {
    return handleError(req, e);
  }
});
