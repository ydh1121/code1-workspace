/* CODE1 farm media lifecycle.
 * Install beside CloudflareBridge.gs in the EXISTING Apps Script project.
 * Adds resumable original uploads and audited soft deletion without replacing Media.gs.
 */
var MEDIA_LIFECYCLE_VERSION_ = 1;
var MEDIA_UPLOAD_PREFIX_ = 'CODE1_MEDIA_UPLOAD_';
var MEDIA_UPLOAD_MAX_BYTES_ = 250 * 1024 * 1024;
var MEDIA_UPLOAD_MAX_CHUNK_BYTES_ = 4 * 1024 * 1024;
var MEDIA_UPLOAD_TTL_MS_ = 24 * 60 * 60 * 1000;
var MEDIA_LIFECYCLE_LOG_HEADERS_ = ['at','actor_id','upload_id','drive_file_id','farm_id','farm_name','media_type','category','shot_code','shot_label','original_file_name','stored_file_name','folder_path','status','detail','version'];

function mediaLifecycleExt_(name) {
  var m=String(name||'').toLowerCase().match(/\.([a-z0-9]{1,8})$/);return m?m[1]:'';
}
function mediaLifecycleAllowed_(name,mime) {
  var ext=mediaLifecycleExt_(name),allowed=['jpg','jpeg','png','webp','heic','heif','tif','tiff','dng','cr2','cr3','nef','arw','raf','rw2','orf','pef','pdf','mp4','mov'];
  if(allowed.indexOf(ext)>=0)return true;
  var m=String(mime||'').toLowerCase();return /^image\//.test(m)||m==='application/pdf'||m==='video/mp4'||m==='video/quicktime';
}
function mediaLifecycleMime_(name,mime) {
  if(mime)return String(mime).slice(0,120);
  var ext=mediaLifecycleExt_(name),map={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',tif:'image/tiff',tiff:'image/tiff',dng:'image/x-adobe-dng',cr2:'image/x-canon-cr2',cr3:'image/x-canon-cr3',nef:'image/x-nikon-nef',arw:'image/x-sony-arw',raf:'image/x-fuji-raf',rw2:'image/x-panasonic-rw2',orf:'image/x-olympus-orf',pef:'image/x-pentax-pef',pdf:'application/pdf',mp4:'video/mp4',mov:'video/quicktime'};
  return map[ext]||'application/octet-stream';
}
function mediaLifecycleFileName_(name) {
  var s=String(name||'original').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim();if(s.length>180)s=s.slice(0,180);return s||'original';
}
function mediaLifecycleRootId_() {
  if(typeof mediaOrganizerSetting_==='function')return mediaOrganizerSetting_('MEDIA_ROOT_FOLDER_ID');
  var s=db_().getSheetByName('14_WEB_설정');if(!s)throw new Error('MEDIA_ROOT_FOLDER_ID_MISSING');
  var rows=s.getDataRange().getValues();for(var i=0;i<rows.length;i++)if(String(rows[i][0]||'').trim()==='MEDIA_ROOT_FOLDER_ID')return String(rows[i][1]||'').trim();
  throw new Error('MEDIA_ROOT_FOLDER_ID_MISSING');
}
function mediaLifecycleSessionKey_(id){return MEDIA_UPLOAD_PREFIX_+String(id||'');}
function mediaLifecycleLoadSession_(id) {
  var raw=PropertiesService.getScriptProperties().getProperty(mediaLifecycleSessionKey_(id));if(!raw)throw new Error('UPLOAD_SESSION_EXPIRED');
  var s=JSON.parse(raw);if(!s.createdAt||Date.now()-Number(s.createdAt)>MEDIA_UPLOAD_TTL_MS_){PropertiesService.getScriptProperties().deleteProperty(mediaLifecycleSessionKey_(id));throw new Error('UPLOAD_SESSION_EXPIRED');}
  return s;
}
function mediaLifecycleSaveSession_(s){PropertiesService.getScriptProperties().setProperty(mediaLifecycleSessionKey_(s.id),JSON.stringify(s));}
function mediaLifecycleDeleteSession_(id){PropertiesService.getScriptProperties().deleteProperty(mediaLifecycleSessionKey_(id));}
function mediaLifecycleActor_(principal) {
  var a=accessAccount_(principal);return {account:a,user:{email:a.email||'account:'+a.account_id,role:'OWNER'}};
}
function mediaLifecycleWritableSubmission_(a,id) {
  var c=accessSubmission_(a,id,true);if(c&&['APPROVED','REFLECTED'].indexOf(String(c.status||''))>=0)throw new Error('LOCKED_SUBMISSION');return c;
}
function mediaUploadBegin_(principal,p) {
  p=p||{};var auth=mediaLifecycleActor_(principal),a=auth.account;mediaLifecycleWritableSubmission_(a,p.submissionId);
  var size=Number(p.fileSize),name=mediaLifecycleFileName_(p.fileName),mime=mediaLifecycleMime_(name,p.mimeType);
  if(!Number.isFinite(size)||size<=0||size>MEDIA_UPLOAD_MAX_BYTES_)throw new Error('ORIGINAL_FILE_TOO_LARGE');
  if(!mediaLifecycleAllowed_(name,mime))throw new Error('UNSUPPORTED_MEDIA_TYPE');
  var rootId=mediaLifecycleRootId_(),requestId=/^[a-f0-9]{32}$/.test(String(p.requestId||''))?String(p.requestId):Utilities.getUuid().replace(/-/g,'');
  var init=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,parents,webViewLink',{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),'X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(size)},payload:JSON.stringify({name:name,mimeType:mime,parents:[rootId]}),muteHttpExceptions:true});
  var code=init.getResponseCode();if(code<200||code>=300)throw new Error('DRIVE_UPLOAD_BEGIN_FAILED_'+code);
  var headers=init.getAllHeaders?init.getAllHeaders():init.getHeaders(),location=headers.Location||headers.location;if(!location)throw new Error('DRIVE_UPLOAD_SESSION_MISSING');
  var id='UP_'+Utilities.getUuid().replace(/-/g,''),session={id:id,actorId:a.account_id,actorVersion:Number(a.session_version),submissionId:String(p.submissionId||''),shotCode:String(p.shotCode||''),metadata:p.metadata||{},fileName:name,mimeType:mime,fileSize:size,offset:0,sessionUrl:String(location),requestId:requestId,createdAt:Date.now(),completedFileId:''};mediaLifecycleSaveSession_(session);
  return {sessionId:id,chunkBytes:MEDIA_UPLOAD_MAX_CHUNK_BYTES_,fileSize:size,fileName:name,mimeType:mime};
}
function mediaUploadChunk_(principal,p) {
  p=p||{};var auth=mediaLifecycleActor_(principal),a=auth.account,s=mediaLifecycleLoadSession_(p.sessionId);if(s.actorId!==a.account_id||Number(s.actorVersion)!==Number(a.session_version))throw new Error('FORBIDDEN');
  mediaLifecycleWritableSubmission_(a,s.submissionId);if(s.completedFileId)return {received:Number(s.fileSize),total:Number(s.fileSize),complete:true};
  var offset=Number(p.offset);if(!Number.isInteger(offset)||offset!==Number(s.offset))throw new Error('UPLOAD_OFFSET_MISMATCH');
  var bytes=Utilities.base64Decode(String(p.base64||''));if(!bytes.length||bytes.length>MEDIA_UPLOAD_MAX_CHUNK_BYTES_)throw new Error('INVALID_UPLOAD_CHUNK');
  var end=offset+bytes.length-1,total=Number(s.fileSize);if(end>=total)end=total-1;if(offset+bytes.length>total)throw new Error('INVALID_UPLOAD_CHUNK');
  var response=UrlFetchApp.fetch(s.sessionUrl,{method:'put',contentType:s.mimeType||'application/octet-stream',headers:{'Content-Range':'bytes '+offset+'-'+end+'/'+total},payload:bytes,muteHttpExceptions:true,followRedirects:false});
  var code=response.getResponseCode();
  if(code===308){var h=response.getAllHeaders?response.getAllHeaders():response.getHeaders(),range=String(h.Range||h.range||''),m=range.match(/bytes=0-(\d+)/);s.offset=m?Number(m[1])+1:end+1;mediaLifecycleSaveSession_(s);return {received:s.offset,total:total,complete:false};}
  if(code===200||code===201){var file=JSON.parse(response.getContentText()||'{}');if(!file.id)throw new Error('DRIVE_UPLOAD_FILE_MISSING');s.offset=total;s.completedFileId=String(file.id);mediaLifecycleSaveSession_(s);return {received:total,total:total,complete:true};}
  throw new Error('DRIVE_UPLOAD_CHUNK_FAILED_'+code);
}
function mediaUploadFinish_(principal,p) {
  p=p||{};var auth=mediaLifecycleActor_(principal),a=auth.account,u=auth.user,s=mediaLifecycleLoadSession_(p.sessionId);if(s.actorId!==a.account_id||Number(s.actorVersion)!==Number(a.session_version))throw new Error('FORBIDDEN');
  mediaLifecycleWritableSubmission_(a,s.submissionId);if(!s.completedFileId)throw new Error('UPLOAD_NOT_COMPLETE');
  var retry=latestMedia_().filter(function(m){return String(m.request_id||'')===String(s.requestId)&&String(m.submitted_by||'')===String(u.email);})[0],row;
  if(retry)row=retry;else row=linkDrive_(u,{fileId:s.completedFileId,requestId:s.requestId,kind:'FARM',submissionId:s.submissionId,shotCode:s.shotCode,metadata:s.metadata||{}});
  var organization=typeof mediaOrganizeUploaded_==='function'?mediaOrganizeUploaded_(principal,row.upload_id):{organized:false,error:'MEDIA_ORGANIZER_NOT_INSTALLED'};
  mediaLifecycleDeleteSession_(s.id);return {media:accessMediaPublic_(a,row),organization:organization};
}
function mediaLifecycleQueueRow_(uploadId) {
  var sh=sheet_('12_WEB_미디어큐'),last=sh.getLastRow();if(last<2)return null;var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],values=sh.getRange(2,1,last-1,headers.length).getValues();
  for(var i=values.length-1;i>=0;i--){var idx=headers.indexOf('upload_id');if(idx>=0&&String(values[i][idx])===String(uploadId)){var out={_row:i+2,_sheet:sh,_headers:headers};headers.forEach(function(k,j){out[k]=values[i][j];});return out;}}
  return null;
}
function mediaLifecycleLog_(row) {
  if(typeof mediaOrganizerLog_==='function'){mediaOrganizerLog_(row);return;}
  try{var s=db_().getSheetByName('24_WEB_미디어정리_이력');if(!s){s=db_().insertSheet('24_WEB_미디어정리_이력');s.getRange(1,1,1,MEDIA_LIFECYCLE_LOG_HEADERS_.length).setValues([MEDIA_LIFECYCLE_LOG_HEADERS_]);s.setFrozenRows(1);}s.appendRow(MEDIA_LIFECYCLE_LOG_HEADERS_.map(function(k){return row[k]===undefined||row[k]===null?'':row[k];}));}catch(_){}
}
function mediaDelete_(principal,p) {
  p=p||{};var auth=mediaLifecycleActor_(principal),a=auth.account,id=String(p.id||''),m=accessMediaRow_(a,id,true);if(!m||String(m.submission_id||'')==='DECK')throw new Error('FORBIDDEN');mediaLifecycleWritableSubmission_(a,m.submission_id);
  var q=mediaLifecycleQueueRow_(id);if(!q)throw new Error('NOT_FOUND');if(String(q.status||'')==='DELETED')return {id:id,deleted:true};
  var reason=String(p.reason||'사용자 삭제').trim().slice(0,240),now=new Date().toISOString();
  if(q.drive_file_id)DriveApp.getFileById(String(q.drive_file_id)).setTrashed(true);
  var statusIndex=q._headers.indexOf('status'),noteIndex=q._headers.indexOf('review_note');if(statusIndex<0)throw new Error('MEDIA_SCHEMA_MISMATCH');q._sheet.getRange(q._row,statusIndex+1).setValue('DELETED');if(noteIndex>=0)q._sheet.getRange(q._row,noteIndex+1).setValue(((q.review_note?String(q.review_note)+' | ':'')+'삭제: '+reason+' · '+now+' · '+a.account_id).slice(0,1000));
  mediaLifecycleLog_({at:now,actor_id:a.account_id,upload_id:id,drive_file_id:q.drive_file_id||'',farm_id:q.farm_id||'',farm_name:q.farm_name||'',media_type:q.media_group||'',category:'',shot_code:q.shot_code||'',shot_label:q.shot_label||'',original_file_name:q.file_name||'',stored_file_name:'',folder_path:'',status:'TRASHED',detail:'Drive 휴지통 이동 · 이전 상태 '+String(q.status||'')+' · '+reason,version:MEDIA_LIFECYCLE_VERSION_});
  try{accessLog_(a.account_id,'media.delete',id,reason);}catch(_){}return {id:id,deleted:true};
}
function mediaOrganizerStatus_(principal) {
  var a=accessAccount_(principal);accessPage_(a,'farm',false);var installed=typeof mediaOrganizeUploaded_==='function',rows=0;try{var s=db_().getSheetByName('24_WEB_미디어정리_이력');rows=s?Math.max(0,s.getLastRow()-1):0;}catch(_){}
  return {installed:installed,version:installed&&typeof MEDIA_ORGANIZER_VERSION_!=='undefined'?MEDIA_ORGANIZER_VERSION_:0,historyRows:rows,maxOriginalBytes:MEDIA_UPLOAD_MAX_BYTES_,chunkBytes:MEDIA_UPLOAD_MAX_CHUNK_BYTES_};
}
