/* CODE1 question visibility policy overlay.
 * Install this file in the EXISTING Apps Script project beside AccessControl.gs.
 * The catalog remains canonical in 13_WEB_질문카탈로그; policies never delete answers or catalog rows.
 */
var QUESTION_POLICY_SCHEMA_ = {
  '22_WEB_질문정책': ['policy_id','scope','farm_id','item_key','mode','reason_code','reason_note','version','status','updated_by','updated_at','request_id'],
  '23_WEB_질문정책_이력': ['at','actor_id','policy_id','scope','farm_id','item_key','before_mode','after_mode','reason_code','reason_note','version','request_id','before_json','after_json']
};
var QUESTION_POLICY_REASONS_ = [
  {code:'DUPLICATE',label:'다른 항목에서 중복 확인 가능'},
  {code:'DERIVED',label:'다른 자료로 산출·확인 가능'},
  {code:'NOT_APPLICABLE',label:'해당 농가·상품에는 적용되지 않음'},
  {code:'LATER_PHASE',label:'초기 입점 단계에는 불필요'},
  {code:'COLLECT_LATER',label:'운영 이후 수집하는 편이 적절함'},
  {code:'SENSITIVE',label:'민감정보라 별도 경로로 수집'},
  {code:'LOW_VALUE',label:'운영 활용도가 낮음'},
  {code:'OTHER',label:'기타'}
];
function questionPolicyRows_(name){
  var h=QUESTION_POLICY_SCHEMA_[name];if(!h)throw new Error('FORBIDDEN');
  var s=db_().getSheetByName(name);if(!s)throw new Error('QUESTION_POLICY_SETUP_REQUIRED');
  if(JSON.stringify(s.getRange(1,1,1,h.length).getValues()[0])!==JSON.stringify(h))throw new Error('QUESTION_POLICY_SCHEMA_MISMATCH');
  if(s.getLastRow()<2)return [];
  return s.getRange(2,1,s.getLastRow()-1,h.length).getValues().map(function(row,i){var o={_row:i+2};h.forEach(function(k,j){o[k]=row[j];});return o;}).filter(function(o){return o[h[0]]!=='';});
}
function questionPolicyEnsure_(){
  staging_();Object.keys(QUESTION_POLICY_SCHEMA_).forEach(function(name){
    var h=QUESTION_POLICY_SCHEMA_[name],s=db_().getSheetByName(name);
    if(!s)s=db_().insertSheet(name);
    if(s.getLastRow()===0){if(s.getMaxColumns()<h.length)s.insertColumnsAfter(s.getMaxColumns(),h.length-s.getMaxColumns());s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);}
    questionPolicyRows_(name);
  });
}
function questionPolicyWrite_(name,row){
  staging_();var h=QUESTION_POLICY_SCHEMA_[name],s=sheet_(name),n=row._row||s.getLastRow()+1;
  if(n>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),Math.max(200,n-s.getMaxRows()));
  s.getRange(n,1,1,h.length).setValues([h.map(function(k){return cell_(row[k]);})]);row._row=n;
}
function questionPolicyAppendHistory_(rows){
  if(!rows.length)return;var h=QUESTION_POLICY_SCHEMA_['23_WEB_질문정책_이력'],s=sheet_('23_WEB_질문정책_이력'),start=s.getLastRow()+1;
  if(start+rows.length-1>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),Math.max(500,start+rows.length-1-s.getMaxRows()));
  s.getRange(start,1,rows.length,h.length).setValues(rows.map(function(row){return h.map(function(k){return cell_(row[k]);});}));
}
function questionPolicyPublic_(r){return {id:r.policy_id,scope:r.scope,farmId:r.farm_id||'',itemKey:r.item_key,mode:r.mode,reasonCode:r.reason_code||'',reasonNote:r.reason_note||'',version:Number(r.version)||0,updatedBy:r.updated_by||'',updatedAt:r.updated_at||''};}
function questionPolicyEffectivePublic_(r){return {scope:r.scope,farmId:r.farm_id||'',itemKey:r.item_key,mode:r.mode,version:Number(r.version)||0};}
function questionPolicyKey_(scope,farmId,itemKey){return scope+'|'+(farmId||'')+'|'+itemKey;}
function questionPolicyReasonKnown_(code){return QUESTION_POLICY_REASONS_.some(function(x){return x.code===code;});}
function questionPolicyCatalogMap_(){var out={};catalog_().forEach(function(q){if(q.active!==false&&String(q.active).toUpperCase()!=='FALSE')out[q.item_key]=q;});return out;}
function questionPolicyFarmMap_(){var out={};accessFarmChoices_().forEach(function(f){out[f.id]=f;});return out;}
function questionPolicyEffective_(principal){
  var actor=accessAccount_(principal),permissions=accessPermissions_(actor);questionPolicyEnsure_();
  var allowed=permissions.allFarms?null:permissions.farmIds;
  return questionPolicyRows_('22_WEB_질문정책').filter(function(r){return r.status==='active'&&(r.scope==='GLOBAL'||(r.scope==='FARM'&&(allowed===null||allowed.indexOf(r.farm_id)>=0)));}).map(questionPolicyEffectivePublic_);
}
function questionPolicyList_(principal){
  var actor=accessAccount_(principal);if(!accessAdmin_(actor))throw new Error('FORBIDDEN');questionPolicyEnsure_();
  return {policies:questionPolicyRows_('22_WEB_질문정책').filter(function(r){return r.status==='active';}).map(questionPolicyPublic_),reasons:QUESTION_POLICY_REASONS_,farms:accessFarmChoices_(),catalog:catalog_()};
}
function questionPolicySave_(principal,p){
  var actor=accessAccount_(principal);if(!accessAdmin_(actor))throw new Error('FORBIDDEN');questionPolicyEnsure_();
  if(!p||!Array.isArray(p.changes)||!p.changes.length||p.changes.length>300||!/^[a-f0-9]{32}$/.test(String(p.requestId||'')))throw new Error('INVALID_POLICY_REQUEST');
  var catalog=questionPolicyCatalogMap_(),farms=questionPolicyFarmMap_(),rows=questionPolicyRows_('22_WEB_질문정책'),byKey={},seen={};
  rows.forEach(function(r){if(r.status==='active')byKey[questionPolicyKey_(r.scope,r.farm_id,r.item_key)]=r;});
  var now=new Date().toISOString(),history=[],changed=[];
  p.changes.forEach(function(c){
    var scope=String(c.scope||''),farmId=String(c.farmId||''),itemKey=String(c.itemKey||''),mode=String(c.mode||''),reasonCode=String(c.reasonCode||''),reasonNote=String(c.reasonNote||'').trim();
    if(scope!=='GLOBAL'&&scope!=='FARM')throw new Error('INVALID_POLICY_SCOPE');if(!catalog[itemKey])throw new Error('INVALID_POLICY_ITEM');
    if(scope==='GLOBAL'){farmId='';if(['SHOW','OPTIONAL','HIDE','PERMANENT_EXCLUDE'].indexOf(mode)<0)throw new Error('INVALID_POLICY_MODE');}
    else{if(!farms[farmId])throw new Error('INVALID_POLICY_FARM');if(['INHERIT','SHOW','OPTIONAL','HIDE','NOT_APPLICABLE'].indexOf(mode)<0)throw new Error('INVALID_POLICY_MODE');}
    var needsReason=['OPTIONAL','HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE'].indexOf(mode)>=0;
    if(needsReason&&(!questionPolicyReasonKnown_(reasonCode)||!reasonNote))throw new Error('수집 정책 사유와 운영 메모를 입력해 주세요.');
    if(!needsReason){reasonCode='';reasonNote='';}
    if(reasonNote.length>500)throw new Error('수집 정책 메모는 500자 이하로 입력해 주세요.');
    var key=questionPolicyKey_(scope,farmId,itemKey);if(seen[key])throw new Error('DUPLICATE_POLICY_ITEM');seen[key]=true;
    var old=byKey[key]||null,base=Number(c.baseVersion||0);if((old?Number(old.version):0)!==base)throw new Error('CONFLICT');
    var next=Object.assign({},old||{policy_id:'QP_'+random_().slice(0,24)},{scope:scope,farm_id:farmId,item_key:itemKey,mode:mode,reason_code:reasonCode,reason_note:reasonNote,version:(old?Number(old.version):0)+1,status:'active',updated_by:actor.account_id,updated_at:now,request_id:p.requestId});
    questionPolicyWrite_('22_WEB_질문정책',next);byKey[key]=next;changed.push(questionPolicyPublic_(next));
    history.push({at:now,actor_id:actor.account_id,policy_id:next.policy_id,scope:scope,farm_id:farmId,item_key:itemKey,before_mode:old?old.mode:'',after_mode:mode,reason_code:reasonCode,reason_note:reasonNote,version:next.version,request_id:p.requestId,before_json:old?JSON.stringify(questionPolicyPublic_(old)):'',after_json:JSON.stringify(questionPolicyPublic_(next))});
  });
  questionPolicyAppendHistory_(history);
  if(typeof accessLog_==='function')accessLog_(actor.account_id,'question-policy.save','',changed.length+'개 입력 항목 정책 변경');
  return {saved:changed,policies:questionPolicyRows_('22_WEB_질문정책').filter(function(r){return r.status==='active';}).map(questionPolicyPublic_)};
}
