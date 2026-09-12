import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {cleanString} from './core.mjs';
import {useSupabaseStaging} from './runtime-mode.mjs';
import {ACCESS_CAPABILITIES,resolveWorkspaceAccess,publicAccess} from './workspace-access.mjs';

const esc=encodeURIComponent;
const requestId=value=>/^[a-f0-9]{32}$/.test(String(value||''));
const validId=value=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(value||''));
export const OPS_EVENT_CLASSES=Object.freeze(['OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT']);
export const OWNER_QA_FIXTURE=Object.freeze({
  workOrderId:'WO-20260912-CODING-OPS-QA-001',
  entityType:'OWNER_QA_FIXTURE',
  entityId:'WO-20260912-CODING-OPS-QA-001',
  action:'owner.qa.fixture.prepare',
  createRequestId:'7a1d38f6c4e2b095a8d1f3c6e9b24a70',
  reviewRequestId:'9c5b12e8d7a340f6b1e29c4d8a7650ef'
});

async function ownerActor(db,principal){
  const actor=await loadActor(db,principal);
  if(actor.row.account_id!=='OWNER'||actor.row.role!=='SUPER_ADMIN')throw Error('FORBIDDEN');
  return actor;
}

function assertOwnerQaStaging(env){
  if(!useSupabaseStaging(env))throw Error('OWNER_QA_STAGING_ONLY');
}
function assertOpsRetentionStaging(env){
  if(!useSupabaseStaging(env))throw Error('OPS_RETENTION_STAGING_ONLY');
}
function assertFixedQaPayload(payload){
  if(payload&&typeof payload==='object'&&Object.keys(payload).length===0)return;
  throw Error('OWNER_QA_FIXED_TEMPLATE_ONLY');
}
function assertEmptyReportPayload(payload){
  if(payload&&typeof payload==='object'&&Object.keys(payload).length===0)return;
  throw Error('OPS_RETENTION_REPORT_FIXED_PAYLOAD_ONLY');
}
function configuredOpsDbLimitBytes(env){
  const raw=String(env?.OPS_DB_CONFIGURED_LIMIT_BYTES??'').trim();
  if(!raw)return null;
  if(!/^[1-9][0-9]{0,15}$/.test(raw))throw Error('OPS_DB_LIMIT_INVALID');
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<=0)throw Error('OPS_DB_LIMIT_INVALID');
  return value;
}
function isOwnerQaRoot(row){
  return !!row&&row.entity_type===OWNER_QA_FIXTURE.entityType&&row.entity_id===OWNER_QA_FIXTURE.entityId&&row.action===OWNER_QA_FIXTURE.action&&row.actor_ref==='OWNER';
}

const accountLabel=row=>({id:row.account_id,username:row.username,displayName:row.display_name,role:row.role,status:row.status,archivedAt:row.archived_at||null,version:Number(row.session_version||0)});
const eventView=(row,outbox)=>({
  id:row.event_id,sourceSystem:row.source_system,sourceVersion:row.source_version,entityType:row.entity_type,entityId:row.entity_id,
  action:row.action,changedFields:row.changed_fields||[],beforeHash:row.before_hash||null,afterHash:row.after_hash||null,actorRef:row.actor_ref,
  eventClass:row.event_class,planningRelevance:!!row.planning_relevance,suggestedTracks:row.suggested_tracks||[],evidenceRefs:row.evidence_refs||[],
  correlationId:row.correlation_id,causationId:row.causation_id||null,priority:row.priority,occurredAt:row.occurred_at,recordedAt:row.recorded_at,
  relayStatus:row.relay_status,relayStatusUpdatedAt:row.relay_status_updated_at,
  outbox:outbox?{id:outbox.outbox_id,state:outbox.delivery_state,attemptCount:Number(outbox.attempt_count||0),availableAt:outbox.available_at,
    claimedAt:outbox.claimed_at||null,deliveredAt:outbox.delivered_at||null,consumerVersion:outbox.consumer_version||null,lastErrorCode:outbox.last_error_code||null}:null
});

