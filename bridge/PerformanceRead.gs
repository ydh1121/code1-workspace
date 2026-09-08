/* CODE1 temporary-workspace read optimizations.
 * Install beside CloudflareBridge.gs in the EXISTING Apps Script project.
 * This file is intentionally temporary infrastructure and can be replaced when
 * the workspace moves to the future production admin server.
 */
var PERFORMANCE_READ_VERSION_ = 4;
var PERFORMANCE_MEDIA_BATCH_MAX_ = 32;

function performanceDeckCacheInvalidate_(){/* v4: no eager deck cache */}
function performanceCatalogCacheInvalidate_(){/* v4: no catalog cache */}

function performanceFarmChoices_(summaries){
  var map={};
  farms_().forEach(function(f){if(f&&f.id)map[f.id]={id:f.id,name:f.name};});
  (summaries||[]).forEach(function(s){if(s&&s.farmId&&!map[s.farmId])map[s.farmId]={id:s.farmId,name:s.name||s.farmName||s.farmId};});
  return Object.keys(map).map(function(k){return map[k];});
}
function performancePolicyBundle_(a,permissions,farms){
  var out={records:[],reasons:[],ready:false,prefetched:false};
  if(permissions.farm==='none'||typeof questionPolicyRows_!=='function')return out;
  try{
    var rows=questionPolicyRows_('22_WEB_질문정책').filter(function(r){return r.status==='active';});
    if(accessAdmin_(a)){
      out.records=rows.map(questionPolicyPublic_);
      out.reasons=typeof QUESTION_POLICY_REASONS_!=='undefined'?QUESTION_POLICY_REASONS_:[];
      out.prefetched=true;
    }else{
      var allowed=permissions.farmIds;
      out.records=rows.filter(function(r){return r.scope==='GLOBAL'||(r.scope==='FARM'&&allowed.indexOf(r.farm_id)>=0);}).map(questionPolicyEffectivePublic_);
    }
    out.ready=true;
  }catch(_){ }
  return out;
}
function performanceBootstrap_(principal){
  var started=Date.now(),a=accessAccount_(principal),permissions=accessPermissions_(a),u={email:a.email||'account:'+a.account_id,role:'OWNER'};
  var list=[],catalog=[],farms=[];
  if(permissions.farm!=='none'){
    list=listSubmissions_(u).filter(function(c){return permissions.allFarms||permissions.farmIds.indexOf(c.farmId)>=0;});
    if(!accessAdmin_(a))list.forEach(function(c){delete c.by;});
    farms=performanceFarmChoices_(list).filter(function(f){return permissions.allFarms||permissions.farmIds.indexOf(f.id)>=0;});
    catalog=catalog_();
  }
  var policy=performancePolicyBundle_(a,permissions,farms);
  return {
    user:accessPublic_(a),permissions:permissions,canEditDeck:permissions.deck==='edit',
    catalog:catalog,farms:farms,submissions:list,
    // Deck data is intentionally absent from initial farm/account bootstrap.
    deck:null,settings:null,
    questionPolicies:policy.records,questionPolicyReasons:policy.reasons,
    questionPolicyReady:policy.ready,questionPolicyPrefetched:policy.prefetched,
    performance:{version:PERFORMANCE_READ_VERSION_,bootstrapMs:Date.now()-started}
  };
}
function performanceGetSubmission_(principal,p){
  p=p||{};var a=accessAccount_(principal),u={email:a.email||'account:'+a.account_id,role:'OWNER'};
  var sub=getSubmission_(u,p.id);if(!sub||!sub.id)throw new Error('FORBIDDEN');
  accessFarm_(a,sub.farmId,false);
  sub.media=(sub.media||[]).filter(function(m){return String(m.status||'')!=='DELETED';}).map(function(m){return accessMediaPublic_(a,m);});
  return sub;
}
function performanceDeckBootstrap_(principal){
  var a=accessAccount_(principal);accessPage_(a,'deck',false);var u={email:a.email||'account:'+a.account_id,role:'OWNER'},deck=loadDeck_(),assets={};
  Array.from(deckReferences_(deck)).forEach(function(id){
    try{accessMediaRow_(a,id,false);assets[id]=media_(u,id);if(!accessAdmin_(a)){delete assets[id].source;delete assets[id].note;}}
    catch(_){assets[id]={error:'이미지를 불러올 수 없습니다.'};}
  });
  return {deck:deck,assets:assets,canEditDeck:accessPermissions_(a).deck==='edit'};
}
function performanceDeckAssets_(principal){return performanceDeckBootstrap_(principal).assets;}
function performanceMediaBatch_(principal,p) {
  p=p||{};
  var a=accessAccount_(principal),ids=Array.isArray(p.ids)?p.ids:[];
  if(!ids.length||ids.length>PERFORMANCE_MEDIA_BATCH_MAX_)throw new Error('INVALID_REQUEST');
  var seen={},clean=[];
  ids.forEach(function(value){var id=String(value||'').trim();if(id&&!seen[id]){seen[id]=true;clean.push(id);}});
  if(!clean.length)throw new Error('INVALID_REQUEST');
  var u={email:a.email||'account:'+a.account_id,role:'OWNER'},out={};
  clean.forEach(function(id){
    try{accessMediaRow_(a,id,false);var item=media_(u,id);if(!accessAdmin_(a)){delete item.source;delete item.note;}out[id]=item;}
    catch(_){out[id]={error:'이미지를 불러올 수 없습니다.'};}
  });
  return out;
}
