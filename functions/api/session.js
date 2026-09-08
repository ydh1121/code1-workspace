import { configured, session, json, failure } from '../_shared/security.js';
export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false, authenticated: false });
  const googleEnabled=!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
  try {
    // Session restore is intentionally edge-local. Account status/version is
    // revalidated by the first authenticated data RPC (bootstrap or another
    // action), so opening the login screen no longer waits on Apps Script.
    await session(request, env);
    return json({ configured: true, authenticated: true, googleEnabled });
  } catch(e) {
    if(e.message!=='UNAUTHENTICATED')return failure(e);
    return json({ configured: true, authenticated: false, googleEnabled });
  }
}
