import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {privatePlanningMaterialObjectKey} from './core.mjs';
import {resolveWorkspaceAccess,accessHas} from './workspace-access.mjs';
import {issueMediaReadToken} from './media-read.mjs';

export const MATERIAL_CHUNK_BYTES=6*1024*1024;
export const MATERIAL_MAX_BYTES=250*1024*1024;
const MIN_MULTIPART_PART_BYTES=5*1024*1024;
const ridPattern=/^[a-f0-9]{32}$/;
const shaPattern=/^[a-f0-9]{64}$/;
const esc=encodeURIComponent;
const RESPONSE_KINDS=new Set(['TEXT','LONG_TEXT','FILE','TEXT_FILE']);

export const MATERIAL_MIME_ALLOWLIST=Object.freeze({
  '.pdf':['application/pdf'],
  '.jpg':['image/jpeg'],'.jpeg':['image/jpeg'],'.png':['image/png'],'.webp':['image/webp'],
  '.heic':['image/heic','image/heif'],'.heif':['image/heif','image/heic'],
  '.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.pptx':['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.mp4':['video/mp4'],'.mov':['video/quicktime']
});

const internalCaps=['PAGE_PLANNING_MATERIALS','MATERIAL_REQUEST_MANAGE','MATERIAL_REVIEW','MATERIAL_TEMPLATE_MANAGE'];
const unwrap=value=>Array.isArray(value)?value[0]:value;
const requestIdOf=value=>{const s=String(value||'');if(!ridPattern.test(s))throw Error('INVALID_REQUEST');return s;};
const safeText=(value,max=500)=>String(value??'').trim().slice(0,max);
const fileNameOf=value=>{const s=safeText(value,255);if(!s||/[\\/\u0000-\u001f]/.test(s))throw Error('INVALID_FILE_NAME');return s;};
const fileSizeOf=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0||n>MATERIAL_MAX_BYTES)throw Error('INVALID_FILE_SIZE');return n;};
const parseParts=value=>{if(Array.isArray(value))return value;if(typeof value==='string'){try{const x=JSON.parse(value);return Array.isArray(x)?x:[];}catch{return [];}}return [];};
const decodeBase64=value=>{try{return Uint8Array.from(atob(String(value||'')),c=>c.charCodeAt(0));}catch{throw Error('UPLOAD_CHUNK_INVALID');}};
async function sha256Hex(bytes){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return Array.from(d,b=>b.toString(16).padStart(2,'0')).join('');}

function extensionOf(name){const m=String(name||'').toLowerCase().match(/(\.[a-z0-9]{1,8})$/);return m?.[1]||'';}
export function assertMaterialFileType(fileName,mimeType){
  const ext=extensionOf(fileName),mime=String(mimeType||'').toLowerCase();
  if(!MATERIAL_MIME_ALLOWLIST[ext]?.includes(mime))throw Error('UNSUPPORTED_FILE_TYPE');
  return {ext,mime};
}
export function assertMaterialMagic(bytes,mime){
  if(!bytes?.length)throw Error('FILE_SIGNATURE_MISMATCH');
  const ascii=(start,len)=>String.fromCharCode(...bytes.slice(start,start+len));
  let ok=false;
  if(mime==='application/pdf')ok=ascii(0,5)==='%PDF-';
  else if(mime==='image/jpeg')ok=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  else if(mime==='image/png')ok=bytes[0]===0x89&&ascii(1,3)==='PNG';
  else if(mime==='image/webp')ok=ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';
  else if(mime.includes('officedocument'))ok=bytes[0]===0x50&&bytes[1]===0x4b;
  else if(['video/mp4','video/quicktime','image/heic','image/heif'].includes(mime))ok=ascii(4,4)==='ftyp';
  if(!ok)throw Error('FILE_SIGNATURE_MISMATCH');
}

