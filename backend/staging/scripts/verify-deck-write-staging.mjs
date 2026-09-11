#!/usr/bin/env node
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {execFileSync} from 'node:child_process';

const BRANCH='coding/runtime-backend-staging';
const BASE='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';
const UPLOAD_REQ='dddddddddddddddddddddddddddddddd';
const SAVE_REQ='eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const STALE_REQ='ffffffffffffffffffffffffffffffff';
const REUSE_REQ=SAVE_REQ;
const PNG_B64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const branch=()=>execFileSync('git',['rev-parse','--abbrev-ref','HEAD'],{encoding:'utf8'}).trim();
const cookieFrom=v=>String(v||'').split(';',1)[0];
async function parse(res,label){const text=await res.text();let body=null;try{body=JSON.parse(text);}catch{}if(!res.ok)throw Error(`${label}_FAILED status=${res.status} body=${text.slice(0,400)}`);return body;}
async function rpc(cookie,action,payload={}){return parse(await fetch(`${BASE}/api/rpc`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:cookie},body:JSON.stringify({action,payload}),redirect:'manual',signal:AbortSignal.timeout(60000)}),action);}
async function rpcRaw(cookie,action,payload={}){const res=await fetch(`${BASE}/api/rpc`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE,Cookie:cookie},body:JSON.stringify({action,payload}),redirect:'manual',signal:AbortSignal.timeout(60000)});const text=await res.text();let body=null;try{body=JSON.parse(text);}catch{}return {res,body,text};}

if(branch()!==BRANCH)throw Error('BRANCH_MISMATCH');
console.log('CODE1 DECK STAGING WRITE CUTOVER VERIFIER');
console.log('=========================================');
console.log(`branch=${BRANCH}`);console.log(`baseUrl=${BASE}`);console.log('TARGET=STAGING_ONLY');console.log('PRODUCTION_MUTATION=DISALLOWED');console.log('LIVE_SOURCE_MUTATION=DISALLOWED');
const rl=readline.createInterface({input,output});let password='';try{password=await rl.question('Enter STAGING owner password (visible): ');}finally{rl.close();}
const login=await fetch(`${BASE}/api/auth/password`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},body:JSON.stringify({username:'owner',password}),redirect:'manual'});password='';const lj=await parse(login,'LOGIN');const cookie=cookieFrom(login.headers.get('set-cookie'));if(lj?.user?.id!=='OWNER'||!cookie)throw Error('LOGIN_INVALID');console.log(`PASSWORD_LOGIN=PASS account=OWNER sessionVersion=${lj.user.version}`);

const before=(await rpc(cookie,'deckBootstrap')).data;const baseVersion=Number(before.deck.version);console.log(`BEFORE=PASS version=${baseVersion} assets=${Object.keys(before.assets||{}).length}`);
const uploadPayload={kind:'DECK',requestId:UPLOAD_REQ,fileName:'phase-d-proof.png',mimeType:'image/png',base64:PNG_B64,metadata:{rights_owner:'CODE1 STAGING PHASE D proof only',b2b_use:'미확인',caption:'PHASE D upload proof'}};
const u1=(await rpc(cookie,'upload',uploadPayload)).data;const u2=(await rpc(cookie,'upload',uploadPayload)).data;if(!u1?.upload_id||u1.upload_id!==u2?.upload_id)throw Error('UPLOAD_IDEMPOTENCY_FAILED');console.log(`DECK_UPLOAD=PASS asset=${u1.upload_id} idempotent=true`);
const media=(await rpc(cookie,'media',{id:u1.upload_id})).data;if(!media?.url)throw Error('DECK_MEDIA_URL_MISSING');const assetRes=await fetch(new URL(media.url,BASE));if(!assetRes.ok)throw Error(`DECK_MEDIA_GET_FAILED status=${assetRes.status}`);const assetBytes=new Uint8Array(await assetRes.arrayBuffer());if(!assetBytes.length)throw Error('DECK_MEDIA_EMPTY');console.log(`DECK_MEDIA=PASS bytes=${assetBytes.length}`);

const savePayload={deck:before.deck,baseVersion,newVersion:false,summary:'PHASE D write-path no-op verification',requestId:SAVE_REQ};
const s1=(await rpc(cookie,'saveDeck',savePayload)).data;const s2=(await rpc(cookie,'saveDeck',savePayload)).data;if(Number(s1.version)!==baseVersion+1||Number(s2.version)!==Number(s1.version))throw Error('SAVE_IDEMPOTENCY_FAILED');console.log(`DECK_SAVE=PASS version=${s1.version} idempotent=true`);
const reuse=await rpcRaw(cookie,'saveDeck',{...savePayload,summary:'different summary'});if(reuse.res.status!==409||reuse.body?.error!=='REQUEST_ID_REUSE')throw Error(`REQUEST_REUSE_GUARD_FAILED status=${reuse.res.status} body=${reuse.text.slice(0,240)}`);console.log('REQUEST_REUSE_GUARD=PASS status=409');
const stale=await rpcRaw(cookie,'saveDeck',{deck:before.deck,baseVersion,newVersion:false,summary:'stale conflict proof',requestId:STALE_REQ});if(stale.res.status!==409||stale.body?.error!=='CONFLICT')throw Error(`STALE_CONFLICT_FAILED status=${stale.res.status} body=${stale.text.slice(0,240)}`);console.log('STALE_CONFLICT=PASS status=409');
const drive=await rpcRaw(cookie,'linkDrive',{kind:'DECK',fileId:'staging-proof',requestId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});if(drive.res.status!==503||drive.body?.error!=='DECK_DRIVE_LINK_DISABLED')throw Error('DRIVE_LINK_GATE_FAILED');console.log('DRIVE_LINK_GATE=PASS status=503');
const after=(await rpc(cookie,'deckBootstrap')).data;if(Number(after.deck.version)!==baseVersion+1)throw Error('AFTER_VERSION_MISMATCH');console.log(`AFTER=PASS version=${after.deck.version} referencedAssets=${Object.keys(after.assets||{}).length}`);
const logout=await fetch(`${BASE}/api/auth/logout`,{method:'POST',headers:{Origin:BASE,Cookie:cookie}});if(!logout.ok)throw Error('LOGOUT_FAILED');console.log('LOGOUT=PASS');console.log('DECK_WRITE_CUTOVER=PASS');console.log('PRODUCTION_MUTATION=NONE');console.log('LIVE_SOURCE_MUTATION=NONE');
