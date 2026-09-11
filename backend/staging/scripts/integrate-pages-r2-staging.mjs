#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const PROJECT_SUFFIX='.code1-workspace.pages.dev';
const SMALL_BYTES=128*1024;
const MULTIPART_CHUNK_BYTES=6*1024*1024;
const MULTIPART_TOTAL_BYTES=11*1024*1024;

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0 ? process.argv[i+1] : '';
}
function flag(name){return process.argv.includes(name);}
function assertArgs(){
  const valued=new Set(['--base-url','--account-id','--session-version']);
  const flags=new Set(['--confirm-staging-r2-write']);
  for(let i=2;i<process.argv.length;i++){
    const a=process.argv[i];
    if(flags.has(a))continue;
    if(!valued.has(a))throw Error(`UNKNOWN_ARGUMENT ${a}`);
    if(i+1>=process.argv.length||process.argv[i+1].startsWith('--'))throw Error(`MISSING_VALUE ${a}`);
    i++;
  }
}
function gitBranch(){
  return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
}
function exactPreviewOrigin(raw){
  let u;
  try{u=new URL(String(raw||'').trim());}catch{throw Error('INVALID_BASE_URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('INVALID_BASE_URL');
  const host=u.hostname.toLowerCase();
  if(host==='code1-workspace.pages.dev'||!host.endsWith(PROJECT_SUFFIX))throw Error('PREVIEW_HOST_REQUIRED_PRODUCTION_FORBIDDEN');
  return u.origin;
}
function requestId(){return crypto.randomBytes(16).toString('hex');}
function b64uJson(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');}
function sessionCookie(secret,accountId,version){
  if(!secret||secret.length<32)throw Error('CODE1_TEST_SESSION_SECRET_REQUIRED');
  if(!accountId||!Number.isInteger(version)||version<1)throw Error('INVALID_TEST_PRINCIPAL');
  const now=Date.now();
  const body=b64uJson({kind:'session',accountId,version,method:'integration',authAt:now,exp:now+60*60*1000});
  const sig=crypto.createHmac('sha256',secret).update(body).digest('hex');
  return `__Host-code1=${body}.${sig}`;
}
async function fetchText(url,options={}){
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60000),...options});
  const text=await response.text();
  return {response,text};
}
async function rpc(base,cookie,action,payload){
  const {response,text}=await fetchText(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},
    body:JSON.stringify({action,payload})
  });
  let json=null;try{json=JSON.parse(text);}catch{}
  if(!response.ok)throw Error(`RPC_${action}_FAILED status=${response.status} body=${String(text).replace(/\s+/g,' ').slice(0,300)}`);
  if(!json||!Object.prototype.hasOwnProperty.call(json,'data'))throw Error(`RPC_${action}_INVALID_RESPONSE`);
  return json.data;
}
async function expectRpcDenied(base,cookie,action,payload){
  const {response,text}=await fetchText(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},
    body:JSON.stringify({action,payload})
  });
  if(response.ok)throw Error(`RPC_${action}_EXPECTED_DENIAL_GOT_${response.status}`);
  console.log(`DENIAL_${action}: status=${response.status} body=${String(text).replace(/\s+/g,' ').slice(0,180)}`);
}
async function privateGet(base,relativeUrl){
  const url=new URL(relativeUrl,base);
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60000)});
  const bytes=Buffer.from(await response.arrayBuffer());
  return {response,bytes,url};
}
function tamperTokenUrl(url){
  const u=new URL(url);
  const token=u.searchParams.get('token')||'';
  if(token.length<8)throw Error('MEDIA_TOKEN_MISSING');
  const last=token.at(-1);
  u.searchParams.set('token',token.slice(0,-1)+(last==='A'?'B':'A'));
  return u;
}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function deterministicBytes(size,label){
  const seed=crypto.createHash('sha256').update(label).digest();
  const out=Buffer.allocUnsafe(size);
  for(let i=0;i<size;i++)out[i]=seed[i%seed.length]^(i&0xff);
  return out;
}
function findWritableSubmission(bootstrap){
  const rows=Array.isArray(bootstrap?.submissions)?bootstrap.submissions:[];
  return rows.find(r=>!['APPROVED','REFLECTED'].includes(String(r?.status||''))&&r?.id&&r?.farmId)||null;
}

assertArgs();
if(!flag('--confirm-staging-r2-write'))throw Error('CONFIRMATION_REQUIRED --confirm-staging-r2-write');
const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=exactPreviewOrigin(arg('--base-url'));
const accountId=String(arg('--account-id')||'OWNER');
const sessionVersion=Number(arg('--session-version')||'0');
if(!Number.isInteger(sessionVersion)||sessionVersion<1)throw Error('SESSION_VERSION_REQUIRED');
const secret=String(process.env.CODE1_TEST_SESSION_SECRET||'');
const cookie=sessionCookie(secret,accountId,sessionVersion);

