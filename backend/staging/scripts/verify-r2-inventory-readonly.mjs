#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const EXPECTED_BRANCH='coding/runtime-backend-staging';
const EXPECTED_BUCKET='code1-staging-media';
const EXPECTED_OBJECTS=[
  {
    key:'private/farms/GF-ORIGIN-04/submissions/SUB_7509b1fe97de416c91c96540dd0e49fb/media/M_32c63189358249c2844869a4/original/code1-integration-small-1789155245633.bin',
    size:131072
  },
  {
    key:'private/farms/GF-ORIGIN-04/submissions/SUB_7509b1fe97de416c91c96540dd0e49fb/media/M_6132c51925d449b2b5b2e402/original/code1-integration-multipart-1789155245633.bin',
    size:11534336
  }
];
const EXPECTED_TOTAL=EXPECTED_OBJECTS.reduce((sum,row)=>sum+row.size,0);

function fail(message){
  console.error(`R2_INVENTORY_READONLY_VERIFY=FAIL ${message}`);
  process.exit(1);
}
function command(file,args,cwd,{encoding='utf8'}={}){
  try{
    return execFileSync(file,args,{
      cwd,
      encoding,
      stdio:['ignore','pipe','pipe'],
      windowsHide:true,
      maxBuffer:32*1024*1024
    });
  }catch(error){
    const detail=String(error?.stderr||error?.stdout||'').replace(/\x1b\[[0-9;]*m/g,' ').replace(/\s+/g,' ').trim().slice(0,500);
    fail(`COMMAND_FAILED ${args.join(' ')}${detail?` detail=${detail}`:''}`);
  }
}
function resolveWranglerCli(repoRoot){
  const packageRoot=resolve(repoRoot,'node_modules','wrangler');
  const packageJsonPath=join(packageRoot,'package.json');
  if(!existsSync(packageJsonPath))fail('LOCAL_WRANGLER_NOT_FOUND run npm ci in the CODE1 repo');
  let pkg;
  try{pkg=JSON.parse(readFileSync(packageJsonPath,'utf8'));}catch{fail('LOCAL_WRANGLER_PACKAGE_INVALID');}
  const binRelative=typeof pkg.bin==='string'?pkg.bin:pkg.bin?.wrangler;
  if(typeof binRelative!=='string'||!binRelative.trim())fail('LOCAL_WRANGLER_BIN_NOT_FOUND');
  const cli=resolve(packageRoot,binRelative);
  const prefix=packageRoot.endsWith(sep)?packageRoot:`${packageRoot}${sep}`;
  if(!cli.startsWith(prefix)||!existsSync(cli))fail('LOCAL_WRANGLER_BIN_INVALID');
  return cli;
}
function parseBucketInfo(raw){
  let data;
  try{data=JSON.parse(String(raw).trim());}catch{fail('BUCKET_INFO_JSON_PARSE_FAILED');}
  const count=Number(data?.object_count);
  if(!Number.isSafeInteger(count)||count<0)fail('BUCKET_OBJECT_COUNT_INVALID');
  return {count,bucketSize:data?.bucket_size??null};
}

const scriptDir=resolve(fileURLToPath(new URL('.',import.meta.url)));
const repoRoot=resolve(scriptDir,'../../..');
const branch=String(command('git',['rev-parse','--abbrev-ref','HEAD'],repoRoot)).trim();
if(branch!==EXPECTED_BRANCH)fail(`BRANCH_MISMATCH expected=${EXPECTED_BRANCH} actual=${branch}`);
const wranglerCli=resolveWranglerCli(repoRoot);
const wrangler=args=>command(process.execPath,[wranglerCli,...args],repoRoot);

console.log('CODE1 R2 READ-ONLY inventory verification');
console.log(`branch=${branch}`);
console.log(`bucket=${EXPECTED_BUCKET}`);
console.log('REMOTE_MUTATION=DISALLOWED');
console.log('REMOTE_READ_ONLY=BUCKET_INFO_PLUS_OBJECT_GET');

const bucketInfo=parseBucketInfo(wrangler(['r2','bucket','info',EXPECTED_BUCKET,'--json']));
console.log(`BUCKET_OBJECT_COUNT=${bucketInfo.count}`);
console.log(`BUCKET_SIZE_REPORTED=${bucketInfo.bucketSize??'UNAVAILABLE'}`);
if(bucketInfo.count!==EXPECTED_OBJECTS.length)fail(`OBJECT_COUNT_MISMATCH expected=${EXPECTED_OBJECTS.length} actual=${bucketInfo.count}`);

const temp=mkdtempSync(join(tmpdir(),'code1-r2-inventory-'));
let total=0;
try{
  for(let i=0;i<EXPECTED_OBJECTS.length;i++){
    const expected=EXPECTED_OBJECTS[i];
    const target=join(temp,`object-${i+1}.bin`);
    wrangler(['r2','object','get',`${EXPECTED_BUCKET}/${expected.key}`,'--remote','--file',target]);
    const size=statSync(target).size;
    total+=size;
    if(size!==expected.size)fail(`OBJECT_SIZE_MISMATCH media=${expected.key.match(/\/media\/([^/]+)\//)?.[1]||i+1} expected=${expected.size} actual=${size}`);
    const mediaId=expected.key.match(/\/media\/([^/]+)\//)?.[1]||`object-${i+1}`;
    console.log(`OBJECT_READ=PASS mediaId=${mediaId} bytes=${size}`);
  }
}finally{
  rmSync(temp,{recursive:true,force:true});
}

if(total!==EXPECTED_TOTAL)fail(`TOTAL_SIZE_MISMATCH expected=${EXPECTED_TOTAL} actual=${total}`);
console.log(`VERIFIED_OBJECT_TOTAL_BYTES=${total}`);
console.log('EXPECTED_OBJECTS=2');
console.log('R2_INVENTORY_READONLY_VERIFY=PASS');
console.log('REMOTE_MUTATION=NONE');
