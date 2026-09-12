import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

function stripScripts(html){return html.replace(/<script[^>]*><\/script>/g,'');}

async function fixture(user){
  const w=new Window({url:'https://qa.example.test',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  w.fetch=async(url,init={})=>{
    if(url==='/api/session')return {ok:true,json:async()=>({configured:true,authenticated:true,googleEnabled:false})};
    if(url==='/api/rpc'){
      const {action}=JSON.parse(init.body||'{}');
      if(action==='bootstrap')return {ok:true,json:async()=>({data:{user,permissions:{farm:'edit',deck:'edit'},farms:[],submissions:[],catalog:[],canEditDeck:true}})};
      if(action==='admin.overview')return {ok:true,json:async()=>({data:{snapshot:{farmCount:4,submissionCount:2,activeAccountCount:2,verifiedFactCount:0,factCount:0,capturedAt:new Date().toISOString()},farms:[]}})};
      if(action==='executiveBrief.current')return {ok:true,json:async()=>({data:{brief:{brief_version:'v0.1',published_at:new Date().toISOString(),sections:[],content_json:{title:'Executive Brief',purpose:'QA'}}}})};
      return {ok:true,json:async()=>({data:{}})};
    }
    return {ok:true,json:async()=>({})};
  };
  w.document.write(stripScripts(fs.readFileSync('public/index.html','utf8')));
  w.eval(fs.readFileSync('public/assets/admin-ops.js','utf8'));
  return w;
}

test('OWNER SUPER_ADMIN gets visible executive planning navigation and landing card',async()=>{
  const w=await fixture({id:'OWNER',role:'SUPER_ADMIN',displayName:'최고 관리자',username:'owner'});
  try{
    w.dispatchEvent(new w.CustomEvent('code1-ready',{detail:{user:{id:'OWNER',role:'SUPER_ADMIN',displayName:'최고 관리자',username:'owner'}}}));
    const nav=w.document.getElementById('admin-ops-nav');
    assert.ok(nav,'OWNER executive nav must exist');
    assert.equal(nav.textContent,'경영·기획');
    const card=[...w.document.querySelectorAll('#landing .destinations button')].find(n=>n.textContent.includes('경영·기획'));
    assert.ok(card,'OWNER executive landing card must exist');
    nav.click();
    await w.happyDOM.waitUntilComplete();
    assert.equal(w.document.getElementById('admin-ops-page').hidden,false);
    assert.match(w.document.getElementById('admin-ops-page').textContent,/경영·기획/);
  }finally{await w.happyDOM.close();}
});

test('sub admin does not get OWNER executive planning entry',async()=>{
  const w=await fixture({id:'U_ADMIN',role:'ADMIN',displayName:'서브 관리자',username:'admin'});
  try{
    w.dispatchEvent(new w.CustomEvent('code1-ready',{detail:{user:{id:'U_ADMIN',role:'ADMIN',displayName:'서브 관리자',username:'admin'}}}));
    assert.equal(w.document.getElementById('admin-ops-nav'),null);
    assert.equal([...w.document.querySelectorAll('#landing .destinations button')].some(n=>n.textContent.includes('경영·기획')),false);
  }finally{await w.happyDOM.close();}
});
