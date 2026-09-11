import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DECK_WRITE_GATE_OPEN,isDeckAction,isDeckAuxiliaryWrite} from '../src/staging-dispatch.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const dispatchSource=fs.readFileSync(path.join(repo,'backend/staging/src/staging-dispatch.mjs'),'utf8');
const edgeRpcSource=fs.readFileSync(path.join(repo,'functions/api/rpc.js'),'utf8');

test('STAGING dispatcher recognizes normal Deck RPCs and read-cutover write gate is closed',()=>{
  for(const action of ['deckAssets','deckBootstrap','saveDeck'])assert.equal(isDeckAction(action),true,action);
  for(const action of ['bootstrap','media'])assert.equal(isDeckAction(action),false,action);
  assert.equal(DECK_WRITE_GATE_OPEN,false);
  assert.equal(isDeckAuxiliaryWrite('upload',{kind:'DECK'}),true);
  assert.equal(isDeckAuxiliaryWrite('linkDrive',{kind:'DECK'}),true);
  assert.equal(isDeckAuxiliaryWrite('upload',{kind:'FARM'}),false);
  assert.match(dispatchSource,/case 'deckAssets': return deckAssets/);
  assert.match(dispatchSource,/case 'deckBootstrap': return deckBootstrap/);
  assert.match(dispatchSource,/case 'saveDeck':[\s\S]*DECK_WRITE_GATE_OPEN/);
  assert.match(dispatchSource,/if\(isDeckAuxWrite\(action,payload\)\)throw Error\('DECK_WRITE_GATE_CLOSED'\)/);
});

test('edge routes accepted actions to STAGING without Deck legacy fallback when staging mode is enabled',()=>{
  assert.doesNotMatch(edgeRpcSource,/legacyDeckActions/);
  assert.doesNotMatch(edgeRpcSource,/deckMigration\.importSource20260912/);
  assert.match(edgeRpcSource,/function stagingOwns\(\)[\s\S]*return true/);
  assert.match(edgeRpcSource,/if\(useSupabaseStaging\(env\)&&stagingOwns\(action,body\)\)/);
  assert.match(edgeRpcSource,/data=await dispatchCode1Staging\(env,user,action,body\)/);
});

test('one-time Deck source importer is retired from active dispatcher and edge allowlist',()=>{
  assert.doesNotMatch(dispatchSource,/deck-import-runtime/);
  assert.doesNotMatch(dispatchSource,/DECK_IMPORT_ACTION/);
  assert.doesNotMatch(edgeRpcSource,/importSource20260912/);
});
