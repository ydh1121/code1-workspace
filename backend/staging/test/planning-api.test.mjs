import test from 'node:test';
import assert from 'node:assert/strict';
import {getPublishedExecutiveBrief,createFactInboxItem,transitionFactInboxItem} from '../src/planning-api.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const principal={accountId:'OWNER',version:2};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:2};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function mockFetch(handler){return async(url,init={})=>handler(new URL(url),init);}

test('legacy SUPER_ADMIN role does not silently gain new planning capabilities',async()=>{
  const fetchImpl=mockFetch((u)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/account_capabilities'))return response([]);
    throw Error(`unexpected ${u.pathname}`);
  });
  await assert.rejects(()=>getPublishedExecutiveBrief(env,principal,fetchImpl),/FORBIDDEN/);
});

test('Executive Brief API reads only PUBLISHED snapshot and omits source document IDs',async()=>{
  const fetchImpl=mockFetch((u)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/account_capabilities'))return response([{capability:'EXECUTIVE_BRIEF_VIEW'}]);
    if(u.pathname.endsWith('/planning_brief_versions')){
      assert.equal(u.searchParams.get('status'),'eq.PUBLISHED');
      assert.ok(!String(u.searchParams.get('select')).includes('source_doc_ids'));
      return response([{brief_key:'EXECUTIVE_CURRENT',brief_version:'v1',status:'PUBLISHED',content_json:{summary:'approved'},sections:[],confidentiality:'INTERNAL',published_at:'2026-09-10T00:00:00Z',published_by:'OWNER'}]);
    }
    throw Error(`unexpected ${u.pathname}`);
  });
  const result=await getPublishedExecutiveBrief(env,principal,fetchImpl);
  assert.equal(result.brief.status,'PUBLISHED');
  assert.equal(result.brief.content_json.summary,'approved');
});

test('Fact Inbox creation is internal, starts RECEIVED, and cannot mark public disclosure',async()=>{
  let insertedFact;
  const fetchImpl=mockFetch((u,init)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/account_capabilities'))return response([{capability:'FACT_SUBMIT'}]);
    if(u.pathname.endsWith('/fact_inbox')&&init.method==='POST'){insertedFact=JSON.parse(init.body);return response([insertedFact]);}
    if(u.pathname.endsWith('/fact_events')&&init.method==='POST')return response([]);
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await createFactInboxItem(env,principal,{domain:'SUPPLY',subjectType:'FARM',subjectId:'GF-1',statement:'사용자 보고 값',sourceType:'USER_REPORT',externalDisclosureAllowed:true,requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(result.status,'RECEIVED');
  assert.equal(insertedFact.external_disclosure_allowed,false);
});

test('Fact Inbox DOCUMENT_RECEIVED requires evidence before verification path can continue',async()=>{
  const fetchImpl=mockFetch((u)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/fact_inbox'))return response([{fact_id:'FACT_1',status:'EVIDENCE_REQUESTED',evidence_ref:null}]);
    throw Error(`unexpected ${u.pathname}`);
  });
  await assert.rejects(()=>transitionFactInboxItem(env,principal,{id:'FACT_1',status:'DOCUMENT_RECEIVED',requestId:'b'.repeat(32)},fetchImpl),/EVIDENCE_REQUIRED/);
});

test('Fact Inbox transition forwards evidence through the hardened RPC envelope',async()=>{
  let rpcBody;
  const evidence={artifactId:'GF-CONFIDENTIAL',kind:'DRIVE_DOCUMENT'};
  const fetchImpl=mockFetch((u,init)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/fact_inbox'))return response([{fact_id:'FACT_1',status:'EVIDENCE_REQUESTED',evidence_ref:null}]);
    if(u.pathname.endsWith('/account_capabilities'))return response([{capability:'FACT_VERIFY'}]);
    if(u.pathname.endsWith('/rpc/code1_transition_fact')){rpcBody=JSON.parse(init.body);return response([{fact_id:'FACT_1',status:'DOCUMENT_RECEIVED'}]);}
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await transitionFactInboxItem(env,principal,{id:'FACT_1',status:'DOCUMENT_RECEIVED',evidenceRef:evidence,requestId:'c'.repeat(32)},fetchImpl);
  assert.equal(result.status,'DOCUMENT_RECEIVED');
  assert.deepEqual(rpcBody.p_evidence_ref,evidence);
});
