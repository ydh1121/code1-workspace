import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_MULTIPART_CHUNK_BYTES,
  beginMultipartMediaUpload,
  uploadMultipartMediaChunk,
  finishMultipartMediaUpload,
  smallR2MediaUpload
} from '../src/media-upload-runtime.mjs';

const ref='abcdefghijklmnopqrst';
const principal={accountId:'OWNER',version:2};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',email:'',role:'SUPER_ADMIN',status:'active',permissions_json:{farm:'edit'},session_version:2};
const secret='test-only-secret-0123456789-abcdef';
const baseEnv={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48),CODE1_UPLOAD_TOKEN_SECRET:secret};
const sub={submission_id:'SUB-1',farm_id:'GF-1',status:'DRAFT'};

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
function mockFetch(handler){return async(url,init={})=>handler(new URL(url),init);}
function accountOr(handler){return mockFetch((u,init)=>{
  if(u.pathname==='/rest/v1/workspace_accounts')return response([owner]);
  return handler(u,init);
});}
function mediaRow(extra={}){return {media_id:'M_testmedia000000000000001',upload_id:'M_testmedia000000000000001',submission_id:'SUB-1',farm_id:'GF-1',media_group:'PHOTO',shot_code:'P-01',shot_label:'포장',original_file_name:'photo.jpg',object_key:'private/farms/GF-1/submissions/SUB-1/media/M_testmedia000000000000001/original/photo.jpg',mime_type:'image/jpeg',file_size_bytes:1024,status:'UPLOADING',request_id:'a'.repeat(32),uploaded_by:'OWNER',source_storage:'R2_PRIVATE',r2_multipart_upload_id:'mpu-1',upload_chunk_bytes:MEDIA_MULTIPART_CHUNK_BYTES,upload_received_bytes:0,upload_parts:[],...extra};}

test('begin creates one private multipart session with 6 MiB chunks',async()=>{
  let inserted=null,createCalls=0;
  const bucket={createMultipartUpload:async()=>{createCalls++;return {uploadId:'mpu-1',abort:async()=>{}};}};
  const fetchImpl=accountOr((u,init)=>{
    if(u.pathname==='/rest/v1/intake_submissions')return response([sub]);
    if(u.pathname==='/rest/v1/media_assets'&&(init.method||'GET')==='GET')return response([]);
    if(u.pathname==='/rest/v1/media_assets'&&init.method==='POST'){inserted=JSON.parse(init.body);return response(null);}
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname} ${u.search}`);
  });
  const result=await beginMultipartMediaUpload({...baseEnv,CODE1_MEDIA_BUCKET:bucket},principal,{submissionId:'SUB-1',shotCode:'P-01',fileName:'photo.jpg',mimeType:'image/jpeg',fileSize:9*1024*1024,requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(createCalls,1);
  assert.equal(result.chunkBytes,6*1024*1024);
  assert.equal(result.received,0);
  assert.equal(inserted.r2_multipart_upload_id,'mpu-1');
  assert.equal(inserted.source_storage,'R2_PRIVATE');
});

test('begin retry with same actor request id reuses the existing media identity',async()=>{
  const existing=mediaRow({file_size_bytes:9*1024*1024,upload_received_bytes:6*1024*1024});
  let createCalls=0;
  const bucket={createMultipartUpload:async()=>{createCalls++;throw Error('should not create');}};
  const fetchImpl=accountOr((u,init)=>{
    if(u.pathname==='/rest/v1/intake_submissions')return response([sub]);
    if(u.pathname==='/rest/v1/media_assets')return response([existing]);
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await beginMultipartMediaUpload({...baseEnv,CODE1_MEDIA_BUCKET:bucket},principal,{submissionId:'SUB-1',fileName:'photo.jpg',mimeType:'image/jpeg',fileSize:9*1024*1024,requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(createCalls,0);
  assert.equal(result.mediaId,existing.media_id);
  assert.equal(result.received,6*1024*1024);
});

test('chunk uploads the expected next part and persists monotonic received bytes',async()=>{
  const bytes=new Uint8Array(1024);bytes.fill(7);
  const row=mediaRow();
  let patch=null,partNumber=null;
  const bucket={resumeMultipartUpload:()=>({uploadPart:async(n,value)=>{partNumber=n;assert.equal(value.length,1024);return {partNumber:n,etag:'etag-1'};}})};
  const fetchImpl=accountOr((u,init)=>{
    if(u.pathname==='/rest/v1/media_assets'&&(init.method||'GET')==='GET')return response([row]);
    if(u.pathname==='/rest/v1/media_assets'&&init.method==='PATCH'){patch=JSON.parse(init.body);return response([{...row,...patch}]);}
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname} ${u.search}`);
  });
  const result=await uploadMultipartMediaChunk({...baseEnv,CODE1_MEDIA_BUCKET:bucket},principal,{sessionId:row.media_id,offset:0,total:1024,base64:Buffer.from(bytes).toString('base64'),requestId:'b'.repeat(32)},fetchImpl);
  assert.equal(partNumber,1);
  assert.equal(result.received,1024);
  assert.equal(patch.upload_received_bytes,1024);
  assert.equal(patch.upload_parts[0].etag,'etag-1');
  assert.match(patch.upload_parts[0].sha256,/^[a-f0-9]{64}$/);
});

test('finish recovers after multipart completion when the final object already exists',async()=>{
  const row=mediaRow({upload_received_bytes:1024,upload_parts:[{partNumber:1,etag:'etag-1',offset:0,size:1024,sha256:'0'.repeat(64)}]});
  let resumeCalls=0,finalizeBody=null;
  const bucket={head:async()=>({size:1024,httpMetadata:{contentType:'image/jpeg'}}),resumeMultipartUpload:()=>{resumeCalls++;throw Error('should not resume completed object');}};
  const fetchImpl=accountOr((u,init)=>{
    if(u.pathname==='/rest/v1/media_assets')return response([row]);
    if(u.pathname==='/rest/v1/rpc/code1_finalize_media_upload'){finalizeBody=JSON.parse(init.body);return response([{...row,status:'REVIEW_REQUIRED'}]);}
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await finishMultipartMediaUpload({...baseEnv,CODE1_MEDIA_BUCKET:bucket},principal,{sessionId:row.media_id,requestId:'c'.repeat(32)},fetchImpl);
  assert.equal(resumeCalls,0);
  assert.equal(finalizeBody.p_media_id,row.media_id);
  assert.equal(result.media.status,'REVIEW_REQUIRED');
});

test('small upload removes the new R2 object when atomic DB registration fails',async()=>{
  const bytes=Buffer.from('small-private-object');
  let deleted='',put='';
  const bucket={put:async key=>{put=key;},delete:async key=>{deleted=key;}};
  const fetchImpl=accountOr((u,init)=>{
    if(u.pathname==='/rest/v1/intake_submissions')return response([sub]);
    if(u.pathname==='/rest/v1/media_assets')return response([]);
    if(u.pathname==='/rest/v1/question_catalog')return response([{item_label:'포장'}]);
    if(u.pathname==='/rest/v1/rpc/code1_register_media_upload')return response({message:'forced failure'},500);
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  await assert.rejects(()=>smallR2MediaUpload({...baseEnv,CODE1_MEDIA_BUCKET:bucket},principal,{kind:'FARM',submissionId:'SUB-1',shotCode:'P-01',fileName:'photo.jpg',mimeType:'image/jpeg',base64:bytes.toString('base64'),requestId:'d'.repeat(32)},fetchImpl));
  assert.ok(put);
  assert.equal(deleted,put);
});
