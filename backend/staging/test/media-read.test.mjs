import test from 'node:test';import assert from 'node:assert/strict';import {issueMediaReadToken,verifyMediaReadToken} from '../src/media-read.mjs';
const env={CODE1_MEDIA_TOKEN_SECRET:'r'.repeat(64)};
test('private media read token expires and carries exact object key',async()=>{const t=await issueMediaReadToken(env,{accountId:'OWNER',mediaId:'M1',objectKey:'private/a.jpg',mimeType:'image/jpeg'},100);assert.equal((await verifyMediaReadToken(env,t,101)).objectKey,'private/a.jpg');assert.equal(await verifyMediaReadToken(env,t,100+6*60*1000),null);});