async function actorContext(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),access=await resolveWorkspaceAccess(db,actor);
  const internal=internalCaps.some(cap=>accessHas(access,cap));
  const assigned=accessHas(access,'MATERIAL_UPLOAD_ASSIGNED');
  if(!internal&&!assigned)throw Error('FORBIDDEN');
  return {db,actor,access,internal,assigned};
}
async function requestAssigned(db,accountId,requestId){
  const rows=await db.select('planning_material_request_assignees',`material_request_id=eq.${esc(requestId)}&account_id=eq.${esc(accountId)}&active=eq.true&select=account_id`);
  return !!rows?.length;
}
async function assertRequestAccess(ctx,requestId,{manage=false,review=false,template=false}={}){
  if(template){if(!accessHas(ctx.access,'MATERIAL_TEMPLATE_MANAGE'))throw Error('FORBIDDEN');return;}
  if(manage){if(!accessHas(ctx.access,'MATERIAL_REQUEST_MANAGE'))throw Error('FORBIDDEN');return;}
  if(review){if(!accessHas(ctx.access,'MATERIAL_REVIEW'))throw Error('FORBIDDEN');return;}
  if(ctx.internal)return;
  if(!ctx.assigned||!await requestAssigned(ctx.db,ctx.actor.row.account_id,requestId))throw Error('FORBIDDEN');
}
async function loadItemContext(ctx,itemId){
  const item=(await ctx.db.select('planning_material_request_items',`request_item_id=eq.${esc(itemId)}&select=*`))?.[0];
  if(!item)throw Error('NOT_FOUND');
  const req=(await ctx.db.select('planning_material_requests',`material_request_id=eq.${esc(item.material_request_id)}&select=*`))?.[0];
  if(!req)throw Error('NOT_FOUND');
  await assertRequestAccess(ctx,req.material_request_id);
  return {item,req};
}
async function loadMediaContext(ctx,mediaId){
  const version=(await ctx.db.select('planning_material_file_versions',`media_id=eq.${esc(mediaId)}&select=*`))?.[0];
  if(!version)throw Error('NOT_FOUND');
  const file=(await ctx.db.select('planning_material_files',`material_file_id=eq.${esc(version.material_file_id)}&select=*`))?.[0];
  if(!file)throw Error('NOT_FOUND');
  const {item,req}=await loadItemContext(ctx,file.request_item_id);
  const media=(await ctx.db.select('media_assets',`media_id=eq.${esc(mediaId)}&select=*`))?.[0];
  if(!media||media.media_group!=='PLANNING_MATERIAL')throw Error('NOT_FOUND');
  return {version,file,item,req,media};
}

async function publicFile(ctx,row){
  const media=row.media;
  let readUrl=null;
  if(media?.object_key&&media.status!=='UPLOADING'){
    const token=await issueMediaReadToken(ctx.env||{}, {accountId:ctx.actor.row.account_id,mediaId:media.media_id,objectKey:media.object_key,mimeType:media.mime_type});
    readUrl=`/api/staging/media-get?token=${encodeURIComponent(token)}`;
  }
  return {materialFileId:row.file.material_file_id,versionId:row.version.version_id,revision:Number(row.version.revision),mediaId:media.media_id,fileName:media.original_file_name,mime:media.mime_type,size:Number(media.file_size_bytes),sha256:media.checksum_sha256,confidentiality:row.version.confidentiality,rightsUseState:row.version.rights_use_state,publicDeliveryAllowed:false,current:row.version.is_current===true,versionState:row.version.version_state,supersedesVersionId:row.version.supersedes_version_id||null,readUrl};
}

