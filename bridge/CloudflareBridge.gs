/* Add this one file to the EXISTING CODE1 Apps Script project.
 * Install AccessControl.gs, QuestionPolicy.gs, MediaOrganizer.gs and MediaLifecycle.gs too.
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
  return ['account.self','account.list','bootstrap','getSubmission','media','deckAssets','questionPolicy.effective','questionPolicy.list'].indexOf(action)>=0;
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

    // Keep replay protection serialized, but release the shared lock before
    // any Drive transfer or read-only Sheet/Drive work. This prevents image
    // reads and bootstrap requests from queueing behind unrelated reads.
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

    // Read-only actions no longer hold the global write lock for their whole
    // execution. Account/session version checks still run inside each action.
    if(bridgeReadAction_(p.action)){
      var readData;
      if(p.action==='questionPolicy.effective'){
        if(typeof questionPolicyEffective_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        readData=questionPolicyEffective_(p.actor);
      }else if(p.action==='questionPolicy.list'){
        if(typeof questionPolicyList_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        readData=questionPolicyList_(p.actor);
      }else{
        readData=accessDispatch_(p.actor,p.action,payload);
      }
      if(p.action==='getSubmission'&&readData&&Array.isArray(readData.media))readData.media=readData.media.filter(function(m){return String(m.status||'')!=='DELETED';});
      return bridgeJson_({ok:true,data:readData});
    }

    // Credential lookup is read-only but participates in the login handshake,
    // so keep it outside the long write lock after the replay guard.
    if(p.action==='account.credential'){
      var credentialAccount=accessAccount_(p.actor);
      return bridgeJson_({ok:true,data:credentialAccount.password_hash?{salt:credentialAccount.password_salt,hash:credentialAccount.password_hash,iterations:Number(credentialAccount.password_iterations),scheme:credentialAccount.password_scheme}:null});
    }

    // Mutations remain serialized to preserve the existing Sheet/Drive write
    // contract and conflict behavior.
    var data=withLock_(function(){
      staging_();
      if(p.action==='identity')return accessGoogle_(p.email);
      if(p.action==='auth.begin')return accessAuthBegin_(payload);
      if(p.action==='auth.finish')return accessAuthFinish_(payload);
      if(p.action==='questionPolicy.save'){
        if(typeof questionPolicySave_!=='function')throw new Error('BRIDGE_UPDATE_REQUIRED');
        return questionPolicySave_(p.actor,payload);
      }
      return accessDispatch_(p.actor,p.action,payload);
    });

    // Existing Media.gs stays authoritative for the small-file upload itself.
    // Organization is a fail-soft post-step, but never silently skipped.
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
