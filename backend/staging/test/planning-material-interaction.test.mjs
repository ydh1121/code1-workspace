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
async function waitFor(fn,message='condition',timeout=1800){
  const started=Date.now();
  while(Date.now()-started<timeout){
    const value=fn();
    if(value)return value;
    await sleep(10);
  }
  throw new Error(`Timed out waiting for ${message}`);
}

function baseDom(document){
  document.body.innerHTML=`
    <div id="app">
      <nav id="main-nav"><button id="accounts-nav">계정 관리</button></nav>
      <section id="landing"></section><section id="farm-page"></section><section id="deck-page"></section><section id="accounts-page"></section>
      <section id="admin-ops-page">
        <div id="admin-ops-summary"></div>
        <nav id="admin-ops-tabs"><button data-admin-tab="planning">기획문서</button><button data-admin-tab="actions">해야 할 일</button></nav>
        <div id="admin-ops-body"></div>
      </section>
    </div>`;
}

function makeWindow(){
  const window=new Window({url:'https://staging.example/'});
  baseDom(window.document);
  const fakeCrypto={
    randomUUID:()=>`12345678-1234-4123-8123-${Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}`,
    subtle:{digest:async()=>new Uint8Array(32).buffer}
  };
  try{Object.defineProperty(window,'crypto',{value:fakeCrypto,configurable:true});}catch{}
  if(!window.btoa)window.btoa=value=>Buffer.from(value,'binary').toString('base64');
  return window;
}

function requestFixture(internal=true){
  return {
    request:{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란',sku:'EGG-01'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',revision:1,templateId:'T1',templateRevision:1,updatedAt:'2026-09-14T00:00:00Z'},
    items:[{requestItemId:'PMI_1',itemKey:'MAT_PRODUCT',label:'현재 상품명, 구성, 패키지 전후면',description:'상품명과 구성 정보를 적고 패키지 앞·뒤 사진을 첨부해 주세요.',required:true,sortOrder:1,templateRevision:1,classificationHint:'02_상품_패키지_표시',submissionState:'MISSING',reviewStatus:'REQUESTED',memo:'',files:[]}],
    assignees:[],
    access:{internal,canManage:internal,canReview:internal,canTemplate:internal,canUpload:true}
  };
}

