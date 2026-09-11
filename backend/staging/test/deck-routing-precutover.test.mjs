import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeckAction,isDeckImportAction} from '../src/staging-dispatch.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const dispatchSource=fs.readFileSync(path.join(repo,'backend/staging/src/staging-dispatch.mjs'),'utf8');
const edgeRpcSource=fs.readFileSync(path.join(repo,'functions/api/rpc.js'),'utf8');

test('isolated STAGING dispatcher recognizes the three Deck RPCs',()=>{
  for(const action of ['deckAssets','deckBootstrap','saveDeck'])assert.equal(isDeckAction(action),true,action);
  for(const action of ['bootstrap','upload','linkDrive','media'])assert.equal(isDeckAction(action),false,action);
  assert.match(dispatchSource,/import \{deckBootstrap,deckAssets,saveDeck\} from '\.\/deck-runtime\.mjs'/);
  assert.match(dispatchSource,/if\(DECK_ACTIONS\.has\(action\)\)return dispatchDeckAction/);
});

test('pre-cutover edge routing still blocks normal Deck actions from STAGING runtime',()=>{
  assert.match(edgeRpcSource,/const legacyDeckActions=new Set\(\['deckAssets','deckBootstrap','saveDeck'\]\)/);
  assert.match(edgeRpcSource,/if\(legacyDeckActions\.has\(action\)\)return false/);
  assert.match(edgeRpcSource,/if\(\(action==='upload'\|\|action==='linkDrive'\)&&payload\?\.kind==='DECK'\)return false/);
  assert.match(edgeRpcSource,/data=await bridge\(env, user, action, body\)/);
});

test('one-time Deck source import is an explicit STAGING-owned action, not a legacy Deck action',()=>{
  const action='deckMigration.importSource20260912';
  assert.equal(isDeckImportAction(action),true);
  assert.equal(isDeckAction(action),false);
  assert.match(edgeRpcSource,/['"]deckMigration\.importSource20260912['"]/);
  assert.doesNotMatch(edgeRpcSource,/legacyDeckActions=new Set\([^\n]*deckMigration/);
});
