import {privateObjectKey} from './core.mjs';
const enc=new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u = text => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));

async function hmac(text, secret) {
  if (!secret || secret.length < 32) throw Error('UPLOAD_TOKEN_SECRET_REQUIRED');
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)));
}
function same(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;}

export async function issueUploadAuthorization(env, input, now=Date.now()) {
  const maxBytes = Number(input.maxBytes || input.fileSize);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes > 1024*1024*1024) throw Error('INVALID_FILE_SIZE');
  const mediaId = input.mediaId || `M_${crypto.randomUUID().replace(/-/g,'').slice(0,24)}`;
  const objectKey = privateObjectKey({...input,mediaId});
  const payload={v:1,kind:'media-put',accountId:input.accountId,farmId:input.farmId,submissionId:input.submissionId,mediaId,objectKey,mimeType:String(input.mimeType||'application/octet-stream').slice(0,120),maxBytes,exp:now+10*60*1000};
  const body=b64u(enc.encode(JSON.stringify(payload))),sig=b64u(await hmac(body,env.CODE1_UPLOAD_TOKEN_SECRET));
  return {mediaId,objectKey,token:`${body}.${sig}`,expiresAt:payload.exp};
}

export async function verifyUploadAuthorization(env, token, now=Date.now()) {
  try {
    const [body,sig,extra]=String(token||'').split('.'); if(extra||!body||!sig)return null;
    if(!same(await hmac(body,env.CODE1_UPLOAD_TOKEN_SECRET),unb64u(sig)))return null;
    const p=JSON.parse(new TextDecoder().decode(unb64u(body)));
    if(p.v!==1||p.kind!=='media-put'||!Number.isFinite(p.exp)||p.exp<=now)return null;
    return p;
  } catch { return null; }
}
