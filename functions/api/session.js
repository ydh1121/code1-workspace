import { configured, session, json } from '../_shared/security.js';
export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false, authenticated: false });
  try { const s = await session(request, env); return json({ configured: true, authenticated: true, email: s.email }); }
  catch { return json({ configured: true, authenticated: false }); }
}
