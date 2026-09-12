import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS_EVENT_CLASSES,OWNER_QA_FIXTURE,opsEvents,opsRequestPlanningReview,opsCreateOwnerQaFixture,opsCleanupOwnerQaFixture,opsDeleteEmptyFarm,opsArchiveAccount} from '../src/ops-change-relay.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const stagingEnv={...env,CODE1_RUNTIME_BACKEND:'SUPABASE_STAGING'};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:3,archived_at:null};
const principal={accountId:'OWNER',version:3};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function route(fn){return async(url,init={})=>response(await fn(new URL(url),init));}
const qaRoot={event_id:'OCE_QA_ROOT',source_system:'TEMP_ADMIN',source_version:'OPS_RELAY_v0.1',entity_type:OWNER_QA_FIXTURE.entityType,entity_id:OWNER_QA_FIXTURE.entityId,action:OWNER_QA_FIXTURE.action,changed_fields:['qa.fixture'],actor_ref:'OWNER',event_class:'OPS_DATA_ONLY',planning_relevance:false,suggested_tracks:[],evidence_refs:[{kind:'QA_FIXTURE',ref:OWNER_QA_FIXTURE.workOrderId}],correlation_id:'OCE_QA_ROOT',causation_id:null,priority:'P1',occurred_at:'2026-09-12T00:00:00Z',recorded_at:'2026-09-12T00:00:00Z',relay_status:'NO_PLANNING_ACTION',relay_status_updated_at:'2026-09-12T00:00:00Z'};

test('canonical six event classes stay explicit',()=>{
  assert.deepEqual(OPS_EVENT_CLASSES,['OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT']);
});

test('event history is OWNER-only server read and reports disconnected relay honestly',async()=>{
  const fetchImpl=route((u)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/ops_change_events')return [{event_id:'OCE_1',source_system:'TEMP_ADMIN',source_version:'OPS_RELAY_v0.1',entity_type:'FARM',entity_id:'GF-1',action:'admin.farm.delete',changed_fields:['deleted'],actor_ref:'OWNER',event_class:'OPS_DATA_ONLY',planning_relevance:false,suggested_tracks:[],evidence_refs:[],correlation_id:'OCE_1',priority:'P1',occurred_at:'2026-09-12T00:00:00Z',recorded_at:'2026-09-12T00:00:00Z',relay_status:'NO_PLANNING_ACTION',relay_status_updated_at:'2026-09-12T00:00:00Z'}];
    if(u.pathname==='/rest/v1/ops_outbox')return [{outbox_id:'OOB_1',event_id:'OCE_1',delivery_state:'NO_ACTION',attempt_count:0,available_at:'2026-09-12T00:00:00Z'}];
    throw Error('unexpected '+u.pathname);
  });
  const out=await opsEvents(env,principal,{},fetchImpl);
  assert.equal(out.events[0].eventClass,'OPS_DATA_ONLY');
  assert.equal(out.events[0].outbox.state,'NO_ACTION');
  assert.equal(out.relay.connected,false);
  assert.equal(out.relay.state,'PENDING_RELAY');
});

test('planning-review request creates a causally-linked Planning event through database RPC',async()=>{
  let body;
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/ops_change_events')return [{event_id:'OCE_PARENT',entity_type:'FARM',entity_id:'GF-1',action:'admin.farm.delete',actor_ref:'OWNER'}];
    if(u.pathname==='/rest/v1/rpc/code1_ops_request_planning_review'){
      body=JSON.parse(init.body);return [{event_id:'OCE_CHILD',source_system:'TEMP_ADMIN',source_version:'OPS_RELAY_v0.1',entity_type:'FARM',entity_id:'GF-1',action:'planning.review.request',changed_fields:['deleted'],actor_ref:'OWNER',event_class:'PLANNING_IMPACT',planning_relevance:true,suggested_tracks:['PLANNING'],evidence_refs:[],correlation_id:'OCE_PARENT',causation_id:'OCE_PARENT',priority:'P0',occurred_at:'2026-09-12T00:00:00Z',recorded_at:'2026-09-12T00:00:00Z',relay_status:'RECORDED',relay_status_updated_at:'2026-09-12T00:00:00Z'}];
    }
    throw Error('unexpected '+u.pathname);
  });
  const out=await opsRequestPlanningReview(env,principal,{eventId:'OCE_PARENT',requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(out.eventClass,'PLANNING_IMPACT');
  assert.equal(out.causationId,'OCE_PARENT');
  assert.equal(body.p_source_event_id,'OCE_PARENT');
  assert.equal(body.p_request_id,'a'.repeat(32));
});

test('OWNER QA fixture create is fixed-template, STAGING-only and no-business-mutation',async()=>{
  let body;
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/rpc/code1_ops_record_manual_event'){body=JSON.parse(init.body);return [qaRoot];}
    throw Error('unexpected '+u.pathname);
  });
  const out=await opsCreateOwnerQaFixture(stagingEnv,principal,{},fetchImpl);
  assert.equal(out.workOrderId,OWNER_QA_FIXTURE.workOrderId);
  assert.equal(out.mutationApplied,false);
  assert.equal(out.event.id,'OCE_QA_ROOT');
  assert.equal(body.p_entity_type,'OWNER_QA_FIXTURE');
  assert.equal(body.p_entity_id,OWNER_QA_FIXTURE.workOrderId);
  assert.equal(body.p_action,OWNER_QA_FIXTURE.action);
  assert.equal(body.p_event_class,'OPS_DATA_ONLY');
  assert.deepEqual(body.p_suggested_tracks,[]);
  assert.equal(body.p_request_id,OWNER_QA_FIXTURE.createRequestId);
  assert.deepEqual(body.p_changed_fields,['qa.fixture']);
  assert.equal(body.p_evidence_refs[0].ref,OWNER_QA_FIXTURE.workOrderId);
  assert.equal(body.p_evidence_refs[0].label,'OWNER_QA_CLOSURE');
  await assert.rejects(()=>opsCreateOwnerQaFixture(stagingEnv,principal,{eventClass:'INCIDENT'},fetchImpl),/OWNER_QA_FIXED_TEMPLATE_ONLY/);
  await assert.rejects(()=>opsCreateOwnerQaFixture({...stagingEnv,CODE1_RUNTIME_BACKEND:'APPS_SCRIPT'},principal,{},fetchImpl),/OWNER_QA_STAGING_ONLY/);
});

