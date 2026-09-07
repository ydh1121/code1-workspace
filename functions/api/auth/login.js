import { configured, origin, sign, cookie, failure } from '../../_shared/security.js';
export async function onRequestGet({ env }) {
  try {
    if (!configured(env)) throw Error('SETUP_REQUIRED');
    const state=crypto.randomUUID(), nonce=crypto.randomUUID(), verifier=crypto.randomUUID()+crypto.randomUUID();
    const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const pending=await sign({kind:'oauth',state,nonce,verifier,exp:Date.now()+600000},env.SESSION_SECRET);
    const query=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:origin(env)+'/api/auth/callback',response_type:'code',scope:'openid email',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
    return new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+query,'Set-Cookie':cookie('__Host-code1-oauth',pending,600),'Cache-Control':'no-store'}});
  } catch(e) { return failure(e); }
}
