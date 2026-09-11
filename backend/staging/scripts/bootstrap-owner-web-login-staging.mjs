#!/usr/bin/env node

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const EXPECTED_BASE='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:'';
}
function gitBranch(){
  return execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
}
function b64uJson(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');}
function signSession(secret,payload){
  if(!secret||secret.length<32)throw Error('SESSION_SECRET_REQUIRED_MIN_32');
  const body=b64uJson(payload);
  const sig=crypto.createHmac('sha256',secret).update(body).digest('hex');
  return `${body}.${sig}`;
}
function cookieFromSetCookie(value){
  if(!value)return '';
  const first=String(value).split(';',1)[0];
  return first.startsWith('__Host-code1=')?first:'';
}
async function jsonResponse(response,label){
  const text=await response.text();
  let data=null;try{data=JSON.parse(text);}catch{}
  if(!response.ok)throw Error(`${label}_FAILED status=${response.status} body=${text.replace(/\s+/g,' ').slice(0,300)}`);
  if(!data||typeof data!=='object')throw Error(`${label}_INVALID_JSON`);
  return data;
}
async function rpc(base,cookie,action,payload={}){
  const r=await fetch(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie},
    body:JSON.stringify({action,payload}),
    redirect:'manual',
    signal:AbortSignal.timeout(30000)
  });
  return jsonResponse(r,`RPC_${action}`);
}

const branch=gitBranch();
if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const base=String(arg('--base-url')||EXPECTED_BASE).replace(/\/$/,'');
if(base!==EXPECTED_BASE)throw Error(`BASE_URL_MISMATCH expected=${EXPECTED_BASE} actual=${base}`);
const sessionSecret=String(process.env.CODE1_OPERATOR_SESSION_SECRET||'');
const newPassword=String(process.env.CODE1_STAGING_OWNER_PASSWORD||'');
const currentVersion=Number(arg('--session-version')||2);
if(!Number.isInteger(currentVersion)||currentVersion<1)throw Error('INVALID_SESSION_VERSION');
if(newPassword.length<12||newPassword.length>128)throw Error('NEW_PASSWORD_LENGTH_12_TO_128_REQUIRED');

console.log('CODE1 STAGING owner web-login bootstrap verifier');
console.log(`branch=${branch}`);
console.log(`baseUrl=${base}`);
console.log('targetAccount=OWNER');
console.log(`currentSessionVersion=${currentVersion}`);
console.log('PRODUCTION_MUTATION=DISALLOWED');
console.log('LEGACY_DRIVE_MUTATION=DISALLOWED');
console.log('R2_OBJECT_WRITE=NONE');
console.log('PASSWORD_VALUE_LOGGING=NONE');

const now=Date.now();
const recoveryToken=signSession(sessionSecret,{
  kind:'session',
  accountId:'OWNER',
  version:currentVersion,
  method:'google',
  authAt:now,
  exp:now+5*60*1000
});
const recoveryCookie=`__Host-code1=${recoveryToken}`;

const resetResponse=await fetch(`${base}/api/accounts`,{
  method:'POST',
  headers:{'Content-Type':'application/json','Origin':base,'Cookie':recoveryCookie},
  body:JSON.stringify({action:'password',password:newPassword,currentPassword:''}),
  redirect:'manual',
  signal:AbortSignal.timeout(30000)
});
const resetJson=await jsonResponse(resetResponse,'STAGING_OWNER_PASSWORD_RESET');
if(resetJson?.data?.id!=='OWNER'||resetJson?.data?.username!=='owner'||resetJson?.data?.status!=='active')throw Error('PASSWORD_RESET_ACCOUNT_MISMATCH');
const resetVersion=Number(resetJson.data.version);
if(!Number.isInteger(resetVersion)||resetVersion<=currentVersion)throw Error('PASSWORD_RESET_VERSION_NOT_INCREMENTED');
console.log(`STAGING_OWNER_PASSWORD_RESET=PASS newSessionVersion=${resetVersion}`);

const loginResponse=await fetch(`${base}/api/auth/password`,{
  method:'POST',
  headers:{'Content-Type':'application/json','Origin':base},
  body:JSON.stringify({username:'owner',password:newPassword}),
  redirect:'manual',
  signal:AbortSignal.timeout(30000)
});
const loginJson=await jsonResponse(loginResponse,'PASSWORD_LOGIN');
if(loginJson?.user?.id!=='OWNER'||loginJson?.user?.username!=='owner'||Number(loginJson?.user?.version)!==resetVersion)throw Error('PASSWORD_LOGIN_ACCOUNT_MISMATCH');
const loginCookie=cookieFromSetCookie(loginResponse.headers.get('set-cookie'));
if(!loginCookie)throw Error('PASSWORD_LOGIN_COOKIE_MISSING');
console.log(`PASSWORD_LOGIN=PASS account=OWNER sessionVersion=${resetVersion}`);

const sessionResponse=await fetch(`${base}/api/session`,{headers:{Cookie:loginCookie},redirect:'manual',signal:AbortSignal.timeout(20000)});
const sessionJson=await jsonResponse(sessionResponse,'SESSION_RESTORE');
if(sessionJson.configured!==true||sessionJson.authenticated!==true)throw Error('SESSION_RESTORE_NOT_AUTHENTICATED');
console.log(`SESSION_RESTORE=PASS googleEnabled=${sessionJson.googleEnabled===true}`);

const boot=await rpc(base,loginCookie,'bootstrap',{});
if(boot?.data?.performance?.backend!=='SUPABASE_STAGING')throw Error('BOOTSTRAP_BACKEND_MISMATCH');
console.log(`AUTHENTICATED_BOOTSTRAP=PASS backend=${boot.data.performance.backend}`);

const logoutResponse=await fetch(`${base}/api/auth/logout`,{
  method:'POST',
  headers:{'Origin':base,'Cookie':loginCookie},
  redirect:'manual',
  signal:AbortSignal.timeout(20000)
});
if(!logoutResponse.ok)throw Error(`LOGOUT_FAILED status=${logoutResponse.status}`);
console.log('LOGOUT=PASS');

console.log('STAGING_WEB_LOGIN_E2E=PASS');
console.log('PRODUCTION_MUTATION=NONE');
console.log('LEGACY_DRIVE_MUTATION=NONE');
console.log('R2_OBJECT_WRITE=NONE');
