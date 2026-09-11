import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {importDeckSourceWithContext,DECK_IMPORT_ACTION} from '../src/deck-import-runtime.mjs';

const actor=(id='OWNER',role='SUPER_ADMIN')=>({row:{account_id:id,role},user:{permissions:{deck:'edit'}}});
const envelope=()=>({
  workOrder:'WO-20260912-CODING-DECK-001',
  target:'CODE1 STAGING ONLY',
  projectRef:'bsintmkyhptizrjoizfb',
  bucket:'code1-staging-media',
  deckId:'CODE1_AZA_INTERNAL',
  bundleSha256:'9b525246b9770d8d42b21e8de5ab405a38e8e940a06f0204088845005e737f3e',
  assets:Array.from({length:15},(_,i)=>({asset_id:`fake_${i}`})),
  revisions:[{},{}]
});

test('Deck import action is date-scoped and explicit',()=>{
  assert.equal(DECK_IMPORT_ACTION,'deckMigration.importSource20260912');
});

test('Deck source import rejects non-OWNER before touching DB or R2',async()=>{
  let dbTouched=false,r2Touched=false;
  const db={async rpc(){dbTouched=true;},async select(){dbTouched=true;return [];}};
  await assert.rejects(()=>importDeckSourceWithContext({db,actor:actor('ADMIN_1','ADMIN'),env:{},payload:envelope(),r2Verifier:async()=>{r2Touched=true;}}),/FORBIDDEN/);
  assert.equal(dbTouched,false);assert.equal(r2Touched,false);
});

test('Deck source import rejects wrong immutable bundle identity before touching DB or R2',async()=>{
  let dbTouched=false,r2Touched=false;
  const db={async rpc(){dbTouched=true;},async select(){dbTouched=true;return [];}};
  const payload=envelope();payload.bundleSha256='0'.repeat(64);
  await assert.rejects(()=>importDeckSourceWithContext({db,actor:actor(),env:{},payload,r2Verifier:async()=>{r2Touched=true;}}),/DECK_IMPORT_ENVELOPE_MISMATCH/);
  assert.equal(dbTouched,false);assert.equal(r2Touched,false);
});

test('Deck source import rejects asset identity drift before R2 verification or mutation',async()=>{
  let dbTouched=false,r2Touched=false;
  const db={async rpc(){dbTouched=true;},async select(){dbTouched=true;return [];}};
  await assert.rejects(()=>importDeckSourceWithContext({db,actor:actor(),env:{},payload:envelope(),r2Verifier:async()=>{r2Touched=true;}}),/DECK_IMPORT_ASSET_MISMATCH/);
  assert.equal(dbTouched,false);assert.equal(r2Touched,false);
});

test('temporary import source hard-codes private R2 byte/hash verification and legacy-import RPCs',()=>{
  const here=path.dirname(fileURLToPath(import.meta.url));
  const source=fs.readFileSync(path.resolve(here,'../src/deck-import-runtime.mjs'),'utf8');
  assert.match(source,/CODE1_MEDIA_BUCKET\.get\(expected\.object_key\)/);
  assert.match(source,/DECK_IMPORT_R2_HASH_MISMATCH/);
  assert.match(source,/code1_register_deck_asset/);
  assert.match(source,/code1_import_deck_revision/);
  assert.match(source,/current_revision_id!==EXPECTED_REVISIONS\[1\]\.revision_id/);
});
