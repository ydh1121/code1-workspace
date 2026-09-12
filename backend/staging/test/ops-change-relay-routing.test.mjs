import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isOpsChangeRelayAction} from '../src/ops-change-relay.mjs';

const dispatcherUrl=new URL('../src/staging-dispatch.mjs',import.meta.url);
const edgeRpcUrl=new URL('../../../functions/api/rpc.js',import.meta.url);

test('OPS relay owns existing admin mutations and new status/review actions',()=>{
  for(const action of ['admin.access.save','admin.farm.delete','admin.account.delete','admin.ops.events','admin.ops.review'])assert.equal(isOpsChangeRelayAction(action),true);
  assert.equal(isOpsChangeRelayAction('admin.audit'),false);
});

test('staging dispatcher routes OPS actions before legacy admin dispatcher',async()=>{
  const source=await readFile(dispatcherUrl,'utf8');
  assert.match(source,/if\(isOpsChangeRelayAction\(action\)\)return dispatchOpsChangeRelay/);
  assert.ok(source.indexOf('isOpsChangeRelayAction(action)')<source.indexOf('ADMIN_ACTIONS.has(action)'));
});

test('edge RPC allowlist exposes only the two new browser OPS actions while staging remains fail-closed',async()=>{
  const source=await readFile(edgeRpcUrl,'utf8');
  assert.match(source,/admin\.ops\.events/);
  assert.match(source,/admin\.ops\.review/);
  assert.match(source,/stagingOwns/);
  assert.match(source,/dispatchCode1Staging/);
});
