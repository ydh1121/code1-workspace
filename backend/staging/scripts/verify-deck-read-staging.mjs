#!/usr/bin/env node

import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {execFileSync} from 'node:child_process';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const EXPECTED_BASE='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';
const EXPECTED_DECK='CODE1_AZA_INTERNAL';
const EXPECTED_VERSION=2;
const EXPECTED_REVISION_ASSET_COUNT=15;

function gitBranch(){return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();}
function cookieFromSetCookie(value){const first=String(value||'').split(';',1)[0];return first.startsWith('__Host-code1=')?first:'';}
async function jsonResponse(response,label){const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}if(!response.ok)throw Error(`${label}_FAILED status=${response.status} body=${text.replace(/\s+/g,' ').slice(0,500)}`);if(!data||typeof data!=='object')throw Error(`${label}_INVALID_JSON`);return data;}
async function rpc(base,cookie,action,payload={}){
  const response=await fetch(`${base}/api/rpc`,{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},body:JSON.stringify({action,payload}),redirect:'manual',signal:AbortSignal.timeout(60000)});
  return jsonResponse(response,`RPC_${action}`);
}

const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=EXPECTED_BASE;
console.log('CODE1 DECK STAGING READ CUTOVER VERIFIER');
console.log('========================================');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log('TARGET=STAGING_ONLY');
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('PASSWORD_VALUE_LOGGING=NONE');

const rl=readline.createInterface({input,output});
let password='';
try{password=await rl.question('Enter STAGING owner password (visible): ');}finally{rl.close();}
if(password.length<12||password.length>128)throw Error('OWNER_PASSWORD_LENGTH_INVALID');
const loginResponse=await fetch(`${base}/api/auth/password`,{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify({username:'owner',password}),redirect:'manual',signal:AbortSignal.timeout(30000)});
password='';
const loginJson=await jsonResponse(loginResponse,'PASSWORD_LOGIN');
if(loginJson?.user?.id!=='OWNER')throw Error('PASSWORD_LOGIN_ACCOUNT_MISMATCH');
const cookie=cookieFromSetCookie(loginResponse.headers.get('set-cookie'));if(!cookie)throw Error('PASSWORD_LOGIN_COOKIE_MISSING');
console.log(`PASSWORD_LOGIN=PASS account=OWNER sessionVersion=${loginJson.user.version}`);

const boot=await rpc(base,cookie,'deckBootstrap');
const bundle=boot?.data;
if(bundle?.deck?.deck_id!==EXPECTED_DECK||Number(bundle?.deck?.version)!==EXPECTED_VERSION)throw Error('DECK_BOOTSTRAP_ID_VERSION_MISMATCH');
const refs=Object.keys(bundle?.assets||{}).sort();
if(refs.length!==EXPECTED_REVISION_ASSET_COUNT)throw Error(`DECK_ASSET_COUNT_MISMATCH expected=${EXPECTED_REVISION_ASSET_COUNT} actual=${refs.length}`);
if(bundle?.canEditDeck!==true)throw Error('DECK_EDIT_PERMISSION_MISMATCH');
console.log(`DECK_BOOTSTRAP=PASS deck=${bundle.deck.deck_id} version=${bundle.deck.version} assets=${refs.length} canEditDeck=true`);

const assetsOnly=await rpc(base,cookie,'deckAssets');
const assetsMap=assetsOnly?.data||{};
if(Object.keys(assetsMap).length!==EXPECTED_REVISION_ASSET_COUNT)throw Error('DECK_ASSETS_COUNT_MISMATCH');
console.log(`DECK_ASSETS=PASS count=${Object.keys(assetsMap).length}`);

let bytesTotal=0;
for(const ref of refs){
  const asset=bundle.assets[ref];
  if(!asset?.url||asset.error)throw Error(`DECK_ASSET_URL_MISSING:${ref}`);
  const response=await fetch(new URL(asset.url,base),{redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`DECK_PRIVATE_ASSET_READ_FAILED:${ref}:status=${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length)throw Error(`DECK_PRIVATE_ASSET_EMPTY:${ref}`);
  bytesTotal+=bytes.length;
  console.log(`PRIVATE_ASSET_READ=PASS ${ref} bytes=${bytes.length}`);
}
console.log(`PRIVATE_ASSET_READ_ALL=PASS count=${refs.length} bytes=${bytesTotal}`);

for(const [action,payload] of [['saveDeck',{}],['upload',{kind:'DECK'}],['linkDrive',{kind:'DECK'}]]){
  const response=await fetch(`${base}/api/rpc`,{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},body:JSON.stringify({action,payload}),redirect:'manual',signal:AbortSignal.timeout(30000)});
  const text=await response.text();
  if(response.ok||!text.includes('DECK_WRITE_GATE_CLOSED'))throw Error(`WRITE_GATE_NOT_CLOSED:${action}:status=${response.status}:body=${text.slice(0,240)}`);
  console.log(`WRITE_GATE=PASS action=${action} status=${response.status}`);
}

const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{'Origin':base,'Cookie':cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
if(!logout.ok)throw Error(`LOGOUT_FAILED status=${logout.status}`);
console.log('LOGOUT=PASS');
console.log('DECK_READ_CUTOVER=PASS');
console.log('REMOTE_MUTATION=NONE');
console.log('LIVE_SOURCE_MUTATION=NONE');
