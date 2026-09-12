import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const jsUrl=new URL('../../../public/assets/admin-ops.js',import.meta.url);
const cssUrl=new URL('../../../public/assets/admin-ops.css',import.meta.url);
const accessCssUrl=new URL('../../../public/assets/workspace-access.css',import.meta.url);
const accountsUrl=new URL('../../../public/assets/accounts.js',import.meta.url);

test('planning UI is PAGE_PLANNING-gated while destructive farm and audit tools stay OWNER-only',async()=>{
  const js=await readFile(jsUrl,'utf8');
  assert.match(js,/PAGE_PLANNING/);
  assert.match(js,/currentUser\?\.id===['"]OWNER['"]/);
  assert.match(js,/currentUser\?\.role===['"]SUPER_ADMIN['"]/);
  assert.match(js,/planning\.document\.current/);
  assert.match(js,/planning\.document\.save/);
  assert.match(js,/planning\.feedback\.add/);
  assert.match(js,/planning\.feedback\.resolve/);
  assert.match(js,/factInbox\.list/);
  assert.match(js,/admin\.farm\.delete/);
  assert.match(js,/admin\.audit/);
});

test('admin interface does not contain browser screen-capture primitives',async()=>{
  const js=await readFile(jsUrl,'utf8');
  assert.doesNotMatch(js,/getDisplayMedia|html2canvas|captureStream|toDataURL\s*\(/i);
});

test('owner account removal and fine-grained permissions are present with mobile layouts',async()=>{
  const [accounts,css,accessCss]=await Promise.all([readFile(accountsUrl,'utf8'),readFile(cssUrl,'utf8'),readFile(accessCssUrl,'utf8')]);
  assert.match(accounts,/admin\.account\.delete/);
  assert.match(accounts,/admin\.access\.list/);
  assert.match(accounts,/admin\.access\.save/);
  assert.match(accounts,/페이지·기능 권한/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/min-height:48px/);
  assert.match(accessCss,/@media\(max-width:760px\)/);
  assert.match(accessCss,/planning-workspace/);
});
