import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

function catalog(){return [
  {item_key:'A-01',section_code:'A',section_name:'기본정보',item_label:'농장명',plain_question:'농장 이름?',why_needed:'식별',input_type:'text'},
  {item_key:'A-02',section_code:'A',section_name:'기본정보',item_label:'브랜드명',plain_question:'브랜드 이름?',why_needed:'표시',input_type:'text'},
  {item_key:'A-03',section_code:'A',section_name:'기본정보',item_label:'과거 메모',plain_question:'과거 메모?',why_needed:'참고',input_type:'text'},
  {item_key:'F-01',section_code:'F',section_name:'상품',item_label:'상품명',plain_question:'상품 이름?',why_needed:'판매',input_type:'text'},
  {item_key:'G-01',section_code:'G',section_name:'가격',item_label:'구 가격',plain_question:'구 가격?',why_needed:'과거 참고',input_type:'text'}
];}
function response(w,data){return new w.Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});}
async function fixture(){
  const w=new Window({url:'https://qa.example.test'});
  w.document.body.innerHTML='<nav id="main-nav"></nav><main id="app"><section id="landing"></section><section id="farm-page"></section><section id="deck-page"></section><section id="accounts-page"></section></main><button id="home"></button>';
  const boot={catalog:catalog(),farms:[{id:'f1',name:'농가1'}],questionPolicyReady:true,questionPolicies:[
    {scope:'GLOBAL',farmId:'',itemKey:'A-02',mode:'OPTIONAL',version:1},
    {scope:'GLOBAL',farmId:'',itemKey:'A-03',mode:'HIDE',version:1},
    {scope:'GLOBAL',farmId:'',itemKey:'F-01',mode:'HIDE',version:1},
    {scope:'FARM',farmId:'f1',itemKey:'F-01',mode:'SHOW',version:1},
    {scope:'GLOBAL',farmId:'',itemKey:'G-01',mode:'PERMANENT_EXCLUDE',version:1},
    {scope:'FARM',farmId:'f1',itemKey:'G-01',mode:'SHOW',version:1}
  ]};
  w.fetch=async(url,init)=>{const req=init?.body?JSON.parse(init.body):{};if(req.action==='bootstrap')return response(w,boot);return response(w,{});};
  w.eval(fs.readFileSync('public/assets/farm-model.js','utf8'));
  await w.fetch('/api/rpc',{method:'POST',body:JSON.stringify({action:'bootstrap',payload:{}})});
  return {w,boot};
}

test('optional questions stay visible but do not block progress or missing requests',async()=>{
  const {w,boot}=await fixture();
  try{
    const form={farmId:'f1',answers:{'A-01':'농가1'},media:[]};
    const visible=w.Code1Farm.questions(boot.catalog,form,{category:null});
    assert.deepEqual(visible.map(q=>q.item_key),['A-01','A-02','F-01']);
    const progress=w.Code1Farm.progress(boot.catalog,form);
    assert.deepEqual({done:progress.done,total:progress.total,left:progress.left},{done:1,total:2,left:1});
    assert.deepEqual(w.Code1Farm.missing(boot.catalog,form).map(q=>q.item_key),['F-01']);
  }finally{await w.happyDOM.close();}
});

test('farm override can restore a hidden item but cannot override a global permanent exclusion',async()=>{
  const {w}=await fixture();
  try{
    assert.equal(w.Code1Farm.policyMode('F-01','f1'),'SHOW');
    assert.equal(w.Code1Farm.policyMode('G-01','f1'),'PERMANENT_EXCLUDE');
    assert.equal(w.Code1Farm.policyMode('A-02','f1'),'OPTIONAL');
  }finally{await w.happyDOM.close();}
});

test('question policy menu is exposed to sub administrators',async()=>{
  const {w}=await fixture();
  try{
    w.dispatchEvent(new w.CustomEvent('code1-ready',{detail:{user:{role:'ADMIN'}}}));
    await new Promise(resolve=>w.setTimeout(resolve,0));
    assert.equal(w.document.getElementById('question-policy-nav').hidden,false);
  }finally{await w.happyDOM.close();}
});
