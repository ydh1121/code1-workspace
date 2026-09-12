import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('late-loaded owner admin module replays code1-ready after it finishes loading',()=>{
  const src=fs.readFileSync('public/assets/accounts.js','utf8');
  assert.match(src,/script\[data-code1-admin-ops\]/);
  assert.match(src,/s\.addEventListener\('load',[\s\S]*if\(me\)[\s\S]*code1-ready/);
});

test('owner admin module remains restricted to OWNER SUPER_ADMIN',()=>{
  const src=fs.readFileSync('public/assets/admin-ops.js','utf8');
  assert.match(src,/user\?\.role!=='SUPER_ADMIN'/);
  assert.match(src,/user\?\.id!=='OWNER'/);
});
