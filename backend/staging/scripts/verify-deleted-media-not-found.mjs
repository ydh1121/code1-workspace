#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const PROJECT_SUFFIX='.code1-workspace.pages.dev';
const DEFAULT_MEDIA_IDS=[
  'M_32c63189358249c2844869a4',
  'M_6132c51925d449b2b5b2e402'
];

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:'';}
function gitBranch(){return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();}
function exactPreviewOrigin(raw){
  let u;try{u=new URL(String(raw||'').trim());}catch{throw Error('INVALID_BASE_URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('INVALID_BASE_URL');
  const host=u.hostname.toLowerCase();
  if(host==='code1-workspace.pages.dev'||!host.endsWith(PROJECT_SUFFIX))throw Error('PREVIEW_HOST_REQUIRED_PRODUCTION_FORBIDDEN');
  return u.origin;
}
function sessionCookie(secret,accountId,version){
  if(!secret||secret.length<32)throw Error('CODE1_TEST_SESSION_SECRET_REQUIRED');
  if(!accountId||!Number.isInteger(version)||version<1)throw Error('INVALID_TEST_PRINCIPAL');
  const now=Date.now();
  const body=Buffer.from(JSON.stringify({kind:'session',accountId,version,method:'verification',authAt:now,exp:now+30*60*1000}),'utf8').toString('base64url');
  const sig=crypto.createHmac('sha256',secret).update(body).digest('hex');
  return `__Host-code1=${body}.${sig}`;
}
async function rpcRaw(base,cookie,action,payload){
  const response=await fetch(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},
    body:JSON.stringify({action,payload}),
    redirect:'manual',
    signal:AbortSignal.timeout(30000)
  });
  const text=await response.text();
  let json=null;try{json=JSON.parse(text);}catch{}
  return {response,text,json};
}

const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=exactPreviewOrigin(arg('--base-url')||'https://coding-runtime-backend-stagi.code1-workspace.pages.dev');
const accountId=String(arg('--account-id')||'OWNER');
const sessionVersion=Number(arg('--session-version')||'2');
const ids=String(arg('--media-ids')||DEFAULT_MEDIA_IDS.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
const secret=String(process.env.CODE1_TEST_SESSION_SECRET||'');
const cookie=sessionCookie(secret,accountId,sessionVersion);

console.log('CODE1 deleted-media NOT_FOUND HTTP verification');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log(`accountId=${accountId}`);
console.log(`sessionVersion=${sessionVersion}`);
console.log(`mediaCount=${ids.length}`);
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('R2_OBJECT_WRITE=NONE');

const session=await fetch(`${base}/api/session`,{headers:{Cookie:cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
const sessionJson=await session.json().catch(()=>null);
if(session.status!==200||sessionJson?.configured!==true||sessionJson?.authenticated!==true)throw Error(`SIGNED_SESSION_REJECTED status=${session.status}`);
console.log('SIGNED_SESSION=PASS');

for(const id of ids){
  const {response,json,text}=await rpcRaw(base,cookie,'media',{id});
  if(response.status!==404||json?.error!=='NOT_FOUND'){
    throw Error(`DELETED_MEDIA_404_MISMATCH mediaId=${id} status=${response.status} body=${String(text).replace(/\s+/g,' ').slice(0,240)}`);
  }
  console.log(`DELETED_MEDIA_NOT_FOUND=PASS mediaId=${id} status=404 error=NOT_FOUND`);
}

console.log('DELETED_MEDIA_NOT_FOUND_VERIFY=PASS');
console.log('REMOTE_MUTATION=NONE');
console.log('R2_OBJECT_WRITE=NONE');
