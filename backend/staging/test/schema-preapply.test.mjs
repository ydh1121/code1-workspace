import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const schemaDir=path.resolve(here,'../schema');
const read=name=>fs.readFileSync(path.join(schemaDir,name),'utf8');
const runtime=read('0001_runtime.sql');
const planning=read('0003_planning_delta_20260910.sql');
const hardening=read('0004_preapply_security_hardening.sql');
const authThrottle=read('0007_auth_throttle.sql');
const authThrottleCompat=read('0008_auth_throttle_sha256_compat.sql');

test('housing-environment schema remains extensible across codes 1-4',()=>{
  assert.match(planning,/housing_environment_code smallint check \(housing_environment_code between 1 and 4\)/);
  assert.doesNotMatch(planning,/housing_environment_code\s*=\s*1/);
  assert.match(hardening,/housing_environment_verified_requires_evidence/);
  assert.match(hardening,/subject_type <> 'FARM' or \(farm_id is not null and subject_id = farm_id\)/);
});

test('Fact Inbox verification cannot become public or verified without evidence in staging',()=>{
  assert.match(hardening,/fact_verified_requires_evidence/);
  assert.match(hardening,/fact_external_disclosure_disabled_staging/);
  assert.match(hardening,/EVIDENCE_REQUIRED/);
  assert.match(hardening,/p_evidence_ref jsonb/);
});

test('stable submission identity cannot move between farms',()=>{
  assert.match(hardening,/SUBMISSION_FARM_IMMUTABLE/);
  assert.doesNotMatch(hardening,/update intake_submissions set\s+farm_id=p_farm_id/);
});

test('service-boundary mutation RPCs are not executable by browser roles',()=>{
  for(const fn of ['code1_save_submission','code1_review_submission','code1_review_media','code1_save_question_policies','code1_transition_fact']){
    assert.ok(hardening.includes(`revoke all on function ${fn}(`),`missing browser-role revoke for ${fn}`);
  }
  assert.match(hardening,/from public, anon, authenticated/);
  assert.match(hardening,/to service_role/);
});

test('base runtime remains RLS fail-closed with no browser policy declarations',()=>{
  assert.match(runtime,/alter table workspace_accounts enable row level security/);
  assert.match(runtime,/alter table audit_log enable row level security/);
  assert.doesNotMatch(runtime,/create\s+policy/i);
});

test('staging password throttle preserves legacy limits and SHA256 user-key namespace',()=>{
  assert.match(authThrottle,/interval '15 minutes'/);
  assert.match(authThrottle,/then 40 else 8/);
  assert.match(authThrottleCompat,/extensions\.digest\(convert_to\(v_username,'UTF8'\),'sha256'\)/);
  assert.doesNotMatch(authThrottleCompat,/md5\(/);
  assert.match(authThrottleCompat,/revoke all on function public\.code1_auth_throttle\(text,text\) from anon/);
  assert.match(authThrottleCompat,/grant execute on function public\.code1_auth_throttle\(text,text\) to service_role/);
});
