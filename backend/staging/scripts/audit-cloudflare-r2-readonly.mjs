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
    return execFileSync(file,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,maxBuffer:8*1024*1024}).trim();
  }catch(error){
    if(allowFailure) return `COMMAND_FAILED exit=${error.status??'unknown'}${compactFailureText(error)}`;
    fail(`COMMAND_FAILED ${args.join(' ')} exit=${error.status??'unknown'}`);
  }
}
function printSection(name,value){
  console.log(`\n===== ${name} =====`);
  console.log(value||'(empty)');
}
function extractTomlR2(text){
  const lines=String(text).split(/\r?\n/),out=[];
  let inR2=false;
  for(const raw of lines){
    const line=raw.trim();
    if(/^\[\[.*\]\]$/.test(line)){
      inR2=/r2_buckets/.test(line);
      if(inR2) out.push(line);
      continue;
    }
    if(/^\[.*\]$/.test(line)){ inR2=false; continue; }
    if(inR2&&/^(binding|bucket_name|preview_bucket_name|jurisdiction)\s*=/.test(line)) out.push(line);
  }
  return out.length?out.join('\n'):'PAGES_R2_BINDINGS = NONE_FOUND';
}
function safeWhoami(raw){
  try{
    const data=JSON.parse(raw);
    return JSON.stringify({loggedIn:!!data.loggedIn,authType:data.authType||null,accountCount:Array.isArray(data.accounts)?data.accounts.length:0,tokenPermissionCount:Array.isArray(data.tokenPermissions)?data.tokenPermissions.length:0},null,2);
  }catch{return 'WHOAMI_PARSE_FAILED';}
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
    if(/r2_buckets/i.test(section)&&['binding','bucket_name','preview_bucket_name','jurisdiction'].includes(key)){out.push(`${key} = ${value}`);continue;}
    if(key==='binding'){out.push(`${key} = ${value}`);continue;}
    if(/(?:^|_)(id|token|key|secret)$/i.test(key)||/(database_id|namespace_id|account_id)/i.test(key)){out.push(`${key} = <redacted-present>`);continue;}
    out.push(`${key} = <present>`);
  }
  return out.length?out.join('\n'):'NO_CONFIG_KEYS_FOUND';
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

console.log('CODE1 Cloudflare/R2 READ-ONLY audit');
console.log(`branch=${branch}`);
console.log(`pagesProject=${pagesProject}`);
console.log(`bucket=${bucketName||'UNSELECTED'}`);
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('This runner never calls create/delete/set/enable/disable/deploy/auth-token commands.');

printSection('WRANGLER_VERSION',wrangler(['--version']));
printSection('WHOAMI_SAFE',safeWhoami(wrangler(['whoami','--json'])));
printSection('PAGES_PROJECT_LIST',wrangler(['pages','project','list','--json']));
printSection('R2_BUCKET_LIST',wrangler(['r2','bucket','list']));

const temp=mkdtempSync(join(tmpdir(),'code1-cf-readonly-'));
try{
  wrangler(['pages','download','config',pagesProject,'--force'],temp);
  const configName=readdirSync(temp).find(n=>/^wrangler\.toml$/i.test(n));
  if(!configName){
    printSection('PAGES_SAFE_CONFIG_SHAPE','DOWNLOAD_SUCCEEDED_BUT_WRANGLER_TOML_NOT_FOUND');
    printSection('PAGES_R2_BINDINGS','DOWNLOAD_SUCCEEDED_BUT_WRANGLER_TOML_NOT_FOUND');
  }else{
    const configText=readFileSync(join(temp,configName),'utf8');
    printSection('PAGES_SAFE_CONFIG_SHAPE',extractTomlSafeShape(configText));
    printSection('PAGES_R2_BINDINGS',extractTomlR2(configText));
  }
}finally{
  rmSync(temp,{recursive:true,force:true});
}

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
