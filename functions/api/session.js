import { configured, session, bridge, json, failure } from '../_shared/security.js';
export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false, authenticated: false });
  const googleEnabled=!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
  try { const s = await session(request, env);const user=await bridge(env,s,'account.self');return json({ configured: true, authenticated: true, googleEnabled, user }); }
  catch(e) { if(e.message!=='UNAUTHENTICATED')return failure(e);return json({ configured: true, authenticated: false,googleEnabled }); }
}
