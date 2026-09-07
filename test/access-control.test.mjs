import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac,randomUUID} from 'node:crypto';
const source=await readFile('bridge/AccessControl.gs','utf8'),dispatcher=await readFile('bridge/CloudflareBridge.gs','utf8');
const secret='unit-test-bridge-key-not-production-123456';
const credential={hash:'a'.repeat(64),salt:'b'.repeat(32),iterations:100000,scheme:'pbkdf2-sha256-pepper-v1'};
function fixture(){
  const sheets=new Map(),cache=new Map(),calls=[];
  class Sheet{
    constructor(rows=[]){this.rows=rows;this.max=100;}
    getLastRow(){return this.rows.length;}getMaxRows(){return this.max;}getMaxColumns(){return 26;}
    insertRowsAfter(n,count){this.max+=count;}setFrozenRows(){}
    getDataRange(){return {getValues:()=>structuredClone(this.rows)};}
    getRange(r,c,n=1,m=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[r-1+i]?.[c-1+j]??'')),setValues:values=>values.forEach((row,i)=>{this.rows[r-1+i]??=[];row.forEach((v,j)=>this.rows[r-1+i][c-1+j]=v);}),setValue:value=>{this.rows[r-1]??=[];this.rows[r-1][c-1]=value;}};}
  }
  sheets.set('14_WEB_설정',new Sheet([['key','value'],['ALLOWED_USER_1','owner@example.test'],['ALLOWED_USER_2','legacy@example.test'],['CONTRIBUTOR_DECK_EDIT','TRUE'],['WRITE_MODE','STAGING_ONLY']]));
  const commits=[{submission_id:'sa',farm_id:'fa',farm_name:'A 농가',submitted_by:'old@example.test'},{submission_id:'sb',farm_id:'fb',farm_name:'B 농가',submitted_by:'other@example.test'}];
  const media=[{upload_id:'ma',submission_id:'sa',farm_id:'fa',drive_file_id:'private-a',drive_url:'https://drive.google.com/file/a',submitted_by:'old@example.test',status:'REVIEW_REQUIRED',mime_type:'image/png'}, {upload_id:'mb',submission_id:'sb',farm_id:'fb',drive_file_id:'private-b'}, {upload_id:'md',submission_id:'DECK'}];
  const lower=name=>(u,p)=>{calls.push({name,u,p});return {saved:true};};
  const c=vm.createContext({CODE1_OWNER_:'owner@example.test',SEED_ASSETS_:{seed:{url:'data:seed'}},Date,Number,Set,
    db_:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}}),sheet_:n=>sheets.get(n),staging_:()=>{},cell_:v=>v??'',str_:(v,n)=>{if(typeof v!=='string'||v.length>n)throw Error('INVALID_TEXT');return v;},id_:v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(v))throw Error('INVALID_ID');return v;},sha_:x=>createHash('sha256').update(x).digest('hex'),random_:()=>randomUUID().replaceAll('-',''),withLock_:fn=>fn(),
    cache_:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)}),
    farms_:()=>[{id:'fa',name:'A 농가'},{id:'fb',name:'B 농가'}],commits_:()=>structuredClone(commits),latest_:id=>commits.find(c=>c.submission_id===id),latestMedia_:()=>structuredClone(media),catalog_:()=>[{item_key:'A-01'}],
    listSubmissions_:()=>commits.map(c=>({id:c.submission_id,farmId:c.farm_id,name:c.farm_name,by:c.submitted_by})),getSubmission_:(u,id)=>({id,media:structuredClone(media.filter(m=>m.submission_id===id)),answers:{one:'answer'}}),loadDeck_:()=>({slides:[],version:1}),deckReferences_:()=>new Set(['seed','md']),media_:(u,id)=>{calls.push({name:'media',id});return {url:'data:image',source:'private-url',note:'internal'};},
    saveSubmission_:lower('saveSubmission'),review_:lower('review'),saveDeck_:lower('saveDeck'),linkDrive_:lower('linkDrive'),upload_:lower('upload'),reviewMedia_:lower('reviewMedia'),
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>secret})},Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(body,key)=>Array.from(createHmac('sha256',key).update(body).digest())},ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({value,setMimeType(){return this;}})}
  });
  vm.runInContext(source+'\n'+dispatcher,c);c.accessGoogle_('owner@example.test');
  const owner=c.accessRows_('19_WEB_ACCOUNTS')[0];
  const create=(username,role='FARMER',permissions={farm:'edit',deck:'none',farmIds:['fa']})=>c.accessSaveAccount_(owner,{username,displayName:username,role,status:'active',permissions,credential});
  const a=create('farm-a'),b=create('farm-b','FARMER',{farm:'edit',deck:'none',farmIds:['fb']}),admin=create('manager','ADMIN');
  const principal=a=>({accountId:a.id,version:a.version});
  const call=(a,action,p={})=>c.accessDispatch_(principal(a),action,p);
  const post=(p,sig)=>{const body=JSON.stringify({protocol:2,timestamp:Date.now(),nonce:randomUUID().replaceAll('-',''),...p});return JSON.parse(c.doPost({postData:{contents:JSON.stringify({body,signature:sig??createHmac('sha256',secret).update(body).digest('hex')})}}).value);};
  return {c,call,post,a,b,admin,owner,create,principal,calls,sheets,media,cache};
}
test('owner is provisioned only by verified owner; setup preserves existing rows and closes legacy contributor path',()=>{
  const f=fixture();assert.throws(()=>f.c.accessGoogle_('stranger@example.test'),/FORBIDDEN/);
  const before=JSON.stringify(f.c.accessRows_('19_WEB_ACCOUNTS'));f.c.accessGoogle_('owner@example.test');assert.equal(JSON.stringify(f.c.accessRows_('19_WEB_ACCOUNTS')),before);
  const rows=f.sheets.get('14_WEB_설정').rows;assert.equal(rows[1][1],'owner@example.test');assert.equal(rows[2][1],'');assert.equal(rows[3][1],'FALSE');assert.equal(rows[4][1],'STAGING_ONLY');
  assert.deepEqual([...f.sheets.keys()].sort(),['14_WEB_설정','19_WEB_ACCOUNTS','20_WEB_ACCESS_LOG','21_WEB_LOGIN_GUARD']);
});
test('farm bootstrap omits other farm names, submissions, deck, account data and media metadata',()=>{
  const f=fixture(),b=f.call(f.a,'bootstrap');assert.equal(b.deck,null);assert.equal(b.farms.length,1);assert.equal(b.farms[0].id,'fa');assert.equal(b.submissions[0].id,'sa');assert.equal(b.submissions.length,1);assert.equal('by' in b.submissions[0],false);
  const m=f.call(f.a,'getSubmission',{id:'sa'}).media[0];assert.equal(m.upload_id,'ma');assert.equal('drive_file_id' in m,false);assert.equal('submitted_by' in m,false);
  assert.equal(/password_hash|password_salt|B 농가|private-b/.test(JSON.stringify(b)),false);
});
test('direct requests cannot cross farm boundary or use deck/admin/review APIs',()=>{
  const f=fixture();
  for(const [action,p] of [['getSubmission',{id:'sb'}],['saveSubmission',{id:'sb',farmId:'fb'}],['saveSubmission',{id:'new',farmId:'fb'}],['saveSubmission',{id:'new'}],['saveSubmission',{id:'sa',farmId:'fb'}],['media',{id:'mb'}],['upload',{submissionId:'sb'}],['linkDrive',{submissionId:'sa'}],['review',{id:'sa'}],['reviewMedia',{id:'ma'}],['saveDeck',{}],['media',{id:'seed'}],['deckAssets',{}],['account.list',{}],['account.save',{}]])assert.throws(()=>f.call(f.a,action,p),/FORBIDDEN/,action);
  assert.equal(f.calls.length,0);
  f.call(f.a,'saveSubmission',{id:'sa',farmId:'fa'});assert.equal(f.calls[0].name,'saveSubmission');
  assert.equal(f.calls[0].u.email,'account:'+f.a.id);
});
test('read-only grants return selected farm data but prohibit saves and uploads; hidden farm page returns no catalog',()=>{
  const f=fixture(),view=f.create('readonly','FARMER',{farm:'view',deck:'view',farmIds:['fa']});
  assert.equal(f.call(view,'getSubmission',{id:'sa'}).id,'sa');assert.ok(f.call(view,'deckAssets').seed);
  for(const [action,p] of [['saveSubmission',{id:'sa'}],['upload',{submissionId:'sa'}],['upload',{kind:'DECK'}],['saveDeck',{}]])assert.throws(()=>f.call(view,action,p),/FORBIDDEN/);
  const none=f.create('no-access','FARMER',{farm:'none',deck:'none',farmIds:[]}),boot=f.call(none,'bootstrap');assert.equal(boot.catalog.length+boot.farms.length+boot.submissions.length,0);assert.equal(boot.deck,null);
});
test('sub admin can view/edit/review all farms and deck; only top admin can issue admin roles',()=>{
  const f=fixture(),b=f.call(f.admin,'bootstrap');assert.equal(b.farms.length,2);assert.equal(b.canEditDeck,true);assert.ok(b.deck);
  f.call(f.admin,'saveSubmission',{id:'sb'});f.call(f.admin,'review',{id:'sa'});f.call(f.admin,'saveDeck',{});assert.equal(f.calls.length,3);
  const base={username:'new-farm',displayName:'new',role:'FARMER',status:'active',permissions:{farm:'edit',deck:'none',farmIds:['fa']},credential};
  const created=f.call(f.admin,'account.save',base);assert.equal(created.role,'FARMER');
  assert.throws(()=>f.call(f.admin,'account.save',{...base,username:'bad-admin',role:'ADMIN'}),/FORBIDDEN/);
  assert.throws(()=>f.call(f.admin,'account.save',{...base,id:'OWNER'}),/최고 관리자/);
  const response=f.call(f.admin,'account.list');assert.ok(response.accounts.length);assert.equal(/password_hash|password_salt/.test(JSON.stringify(response)),false);
});
test('permission changes, disable and password reset immediately invalidate an existing session',()=>{
  const f=fixture();
  const edited=f.c.accessSaveAccount_(f.owner,{id:f.a.id,baseVersion:1,username:f.a.username,displayName:'changed',role:'FARMER',status:'active',permissions:{farm:'view',deck:'none',farmIds:['fb']}});
  assert.throws(()=>f.call(f.a,'getSubmission',{id:'sa'}),/UNAUTHENTICATED/);assert.throws(()=>f.call(edited,'getSubmission',{id:'sa'}),/FORBIDDEN/);assert.equal(f.call(edited,'getSubmission',{id:'sb'}).id,'sb');
  assert.throws(()=>f.c.accessSaveAccount_(f.owner,{id:f.a.id,baseVersion:1,username:f.a.username,displayName:'stale',role:'FARMER',status:'active'}),/CONFLICT/);
  const disabled=f.c.accessSaveAccount_(f.owner,{id:f.a.id,baseVersion:edited.version,username:f.a.username,displayName:'changed',role:'FARMER',status:'disabled',permissions:edited.permissions});assert.throws(()=>f.call(disabled,'bootstrap'),/UNAUTHENTICATED/);
  const reset=f.c.accessOwnPassword_(f.c.accessAccount_(f.principal(f.b)),{credential});assert.throws(()=>f.call(f.b,'bootstrap'),/UNAUTHENTICATED/);assert.ok(f.call(reset,'bootstrap'));
});
test('invalid farms, blank scope, super-admin role and forged principals are rejected',()=>{
  const f=fixture();assert.throws(()=>f.create('bad-scope','FARMER',{farm:'edit',deck:'none',farmIds:['unknown']}),/INVALID_PERMISSIONS/);assert.throws(()=>f.create('empty-scope','FARMER',{farm:'edit',deck:'none',farmIds:[]}),/농가/);assert.throws(()=>f.create('super-user','SUPER_ADMIN'),/INVALID_ACCOUNT/);
  assert.throws(()=>f.c.accessDispatch_({accountId:f.a.id,version:99,role:'SUPER_ADMIN'},'bootstrap',{}),/UNAUTHENTICATED/);
});
test('auth tickets are single-use, version-bound, disabled-safe and login attempts are bounded across instances',()=>{
  const f=fixture(),begin=()=>f.c.accessAuthBegin_({username:f.a.username,ipKey:'f'.repeat(64)});
  const attempt=begin();assert.equal(f.c.accessAuthFinish_({ticket:attempt.ticket,verified:true}).id,f.a.id);assert.throws(()=>f.c.accessAuthFinish_({ticket:attempt.ticket,verified:true}),/LOGIN_INVALID/);
  const pending=begin();f.c.accessOwnPassword_(f.c.accessAccount_(f.principal(f.a)),{credential});assert.throws(()=>f.c.accessAuthFinish_({ticket:pending.ticket,verified:true}),/LOGIN_INVALID/);
  for(let i=0;i<6;i++)begin();assert.throws(begin,/LOGIN_THROTTLED/);
  // Durable sheet rows remain effective even if the Apps Script cache is evicted.
  f.cache.clear();assert.throws(begin,/LOGIN_THROTTLED/);
});
test('signed dispatcher rejects modified signatures, nonce replay and stale principals without reaching data writers',()=>{
  const f=fixture(),p={actor:f.principal(f.a),action:'saveSubmission',payload:{id:'sa'},nonce:'b'.repeat(32)};
  assert.equal(f.post(p,'wrong').ok,false);assert.equal(f.calls.length,0);
  assert.equal(f.post(p).ok,true);assert.equal(f.calls.length,1);assert.equal(f.post(p).ok,false);assert.equal(f.calls.length,1);
  const r=f.post({...p,nonce:'c'.repeat(32),actor:{accountId:f.a.id,version:99}});assert.equal(r.error,'UNAUTHENTICATED');assert.equal(f.calls.length,1);
});
test('upload retry cannot disclose media from a farm removed from the account',()=>{
  const f=fixture();f.media[1].request_id='old-request';f.media[1].submitted_by='account:'+f.a.id;
  assert.throws(()=>f.call(f.a,'upload',{submissionId:'sa',requestId:'old-request'}),/FORBIDDEN/);assert.equal(f.calls.length,0);
});
