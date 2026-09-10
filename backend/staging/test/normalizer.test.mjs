import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSource,verifyNormalized} from '../src/source-normalizer.mjs';

const source={
  accounts:[{account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',session_version:2}],
  farms:[{farm_id:'GF-1','내부 농가명':'농가1','상태':'검증중','Origin_12':'Y'}],
  questionCatalog:[{sort_order:1,section_code:'A',section_name:'기본',item_key:'A-01',item_label:'농장명',plain_question:'농장명?',input_type:'text',required_level:'REQUIRED',evidence_required:'FALSE',active:'TRUE'},{sort_order:2,section_code:'C',section_name:'생산',item_key:'C-02',item_label:'유정란 여부',plain_question:'유정란?',input_type:'boolean',required_level:'REVIEW',evidence_required:'FALSE',active:'TRUE'}],
  submissionQueue:[
    {submission_id:'SUB-1',submitted_at:'2026-09-01T00:00:00Z',farm_id:'GF-1',farm_name:'농가1',item_key:'A-01',input_type:'text',value_text:'"농가1"',status:'DRAFT',revision:1,request_id:'a'.repeat(32)},
    {submission_id:'SUB-1',submitted_at:'2026-09-01T00:00:00Z',farm_id:'GF-1',farm_name:'농가1',item_key:'__COMMIT__',input_type:'SYSTEM',value_text:'{}',status:'DRAFT',revision:1,request_id:'a'.repeat(32)},
    {submission_id:'SUB-1',submitted_at:'2026-09-02T00:00:00Z',farm_id:'GF-1',farm_name:'농가1',item_key:'C-02',input_type:'boolean',value_text:'""',status:'DRAFT',revision:2,request_id:'b'.repeat(32)},
    {submission_id:'SUB-1',submitted_at:'2026-09-02T00:00:00Z',farm_id:'GF-1',farm_name:'농가1',item_key:'__COMMIT__',input_type:'SYSTEM',value_text:'{}',status:'DRAFT',revision:2,request_id:'b'.repeat(32)}
  ],
  mediaQueue:[{upload_id:'M-1',media_id:'M-1',submission_id:'SUB-1',farm_id:'GF-1',media_group:'PHOTO',file_name:'x.jpg',status:'DELETED'},{upload_id:'D-1',media_id:'D-1',submission_id:'DECK',media_group:'DECK',file_name:'d.jpg'}],
  accessLog:[{at:'2026-09-01T01:00:00Z',actor_id:'OWNER',action:'media.delete',target_id:'M-1',detail:'test'}],
  loginGuard:[{key:'ip:abc',window_start:1788210000000,attempts:3}],
  questionPolicyHistory:[],
  mediaHistory:[{at:'2026-09-02T01:00:00Z',actor_id:'OWNER',upload_id:'M-1',drive_file_id:'DRIVE-1',status:'TRASHED',detail:'trash',version:1},{at:'2026-09-02T01:01:00Z',actor_id:'OWNER',upload_id:'M-1',drive_file_id:'DRIVE-1',status:'ORGANIZED',detail:'organized',version:1}]
};

test('sheet commit sentinel becomes submission revision, not answer',()=>{
  const n=normalizeSource(source),r=verifyNormalized(n);
  assert.equal(r.ok,true);
  assert.equal(n.submissions[0].current_revision,2);
  assert.equal(n.answers.length,2);
  assert.equal(n.answers[0].value_jsonb,'농가1');
  assert.equal(n.answers[1].value_jsonb,'');
  assert.equal(r.counts.commitSentinels,2);
  assert.equal(n.media.length,1);
  assert.equal(n.excluded.deckMedia.length,1);
});

test('legacy runtime histories remain append-only migration rows',()=>{
  const n=normalizeSource(source),r=verifyNormalized(n);
  assert.equal(r.ok,true);
  assert.equal(r.counts.auditLog,1);
  assert.equal(r.counts.loginGuard,1);
  assert.equal(r.counts.questionPolicyHistory,0);
  assert.equal(r.counts.mediaEvents,2);
  assert.equal(n.mediaEvents[0].media_id,'M-1');
  assert.equal(n.mediaEvents[1].media_id,'M-1');
  assert.match(n.loginGuard[0].window_start,/^2026-/);
});
