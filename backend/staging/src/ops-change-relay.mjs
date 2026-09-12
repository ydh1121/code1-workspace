import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';

const esc=encodeURIComponent;
const requestId=value=>/^[a-f0-9]{32}$/.test(String(value||''));
const validId=value=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(value||''));
export const OPS_EVENT_CLASSES=Object.freeze(['OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT']);

async function ownerActor(db,principal){
  const actor=await loadActor(db,principal);
  if(actor.row.account_id!=='OWNER'||actor.row.role!=='SUPER_ADMIN')throw Error('FORBIDDEN');
  return actor;
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

export async function opsRequestPlanningReview(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.eventId||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_request_planning_review',{p_actor_id:actor.row.account_id,p_source_event_id:id,p_request_id:rid});
  const row=Array.isArray(rows)?rows[0]:rows;
  if(!row)throw Error('OPS_EVENT_NOT_CREATED');
  return eventView(row,null);
}

export async function opsSaveAdminAccessProfile(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  const capabilities=[...new Set((payload.capabilities||[]).map(String))];
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_set_account_capabilities',{p_actor_id:actor.row.account_id,p_account_id:id,p_capabilities:capabilities,p_request_id:rid});
  const wrapped=Array.isArray(rows)?rows[0]:rows;
  const result=wrapped?.entity||wrapped?.result?.entity||wrapped;
  const row=(await db.select('workspace_accounts',`account_id=eq.${esc(id)}&archived_at=is.null&select=*`))?.[0];
  if(!row)throw Error('NOT_FOUND');
  return {...accountLabel(row),access:{capabilities:result?.capabilities||capabilities}};
}

export async function opsDeleteEmptyFarm(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_delete_empty_farm',{p_actor_id:actor.row.account_id,p_farm_id:id,p_reason:String(payload.reason||'최고 관리자 삭제').slice(0,500),p_request_id:rid});
  const wrapped=Array.isArray(rows)?rows[0]:rows;
  return wrapped?.entity||wrapped||{farm_id:id,deleted:true};
}

export async function opsArchiveAccount(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await ownerActor(db,principal);
  const id=String(payload.id||''),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_REQUEST');
  const rows=await db.rpc('code1_ops_archive_account',{p_actor_id:actor.row.account_id,p_account_id:id,p_reason:String(payload.reason||'최고 관리자 삭제').slice(0,500),p_request_id:rid});
  const wrapped=Array.isArray(rows)?rows[0]:rows;
  return wrapped?.entity||wrapped;
}

export async function dispatchOpsChangeRelay(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'admin.ops.events':return opsEvents(env,principal,payload,fetchImpl);
    case 'admin.ops.review':return opsRequestPlanningReview(env,principal,payload,fetchImpl);
    case 'admin.access.save':return opsSaveAdminAccessProfile(env,principal,payload,fetchImpl);
    case 'admin.farm.delete':return opsDeleteEmptyFarm(env,principal,payload,fetchImpl);
    case 'admin.account.delete':return opsArchiveAccount(env,principal,payload,fetchImpl);
    default:throw Error('OPS_RELAY_ACTION_NOT_IMPLEMENTED');
  }
}

export function isOpsChangeRelayAction(action){
  return ['admin.ops.events','admin.ops.review','admin.access.save','admin.farm.delete','admin.account.delete'].includes(action);
}
