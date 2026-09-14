import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {Window} from 'happy-dom';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const seed=fs.readFileSync(resolve(root,'backend/staging/schema/0026_planning_material_draft_seed_request_delete.sql'),'utf8');
const guard=fs.readFileSync(resolve(root,'backend/staging/schema/0028_planning_material_archive_assignment_guard.sql'),'utf8');
const runtime=fs.readFileSync(resolve(root,'backend/staging/src/planning-material-request-delete-runtime.mjs'),'utf8');
const dispatch=fs.readFileSync(resolve(root,'backend/staging/src/staging-dispatch.mjs'),'utf8');
const edge=fs.readFileSync(resolve(root,'functions/api/rpc.js'),'utf8');
const helper=fs.readFileSync(resolve(root,'public/assets/planning-material-request-actions.js'),'utf8');
const index=fs.readFileSync(resolve(root,'public/index.html'),'utf8');

test('Great Farm seed is revision-2 DRAFT only and never publishes',()=>{
  assert.match(seed,/DRAFT revision 2 only/i);
  assert.match(seed,/current_revision,published_revision/);
  assert.match(seed,/v_current<>1 or v_published<>1/);
  assert.match(seed,/DRAFT_MUST_NOT_PUBLISH/);
  assert.doesNotMatch(seed,/code1_material_publish_template\s*\(/);
  assert.match(seed,/revision=2 and revision_state='DRAFT' and published_at is null/);
  assert.match(seed,/template_revision=2/);
  assert.match(seed,/DRAFT_EXPOSED_TO_REAL_REQUEST/);
});

test('Great Farm seed has exact explicit product1-5 and package front/back slots',()=>{
  const productCompositions=[1,2,3,4,5].map(n=>`MAT_GF_PRODUCT_${n}_COMPOSITION`);
  const packageSlots=[1,2,3,4,5].flatMap(n=>[`MAT_GF_PRODUCT_${n}_PACKAGE_FRONT`,`MAT_GF_PRODUCT_${n}_PACKAGE_BACK`]);
  for(const key of [...productCompositions,...packageSlots])assert.match(seed,new RegExp(key));
  assert.match(seed,/MAT_GF_PRODUCT_1_COMPOSITION[^\n]*'required',true/);
  for(const n of [2,3,4,5])assert.match(seed,new RegExp(`MAT_GF_PRODUCT_${n}_COMPOSITION[^\\n]*'required',false`));
  assert.match(seed,/MAT_GF_PRODUCT_1_PACKAGE_FRONT[^\n]*'required',true/);
  assert.match(seed,/MAT_GF_PRODUCT_1_PACKAGE_BACK[^\n]*'required',true/);
  for(const n of [2,3,4,5]){
    assert.match(seed,new RegExp(`MAT_GF_PRODUCT_${n}_PACKAGE_FRONT[^\\n]*'required',false`));
    assert.match(seed,new RegExp(`MAT_GF_PRODUCT_${n}_PACKAGE_BACK[^\\n]*'required',false`));
  }
});

test('seed response modes enforce TEXT-only identity fields and FILE evidence fields',()=>{
  assert.match(seed,/MAT_GF_PRODUCT_NAME[^\n]*'response_kind','TEXT'/);
  assert.match(seed,/MAT_GF_CARRIER[^\n]*'response_kind','TEXT'/);
  const fileKeys=['MAT_GF_PRODUCT_1_COMPOSITION','MAT_GF_FARM_PHOTO','MAT_GF_SORTING_PHOTO','MAT_GF_FEED_SPEC','MAT_GF_CERT_HACCP','MAT_GF_BUSINESS_REG'];
  for(const key of fileKeys)assert.match(seed,new RegExp(`${key}[^\\n]*'response_kind','FILE'`));
});

test('request delete is SUPER_ADMIN-only and preserves history through archive',()=>{
  assert.match(seed,/role='SUPER_ADMIN'/);
  assert.match(seed,/raise exception 'FORBIDDEN'/);
  assert.match(seed,/v_result:=jsonb_build_object\([\s\S]*?'mode','DELETED'/);
  assert.match(seed,/set status='ARCHIVED'/);
  assert.match(seed,/'history_preserved',true/);
  assert.match(guard,/set active=false/);
  assert.match(guard,/new\.status='ARCHIVED'/);
});

test('delete action is staging-routed and archived requests are excluded from active bootstrap',()=>{
  assert.match(runtime,/actor\?\.row\?\.role!=='SUPER_ADMIN'/);
  assert.match(runtime,/code1_material_delete_request/);
  assert.match(dispatch,/isPlanningMaterialRequestDeleteAction/);
  assert.match(dispatch,/request\.status!=='ARCHIVED'/);
  assert.match(edge,/planning\.material\.request\.delete/);
  assert.match(edge,/planning\.material\.template\.publish/);
});

test('index loads request action helper',()=>{
  assert.match(index,/planning-material-request-actions\.js/);
});

test('SUPER_ADMIN sees request delete control and delete calls exact RPC after confirmation',async()=>{
  const window=new Window({url:'https://staging.example/'}),document=window.document;
  document.body.innerHTML='<div class="material-workspace"><div class="material-request-list"><button class="material-request-row"><strong>테스트</strong></button></div></div><button data-admin-tab="materials">자료</button>';
  let action=null,payload=null,confirmed=0,alerted=0,reloaded=0;
  window.confirm=()=>{confirmed++;return true;};window.alert=()=>{alerted++;};
  document.querySelector('[data-admin-tab="materials"]').addEventListener('click',()=>{reloaded++;});
  try{Object.defineProperty(window,'crypto',{value:{randomUUID:()=> '12345678-1234-4123-8123-123456789abc'},configurable:true});}catch{}
  window.fetch=async(_url,options)=>{const body=JSON.parse(options.body);action=body.action;payload=body.payload;if(action==='planning.material.bootstrap')return{ok:true,json:async()=>({data:{requests:[{materialRequestId:'PMR_1',title:'테스트',status:'REQUESTED'}]}})};if(action==='planning.material.request.delete')return{ok:true,json:async()=>({data:{mode:'DELETED'}})};throw new Error(action);};
  window.eval(helper);
  window.dispatchEvent(new window.CustomEvent('code1-ready',{detail:{user:{id:'OWNER',role:'SUPER_ADMIN'}}}));
  await new Promise(r=>setTimeout(r,80));
  const button=document.querySelector('.material-request-delete');assert.ok(button);button.click();
  await new Promise(r=>setTimeout(r,30));
  assert.equal(confirmed,1);assert.equal(action,'planning.material.request.delete');assert.equal(payload.materialRequestId,'PMR_1');assert.equal(payload.confirmTitle,'테스트');assert.equal(alerted,1);assert.equal(reloaded,1);
  window.close();
});

test('non-SUPER_ADMIN never gets request delete controls',async()=>{
  const window=new Window({url:'https://staging.example/'}),document=window.document;
  document.body.innerHTML='<div class="material-workspace"><div class="material-request-list"><button class="material-request-row">테스트</button></div></div>';
  window.fetch=async()=>{throw new Error('fetch should not be called');};window.eval(helper);window.dispatchEvent(new window.CustomEvent('code1-ready',{detail:{user:{id:'A1',role:'ADMIN'}}}));await new Promise(r=>setTimeout(r,80));assert.equal(document.querySelector('.material-request-delete'),null);window.close();
});
