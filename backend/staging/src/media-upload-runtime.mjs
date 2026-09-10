import {createDb} from './db.mjs';
import {loadActor, assertFarmAccess} from './authz.mjs';
import {issueUploadAuthorization} from './upload-auth.mjs';

export const MEDIA_MULTIPART_CHUNK_BYTES = 6 * 1024 * 1024;
const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;
const MAX_BROWSER_MEDIA_BYTES = 250 * 1024 * 1024;
const esc = encodeURIComponent;
const requestIdPattern = /^[a-f0-9]{32}$/;

function requestIdOf(payload) {
  const value=String(payload?.requestId||'');
  if(!requestIdPattern.test(value))throw Error('INVALID_REQUEST');
  return value;
}
function fileSizeOf(value,max=MAX_BROWSER_MEDIA_BYTES){
  const size=Number(value);
  if(!Number.isSafeInteger(size)||size<=0||size>max)throw Error('INVALID_FILE_SIZE');
  return size;
}
function mimeOf(value){return String(value||'application/octet-stream').slice(0,120)||'application/octet-stream';}
function fileNameOf(value){const name=String(value||'original').slice(0,255);return name||'original';}
function parseParts(value){
  if(Array.isArray(value))return value;
  if(typeof value==='string'){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return [];}}
  return [];
}
function decodeBase64(value){
  try{return Uint8Array.from(atob(String(value||'')),c=>c.charCodeAt(0));}
  catch{throw Error('UPLOAD_CHUNK_INVALID');}
}
async function sha256Hex(bytes){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
function assertExistingMatches(row,{submissionId,fileName,mimeType,fileSize}){
  if(String(row.submission_id)!==String(submissionId)||String(row.original_file_name)!==String(fileName)||String(row.mime_type||'')!==String(mimeType)||Number(row.file_size_bytes)!==Number(fileSize))throw Error('UPLOAD_REQUEST_CONFLICT');
}
function mediaPublic(row){return {upload_id:row.upload_id,media_id:row.media_id,submission_id:row.submission_id,farm_id:row.farm_id,shot_code:row.shot_code,shot_label:row.shot_label,file_name:row.original_file_name,mime_type:row.mime_type,file_size_bytes:row.file_size_bytes,status:row.status,caption:row.caption,taken_at:row.taken_at,photographer:row.photographer,rights_owner:row.rights_owner,face_present:row.face_present,face_consent:row.face_consent,privacy_checked:row.privacy_checked,b2b_use:row.b2b_use};}
function beginPayload(auth,row){return {sessionId:row.media_id,mediaId:row.media_id,objectKey:row.object_key,uploadUrl:`/api/staging/media-put?token=${encodeURIComponent(auth.token)}`,expiresAt:auth.expiresAt,fileSize:Number(row.file_size_bytes),chunkBytes:Number(row.upload_chunk_bytes)||MEDIA_MULTIPART_CHUNK_BYTES,received:Number(row.upload_received_bytes)||0};}
async function findRequestMedia(db,actorId,requestId){
  const rows=await db.select('media_assets',`uploaded_by=eq.${esc(actorId)}&request_id=eq.${esc(requestId)}&source_storage=eq.R2_PRIVATE&select=*`);
  return rows?.[0]||null;
}
async function loadWritableSubmission(db,actor,payload){
  const sub=(await db.select('intake_submissions',`submission_id=eq.${esc(payload?.submissionId||'')}&select=submission_id,farm_id,status`))?.[0];
  if(!sub||['APPROVED','REFLECTED'].includes(sub.status))throw Error('FORBIDDEN');
  await assertFarmAccess(db,actor,sub.farm_id,true);
  return sub;
}
async function loadMediaForEdit(db,actor,id){
  const row=(await db.select('media_assets',`media_id=eq.${esc(id)}&select=*`))?.[0];
  if(!row)throw Error('NOT_FOUND');
  await assertFarmAccess(db,actor,row.farm_id,true);
  return row;
}

export async function beginMultipartMediaUpload(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),requestId=requestIdOf(payload);
  const sub=await loadWritableSubmission(db,actor,payload);
  const fileSize=fileSizeOf(payload?.fileSize),fileName=fileNameOf(payload?.fileName),mimeType=mimeOf(payload?.mimeType);
  const existing=await findRequestMedia(db,actor.row.account_id,requestId);
  if(existing){
    await assertFarmAccess(db,actor,existing.farm_id,true);
    assertExistingMatches(existing,{submissionId:sub.submission_id,fileName,mimeType,fileSize});
    if(existing.status==='DELETED')throw Error('UPLOAD_REQUEST_CONFLICT');
    const auth=await issueUploadAuthorization(env,{accountId:actor.row.account_id,farmId:existing.farm_id,submissionId:existing.submission_id,fileName,mimeType,fileSize,maxBytes:fileSize,mediaId:existing.media_id});
    return beginPayload(auth,existing);
  }
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const auth=await issueUploadAuthorization(env,{accountId:actor.row.account_id,farmId:sub.farm_id,submissionId:sub.submission_id,fileName,mimeType,fileSize,maxBytes:fileSize});
  const multipart=await env.CODE1_MEDIA_BUCKET.createMultipartUpload(auth.objectKey,{httpMetadata:{contentType:mimeType},customMetadata:{mediaId:auth.mediaId,farmId:sub.farm_id,submissionId:sub.submission_id}});
  const row={media_id:auth.mediaId,upload_id:auth.mediaId,submission_id:sub.submission_id,farm_id:sub.farm_id,media_group:payload?.mediaGroup||(/^video\//.test(mimeType)?'VIDEO':'PHOTO'),shot_code:payload?.shotCode||'',shot_label:payload?.shotLabel||'',original_file_name:fileName,object_key:auth.objectKey,mime_type:mimeType,file_size_bytes:fileSize,caption:payload?.metadata?.caption||'',rights_owner:payload?.metadata?.rights_owner||'',status:'UPLOADING',request_id:requestId,uploaded_by:actor.row.account_id,source_storage:'R2_PRIVATE',r2_multipart_upload_id:multipart.uploadId,upload_chunk_bytes:MEDIA_MULTIPART_CHUNK_BYTES,upload_received_bytes:0,upload_parts:[]};
  try{
    await db.insert('media_assets',row,'return=minimal');
    return beginPayload(auth,row);
  }catch(error){
    try{await multipart.abort();}catch{}
    const raced=await findRequestMedia(db,actor.row.account_id,requestId);
    if(raced){
      assertExistingMatches(raced,{submissionId:sub.submission_id,fileName,mimeType,fileSize});
      const retryAuth=await issueUploadAuthorization(env,{accountId:actor.row.account_id,farmId:raced.farm_id,submissionId:raced.submission_id,fileName,mimeType,fileSize,maxBytes:fileSize,mediaId:raced.media_id});
      return beginPayload(retryAuth,raced);
    }
    throw error;
  }
}

export async function uploadMultipartMediaChunk(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);requestIdOf(payload);
  const id=String(payload?.sessionId||payload?.mediaId||''),row=await loadMediaForEdit(db,actor,id);
  if(row.status!=='UPLOADING'||!row.r2_multipart_upload_id)throw Error('UPLOAD_SESSION_INVALID');
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const total=fileSizeOf(payload?.total),expectedTotal=Number(row.file_size_bytes);
  if(total!==expectedTotal)throw Error('UPLOAD_TOTAL_MISMATCH');
  const offset=Number(payload?.offset),received=Number(row.upload_received_bytes)||0,chunkBytes=Number(row.upload_chunk_bytes)||MEDIA_MULTIPART_CHUNK_BYTES;
  if(!Number.isSafeInteger(offset)||offset<0||offset>=total)throw Error('UPLOAD_OFFSET_INVALID');
  const bytes=decodeBase64(payload?.base64),expectedSize=Math.min(chunkBytes,total-offset);
  if(bytes.length!==expectedSize)throw Error('UPLOAD_CHUNK_SIZE_MISMATCH');
  if(offset+bytes.length<total&&bytes.length<MIN_MULTIPART_PART_BYTES)throw Error('UPLOAD_CHUNK_TOO_SMALL');
  const hash=await sha256Hex(bytes),parts=parseParts(row.upload_parts);
  if(offset<received){
    const prior=parts.find(p=>Number(p.offset)===offset);
    if(prior&&Number(prior.size)===bytes.length&&String(prior.sha256)===hash)return {sessionId:id,received,partNumber:Number(prior.partNumber),idempotent:true};
    throw Error('UPLOAD_OFFSET_CONFLICT');
  }
  if(offset!==received)throw Error('UPLOAD_OFFSET_CONFLICT');
  const partNumber=parts.length+1;
  if(partNumber>10000)throw Error('UPLOAD_TOO_MANY_PARTS');
  const multipart=env.CODE1_MEDIA_BUCKET.resumeMultipartUpload(row.object_key,row.r2_multipart_upload_id);
  const uploaded=await multipart.uploadPart(partNumber,bytes);
  const nextReceived=offset+bytes.length,nextParts=[...parts,{partNumber:Number(uploaded.partNumber||partNumber),etag:String(uploaded.etag||''),offset,size:bytes.length,sha256:hash}];
  const updated=await db.update('media_assets',`media_id=eq.${esc(id)}&status=eq.UPLOADING&upload_received_bytes=eq.${received}`,{upload_received_bytes:nextReceived,upload_parts:nextParts},'return=representation');
  if(updated?.length)return {sessionId:id,received:nextReceived,partNumber,idempotent:false};
  const current=await loadMediaForEdit(db,actor,id),currentParts=parseParts(current.upload_parts),prior=currentParts.find(p=>Number(p.offset)===offset);
  if(Number(current.upload_received_bytes)>=nextReceived&&prior&&Number(prior.size)===bytes.length&&String(prior.sha256)===hash)return {sessionId:id,received:Number(current.upload_received_bytes),partNumber:Number(prior.partNumber),idempotent:true};
  throw Error('UPLOAD_OFFSET_CONFLICT');
}

function assertHead(row,head){
  if(!head)throw Error('R2_OBJECT_MISSING');
  if(Number(head.size)!==Number(row.file_size_bytes))throw Error('R2_SIZE_MISMATCH');
  const contentType=String(head.httpMetadata?.contentType||'');
  if(contentType&&contentType!==String(row.mime_type||''))throw Error('R2_MIME_MISMATCH');
}

export async function finishMultipartMediaUpload(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),requestId=requestIdOf(payload);
  const id=String(payload?.sessionId||payload?.mediaId||''),row=await loadMediaForEdit(db,actor,id);
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  if(!['UPLOADING','REVIEW_REQUIRED'].includes(row.status))throw Error('UPLOAD_SESSION_INVALID');
  let head=await env.CODE1_MEDIA_BUCKET.head(row.object_key);
  if(!head){
    if(row.status!=='UPLOADING'||!row.r2_multipart_upload_id)throw Error('R2_OBJECT_MISSING');
    if(Number(row.upload_received_bytes)!==Number(row.file_size_bytes))throw Error('UPLOAD_INCOMPLETE');
    const parts=parseParts(row.upload_parts);
    if(!parts.length)throw Error('UPLOAD_INCOMPLETE');
    const multipart=env.CODE1_MEDIA_BUCKET.resumeMultipartUpload(row.object_key,row.r2_multipart_upload_id);
    await multipart.complete(parts.map(p=>({partNumber:Number(p.partNumber),etag:String(p.etag)})));
    head=await env.CODE1_MEDIA_BUCKET.head(row.object_key);
  }
  assertHead(row,head);
  if(row.status==='REVIEW_REQUIRED')return {media:mediaPublic(row),organization:{organized:true,folderPath:'R2 private object key',storedFileName:row.original_file_name},idempotent:true};
  const finalized=await db.rpc('code1_finalize_media_upload',{p_actor_id:actor.row.account_id,p_media_id:id,p_request_id:requestId});
  const result=finalized?.[0];
  if(!result)throw Error('MEDIA_FINALIZE_FAILED');
  return {media:mediaPublic(result),organization:{organized:true,folderPath:'R2 private object key',storedFileName:result.original_file_name||row.original_file_name},idempotent:false};
}