async function requestBundle(ctx,requestId){
  await assertRequestAccess(ctx,requestId);
  const req=(await ctx.db.select('planning_material_requests',`material_request_id=eq.${esc(requestId)}&select=*`))?.[0];
  if(!req)throw Error('NOT_FOUND');
  const [items,assignees]=await Promise.all([
    ctx.db.select('planning_material_request_items',`material_request_id=eq.${esc(requestId)}&order=sort_order_snapshot.asc,item_key.asc&select=*`),
    ctx.internal?ctx.db.select('planning_material_request_assignees',`material_request_id=eq.${esc(requestId)}&active=eq.true&select=account_id,assignment_role,assigned_at`):Promise.resolve([])
  ]);
  const itemIds=(items||[]).map(x=>x.request_item_id);
  const files=itemIds.length?await ctx.db.select('planning_material_files',`${ctx.db.inList('request_item_id',itemIds)}&status=eq.ACTIVE&select=*`):[];
  const fileIds=(files||[]).map(x=>x.material_file_id);
  const versions=fileIds.length?await ctx.db.select('planning_material_file_versions',`${ctx.db.inList('material_file_id',fileIds)}&order=revision.asc&select=*`):[];
  const mediaIds=(versions||[]).map(x=>x.media_id);
  const medias=mediaIds.length?await ctx.db.select('media_assets',`${ctx.db.inList('media_id',mediaIds)}&select=*`):[];
  const mediaMap=new Map((medias||[]).map(x=>[x.media_id,x])),versionsByFile=new Map(),filesByItem=new Map();
  for(const v of versions||[]){const a=versionsByFile.get(v.material_file_id)||[];a.push(v);versionsByFile.set(v.material_file_id,a);}
  for(const f of files||[]){const a=filesByItem.get(f.request_item_id)||[];a.push(f);filesByItem.set(f.request_item_id,a);}
  const out=[];
  for(const item of items||[]){
    const fileOut=[];
    for(const file of filesByItem.get(item.request_item_id)||[]){
      const verOut=[];
      for(const version of versionsByFile.get(file.material_file_id)||[]){const media=mediaMap.get(version.media_id);if(media)verOut.push(await publicFile(ctx,{file,version,media}));}
      fileOut.push({materialFileId:file.material_file_id,currentRevision:Number(file.current_revision),versions:verOut});
    }
    out.push({requestItemId:item.request_item_id,itemKey:item.item_key,label:item.label_snapshot,description:item.description_snapshot,required:item.required_snapshot===true,sortOrder:Number(item.sort_order_snapshot),templateRevision:Number(item.template_revision),classificationHint:item.classification_hint,responseKind:item.response_kind_snapshot||'TEXT_FILE',responseKindLegacy:item.response_kind_snapshot==null,submissionState:item.submission_state,reviewStatus:item.review_status,memo:item.memo||'',files:fileOut});
  }
  return {request:{materialRequestId:req.material_request_id,title:req.title,counterparty:req.counterparty,product:req.product_snapshot||{},purpose:req.purpose,status:req.status,reviewStatus:req.review_status,revision:Number(req.revision),templateId:req.template_id,templateRevision:Number(req.template_revision),requestedAt:req.requested_at,submittedAt:req.submitted_at,updatedAt:req.updated_at,manifestRevision:Number(req.manifest_revision)},items:out,assignees:assignees||[],access:{internal:ctx.internal,canManage:accessHas(ctx.access,'MATERIAL_REQUEST_MANAGE'),canReview:accessHas(ctx.access,'MATERIAL_REVIEW'),canTemplate:accessHas(ctx.access,'MATERIAL_TEMPLATE_MANAGE'),canUpload:ctx.internal||ctx.assigned}};
}

