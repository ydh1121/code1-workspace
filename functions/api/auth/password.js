import { configured, sameOrigin, bridge, hmac, json, failure, accountCookie } from '../../_shared/security.js';
import { passwordMatches } from '../../_shared/password.js';
export async function onRequestPost(context) {
  const {request,env}=context;
  try {
    sameOrigin(request,env);if(!configured(env))throw Error('SETUP_REQUIRED');
    const raw=await request.text();if(raw.length>2000)return json({error:'TOO_LARGE'},413);
    const p=JSON.parse(raw),username=String(p.username||'').trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||typeof p.password!=='string'||p.password.length>128)throw Error('LOGIN_INVALID');
    const ipKey=await hmac('code1-login-ip:'+request.headers.get('CF-Connecting-IP'),env.BRIDGE_SECRET);
    const attempt=await bridge(env,null,'auth.fast',{username,ipKey});
    const verified=await passwordMatches(p.password,attempt?.credential,env);
    const user=verified?attempt?.user:null;
    if(!verified||!user?.id||!Number.isInteger(user.version)){
      context.waitUntil?.(bridge(env,null,'auth.audit',{accountId:user?.id||'',success:false}).catch(()=>{}));
      throw Error('LOGIN_INVALID');
    }
    const response=json({user});response.headers.set('Set-Cookie',await accountCookie(user,env));
    context.waitUntil?.(bridge(env,null,'auth.audit',{accountId:user.id,success:true}).catch(()=>{}));
    return response;
  } catch(e){return failure(e);}
}
