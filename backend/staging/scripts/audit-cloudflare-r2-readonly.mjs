import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const DEFAULT_PAGES_PROJECT='code1-workspace';

function fail(message){ console.error(`AUDIT_BLOCKED: ${message}`); process.exit(1); }
function arg(name){ const i=process.argv.indexOf(name); return i>=0 ? process.argv[i+1] : ''; }
function assertArgs(){
  const valued=new Set(['--bucket','--pages-project']);
  for(let i=2;i<process.argv.length;i++){
    const a=process.argv[i];
    if(!valued.has(a)) fail(`UNKNOWN_ARGUMENT ${a}`);
    if(i+1>=process.argv.length||process.argv[i+1].startsWith('--')) fail(`MISSING_VALUE ${a}`);
    i++;
  }
}
function safeName(value,label){
  const v=String(value||'').trim();
  if(!v||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v)) fail(`INVALID_${label}`);
  return v;
}
function redactDiagnostic(value){
  return String(value||'')
    .replace(/\x1b\[[0-9;]*m/g,' ')
    .replace(/\/accounts\/[A-Za-z0-9_-]+/gi,'/accounts/<redacted-account>')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'<redacted-email>')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi,'$1<redacted-token>')
    .replace(/((?:token|secret|api[_-]?key|service[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,'$1<redacted-value>')
    .replace(/\s+/g,' ')
    .trim();
}
function compactFailureText(error){
  const raw=redactDiagnostic([error?.stdout,error?.stderr].filter(Boolean).join('\n'));
  return raw ? ` detail=${raw.slice(0,500)}` : '';
}
function command(file,args,cwd,{allowFailure=false}={}){
  try{
    return execFileSync(file,args,{
      cwd,
      encoding:'utf8',
      stdio:['ignore','pipe','pipe'],
      windowsHide:true,
      maxBuffer:8*1024*1024
    }).trim();
  }catch(error){
    if(allowFailure) return `COMMAND_FAILED exit=${error.status??'unknown'}${compactFailureText(error)}`;
    fail(`COMMAND_FAILED ${args.join(' ')} exit=${error.status??'unknown'}`);
  }
}
function printSection(name,value){
  console.log(`\n===== ${name} =====`);
  console.log(value||'(empty)');
}
function parseWhoami(raw){
  try{return JSON.parse(raw);}catch{return null;}
}
function safeWhoami(raw){
  const data=parseWhoami(raw);
  if(!data)return 'WHOAMI_PARSE_FAILED';
  return JSON.stringify({
    loggedIn:!!data.loggedIn,
    authType:data.authType||null,
    accountCount:Array.isArray(data.accounts)?data.accounts.length:0,
    tokenPermissionCount:Array.isArray(data.tokenPermissions)?data.tokenPermissions.length:0
  },null,2);
}
function extractTomlSafeShape(text){
  const out=[];
  let section='ROOT';
  const safeRootValues=new Set(['name','pages_build_output_dir','compatibility_date','compatibility_flags']);
  for(const raw of String(text).split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    if(/^\[\[.*\]\]$/.test(line)||/^\[.*\]$/.test(line)){
      section=line;
      out.push(line);
      continue;
    }
    const m=line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if(!m)continue;
    const [,key,value]=m;
    if(section==='ROOT'&&safeRootValues.has(key)){out.push(`${key} = ${value}`);continue;}
    if(/(?:^|\.)vars\]?$/i.test(section)||/secret/i.test(section)){out.push(`${key} = <redacted-present>`);continue;}
    if(/r2_buckets/i.test(section)&&['binding','bucket_name','preview_bucket_name','jurisdiction'].includes(key)){
      out.push(`${key} = ${value}`);
      continue;
    }
    if(key==='binding'){out.push(`${key} = ${value}`);continue;}
    if(/(?:^|_)(id|token|key|secret)$/i.test(key)||/(database_id|namespace_id|account_id)/i.test(key)){
      out.push(`${key} = <redacted-present>`);
      continue;
    }
    out.push(`${key} = <present>`);
  }
  return out.length?out.join('\n'):'NO_CONFIG_KEYS_FOUND';
}
function collectR2ByEnvironment(text){
  const groups={top:[],preview:[],production:[]};
  let target='';
  let current=null;
  const flush=()=>{if(current&&target)groups[target].push(current);current=null;};
  for(const raw of String(text).split(/\r?\n/)){
    const line=raw.trim();
    const header=line.match(/^\[\[([^\]]+)\]\]$/);
    if(header){
      flush();
      if(header[1]==='r2_buckets')target='top';
      else if(header[1]==='env.preview.r2_buckets')target='preview';
      else if(header[1]==='env.production.r2_buckets')target='production';
      else target='';
      if(target)current={};
      continue;
    }
    if(/^\[.*\]$/.test(line)){flush();target='';continue;}
    if(!current)continue;
    const m=line.match(/^(binding|bucket_name|preview_bucket_name|jurisdiction)\s*=\s*"([^"]*)"\s*$/);
    if(m)current[m[1]]=m[2];
  }
  flush();
  return groups;
}
function formatR2(entries){
  if(!entries.length)return 'NONE_FOUND';
  return entries.map((entry,index)=>[
    `binding[${index+1}] = ${entry.binding||'<missing>'}`,
    `bucket_name[${index+1}] = ${entry.bucket_name||'<missing>'}`,
    entry.jurisdiction?`jurisdiction[${index+1}] = ${entry.jurisdiction}`:null
  ].filter(Boolean).join('\n')).join('\n');
}
function interpretDownloadedR2(text){
  const groups=collectR2ByEnvironment(text);
  const preview=groups.preview.length?groups.preview:groups.top;
  const production=groups.production;
  return {preview,production};
}
function safeDeploymentExposure(raw,expectedEnvironment){
  if(String(raw).startsWith('COMMAND_FAILED'))return raw;
  try{
    const parsed=JSON.parse(raw);
    const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.result)?parsed.result:[];
    const normalized=rows.map(row=>({
      environment:String(row?.Environment??row?.environment??'').trim().toLowerCase(),
      branch:String(row?.Branch??row?.branch??row?.deployment_trigger?.metadata?.branch??'').trim()
    }));
    const matching=normalized.filter(row=>!row.environment||row.environment===expectedEnvironment);
    const branches=[...new Set(matching.map(row=>row.branch).filter(Boolean))].sort();
    const unexpected=expectedEnvironment==='preview'?branches.filter(branch=>branch!==EXPECTED_BRANCH):[];
    let exposureGate='OBSERVED_PRODUCTION_CONTEXT_ONLY';
    if(expectedEnvironment==='preview'){
      exposureGate=unexpected.length
        ? 'BLOCKED_OTHER_PREVIEW_BRANCHES_OBSERVED'
        : 'UNRESOLVED_CONFIGURED_BRANCH_FILTER_MANUAL_VERIFICATION_REQUIRED';
    }
    return JSON.stringify({
      environment:expectedEnvironment,
      deploymentCount:matching.length,
      observedBranches:branches,
      unexpectedPreviewBranches:unexpected,
      configuredBranchFilter:expectedEnvironment==='preview'
        ? 'MANUAL_DASHBOARD_VERIFICATION_REQUIRED'
        : 'NOT_APPLICABLE',
      exposureGate
    },null,2);
  }catch{
    return 'DEPLOYMENT_LIST_PARSE_FAILED';
  }
}
function resolveWranglerCli(repoRoot){
  const packageRoot=resolve(repoRoot,'node_modules','wrangler');
  const packageJsonPath=join(packageRoot,'package.json');
  if(!existsSync(packageJsonPath)) fail('LOCAL_WRANGLER_NOT_FOUND run npm ci in the CODE1 repo; this runner never installs packages');
  let pkg;
  try{pkg=JSON.parse(readFileSync(packageJsonPath,'utf8'));}
  catch{fail('LOCAL_WRANGLER_PACKAGE_INVALID');}
  const binRelative=typeof pkg.bin==='string' ? pkg.bin : pkg.bin?.wrangler;
  if(typeof binRelative!=='string'||!binRelative.trim()) fail('LOCAL_WRANGLER_BIN_NOT_FOUND');
  const cli=resolve(packageRoot,binRelative);
  const packagePrefix=packageRoot.endsWith(sep)?packageRoot:`${packageRoot}${sep}`;
  if(!cli.startsWith(packagePrefix)||!existsSync(cli)) fail('LOCAL_WRANGLER_BIN_INVALID');
  return cli;
}

