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
  assert.match(source,/var data=withLock_\(function\(\)/);
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
  assert.match(source,/accessAccount_\(principal\)/);
  assert.match(source,/accessMediaRow_\(a,id,false\)/);
});
