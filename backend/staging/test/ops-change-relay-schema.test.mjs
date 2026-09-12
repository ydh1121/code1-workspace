import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sqlUrl=new URL('../schema/0018_ops_change_relay.sql',import.meta.url);

test('OPS relay schema declares canonical event/outbox fields and six classes',async()=>{
  const sql=await readFile(sqlUrl,'utf8');
  for(const name of ['ops_change_events','ops_outbox','event_id','source_system','source_version','entity_type','entity_id','action','changed_fields','before_hash','after_hash','actor_ref','event_class','planning_relevance','suggested_tracks','evidence_refs','correlation_id','causation_id','idempotency_key','payload_hash','occurred_at','recorded_at','relay_status','relay_status_updated_at'])assert.match(sql,new RegExp(`\\b${name}\\b`));
  for(const cls of ['OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT'])assert.match(sql,new RegExp(cls));
  for(const state of ['RECORDED','PLANNING_REVIEW','APPLIED_TO_SSOT','DISPATCHED','IN_PROGRESS','DONE','NO_PLANNING_ACTION','HOLD','BLOCKED_USER_APPROVAL','BLOCKED_POLICY','BLOCKED_SECRET','FAILED_RECOVERABLE'])assert.match(sql,new RegExp(state));
});

test('mutation wrappers use one database transaction boundary and browser roles are denied',async()=>{
  const sql=await readFile(sqlUrl,'utf8');
  assert.match(sql,/code1_ops_delete_empty_farm/);
  assert.match(sql,/code1_ops_archive_account/);
  assert.match(sql,/code1_ops_set_account_capabilities/);
  assert.match(sql,/code1_delete_empty_farm\(/);
  assert.match(sql,/code1_archive_account\(/);
  assert.match(sql,/code1_set_account_capabilities\(/);
  assert.match(sql,/revoke all on table public\.ops_change_events from public,anon,authenticated/i);
  assert.match(sql,/revoke all on table public\.ops_outbox from public,anon,authenticated/i);
  assert.match(sql,/code1_ops_claim_outbox/);
  assert.match(sql,/code1_ops_ack_outbox/);
  assert.match(sql,/for update skip locked/i);
});

test('evidence contract rejects URL/credential-shaped values and OPS_DATA_ONLY never becomes a relay candidate',async()=>{
  const sql=await readFile(sqlUrl,'utf8');
  assert.match(sql,/UNSAFE_EVIDENCE_REF/);
  assert.match(sql,/https\?\:\/\//);
  assert.match(sql,/NO_PLANNING_ACTION/);
  assert.match(sql,/NO_ACTION/);
  assert.match(sql,/POLICY_APPROVAL_REQUIRED[^]*BLOCKED_POLICY/);
});
