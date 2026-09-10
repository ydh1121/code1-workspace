import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createDb} from '../src/db.mjs';
import {runImportPreflight} from '../src/import-preflight.mjs';
import {prepareSourceImport,applyPreparedImport,readImportedCounts} from '../src/import-runner.mjs';

const EXPECTED_REF='bsintmkyhptizrjoizfb';
const EXPECTED_SOURCE_SHA256='bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b';
const EXPECTED_SOURCE_BYTES=200458;
const EXPECTED_NORMALIZED=Object.freeze({
  accounts:2,
  farms:12,
  questions:231,
  submissions:2,
  answerVersions:5,
  commitSentinels:3,
  media:4,
  excludedDeckMedia:2,
  questionPolicies:0,
  questionPolicyHistory:0,
  auditLog:29,
  loginGuard:3,
  mediaEvents:5,
  housingEnvironment:12,
  planningCapabilities:0,
  planningBriefVersions:0,
  planningSourceArtifacts:0
});

function fail(code,extra={}){
  const error=Error(code);
  Object.assign(error,extra);
  throw error;
}

function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function sameObject(actual,expected){
  const mismatches=[];
  for(const [key,value] of Object.entries(expected))if(Number(actual?.[key]??0)!==value)mismatches.push({key,expected:value,actual:Number(actual?.[key]??0)});
  return mismatches;
}

export function verifyKnownPrivateSnapshot(bytes,source){
  const digest=sha256(bytes);
  if(digest!==EXPECTED_SOURCE_SHA256)fail('CODE1_PRIVATE_SOURCE_SHA256_MISMATCH',{digest});
  if(bytes.length!==EXPECTED_SOURCE_BYTES)fail('CODE1_PRIVATE_SOURCE_SIZE_MISMATCH',{size:bytes.length});
  const prepared=prepareSourceImport(source);
  const runtime=prepared.checks.runtime.counts;
  const planning=prepared.checks.planning.counts;
  const actualShape={
    accounts:runtime.accounts,
    farms:runtime.farms,
    questions:runtime.questions,
    submissions:runtime.submissions,
    answerVersions:runtime.answerVersions,
    commitSentinels:runtime.commitSentinels,
    media:runtime.media,
    excludedDeckMedia:runtime.excludedDeckMedia,
    questionPolicies:runtime.questionPolicies,
    questionPolicyHistory:runtime.questionPolicyHistory,
    auditLog:runtime.auditLog,
    loginGuard:runtime.loginGuard,
    mediaEvents:runtime.mediaEvents,
    housingEnvironment:planning.housingEnvironmentRecords,
    planningCapabilities:0,
    planningBriefVersions:planning.planningBriefVersions,
    planningSourceArtifacts:planning.planningSourceArtifacts
  };
  const mismatches=sameObject(actualShape,EXPECTED_NORMALIZED);
  if(mismatches.length)fail('CODE1_PRIVATE_SOURCE_SHAPE_MISMATCH',{mismatches});
  return {digest,size:bytes.length,prepared,shape:actualShape};
}

function importEnv({retry=false}={}){
  return {
    ...process.env,
    CODE1_SUPABASE_URL:`https://${EXPECTED_REF}.supabase.co`,
    CODE1_STAGING_PROJECT_REF:EXPECTED_REF,
    CODE1_IMPORT_TARGET:'STAGING',
    CODE1_IMPORT_CONFIRM_REF:EXPECTED_REF,
    CODE1_IMPORT_ALLOW_NONEMPTY:retry?'IDEMPOTENT_RETRY':''
  };
}

function expectedDestinationCounts(prepared){
  return {
    accounts:prepared.runtime.accounts.length,
    farms:prepared.runtime.farms.length,
    questions:prepared.runtime.questions.length,
    submissions:prepared.runtime.submissions.length,
    answerVersions:prepared.runtime.answers.length,
    media:prepared.runtime.media.length,
    mediaEvents:prepared.runtime.mediaEvents.length,
    auditLog:prepared.runtime.auditLog.length,
    loginGuard:prepared.runtime.loginGuard.length,
    housingEnvironment:prepared.planning.housingEnvironmentRecords.length,
    questionPolicies:prepared.runtime.questionPolicies.length,
    questionPolicyHistory:prepared.runtime.questionPolicyHistory.length,
    planningCapabilities:0,
    planningBriefVersions:0,
    planningSourceArtifacts:0
  };
}

