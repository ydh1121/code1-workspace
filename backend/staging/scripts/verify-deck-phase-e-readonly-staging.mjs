#!/usr/bin/env node
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {execFileSync} from 'node:child_process';

const BRANCH='coding/runtime-backend-staging';
const BASE='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';
const EXPECTED_DECK='CODE1_AZA_INTERNAL';
const MIN_VERSION=3;
const EXPECTED_REFERENCED_ASSETS=15;
const EXPECTED_REFERENCED_BYTES=1132992;

const branch=()=>execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8'}).trim();
const cookieFrom=v=>String(v||'').split(';',1)[0];
async function rawRpc(cookie,action,payload={}){
  const res=await fetch(`${BASE}/api/rpc`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,payload}),redirect:'manual',signal:AbortSignal.timeout(60000)});
  const text=await res.text();let body=null;try{body=JSON.parse(text);}catch{}
  return {res,body,text};
}
async function rpc(cookie,action,payload={}){const out=await rawRpc(cookie,action,payload);if(!out.res.ok)throw Error(`${action}_FAILED status=${out.res.status} body=${out.text.slice(0,400)}`);return out.body;}

if(branch()!==BRANCH)throw Error(`BRANCH_MISMATCH expected=${BRANCH} actual=${branch()}`);
console.log('CODE1 DECK PHASE E READ-ONLY VERIFIER');
console.log('======================================');
console.log(`branch=${BRANCH}`);
console.log(`baseUrl=${BASE}`);
console.log('TARGET=STAGING_ONLY');
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('LIVE_SOURCE_MUTATION=DISALLOWED');
console.log('PASSWORD_VALUE_LOGGING=NONE');

const unauth=await rawRpc('', 'deckBootstrap');
if(unauth.res.status!==401||unauth.body?.error!=='UNAUTHENTICATED')throw Error(`UNAUTH_RUNTIME_FAILED status=${unauth.res.status} body=${unauth.text.slice(0,240)}`);
console.log('UNAUTHENTICATED_RUNTIME=PASS status=401');

const rl=readline.createInterface({input,output});let password='';try{password=await rl.question('Enter STAGING owner password (visible): ');}finally{rl.close();}
if(password.length<12||password.length>128)throw Error('OWNER_PASSWORD_LENGTH_INVALID');
const login=await fetch(`${BASE}/api/auth/password`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},body:JSON.stringify({username:'owner',password}),redirect:'manual',signal:AbortSignal.timeout(30000)});password='';
const loginText=await login.text();let loginBody=null;try{loginBody=JSON.parse(loginText);}catch{}
if(!login.ok||loginBody?.user?.id!=='OWNER')throw Error(`PASSWORD_LOGIN_FAILED status=${login.status} body=${loginText.slice(0,300)}`);
const cookie=cookieFrom(login.headers.get('set-cookie'));if(!cookie)throw Error('PASSWORD_LOGIN_COOKIE_MISSING');
console.log(`PASSWORD_LOGIN=PASS account=OWNER sessionVersion=${loginBody.user.version}`);

const session=await fetch(`${BASE}/api/session`,{headers:{Cookie:cookie},redirect:'manual',signal:AbortSignal.timeout(30000)});const sessionBody=await session.json();
if(!session.ok||sessionBody.authenticated!==true||sessionBody.user?.id!=='OWNER')throw Error('SESSION_RESTORE_FAILED');
console.log(`SESSION_RESTORE=PASS account=OWNER sessionVersion=${sessionBody.user.version}`);

const boot=(await rpc(cookie,'deckBootstrap')).data;
if(boot?.deck?.deck_id!==EXPECTED_DECK||Number(boot?.deck?.version)<MIN_VERSION)throw Error(`DECK_BOOTSTRAP_STATE_MISMATCH version=${boot?.deck?.version}`);
const refs=Object.keys(boot?.assets||{}).sort();if(refs.length!==EXPECTED_REFERENCED_ASSETS)throw Error(`DECK_ASSET_COUNT_MISMATCH expected=${EXPECTED_REFERENCED_ASSETS} actual=${refs.length}`);
console.log(`DECK_BOOTSTRAP=PASS deck=${boot.deck.deck_id} version=${boot.deck.version} assets=${refs.length} canEditDeck=${boot.canEditDeck===true}`);

let total=0;
for(const ref of refs){const asset=boot.assets[ref];if(!asset?.url||asset.error)throw Error(`DECK_ASSET_URL_MISSING:${ref}`);const res=await fetch(new URL(asset.url,BASE),{redirect:'manual',signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(`PRIVATE_ASSET_READ_FAILED:${ref}:status=${res.status}`);const bytes=new Uint8Array(await res.arrayBuffer());total+=bytes.length;}
if(total!==EXPECTED_REFERENCED_BYTES)throw Error(`PRIVATE_ASSET_BYTES_MISMATCH expected=${EXPECTED_REFERENCED_BYTES} actual=${total}`);
console.log(`PRIVATE_ASSET_READ_ALL=PASS count=${refs.length} bytes=${total}`);

const logout=await fetch(`${BASE}/api/auth/logout`,{method:'POST',headers:{Origin:BASE,Cookie:cookie},redirect:'manual',signal:AbortSignal.timeout(20000)});if(!logout.ok)throw Error(`LOGOUT_FAILED status=${logout.status}`);
console.log('LOGOUT=PASS');
const after=await rawRpc(cookie,'deckBootstrap');if(after.res.status!==401||after.body?.error!=='UNAUTHENTICATED')throw Error(`LOGOUT_SESSION_INVALIDATION_FAILED status=${after.res.status}`);
console.log('LOGOUT_SESSION_INVALIDATION=PASS status=401');
console.log('DECK_PHASE_E_READONLY=PASS');
console.log('REMOTE_MUTATION=NONE');
console.log('LIVE_SOURCE_MUTATION=NONE');
