/* CODE1 temporary-workspace read optimizations.
 * Install beside CloudflareBridge.gs in the EXISTING Apps Script project.
 * This file is intentionally temporary infrastructure and can be replaced when
 * the workspace moves to the future production admin server.
 */
var PERFORMANCE_READ_VERSION_ = 2;
var PERFORMANCE_MEDIA_BATCH_MAX_ = 32;
var PERFORMANCE_DECK_CACHE_KEY_ = 'perf:deck:v2';
var PERFORMANCE_DECK_CACHE_SECONDS_ = 300;
var PERFORMANCE_CACHE_CHUNK_ = 70000;
var PERFORMANCE_CACHE_MAX_CHUNKS_ = 12;

function performanceCache_(){return cache_();}
function performanceCacheReadLarge_(key){
  try{
    var cache=performanceCache_(),meta=cache.get(key+':meta');if(!meta)return null;
    var count=Number(meta);if(!Number.isInteger(count)||count<1||count>PERFORMANCE_CACHE_MAX_CHUNKS_)return null;
    var parts=[];for(var i=0;i<count;i++){var part=cache.get(key+':'+i);if(part===null)return null;parts.push(part);}
    return JSON.parse(parts.join(''));
  }catch(_){return null;}
}
function performanceCacheWriteLarge_(key,value,seconds){
  try{
    var text=JSON.stringify(value),count=Math.ceil(text.length/PERFORMANCE_CACHE_CHUNK_);if(count<1||count>PERFORMANCE_CACHE_MAX_CHUNKS_)return false;
    var cache=performanceCache_();
    for(var i=0;i<count;i++)cache.put(key+':'+i,text.slice(i*PERFORMANCE_CACHE_CHUNK_,(i+1)*PERFORMANCE_CACHE_CHUNK_),seconds);
    cache.put(key+':meta',String(count),seconds);return true;
  }catch(_){return false;}
}
function performanceCacheRemoveLarge_(key){
  try{
    var cache=performanceCache_(),meta=Number(cache.get(key+':meta')||0);cache.remove(key+':meta');
    for(var i=0;i<Math.min(meta||PERFORMANCE_CACHE_MAX_CHUNKS_,PERFORMANCE_CACHE_MAX_CHUNKS_);i++)cache.remove(key+':'+i);
  }catch(_){ }
}
function performanceDeckCacheInvalidate_(){performanceCacheRemoveLarge_(PERFORMANCE_DECK_CACHE_KEY_);}
function performanceDeckLoad_(){
  var cached=performanceCacheReadLarge_(PERFORMANCE_DECK_CACHE_KEY_);if(cached)return cached;
  var deck=loadDeck_();performanceCacheWriteLarge_(PERFORMANCE_DECK_CACHE_KEY_,deck,PERFORMANCE_DECK_CACHE_SECONDS_);return deck;
}
function performanceBootstrap_(principal){
  var a=accessAccount_(principal),permissions=accessPermissions_(a),u={email:a.email||'account:'+a.account_id,role:'OWNER'};
  var list=permissions.farm==='none'?[]:listSubmissions_(u).filter(function(c){return permissions.allFarms||permissions.farmIds.indexOf(c.farmId)>=0;});
  if(!accessAdmin_(a))list.forEach(function(c){delete c.by;});
  return {
    user:accessPublic_(a),permissions:permissions,canEditDeck:permissions.deck==='edit',
    catalog:permissions.farm==='none'?[]:catalog_(),
    farms:permissions.farm==='none'?[]:accessFarmChoices_().filter(function(f){return permissions.allFarms||permissions.farmIds.indexOf(f.id)>=0;}),
    submissions:list,deck:permissions.deck==='none'?null:performanceDeckLoad_(),settings:null
  };
}
function performanceDeckAssets_(principal){
  var a=accessAccount_(principal);accessPage_(a,'deck',false);var u={email:a.email||'account:'+a.account_id,role:'OWNER'},out={};
  Array.from(deckReferences_(performanceDeckLoad_())).forEach(function(id){
    try{accessMediaRow_(a,id,false);out[id]=media_(u,id);if(!accessAdmin_(a)){delete out[id].source;delete out[id].note;}}
    catch(_){out[id]={error:'이미지를 불러올 수 없습니다.'};}
  });
  return out;
}
function performanceMediaBatch_(principal,p) {
  p=p||{};
  var a=accessAccount_(principal),ids=Array.isArray(p.ids)?p.ids:[];
  if(!ids.length||ids.length>PERFORMANCE_MEDIA_BATCH_MAX_)throw new Error('INVALID_REQUEST');
  var seen={},clean=[];
  ids.forEach(function(value){
    var id=String(value||'').trim();
    if(id&&!seen[id]){seen[id]=true;clean.push(id);}
  });
  if(!clean.length)throw new Error('INVALID_REQUEST');
  var u={email:a.email||'account:'+a.account_id,role:'OWNER'},out={};
  clean.forEach(function(id){
    try{
      accessMediaRow_(a,id,false);
      var item=media_(u,id);
      if(!accessAdmin_(a)){delete item.source;delete item.note;}
      out[id]=item;
    }catch(_){
      out[id]={error:'이미지를 불러올 수 없습니다.'};
    }
  });
  return out;
}