export async function opsEvents(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl);await ownerActor(db,principal);
  const limit=Math.max(20,Math.min(500,Number(payload.limit)||250));
  const rows=await db.select('ops_change_events',`order=recorded_at.desc&limit=${limit}&select=event_id,source_system,source_version,entity_type,entity_id,action,changed_fields,before_hash,after_hash,actor_ref,event_class,planning_relevance,suggested_tracks,evidence_refs,correlation_id,causation_id,priority,occurred_at,recorded_at,relay_status,relay_status_updated_at`);
  const ids=(rows||[]).map(x=>x.event_id);
  const boxes=ids.length?await db.select('ops_outbox',`${db.inList('event_id',ids)}&select=outbox_id,event_id,delivery_state,attempt_count,available_at,claimed_at,delivered_at,consumer_version,last_error_code`):[];
  const byEvent=new Map((boxes||[]).map(x=>[x.event_id,x]));
  return {events:(rows||[]).map(x=>eventView(x,byEvent.get(x.event_id))),relay:{connected:false,state:'PENDING_RELAY',note:'Orchestrator STAGING credentials are not provisioned; status remains source-of-truth only.'}};
}

export async function opsCapacityReport(env,principal,payload={},fetchImpl=fetch){
  assertOpsRetentionStaging(env);assertEmptyReportPayload(payload);
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const rows=await db.rpc('code1_ops_capacity_report',{
    p_actor_id:actor.row.account_id,
    p_configured_limit_bytes:configuredOpsDbLimitBytes(env)
  });
  const report=Array.isArray(rows)?rows[0]:rows;
  if(!report||report.mode!=='REPORT_ONLY'||report.autoPurge!==false)throw Error('OPS_CAPACITY_REPORT_INVALID');
  return report;
}

export async function opsRetentionDryRun(env,principal,payload={},fetchImpl=fetch){
  assertOpsRetentionStaging(env);assertEmptyReportPayload(payload);
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const rows=await db.rpc('code1_ops_retention_dry_run',{p_actor_id:actor.row.account_id});
  const report=Array.isArray(rows)?rows[0]:rows;
  if(!report||report.mode!=='DRY_RUN'||report.executionMode!=='REPORT_ONLY'||report.autoPurge!==false||report.mutationApplied!==false)throw Error('OPS_RETENTION_DRY_RUN_INVALID');
  return report;
}

export async function opsCreateOwnerQaFixture(env,principal,payload={},fetchImpl=fetch){
  assertOwnerQaStaging(env);assertFixedQaPayload(payload);
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const evidence=[{kind:'QA_FIXTURE',ref:OWNER_QA_FIXTURE.workOrderId,label:'OWNER_QA_CLOSURE',version:'v1',source:'CODING'}];
  const rows=await db.rpc('code1_ops_record_manual_event',{
    p_actor_id:actor.row.account_id,
    p_entity_type:OWNER_QA_FIXTURE.entityType,
    p_entity_id:OWNER_QA_FIXTURE.entityId,
    p_action:OWNER_QA_FIXTURE.action,
    p_event_class:'OPS_DATA_ONLY',
    p_changed_fields:['qa.fixture'],
    p_suggested_tracks:[],
    p_evidence_refs:evidence,
    p_correlation_id:null,
    p_causation_id:null,
    p_request_id:OWNER_QA_FIXTURE.createRequestId
  });
  const row=Array.isArray(rows)?rows[0]:rows;
  if(!row||!isOwnerQaRoot(row))throw Error('OWNER_QA_FIXTURE_NOT_CREATED');
  return {workOrderId:OWNER_QA_FIXTURE.workOrderId,mutationApplied:false,event:eventView(row,null)};
}

export async function opsCleanupOwnerQaFixture(env,principal,payload={},fetchImpl=fetch){
  assertOwnerQaStaging(env);assertFixedQaPayload(payload);
  const db=createDb(env,fetchImpl);await ownerActor(db,principal);
  const query=`entity_type=eq.${esc(OWNER_QA_FIXTURE.entityType)}&entity_id=eq.${esc(OWNER_QA_FIXTURE.entityId)}&actor_ref=eq.OWNER&source_system=eq.TEMP_ADMIN&select=event_id,source_system,entity_type,entity_id,action,actor_ref,correlation_id,causation_id,event_class`;
  const rows=await db.select('ops_change_events',query);
  if(!rows?.length)return {workOrderId:OWNER_QA_FIXTURE.workOrderId,deletedEvents:0,remaining:0};
  const roots=rows.filter(isOwnerQaRoot);
  if(roots.length!==1)throw Error('OWNER_QA_FIXTURE_NAMESPACE_CONFLICT');
  const root=roots[0];
  const lineage=rows.filter(row=>isOwnerQaRoot(row)||(row.action==='planning.review.request'&&row.event_class==='PLANNING_IMPACT'&&row.causation_id===root.event_id&&row.correlation_id===root.correlation_id));
  if(lineage.length!==rows.length)throw Error('OWNER_QA_FIXTURE_NAMESPACE_CONFLICT');
  const ids=lineage.map(row=>row.event_id);
  await db.delete('ops_change_events',`${db.inList('event_id',ids)}&entity_type=eq.${esc(OWNER_QA_FIXTURE.entityType)}&entity_id=eq.${esc(OWNER_QA_FIXTURE.entityId)}&actor_ref=eq.OWNER&source_system=eq.TEMP_ADMIN`);
  const remaining=await db.select('ops_change_events',query);
  if(remaining?.length)throw Error('OWNER_QA_FIXTURE_CLEANUP_INCOMPLETE');
  return {workOrderId:OWNER_QA_FIXTURE.workOrderId,deletedEvents:ids.length,remaining:0};
}

