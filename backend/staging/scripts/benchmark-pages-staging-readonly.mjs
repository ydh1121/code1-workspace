#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {percentile} from '../src/core.mjs';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const PROJECT_SUFFIX='.code1-workspace.pages.dev';
const DEFAULT_RUNS=30;
const DEFAULT_WARMUPS=3;

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0 ? process.argv[i+1] : '';
}
function assertArgs(){
  const valued=new Set(['--base-url','--account-id','--session-version','--runs','--warmups']);
  for(let i=2;i<process.argv.length;i++){
    const a=process.argv[i];
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
function boundedInt(raw,fallback,min,max,label){
  const n=raw===''?fallback:Number(raw);
  if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label}_OUT_OF_RANGE`);
  return n;
}
function b64uJson(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');}
function sessionCookie(secret,accountId,version){
  if(!secret||secret.length<32)throw Error('CODE1_BENCH_SESSION_SECRET_REQUIRED');
  if(!accountId||!Number.isInteger(version)||version<1)throw Error('INVALID_TEST_PRINCIPAL');
  const now=Date.now();
  const body=b64uJson({kind:'session',accountId,version,method:'benchmark',authAt:now,exp:now+60*60*1000});
  const sig=crypto.createHmac('sha256',secret).update(body).digest('hex');
  return `__Host-code1=${body}.${sig}`;
}
function round1(n){return Math.round(n*10)/10;}
function stats(samples){
  return {
    runs:samples.length,
    p50_ms:round1(percentile(samples,.5)),
    p95_ms:round1(percentile(samples,.95)),
    mean_ms:round1(samples.reduce((a,b)=>a+b,0)/samples.length),
    min_ms:round1(Math.min(...samples)),
    max_ms:round1(Math.max(...samples))
  };
}
async function rpc(base,cookie,action,payload){
  const started=performance.now();
  const response=await fetch(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},
    body:JSON.stringify({action,payload}),
    redirect:'manual',
    signal:AbortSignal.timeout(60000)
  });
  const elapsed=performance.now()-started;
  const text=await response.text();
  let json=null;try{json=JSON.parse(text);}catch{}
  if(!response.ok)throw Error(`RPC_${action}_FAILED status=${response.status} body=${String(text).replace(/\s+/g,' ').slice(0,240)}`);
  if(!json||!Object.prototype.hasOwnProperty.call(json,'data'))throw Error(`RPC_${action}_INVALID_RESPONSE`);
  return {data:json.data,elapsed};
}
async function measure(name,warmups,runs,call){
  for(let i=0;i<warmups;i++)await call();
  const samples=[];
  for(let i=0;i<runs;i++)samples.push((await call()).elapsed);
  const result={name,...stats(samples)};
  console.log(`BENCH_CASE=${name} runs=${result.runs} p50_ms=${result.p50_ms} p95_ms=${result.p95_ms} mean_ms=${result.mean_ms} min_ms=${result.min_ms} max_ms=${result.max_ms}`);
  return result;
}

assertArgs();
const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=exactPreviewOrigin(arg('--base-url'));
const accountId=String(arg('--account-id')||'OWNER');
const sessionVersion=boundedInt(arg('--session-version'),0,1,1000000,'SESSION_VERSION');
const runs=boundedInt(arg('--runs'),DEFAULT_RUNS,5,100,'RUNS');
const warmups=boundedInt(arg('--warmups'),DEFAULT_WARMUPS,0,20,'WARMUPS');
const secret=String(process.env.CODE1_BENCH_SESSION_SECRET||'');
const cookie=sessionCookie(secret,accountId,sessionVersion);

console.log('CODE1 Pages Preview STAGING read-only latency benchmark');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log(`accountId=${accountId}`);
console.log(`sessionVersion=${sessionVersion}`);
console.log(`runsPerCase=${runs}`);
console.log(`warmupsPerCase=${warmups}`);
console.log('PERFORMANCE_THRESHOLD=NOT_SET_MEASUREMENT_ONLY');
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('R2_OBJECT_WRITE=NONE');

const session=await fetch(`${base}/api/session`,{headers:{Cookie:cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
const sessionJson=await session.json().catch(()=>null);
if(session.status!==200||sessionJson?.configured!==true||sessionJson?.authenticated!==true)throw Error(`SIGNED_SESSION_REJECTED status=${session.status}`);
console.log('SIGNED_SESSION=PASS');

const seed=await rpc(base,cookie,'bootstrap',{});
if(seed.data?.performance?.backend!=='SUPABASE_STAGING')throw Error('BOOTSTRAP_BACKEND_MISMATCH');
const submission=(Array.isArray(seed.data?.submissions)?seed.data.submissions:[]).find(x=>x?.id);
if(!submission)throw Error('NO_READABLE_STAGING_SUBMISSION');
console.log(`bootstrapBackend=${seed.data.performance.backend}`);
console.log(`benchmarkSubmission=${submission.id}`);

const results=[];
results.push(await measure('bootstrap',warmups,runs,()=>rpc(base,cookie,'bootstrap',{})));
results.push(await measure('getSubmission',warmups,runs,()=>rpc(base,cookie,'getSubmission',{id:submission.id})));

console.log(`STAGING_READONLY_LATENCY_BENCH=PASS cases=${results.length}`);
console.log('REMOTE_MUTATION=NONE');
console.log('R2_OBJECT_WRITE=NONE');