assertArgs();
const bucketRaw=arg('--bucket');
const pagesProject=safeName(arg('--pages-project')||DEFAULT_PAGES_PROJECT,'PAGES_PROJECT');
const bucketName=bucketRaw?safeName(bucketRaw,'BUCKET_NAME'):'';
const scriptDir=resolve(fileURLToPath(new URL('.',import.meta.url)));
const repoRoot=resolve(scriptDir,'../../..');
const branch=command('git',['rev-parse','--abbrev-ref','HEAD'],repoRoot);
if(branch!==EXPECTED_BRANCH) fail(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const wranglerCli=resolveWranglerCli(repoRoot);
function wrangler(args,cwd=repoRoot,options={}){return command(process.execPath,[wranglerCli,...args],cwd,options);}

function inspectPagesConfig(){
  const temp=mkdtempSync(join(tmpdir(),'code1-cf-pages-config-'));
  try{
    const result=wrangler(['pages','download','config',pagesProject,'--force'],temp,{allowFailure:true});
    if(result.startsWith('COMMAND_FAILED')){
      printSection('PAGES_REMOTE_CONFIG_DOWNLOAD',result);
      return;
    }
    const configName=readdirSync(temp).find(n=>/^wrangler\.toml$/i.test(n));
    if(!configName){
      printSection('PAGES_REMOTE_CANONICAL_SAFE_CONFIG','DOWNLOAD_SUCCEEDED_BUT_WRANGLER_TOML_NOT_FOUND');
      return;
    }
    const configText=readFileSync(join(temp,configName),'utf8');
    const interpreted=interpretDownloadedR2(configText);
    printSection('PAGES_REMOTE_CANONICAL_SAFE_CONFIG',extractTomlSafeShape(configText));
    printSection('PAGES_PREVIEW_R2_BINDINGS_INTERPRETED',formatR2(interpreted.preview));
    printSection('PAGES_PRODUCTION_R2_BINDINGS_INTERPRETED',formatR2(interpreted.production));
    printSection(
      'PAGES_DOWNLOAD_CONFIG_SEMANTICS',
      'Preview is top-level unless env.preview is emitted; Production is env.production. pages download config fetches both environments and does not support selecting one with --env.'
    );
  }finally{
    rmSync(temp,{recursive:true,force:true});
  }
}

console.log('CODE1 Cloudflare/R2 READ-ONLY audit');
console.log(`branch=${branch}`);
console.log(`pagesProject=${pagesProject}`);
console.log(`bucket=${bucketName||'UNSELECTED'}`);
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('This runner never calls create/delete/set/enable/disable/deploy/auth-token/object-write commands.');

printSection('WRANGLER_VERSION',wrangler(['--version']));
const whoamiRaw=wrangler(['whoami','--json']);
printSection('WHOAMI_SAFE',safeWhoami(whoamiRaw));
printSection('PAGES_PROJECT_LIST',wrangler(['pages','project','list','--json']));
printSection('R2_BUCKET_LIST',wrangler(['r2','bucket','list']));
inspectPagesConfig();

printSection(
  'PAGES_PROJECT_SOURCE_BRANCH_CONTROLS',
  [
    'MANUAL_DASHBOARD_VERIFICATION_REQUIRED',
    `required.productionBranch=main`,
    `required.previewDeploymentSetting=custom`,
    `required.previewBranchIncludes=["${EXPECTED_BRANCH}"]`,
    'required.previewBranchExcludes=[]',
    'Reason: supported Wrangler Pages list/download commands do not expose configured source branch include/exclude controls; this runner will not read or import private Wrangler OAuth internals.'
  ].join('\n')
);
printSection(
  'PAGES_PREVIEW_DEPLOYMENT_EXPOSURE',
  safeDeploymentExposure(
    wrangler(['pages','deployment','list','--project-name',pagesProject,'--environment','preview','--json'],repoRoot,{allowFailure:true}),
    'preview'
  )
);
printSection(
  'PAGES_PRODUCTION_DEPLOYMENT_EXPOSURE',
  safeDeploymentExposure(
    wrangler(['pages','deployment','list','--project-name',pagesProject,'--environment','production','--json'],repoRoot,{allowFailure:true}),
    'production'
  )
);
printSection(
  'PAGES_BRANCH_FILTER_READBACK',
  'BLOCKED_PENDING_MANUAL_DASHBOARD_VERIFICATION: do not provision Preview service-role/runtime secrets until configured branch controls are explicitly verified.'
);

if(bucketName){
  printSection('R2_BUCKET_INFO',wrangler(['r2','bucket','info',bucketName,'--json']));
  printSection('R2_DEV_URL',wrangler(['r2','bucket','dev-url','get',bucketName],repoRoot,{allowFailure:true}));
  printSection('R2_CUSTOM_DOMAINS',wrangler(['r2','bucket','domain','list',bucketName],repoRoot,{allowFailure:true}));
  printSection('R2_CORS',wrangler(['r2','bucket','cors','list',bucketName],repoRoot,{allowFailure:true}));
  printSection('R2_LIFECYCLE',wrangler(['r2','bucket','lifecycle','list',bucketName],repoRoot,{allowFailure:true}));
  printSection('R2_LOCKS',wrangler(['r2','bucket','lock','list',bucketName],repoRoot,{allowFailure:true}));
  console.log('\nR2_RESOURCE_IDENTITY_AUDIT=BUCKET_DETAIL_COLLECTED');
}else{
  console.log('\nR2_RESOURCE_IDENTITY_AUDIT=BUCKET_SELECTION_REQUIRED');
  console.log('Re-run with: node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket <EXACT_CODE1_BUCKET_NAME>');
}
console.log('OBJECT_INVENTORY=NOT_MUTATED');
console.log('REMOTE_MUTATION=NONE');
