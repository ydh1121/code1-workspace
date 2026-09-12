import {createDb} from './db.mjs';
import {publicAccount} from './core.mjs';
import {bootstrap} from './rpc-adapter.mjs';

const esc=encodeURIComponent;

async function farmIdsFor(db,row){
  if(row?.role!=='FARMER')return [];
  const rows=await db.select('farm_access',`account_id=eq.${esc(row.account_id)}&select=farm_id`);
  return (rows||[]).map(r=>r.farm_id);
}

function credentialFrom(row){
  if(!row?.password_hash)return null;
  return {
    salt:row.password_salt,
    hash:row.password_hash,
    iterations:Number(row.password_iterations),
    scheme:row.password_scheme
  };
}

export async function stagingAuthFast(env,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl);
  const username=String(payload.username||'').trim().toLowerCase();
  const ipKey=String(payload.ipKey||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))throw Error('LOGIN_INVALID');
  if(!/^[a-f0-9]{64}$/.test(ipKey))throw Error('FORBIDDEN');

  await db.rpc('code1_auth_throttle',{p_username:username,p_ip_key:ipKey});
  const row=(await db.select('workspace_accounts',`username=eq.${esc(username)}&select=*`))?.[0]||null;
  if(!row||row.archived_at||row.status!=='active'||!['SUPER_ADMIN','ADMIN','FARMER'].includes(row.role)){
    return {credential:null,user:null,bootstrap:null};
  }
  if(row.role==='SUPER_ADMIN'&&row.account_id!=='OWNER')throw Error('FORBIDDEN');
  const farmIds=await farmIdsFor(db,row);
  const user=publicAccount(row,farmIds);
  // Match the optimized Apps Script auth.fast contract: Cloudflare receives the
  // credential and bootstrap together, but returns bootstrap to the browser only
  // after PBKDF2 verification succeeds.
  const boot=await bootstrap(env,{accountId:user.id,version:user.version},fetchImpl);
  return {credential:credentialFrom(row),user,bootstrap:boot};
}

export async function stagingAuthAudit(env,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl);
  const id=String(payload.accountId||'').slice(0,120);
  const success=payload.success===true;
  await db.insert('audit_log',{
    actor_id:success&&id?id:null,
    action:success?'login.success':'login.failure',
    target_type:'ACCOUNT',
    target_id:id||null,
    detail:success?'아이디 로그인':'',
    metadata:{backend:'SUPABASE_STAGING'}
  },'return=minimal');
  return {logged:true};
}

export async function stagingGoogleIdentity(env,email,fetchImpl=fetch){
  const db=createDb(env,fetchImpl);
  const normalized=String(email||'').trim().toLowerCase();
  if(!normalized)throw Error('FORBIDDEN');
  const row=(await db.select('workspace_accounts','account_id=eq.OWNER&select=*'))?.[0];
  if(!row||row.archived_at||row.role!=='SUPER_ADMIN'||row.status!=='active'||String(row.email||'').trim().toLowerCase()!==normalized)throw Error('FORBIDDEN');
  return publicAccount(row,[]);
}

export async function dispatchStagingAuth(env,action,payload={},fetchImpl=fetch){
  if(action==='auth.fast')return stagingAuthFast(env,payload,fetchImpl);
  if(action==='auth.audit')return stagingAuthAudit(env,payload,fetchImpl);
  if(action==='identity')return stagingGoogleIdentity(env,payload.email||payload,fetchImpl);
  throw Error('STAGING_AUTH_ACTION_NOT_IMPLEMENTED');
}
