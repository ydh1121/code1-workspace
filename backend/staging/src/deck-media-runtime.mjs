import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {issueMediaReadToken} from './media-read.mjs';
import {DECK_ID} from './deck-contract.mjs';

const esc=encodeURIComponent;
const MAX_DECK_ASSET_BYTES=8*1024*1024;
const ALLOWED_MIME=new Set(['image/jpeg','image/png','image/webp']);
const REQUEST_ID=/^[a-f0-9]{32}$/;

function deckLevel(actor){return String(actor?.user?.permissions?.deck||'none');}
function assertDeckRead(actor){if(!['view','edit'].includes(deckLevel(actor)))throw Error('FORBIDDEN');}
function assertDeckEdit(actor){if(deckLevel(actor)!=='edit')throw Error('FORBIDDEN');}
function requestIdOf(value){const id=String(value||'');if(!REQUEST_ID.test(id))throw Error('INVALID_REQUEST');return id;}
function fileNameOf(value){return (String(value||'deck-image').slice(0,255)||'deck-image');}
function mimeOf(value){const mime=String(value||'').toLowerCase();if(!ALLOWED_MIME.has(mime))throw Error('PREVIEW_NOT_SUPPORTED');return mime;}
function decodeBase64(value){try{const bytes=Uint8Array.from(atob(String(value||'')),c=>c.charCodeAt(0));if(!bytes.length||bytes.length>MAX_DECK_ASSET_BYTES)throw Error('PREVIEW_TOO_LARGE');return bytes;}catch(error){if(error?.message==='PREVIEW_TOO_LARGE')throw error;throw Error('INVALID_DECK_MEDIA');}}
function assetIdFor(requestId){return `M_${requestId.slice(0,24)}`;}
function objectKeyFor(assetId){return `private/decks/${DECK_ID}/assets/${assetId}`;}
async function sha256Hex(bytes){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');}
function metaObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}

function assertExactAsset(row,expected){
  if(!row
    ||String(row.asset_id)!==expected.assetId
    ||String(row.object_key)!==expected.objectKey
    ||String(row.mime_type)!==expected.mimeType
    ||Number(row.file_size_bytes)!==expected.fileSize
    ||String(row.checksum_sha256)!==expected.checksum
    ||String(row.source_kind)!=='STAGING_UPLOAD'
    ||String(row.state)!=='ACTIVE')throw Error('UPLOAD_REQUEST_CONFLICT');
}

async function existingForRequest(db,actorId,requestId){
  const rows=await db.select('deck_assets',`deck_id=eq.${esc(DECK_ID)}&registered_by=eq.${esc(actorId)}&request_id=eq.${esc(requestId)}&select=*`);
  return rows?.[0]||null;
}

async function verifyStoredObject(env,expected){
  if(!env?.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const head=await env.CODE1_MEDIA_BUCKET.head(expected.objectKey);
  if(!head)return false;
  if(Number(head.size)!==expected.fileSize)throw Error('R2_OBJECT_CONFLICT');
  const tagged=String(head.customMetadata?.checksumSha256||'');
  if(tagged){if(tagged!==expected.checksum)throw Error('R2_OBJECT_CONFLICT');return true;}
  const object=await env.CODE1_MEDIA_BUCKET.get(expected.objectKey);
  if(!object)throw Error('R2_OBJECT_CONFLICT');
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.length!==expected.fileSize||await sha256Hex(bytes)!==expected.checksum)throw Error('R2_OBJECT_CONFLICT');
  return true;
}

function uploadPublic(row){
  const metadata=metaObject(row.metadata);
  return {
    upload_id:row.asset_id,
    media_id:row.asset_id,
    file_name:metadata.original_file_name||row.source_ref||row.asset_id,
    mime_type:row.mime_type,
    file_size_bytes:Number(row.file_size_bytes),
    status:'ACTIVE',
    caption:metadata.caption||row.review_note||'',
    rights_owner:metadata.rights_owner||row.rights_status||'',
    b2b_use:metadata.b2b_use||row.usage_note||''
  };
}

