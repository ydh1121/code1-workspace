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
function command(file,args,cwd,{allowFailure=false}={}){
  try{
    return execFileSync(file,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,maxBuffer:8*1024*1024}).trim();
  }catch(error){
    if(allowFailure) return `COMMAND_FAILED exit=${error.status??'unknown'}`;
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
function resolveWranglerCli(repoRoot){
  const packageRoot=resolve(repoRoot,'node_modules','wrangler');
  const packageJsonPath=join(packageRoot,'package.json');
  if(!existsSync(packageJsonPath)) fail('LOCAL_WRANGLER_NOT_FOUND run npm ci in the CODE1 repo; this runner never installs packages');

  let pkg;
  try{
    pkg=JSON.parse(readFileSync(packageJsonPath,'utf8'));
  }catch{
    fail('LOCAL_WRANGLER_PACKAGE_INVALID');
  }

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
function wrangler(args,cwd=repoRoot,options={}){
  return command(process.execPath,[wranglerCli,...args],cwd,options);
}

console.log('CODE1 Cloudflare/R2 READ-ONLY audit');
console.log(`branch=${branch}`);
console.log(`pagesProject=${pagesProject}`);
console.log(`bucket=${bucketName||'UNSELECTED'}`);
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('This runner never calls create/delete/set/enable/disable/deploy/auth-token commands.');

printSection('WRANGLER_VERSION',wrangler(['--version']));
printSection('WHOAMI_SAFE',wrangler(['whoami','--json']));
printSection('PAGES_PROJECT_LIST',wrangler(['pages','project','list','--json']));
printSection('R2_BUCKET_LIST',wrangler(['r2','bucket','list']));

const temp=mkdtempSync(join(tmpdir(),'code1-cf-readonly-'));
try{
  wrangler(['pages','download','config',pagesProject,'--force'],temp);
  const configName=readdirSync(temp).find(n=>/^wrangler\.toml$/i.test(n));
  if(!configName) printSection('PAGES_R2_BINDINGS','DOWNLOAD_SUCCEEDED_BUT_WRANGLER_TOML_NOT_FOUND');
  else printSection('PAGES_R2_BINDINGS',extractTomlR2(readFileSync(join(temp,configName),'utf8')));
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
