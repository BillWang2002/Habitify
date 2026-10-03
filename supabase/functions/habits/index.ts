import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const errors: Record<string, number> = { LOGIN_REQUIRED: 401, STALE_DATA: 409, TODAY_CHANGED: 409, REQUEST_REUSED: 409, HABIT_NOT_FOUND: 404, HABIT_ARCHIVED: 409, RESTORE_EXPIRED: 409, HABIT_LIMIT: 422, INVALID_TIMEZONE: 422, INVALID_REQUEST: 422, INVALID_PROGRESS: 422 };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ code: 'LOGIN_REQUIRED' }, 401);
  try {
    // No management client: forwarded user identity also authorizes the atomic RPC.
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !identity.user) return reply({ code: 'LOGIN_REQUIRED' }, 401);
    const body = await req.text();
    if (body.length > 8192) return reply({ code: 'INVALID_REQUEST' }, 413);
    let p;
    try { p = JSON.parse(body); } catch { return reply({ code: 'INVALID_REQUEST' }, 422); }
    if (!p || Array.isArray(p) || typeof p !== 'object') return reply({ code: 'INVALID_REQUEST' }, 422);
    const { data, error } = await client.rpc('habitify_request', { p });
    if (error) {
      const code = Object.keys(errors).find(key => error.message === key);
      return reply({ code: code || (['23514','23502','22P02','22003'].includes(error.code) ? 'INVALID_REQUEST' : 'BACKEND_ERROR') }, code ? errors[code] : ['23514','23502','22P02','22003'].includes(error.code) ? 422 : 500);
    }
    return reply({ data });
  } catch { return reply({ code: 'BACKEND_ERROR' }, 503); }
});
