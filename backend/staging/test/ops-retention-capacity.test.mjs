import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../schema/0020_ops_retention_capacity_guard.sql',import.meta.url);
const sourceUrl=new URL('../src/ops-change-relay.mjs',import.meta.url);
const edgeUrl=new URL('../../../functions/api/rpc.js',import.meta.url);

test('retention policy is explicitly proposal-only and contains all required categories',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  for(const token of [
    'PROPOSAL_NOT_FROZEN','REPORT_ONLY','DRY_RUN','QA_TEST_FIXTURE','OUTBOX_DELIVERED_NO_ACTION',
    'OUTBOX_FAILED_RETRYABLE','OPS_DATA_ONLY','PLANNING_UIUX_CODING_IMPACT','POLICY_INCIDENT'
  ])assert.match(sql,new RegExp(token));
  assert.match(sql,/'autoPurge',false/);
  assert.match(sql,/code1_ops_capacity_report/);
  assert.match(sql,/code1_ops_retention_dry_run/);
});

test('migration contains no destructive purge executor or scheduler',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  assert.doesNotMatch(sql,/\bdelete\s+from\b/i);
  assert.doesNotMatch(sql,/\btruncate\b/i);
  assert.doesNotMatch(sql,/\bdrop\s+(table|function|schema|index)\b/i);
  assert.doesNotMatch(sql,/pg_cron|cron\.schedule|create\s+extension\s+cron/i);
  assert.doesNotMatch(sql,/create\s+(trigger|event\s+trigger)/i);
});

test('report RPCs remain service-role-only and owner-authorized',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  assert.match(sql,/perform public\.code1_ops_assert_owner\(p_actor_id\)/);
  assert.match(sql,/revoke all on function public\.code1_ops_capacity_report[^]*from public,anon,authenticated/i);
  assert.match(sql,/revoke all on function public\.code1_ops_retention_dry_run[^]*from public,anon,authenticated/i);
  assert.match(sql,/grant execute on function public\.code1_ops_capacity_report[^]*to service_role/i);
  assert.match(sql,/grant execute on function public\.code1_ops_retention_dry_run[^]*to service_role/i);
});

test('capacity state fails visibly to WATCH when configured database limit is unknown',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  assert.match(sql,/CONFIGURED_LIMIT_UNKNOWN/);
  assert.match(sql,/v_state:='WATCH'/);
  for(const state of ['NORMAL','WATCH','WARNING','CRITICAL'])assert.match(sql,new RegExp(`'${state}'`));
  assert.match(sql,/SINGLE_SNAPSHOT_ONLY/);
});

test('server exposes only fixed-payload STAGING report actions',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  const edge=await readFile(edgeUrl,'utf8');
  for(const action of ['admin.ops.capacity.report','admin.ops.retention.dryRun']){
    assert.match(source,new RegExp(action.replaceAll('.','\\.')));
    assert.match(edge,new RegExp(action.replaceAll('.','\\.')));
  }
  assert.match(source,/assertEmptyReportPayload\(payload\)/);
  assert.match(source,/OPS_RETENTION_REPORT_FIXED_PAYLOAD_ONLY/);
  assert.match(source,/OPS_RETENTION_STAGING_ONLY/);
  assert.match(source,/OPS_DB_CONFIGURED_LIMIT_BYTES/);
  assert.match(edge,/stagingOnlyActions/);
});

test('dry-run contract cannot claim mutation or auto purge',async()=>{
  const source=await readFile(sourceUrl,'utf8');
  const sql=await readFile(migrationUrl,'utf8');
  assert.match(source,/report\.autoPurge!==false/);
  assert.match(source,/report\.mutationApplied!==false/);
  assert.match(sql,/'mutationApplied',false/);
  assert.match(sql,/'executionMode','REPORT_ONLY'/);
});
