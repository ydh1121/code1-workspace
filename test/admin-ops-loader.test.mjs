import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('late-loaded planning module replays code1-ready after it finishes loading',()=>{
  const src=fs.readFileSync('public/assets/accounts.js','utf8');
  assert.match(src,/script\[data-code1-admin-ops\]/);
  assert.match(src,/s\.addEventListener\('load',[\s\S]*if\(me\)[\s\S]*code1-ready/);
});

test('planning page follows PAGE_PLANNING while destructive farm and audit tools remain OWNER-only',()=>{
  const src=fs.readFileSync('public/assets/admin-ops.js','utf8');
  assert.match(src,/currentUser\?\.id==='OWNER'/);
  assert.match(src,/currentUser\?\.role==='SUPER_ADMIN'/);
  assert.match(src,/if\(!owner\(\)&&!can\('PAGE_PLANNING'\)\)return/);
  assert.match(src,/if\(owner\(\)\)\{tabs\.farms='농가 관리';tabs\.audit='감사';\}/);
});