export async function opsRequestPlanningReview(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.eventId||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const source=(await db.select('ops_change_events',`event_id=eq.${esc(id)}&select=event_id,entity_type,entity_id,action,actor_ref`))?.[0];
  const effectiveRid=isOwnerQaRoot(source)?OWNER_QA_FIXTURE.reviewRequestId:rid;
  const rows=await db.rpc('code1_ops_request_planning_review',{p_actor_id:actor.row.account_id,p_source_event_id:id,p_request_id:effectiveRid});
  const row=Array.isArray(rows)?rows[0]:rows;
  if(!row)throw Error('OPS_EVENT_NOT_CREATED');
  return eventView(row,null);
}

export async function opsSaveAdminAccessProfile(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  const capabilities=[...new Set((payload.capabilities||[]).map(String))];
  if(!validId(id)||!requestId(rid)||capabilities.some(x=>!ACCESS_CAPABILITIES.includes(x)))throw Error('INVALID_REQUEST');
  await db.rpc('code1_ops_set_account_capabilities',{p_actor_id:actor.row.account_id,p_account_id:id,p_capabilities:capabilities,p_request_id:rid});
  const row=(await db.select('workspace_accounts',`account_id=eq.${esc(id)}&archived_at=is.null&select=*`))?.[0];
  if(!row)throw Error('NOT_FOUND');
  const profile=await resolveWorkspaceAccess(db,{row});
  return {...accountLabel(row),access:publicAccess(profile)};
}

export async function opsDeleteEmptyFarm(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_delete_empty_farm',{p_actor_id:actor.row.account_id,p_farm_id:id,p_reason:cleanString(payload.reason||'최고 관리자 삭제',500),p_request_id:rid});
  const wrapped=Array.isArray(rows)?rows[0]:rows;
  return wrapped?.entity||wrapped||{farm_id:id,deleted:true};
}

export async function opsArchiveAccount(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_archive_account',{p_actor_id:actor.row.account_id,p_account_id:id,p_reason:cleanString(payload.reason||'최고 관리자 삭제',500),p_request_id:rid});
  const wrapped=Array.isArray(rows)?rows[0]:rows;
  return wrapped?.entity||wrapped;
}

export async function dispatchOpsChangeRelay(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'admin.ops.events':return opsEvents(env,principal,payload,fetchImpl);
    case 'admin.ops.review':return opsRequestPlanningReview(env,principal,payload,fetchImpl);
    case 'admin.ops.capacity.report':return opsCapacityReport(env,principal,payload,fetchImpl);
    case 'admin.ops.retention.dryRun':return opsRetentionDryRun(env,principal,payload,fetchImpl);
    case 'admin.ops.qa.fixture.create':return opsCreateOwnerQaFixture(env,principal,payload,fetchImpl);
    case 'admin.ops.qa.fixture.cleanup':return opsCleanupOwnerQaFixture(env,principal,payload,fetchImpl);
    case 'admin.access.save':return opsSaveAdminAccessProfile(env,principal,payload,fetchImpl);
    case 'admin.farm.delete':return opsDeleteEmptyFarm(env,principal,payload,fetchImpl);
    case 'admin.account.delete':return opsArchiveAccount(env,principal,payload,fetchImpl);
    default:throw Error('OPS_RELAY_ACTION_NOT_IMPLEMENTED');
  }
}

export function isOpsChangeRelayAction(action){
  return ['admin.ops.events','admin.ops.review','admin.ops.capacity.report','admin.ops.retention.dryRun','admin.ops.qa.fixture.create','admin.ops.qa.fixture.cleanup','admin.access.save','admin.farm.delete','admin.account.delete'].includes(action);
}
