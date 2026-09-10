import test from 'node:test';
import assert from 'node:assert/strict';
import {issueUploadAuthorization} from '../src/upload-auth.mjs';
import {handleAuthorizedMediaPut} from '../src/media-put.mjs';

const secrets={CODE1_UPLOAD_TOKEN_SECRET:'u'.repeat(64)};

async function authFor(overrides={}){
  return issueUploadAuthorization(secrets,{accountId:'OWNER',farmId:'GF-1',submissionId:'SUB-1',mediaId:'M-1',fileName:'original.jpg',mimeType:'image/jpeg',fileSize:3,...overrides});
}

function putRequest(token,{length='3',type='image/jpeg',body='abc'}={}){
  return new Request(`https://staging.example/api/staging/media-put?token=${encodeURIComponent(token)}`,{method:'PUT',headers:{'Content-Length':length,'Content-Type':type},body});
}

test('media PUT fails closed without R2 binding',async()=>{
  const r=await handleAuthorizedMediaPut(new Request('https://staging.example/api/staging/media-put',{method:'PUT'}),secrets);
  assert.equal(r.status,503);
  assert.equal(await r.text(),'R2_BINDING_REQUIRED');
});

test('media PUT denies expired or invalid authorization',async()=>{
  const a=await issueUploadAuthorization(secrets,{accountId:'OWNER',farmId:'GF-1',submissionId:'SUB-1',mediaId:'M-1',fileName:'a.jpg',mimeType:'image/jpeg',fileSize:3},0);
  const env={...secrets,CODE1_MEDIA_BUCKET:{put(){throw Error('must not write');}}};
  const r=await handleAuthorizedMediaPut(putRequest(a.token),env);
  assert.equal(r.status,403);
});

test('media PUT enforces exact declared size and MIME',async()=>{
  const a=await authFor();
  const env={...secrets,CODE1_MEDIA_BUCKET:{put(){throw Error('must not write');}}};
  assert.equal((await handleAuthorizedMediaPut(putRequest(a.token,{length:'2',body:'ab'}),env)).status,413);
  assert.equal((await handleAuthorizedMediaPut(putRequest(a.token,{type:'image/png'}),env)).status,415);
});

test('media PUT writes only the authorized private object key',async()=>{
  const a=await authFor();
  let call=null;
  const env={...secrets,CODE1_MEDIA_BUCKET:{async put(key,body,options){call={key,body,options};}}};
  const r=await handleAuthorizedMediaPut(putRequest(a.token),env);
  assert.equal(r.status,201);
  assert.equal(call.key,a.objectKey);
  assert.equal(call.options.httpMetadata.contentType,'image/jpeg');
  assert.equal(call.options.customMetadata.mediaId,'M-1');
  assert.equal(call.options.customMetadata.farmId,'GF-1');
  assert.equal(call.options.customMetadata.submissionId,'SUB-1');
  assert.ok(call.body);
});