export async function materialBootstrap(env,principal,fetchImpl=fetch){
  const ctx=await actorContext(env,principal,fetchImpl);ctx.env=env;
  let requests=[];
  if(ctx.internal){requests=await ctx.db.select('planning_material_requests','order=updated_at.desc&select=material_request_id,title,counterparty,product_snapshot,purpose,status,review_status,revision,requested_at,submitted_at,updated_at,manifest_revision');}
  else{
    const a=await ctx.db.select('planning_material_request_assignees',`account_id=eq.${esc(ctx.actor.row.account_id)}&active=eq.true&select=material_request_id`),ids=(a||[]).map(x=>x.material_request_id);
    requests=ids.length?await ctx.db.select('planning_material_requests',`${ctx.db.inList('material_request_id',ids)}&order=updated_at.desc&select=material_request_id,title,counterparty,product_snapshot,purpose,status,review_status,revision,requested_at,submitted_at,updated_at,manifest_revision`):[];
  }
  let templates=[],accounts=[];
  if(ctx.internal){
    const ts=await ctx.db.select('planning_material_templates','status=eq.ACTIVE&order=created_at.asc&select=*');
    for(const t of ts||[]){
      const [items,publishedRows]=await Promise.all([
        ctx.db.select('planning_material_template_items',`template_id=eq.${esc(t.template_id)}&order=sort_order.asc,item_key.asc&select=*`),
        ctx.db.select('planning_material_template_revisions',`template_id=eq.${esc(t.template_id)}&published_at=not.is.null&order=revision.asc&select=revision,items_snapshot,published_at`)
      ]);
      const everPublished=new Set();
      for(const r of publishedRows||[])for(const x of Array.isArray(r.items_snapshot)?r.items_snapshot:[])if(x?.item_key)everPublished.add(String(x.item_key).toUpperCase());
      templates.push({
        templateId:t.template_id,name:t.name,revision:Number(t.current_revision),publishedRevision:t.published_revision==null?null:Number(t.published_revision),
        lifecycleStatus:t.published_revision!=null&&Number(t.current_revision)===Number(t.published_revision)?'PUBLISHED':'DRAFT',
        items:(items||[]).map(i=>({itemKey:i.item_key,label:i.label,description:i.description,required:i.required===true,sortOrder:Number(i.sort_order),active:i.active===true,classificationHint:i.classification_hint,responseKind:RESPONSE_KINDS.has(i.response_kind)?i.response_kind:'TEXT_FILE',publishedBefore:everPublished.has(String(i.item_key).toUpperCase())}))
      });
    }
    if(accessHas(ctx.access,'MATERIAL_REQUEST_MANAGE'))accounts=await ctx.db.select('workspace_accounts','archived_at=is.null&status=eq.active&order=display_name.asc&select=account_id,username,display_name,role');
  }
  return {mode:ctx.internal?'INTERNAL':'ASSIGNED_UPLOAD',requests:(requests||[]).map(r=>({materialRequestId:r.material_request_id,title:r.title,counterparty:r.counterparty,product:r.product_snapshot||{},purpose:r.purpose,status:r.status,reviewStatus:r.review_status,revision:Number(r.revision),requestedAt:r.requested_at,submittedAt:r.submitted_at,updatedAt:r.updated_at,manifestRevision:Number(r.manifest_revision)})),templates,accounts:(accounts||[]).map(a=>({id:a.account_id,username:a.username,displayName:a.display_name,role:a.role})),access:{canManage:accessHas(ctx.access,'MATERIAL_REQUEST_MANAGE'),canReview:accessHas(ctx.access,'MATERIAL_REVIEW'),canTemplate:accessHas(ctx.access,'MATERIAL_TEMPLATE_MANAGE'),canUploadAssigned:accessHas(ctx.access,'MATERIAL_UPLOAD_ASSIGNED')}};
}

export async function materialGet(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);ctx.env=env;return requestBundle(ctx,String(payload.materialRequestId||''));}
export async function materialTemplateSave(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,'',{template:true});requestIdOf(payload.requestId);if(!Array.isArray(payload.items))throw Error('INVALID_TEMPLATE');for(const item of payload.items){if(!RESPONSE_KINDS.has(String(item?.response_kind||'')))throw Error('INVALID_RESPONSE_KIND');}return unwrap(await ctx.db.rpc('code1_material_save_template',{p_actor_id:ctx.actor.row.account_id,p_template_id:String(payload.templateId||''),p_base_revision:Number(payload.baseRevision),p_items:payload.items,p_request_id:payload.requestId}));}
export async function materialTemplatePublish(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,'',{template:true});requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_publish_template',{p_actor_id:ctx.actor.row.account_id,p_template_id:String(payload.templateId||''),p_revision:Number(payload.revision),p_request_id:payload.requestId}));}
export async function materialRequestCreate(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,'',{manage:true});requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_create_request',{p_actor_id:ctx.actor.row.account_id,p_title:safeText(payload.title,240),p_counterparty:safeText(payload.counterparty,240),p_product_snapshot:payload.product&&typeof payload.product==='object'?payload.product:{},p_purpose:String(payload.purpose||''),p_farm_id:payload.farmId||null,p_template_id:String(payload.templateId||'PMT_GREAT_FARM_DEFAULT'),p_assignees:Array.isArray(payload.assignees)?payload.assignees.map(String):[],p_request_id:payload.requestId}));}
export async function materialAssign(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,String(payload.materialRequestId||''),{manage:true});requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_assign_uploaders',{p_actor_id:ctx.actor.row.account_id,p_material_request_id:String(payload.materialRequestId||''),p_assignees:Array.isArray(payload.assignees)?payload.assignees.map(String):[],p_request_id:payload.requestId}));}
export async function materialItemUpdate(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await loadItemContext(ctx,String(payload.requestItemId||''));requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_set_item_submission',{p_actor_id:ctx.actor.row.account_id,p_request_item_id:String(payload.requestItemId||''),p_submission_state:String(payload.submissionState||''),p_memo:safeText(payload.memo,8000),p_request_id:payload.requestId}));}
export async function materialReview(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,'',{review:true});requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_review_item',{p_actor_id:ctx.actor.row.account_id,p_request_item_id:String(payload.requestItemId||''),p_review_status:String(payload.reviewStatus||''),p_note:safeText(payload.note,4000),p_request_id:payload.requestId}));}
export async function materialSubmit(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);await assertRequestAccess(ctx,String(payload.materialRequestId||''));requestIdOf(payload.requestId);return unwrap(await ctx.db.rpc('code1_material_submit_request',{p_actor_id:ctx.actor.row.account_id,p_material_request_id:String(payload.materialRequestId||''),p_target_status:String(payload.status||'SUBMITTED'),p_request_id:payload.requestId}));}
export async function materialManifest(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl);if(!ctx.internal)throw Error('FORBIDDEN');return unwrap(await ctx.db.rpc('code1_material_manifest',{p_actor_id:ctx.actor.row.account_id,p_material_request_id:String(payload.materialRequestId||'')}));}

