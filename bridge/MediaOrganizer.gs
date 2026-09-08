/* CODE1 farm media Drive organizer.
 * Install beside CloudflareBridge.gs in the EXISTING Apps Script project.
 * Existing Media.gs remains canonical for upload/write behavior.
 * This layer only renames and moves newly uploaded FARM files after upload_() succeeds.
 * DECK files and linkDrive_() sources are intentionally untouched.
 */
var MEDIA_ORGANIZER_VERSION_ = 1;
var MEDIA_ORGANIZER_LOG_ = '24_WEB_미디어정리_이력';
var MEDIA_ORGANIZER_HEADERS_ = ['at','actor_id','upload_id','drive_file_id','farm_id','farm_name','media_type','category','shot_code','shot_label','original_file_name','stored_file_name','folder_path','status','detail','version'];

function mediaOrganizerSafe_(value, fallback) {
  var s=String(value||'').trim().replace(/[\\/:*?"<>|#%{}~\u0000-\u001f]/g,'-').replace(/\s+/g,' ').replace(/\.{2,}/g,'.');
  s=s.replace(/^\.+|\.+$/g,'').trim();
  if(s.length>90)s=s.slice(0,90).trim();
  return s||fallback||'미지정';
}
function mediaOrganizerSetting_(key) {
  var s=db_().getSheetByName('14_WEB_설정');if(!s)throw new Error('MEDIA_ORGANIZER_SETUP_REQUIRED');
  var rows=s.getDataRange().getValues();
  for(var i=0;i<rows.length;i++)if(String(rows[i][0]||'').trim()===key)return String(rows[i][1]||'').trim();
  return '';
}
function mediaOrganizerEnsureLog_() {
  var s=db_().getSheetByName(MEDIA_ORGANIZER_LOG_);
  if(!s){s=db_().insertSheet(MEDIA_ORGANIZER_LOG_);s.getRange(1,1,1,MEDIA_ORGANIZER_HEADERS_.length).setValues([MEDIA_ORGANIZER_HEADERS_]);s.setFrozenRows(1);}
  var current=s.getRange(1,1,1,MEDIA_ORGANIZER_HEADERS_.length).getValues()[0];
  if(JSON.stringify(current)!==JSON.stringify(MEDIA_ORGANIZER_HEADERS_))throw new Error('MEDIA_ORGANIZER_SCHEMA_MISMATCH');
  return s;
}
function mediaOrganizerAlready_(sheet, uploadId, driveFileId) {
  if(sheet.getLastRow()<2)return false;
  var range=sheet.getRange(2,3,sheet.getLastRow()-1,12),values=range.getValues();
  for(var i=0;i<values.length;i++)if(String(values[i][0])===String(uploadId)&&String(values[i][1])===String(driveFileId)&&String(values[i][11])==='ORGANIZED')return true;
  return false;
}
function mediaOrganizerLog_(row) {
  try{
    var s=mediaOrganizerEnsureLog_();
    s.appendRow(MEDIA_ORGANIZER_HEADERS_.map(function(k){return row[k]===undefined||row[k]===null?'':row[k];}));
  }catch(_){ }
}
function mediaOrganizerFolder_(parent,name) {
  var safe=mediaOrganizerSafe_(name,'미지정'),it=parent.getFoldersByName(safe);
  return it.hasNext()?it.next():parent.createFolder(safe);
}
function mediaOrganizerFarmFolder_(parent,farmId,farmName) {
  var id=mediaOrganizerSafe_(farmId,'TEMP'),name=mediaOrganizerSafe_(farmName,'농가명 미정'),prefix='['+id+'] ';
  var folders=parent.getFolders();
  while(folders.hasNext()){
    var f=folders.next(),n=f.getName();
    if(n.indexOf(prefix)===0){var wanted=prefix+name;if(n!==wanted)f.setName(wanted);return f;}
  }
  return parent.createFolder(prefix+name);
}
function mediaOrganizerExtension_(fileName,mime) {
  var m=String(fileName||'').match(/\.([A-Za-z0-9]{1,8})$/);if(m)return '.'+m[1].toLowerCase();
  var map={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','video/mp4':'.mp4','application/pdf':'.pdf'};
  return map[String(mime||'').toLowerCase()]||'';
}
function mediaOrganizerType_(mime,fileName) {
  var m=String(mime||'').toLowerCase();
  if(m.indexOf('image/')===0)return {key:'IMAGE',folder:'01_사진'};
  if(m.indexOf('video/')===0)return {key:'VIDEO',folder:'02_영상'};
  if(m==='application/pdf'||/\.pdf$/i.test(String(fileName||'')))return {key:'DOCUMENT',folder:'03_문서'};
  return {key:'FILE',folder:'09_기타'};
}
function mediaOrganizerCatalogSection_(shotCode) {
  try{
    var items=catalog_(),code=String(shotCode||'');
    for(var i=0;i<items.length;i++)if(String(items[i].item_key||'')===code)return mediaOrganizerSafe_((items[i].section_code?items[i].section_code+'_':'')+(items[i].section_name||''),'기타');
  }catch(_){ }
  return '기타';
}
function mediaOrganizerCategory_(type,shotCode,shotLabel) {
  var code=String(shotCode||'').toUpperCase(),n;
  if(type==='IMAGE'){
    if(code.indexOf('PHOTO-P')===0)return '01_상품·포장';
    if(code.indexOf('PHOTO-F')===0)return '02_농장·환경';
    if(code.indexOf('PHOTO-W')===0)return '03_작업·공정';
    if(code.indexOf('PHOTO-H')===0)return '04_농장주·인물';
  }
  if(type==='VIDEO'&&/^VIDEO-\d+$/.test(code)){
    n=Number(code.split('-')[1]);
    if(n>=1&&n<=3)return '01_농장·환경';
    if(n>=4&&n<=8)return '02_작업·공정';
    if(n>=9&&n<=10)return '03_인터뷰';
    if(n===11)return '04_현장음';
  }
  var section=mediaOrganizerCatalogSection_(shotCode);
  if(section!=='기타')return section;
  return mediaOrganizerSafe_(shotLabel,'기타');
}
function mediaOrganizerTimestamp_(value) {
  var d=value?new Date(value):new Date();if(isNaN(d.getTime()))d=new Date();
  return Utilities.formatDate(d,'Asia/Seoul','yyyyMMdd_HHmmss');
}
function mediaOrganizerFindRow_(uploadId) {
  var rows=latestMedia_();
  for(var i=0;i<rows.length;i++)if(String(rows[i].upload_id||'')===String(uploadId||''))return rows[i];
  return null;
}
function mediaOrganizeUploaded_(principal,uploadId) {
  var actor='';
  try{actor=accessAccount_(principal).account_id;}catch(_){actor='';}
  var base={at:new Date().toISOString(),actor_id:actor,upload_id:String(uploadId||''),status:'ERROR',detail:'',version:MEDIA_ORGANIZER_VERSION_};
  try{
    var row=mediaOrganizerFindRow_(uploadId);if(!row)throw new Error('MEDIA_ROW_NOT_FOUND');
    if(String(row.media_group||'').toUpperCase()==='DECK'||String(row.shot_code||'').toUpperCase()==='DECK')return {skipped:true,reason:'DECK'};
    if(!row.drive_file_id)throw new Error('DRIVE_FILE_ID_MISSING');
    Object.assign(base,{drive_file_id:row.drive_file_id,farm_id:row.farm_id||'',farm_name:row.farm_name||'',shot_code:row.shot_code||'',shot_label:row.shot_label||'',original_file_name:row.file_name||''});
    var logSheet=mediaOrganizerEnsureLog_();if(mediaOrganizerAlready_(logSheet,row.upload_id,row.drive_file_id))return {skipped:true,reason:'ALREADY_ORGANIZED'};
    var rootId=mediaOrganizerSetting_('MEDIA_ROOT_FOLDER_ID');if(!rootId)throw new Error('MEDIA_ROOT_FOLDER_ID_MISSING');
    var root=DriveApp.getFolderById(rootId),farmRoot=mediaOrganizerFolder_(root,'농가별');
    var farmFolder=mediaOrganizerFarmFolder_(farmRoot,row.farm_id||row.submission_id||'TEMP',row.farm_name||'농가명 미정');
    var type=mediaOrganizerType_(row.mime_type,row.file_name),typeFolder=mediaOrganizerFolder_(farmFolder,type.folder);
    var category=mediaOrganizerCategory_(type.key,row.shot_code,row.shot_label),categoryFolder=mediaOrganizerFolder_(typeFolder,category);
    var file=DriveApp.getFileById(row.drive_file_id),ext=mediaOrganizerExtension_(row.file_name,row.mime_type);
    var farmName=mediaOrganizerSafe_(row.farm_name,'농가명미정').replace(/\s+/g,'_'),code=mediaOrganizerSafe_(row.shot_code,'UNSORTED').replace(/\s+/g,'_'),label=mediaOrganizerSafe_(row.shot_label,'자료').replace(/\s+/g,'_');
    var shortId=String(row.upload_id||'').replace(/^M_/,'').slice(0,8)||Utilities.getUuid().replace(/-/g,'').slice(0,8);
    var stored=farmName+'_'+code+'_'+label+'_'+mediaOrganizerTimestamp_(row.taken_at||row.submitted_at)+'_'+shortId+ext;
    if(stored.length>180)stored=stored.slice(0,175-ext.length)+ext;
    file.setName(stored);file.moveTo(categoryFolder);
    var path='농가별 / '+farmFolder.getName()+' / '+type.folder+' / '+category;
    try{file.setDescription('CODE1 자동정리 v'+MEDIA_ORGANIZER_VERSION_+'\n원본 파일명: '+String(row.file_name||'')+'\n촬영항목: '+String(row.shot_code||'')+' '+String(row.shot_label||'')+'\n저장경로: '+path);}catch(_){ }
    Object.assign(base,{media_type:type.key,category:category,stored_file_name:stored,folder_path:path,status:'ORGANIZED',detail:'자동 분류·이름변경 완료'});mediaOrganizerLog_(base);
    return {organized:true,storedFileName:stored,folderPath:path};
  }catch(error){base.detail=String(error&&error.message||'MEDIA_ORGANIZER_FAILED').slice(0,300);mediaOrganizerLog_(base);return {organized:false,error:base.detail};}
}
