/* CODE1 temporary-workspace read optimizations.
 * Install beside CloudflareBridge.gs in the EXISTING Apps Script project.
 * This file is intentionally read-only and can be replaced when the temporary
 * workspace moves to the future production admin server.
 */
var PERFORMANCE_READ_VERSION_ = 1;
var PERFORMANCE_MEDIA_BATCH_MAX_ = 32;

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
