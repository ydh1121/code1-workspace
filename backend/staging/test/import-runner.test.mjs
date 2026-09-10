import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSourceImport,applyPreparedImport} from '../src/import-runner.mjs';

const source={
  accounts:[{account_id:'OWNER',username:'owner',display_name:'Owner',email:'owner@example.com',role:'SUPER_ADMIN',status:'active',permissions_json:'{}',password_salt:'a'.repeat(32),password_hash:'b'.repeat(64),password_iterations:100000,password_scheme:'pbkdf2-sha256-pepper-v1',session_version:1}],
  farms:[{farm_id:'GF-1','내부 농가명':'Farm','공개 농가명':'Farm','상태':'자료요청','Origin_12':'TRUE','사육환경번호':'미확인'}],
  questionCatalog:[{sort_order:1,section_code:'A',section_name:'기본',item_key:'A-01',item_label:'농가명',plain_question:'농가명?',input_type:'text',required_level:'REQUIRED',evidence_required:'FALSE',active:'TRUE'}],
  submissionQueue:[
    {submission_id:'SUB-1',farm_id:'GF-1',farm_name:'Farm',revision:1,item_key:'A-01',input_type:'text',value_text:'""',status:'DRAFT',submitted_by:'owner@example.com',edited_by:'owner@example.com',submitted_at:'2026-09-10T00:00:00Z',request_id:'REQ-1'},
    {submission_id:'SUB-1',farm_id:'GF-1',farm_name:'Farm',revision:1,item_key:'__COMMIT__',input_type:'commit',status:'DRAFT',submitted_by:'owner@example.com',edited_by:'owner@example.com',submitted_at:'2026-09-10T00:00:01Z',request_id:'REQ-1'}
  ],
  mediaQueue:[{upload_id:'M-1',media_id:'M-1',submission_id:'SUB-1',farm_id:'GF-1',media_group:'PHOTO',file_name:'original.jpg',mime_type:'image/jpeg',status:'DELETED',submitted_by:'owner@example.com',submitted_at:'2026-09-10T00:00:02Z'}],
  mediaHistory:[{at:'2026-09-10T00:00:03Z',actor_id:'OWNER',upload_id:'M-1',status:'TRASHED',version:1}],
  accessLog:[{at:'2026-09-10T00:00:04Z',actor_id:'OWNER',action:'media.delete',target_id:'M-1',detail:'deleted'}],
  loginGuard:[{key:'ip:test',window_start:1788998400000,attempts:1}],
  questionPolicies:[],questionPolicyHistory:[]
};

test('source import preserves explicit blank revisions and maps source actors without auto-verifying housing',()=>{
  const p=prepareSourceImport(source);
  assert.equal(p.runtime.answers[0].value_jsonb,'');
  assert.equal(p.runtime.answers[0].edited_by,'OWNER');
  assert.equal(p.runtime.submissions[0].created_by,'OWNER');
  assert.equal(p.runtime.submissions[0].last_edited_by,'OWNER');
  assert.equal(p.runtime.media[0].uploaded_by,'OWNER');
  assert.equal(p.runtime.media[0].deleted_at,'2026-09-10T00:00:03Z');
  assert.equal(p.planning.housingEnvironmentRecords[0].housing_environment_code,null);
  assert.equal(p.planning.housingEnvironmentRecords[0].source_value,'미확인');
  assert.equal(p.planning.housingEnvironmentRecords[0].verification_status,'UNCONFIRMED');
});

test('apply import is fail-closed on staging ref and does not grant planning data implicitly',async()=>{
  const p=prepareSourceImport(source);
  const calls=[];
  const db={
    request:async(path,opts)=>{calls.push(['request',path,opts]);return null;},
    select:async()=>[],
    insert:async(table,rows)=>{calls.push(['insert',table,rows]);return null;}
  };
  await assert.rejects(()=>applyPreparedImport(db,p,{confirmRef:'wrong',expectedRef:'a'.repeat(20)}),/IMPORT_CONFIRM_REF_MISMATCH/);
  const counts=await applyPreparedImport(db,p,{confirmRef:'a'.repeat(20),expectedRef:'a'.repeat(20)});
  assert.equal(counts.accounts,1);
  assert.equal(counts.farms,1);
  assert.equal(counts.questions,1);
  assert.equal(counts.media,1);
  assert.equal(counts.housingEnvironment,1);
  assert.equal(p.planning.facts.length,0);
  assert.equal(p.planning.planningBriefVersions.length,0);
  assert.equal(p.planning.planningSourceArtifacts.length,0);
});
