import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isOpsChangeRelayAction} from '../src/ops-change-relay.mjs';

const dispatcherUrl=new URL('../src/staging-dispatch.mjs',import.meta.url);
const edgeRpcUrl=new URL('../../../functions/api/rpc.js',import.meta.url);

test('OPS relay owns existing admin mutations plus status/review and fixed QA fixture actions',()=>{
  for(const action of ['admin.access.save','admin.farm.delete','admin.account.delete','admin.ops.events','admin.ops.review','admin.ops.qa.fixture.create','admin.ops.qa.fixture.cleanup'])assert.equal(isOpsChangeRelayAction(action),true);
  assert.equal(isOpsChangeRelayAction('admin.audit'),false);
  assert.equal(isOpsChangeRelayAction('admin.ops.qa.fixture.debug'),false);
});

test('staging dispatcher routes OPS actions before legacy admin dispatcher',async()=>{
  const source=await readFile(dispatcherUrl,'utf8');
  assert.match(source,/if\(isOpsChangeRelayAction\(action\)\)return dispatchOpsChangeRelay/);
  assert.ok(source.indexOf('isOpsChangeRelayAction(action)')<source.indexOf('ADMIN_ACTIONS.has(action)'));
});

test('edge RPC allowlist exposes fixed QA actions and hard-fails them outside Supabase STAGING',async()=>{
  const source=await readFile(edgeRpcUrl,'utf8');
  assert.match(source,/admin\.ops\.events/);
  assert.match(source,/admin\.ops\.review/);
  assert.match(source,/admin\.ops\.qa\.fixture\.create/);
  assert.match(source,/admin\.ops\.qa\.fixture\.cleanup/);
  assert.match(source,/stagingOnlyActions/);
  assert.match(source,/stagingOnlyActions\.has\(action\)&&!useSupabaseStaging\(env\)/);
  assert.match(source,/OWNER_QA_STAGING_ONLY/);
  assert.match(source,/dispatchCode1Staging/);
});
