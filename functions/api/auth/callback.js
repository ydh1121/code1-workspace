import { origin, verify, readCookie, decode, bridge, cookie, accountCookie } from '../../_shared/security.js';
import { stagingGoogleIdentity } from '../../../backend/staging/src/auth-adapter.mjs';
import { useSupabaseStaging } from '../../../backend/staging/src/runtime-mode.mjs';
function failureReason(error) {
  const message=String(error?.message||'');
  if(message==='DENIED')return 'oauth_denied';
  if(message==='BRIDGE_UPDATE_REQUIRED')return 'bridge_version';
  if(message==='FORBIDDEN')return 'owner_forbidden';
  if(message==='AUTH_SETUP_REQUIRED')return 'owner_setup';
  if(message==='ACCOUNT_SCHEMA_MISMATCH')return 'account_schema';
  if(message==='OWNER_ACCOUNT_MISSING')return 'owner_account';
  if(message==='SETUP_REQUIRED')return 'cloudflare_config';
  if(message==='BRIDGE_UNAVAILABLE')return 'bridge_unavailable';
  if(/CODE1_OWNER_|ReferenceError|is not defined/.test(message))return 'bridge_runtime';
  return 'unknown';
}
export async function onRequestGet({request,env}) {
  const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  headers.append('Set-Cookie',cookie('__Host-code1-oauth','',0));
  try {
    const p=new URL(request.url).searchParams, pending=await verify(readCookie(request,'__Host-code1-oauth'),env.SESSION_SECRET);
    if(!pending||pending.kind!=='oauth'||pending.state!==p.get('state')||!p.get('code')||p.has('error')) throw Error('DENIED');
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:p.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:origin(env)+'/api/auth/callback',grant_type:'authorization_code',code_verifier:pending.verifier})});
    if(!r.ok)throw Error('DENIED');const token=await r.json();
    const claims=decode(token.id_token.split('.')[1]);
    if(claims.aud!==env.GOOGLE_CLIENT_ID||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID)||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.nonce!==pending.nonce||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!Number.isFinite(claims.iat)||claims.iat*1000>Date.now()+60000||claims.email_verified!==true||!claims.sub)throw Error('DENIED');
    const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});
    if(!info.ok)throw Error('DENIED');const user=await info.json();
    if(user.sub!==claims.sub||user.email!==claims.email||user.email_verified!==true)throw Error('DENIED');
    const email=user.email.trim().toLowerCase();
    const account=useSupabaseStaging(env)
      ? await stagingGoogleIdentity(env,email)
      : await bridge(env,email,'identity');
    if(!account||typeof account.id!=='string'||!account.id||!Number.isInteger(account.version)||account.version<1)throw Error('BRIDGE_UPDATE_REQUIRED');
    headers.append('Set-Cookie',await accountCookie(account,env,'google'));
    headers.set('Location',origin(env)+'/');
  }catch(error) {
    headers.set('Location',origin(env)+'/?login=failed&reason='+failureReason(error));
  }
  return new Response(null,{status:303,headers});
}
