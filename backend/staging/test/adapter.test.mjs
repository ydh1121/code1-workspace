import test from 'node:test';
import assert from 'node:assert/strict';
import {getSubmission,saveSubmission} from '../src/rpc-adapter.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const principal={accountId:'OWNER',version:2};

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
function mockFetch(routes){return async (url,init={})=>{
  const u=new URL(url),key=`${init.method||'GET'} ${u.pathname}`;
  const handler=routes[key];
  if(!handler)throw new Error(`unexpected ${key} ${u.search}`);
  return typeof handler==='function'?handler(u,init):response(handler);
};}
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',email:'',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:2};

test('getSubmission keeps explicit empty current value and omits deleted media',async()=>{
  const fetchImpl=mockFetch({
    'GET /rest/v1/workspace_accounts':[owner],
    'GET /rest/v1/intake_submissions':[{submission_id:'SUB-1',farm_id:'GF-1',farm_name_snapshot:'농가1',status:'DRAFT',current_revision:2}],
    'GET /rest/v1/submission_answers_current':[{item_key:'A-01',value_jsonb:'농가1'},{item_key:'C-02',value_jsonb:''}],
    'GET /rest/v1/media_assets':[]
  });
  const result=await getSubmission(env,principal,{id:'SUB-1'},fetchImpl);
  assert.equal(result.revision,2);
  assert.equal(result.answers['C-02'],'');
  assert.deepEqual(result.media,[]);
});

test('saveSubmission preserves existing RPC envelope and optimistic revision',async()=>{
  let body;
  const fetchImpl=mockFetch({
    'GET /rest/v1/workspace_accounts':[owner],
    'POST /rest/v1/rpc/code1_save_submission':(_u,init)=>{body=JSON.parse(init.body);return response([{submission_id:'SUB-1',revision:3,status:'DRAFT'}]);}
  });
  const requestId='a'.repeat(32);
  const result=await saveSubmission(env,principal,{id:'SUB-1',farmId:'GF-1',name:'농가1',status:'DRAFT',baseRevision:2,requestId,answers:{'A-01':'농가1','C-02':''}},fetchImpl);
  assert.equal(result.revision,3);
  assert.equal(body.p_base_revision,2);
  assert.equal(body.p_answers['C-02'],'');
  assert.equal(body.p_request_id,requestId);
});
