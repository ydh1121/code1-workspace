import { origin, verify, readCookie, decode, bridge, cookie, accountCookie } from '../../_shared/security.js';
export async function onRequestGet({request,env}) {
  const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  headers.append('Set-Cookie',cookie('__Host-code1-oauth','',0));
  try {
    const p=new URL(request.url).searchParams, pending=await verify(readCookie(request,'__Host-code1-oauth'),env.SESSION_SECRET);
    if(!pending||pending.kind!=='oauth'||pending.state!==p.get('state')||!p.get('code')||p.has('error')) throw Error('DENIED');
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:p.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:origin(env)+'/api/auth/callback',grant_type:'authorization_code',code_verifier:pending.verifier})});
    if(!r.ok)throw Error('DENIED');const token=await r.json();
    // ID token is received only from Google's token endpoint over TLS, never from the browser.
    const claims=decode(token.id_token.split('.')[1]);
    if(claims.aud!==env.GOOGLE_CLIENT_ID||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID)||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.nonce!==pending.nonce||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!Number.isFinite(claims.iat)||claims.iat*1000>Date.now()+60000||claims.email_verified!==true||!claims.sub)throw Error('DENIED');
    const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});
    if(!info.ok)throw Error('DENIED');const user=await info.json();
    if(user.sub!==claims.sub||user.email!==claims.email||user.email_verified!==true)throw Error('DENIED');
    const email=user.email.trim().toLowerCase(),account=await bridge(env,email,'identity');
    headers.append('Set-Cookie',await accountCookie(account,env,'google'));
    headers.set('Location',origin(env)+'/');
  }catch { headers.set('Location',origin(env)+'/?login=failed'); }
  return new Response(null,{status:303,headers});
}
