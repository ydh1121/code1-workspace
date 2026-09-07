/* Add this one file to the EXISTING CODE1 Apps Script project.
 * Existing server, seeds, assets and Sheets remain in place. No installer runs.
 * BRIDGE_SECRET: same 32+ character secret as Cloudflare, never committed.
 */
function doPost(e) {
  var token = null;
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
    // Claim nonce under the same script lock used by existing writers.
    withLock_(function(){if(cache_().get('bridge:'+p.nonce))throw new Error('FORBIDDEN');cache_().put('bridge:'+p.nonce,'1',180);});
    var role=role_(p.email);staging_();
    if(p.action==='identity')return bridgeJson_({ok:true,data:{email:p.email,role:role}});
    if(['bootstrap','saveSubmission','getSubmission','review','upload','linkDrive','reviewMedia','media','deckAssets','saveDeck','settings'].indexOf(p.action)<0)throw new Error('UNKNOWN_ACTION');
    token=random_();cache_().put('session:'+sha_(token),JSON.stringify({email:p.email,sub:'cloudflare',expires:Date.now()+90000}),90);
    var payload=p.payload||{};
    // Internal deck images never ask for a rights declaration.
    if((p.action==='upload'||p.action==='linkDrive')&&payload.kind==='DECK'){
      payload.metadata=payload.metadata||{};
      payload.metadata.rights_owner='CODE1 내부 작업본 · 확인 전';
      payload.metadata.b2b_use='미확인';
    }
    return bridgeJson_({ok:true,data:api(token,p.action,payload)});
  }catch(error){
    var message=String(error.message||'REQUEST_FAILED');
    if(/Exception|GCP|API\(drive\)/.test(message))message='파일 저장소 연결을 확인해 주세요. 관리자의 Google Drive API 설정이 필요할 수 있습니다.';
    return bridgeJson_({ok:false,error:message.slice(0,300)});
  }finally{if(token)cache_().remove('session:'+sha_(token));}
}
function bridgeJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
