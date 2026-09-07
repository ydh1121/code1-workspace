/* CODE1-only account storage and authorization. Install alongside CloudflareBridge.
 * No reference-project accounts or canonical farm rows are copied or changed.
 * All entry points are private; only the signed Cloudflare dispatcher calls them.
 */
var ACCESS_SCHEMA_ = {
  '19_WEB_ACCOUNTS': ['account_id','username','display_name','email','role','status','permissions_json','password_salt','password_hash','password_iterations','password_scheme','session_version','created_at','updated_at'],
  '20_WEB_ACCESS_LOG': ['at','actor_id','action','target_id','detail'],
  '21_WEB_LOGIN_GUARD': ['key','window_start','attempts']
};
function accessRows_(name) {
  if (!Object.prototype.hasOwnProperty.call(ACCESS_SCHEMA_,name)) throw new Error('FORBIDDEN');
  var s=db_().getSheetByName(name); if(!s)throw new Error('AUTH_SETUP_REQUIRED');
  var h=ACCESS_SCHEMA_[name];
  if(JSON.stringify(s.getRange(1,1,1,h.length).getValues()[0])!==JSON.stringify(h))throw new Error('ACCOUNT_SCHEMA_MISMATCH');
  return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,h.length).getValues().map(function(row,i){
    var o={_row:i+2};h.forEach(function(k,j){o[k]=row[j];});return o;
  }).filter(function(o){return o[h[0]]!=='';});
}
function accessWrite_(name,row) {
  staging_();var h=ACCESS_SCHEMA_[name];if(!h)throw new Error('FORBIDDEN');
  var s=sheet_(name),n=row._row||s.getLastRow()+1;
  if(n>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),200);
  s.getRange(n,1,1,h.length).setValues([h.map(function(k){return cell_(row[k]);})]);
  row._row=n;
}
function accessLog_(actor,action,target,detail) {
  // Credentials, cookies and request payloads never enter this log.
  accessWrite_('20_WEB_ACCESS_LOG',{at:new Date().toISOString(),actor_id:actor||'',action:action,target_id:target||'',detail:detail||''});
}
function accessInstall_(email) {
  if(email!==CODE1_OWNER_)throw new Error('FORBIDDEN');
  staging_();
  Object.keys(ACCESS_SCHEMA_).forEach(function(name){
    var s=db_().getSheetByName(name),h=ACCESS_SCHEMA_[name];
    if(!s)s=db_().insertSheet(name);
    if(s.getLastRow()===0){if(s.getMaxColumns()<h.length)s.insertColumnsAfter(s.getMaxColumns(),h.length-s.getMaxColumns());s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);}
    accessRows_(name); // Existing, conflicting headers fail closed.
  });
  var rows=accessRows_('19_WEB_ACCOUNTS'),owner=rows.filter(function(a){return a.account_id==='OWNER';})[0];
  if(!owner){
    if(rows.length)throw new Error('OWNER_ACCOUNT_MISSING');
    var now=new Date().toISOString();
    accessWrite_('19_WEB_ACCOUNTS',{account_id:'OWNER',username:'owner',display_name:'최고 관리자',email:CODE1_OWNER_,role:'SUPER_ADMIN',status:'active',permissions_json:'{}',session_version:1,created_at:now,updated_at:now});
    accessLog_('OWNER','account.initialize','OWNER','Google 소유자 확인 후 최초 계정 생성');
  }
  // Retire the former second-email path, including old GAS UI deployments.
  // Owner recovery stays available; only the two legacy access settings change.
  var settingsSheet=sheet_('14_WEB_설정'),legacy=settingsSheet.getDataRange().getValues();
  legacy.forEach(function(r,i){if(r[0]==='ALLOWED_USER_2'&&r[1]!=='')settingsSheet.getRange(i+1,2).setValue('');if(r[0]==='CONTRIBUTOR_DECK_EDIT'&&r[1]!=='FALSE')settingsSheet.getRange(i+1,2).setValue('FALSE');});
}
function accessAdmin_(a){return a.role==='SUPER_ADMIN'||a.role==='ADMIN';}
function accessPermissions_(a) {
  if(accessAdmin_(a))return {farm:'edit',deck:'edit',farmIds:[],allFarms:true,accounts:true,review:true};
  var p;try{p=JSON.parse(a.permissions_json);}catch(_){throw new Error('FORBIDDEN');}
  if(!p||['none','view','edit'].indexOf(p.farm)<0||['none','view','edit'].indexOf(p.deck)<0||!Array.isArray(p.farmIds))throw new Error('FORBIDDEN');
  return {farm:p.farm,deck:p.deck,farmIds:p.farmIds,allFarms:false,accounts:false,review:false};
}
function accessPublic_(a) {
  return {id:a.account_id,username:a.username,displayName:a.display_name,email:a.email||'',role:a.role,status:a.status,permissions:accessPermissions_(a),version:Number(a.session_version),hasPassword:!!a.password_hash};
}
function accessAccount_(principal) {
  if(!principal||typeof principal.accountId!=='string')throw new Error('UNAUTHENTICATED');
  var a=accessRows_('19_WEB_ACCOUNTS').filter(function(x){return x.account_id===principal.accountId;})[0];
  if(!a||a.status!=='active'||!['SUPER_ADMIN','ADMIN','FARMER'].includes(a.role)||Number(a.session_version)!==principal.version)throw new Error('UNAUTHENTICATED');
  if(a.role==='SUPER_ADMIN'&&(a.account_id!=='OWNER'||a.email!==CODE1_OWNER_))throw new Error('FORBIDDEN');
  return a;
}
function accessGoogle_(email) {
  // Google remains a recovery/first-setup entry for the verified owner only.
  if(email!==CODE1_OWNER_)throw new Error('FORBIDDEN');
  accessInstall_(email);
  var a=accessRows_('19_WEB_ACCOUNTS').filter(function(x){return x.account_id==='OWNER';})[0];
  if(a.email!==email||a.role!=='SUPER_ADMIN'||a.status!=='active')throw new Error('FORBIDDEN');
  return accessPublic_(a);
}
function accessFarmChoices_() {
  var map={};farms_().forEach(function(f){map[f.id]=f;});
  commits_().forEach(function(c){if(c.farm_id&&!map[c.farm_id])map[c.farm_id]={id:c.farm_id,name:c.farm_name};});
  return Object.keys(map).map(function(k){return map[k];});
}
function accessPage_(a,page,edit) {
  var p=accessPermissions_(a),level=p[page];
  if(level!=='edit'&&(edit||level!=='view'))throw new Error('FORBIDDEN');
}
function accessFarm_(a,id,edit) {
  accessPage_(a,'farm',edit);
  if(!accessAdmin_(a)&&accessPermissions_(a).farmIds.indexOf(id)<0)throw new Error('FORBIDDEN');
}
function accessSubmission_(a,id,edit) {
  var c=latest_(id_(id));if(!c)throw new Error('FORBIDDEN');accessFarm_(a,c.farm_id,edit);return c;
}
function accessMediaRow_(a,id,edit) {
  if(Object.prototype.hasOwnProperty.call(SEED_ASSETS_,id)){accessPage_(a,'deck',edit);return;}
  var m=latestMedia_().filter(function(x){return x.upload_id===id;})[0];if(!m)throw new Error('FORBIDDEN');
  if(m.submission_id==='DECK')accessPage_(a,'deck',edit);else accessSubmission_(a,m.submission_id,edit);
  return m;
}
function accessMediaPublic_(a,m) {
  if(accessAdmin_(a))return m;
  var out={};['upload_id','media_id','submission_id','farm_id','farm_name','shot_code','shot_label','file_name','mime_type','file_size_bytes','status','caption','taken_at','photographer','rights_owner','face_present','face_consent','privacy_checked','b2b_use'].forEach(function(k){if(m[k]!==undefined)out[k]=m[k];});return out;
}
function accessDispatch_(principal,action,p) {
  var a=accessAccount_(principal),permissions=accessPermissions_(a);
  // Reuse existing staging writers only AFTER checking the fresh account policy.
  var u={email:a.email||'account:'+a.account_id,role:'OWNER'};
  if(action==='account.self')return accessPublic_(a);
  if(action==='account.list'){
    if(!accessAdmin_(a))throw new Error('FORBIDDEN');
    return {accounts:accessRows_('19_WEB_ACCOUNTS').map(accessPublic_),farms:accessFarmChoices_()};
  }
  if(action==='account.save')return accessSaveAccount_(a,p);
  if(action==='account.password')return accessOwnPassword_(a,p);
  if(action==='bootstrap'){
    var list=permissions.farm==='none'?[]:listSubmissions_(u).filter(function(c){return permissions.allFarms||permissions.farmIds.indexOf(c.farmId)>=0;});
    if(!accessAdmin_(a))list.forEach(function(c){delete c.by;});
    return {user:accessPublic_(a),permissions:permissions,canEditDeck:permissions.deck==='edit',catalog:permissions.farm==='none'?[]:catalog_(),farms:permissions.farm==='none'?[]:accessFarmChoices_().filter(function(f){return permissions.allFarms||permissions.farmIds.indexOf(f.id)>=0;}),submissions:list,deck:permissions.deck==='none'?null:loadDeck_(),settings:null};
  }
  if(action==='getSubmission'){
    accessSubmission_(a,p.id,false);var sub=getSubmission_(u,p.id);sub.media=sub.media.map(function(m){return accessMediaPublic_(a,m);});return sub;
  }
  if(action==='saveSubmission'){
    var prior=latest_(id_(p.id));
    if(prior){accessFarm_(a,prior.farm_id,true);if(p.farmId&&p.farmId!==prior.farm_id)throw new Error('FORBIDDEN');}
    else if(accessAdmin_(a))accessPage_(a,'farm',true);else accessFarm_(a,p.farmId,true);
    return saveSubmission_(u,p);
  }
  if(action==='review') {if(!accessAdmin_(a))throw new Error('FORBIDDEN');accessSubmission_(a,p.id,true);return review_(u,p);}
  if(action==='upload'||action==='linkDrive'){
    if(action==='linkDrive'&&!accessAdmin_(a))throw new Error('FORBIDDEN');
    if(p.kind==='DECK'){accessPage_(a,'deck',true);p.metadata=Object.assign({},p.metadata||{},{rights_owner:'CODE1 내부 작업본 · 확인 전',b2b_use:'미확인'});}
    else accessSubmission_(a,p.submissionId,true);
    var retry=latestMedia_().filter(function(m){return m.request_id===p.requestId&&m.submitted_by===u.email;})[0];
    if(retry)accessMediaRow_(a,retry.upload_id,true);
    return accessMediaPublic_(a,action==='upload'?upload_(u,p):linkDrive_(u,p));
  }
  if(action==='reviewMedia'){if(!accessAdmin_(a))throw new Error('FORBIDDEN');accessMediaRow_(a,p.id,true);return reviewMedia_(u,p);}
  if(action==='media'){accessMediaRow_(a,id_(p.id),false);var media=media_(u,p.id);if(!accessAdmin_(a)){delete media.source;delete media.note;}return media;}
  if(action==='deckAssets'){
    accessPage_(a,'deck',false);var out={};
    Array.from(deckReferences_(loadDeck_())).forEach(function(id){try{accessMediaRow_(a,id,false);out[id]=media_(u,id);if(!accessAdmin_(a)){delete out[id].source;delete out[id].note;}}catch(_){out[id]={error:'이미지를 불러올 수 없습니다.'};}});return out;
  }
  if(action==='saveDeck'){accessPage_(a,'deck',true);return saveDeck_(u,p);}
  throw new Error('UNKNOWN_ACTION');
}
function accessCredential_(c) {
  if(!c||!/^([a-f0-9]{2}){32}$/.test(c.hash||'')||!/^([a-f0-9]{2}){16}$/.test(c.salt||'')||c.iterations!==100000||c.scheme!=='pbkdf2-sha256-pepper-v1')throw new Error('INVALID_CREDENTIAL');
  return c;
}
function accessSaveAccount_(actor,p) {
  if(!accessAdmin_(actor))throw new Error('FORBIDDEN');
  var rows=accessRows_('19_WEB_ACCOUNTS'),old=p.id?rows.filter(function(a){return a.account_id===p.id;})[0]:null;
  if(p.id&&!old)throw new Error('NOT_FOUND');
  if(old&&(old.account_id==='OWNER'||old.account_id===actor.account_id))throw new Error('최고 관리자와 본인 계정은 이 화면에서 변경할 수 없습니다.');
  if(actor.role!=='SUPER_ADMIN'&&((old&&old.role!=='FARMER')||p.role!=='FARMER'))throw new Error('FORBIDDEN');
  if(!['ADMIN','FARMER'].includes(p.role)||!['active','disabled'].includes(p.status))throw new Error('INVALID_ACCOUNT');
  if(old&&Number(old.session_version)!==p.baseVersion)throw new Error('CONFLICT');
  var username=String(p.username||'').trim().toLowerCase(),display=str_(p.displayName,80).trim();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||!display)throw new Error('이름과 3~32자의 영문·숫자 아이디를 입력해 주세요.');
  if(old&&username!==old.username)throw new Error('아이디는 생성 후 변경할 수 없습니다.');
  if(rows.some(function(x){return x.username===username&&(!old||x.account_id!==old.account_id);}))throw new Error('이미 사용 중인 아이디입니다.');
  var permissions={};
  if(p.role==='FARMER'){
    var q=p.permissions||{},known=accessFarmChoices_().map(function(f){return f.id;});
    if(!['none','view','edit'].includes(q.farm)||!['none','view','edit'].includes(q.deck)||!Array.isArray(q.farmIds)||q.farmIds.length>200||q.farmIds.some(function(id){return typeof id!=='string'||known.indexOf(id)<0;}))throw new Error('INVALID_PERMISSIONS');
    permissions={farm:q.farm,deck:q.deck,farmIds:Array.from(new Set(q.farmIds))};
    if(q.farm!=='none'&&!permissions.farmIds.length)throw new Error('이 계정에서 볼 농가를 하나 이상 선택해 주세요.');
  }
  var credential=p.credential?accessCredential_(p.credential):null;
  if(!old&&!credential)throw new Error('새 계정의 비밀번호를 입력해 주세요.');
  var now=new Date().toISOString(),a=Object.assign({},old||{account_id:'U_'+random_().slice(0,24),email:'',created_at:now},{username:username,display_name:display,role:p.role,status:p.status,permissions_json:JSON.stringify(permissions),session_version:old?Number(old.session_version)+1:1,updated_at:now});
  if(credential)Object.assign(a,{password_hash:credential.hash,password_salt:credential.salt,password_iterations:credential.iterations,password_scheme:credential.scheme});
  accessWrite_('19_WEB_ACCOUNTS',a);accessLog_(actor.account_id,old?'account.update':'account.create',a.account_id,JSON.stringify({role:a.role,status:a.status,permissions:permissions,passwordChanged:!!credential}));
  return accessPublic_(a);
}
function accessOwnPassword_(a,p) {
  var c=accessCredential_(p.credential);a.password_hash=c.hash;a.password_salt=c.salt;a.password_iterations=c.iterations;a.password_scheme=c.scheme;a.session_version=Number(a.session_version)+1;a.updated_at=new Date().toISOString();
  accessWrite_('19_WEB_ACCOUNTS',a);accessLog_(a.account_id,'account.password',a.account_id,'본인 비밀번호 변경');return accessPublic_(a);
}
function accessThrottle_(key,limit) {
  var rows=accessRows_('21_WEB_LOGIN_GUARD'),now=Date.now(),row=rows.filter(function(r){return r.key===key;})[0];
  if(!row){var expired=rows.filter(function(r){return Number(r.window_start)<now-900000;})[0];row={_row:expired?expired._row:undefined,key:key,window_start:now,attempts:0};}
  if(now-Number(row.window_start)>=900000){row.window_start=now;row.attempts=0;}
  if(Number(row.attempts)>=limit)throw new Error('LOGIN_THROTTLED');
  row.attempts=Number(row.attempts)+1;accessWrite_('21_WEB_LOGIN_GUARD',row);
}
function accessAuthBegin_(p) {
  if(!/^[a-f0-9]{64}$/.test(p.ipKey||''))throw new Error('FORBIDDEN');
  var username=String(p.username||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))throw new Error('LOGIN_INVALID');
  accessThrottle_('ip:'+p.ipKey,40);accessThrottle_('user:'+sha_(username),8);
  var a=accessRows_('19_WEB_ACCOUNTS').filter(function(x){return x.username===username;})[0],ticket=random_();
  cache_().put('auth-ticket:'+sha_(ticket),JSON.stringify({id:a?a.account_id:'',version:a?Number(a.session_version):0}),180);
  return {ticket:ticket,credential:a&&a.password_hash?{salt:a.password_salt,hash:a.password_hash,iterations:Number(a.password_iterations),scheme:a.password_scheme}:null};
}
function accessAuthFinish_(p) {
  var key='auth-ticket:'+sha_(str_(p.ticket,200)),raw=cache_().get(key);cache_().remove(key);
  if(!raw)throw new Error('LOGIN_INVALID');var t=JSON.parse(raw),a=accessRows_('19_WEB_ACCOUNTS').filter(function(x){return x.account_id===t.id;})[0];
  if(p.verified!==true||!a||a.status!=='active'||Number(a.session_version)!==t.version){accessLog_('', 'login.failure',t.id,'');throw new Error('LOGIN_INVALID');}
  // Reuse the fresh-account role/invariant check before issuing a session.
  accessAccount_({accountId:a.account_id,version:t.version});
  accessLog_(a.account_id,'login.success',a.account_id,'아이디 로그인');
  return accessPublic_(a);
}