export async function materialUploadBegin(env,principal,payload,fetchImpl=fetch){
  const ctx=await actorContext(env,principal,fetchImpl);ctx.env=env;const requestId=requestIdOf(payload.requestId),{item,req}=await loadItemContext(ctx,String(payload.requestItemId||''));
  if(item.response_kind_snapshot!=null&&!['FILE','TEXT_FILE'].includes(item.response_kind_snapshot))throw Error('FIELD_KIND_NO_FILE');
  if(['SUBMITTED','READY_FOR_REVIEW','COMPLETED','ARCHIVED'].includes(req.status)&&!ctx.internal)throw Error('REQUEST_READ_ONLY');
  const fileName=fileNameOf(payload.fileName),fileSize=fileSizeOf(payload.fileSize),{mime}=assertMaterialFileType(fileName,payload.mimeType),checksum=String(payload.sha256||'').toLowerCase();if(!shaPattern.test(checksum))throw Error('INVALID_SHA256');
  const existing=(await ctx.db.select('media_assets',`uploaded_by=eq.${esc(ctx.actor.row.account_id)}&request_id=eq.${esc(requestId)}&source_storage=eq.R2_PRIVATE&select=*`))?.[0];
  if(existing){
    if(existing.media_group!=='PLANNING_MATERIAL'||existing.original_file_name!==fileName||existing.mime_type!==mime||Number(existing.file_size_bytes)!==fileSize||existing.checksum_sha256!==checksum)throw Error('UPLOAD_REQUEST_CONFLICT');
    const version=(await ctx.db.select('planning_material_file_versions',`media_id=eq.${esc(existing.media_id)}&select=*`))?.[0];if(!version)throw Error('UPLOAD_REQUEST_CONFLICT');
    const file=(await ctx.db.select('planning_material_files',`material_file_id=eq.${esc(version.material_file_id)}&select=request_item_id`))?.[0];if(file?.request_item_id!==item.request_item_id)throw Error('UPLOAD_REQUEST_CONFLICT');
    return {sessionId:existing.media_id,mediaId:existing.media_id,materialFileId:version.material_file_id,versionId:version.version_id,revision:Number(version.revision),fileSize,chunkBytes:Number(existing.upload_chunk_bytes)||MATERIAL_CHUNK_BYTES,received:Number(existing.upload_received_bytes)||0,idempotent:true};
  }
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const mediaId=`M_${crypto.randomUUID().replace(/-/g,'').slice(0,24)}`,objectKey=privatePlanningMaterialObjectKey({materialRequestId:req.material_request_id,itemKey:item.item_key,mediaId,fileName});
  const multipart=await env.CODE1_MEDIA_BUCKET.createMultipartUpload(objectKey,{httpMetadata:{contentType:mime},customMetadata:{mediaId,materialRequestId:req.material_request_id,requestItemId:item.request_item_id,itemKey:item.item_key,checksumSha256:checksum}});
  try{
    const dbResult=unwrap(await ctx.db.rpc('code1_material_begin_file_version',{p_actor_id:ctx.actor.row.account_id,p_request_item_id:item.request_item_id,p_material_file_id:payload.materialFileId||null,p_media:{media_id:mediaId,object_key:objectKey,original_file_name:fileName,mime_type:mime,file_size_bytes:fileSize,checksum_sha256:checksum,rights_owner:safeText(payload.rightsOwner,500),rights_use_state:'REVIEW_REQUIRED',r2_multipart_upload_id:multipart.uploadId,upload_chunk_bytes:MATERIAL_CHUNK_BYTES},p_request_id:requestId}));
    return {sessionId:mediaId,mediaId,materialFileId:dbResult.material_file_id,versionId:dbResult.version_id,revision:Number(dbResult.revision),fileSize,chunkBytes:MATERIAL_CHUNK_BYTES,received:0,idempotent:false};
  }catch(error){try{await multipart.abort();}catch{}throw error;}
}

