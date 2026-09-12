import {createDb} from './db.mjs';
import {loadActor,assertAdmin} from './authz.mjs';
import {publicAccount,parsePermissions,cleanString} from './core.mjs';
const esc=encodeURIComponent;
const credentialValid=c=>c&&/^[a-f0-9]{64}$/.test(c.hash||'')&&/^[a-f0-9]{32}$/.test(c.salt||'')&&Number(c.iterations)===100000&&c.scheme==='pbkdf2-sha256-pepper-v1';

async function farmIdsFor(db,row){if(row.role!=='FARMER')return [];const r=await db.select('farm_access',`account_id=eq.${esc(row.account_id)}&select=farm_id`);return (r||[]).map(x=>x.farm_id);}
export async function accountSelf(env,principal,fetchImpl=fetch){const db=createDb(env,fetchImpl),a=await loadActor(db,principal);return a.user;}
export async function accountCredential(env,principal,fetchImpl=fetch){const db=createDb(env,fetchImpl),a=await loadActor(db,principal);const r=a.row;return r.password_hash?{salt:r.password_salt,hash:r.password_hash,iterations:Number(r.password_iterations),scheme:r.password_scheme}:null;}
export async function accountList(env,principal,fetchImpl=fetch){const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);assertAdmin(actor);const [rows,farms]=await Promise.all([db.select('workspace_accounts','archived_at=is.null&order=created_at.asc&select=*'),db.select('farms','order=farm_id.asc&select=farm_id,internal_name,public_name')]);const accounts=[];for(const r of rows||[])accounts.push(publicAccount(r,await farmIdsFor(db,r)));return {accounts,farms:(farms||[]).map(f=>({id:f.farm_id,name:f.internal_name||f.public_name||f.farm_id}))};}

export async function accountSave(env,principal,p,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);assertAdmin(actor);
  const id=String(p?.id||''),rows=id?await db.select('workspace_accounts',`account_id=eq.${esc(id)}&select=*`):[],old=rows?.[0]||null;
  if(id&&!old)throw Error('NOT_FOUND');
  if(old?.archived_at)throw Error('FORBIDDEN');
  if(old&&(old.account_id==='OWNER'||old.account_id===actor.row.account_id))throw Error('FORBIDDEN');
  if(actor.row.role!=='SUPER_ADMIN'&&((old&&old.role!=='FARMER')||p.role!=='FARMER'))throw Error('FORBIDDEN');
  if(!['ADMIN','FARMER'].includes(p.role)||!['active','disabled'].includes(p.status))throw Error('INVALID_ACCOUNT');
  if(old&&Number(old.session_version)!==Number(p.baseVersion))throw Error('CONFLICT');
  const username=String(p.username||'').trim().toLowerCase(),display=cleanString(p.displayName,80);
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||!display)throw Error('INVALID_ACCOUNT');
  if(old&&username!==old.username)throw Error('FORBIDDEN');
  let permissions={},farmIds=[];
  if(p.role==='FARMER'){
    const q=parsePermissions(p.permissions||{});farmIds=[...new Set(q.farmIds)];
    if(q.farm!=='none'&&!farmIds.length)throw Error('INVALID_PERMISSIONS');
    permissions={farm:q.farm,deck:q.deck,farmIds};
  }
  if(p.credential&&!credentialValid(p.credential))throw Error('INVALID_CREDENTIAL');
  if(!old&&!p.credential)throw Error('INVALID_CREDENTIAL');
  const accountId=old?.account_id||`U_${crypto.randomUUID().replace(/-/g,'').slice(0,24)}`;
  const saved=(await db.rpc('code1_save_account',{
    p_actor_id:actor.row.account_id,
    p_account_id:accountId,
    p_base_version:old?Number(p.baseVersion):0,
    p_username:username,
    p_display_name:display,
    p_role:p.role,
    p_status:p.status,
    p_permissions:permissions,
    p_farm_ids:farmIds,
    p_credential:p.credential||null
  }))?.[0];
  if(!saved)throw Error('CONFLICT');
  return publicAccount(saved,farmIds);
}

export async function accountPassword(env,principal,p,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  if(!credentialValid(p?.credential))throw Error('INVALID_CREDENTIAL');
  const updated=(await db.rpc('code1_change_password',{
    p_actor_id:actor.row.account_id,
    p_base_version:Number(actor.row.session_version),
    p_credential:p.credential
  }))?.[0];
  if(!updated)throw Error('CONFLICT');
  return publicAccount(updated,actor.farmIds);
}

export async function dispatchAccountAction(env,principal,action,p={},fetchImpl=fetch){if(action==='account.self')return accountSelf(env,principal,fetchImpl);if(action==='account.credential')return accountCredential(env,principal,fetchImpl);if(action==='account.list')return accountList(env,principal,fetchImpl);if(action==='account.save')return accountSave(env,principal,p,fetchImpl);if(action==='account.password')return accountPassword(env,principal,p,fetchImpl);throw Error('STAGING_ACTION_NOT_IMPLEMENTED');}
