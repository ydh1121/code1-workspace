/* Add this one file to the EXISTING CODE1 Apps Script project.
 * Install AccessControl.gs, QuestionPolicy.gs, MediaOrganizer.gs, MediaLifecycle.gs and PerformanceRead.gs too.
 * BRIDGE_SECRET: same 32+ character secret as Cloudflare, never committed.
 */
function bridgeReplayGuard_(p){
  withLock_(function(){
    if(cache_().get('bridge:'+p.nonce))throw new Error('FORBIDDEN');
    cache_().put('bridge:'+p.nonce,'1',180);
    staging_();
  });
}
function bridgeReadAction_(action){
  return ['account.self','account.list','bootstrap','getSubmission','media','mediaBatch','deckAssets','deckBootstrap','questionPolicy.effective','questionPolicy.list'].indexOf(action)>=0;
}
function bridgeAuthThrottlePair_(ipKey,username){
  if(!/^[a-f0-9]{64}$/.test(ipKey||''))throw new Error('FORBIDDEN');
  username=String(username||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))throw new Error('LOGIN_INVALID');
  var now=Date.now(),rows=accessRows_('21_WEB_LOGIN_GUARD');
  function bump(key,limit){
    var row=rows.filter(function(r){return String(r.key||'')===key;})[0];
    if(!row){
      var expired=rows.filter(function(r){return Number(r.window_start)<now-900000;})[0];
      row={_row:expired?expired._row:undefined,key:key,window_start:now,attempts:0};
      if(expired)rows=rows.filter(function(r){return r._row!==expired._row;});
      rows.push(row);
    }
    if(now-Number(row.window_start)>=900000){row.window_start=now;row.attempts=0;}
    if(Number(row.attempts)>=limit)throw new Error('LOGIN_THROTTLED');
    row.attempts=Number(row.attempts)+1;accessWrite_('21_WEB_LOGIN_GUARD',row);
  }
  bump('ip:'+ipKey,40);bump('user:'+sha_(username),8);
  return username;
}
function bridgeAuthFast_(p){
  p=p||{};var username=bridgeAuthThrottlePair_(p.ipKey,p.username);
  var a=accessRows_('19_WEB_ACCOUNTS').filter(function(x){return String(x.username||'').toLowerCase()===username;})[0];
  if(!a||a.status!=='active'||['SUPER_ADMIN','ADMIN','FARMER'].indexOf(a.role)<0)return {credential:null,user:null,bootstrap:null};
  if(a.role==='SUPER_ADMIN'&&a.account_id!=='OWNER')throw new Error('FORBIDDEN');
  var credential=a.password_hash?{salt:a.password_salt,hash:a.password_hash,iterations:Number(a.password_iterations),scheme:a.password_scheme}:null;
  var user=accessPublic_(a),bootstrap=null;
  // Password verification still happens only at Cloudflare. The bootstrap bundle may
  // travel to the trusted edge with the credential, but is never returned to the
  // browser unless the password proof succeeds. This removes a second Apps Script
  // execution after successful login when PerformanceRead v5 is installed.
  if(typeof performanceBootstrapAccount_==='function')bootstrap=performanceBootstrapAccount_(a);
  return {credential:credential,user:user,bootstrap:bootstrap};
}
function bridgeAuthAudit_(p){
  p=p||{};var id=String(p.accountId||'').slice(0,120),ok=p.success===true;
  try{accessLog_(ok?id:'',ok?'login.success':'login.failure',id,ok?'아이디 로그인':'');}catch(_){}
  return {logged:true};
}
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
    var payload=p.payload||{};

    // Serialize only replay protection. Long read/Drive operations run without
    // the shared write lock so unrelated reads do not queue behind each other.
    bridgeReplayGuard_(p);

    if(['mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair'].indexOf(p.action)>=0){
      var direct;
      if(p.action==='mediaUpload.begin'){if(typeof mediaUploadBegin_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaUploadBegin_(p.actor,payload);}
      if(p.action==='mediaUpload.chunk'){if(typeof mediaUploadChunk_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaUploadChunk_(p.actor,payload);}
      if(p.action==='mediaUpload.finish'){if(typeof mediaUploadFinish_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaUploadFinish_(p.actor,payload);}
      if(p.action==='deleteMedia'){if(typeof mediaDelete_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaDelete_(p.actor,payload);}
      if(p.action==='mediaOrganizer.status'){if(typeof mediaOrganizerStatus_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaOrganizerStatus_(p.actor);}
      if(p.action==='mediaOrganizer.repair'){if(typeof mediaOrganizerRepair_!=='function')throw new Error('MEDIA_LIFECYCLE_UPDATE_REQUIRED');direct=mediaOrganizerRepair_(p.actor,payload);}
      return bridgeJson_({ok:true,data:direct});
    }

    if(bridgeReadAction_(p.action)){
      var readData;
      if(p.action==='questionPolicy.effective'){
        if(typeof questionPolicyEffective_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        readData=questionPolicyEffective_(p.actor);
      }else if(p.action==='questionPolicy.list'){
        if(typeof questionPolicyList_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        readData=questionPolicyList_(p.actor);
      }else if(p.action==='mediaBatch'){
        if(typeof performanceMediaBatch_!=='function')throw new Error('PERFORMANCE_READ_UPDATE_REQUIRED');
        readData=performanceMediaBatch_(p.actor,payload);
      }else if(p.action==='bootstrap'&&typeof performanceBootstrap_==='function'){
        readData=performanceBootstrap_(p.actor);
      }else if(p.action==='getSubmission'&&typeof performanceGetSubmission_==='function'){
        readData=performanceGetSubmission_(p.actor,payload);
      }else if(p.action==='deckBootstrap'){
        if(typeof performanceDeckBootstrap_!=='function')throw new Error('PERFORMANCE_READ_UPDATE_REQUIRED');
        readData=performanceDeckBootstrap_(p.actor);
      }else if(p.action==='deckAssets'&&typeof performanceDeckAssets_==='function'){
        readData=performanceDeckAssets_(p.actor);
      }else{
        readData=accessDispatch_(p.actor,p.action,payload);
      }
      if(p.action==='getSubmission'&&readData&&Array.isArray(readData.media))readData.media=readData.media.filter(function(m){return String(m.status||'')!=='DELETED';});
      return bridgeJson_({ok:true,data:readData});
    }

    if(p.action==='account.credential'){
      var credentialAccount=accessAccount_(p.actor);
      return bridgeJson_({ok:true,data:credentialAccount.password_hash?{salt:credentialAccount.password_salt,hash:credentialAccount.password_hash,iterations:Number(credentialAccount.password_iterations),scheme:credentialAccount.password_scheme}:null});
    }

    var data=withLock_(function(){
      staging_();
      if(p.action==='identity')return accessGoogle_(p.email);
      if(p.action==='auth.fast')return bridgeAuthFast_(payload);
      if(p.action==='auth.audit')return bridgeAuthAudit_(payload);
      if(p.action==='auth.begin')return accessAuthBegin_(payload);
      if(p.action==='auth.finish')return accessAuthFinish_(payload);
      if(p.action==='questionPolicy.save'){
        if(typeof questionPolicySave_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        return questionPolicySave_(p.actor,payload);
      }
      return accessDispatch_(p.actor,p.action,payload);
    });

    // PerformanceRead v4+ no longer keeps an eager deck read cache. Keep this call
    // compatible with older installations without making the cache mandatory.
    if(p.action==='saveDeck'&&typeof performanceDeckCacheInvalidate_==='function')performanceDeckCacheInvalidate_();

    // Existing Media.gs remains authoritative for the small-file upload itself.
    if(p.action==='upload'&&data&&data.upload_id&&payload.kind==='FARM'){
      data.organization=typeof mediaOrganizeUploaded_==='function'?mediaOrganizeUploaded_(p.actor,data.upload_id):{organized:false,error:'MEDIA_ORGANIZER_NOT_INSTALLED'};
    }
    return bridgeJson_({ok:true,data:data});
  }catch(error){
    var message=String(error.message||'REQUEST_FAILED');
    if(/Exception|GCP|API\(drive\)/.test(message))message='파일 저장소 연결을 확인해 주세요. 관리자의 Google Drive API 설정이 필요할 수 있습니다.';
    return bridgeJson_({ok:false,error:message.slice(0,300)});
  }
}
function bridgeJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