function internalBootstrap(){
  return {
    mode:'INTERNAL',
    requests:[{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',updatedAt:'2026-09-14T00:00:00Z'}],
    templates:[{templateId:'T1',name:'기본 자료 항목',revision:3,items:[
      {itemKey:'MAT_PRODUCT',label:'현재 상품명, 구성, 패키지 전후면',description:'상품명과 패키지 자료',required:true,sortOrder:1,active:true,classificationHint:'02_상품_패키지_표시'},
      {itemKey:'MAT_FARM',label:'현재 생산농장, 사육환경, 생산자',description:'농장과 생산자 자료',required:true,sortOrder:2,active:true,classificationHint:'03_농장_생산자_사육환경'}
    ]}],
    accounts:[{id:'A1',username:'partner1',displayName:'자료 담당자',role:'PARTNER'},{id:'A2',username:'admin2',displayName:'내부 담당자',role:'ADMIN'}],
    access:{canManage:true,canReview:true,canTemplate:true,canUploadAssigned:true}
  };
}

function externalBootstrap(){
  return {mode:'ASSIGNED_UPLOAD',requests:[{materialRequestId:'PMR_1',title:'상세페이지 자료',counterparty:'그레이트팜',product:{name:'바나듐 계란'},purpose:'DETAIL_PAGE',status:'REQUESTED',reviewStatus:'REQUESTED',updatedAt:'2026-09-14T00:00:00Z'}],templates:[],accounts:[],access:{canManage:false,canReview:false,canTemplate:false,canUploadAssigned:true}};
}

function installRpcMock(window,{mode='internal'}={}){
  const calls=[];
  window.fetch=async(_url,options={})=>{
    const parsed=JSON.parse(options.body||'{}'),action=parsed.action,payload=parsed.payload||{};
    calls.push({action,payload});
    let data;
    if(action==='planning.material.bootstrap')data=mode==='internal'?internalBootstrap():externalBootstrap();
    else if(action==='planning.material.request.get')data=requestFixture(mode==='internal');
    else if(action==='planning.material.upload.begin')data={sessionId:`S_${payload.fileName}`,received:0,chunkBytes:1024*1024};
    else if(action==='planning.material.upload.chunk')data={sessionId:payload.sessionId,received:payload.total};
    else if(action==='planning.material.upload.finish')data={material_file_id:'PMF_1',revision:1,media_id:'M_1'};
    else if(action==='planning.material.item.update')data={request_item_id:payload.requestItemId};
    else if(action==='planning.material.review')data={request_item_id:payload.requestItemId,review_status:payload.reviewStatus};
    else if(action==='planning.material.template.save')data={template_id:'T1',revision:4};
    else if(action==='planning.material.request.submit')data={material_request_id:'PMR_1',status:payload.status};
    else if(action==='planning.material.request.create')data={material_request_id:'PMR_NEW'};
    else if(action==='planning.material.file.read')data={url:'/api/staging/media-get?token=test'};
    else throw new Error(`Unexpected RPC ${action}`);
    return {ok:true,json:async()=>({data})};
  };
  return calls;
}

async function start(window,user,mode){
  const calls=installRpcMock(window,{mode});
  window.eval(ui);
  window.dispatchEvent(new window.CustomEvent('code1-ready',{detail:{user}}));
  return calls;
}

test('OWNER task flow uses one compose surface, secondary exceptions, collapsed review, and outline-first settings',async()=>{
  const window=makeWindow(),document=window.document;
  await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');
  const materialTab=await waitFor(()=>document.querySelector('[data-admin-tab="materials"]'),'material tab');
  materialTab.click();
  await waitFor(()=>document.querySelector('.material-workspace'),'material workspace');
  assert.equal(document.body.textContent.includes('PLANNING MATERIAL'),false);
  assert.ok([...document.querySelectorAll('button')].some(button=>button.textContent==='요청 항목 관리'));

  [...document.querySelectorAll('button')].find(button=>button.textContent.includes('새 자료요청')).click();
  const createDialog=await waitFor(()=>document.querySelector('#material-create-dialog'),'create request dialog');
  assert.ok(createDialog.querySelector('.material-fixed-template'));
  assert.equal([...createDialog.querySelectorAll('.material-field>span')].some(node=>node.textContent==='요청 항목 구성'),false);
  createDialog.close();

  [...document.querySelectorAll('button')].find(button=>button.textContent==='요청 항목 관리').click();
  const manager=await waitFor(()=>document.querySelector('#material-template-dialog'),'template manager');
  assert.ok(manager.querySelector('.template-outline-row'));
  assert.equal(manager.querySelectorAll('.template-outline-row input,.template-outline-row textarea,.template-outline-row select').length,0);
  const editButton=[...manager.querySelectorAll('.template-outline-row button')].find(button=>button.textContent==='편집');
  editButton.click();
  const editDialog=await waitFor(()=>document.querySelector('#material-template-item-dialog'),'item edit dialog');
  assert.ok(editDialog.querySelector('input'));
  assert.ok(editDialog.querySelector('textarea'));
  assert.ok(editDialog.querySelector('select'));
  editDialog.close();manager.close();

  document.querySelector('.material-request-row').click();
  await waitFor(()=>document.querySelector('.material-compose'),'request compose');
  assert.equal(document.querySelectorAll('.material-compose').length,1);
  assert.ok(document.querySelector('.material-exception-panel'));
  const review=document.querySelector('.material-review-panel');
  assert.ok(review);
  assert.equal(review.open,false);
  assert.equal(document.querySelector('.material-item-body').textContent.includes('직접 입력'),false);
  window.close();
});

test('drop zone is fully clickable and drag/drop builds a removable multi-file queue with per-file progress/results',async()=>{
  const window=makeWindow(),document=window.document;
  const calls=await start(window,{id:'OWNER',role:'SUPER_ADMIN'},'internal');
  const materialTab=await waitFor(()=>document.querySelector('[data-admin-tab="materials"]'),'material tab');
  materialTab.click();await waitFor(()=>document.querySelector('.material-request-row'),'request row');document.querySelector('.material-request-row').click();
  const zone=await waitFor(()=>document.querySelector('.material-upload-zone'),'drop zone'),fileInput=zone.querySelector('input[type="file"]');

  let pickerClicks=0;fileInput.click=()=>{pickerClicks++;};zone.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(pickerClicks,1);
  const over=new window.Event('dragover',{bubbles:true,cancelable:true});zone.dispatchEvent(over);assert.equal(zone.classList.contains('dragover'),true);
  const leave=new window.Event('dragleave',{bubbles:true,cancelable:true});zone.dispatchEvent(leave);assert.equal(zone.classList.contains('dragover'),false);

  const fileA=new window.File(['%PDF-A'],'a.pdf',{type:'application/pdf',lastModified:1}),fileB=new window.File(['%PDF-B'],'b.pdf',{type:'application/pdf',lastModified:2});
  const drop=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files:[fileA,fileB]}});zone.dispatchEvent(drop);
  await waitFor(()=>document.querySelectorAll('.material-queue-row').length===2,'two queued files');
  assert.match(document.querySelector('.material-file-queue').textContent,/a\.pdf/);assert.match(document.querySelector('.material-file-queue').textContent,/b\.pdf/);
  document.querySelector('.material-remove-file').click();assert.equal(document.querySelectorAll('.material-queue-row').length,1);

  document.querySelector('.material-upload-controls .primary').click();
  await waitFor(()=>document.querySelector('.material-queue-row.state-done'),'completed queue row');
  assert.match(document.querySelector('.material-upload-output').textContent,/1개 파일 업로드 완료/);
  assert.ok(calls.some(call=>call.action==='planning.material.upload.begin'));
  assert.ok(calls.some(call=>call.action==='planning.material.upload.chunk'));
  assert.ok(calls.some(call=>call.action==='planning.material.upload.finish'));
  window.close();
});

test('assigned submitter gets the same compose/drop flow but never receives internal review controls',async()=>{
  const window=makeWindow(),document=window.document;
  await start(window,{id:'A1',role:'PARTNER'},'external');
  const nav=await waitFor(()=>document.querySelector('#planning-material-external-nav'),'external material nav');nav.click();
  await waitFor(()=>document.querySelector('.material-request-row'),'external request row');document.querySelector('.material-request-row').click();
  await waitFor(()=>document.querySelector('.material-compose'),'external compose');
  assert.ok(document.querySelector('.material-upload-zone'));
  assert.ok(document.querySelector('.material-exception-panel'));
  assert.equal(document.querySelector('.material-review-panel'),null);
  assert.equal(document.body.textContent.includes('MATERIAL SUBMISSION'),false);
  window.close();
});