test('OWNER QA fixture create keeps OWNER authorization at the existing server boundary',async()=>{
  const nonOwner={...owner,account_id:'STAFF',role:'EDITOR'};
  const fetchImpl=route((u)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [nonOwner];
    throw Error('unexpected '+u.pathname);
  });
  await assert.rejects(()=>opsCreateOwnerQaFixture(stagingEnv,{accountId:'STAFF',version:3},{},fetchImpl),/FORBIDDEN/);
});

test('OWNER QA planning-review child is deterministically idempotent and PLANNING_IMPACT only',async()=>{
  let body;
  const child={...qaRoot,event_id:'OCE_QA_CHILD',action:'planning.review.request',event_class:'PLANNING_IMPACT',planning_relevance:true,suggested_tracks:['PLANNING'],correlation_id:'OCE_QA_ROOT',causation_id:'OCE_QA_ROOT',relay_status:'RECORDED',priority:'P0'};
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/ops_change_events')return [qaRoot];
    if(u.pathname==='/rest/v1/rpc/code1_ops_request_planning_review'){body=JSON.parse(init.body);return [child];}
    throw Error('unexpected '+u.pathname);
  });
  const out=await opsRequestPlanningReview(stagingEnv,principal,{eventId:qaRoot.event_id,requestId:'d'.repeat(32)},fetchImpl);
  assert.equal(body.p_request_id,OWNER_QA_FIXTURE.reviewRequestId);
  assert.equal(out.eventClass,'PLANNING_IMPACT');
  assert.equal(out.causationId,qaRoot.event_id);
  assert.deepEqual(out.suggestedTracks,['PLANNING']);
});

test('OWNER QA cleanup deletes only the verified synthetic root and its causal review lineage',async()=>{
  let cleaned=false,deletedQuery='';
  const child={...qaRoot,event_id:'OCE_QA_CHILD',action:'planning.review.request',event_class:'PLANNING_IMPACT',correlation_id:qaRoot.event_id,causation_id:qaRoot.event_id};
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/ops_change_events'&&init.method==='DELETE'){cleaned=true;deletedQuery=u.search;return [qaRoot,child];}
    if(u.pathname==='/rest/v1/ops_change_events')return cleaned?[]:[qaRoot,child];
    throw Error('unexpected '+u.pathname+' '+(init.method||'GET'));
  });
  const out=await opsCleanupOwnerQaFixture(stagingEnv,principal,{},fetchImpl);
  assert.equal(out.deletedEvents,2);assert.equal(out.remaining,0);
  assert.match(deletedQuery,/OWNER_QA_FIXTURE/);assert.match(deletedQuery,/WO-20260912-CODING-OPS-QA-001/);assert.match(deletedQuery,/actor_ref=eq\.OWNER/);
});

test('OWNER QA cleanup fails closed on unexpected event inside the reserved synthetic namespace',async()=>{
  const conflict={...qaRoot,event_id:'OCE_CONFLICT',action:'unexpected.action'};
  let deleteCalled=false;
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    if(u.pathname==='/rest/v1/ops_change_events'&&init.method==='DELETE'){deleteCalled=true;return [];}
    if(u.pathname==='/rest/v1/ops_change_events')return [qaRoot,conflict];
    throw Error('unexpected '+u.pathname);
  });
  await assert.rejects(()=>opsCleanupOwnerQaFixture(stagingEnv,principal,{},fetchImpl),/OWNER_QA_FIXTURE_NAMESPACE_CONFLICT/);
  assert.equal(deleteCalled,false);
});

test('existing destructive admin actions are transparently routed through OPS transactional wrappers',async()=>{
  const calls=[];
  const fetchImpl=route((u,init)=>{
    if(u.pathname==='/rest/v1/workspace_accounts')return [owner];
    calls.push(u.pathname);
    if(u.pathname==='/rest/v1/rpc/code1_ops_delete_empty_farm')return {entity:{farm_id:'GF-X',deleted:true},event:{event_id:'OCE-X'}};
    if(u.pathname==='/rest/v1/rpc/code1_ops_archive_account')return {entity:{id:'U-X',status:'disabled',version:2},event:{event_id:'OCE-Y'}};
    throw Error('unexpected '+u.pathname);
  });
  const farm=await opsDeleteEmptyFarm(env,principal,{id:'GF-X',requestId:'b'.repeat(32)},fetchImpl);
  const account=await opsArchiveAccount(env,principal,{id:'U-X',requestId:'c'.repeat(32)},fetchImpl);
  assert.equal(farm.deleted,true);
  assert.equal(account.status,'disabled');
  assert.deepEqual(calls,['/rest/v1/rpc/code1_ops_delete_empty_farm','/rest/v1/rpc/code1_ops_archive_account']);
});
