import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSourceImport,applyPreparedImport} from '../src/import-runner.mjs';

const source={
  accounts:[{account_id:'OWNER',username:'owner',display_name:'Owner',email:'owner@example.com',role:'SUPER_ADMIN',status:'active',permissions_json:'{}',password_salt:'a'.repeat(32),password_hash:'b'.repeat(64),password_iterations:100000,password_scheme:'pbkdf2-sha256-pepper-v1',session_version:1}],
  farms:[{farm_id:'GF-1','내부 농가명':'Farm','공개 농가명':'Farm','상태':'자료요청','Origin_12':'TRUE','사육환경번호':'미확인'}],
  questionCatalog:[{sort_order:1,section_code:'A',section_name:'기본',item_key:'A-01',item_label:'농가명',plain_question:'농가명?',input_type:'text',required_level:'REQUIRED',evidence_required:'FALSE',active:'TRUE'}],
  submissionQueue:[
    {submission_id:'SUB-1',farm_id:'GF-1',farm_name:'Farm',revision:1,item_key:'A-01',input_type:'text',value_text:'"Farm"',status:'DRAFT',submitted_by:'owner@example.com',edited_by:'owner@example.com',submitted_at:'2026-09-10T00:00:00Z',request_id:'REQ-1'},
    {submission_id:'SUB-1',farm_id:'GF-1',farm_name:'Farm',revision:1,item_key:'__COMMIT__',input_type:'commit',status:'DRAFT',submitted_by:'owner@example.com',edited_by:'owner@example.com',submitted_at:'2026-09-10T00:00:01Z',request_id:'REQ-1'}
  ],
  mediaQueue:[{upload_id:'M-1',media_id:'M-1',submission_id:'SUB-1',farm_id:'GF-1',media_group:'PHOTO',file_name:'original.jpg',mime_type:'image/jpeg',status:'DELETED',submitted_by:'owner@example.com',submitted_at:'2026-09-10T00:00:02Z'}],
  mediaHistory:[{at:'2026-09-10T00:00:03Z',actor_id:'OWNER',upload_id:'M-1',status:'TRASHED',version:1}],
  accessLog:[{at:'2026-09-10T00:00:04Z',actor_id:'OWNER',action:'media.delete',target_id:'M-1',detail:'deleted'}],
  loginGuard:[{key:'ip:test',window_start:1788998400000,attempts:1}],
  questionPolicies:[],questionPolicyHistory:[]
};

test('append-only legacy events retain source row identity and skip duplicates on idempotent retry',async()=>{
  const prepared=prepareSourceImport(source);
  assert.equal(prepared.runtime.mediaEvents[0].metadata.source,'24_WEB_미디어정리_이력');
  assert.equal(prepared.runtime.mediaEvents[0].metadata.source_row,2);
  assert.equal(prepared.runtime.auditLog[0].metadata.source,'20_WEB_ACCESS_LOG');
  assert.equal(prepared.runtime.auditLog[0].metadata.source_row,2);

  const stored={media_events:[],audit_log:[]};
  const db={
    request:async()=>null,
    select:async(table)=>stored[table]?.map(row=>({metadata:row.metadata}))||[],
    insert:async(table,rows)=>{if(stored[table])stored[table].push(...rows);return null;}
  };
  const ref='a'.repeat(20);
  const first=await applyPreparedImport(db,prepared,{confirmRef:ref,expectedRef:ref});
  const second=await applyPreparedImport(db,prepared,{confirmRef:ref,expectedRef:ref});

  assert.equal(first.mediaEvents,1);
  assert.equal(first.auditLog,1);
  assert.equal(second.mediaEvents,0);
  assert.equal(second.auditLog,0);
  assert.equal(stored.media_events.length,1);
  assert.equal(stored.audit_log.length,1);
});
