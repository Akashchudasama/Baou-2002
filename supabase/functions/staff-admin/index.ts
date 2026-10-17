// POST /functions/v1/staff-admin   (Authorization: Bearer <admin JWT>)
//   { action: "invite", email, full_name, role }
// Invites a colleague by email (Supabase sends the invitation) and grants a role.
// Role changes and deactivation are done directly from the admin console,
// protected by Row Level Security.
import { handleError, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { cleanText, isEmail, oneOf } from '../_shared/sanitize.ts';
import { requireStaff, serviceClient } from '../_shared/supabase.ts';

const ROLES = ['admin', 'editor', 'helpdesk'] as const;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    await requireStaff(req, ['admin']);
    const body = await readJson(req);
    if (body.action !== 'invite') throw new HttpError(400, 'Unknown action');

    const email = cleanText(body.email, 254).toLowerCase();
    const fullName = cleanText(body.full_name, 120);
    const role = oneOf(body.role, ROLES);
    if (!isEmail(email) || fullName.length < 2 || !role) throw new HttpError(422, 'Name, a valid email and a role are required.');

    const sb = serviceClient();
    const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl ? `${siteUrl}/admin/` : undefined,
      data: { full_name: fullName },
    });
    if (error) throw new HttpError(400, error.message);

    const { error: staffErr } = await sb
      .from('staff')
      .upsert({ user_id: data.user.id, full_name: fullName, email, role, active: true });
    if (staffErr) throw staffErr;

    return json(req, { ok: true, user_id: data.user.id });
  } catch (e) {
    return handleError(req, e);
  }
});
