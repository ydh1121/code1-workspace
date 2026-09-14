import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {Window} from 'happy-dom';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const ui=fs.readFileSync(resolve(root,'public/assets/planning-materials.js'),'utf8');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,message='condition',timeout=2200){const started=Date.now();while(Date.now()-started<timeout){const value=fn();if(value)return value;await sleep(10);}throw new Error(`Timed out waiting for ${message}`);}

function baseDom(document){document.body.innerHTML=`<div id="app"><nav id="main-nav"><button id="accounts-nav">계정 관리</button></nav><section id="landing"></section><section id="farm-page"></section><section id="deck-page"></section><section id="accounts-page"></section><section id="admin-ops-page"><div id="admin-ops-summary"></div><nav id="admin-ops-tabs"><button data-admin-tab="planning">기획문서</button><button data-admin-tab="actions">해야 할 일</button></nav><div id="admin-ops-body"></div></section></div>`;}
function makeWindow(){const window=new Window({url:'https://staging.example/'});baseDom(window.document);const fakeCrypto={randomUUID:()=>`12345678-1234-4123-8123-${Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}`,subtle:{digest:async()=>new Uint8Array(32).buffer}};try{Object.defineProperty(window,'crypto',{value:fakeCrypto,configurable:true});}catch{}if(!window.btoa)window.btoa=value=>Buffer.from(value,'binary').toString('base64');window.confirm=()=>true;window.alert=()=>{};return window;}