export async function smallR2MediaUpload(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),requestId=requestIdOf(payload);
  if(payload?.kind!=='FARM')throw Error('FORBIDDEN');
  const sub=await loadWritableSubmission(db,actor,payload),bytes=decodeBase64(payload?.base64);
  if(!bytes.length||bytes.length>8*1024*1024)throw Error('TOO_LARGE');
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const fileName=fileNameOf(payload?.fileName),mimeType=mimeOf(payload?.mimeType);
  const existing=await findRequestMedia(db,actor.row.account_id,requestId);
  if(existing){assertExistingMatches(existing,{submissionId:sub.submission_id,fileName,mimeType,fileSize:bytes.length});return mediaPublic(existing);}
  const meta=payload?.metadata||{},shot=(await db.select('question_catalog',`item_key=eq.${esc(payload?.shotCode||'')}&select=item_label,input_type`))?.[0];
  const auth=await issueUploadAuthorization(env,{accountId:actor.row.account_id,farmId:sub.farm_id,submissionId:sub.submission_id,fileName,mimeType,fileSize:bytes.length,maxBytes:bytes.length});
  const row={media_id:auth.mediaId,upload_id:auth.mediaId,submission_id:sub.submission_id,farm_id:sub.farm_id,media_group:/^video\//.test(mimeType)?'VIDEO':'PHOTO',shot_code:payload?.shotCode||'',shot_label:shot?.item_label||payload?.shotCode||'',original_file_name:fileName,object_key:auth.objectKey,mime_type:mimeType,file_size_bytes:bytes.length,caption:meta.caption||'',taken_at:meta.taken_at||null,photographer:meta.photographer||'',rights_owner:meta.rights_owner||'',face_present:meta.face_present||'',face_consent:meta.face_consent||'',privacy_checked:meta.privacy_checked||'',web_use:meta.web_use||'',magazine_use:meta.magazine_use||'',sns_use:meta.sns_use||'',b2b_use:meta.b2b_use||'',ad_use:meta.ad_use||'',edit_allowed:meta.edit_allowed||'',ai_edit_allowed:meta.ai_edit_allowed||'',status:'REVIEW_REQUIRED',request_id:requestId,uploaded_by:actor.row.account_id,source_storage:'R2_PRIVATE',upload_received_bytes:bytes.length,upload_parts:[]};
  await env.CODE1_MEDIA_BUCKET.put(auth.objectKey,bytes,{httpMetadata:{contentType:mimeType},customMetadata:{mediaId:auth.mediaId,farmId:sub.farm_id,submissionId:sub.submission_id}});
  try{
    const saved=await db.rpc('code1_register_media_upload',{p_actor_id:actor.row.account_id,p_request_id:requestId,p_media:row});
    const result=saved?.[0];
    if(!result)throw Error('MEDIA_REGISTER_FAILED');
    if(String(result.object_key)!==auth.objectKey){try{await env.CODE1_MEDIA_BUCKET.delete(auth.objectKey);}catch{throw Error('R2_ORPHAN_COMPENSATION_FAILED');}}
    return mediaPublic(result);
  }catch(error){
    try{await env.CODE1_MEDIA_BUCKET.delete(auth.objectKey);}catch{throw Error('R2_ORPHAN_COMPENSATION_FAILED');}
    throw error;
  }
}

const MEDIA_UPLOAD_ACTIONS=new Set(['mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','upload']);
export function isMediaUploadAction(action,payload={}){return action!=='upload'?MEDIA_UPLOAD_ACTIONS.has(action):payload?.kind==='FARM';}
export async function dispatchMediaUpload(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'mediaUpload.begin': return beginMultipartMediaUpload(env,principal,payload,fetchImpl);
    case 'mediaUpload.chunk': return uploadMultipartMediaChunk(env,principal,payload,fetchImpl);
    case 'mediaUpload.finish': return finishMultipartMediaUpload(env,principal,payload,fetchImpl);
    case 'upload': if(payload?.kind==='FARM')return smallR2MediaUpload(env,principal,payload,fetchImpl); break;
  }
  throw Error('STAGING_MEDIA_ACTION_NOT_IMPLEMENTED');
}
