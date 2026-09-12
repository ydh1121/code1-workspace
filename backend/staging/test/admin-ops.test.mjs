import test from 'node:test';
import assert from 'node:assert/strict';
import {adminOverview,deleteEmptyFarm,archiveAccount} from '../src/admin-ops.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const principal={accountId:'OWNER',version:3};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:3,archived_at:null};
const admin={account_id:'U_ADMIN',username:'admin1',display_name:'Admin',role:'ADMIN',status:'active',permissions_json:{},session_version:1,archived_at:null};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function routeMap(map){return async(url,init={})=>{const u=new URL(url),method=init.method||'GET',key=`${method} ${u.pathname}`;if(!(key in map))throw Error(`unexpected ${key}`);const value=typeof map[key]==='function'?map[key](u,init):map[key];return response(value);};}

test('OWNER overview computes empty farm eligibility',async()=>{
  const fetchImpl=routeMap({
    'GET /rest/v1/workspace_accounts':u=>u.searchParams.get('account_id')?[owner]:[owner,admin],
    'GET /rest/v1/farms':[{farm_id:'GF-1',internal_name:'Farm 1',public_name:null,onboarding_status:'자료요청',origin_cohort:true},{farm_id:'GF-2',internal_name:'Farm 2',public_name:null,onboarding_status:'자료요청',origin_cohort:true}],
    'GET /rest/v1/intake_submissions':[{submission_id:'SUB-1',farm_id:'GF-2',status:'DRAFT'}],
    'GET /rest/v1/media_assets':[],
    'GET /rest/v1/fact_inbox':[]
  });
  const out=await adminOverview(env,principal,fetchImpl);
  assert.equal(out.snapshot.farmCount,2);
  assert.equal(out.farms.find(f=>f.id==='GF-1').canDelete,true);
  assert.equal(out.farms.find(f=>f.id==='GF-2').canDelete,false);
});

test('farm removal delegates to guarded database function',async()=>{
  let rpc;
  const fetchImpl=routeMap({
    'GET /rest/v1/workspace_accounts':[owner],
    'POST /rest/v1/rpc/code1_delete_empty_farm':(u,init)=>{rpc=JSON.parse(init.body);return [{farm_id:'GF-EMPTY',deleted:true}];}
  });
  const out=await deleteEmptyFarm(env,principal,{id:'GF-EMPTY',reason:'cleanup',requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(out.deleted,true);
  assert.equal(rpc.p_actor_id,'OWNER');
  assert.equal(rpc.p_farm_id,'GF-EMPTY');
});

test('account removal delegates to archive function',async()=>{
  let rpc;
  const fetchImpl=routeMap({
    'GET /rest/v1/workspace_accounts':[owner],
    'POST /rest/v1/rpc/code1_archive_account':(u,init)=>{rpc=JSON.parse(init.body);return [{...admin,status:'disabled',archived_at:'2026-09-12T00:00:00Z',session_version:2}];}
  });
  const out=await archiveAccount(env,principal,{id:'U_ADMIN',reason:'removed',requestId:'b'.repeat(32)},fetchImpl);
  assert.equal(out.status,'disabled');
  assert.equal(out.archivedAt,'2026-09-12T00:00:00Z');
  assert.equal(rpc.p_account_id,'U_ADMIN');
});