const typedItems=()=>[
  {requestItemId:'PMI_TEXT',itemKey:'PRODUCT_NAME',label:'제품명',description:'판매 중인 제품명을 입력해 주세요.',required:true,sortOrder:1,templateRevision:3,classificationHint:'02_상품_패키지_표시',responseKind:'TEXT',responseKindLegacy:false,submissionState:'MISSING',reviewStatus:'REQUESTED',memo:'',files:[]},
  {requestItemId:'PMI_FILE',itemKey:'BUSINESS_REG',label:'사업자등록증',description:'현재 사업자등록증 파일을 제출해 주세요.',required:true,sortOrder:2,templateRevision:3,classificationHint:'01_사업자_법인',responseKind:'FILE',responseKindLegacy:false,submissionState:'MISSING',reviewStatus:'REQUESTED',memo:'',files:[]},
  {requestItemId:'PMI_BOTH',itemKey:'PACKAGE_NOTE',label:'패키지 설명과 사진',description:'패키지 설명과 전후면 사진을 함께 제출해 주세요.',required:false,sortOrder:3,templateRevision:3,classificationHint:'02_상품_패키지_표시',responseKind:'TEXT_FILE',responseKindLegacy:false,submissionState:'MISSING',reviewStatus:'REQUESTED',memo:'',files:[]}
];
function requestFixture(internal=true){return{request:{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란',sku:'EGG-01'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',revision:1,templateId:'T1',templateRevision:3,updatedAt:'2026-09-14T00:00:00Z'},items:typedItems(),assignees:[],access:{internal,canManage:internal,canReview:internal,canTemplate:internal,canUpload:true}};}
function templateFixture(){return{templateId:'T1',name:'기본 자료 항목',revision:3,publishedRevision:3,lifecycleStatus:'PUBLISHED',items:[
  {itemKey:'PRODUCT_NAME',label:'제품명',description:'판매 중인 제품명',required:true,sortOrder:1,active:true,classificationHint:'02_상품_패키지_표시',responseKind:'TEXT',publishedBefore:true},
  {itemKey:'BUSINESS_REG',label:'사업자등록증',description:'사업자등록증 원본',required:true,sortOrder:2,active:true,classificationHint:'01_사업자_법인',responseKind:'FILE',publishedBefore:true},
  {itemKey:'PACKAGE_NOTE',label:'패키지 설명과 사진',description:'설명과 사진',required:false,sortOrder:3,active:true,classificationHint:'02_상품_패키지_표시',responseKind:'TEXT_FILE',publishedBefore:true}
]};}
function internalBootstrap(state){return{mode:'INTERNAL',requests:[{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',updatedAt:'2026-09-14T00:00:00Z'}],templates:[state.template],accounts:[{id:'A1',username:'partner1',displayName:'자료 담당자',role:'PARTNER'}],access:{canManage:true,canReview:true,canTemplate:true,canUploadAssigned:true}};}
function externalBootstrap(){return{mode:'ASSIGNED_UPLOAD',requests:[{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',updatedAt:'2026-09-14T00:00:00Z'}],templates:[],accounts:[],access:{canManage:false,canReview:false,canTemplate:false,canUploadAssigned:true}};}

function installRpcMock(window,{mode='internal'}={}){
  const calls=[],state={template:templateFixture()};
  window.fetch=async(_url,options={})=>{const parsed=JSON.parse(options.body||'{}'),action=parsed.action,payload=parsed.payload||{};calls.push({action,payload});let data;
    if(action==='planning.material.bootstrap')data=mode==='internal'?internalBootstrap(state):externalBootstrap();
    else if(action==='planning.material.request.get')data=requestFixture(mode==='internal');
    else if(action==='planning.material.upload.begin')data={sessionId:`S_${payload.fileName}`,received:0,chunkBytes:1024*1024};
    else if(action==='planning.material.upload.chunk')data={sessionId:payload.sessionId,received:payload.total};
    else if(action==='planning.material.upload.finish')data={material_file_id:'PMF_1',revision:1,media_id:'M_1',submission_state:'FILE_SUBMITTED'};
    else if(action==='planning.material.item.update')data={request_item_id:payload.requestItemId,submission_state:String(payload.memo||'').trim()?'TEXT_SUBMITTED':'MISSING'};
    else if(action==='planning.material.review')data={request_item_id:payload.requestItemId,review_status:payload.reviewStatus};
    else if(action==='planning.material.template.save'){state.template={...state.template,revision:state.template.revision+1,lifecycleStatus:'DRAFT',items:payload.items.map(x=>({itemKey:x.item_key,label:x.label,description:x.description,required:x.required,sortOrder:x.sort_order,active:x.active,classificationHint:x.classification_hint,responseKind:x.response_kind,publishedBefore:state.template.items.some(old=>old.itemKey===x.item_key&&old.publishedBefore)}))};data={template_id:'T1',revision:state.template.revision,published_revision:state.template.publishedRevision,lifecycle_status:'DRAFT'};}
    else if(action==='planning.material.template.publish'){state.template={...state.template,publishedRevision:payload.revision,lifecycleStatus:'PUBLISHED',items:state.template.items.map(x=>({...x,publishedBefore:true}))};data={template_id:'T1',revision:payload.revision,published_revision:payload.revision,lifecycle_status:'PUBLISHED'};}
    else if(action==='planning.material.request.submit')data={material_request_id:'PMR_1',status:payload.status};
    else if(action==='planning.material.request.create')data={material_request_id:'PMR_NEW'};
    else if(action==='planning.material.file.read')data={url:'/api/staging/media-get?token=test'};
    else throw new Error(`Unexpected RPC ${action}`);
    return{ok:true,json:async()=>({data})};};return{calls,state};
}
async function start(window,user,mode){const mock=installRpcMock(window,{mode});window.eval(ui);window.dispatchEvent(new window.CustomEvent('code1-ready',{detail:{user}}));return mock;}
async function openInternalRequest(document){const materialTab=await waitFor(()=>document.querySelector('[data-admin-tab="materials"]'),'material tab');materialTab.click();await waitFor(()=>document.querySelector('.material-request-row'),'request row');document.querySelector('.material-request-row').click();await waitFor(()=>document.querySelector('.material-item-list'),'request items');}
function itemByKey(document,key){return document.querySelector(`.material-item-list .material-item:nth-child(${key==='PRODUCT_NAME'?1:key==='BUSINESS_REG'?2:3})`);}

test('typed request renderer shows TEXT only for 제품명, FILE only for evidence, and both only for TEXT_FILE',async()=>{
  const window=makeWindow(),document=window.document;await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');await openInternalRequest(document);
  const text=itemByKey(document,'PRODUCT_NAME'),file=itemByKey(document,'BUSINESS_REG'),both=itemByKey(document,'PACKAGE_NOTE');
  assert.ok(text.querySelector('.material-compose-text input[type="text"]'));assert.equal(text.querySelector('.material-upload-zone'),null);
  assert.ok(file.querySelector('.material-upload-zone'));assert.equal(file.querySelector('.material-compose-text'),null);
  assert.ok(both.querySelector('.material-compose-text'));assert.ok(both.querySelector('.material-upload-zone'));
  assert.ok(document.querySelector('.material-review-panel'));window.close();
});

test('FILE drop zone retains click, drag feedback, multi-file queue, removal and multipart completion',async()=>{
  const window=makeWindow(),document=window.document;const {calls}=await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');await openInternalRequest(document);
  const fileItem=itemByKey(document,'BUSINESS_REG'),zone=fileItem.querySelector('.material-upload-zone'),fileInput=zone.querySelector('input[type="file"]');let pickerClicks=0;fileInput.click=()=>pickerClicks++;zone.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(pickerClicks,1);
  zone.dispatchEvent(new window.Event('dragover',{bubbles:true,cancelable:true}));assert.equal(zone.classList.contains('dragover'),true);zone.dispatchEvent(new window.Event('dragleave',{bubbles:true,cancelable:true}));assert.equal(zone.classList.contains('dragover'),false);
  const fileA=new window.File(['%PDF-A'],'a.pdf',{type:'application/pdf',lastModified:1}),fileB=new window.File(['%PDF-B'],'b.pdf',{type:'application/pdf',lastModified:2}),drop=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files:[fileA,fileB]}});zone.dispatchEvent(drop);await waitFor(()=>fileItem.querySelectorAll('.material-queue-row').length===2,'two queued files');assert.match(fileItem.querySelector('.material-file-queue').textContent,/a\.pdf/);assert.match(fileItem.querySelector('.material-file-queue').textContent,/b\.pdf/);fileItem.querySelector('.material-remove-file').click();assert.equal(fileItem.querySelectorAll('.material-queue-row').length,1);fileItem.querySelector('.material-upload-controls .primary').click();await waitFor(()=>fileItem.querySelector('.material-queue-row.state-done'),'completed queue row');assert.ok(calls.some(c=>c.action==='planning.material.upload.begin'));assert.ok(calls.some(c=>c.action==='planning.material.upload.chunk'));assert.ok(calls.some(c=>c.action==='planning.material.upload.finish'));window.close();
});

test('draft test item is visible in internal preview, removable before publish, and never present on submitter surface',async()=>{
  const window=makeWindow(),document=window.document;const {calls}=await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');const tab=await waitFor(()=>document.querySelector('[data-admin-tab="materials"]'),'material tab');tab.click();await waitFor(()=>document.querySelector('.material-workspace'),'workspace');[...document.querySelectorAll('button')].find(b=>b.textContent==='요청 항목 관리').click();const manager=await waitFor(()=>document.querySelector('#material-template-dialog'),'manager');
  [...manager.querySelectorAll('button')].find(b=>b.textContent.includes('이 분류에 항목 추가')).click();const editor=await waitFor(()=>document.querySelector('#material-template-item-dialog'),'new editor');const fields=editor.querySelectorAll('input[type="text"],textarea,select');editor.querySelector('input[type="text"]').value='QA 초안 테스트 항목';const selects=editor.querySelectorAll('select');selects[0].value='TEXT';editor.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>manager.textContent.includes('QA 초안 테스트 항목'),'draft item row');
  [...manager.querySelectorAll('button')].find(b=>b.textContent==='초안 미리보기').click();const preview=await waitFor(()=>document.querySelector('#material-template-preview-dialog'),'preview');assert.match(preview.textContent,/QA 초안 테스트 항목/);assert.match(preview.textContent,/게시 전에는 실제 제출자에게 노출되지 않습니다/);preview.close();
  const row=[...manager.querySelectorAll('.template-outline-row')].find(r=>r.textContent.includes('QA 초안 테스트 항목'));[...row.querySelectorAll('button')].find(b=>b.textContent==='편집').click();const edit2=await waitFor(()=>document.querySelector('#material-template-item-dialog'),'edit draft item');[...edit2.querySelectorAll('button')].find(b=>b.textContent==='초안에서 삭제').click();await waitFor(()=>!manager.textContent.includes('QA 초안 테스트 항목'),'draft deletion');
  [...manager.querySelectorAll('button')].find(b=>b.textContent==='초안 저장').click();await waitFor(()=>calls.some(c=>c.action==='planning.material.template.save'),'draft save rpc');const saveCall=calls.filter(c=>c.action==='planning.material.template.save').at(-1);assert.equal(saveCall.payload.items.some(i=>i.label==='QA 초안 테스트 항목'),false);assert.equal(calls.some(c=>c.action==='planning.material.template.publish'),false);window.close();

  const external=makeWindow(),externalDoc=external.document;await start(external,{id:'A1',role:'PARTNER'},'external');const nav=await waitFor(()=>externalDoc.querySelector('#planning-material-external-nav'),'external nav');nav.click();await waitFor(()=>externalDoc.querySelector('.material-request-row'),'external request');externalDoc.querySelector('.material-request-row').click();await waitFor(()=>externalDoc.querySelector('.material-item-list'),'external items');assert.equal(externalDoc.body.textContent.includes('QA 초안 테스트 항목'),false);assert.equal(externalDoc.querySelector('.material-review-panel'),null);assert.equal(externalDoc.querySelector('#material-template-dialog'),null);external.close();
});

test('template publish is explicit and occurs only after a saved draft revision',async()=>{
  const window=makeWindow(),document=window.document;const {calls}=await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');const tab=await waitFor(()=>document.querySelector('[data-admin-tab="materials"]'),'tab');tab.click();await waitFor(()=>document.querySelector('.material-workspace'),'workspace');[...document.querySelectorAll('button')].find(b=>b.textContent==='요청 항목 관리').click();const manager=await waitFor(()=>document.querySelector('#material-template-dialog'),'manager');const firstEdit=manager.querySelector('.template-outline-row button:last-child');firstEdit.click();const edit=await waitFor(()=>document.querySelector('#material-template-item-dialog'),'editor');const description=edit.querySelector('textarea');description.value='변경된 제출 안내';edit.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));[...manager.querySelectorAll('button')].find(b=>b.textContent==='초안 저장').click();await waitFor(()=>calls.some(c=>c.action==='planning.material.template.save'),'save');await waitFor(()=>manager.textContent.includes('게시 대기 초안'),'draft lifecycle');[...manager.querySelectorAll('button')].find(b=>b.textContent==='게시').click();await waitFor(()=>calls.some(c=>c.action==='planning.material.template.publish'),'publish');const save=calls.find(c=>c.action==='planning.material.template.save'),publish=calls.find(c=>c.action==='planning.material.template.publish');assert.ok(save);assert.equal(publish.payload.revision,4);assert.ok(calls.indexOf(save)<calls.indexOf(publish));window.close();
});

test('assigned submitter sees typed controls but no internal review or template draft controls',async()=>{
  const window=makeWindow(),document=window.document;await start(window,{id:'A1',role:'PARTNER'},'external');const nav=await waitFor(()=>document.querySelector('#planning-material-external-nav'),'external material nav');nav.click();await waitFor(()=>document.querySelector('.material-request-row'),'external request row');document.querySelector('.material-request-row').click();await waitFor(()=>document.querySelector('.material-item-list'),'external items');const text=itemByKey(document,'PRODUCT_NAME'),file=itemByKey(document,'BUSINESS_REG');assert.ok(text.querySelector('.material-compose-text input'));assert.equal(text.querySelector('.material-upload-zone'),null);assert.ok(file.querySelector('.material-upload-zone'));assert.equal(file.querySelector('.material-compose-text'),null);assert.equal(document.querySelector('.material-review-panel'),null);assert.equal(document.querySelector('#material-template-dialog'),null);window.close();
});