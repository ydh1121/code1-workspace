import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('session restore stays edge-local',async()=>{
  const source=await read('functions/api/session.js');
  assert.match(source,/await session\(request, env\)/);
  assert.doesNotMatch(source,/bridge\(/);
});

test('read-only bridge actions do not hold the long mutation lock',async()=>{
  const source=await read('bridge/CloudflareBridge.gs');
  assert.match(source,/bridgeReadAction_/);
  assert.match(source,/mediaBatch/);
  assert.match(source,/performanceMediaBatch_/);
  assert.match(source,/performanceBootstrap_/);
  assert.match(source,/performanceDeckAssets_/);
  assert.match(source,/var data=withLock_\(function\(\)/);
});

test('bootstrap uses one Cloudflare to Apps Script bridge request',async()=>{
  const source=await read('functions/api/rpc.js');
  assert.match(source,/const data = await bridge\(env, user, action, payload \|\| \{\}\)/);
  assert.doesNotMatch(source,/Promise\.all/);
  assert.doesNotMatch(source,/questionPolicy\.effective/);
});

test('temporary read helper caches deck and catalog but rechecks account access',async()=>{
  const source=await read('bridge/PerformanceRead.gs');
  assert.match(source,/PERFORMANCE_DECK_CACHE_SECONDS_ = 300/);
  assert.match(source,/PERFORMANCE_CATALOG_CACHE_SECONDS_ = 120/);
  assert.match(source,/performanceDeckLoad_/);
  assert.match(source,/performanceCatalogLoad_/);
  assert.match(source,/questionPolicyEffective_\(principal\)/);
  assert.match(source,/accessAccount_\(principal\)/);
});

test('deck mutation invalidates temporary deck cache',async()=>{
  const source=await read('bridge/CloudflareBridge.gs');
  assert.match(source,/p\.action==='saveDeck'/);
  assert.match(source,/performanceDeckCacheInvalidate_/);
});

test('farm media requests are batched and cached in browser session',async()=>{
  const source=await read('public/assets/media-lifecycle.js');
  assert.match(source,/mediaAssetCache=new Map\(\)/);
  assert.match(source,/action:'mediaBatch'/);
  assert.match(source,/meta\?\.action==='media'/);
  assert.match(source,/loading='lazy'/);
});

test('performance read helper caps batch size and rechecks media access',async()=>{
  const source=await read('bridge/PerformanceRead.gs');
  assert.match(source,/PERFORMANCE_MEDIA_BATCH_MAX_ = 32/);
  assert.match(source,/accessMediaRow_\(a,id,false\)/);
});

test('heavy PDF runtime is generated separately from initial loader',async()=>{
  const source=await read('scripts/build.mjs');
  assert.match(source,/outfile:'public\/assets\/pdf\.runtime\.js'/);
  assert.match(source,/public\/assets\/pdf\.bundle\.js/);
  assert.match(source,/window\.Code1Pdf=\{__loader:true/);
});
