import {createDb} from './db.mjs';
import {loadActor, assertAdmin, assertFarmAccess, isAdmin} from './authz.mjs';
import {resolvePolicy, cleanString} from './core.mjs';
import {issueUploadAuthorization} from './upload-auth.mjs';

const esc = encodeURIComponent;
const allowedSaveStatus = new Set(['DRAFT','SUBMITTED']);

async function catalog(db) {
  return db.select('question_catalog','active=eq.true&order=sort_order.asc&select=*');
}
async function visibleFarms(db, actor) {
  if(isAdmin(actor)) return db.select('farms','order=farm_id.asc&select=farm_id,internal_name,public_name,onboarding_status');
  if(!actor.farmIds.length)return [];
  return db.select('farms',`farm_id=in.(${actor.farmIds.map(esc).join(',')})&order=farm_id.asc&select=farm_id,internal_name,public_name,onboarding_status`);
}
async function summaries(db, actor) {
  const filter=isAdmin(actor)?'':actor.farmIds.length?`&farm_id=in.(${actor.farmIds.map(esc).join(',')})`:'&farm_id=eq.__none__';
  const rows=await db.select('intake_submissions',`select=submission_id,farm_id,farm_name_snapshot,status,current_revision,updated_at${filter}&order=updated_at.desc`);
  return (rows||[]).map(r=>({id:r.submission_id,farmId:r.farm_id,name:r.farm_name_snapshot,status:r.status,revision:Number(r.current_revision),updatedAt:r.updated_at}));
}
async function policyRows(db, actor) {
  const rows=await db.select('question_policies','status=eq.active&select=*');
  return isAdmin(actor)?rows:(rows||[]).filter(r=>r.scope==='GLOBAL'||actor.farmIds.includes(r.farm_id));
}

export async function bootstrap(env, principal, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  const [farms, submissions, questions, policies]=await Promise.all([visibleFarms(db,actor),summaries(db,actor),catalog(db),policyRows(db,actor)]);
  return {
    user:actor.user,
    permissions:actor.user.permissions,
    canEditDeck:actor.user.permissions.deck==='edit',
    catalog:(questions||[]).map(q=>({...q,options:q.options?JSON.stringify(q.options):''})),
    farms:(farms||[]).map(f=>({id:f.farm_id,name:f.internal_name||f.public_name||f.farm_id})),
    submissions,
    deck:null,settings:null,
    questionPolicies:policies||[],
    questionPolicyReasons:[],
    questionPolicyReady:true,questionPolicyPrefetched:isAdmin(actor),
    performance:{backend:'SUPABASE_STAGING'}
  };
}

export async function getSubmission(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  const id=String(payload?.id||'');
  const rows=await db.select('intake_submissions',`submission_id=eq.${esc(id)}&select=*`),s=rows?.[0];
  if(!s)throw Error('FORBIDDEN');await assertFarmAccess(db,actor,s.farm_id,false);
  const [answers,media]=await Promise.all([
    db.select('submission_answers_current',`submission_id=eq.${esc(id)}&select=item_key,value_jsonb`),
    db.select('media_assets',`submission_id=eq.${esc(id)}&status=neq.DELETED&order=uploaded_at.desc&select=*`)
  ]);
  return {id:s.submission_id,farmId:s.farm_id,name:s.farm_name_snapshot,status:s.status,revision:Number(s.current_revision),answers:Object.fromEntries((answers||[]).map(a=>[a.item_key,a.value_jsonb])),media:(media||[]).map(mediaPublic)};
}

export async function saveSubmission(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  if(!allowedSaveStatus.has(payload?.status||'DRAFT'))throw Error('INVALID_STATUS');
  const farmId=String(payload?.farmId||''); await assertFarmAccess(db,actor,farmId,true);
  const requestId=String(payload?.requestId||''); if(!/^[a-f0-9]{32}$/.test(requestId))throw Error('INVALID_REQUEST');
  const result=await db.rpc('code1_save_submission',{
    p_actor_id:actor.row.account_id,p_submission_id:String(payload.id||''),p_farm_id:farmId,p_farm_name:cleanString(payload.name,160),p_status:payload.status||'DRAFT',p_base_revision:Number(payload.baseRevision??payload.revision??0),p_request_id:requestId,p_answers:payload.answers||{}
  });
  const r=result?.[0];return {id:r?.submission_id||payload.id,farmId,status:r?.status||payload.status,revision:Number(r?.revision||0),requestId};
}

export async function listQuestionPolicies(env, principal, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);assertAdmin(actor);
  const [policies,farms,questions]=await Promise.all([policyRows(db,actor),visibleFarms(db,actor),catalog(db)]);
  return {policies,reasons:['DUPLICATE','DERIVED','NOT_APPLICABLE','LATER_PHASE','COLLECT_LATER','SENSITIVE','LOW_VALUE','OTHER'],farms:(farms||[]).map(f=>({id:f.farm_id,name:f.internal_name||f.public_name||f.farm_id})),catalog:questions};
}

