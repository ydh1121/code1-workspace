import test from 'node:test';
import assert from 'node:assert/strict';
import {issueMediaReadToken,verifyMediaReadToken,handleAuthorizedMediaGet} from '../src/media-read.mjs';

const secrets={CODE1_MEDIA_TOKEN_SECRET:'r'.repeat(64)};

async function readToken(now=Date.now()){
  return issueMediaReadToken(secrets,{accountId:'OWNER',mediaId:'M1',objectKey:'private/farms/GF-1/submissions/SUB-1/media/M1/original/a.jpg',mimeType:'image/jpeg'},now);
}

function getRequest(token=''){
  return new Request(`https://staging.example/api/staging/media-get?token=${encodeURIComponent(token)}`);
}

test('private media read token expires and carries exact object key',async()=>{
  const t=await readToken(100);
  assert.equal((await verifyMediaReadToken(secrets,t,101)).objectKey,'private/farms/GF-1/submissions/SUB-1/media/M1/original/a.jpg');
  assert.equal(await verifyMediaReadToken(secrets,t,100+6*60*1000),null);
});

test('private media GET fails closed without R2 binding',async()=>{
  const r=await handleAuthorizedMediaGet(getRequest(),secrets);
  assert.equal(r.status,503);
  assert.equal(await r.text(),'R2_BINDING_REQUIRED');
});

test('private media GET denies invalid token before object read',async()=>{
  let reads=0;
  const env={...secrets,CODE1_MEDIA_BUCKET:{async get(){reads++;return null;}}};
  const r=await handleAuthorizedMediaGet(getRequest('invalid'),env);
  assert.equal(r.status,403);
  assert.equal(reads,0);
});

test('private media GET returns 404 when authorized object is absent',async()=>{
  const t=await readToken();
  const env={...secrets,CODE1_MEDIA_BUCKET:{async get(){return null;}}};
  const r=await handleAuthorizedMediaGet(getRequest(t),env);
  assert.equal(r.status,404);
});

test('private media GET serves only the token object with private headers',async()=>{
  const t=await readToken();
  let key='';
  const env={...secrets,CODE1_MEDIA_BUCKET:{async get(k){key=k;return {body:new Uint8Array([1,2,3]),httpEtag:'etag-1'};}}};
  const r=await handleAuthorizedMediaGet(getRequest(t),env);
  assert.equal(r.status,200);
  assert.equal(key,'private/farms/GF-1/submissions/SUB-1/media/M1/original/a.jpg');
  assert.equal(r.headers.get('Content-Type'),'image/jpeg');
  assert.equal(r.headers.get('Cache-Control'),'private, max-age=120');
  assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal(r.headers.get('ETag'),'etag-1');
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
});
