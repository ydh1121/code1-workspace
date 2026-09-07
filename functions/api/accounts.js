import { session, sameOrigin, bridge, json, failure, accountCookie } from '../_shared/security.js';
import { passwordHash, passwordMatches } from '../_shared/password.js';
export async function onRequestGet({request,env}) {
  try {const s=await session(request,env);return json({data:await bridge(env,s,'account.list')});}catch(e){return failure(e);}
}
export async function onRequestPost({request,env}) {
  try {
    sameOrigin(request,env);const s=await session(request,env);
    const raw=await request.text();if(raw.length>16000)return json({error:'TOO_LARGE'},413);
    const p=JSON.parse(raw),me=await bridge(env,s,'account.self');
    if(p.action==='password'){
      const stored=await bridge(env,s,'account.credential');
      const recovery=me.role==='SUPER_ADMIN'&&s.method==='google'&&Date.now()-s.authAt<300000;
      if(stored&&!recovery&&!await passwordMatches(p.currentPassword,stored,env))throw Error('현재 비밀번호가 맞지 않습니다.');
      const data=await bridge(env,s,'account.password',{credential:await passwordHash(p.password,env)});
      const response=json({data});response.headers.set('Set-Cookie',await accountCookie(data,env));return response;
    }
    if(!['SUPER_ADMIN','ADMIN'].includes(me.role)||p.action!=='save')throw Error('FORBIDDEN');
    // Explicit fields only: the browser cannot submit hashes or session versions.
    const payload={id:p.id||'',baseVersion:p.baseVersion,username:p.username,displayName:p.displayName,role:p.role,status:p.status,permissions:p.permissions};
    if(p.password)payload.credential=await passwordHash(p.password,env);
    return json({data:await bridge(env,s,'account.save',payload)});
  }catch(e){return failure(e);}
}
