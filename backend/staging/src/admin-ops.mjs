import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {cleanString} from './core.mjs';
import {ACCESS_CAPABILITIES,ACCESS_CATALOG,resolveWorkspaceAccess,publicAccess} from './workspace-access.mjs';

const esc=encodeURIComponent;
const requestId=value=>/^[a-f0-9]{32}$/.test(String(value||''));
const validId=value=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(value||''));

async function ownerActor(db,principal){
  const actor=await loadActor(db,principal);
  if(actor.row.account_id!=='OWNER'||actor.row.role!=='SUPER_ADMIN')throw Error('FORBIDDEN');
  return actor;
}

const accountLabel=(row)=>({id:row.account_id,username:row.username,displayName:row.display_name,role:row.role,status:row.status,archivedAt:row.archived_at||null,version:Number(row.session_version||0)});

export async function adminOverview(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl);await ownerActor(db,principal);
  const [farms,submissions,media,accounts,facts]=await Promise.all([
    db.select('farms','order=farm_id.asc&select=farm_id,internal_name,public_name,onboarding_status,origin_cohort,created_at,updated_at'),
    db.select('intake_submissions','select=submission_id,farm_id,status,updated_at'),
    db.select('media_assets','status=neq.DELETED&select=media_id,farm_id,status'),
    db.select('workspace_accounts','order=created_at.asc&select=account_id,username,display_name,role,status,archived_at,session_version,created_at,updated_at'),
    db.select('fact_inbox','select=fact_id,status')
  ]);
  const submissionCounts=new Map(),mediaCounts=new Map();
  for(const row of submissions||[])submissionCounts.set(row.farm_id,(submissionCounts.get(row.farm_id)||0)+1);
  for(const row of media||[])mediaCounts.set(row.farm_id,(mediaCounts.get(row.farm_id)||0)+1);
  const farmRows=(farms||[]).map(row=>({
    id:row.farm_id,
    name:row.internal_name||row.public_name||row.farm_id,
    onboardingStatus:row.onboarding_status,
    originCohort:row.origin_cohort===true,
    submissionCount:submissionCounts.get(row.farm_id)||0,
    mediaCount:mediaCounts.get(row.farm_id)||0,
    canDelete:(submissionCounts.get(row.farm_id)||0)===0&&(mediaCounts.get(row.farm_id)||0)===0
  }));
  const activeAccounts=(accounts||[]).filter(a=>!a.archived_at);
  return {
    farms:farmRows,
    accounts:activeAccounts.map(accountLabel),
    snapshot:{
      farmCount:farmRows.length,
      submissionCount:(submissions||[]).length,
      mediaCount:(media||[]).length,
      activeAccountCount:activeAccounts.length,
      archivedAccountCount:(accounts||[]).length-activeAccounts.length,
      factCount:(facts||[]).length,
      verifiedFactCount:(facts||[]).filter(f=>['VERIFIED','APPROVED_CURRENT'].includes(f.status)).length,
      capturedAt:new Date().toISOString(),
      backend:'SUPABASE_STAGING'
    }
  };
}

