import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const jsUrl=new URL('../../../public/assets/admin-ops.js',import.meta.url);
const cssUrl=new URL('../../../public/assets/admin-ops.css',import.meta.url);
const accountsUrl=new URL('../../../public/assets/accounts.js',import.meta.url);

test('executive admin UI stays OWNER-only and exposes planning, farms and server history',async()=>{
  const js=await readFile(jsUrl,'utf8');
  assert.match(js,/user\?\.role!==['"]SUPER_ADMIN['"]/);
  assert.match(js,/user\?\.id!==['"]OWNER['"]/);
  assert.match(js,/executiveBrief\.current/);
  assert.match(js,/factInbox\.list/);
  assert.match(js,/admin\.farm\.delete/);
  assert.match(js,/admin\.audit/);
});

test('admin interface does not contain browser screen-capture primitives',async()=>{
  const js=await readFile(jsUrl,'utf8');
  assert.doesNotMatch(js,/getDisplayMedia|html2canvas|captureStream|toDataURL\s*\(/i);
});

test('owner account removal is present and admin layouts include a mobile breakpoint',async()=>{
  const [accounts,css]=await Promise.all([readFile(accountsUrl,'utf8'),readFile(cssUrl,'utf8')]);
  assert.match(accounts,/admin\.account\.delete/);
  assert.match(accounts,/계정 삭제/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/min-height:48px/);
});
