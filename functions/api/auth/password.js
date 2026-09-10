import { configured, sameOrigin, bridge, hmac, json, failure, accountCookie, loginIpSecret } from '../../_shared/security.js';
import { passwordMatches } from '../../_shared/password.js';
import { stagingAuthFast, stagingAuthAudit } from '../../../backend/staging/src/auth-adapter.mjs';
import { useSupabaseStaging } from '../../../backend/staging/src/runtime-mode.mjs';

export async function onRequestPost(context) {
  const {request,env}=context;
  try {
    sameOrigin(request,env);if(!configured(env))throw Error('SETUP_REQUIRED');
    const raw=await request.text();if(raw.length>2000)return json({error:'TOO_LARGE'},413);
    const p=JSON.parse(raw),username=String(p.username||'').trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||typeof p.password!=='string'||p.password.length>128)throw Error('LOGIN_INVALID');
    const ipKey=await hmac('code1-login-ip:'+request.headers.get('CF-Connecting-IP'),loginIpSecret(env));
    const staging=useSupabaseStaging(env);
    let attempt,legacy=false;
    if(staging){
      // Staging mode is fail-closed: do not fall back to Apps Script on a DB error.
      attempt=await stagingAuthFast(env,{username,ipKey});
    }else{
      try{attempt=await bridge(env,null,'auth.fast',{username,ipKey});}
      catch(error){
        if(!/UNKNOWN_ACTION|BRIDGE_UPDATE_REQUIRED/.test(String(error?.message||error)))throw error;
        legacy=true;attempt=await bridge(env,null,'auth.begin',{username,ipKey});
      }
    }
    const verified=await passwordMatches(p.password,attempt?.credential,env);
    let user=null,bootstrap=null;
    if(staging){
      if(verified){user=attempt?.user||null;bootstrap=attempt?.bootstrap||null;}
    }else if(legacy){
      user=await bridge(env,null,'auth.finish',{ticket:attempt.ticket,verified});
    }else if(verified){
      user=attempt?.user||null;bootstrap=attempt?.bootstrap||null;
    }
    if(!verified||!user?.id||!Number.isInteger(user.version)){
      if(staging)context.waitUntil?.(stagingAuthAudit(env,{accountId:user?.id||'',success:false}).catch(()=>{}));
      else if(!legacy)context.waitUntil?.(bridge(env,null,'auth.audit',{accountId:user?.id||'',success:false}).catch(()=>{}));
      throw Error('LOGIN_INVALID');
    }
    const response=json({user,bootstrap});response.headers.set('Set-Cookie',await accountCookie(user,env));
    if(staging)context.waitUntil?.(stagingAuthAudit(env,{accountId:user.id,success:true}).catch(()=>{}));
    else if(!legacy)context.waitUntil?.(bridge(env,null,'auth.audit',{accountId:user.id,success:true}).catch(()=>{}));
    return response;
  } catch(e){return failure(e);}
}
