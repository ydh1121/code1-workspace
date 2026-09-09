import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync('bridge/CloudflareBridge.gs','utf8');
const hot=fs.readFileSync('public/assets/question-help.js','utf8');
const password=fs.readFileSync('functions/api/auth/password.js','utf8');

test('fast password auth keeps legacy fallback while reducing the current bridge round trip',()=>{
  assert.doesNotThrow(()=>new Function(bridge));
  assert.match(bridge,/auth\.fast/);
  assert.match(bridge,/bridgeAuthThrottlePair_/);
  assert.match(password,/auth\.fast/);
  assert.match(password,/auth\.begin/);
  assert.match(password,/auth\.finish/);
  assert.match(password,/UNKNOWN_ACTION\|BRIDGE_UPDATE_REQUIRED/);
});

test('farm hot path parses and keeps durable writes behind responsive UI transitions',()=>{
  assert.doesNotThrow(()=>new Function(hot));
  assert.match(hot,/write-behind/);
  assert.match(hot,/action==='saveSubmission'.*DRAFT/);
  assert.match(hot,/action==='getSubmission'/);
  assert.match(hot,/action==='deleteMedia'/);
  assert.match(hot,/prefetchSubmissions/);
  assert.match(hot,/beforeunload/);
  assert.match(hot,/__CODE1_PERF__/);
});
