#!/usr/bin/env node

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const PROJECT_SUFFIX='.code1-workspace.pages.dev';

function fail(message){
  console.error(`VERIFY_BLOCKED: ${message}`);
  process.exitCode=1;
}
function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0 ? process.argv[i+1] : '';
}
function assertArgs(){
  const valued=new Set(['--base-url']);
  for(let i=2;i<process.argv.length;i++){
    const a=process.argv[i];
    if(!valued.has(a))throw Error(`UNKNOWN_ARGUMENT ${a}`);
    if(i+1>=process.argv.length||process.argv[i+1].startsWith('--'))throw Error(`MISSING_VALUE ${a}`);
    i++;
  }
}
async function gitBranch(){
  const {execFileSync}=await import('node:child_process');
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
async function request(url,options={}){
  try{
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
    const text=(await response.text()).slice(0,1000);
    return {status:response.status,text,contentType:response.headers.get('content-type')||''};
  }catch(error){
    throw Error(`NETWORK_ERROR ${error?.name||'Error'} ${String(error?.message||'').slice(0,180)}`);
  }
}
function jsonOrNull(text){try{return JSON.parse(text);}catch{return null;}}
function print(name,result){
  const body=result.text.replace(/\s+/g,' ').trim().slice(0,240);
  console.log(`${name}: status=${result.status}${body?` body=${body}`:''}`);
}

try{
  assertArgs();
  const branch=await gitBranch();
  if(branch!==EXPECTED_BRANCH)throw Error(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
  const base=exactPreviewOrigin(arg('--base-url'));

  console.log('CODE1 Pages Preview READ-ONLY verification');
  console.log(`branch=${branch}`);
  console.log(`baseUrl=${base}`);
  console.log('REMOTE_MUTATION=DISALLOWED');
  console.log('Only GET probes plus one unauthenticated bootstrap POST are used; session validation occurs before action dispatch.');

  const root=await request(`${base}/`);
  print('ROOT_GET',root);
  if(root.status!==200)fail(`ROOT_UNEXPECTED_STATUS ${root.status}`);

  const session=await request(`${base}/api/session`);
  print('SESSION_GET',session);
  const sessionJson=jsonOrNull(session.text);
  if(session.status!==200||!sessionJson)fail(`SESSION_INVALID_RESPONSE status=${session.status}`);
  else if(sessionJson.configured!==true)fail('PREVIEW_RUNTIME_NOT_CONFIGURED');
  else if(sessionJson.authenticated!==false)fail('UNEXPECTED_PREAUTH_SESSION');

  const rpc=await request(`${base}/api/rpc`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base},
    body:JSON.stringify({action:'bootstrap',payload:{}})
  });
  print('RPC_UNAUTH_BOOTSTRAP',rpc);
  const rpcJson=jsonOrNull(rpc.text);
  if(rpc.status===403&&rpcJson?.error==='FORBIDDEN')fail('PREVIEW_APP_ORIGIN_MISMATCH');
  else if(rpc.status!==401||rpcJson?.error!=='UNAUTHENTICATED')fail(`RPC_FAIL_CLOSED_UNEXPECTED status=${rpc.status}`);

  const media=await request(`${base}/api/staging/media-get`);
  print('MEDIA_BINDING_PROBE',media);
  if(media.status===404)fail('PREVIEW_RUNTIME_BACKEND_NOT_SUPABASE_STAGING');
  else if(media.status===503&&media.text.includes('R2_BINDING_REQUIRED'))fail('PREVIEW_R2_BINDING_MISSING');
  else if(media.status!==403||!media.text.includes('FORBIDDEN'))fail(`MEDIA_BINDING_PROBE_UNEXPECTED status=${media.status}`);

  if(!process.exitCode)console.log('PREVIEW_READONLY_VERIFY=PASS');
  console.log('OBJECT_WRITE=NONE');
  console.log('REMOTE_MUTATION=NONE');
}catch(error){
  fail(String(error?.message||error));
}