console.log('CODE1 Pages Preview R2 STAGING integration');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log(`accountId=${accountId}`);
console.log(`sessionVersion=${sessionVersion}`);
console.log('REMOTE_MUTATION=STAGING_ONLY_CONFIRMED');
console.log('PRODUCTION_MUTATION=DISALLOWED');
console.log('LEGACY_DRIVE_MUTATION=DISALLOWED');

const cleanupIds=[];
let primaryError=null;
try{
  const session=await fetch(`${base}/api/session`,{headers:{Cookie:cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
  const sessionJson=await session.json().catch(()=>null);
  if(session.status!==200||sessionJson?.configured!==true||sessionJson?.authenticated!==true)throw Error(`SIGNED_SESSION_REJECTED status=${session.status}`);
  console.log('SIGNED_SESSION=PASS');

  const bootstrap=await rpc(base,cookie,'bootstrap',{});
  if(bootstrap?.performance?.backend!=='SUPABASE_STAGING')throw Error('BOOTSTRAP_BACKEND_MISMATCH');
  const submission=findWritableSubmission(bootstrap);
  if(!submission)throw Error('NO_WRITABLE_STAGING_SUBMISSION');
  console.log(`bootstrapBackend=${bootstrap.performance.backend}`);
  console.log(`testSubmission=${submission.id}`);
  console.log(`testFarm=${submission.farmId}`);

  const stamp=Date.now();
  const small=deterministicBytes(SMALL_BYTES,`code1-small-${stamp}`);
  const smallReq=requestId();
  const smallPayload={
    kind:'FARM',submissionId:submission.id,requestId:smallReq,
    fileName:`code1-integration-small-${stamp}.bin`,mimeType:'application/octet-stream',
    base64:small.toString('base64'),
    metadata:{caption:'CODE1 STAGING R2 integration test',rights_owner:'CODE1 STAGING TEST',privacy_checked:'Y'}
  };
  const smallMedia=await rpc(base,cookie,'upload',smallPayload);
  if(!smallMedia?.media_id||smallMedia.status!=='REVIEW_REQUIRED')throw Error('SMALL_UPLOAD_INVALID_RESULT');
  cleanupIds.push(smallMedia.media_id);
  console.log(`SMALL_PUT=PASS mediaId=${smallMedia.media_id} bytes=${small.length}`);

  const smallRetry=await rpc(base,cookie,'upload',smallPayload);
  if(smallRetry?.media_id!==smallMedia.media_id)throw Error('SMALL_UPLOAD_RETRY_NOT_IDEMPOTENT');
  console.log('SMALL_PUT_RETRY_IDEMPOTENT=PASS');

  const smallReadMeta=await rpc(base,cookie,'media',{id:smallMedia.media_id});
  if(!smallReadMeta?.url)throw Error('SMALL_PRIVATE_URL_MISSING');
  const smallRead=await privateGet(base,smallReadMeta.url);
  if(smallRead.response.status!==200||smallRead.bytes.length!==small.length||sha256(smallRead.bytes)!==sha256(small))throw Error(`SMALL_PRIVATE_GET_MISMATCH status=${smallRead.response.status}`);
  console.log('SMALL_PRIVATE_GET=PASS');

  const tampered=await fetch(tamperTokenUrl(smallRead.url),{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(tampered.status!==403)throw Error(`TAMPERED_TOKEN_DENIAL_FAILED status=${tampered.status}`);
  console.log('TAMPERED_MEDIA_TOKEN_DENIAL=PASS');

  const multipart=deterministicBytes(MULTIPART_TOTAL_BYTES,`code1-multipart-${stamp}`);
  const multiReq=requestId();
  const beginPayload={
    submissionId:submission.id,requestId:multiReq,
    fileName:`code1-integration-multipart-${stamp}.bin`,mimeType:'application/octet-stream',
    fileSize:multipart.length,mediaGroup:'PHOTO',
    metadata:{caption:'CODE1 STAGING multipart integration test',rights_owner:'CODE1 STAGING TEST',privacy_checked:'Y'}
  };
  const begin=await rpc(base,cookie,'mediaUpload.begin',beginPayload);
  if(!begin?.sessionId||Number(begin.fileSize)!==multipart.length)throw Error('MULTIPART_BEGIN_INVALID_RESULT');
  cleanupIds.push(begin.sessionId);
  console.log(`MULTIPART_BEGIN=PASS mediaId=${begin.sessionId} bytes=${multipart.length}`);

  const beginRetry=await rpc(base,cookie,'mediaUpload.begin',beginPayload);
  if(beginRetry?.sessionId!==begin.sessionId)throw Error('MULTIPART_BEGIN_RETRY_NOT_IDEMPOTENT');
  console.log('MULTIPART_BEGIN_RETRY_IDEMPOTENT=PASS');

  const part1=multipart.subarray(0,MULTIPART_CHUNK_BYTES);
  const chunk1Payload={sessionId:begin.sessionId,requestId:multiReq,offset:0,total:multipart.length,base64:part1.toString('base64')};
  const chunk1=await rpc(base,cookie,'mediaUpload.chunk',chunk1Payload);
  if(Number(chunk1?.received)!==part1.length)throw Error('MULTIPART_CHUNK1_INVALID_RESULT');
  console.log('MULTIPART_CHUNK1=PASS');

  const chunk1Retry=await rpc(base,cookie,'mediaUpload.chunk',chunk1Payload);
  if(chunk1Retry?.idempotent!==true||Number(chunk1Retry?.received)!==part1.length)throw Error('MULTIPART_CHUNK_RETRY_NOT_IDEMPOTENT');
  console.log('MULTIPART_CHUNK_RETRY_IDEMPOTENT=PASS');

  const part2=multipart.subarray(MULTIPART_CHUNK_BYTES);
  const chunk2=await rpc(base,cookie,'mediaUpload.chunk',{
    sessionId:begin.sessionId,requestId:multiReq,offset:MULTIPART_CHUNK_BYTES,total:multipart.length,base64:part2.toString('base64')
  });
  if(Number(chunk2?.received)!==multipart.length)throw Error('MULTIPART_CHUNK2_INVALID_RESULT');
  console.log('MULTIPART_CHUNK2=PASS');

  const finish=await rpc(base,cookie,'mediaUpload.finish',{sessionId:begin.sessionId,requestId:multiReq});
  if(finish?.media?.media_id!==begin.sessionId||finish?.media?.status!=='REVIEW_REQUIRED')throw Error('MULTIPART_FINISH_INVALID_RESULT');
  console.log('MULTIPART_FINISH_HEAD_DB=PASS');

  const finishRetry=await rpc(base,cookie,'mediaUpload.finish',{sessionId:begin.sessionId,requestId:multiReq});
  if(finishRetry?.idempotent!==true||finishRetry?.media?.media_id!==begin.sessionId)throw Error('MULTIPART_FINISH_RETRY_NOT_IDEMPOTENT');
  console.log('MULTIPART_FINISH_RETRY_IDEMPOTENT=PASS');

  const multiReadMeta=await rpc(base,cookie,'media',{id:begin.sessionId});
  if(!multiReadMeta?.url)throw Error('MULTIPART_PRIVATE_URL_MISSING');
  const multiRead=await privateGet(base,multiReadMeta.url);
  if(multiRead.response.status!==200||multiRead.bytes.length!==multipart.length||sha256(multiRead.bytes)!==sha256(multipart))throw Error(`MULTIPART_PRIVATE_GET_MISMATCH status=${multiRead.response.status}`);
  console.log('MULTIPART_PRIVATE_GET=PASS');

  const linked=await rpc(base,cookie,'getSubmission',{id:submission.id});
  const linkedIds=new Set((linked?.media||[]).map(x=>x.media_id||x.id));
  if(!linkedIds.has(smallMedia.media_id)||!linkedIds.has(begin.sessionId))throw Error('DB_LINKAGE_MISSING');
  console.log('DB_LINKAGE=PASS');

  console.log('R2_STAGING_INTEGRATION=PASS');
}catch(error){
  primaryError=error;
  console.error(`R2_STAGING_INTEGRATION=FAIL ${String(error?.message||error)}`);
  process.exitCode=1;
}finally{
  for(const id of [...new Set(cleanupIds)].reverse()){
    try{
      await rpc(base,cookie,'deleteMedia',{id,reason:'CODE1 STAGING integration cleanup; retain private object per soft-delete policy'});
      console.log(`SOFT_DELETE=PASS mediaId=${id}`);
      try{
        await expectRpcDenied(base,cookie,'media',{id});
        console.log(`DELETED_NEW_READ_ISSUANCE_DENIAL=PASS mediaId=${id}`);
      }catch(error){
        console.error(`DELETED_NEW_READ_ISSUANCE_DENIAL=FAIL mediaId=${id} ${String(error?.message||error)}`);
        process.exitCode=1;
      }
    }catch(error){
      console.error(`SOFT_DELETE=FAIL mediaId=${id} ${String(error?.message||error)}`);
      process.exitCode=1;
    }
  }
  console.log(`TEST_MEDIA_ROWS_TOUCHED=${cleanupIds.length}`);
  console.log('R2_TEST_OBJECTS=PRIVATE_RETAINED_BY_POLICY');
  console.log('PRODUCTION_MUTATION=NONE');
  console.log('LEGACY_DRIVE_MUTATION=NONE');
  if(primaryError)console.log('NOTE=Inspect staging media rows and incomplete multipart lifecycle before rerun; requestIds are unique per run.');
}
