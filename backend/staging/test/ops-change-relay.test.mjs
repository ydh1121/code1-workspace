import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS_EVENT_CLASSES,opsEvents,opsRequestPlanningReview,opsDeleteEmptyFarm,opsArchiveAccount} from '../src/ops-change-relay.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:3,archived_at:null};
const principal={accountId:'OWNER',version:3};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function route(fn){return async(url,init={})=>response(await fn(new URL(url),init));}

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
    if(u.pathname==='/rest/v1/rpc/code1_ops_request_planning_review'){
      body=JSON.parse(init.body);return [{event_id:'OCE_CHILD',source_system:'TEMP_ADMIN',source_version:'OPS_RELAY_v0.1',entity_type:'FARM',entity_id:'GF-1',action:'planning.review.request',changed_fields:['deleted'],actor_ref:'OWNER',event_class:'PLANNING_IMPACT',planning_relevance:true,suggested_tracks:['PLANNING'],evidence_refs:[],correlation_id:'OCE_PARENT',causation_id:'OCE_PARENT',priority:'P0',occurred_at:'2026-09-12T00:00:00Z',recorded_at:'2026-09-12T00:00:00Z',relay_status:'RECORDED',relay_status_updated_at:'2026-09-12T00:00:00Z'}];
    }
    throw Error('unexpected '+u.pathname);
  });
  const out=await opsRequestPlanningReview(env,principal,{eventId:'OCE_PARENT',requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(out.eventClass,'PLANNING_IMPACT');
  assert.equal(out.causationId,'OCE_PARENT');
  assert.equal(body.p_source_event_id,'OCE_PARENT');
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