export async function beginMediaUpload(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  const sub=(await db.select('intake_submissions',`submission_id=eq.${esc(payload?.submissionId||'')}&select=submission_id,farm_id,status`))?.[0];
  if(!sub||['APPROVED','REFLECTED'].includes(sub.status))throw Error('FORBIDDEN');await assertFarmAccess(db,actor,sub.farm_id,true);
  const auth=await issueUploadAuthorization(env,{accountId:actor.row.account_id,farmId:sub.farm_id,submissionId:sub.submission_id,fileName:payload.fileName,mimeType:payload.mimeType,fileSize:Number(payload.fileSize),maxBytes:Number(payload.fileSize)});
  await db.insert('media_assets',{media_id:auth.mediaId,upload_id:auth.mediaId,submission_id:sub.submission_id,farm_id:sub.farm_id,media_group:payload.mediaGroup||'PHOTO',shot_code:payload.shotCode||'',shot_label:payload.shotLabel||'',original_file_name:String(payload.fileName||'original'),object_key:auth.objectKey,mime_type:payload.mimeType||'application/octet-stream',file_size_bytes:Number(payload.fileSize),caption:payload.metadata?.caption||'',rights_owner:payload.metadata?.rights_owner||'',status:'UPLOADING',request_id:payload.requestId||'',uploaded_by:actor.row.account_id,source_storage:'R2_PRIVATE'},'return=minimal');
  return {sessionId:auth.mediaId,mediaId:auth.mediaId,objectKey:auth.objectKey,uploadUrl:`/api/staging/media-put?token=${encodeURIComponent(auth.token)}`,expiresAt:auth.expiresAt,fileSize:Number(payload.fileSize)};
}

export async function finishMediaUpload(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);const id=String(payload?.sessionId||payload?.mediaId||'');
  const row=(await db.select('media_assets',`media_id=eq.${esc(id)}&select=*`))?.[0];if(!row)throw Error('NOT_FOUND');await assertFarmAccess(db,actor,row.farm_id,true);
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');const head=await env.CODE1_MEDIA_BUCKET.head(row.object_key);if(!head)throw Error('R2_OBJECT_MISSING');
  if(Number(row.file_size_bytes)!==Number(head.size))throw Error('R2_SIZE_MISMATCH');
  const updated=await db.update('media_assets',`media_id=eq.${esc(id)}`,{status:'REVIEW_REQUIRED',uploaded_at:new Date().toISOString()},'return=representation');
  await db.insert('media_events',{actor_id:actor.row.account_id,media_id:id,event_type:'UPLOADED',to_status:'REVIEW_REQUIRED',object_key:row.object_key,request_id:row.request_id||''},'return=minimal');
  return {media:mediaPublic(updated?.[0]||{...row,status:'REVIEW_REQUIRED'}),organization:{organized:true,folderPath:'R2 private object key',storedFileName:row.original_file_name}};
}

export async function deleteMedia(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);const id=String(payload?.id||'');
  const row=(await db.select('media_assets',`media_id=eq.${esc(id)}&select=*`))?.[0];if(!row)throw Error('NOT_FOUND');await assertFarmAccess(db,actor,row.farm_id,true);
  if(row.status==='DELETED')return {id,deleted:true};
  const now=new Date().toISOString();
  await db.update('media_assets',`media_id=eq.${esc(id)}`,{status:'DELETED',deleted_at:now,review_note:[row.review_note,payload?.reason||'사용자 삭제'].filter(Boolean).join(' | ')},'return=minimal');
  await db.insert('media_events',{actor_id:actor.row.account_id,media_id:id,event_type:'SOFT_DELETED',from_status:row.status,to_status:'DELETED',object_key:row.object_key,detail:cleanString(payload?.reason||'사용자 삭제',240)},'return=minimal');
  return {id,deleted:true,objectRetainedPrivate:true};
}

export async function mediaBatch(env, principal, payload, fetchImpl=fetch) {
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);const ids=[...new Set((payload?.ids||[]).map(String))].slice(0,32);if(!ids.length)throw Error('INVALID_REQUEST');
  const rows=await db.select('media_assets',`media_id=in.(${ids.map(esc).join(',')})&status=neq.DELETED&select=*`),out={};
  for(const row of rows||[]){try{await assertFarmAccess(db,actor,row.farm_id,false);out[row.media_id]=mediaPublic(row);}catch{out[row.media_id]={error:'이미지를 불러올 수 없습니다.'};}}
  return out;
}

export async function dispatchStagingRpc(env, principal, action, payload={}, fetchImpl=fetch) {
  switch(action){
    case 'bootstrap': return bootstrap(env,principal,fetchImpl);
    case 'getSubmission': return getSubmission(env,principal,payload,fetchImpl);
    case 'saveSubmission': return saveSubmission(env,principal,payload,fetchImpl);
    case 'questionPolicy.list': return listQuestionPolicies(env,principal,fetchImpl);
    case 'mediaUpload.begin': return beginMediaUpload(env,principal,payload,fetchImpl);
    case 'mediaUpload.finish': return finishMediaUpload(env,principal,payload,fetchImpl);
    case 'deleteMedia': return deleteMedia(env,principal,payload,fetchImpl);
    case 'mediaBatch': return mediaBatch(env,principal,payload,fetchImpl);
    default: throw Error('STAGING_ACTION_NOT_IMPLEMENTED');
  }
}

function mediaPublic(row){return {upload_id:row.upload_id,media_id:row.media_id,submission_id:row.submission_id,farm_id:row.farm_id,shot_code:row.shot_code,shot_label:row.shot_label,file_name:row.original_file_name,mime_type:row.mime_type,file_size_bytes:row.file_size_bytes,status:row.status,caption:row.caption,taken_at:row.taken_at,photographer:row.photographer,rights_owner:row.rights_owner,face_present:row.face_present,face_consent:row.face_consent,privacy_checked:row.privacy_checked,b2b_use:row.b2b_use};}

export function effectivePolicyFor(itemKey,farmId,rows){return resolvePolicy(itemKey,farmId,rows);}
