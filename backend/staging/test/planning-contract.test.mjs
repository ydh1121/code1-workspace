import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFactTransition,normalizeHousingEnvironmentCode,housingEnvironmentSourceRecord,privatePlanningObjectKey,assertPrivatePlanningArtifact} from '../src/planning-contract.mjs';
import {normalizePlanningSource,verifyPlanningNormalized} from '../src/planning-source-normalizer.mjs';

test('housing environment accepts 1-4 without quality-grade or category-1 hard code',()=>{
  assert.equal(normalizeHousingEnvironmentCode('1'),1);
  assert.equal(normalizeHousingEnvironmentCode('2'),2);
  assert.equal(normalizeHousingEnvironmentCode('3'),3);
  assert.equal(normalizeHousingEnvironmentCode('4'),4);
  assert.equal(normalizeHousingEnvironmentCode('미확인'),null);
  assert.equal(normalizeHousingEnvironmentCode(''),null);
  const row=housingEnvironmentSourceRecord({farm_id:'GF-1','사육환경번호':'미확인'});
  assert.equal(row.housing_environment_code,null);
  assert.equal(row.source_value,'미확인');
  assert.equal(row.verification_status,'UNCONFIRMED');
});

test('planning source normalization never auto-verifies housing environment',()=>{
  const n=normalizePlanningSource({farms:[{farm_id:'GF-1','사육환경번호':'1'},{farm_id:'GF-2','사육환경번호':'4'},{farm_id:'GF-3','사육환경번호':''}]});
  const v=verifyPlanningNormalized(n);
  assert.equal(v.ok,true);
  assert.deepEqual(n.housingEnvironmentRecords.map(x=>x.housing_environment_code),[1,4,null]);
  assert.ok(n.housingEnvironmentRecords.every(x=>x.verification_status==='UNCONFIRMED'));
  assert.equal(v.counts.facts,0);
  assert.equal(v.counts.planningBriefVersions,0);
});

test('Fact Inbox transition graph does not allow verification shortcuts',()=>{
  assert.equal(assertFactTransition('RECEIVED','USER_REPORTED'),true);
  assert.throws(()=>assertFactTransition('USER_REPORTED','VERIFIED'),/INVALID_FACT_TRANSITION/);
  assert.equal(assertFactTransition('DOCUMENT_RECEIVED','VERIFIED'),true);
  assert.equal(assertFactTransition('VERIFIED','APPROVED_CURRENT'),true);
});

test('planning artifacts have no public-delivery path',()=>{
  const key=privatePlanningObjectKey('GF-CONFIDENTIAL','source.pdf');
  assert.equal(key,'private/planning/GF-CONFIDENTIAL/source.pdf');
  assert.equal(assertPrivatePlanningArtifact({object_key:key,public_delivery_allowed:false}),true);
  assert.throws(()=>assertPrivatePlanningArtifact({object_key:'public/source.pdf',public_delivery_allowed:false}),/CONFIDENTIAL_OBJECT_KEY_REQUIRED/);
  assert.throws(()=>assertPrivatePlanningArtifact({object_key:key,public_delivery_allowed:true}),/CONFIDENTIAL_PUBLIC_DELIVERY_FORBIDDEN/);
});