export async function materialUploadChunk(env,principal,payload,fetchImpl=fetch){
  const ctx=await actorContext(env,principal,fetchImpl);requestIdOf(payload.requestId);const id=String(payload.sessionId||payload.mediaId||''),{media}=await loadMediaContext(ctx,id);
  if(media.status!=='UPLOADING'||!media.r2_multipart_upload_id)throw Error('UPLOAD_SESSION_INVALID');if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const total=fileSizeOf(payload.total),expected=Number(media.file_size_bytes);if(total!==expected)throw Error('UPLOAD_TOTAL_MISMATCH');
  const offset=Number(payload.offset),received=Number(media.upload_received_bytes)||0,chunkBytes=Number(media.upload_chunk_bytes)||MATERIAL_CHUNK_BYTES;
  if(!Number.isSafeInteger(offset)||offset<0||offset>=total||offset!==received)throw Error('UPLOAD_OFFSET_CONFLICT');
  const bytes=decodeBase64(payload.base64),expectedSize=Math.min(chunkBytes,total-offset);if(bytes.length!==expectedSize)throw Error('UPLOAD_CHUNK_SIZE_MISMATCH');if(offset+bytes.length<total&&bytes.length<MIN_MULTIPART_PART_BYTES)throw Error('UPLOAD_CHUNK_TOO_SMALL');
  if(offset===0)assertMaterialMagic(bytes,String(media.mime_type||''));
  const hash=await sha256Hex(bytes),parts=parseParts(media.upload_parts),partNumber=parts.length+1;if(partNumber>10000)throw Error('UPLOAD_TOO_MANY_PARTS');
  const multipart=env.CODE1_MEDIA_BUCKET.resumeMultipartUpload(media.object_key,media.r2_multipart_upload_id),uploaded=await multipart.uploadPart(partNumber,bytes),next=offset+bytes.length,nextParts=[...parts,{partNumber:Number(uploaded.partNumber||partNumber),etag:String(uploaded.etag||''),offset,size:bytes.length,sha256:hash}];
  const updated=await ctx.db.update('media_assets',`media_id=eq.${esc(id)}&status=eq.UPLOADING&upload_received_bytes=eq.${received}`,{upload_received_bytes:next,upload_parts:nextParts},'return=representation');
  if(updated?.length)return {sessionId:id,received:next,partNumber,idempotent:false};
  const current=(await ctx.db.select('media_assets',`media_id=eq.${esc(id)}&select=*`))?.[0],prior=parseParts(current?.upload_parts).find(p=>Number(p.offset)===offset);if(Number(current?.upload_received_bytes)>=next&&prior&&Number(prior.size)===bytes.length&&String(prior.sha256)===hash)return {sessionId:id,received:Number(current.upload_received_bytes),partNumber:Number(prior.partNumber),idempotent:true};
  throw Error('UPLOAD_OFFSET_CONFLICT');
}

