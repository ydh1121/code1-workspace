/* Add this one file to the EXISTING CODE1 Apps Script project.
 * Install AccessControl.gs and QuestionPolicy.gs too.
 * BRIDGE_SECRET: same 32+ character secret as Cloudflare, never committed.
 */
function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET');
    if (!secret || secret.length < 32) throw new Error('SETUP_REQUIRED');
    if (!e || !e.postData || e.postData.contents.length > 13000000) throw new Error('INVALID_REQUEST');
    var envelope = JSON.parse(e.postData.contents);
    if (typeof envelope.body !== 'string' || typeof envelope.signature !== 'string') throw new Error('FORBIDDEN');
    var expected = Utilities.computeHmacSha256Signature(envelope.body, secret, Utilities.Charset.UTF_8).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
    var diff = expected.length ^ envelope.signature.length;
    for(var i=0;i<expected.length;i++) diff |= expected.charCodeAt(i) ^ (envelope.signature.charCodeAt(i)||0);
    if(diff)throw new Error('FORBIDDEN');
    var p=JSON.parse(envelope.body);
    if(!Number.isFinite(p.timestamp)||Math.abs(Date.now()-p.timestamp)>90000||!/^[a-f0-9]{32}$/.test(p.nonce||''))throw new Error('FORBIDDEN');
    if(p.protocol!==2||typeof accessDispatch_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
    var data=withLock_(function(){
      if(cache_().get('bridge:'+p.nonce))throw new Error('FORBIDDEN');cache_().put('bridge:'+p.nonce,'1',180);
      staging_();var payload=p.payload||{};
      if(p.action==='identity')return accessGoogle_(p.email);
      if(p.action==='auth.begin')return accessAuthBegin_(payload);
      if(p.action==='auth.finish')return accessAuthFinish_(payload);
      if(p.action==='account.credential'){
        var a=accessAccount_(p.actor);return a.password_hash?{salt:a.password_salt,hash:a.password_hash,iterations:Number(a.password_iterations),scheme:a.password_scheme}:null;
      }
      if(p.action==='questionPolicy.effective'){
        if(typeof questionPolicyEffective_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        return questionPolicyEffective_(p.actor);
      }
      if(p.action==='questionPolicy.list'){
        if(typeof questionPolicyList_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        return questionPolicyList_(p.actor);
      }
      if(p.action==='questionPolicy.save'){
        if(typeof questionPolicySave_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        return questionPolicySave_(p.actor,payload);
      }
      return accessDispatch_(p.actor,p.action,payload);
    });
    return bridgeJson_({ok:true,data:data});
  }catch(error){
    var message=String(error.message||'REQUEST_FAILED');
    if(/Exception|GCP|API\(drive\)/.test(message))message='파일 저장소 연결을 확인해 주세요. 관리자의 Google Drive API 설정이 필요할 수 있습니다.';
    return bridgeJson_({ok:false,error:message.slice(0,300)});
  }
}
function bridgeJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