function assetRegistrationPayload({assetId,objectKey,mimeType,fileSize,checksum,fileName,metadata}){
  return {
    asset_id:assetId,
    deck_id:DECK_ID,
    object_key:objectKey,
    mime_type:mimeType,
    file_size_bytes:fileSize,
    checksum_sha256:checksum,
    source_kind:'STAGING_UPLOAD',
    source_ref:fileName,
    rights_status:String(metadata.rights_owner||'').slice(0,500),
    usage_note:String(metadata.b2b_use||'').slice(0,500),
    review_note:String(metadata.caption||'').slice(0,1000),
    metadata:{...metadata,original_file_name:fileName}
  };
}

export async function uploadDeckAssetWithContext({db,actor,env,payload}){
  assertDeckEdit(actor);
  const requestId=requestIdOf(payload?.requestId),bytes=decodeBase64(payload?.base64),mimeType=mimeOf(payload?.mimeType),fileName=fileNameOf(payload?.fileName),metadata=metaObject(payload?.metadata);
  const assetId=assetIdFor(requestId),objectKey=objectKeyFor(assetId),checksum=await sha256Hex(bytes);
  const expected={assetId,objectKey,mimeType,fileSize:bytes.length,checksum};

  const prior=await existingForRequest(db,actor.row.account_id,requestId);
  if(prior){assertExactAsset(prior,expected);await verifyStoredObject(env,expected);return uploadPublic(prior);}
  if(!env?.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');

  const preexistingObject=await verifyStoredObject(env,expected);
  let createdNow=false;
  if(!preexistingObject){
    await env.CODE1_MEDIA_BUCKET.put(objectKey,bytes,{
      httpMetadata:{contentType:mimeType},
      customMetadata:{assetId,deckId:DECK_ID,requestId,checksumSha256:checksum}
    });
    createdNow=true;
    if(!await verifyStoredObject(env,expected))throw Error('R2_OBJECT_MISSING');
  }

  const registration=assetRegistrationPayload({assetId,objectKey,mimeType,fileSize:bytes.length,checksum,fileName,metadata});
  try{
    const saved=await db.rpc('code1_register_deck_asset',{p_actor_id:actor.row.account_id,p_request_id:requestId,p_asset:registration});
    const row=saved?.[0];
    assertExactAsset(row,expected);
    return uploadPublic(row);
  }catch(error){
    const raced=await existingForRequest(db,actor.row.account_id,requestId);
    if(raced){assertExactAsset(raced,expected);return uploadPublic(raced);}
    if(createdNow){try{await env.CODE1_MEDIA_BUCKET.delete(objectKey);}catch{throw Error('R2_ORPHAN_COMPENSATION_FAILED');}}
    throw error;
  }
}

export async function uploadDeckAsset(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  return uploadDeckAssetWithContext({db,actor,env,payload});
}

export async function readDeckMediaWithContext({db,actor,env,id,tokenIssuer=issueMediaReadToken}){
  const rows=await db.select('deck_assets',`deck_id=eq.${esc(DECK_ID)}&asset_id=eq.${esc(id)}&state=eq.ACTIVE&select=*`);
  const row=rows?.[0];
  if(!row)return null;
  assertDeckRead(actor);
  if(!env?.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const head=await env.CODE1_MEDIA_BUCKET.head(row.object_key);
  if(!head||Number(head.size)!==Number(row.file_size_bytes))throw Error('R2_OBJECT_MISMATCH');
  const token=await tokenIssuer(env,{accountId:actor.row.account_id,mediaId:row.asset_id,objectKey:row.object_key,mimeType:row.mime_type});
  const metadata=metaObject(row.metadata);
  return {
    ...uploadPublic(row),
    url:`/api/staging/media-get?token=${encodeURIComponent(token)}`,
    source:row.source_ref||'',
    rights_status:row.rights_status||'',
    usage:row.usage_note||'',
    note:row.review_note||metadata.caption||'아자몰 작업본 이미지'
  };
}

export async function getDeckMediaMaybe(env,principal,payload,fetchImpl=fetch){
  const id=String(payload?.id||'');
  if(!id)return null;
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  return readDeckMediaWithContext({db,actor,env,id});
}

export const deckAssetIdForRequest=assetIdFor;
export const deckAssetObjectKey=objectKeyFor;