export async function materialUploadFinish(env,principal,payload,fetchImpl=fetch){
  const ctx=await actorContext(env,principal,fetchImpl),requestId=requestIdOf(payload.requestId),id=String(payload.sessionId||payload.mediaId||''),bundle=await loadMediaContext(ctx,id),media=bundle.media;
  if(!env.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');if(!['UPLOADING','REVIEW_REQUIRED'].includes(media.status))throw Error('UPLOAD_SESSION_INVALID');
  let head=await env.CODE1_MEDIA_BUCKET.head(media.object_key);
  if(!head){if(media.status!=='UPLOADING'||!media.r2_multipart_upload_id||Number(media.upload_received_bytes)!==Number(media.file_size_bytes))throw Error('UPLOAD_INCOMPLETE');const parts=parseParts(media.upload_parts);if(!parts.length)throw Error('UPLOAD_INCOMPLETE');const multipart=env.CODE1_MEDIA_BUCKET.resumeMultipartUpload(media.object_key,media.r2_multipart_upload_id);await multipart.complete(parts.map(p=>({partNumber:Number(p.partNumber),etag:String(p.etag)})));head=await env.CODE1_MEDIA_BUCKET.head(media.object_key);}
  if(!head||Number(head.size)!==Number(media.file_size_bytes))throw Error('R2_SIZE_MISMATCH');const type=String(head.httpMetadata?.contentType||'');if(type&&type!==String(media.mime_type||''))throw Error('R2_MIME_MISMATCH');const declared=String(head.customMetadata?.checksumSha256||'');if(declared&&declared!==String(media.checksum_sha256||''))throw Error('R2_CHECKSUM_METADATA_MISMATCH');
  const result=unwrap(await ctx.db.rpc('code1_material_finalize_file_version',{p_actor_id:ctx.actor.row.account_id,p_media_id:id,p_request_id:requestId}));
  return {...result,file:{fileName:media.original_file_name,mime:media.mime_type,size:Number(media.file_size_bytes),sha256:media.checksum_sha256,confidentiality:'INTERNAL_RESTRICTED',publicDeliveryAllowed:false}};
}

export async function materialFileRead(env,principal,payload,fetchImpl=fetch){const ctx=await actorContext(env,principal,fetchImpl),bundle=await loadMediaContext(ctx,String(payload.mediaId||''));const token=await issueMediaReadToken(env,{accountId:ctx.actor.row.account_id,mediaId:bundle.media.media_id,objectKey:bundle.media.object_key,mimeType:bundle.media.mime_type});return {mediaId:bundle.media.media_id,fileName:bundle.media.original_file_name,mime:bundle.media.mime_type,size:Number(bundle.media.file_size_bytes),sha256:bundle.media.checksum_sha256,url:`/api/staging/media-get?token=${encodeURIComponent(token)}`,expiresInSeconds:300,confidentiality:bundle.version.confidentiality,publicDeliveryAllowed:false};}

const ACTIONS=new Set(['planning.material.bootstrap','planning.material.request.get','planning.material.template.save','planning.material.template.publish','planning.material.request.create','planning.material.request.assign','planning.material.item.update','planning.material.review','planning.material.request.submit','planning.material.manifest','planning.material.upload.begin','planning.material.upload.chunk','planning.material.upload.finish','planning.material.file.read']);
export function isPlanningMaterialAction(action){return ACTIONS.has(action);}
export async function dispatchPlanningMaterial(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'planning.material.bootstrap':return materialBootstrap(env,principal,fetchImpl);
    case 'planning.material.request.get':return materialGet(env,principal,payload,fetchImpl);
    case 'planning.material.template.save':return materialTemplateSave(env,principal,payload,fetchImpl);
    case 'planning.material.template.publish':return materialTemplatePublish(env,principal,payload,fetchImpl);
    case 'planning.material.request.create':return materialRequestCreate(env,principal,payload,fetchImpl);
    case 'planning.material.request.assign':return materialAssign(env,principal,payload,fetchImpl);
    case 'planning.material.item.update':return materialItemUpdate(env,principal,payload,fetchImpl);
    case 'planning.material.review':return materialReview(env,principal,payload,fetchImpl);
    case 'planning.material.request.submit':return materialSubmit(env,principal,payload,fetchImpl);
    case 'planning.material.manifest':return materialManifest(env,principal,payload,fetchImpl);
    case 'planning.material.upload.begin':return materialUploadBegin(env,principal,payload,fetchImpl);
    case 'planning.material.upload.chunk':return materialUploadChunk(env,principal,payload,fetchImpl);
    case 'planning.material.upload.finish':return materialUploadFinish(env,principal,payload,fetchImpl);
    case 'planning.material.file.read':return materialFileRead(env,principal,payload,fetchImpl);
    default:throw Error('PLANNING_MATERIAL_ACTION_NOT_IMPLEMENTED');
  }
}