export async function adminAudit(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl);await ownerActor(db,principal);
  const limit=Math.max(20,Math.min(500,Number(payload.limit)||250));
  const [audit,mediaEvents,reviewDecisions,accounts]=await Promise.all([
    db.select('audit_log',`order=at.desc&limit=${limit}&select=audit_id,at,actor_id,action,target_type,target_id,detail,request_id,metadata`),
    db.select('media_events',`order=at.desc&limit=${Math.min(limit,200)}&select=event_id,at,actor_id,event_type,media_id,from_status,to_status,detail,request_id`),
    db.select('review_decisions',`order=created_at.desc&limit=${Math.min(limit,200)}&select=decision_id,created_at,actor_id,subject_type,subject_id,old_status,new_status,note,request_id`),
    db.select('workspace_accounts','select=account_id,username,display_name,role,status,archived_at')
  ]);
  const labels=new Map((accounts||[]).map(a=>[a.account_id,{username:a.username,displayName:a.display_name,role:a.role}]));
  const events=[];
  for(const row of audit||[])events.push({source:'AUDIT',id:`A${row.audit_id}`,at:row.at,actorId:row.actor_id,actor:labels.get(row.actor_id)||null,action:row.action,targetType:row.target_type,targetId:row.target_id,detail:row.detail||'',requestId:row.request_id||'',metadata:row.metadata||{}});
  for(const row of mediaEvents||[])events.push({source:'MEDIA',id:`M${row.event_id}`,at:row.at,actorId:row.actor_id,actor:labels.get(row.actor_id)||null,action:`media.${String(row.event_type||'event').toLowerCase()}`,targetType:'MEDIA',targetId:row.media_id,detail:[row.from_status&&`${row.from_status}→${row.to_status}`,row.detail].filter(Boolean).join(' · '),requestId:row.request_id||'',metadata:{}});
  for(const row of reviewDecisions||[])events.push({source:'REVIEW',id:`R${row.decision_id}`,at:row.created_at,actorId:row.actor_id,actor:labels.get(row.actor_id)||null,action:'review.decision',targetType:row.subject_type,targetId:row.subject_id,detail:[row.old_status&&`${row.old_status}→${row.new_status}`,row.note].filter(Boolean).join(' · '),requestId:row.request_id||'',metadata:{}});
  events.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return {events:events.slice(0,limit),generatedAt:new Date().toISOString(),scope:'OWNER_ONLY'};
}

export async function adminAccessProfiles(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl);await ownerActor(db,principal);
  const rows=await db.select('workspace_accounts','archived_at=is.null&order=created_at.asc&select=*');
  const accounts=[];
  for(const row of rows||[]){
    const profile=await resolveWorkspaceAccess(db,{row});
    accounts.push({...accountLabel(row),access:publicAccess(profile)});
  }
  return {catalog:ACCESS_CATALOG,accounts};
}

export async function saveAdminAccessProfile(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  const capabilities=[...new Set((payload.capabilities||[]).map(String))];
  if(!validId(id)||!requestId(rid)||capabilities.some(x=>!ACCESS_CAPABILITIES.includes(x)))throw Error('INVALID_REQUEST');
  await db.rpc('code1_set_account_capabilities',{p_actor_id:actor.row.account_id,p_account_id:id,p_capabilities:capabilities,p_request_id:rid});
  const row=(await db.select('workspace_accounts',`account_id=eq.${esc(id)}&archived_at=is.null&select=*`))?.[0];
  if(!row)throw Error('NOT_FOUND');
  const profile=await resolveWorkspaceAccess(db,{row});
  return {...accountLabel(row),access:publicAccess(profile)};
}

export async function deleteEmptyFarm(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_delete_empty_farm',{p_actor_id:actor.row.account_id,p_farm_id:id,p_reason:cleanString(payload.reason||'최고 관리자 삭제',500),p_request_id:rid});
  return rows?.[0]||{farm_id:id,deleted:true};
}

export async function archiveAccount(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_archive_account',{p_actor_id:actor.row.account_id,p_account_id:id,p_reason:cleanString(payload.reason||'최고 관리자 삭제',500),p_request_id:rid});
  const row=rows?.[0];if(!row)throw Error('NOT_FOUND');
  return {id:row.account_id,username:row.username,displayName:row.display_name,status:row.status,archivedAt:row.archived_at,version:Number(row.session_version)};
}

export async function dispatchAdminOps(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'admin.overview':return adminOverview(env,principal,fetchImpl);
    case 'admin.audit':return adminAudit(env,principal,payload,fetchImpl);
    case 'admin.access.list':return adminAccessProfiles(env,principal,fetchImpl);
    case 'admin.access.save':return saveAdminAccessProfile(env,principal,payload,fetchImpl);
    case 'admin.farm.delete':return deleteEmptyFarm(env,principal,payload,fetchImpl);
    case 'admin.account.delete':return archiveAccount(env,principal,payload,fetchImpl);
    default:throw Error('ADMIN_ACTION_NOT_IMPLEMENTED');
  }
}
