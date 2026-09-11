import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DECK_WRITE_GATE_OPEN,DECK_DRIVE_LINK_ENABLED,isDeckAction,isDeckUploadAction,isDeckDriveLinkAction} from '../src/staging-dispatch.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const dispatchSource=fs.readFileSync(path.join(repo,'backend/staging/src/staging-dispatch.mjs'),'utf8');
const edgeRpcSource=fs.readFileSync(path.join(repo,'functions/api/rpc.js'),'utf8');

test('STAGING Deck write gate opens only save and direct private upload while Drive link stays disabled',()=>{
  for(const action of ['deckAssets','deckBootstrap','saveDeck'])assert.equal(isDeckAction(action),true,action);
  for(const action of ['bootstrap','media'])assert.equal(isDeckAction(action),false,action);
  assert.equal(DECK_WRITE_GATE_OPEN,true);
  assert.equal(DECK_DRIVE_LINK_ENABLED,false);
  assert.equal(isDeckUploadAction('upload',{kind:'DECK'}),true);
  assert.equal(isDeckUploadAction('upload',{kind:'FARM'}),false);
  assert.equal(isDeckDriveLinkAction('linkDrive',{kind:'DECK'}),true);
  assert.match(dispatchSource,/return uploadDeckAsset\(env,principal,payload,fetchImpl\)/);
  assert.match(dispatchSource,/throw Error\('DECK_DRIVE_LINK_DISABLED'\)/);
  assert.match(dispatchSource,/case 'saveDeck':[\s\S]*return saveDeck\(env,principal,payload,fetchImpl\)/);
});

test('Deck media lookup runs before farm media fallback and STAGING never falls back to live bridge',()=>{
  assert.match(dispatchSource,/if\(action==='media'\)[\s\S]*getDeckMediaMaybe/);
  assert.match(dispatchSource,/if\(deckMedia\)return deckMedia/);
  assert.doesNotMatch(edgeRpcSource,/legacyDeckActions/);
  assert.match(edgeRpcSource,/function stagingOwns\(\)[\s\S]*return true/);
  assert.match(edgeRpcSource,/if\(useSupabaseStaging\(env\)&&stagingOwns\(action,body\)\)/);
  assert.match(edgeRpcSource,/data=await dispatchCode1Staging\(env,user,action,body\)/);
});

test('one-time Deck source importer remains retired from active dispatcher and edge allowlist',()=>{
  assert.doesNotMatch(dispatchSource,/deck-import-runtime/);
  assert.doesNotMatch(dispatchSource,/DECK_IMPORT_ACTION/);
  assert.doesNotMatch(edgeRpcSource,/importSource20260912/);
});
