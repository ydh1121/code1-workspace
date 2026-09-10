import {assertStagingEnv,createDb} from './db.mjs';
import {readImportedCounts} from './import-runner.mjs';

const dataCountKeys=[
  'accounts','farms','questions','submissions','answerVersions','media','mediaEvents','auditLog','loginGuard',
  'housingEnvironment','questionPolicies','questionPolicyHistory','planningCapabilities','planningBriefVersions','planningSourceArtifacts'
];

export function assertImportControlEnv(env={}){
  const cfg=assertStagingEnv(env);
  if(env.CODE1_IMPORT_TARGET!=='STAGING')throw Error('CODE1_IMPORT_TARGET_MUST_BE_STAGING');
  if(env.CODE1_IMPORT_CONFIRM_REF!==cfg.ref)throw Error('CODE1_IMPORT_CONFIRM_REF_MISMATCH');
  return cfg;
}

export function nonEmptyImportCounts(counts={}){
  return dataCountKeys
    .map(key=>[key,Number(counts[key]||0)])
    .filter(([,value])=>value!==0)
    .map(([key,value])=>({key,value}));
}

export async function runImportPreflight(env={},fetchImpl=fetch){
  const cfg=assertImportControlEnv(env);
  const db=createDb(env,fetchImpl);
  const counts=await readImportedCounts(db);
  const nonEmpty=nonEmptyImportCounts(counts);
  const retryAllowed=env.CODE1_IMPORT_ALLOW_NONEMPTY==='IDEMPOTENT_RETRY';
  if(nonEmpty.length&&!retryAllowed){
    const error=Error('CODE1_IMPORT_TARGET_NOT_EMPTY');
    error.nonEmpty=nonEmpty;
    throw error;
  }
  return {
    ok:true,
    target:'STAGING',
    projectRef:cfg.ref,
    counts,
    nonEmpty,
    mode:nonEmpty.length?'IDEMPOTENT_RETRY':'FIRST_IMPORT'
  };
}