async function main(){
  const args=process.argv.slice(2);
  const flags=new Set(args.filter(arg=>arg.startsWith('--')));
  const input=args.find(arg=>!arg.startsWith('--'));
  const allowed=new Set(['--preflight','--apply','--idempotent-retry']);
  for(const flag of flags)if(!allowed.has(flag))fail('CODE1_PRIVATE_IMPORT_UNKNOWN_FLAG',{flag});
  if(!input)fail('CODE1_PRIVATE_SOURCE_PATH_REQUIRED');
  if(flags.has('--preflight')&&flags.has('--apply'))fail('CODE1_PRIVATE_IMPORT_MODE_CONFLICT');
  if(flags.has('--idempotent-retry')&&!flags.has('--apply'))fail('CODE1_PRIVATE_RETRY_REQUIRES_APPLY');

  const bytes=fs.readFileSync(input);
  let source;
  try{source=JSON.parse(bytes.toString('utf8'));}catch{fail('CODE1_PRIVATE_SOURCE_JSON_INVALID');}
  const verified=verifyKnownPrivateSnapshot(bytes,source);
  const expected=expectedDestinationCounts(verified.prepared);
  const base={
    ok:true,
    projectRef:EXPECTED_REF,
    sourceSha256:verified.digest,
    sourceBytes:verified.size,
    expected,
    excludedDeckMedia:verified.prepared.runtime.excluded.deckMedia.length,
    warnings:verified.prepared.runtime.warnings
  };

  if(!flags.has('--preflight')&&!flags.has('--apply')){
    console.log(JSON.stringify({...base,mode:'SOURCE_CHECK_ONLY'},null,2));
    return;
  }

  const retry=flags.has('--idempotent-retry');
  const env=importEnv({retry});
  if(!String(env.CODE1_SUPABASE_SERVICE_ROLE_KEY||'').trim())fail('CODE1_SUPABASE_SERVICE_ROLE_KEY_REQUIRED');
  const preflight=await runImportPreflight(env);

  if(flags.has('--preflight')){
    console.log(JSON.stringify({...base,mode:'PREFLIGHT_ONLY',preflight},null,2));
    return;
  }

  if(!retry&&preflight.mode!=='FIRST_IMPORT')fail('CODE1_PRIVATE_IMPORT_FIRST_IMPORT_REQUIRED',{preflightMode:preflight.mode});
  if(retry&&preflight.mode!=='IDEMPOTENT_RETRY'&&preflight.mode!=='FIRST_IMPORT')fail('CODE1_PRIVATE_IMPORT_RETRY_PREFLIGHT_INVALID',{preflightMode:preflight.mode});

  const db=createDb(env);
  const written=await applyPreparedImport(db,verified.prepared,{confirmRef:EXPECTED_REF,expectedRef:EXPECTED_REF});
  const actual=await readImportedCounts(db);
  const mismatches=sameObject(actual,expected);
  if(mismatches.length)fail('CODE1_PRIVATE_IMPORT_POSTCHECK_MISMATCH',{mismatches,written});

  console.log(JSON.stringify({...base,mode:retry?'IDEMPOTENT_RETRY_APPLIED':'FIRST_IMPORT_APPLIED',preflight,written,actual},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    const out={ok:false,error:String(error?.message||error||'CODE1_PRIVATE_IMPORT_FAILED')};
    if(error?.digest)out.digest=error.digest;
    if(error?.size!==undefined)out.size=error.size;
    if(error?.flag)out.flag=error.flag;
    if(error?.preflightMode)out.preflightMode=error.preflightMode;
    if(Array.isArray(error?.mismatches))out.mismatches=error.mismatches;
    if(Array.isArray(error?.nonEmpty))out.nonEmpty=error.nonEmpty;
    console.error(JSON.stringify(out,null,2));
    process.exitCode=2;
  });
}
