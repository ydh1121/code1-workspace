#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {execFileSync} from 'node:child_process';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const EXPECTED_BASE='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';
const EXPECTED_WORK_ORDER='WO-20260912-CODING-DECK-001';
const EXPECTED_PROJECT_REF='bsintmkyhptizrjoizfb';
const EXPECTED_BUCKET='code1-staging-media';
const EXPECTED_DECK='CODE1_AZA_INTERNAL';
const EXPECTED_BUNDLE_SHA='9b525246b9770d8d42b21e8de5ab405a38e8e940a06f0204088845005e737f3e';
const ACTION='deckMigration.importSource20260912';

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:'';}
function gitBranch(){return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();}
function sha256Hex(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function sha256B64u(text){return crypto.createHash('sha256').update(text,'utf8').digest('base64url');}
function cookieFromSetCookie(value){const first=String(value||'').split(';',1)[0];return first.startsWith('__Host-code1=')?first:'';}
async function jsonResponse(response,label){const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}if(!response.ok)throw Error(`${label}_FAILED status=${response.status} body=${text.replace(/\s+/g,' ').slice(0,500)}`);if(!data||typeof data!=='object')throw Error(`${label}_INVALID_JSON`);return data;}

const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=String(arg('--base-url')||EXPECTED_BASE).replace(/\/$/,'');
if(base!==EXPECTED_BASE)throw Error(`BASE_URL_MISMATCH expected=${EXPECTED_BASE} actual=${base}`);
const bundleRoot=path.resolve(String(arg('--bundle-root')||''));
if(!bundleRoot||!fs.existsSync(bundleRoot)||!fs.statSync(bundleRoot).isDirectory())throw Error('BUNDLE_ROOT_REQUIRED');
const planPath=path.join(bundleRoot,'import-plan.json');
const evidencePath=path.join(bundleRoot,'r2-copy-evidence.json');
if(!fs.existsSync(planPath)||!fs.existsSync(evidencePath))throw Error('IMPORT_PLAN_OR_R2_EVIDENCE_MISSING');
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8').replace(/^\uFEFF/,''));
if(plan.work_order!==EXPECTED_WORK_ORDER||plan.project_ref!==EXPECTED_PROJECT_REF||plan.bucket!==EXPECTED_BUCKET||plan.deck_id!==EXPECTED_DECK||plan.target!=='CODE1 STAGING ONLY')throw Error('IMPORT_PLAN_TARGET_MISMATCH');
if(evidence.work_order!==EXPECTED_WORK_ORDER||evidence.project_ref!==EXPECTED_PROJECT_REF||evidence.bucket!==EXPECTED_BUCKET||evidence.deck_id!==EXPECTED_DECK||evidence.all_verified!==true||Number(evidence.asset_count)!==15)throw Error('R2_EVIDENCE_MISMATCH');
if(evidence.production_mutation!=='NONE'||evidence.live_source_mutation!=='NONE'||evidence.delete_operation!=='NONE')throw Error('R2_EVIDENCE_UNSAFE');
if(!Array.isArray(plan.assets)||plan.assets.length!==15||!Array.isArray(plan.revisions)||plan.revisions.length!==2)throw Error('IMPORT_PLAN_COUNT_MISMATCH');

const evidenceById=new Map(evidence.objects.map(x=>[x.asset_id,x]));
for(const a of plan.assets){
  const file=path.resolve(bundleRoot,a.relative_file);
  if(!file.startsWith(bundleRoot+path.sep)||!fs.existsSync(file))throw Error(`ASSET_FILE_MISSING:${a.asset_id}`);
  const bytes=fs.readFileSync(file),hash=sha256Hex(bytes),ev=evidenceById.get(a.asset_id);
  if(bytes.length!==Number(a.file_size_bytes)||hash!==a.checksum_sha256)throw Error(`LOCAL_ASSET_MISMATCH:${a.asset_id}`);
  if(!ev||ev.verified!==true||ev.object_key!==a.object_key||Number(ev.file_size_bytes)!==Number(a.file_size_bytes)||ev.checksum_sha256!==a.checksum_sha256)throw Error(`R2_EVIDENCE_ASSET_MISMATCH:${a.asset_id}`);
}

