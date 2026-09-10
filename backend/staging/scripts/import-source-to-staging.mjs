import fs from 'node:fs';
import {createDb,assertStagingEnv} from '../src/db.mjs';
import {prepareSourceImport,applyPreparedImport,readImportedCounts} from '../src/import-runner.mjs';

const input=process.argv[2];
const apply=process.argv.includes('--apply');
if(!input)throw Error('usage: node import-source-to-staging.mjs source.json [--apply]');
const source=JSON.parse(fs.readFileSync(input,'utf8'));
const prepared=prepareSourceImport(source);
const expected={
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
console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',expected,excludedDeckMedia:prepared.runtime.excluded.deckMedia.length,warnings:prepared.runtime.warnings},null,2));
if(!apply)process.exit(0);

const cfg=assertStagingEnv(process.env);
if(process.env.CODE1_IMPORT_TARGET!=='STAGING')throw Error('CODE1_IMPORT_TARGET_MUST_BE_STAGING');
if(process.env.CODE1_IMPORT_CONFIRM_REF!==cfg.ref)throw Error('CODE1_IMPORT_CONFIRM_REF_MISMATCH');
const db=createDb(process.env);
const written=await applyPreparedImport(db,prepared,{confirmRef:process.env.CODE1_IMPORT_CONFIRM_REF,expectedRef:cfg.ref});
const actual=await readImportedCounts(db);
const mismatches=[];
for(const [key,value] of Object.entries(expected))if(actual[key]!==value)mismatches.push(`${key}: expected ${value}, got ${actual[key]}`);
if(mismatches.length){console.error(JSON.stringify({ok:false,written,actual,mismatches},null,2));process.exit(2);}
console.log(JSON.stringify({ok:true,written,actual},null,2));
