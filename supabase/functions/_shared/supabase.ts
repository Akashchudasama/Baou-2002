import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS — use only after validating the request. */
export function serviceClient(): SupabaseClient {
  if (!admin) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Supabase environment not configured');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

export type StaffRole = 'admin' | 'editor' | 'helpdesk';

/**
 * Verifies the caller's JWT with Supabase Auth and checks their staff role.
 * Throws 401/403 HttpErrors otherwise.
 */
export async function requireStaff(req: Request, roles: StaffRole[]) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required');
  const sb = serviceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Session expired — please sign in again');
  const { data: staff } = await sb
    .from('staff')
    .select('user_id, full_name, email, role, active')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!staff || !staff.active || !roles.includes(staff.role)) throw new HttpError(403, 'Not authorised');
  return staff as { user_id: string; full_name: string; email: string; role: StaffRole; active: boolean };
}