const revisions=[];
for(const r of plan.revisions){
  const file=path.resolve(bundleRoot,r.relative_file);
  if(!file.startsWith(bundleRoot+path.sep)||!fs.existsSync(file))throw Error(`REVISION_FILE_MISSING:${r.revision_id}`);
  const payloadText=fs.readFileSync(file,'utf8');
  if(payloadText.length!==Number(r.payload_chars)||sha256B64u(payloadText)!==r.content_hash)throw Error(`REVISION_HASH_MISMATCH:${r.revision_id}`);
  revisions.push({...r,payloadText});
}

console.log('CODE1 DECK PHASE C SOURCE IMPORT');
console.log('================================');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log(`bundleRoot=${bundleRoot}`);
console.log('LOCAL_ASSET_VERIFY=PASS 15/15');
console.log('R2_EVIDENCE_VERIFY=PASS 15/15');
console.log('REVISION_VERIFY=PASS 2/2');
console.log('PRODUCTION_MUTATION=DISALLOWED');
console.log('LIVE_SOURCE_MUTATION=DISALLOWED');
console.log('PASSWORD_VALUE_LOGGING=NONE');

const rl=readline.createInterface({input,output});
let password='';
try{password=await rl.question('Enter STAGING owner password (visible): ');}finally{rl.close();}
if(password.length<12||password.length>128)throw Error('OWNER_PASSWORD_LENGTH_INVALID');

const loginResponse=await fetch(`${base}/api/auth/password`,{
  method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify({username:'owner',password}),redirect:'manual',signal:AbortSignal.timeout(30000)
});
password='';
const loginJson=await jsonResponse(loginResponse,'PASSWORD_LOGIN');
if(loginJson?.user?.id!=='OWNER'||loginJson?.user?.username!=='owner')throw Error('PASSWORD_LOGIN_ACCOUNT_MISMATCH');
const cookie=cookieFromSetCookie(loginResponse.headers.get('set-cookie'));if(!cookie)throw Error('PASSWORD_LOGIN_COOKIE_MISSING');
console.log(`PASSWORD_LOGIN=PASS account=OWNER sessionVersion=${loginJson.user.version}`);

const rpcPayload={
  workOrder:EXPECTED_WORK_ORDER,target:'CODE1 STAGING ONLY',projectRef:EXPECTED_PROJECT_REF,bucket:EXPECTED_BUCKET,deckId:EXPECTED_DECK,bundleSha256:EXPECTED_BUNDLE_SHA,
  assets:plan.assets,revisions
};
const importResponse=await fetch(`${base}/api/rpc`,{
  method:'POST',headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},body:JSON.stringify({action:ACTION,payload:rpcPayload}),redirect:'manual',signal:AbortSignal.timeout(120000)
});
const imported=await jsonResponse(importResponse,'DECK_SOURCE_IMPORT');
const d=imported?.data;
if(d?.pass!==true||d?.deckId!==EXPECTED_DECK||Number(d?.assetCount)!==15||Number(d?.revisionCount)!==2||Number(d?.revisionAssetLinks)!==30||Number(d?.currentVersion)!==2)throw Error('DECK_SOURCE_IMPORT_RESULT_MISMATCH');
console.log(`DECK_SOURCE_IMPORT=PASS assets=${d.assetCount} revisions=${d.revisionCount} links=${d.revisionAssetLinks}`);
console.log(`CURRENT_POINTER=PASS version=${d.currentVersion} revision=${d.currentRevisionId}`);

const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{'Origin':base,'Cookie':cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
if(!logout.ok)throw Error(`LOGOUT_FAILED status=${logout.status}`);
console.log('LOGOUT=PASS');
console.log('PHASE_C_SUPABASE_IMPORT=PASS');
console.log('PRODUCTION_MUTATION=NONE');
console.log('LIVE_SOURCE_MUTATION=NONE');
