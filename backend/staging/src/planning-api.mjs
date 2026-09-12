import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {PLANNING_CAPABILITIES,FACT_STATUSES,assertFactTransition,requiredFactCapability} from './planning-contract.mjs';

const esc=encodeURIComponent;
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const validId=value=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(value||''));
const requestId=value=>/^[a-f0-9]{32}$/.test(String(value||''));

export async function hasPlanningCapability(db,actor,capability){
  if(!Object.values(PLANNING_CAPABILITIES).includes(capability))return false;
  const rows=await db.select('account_capabilities',`account_id=eq.${esc(actor.row.account_id)}&capability=eq.${esc(capability)}&effect=eq.ALLOW&select=capability`);
  return !!rows?.length;
}

export async function requirePlanningCapability(db,actor,capability){
  if(!await hasPlanningCapability(db,actor,capability))throw Error('FORBIDDEN');
}

async function requireAnyFactCapability(db,actor){
  for(const capability of [PLANNING_CAPABILITIES.FACT_SUBMIT,PLANNING_CAPABILITIES.FACT_VERIFY,PLANNING_CAPABILITIES.FACT_APPROVE_CURRENT]){
    if(await hasPlanningCapability(db,actor,capability))return;
  }
  throw Error('FORBIDDEN');
}

export async function listFactInbox(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requireAnyFactCapability(db,actor);
  const status=payload.status&&FACT_STATUSES.includes(String(payload.status))?`&status=eq.${esc(payload.status)}`:'';
  const subjectType=payload.subjectType?`&subject_type=eq.${esc(clean(payload.subjectType,80))}`:'';
  const subjectId=payload.subjectId?`&subject_id=eq.${esc(clean(payload.subjectId,160))}`:'';
  const rows=await db.select('fact_inbox',`select=fact_id,domain,subject_type,subject_id,statement,source_type,reported_by,reported_at,evidence_ref,status,verification_note,verification_confidence,external_disclosure_allowed,verified_by,verified_at,approved_current_at,approved_current_by,supersedes_fact_id,created_by,created_at,updated_by,updated_at${status}${subjectType}${subjectId}&order=updated_at.desc&limit=200`);
  return {facts:rows||[]};
}

export async function createFactInboxItem(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requirePlanningCapability(db,actor,PLANNING_CAPABILITIES.FACT_SUBMIT);
  const domain=clean(payload.domain,80),subjectType=clean(payload.subjectType,80),subjectId=clean(payload.subjectId,160),statement=clean(payload.statement,8000),sourceType=clean(payload.sourceType,80),reportedBy=clean(payload.reportedBy,240);
  if(!domain||!subjectType||!subjectId||!statement||!sourceType||!validId(subjectId))throw Error('INVALID_FACT');
  const supersedes=payload.supersedesFactId?clean(payload.supersedesFactId,160):null;if(supersedes&&!validId(supersedes))throw Error('INVALID_FACT');
  const id=`FACT_${crypto.randomUUID().replace(/-/g,'')}`;
  const row={fact_id:id,domain,subject_type:subjectType,subject_id:subjectId,statement,source_type:sourceType,reported_by:reportedBy||actor.row.account_id,reported_at:payload.reportedAt||new Date().toISOString(),evidence_ref:payload.evidenceRef??null,status:'RECEIVED',external_disclosure_allowed:false,supersedes_fact_id:supersedes,created_by:actor.row.account_id,updated_by:actor.row.account_id};
  const saved=(await db.insert('fact_inbox',row,'return=representation'))?.[0]||row;
  await db.insert('fact_events',{fact_id:id,actor_id:actor.row.account_id,event_type:'RECEIVED',to_status:'RECEIVED',request_id:requestId(payload.requestId)?payload.requestId:null,metadata:{sourceType}},'return=minimal');
  return saved;
}

export async function transitionFactInboxItem(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),id=clean(payload.id,160),toStatus=clean(payload.status,40);
  if(!validId(id)||!FACT_STATUSES.includes(toStatus)||!requestId(payload.requestId))throw Error('INVALID_FACT');
  const current=(await db.select('fact_inbox',`fact_id=eq.${esc(id)}&select=fact_id,status,evidence_ref`))?.[0];if(!current)throw Error('NOT_FOUND');
  assertFactTransition(current.status,toStatus);
  const evidenceRef=payload.evidenceRef??null;
  if(toStatus==='DOCUMENT_RECEIVED'&&evidenceRef===null&&current.evidence_ref==null)throw Error('EVIDENCE_REQUIRED');
  if(['VERIFIED','APPROVED_CURRENT'].includes(toStatus)&&evidenceRef===null&&current.evidence_ref==null)throw Error('EVIDENCE_REQUIRED');
  await requirePlanningCapability(db,actor,requiredFactCapability(toStatus));
  const confidence=payload.confidence===undefined||payload.confidence===null?null:Number(payload.confidence);if(confidence!==null&&(!Number.isFinite(confidence)||confidence<0||confidence>1))throw Error('INVALID_FACT_CONFIDENCE');
  const result=await db.rpc('code1_transition_fact',{p_actor_id:actor.row.account_id,p_fact_id:id,p_to_status:toStatus,p_note:clean(payload.note,2000)||null,p_confidence:confidence,p_evidence_ref:evidenceRef,p_request_id:payload.requestId});
  return result?.[0]||{fact_id:id,status:toStatus};
}

export async function getPublishedExecutiveBrief(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requirePlanningCapability(db,actor,PLANNING_CAPABILITIES.EXECUTIVE_BRIEF_VIEW);
  const rows=await db.select('planning_brief_versions','brief_key=eq.EXECUTIVE_CURRENT&status=eq.PUBLISHED&select=brief_key,brief_version,status,source_revision,source_version,content_json,sections,confidentiality,published_at,published_by&limit=1');
  const brief=rows?.[0];if(!brief)throw Error('NOT_FOUND');
  return {brief};
}

export async function dispatchPlanningApi(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'factInbox.list':return listFactInbox(env,principal,payload,fetchImpl);
    case 'factInbox.create':return createFactInboxItem(env,principal,payload,fetchImpl);
    case 'factInbox.transition':return transitionFactInboxItem(env,principal,payload,fetchImpl);
    case 'executiveBrief.current':return getPublishedExecutiveBrief(env,principal,fetchImpl);
    default:throw Error('PLANNING_ACTION_NOT_IMPLEMENTED');
  }
}
