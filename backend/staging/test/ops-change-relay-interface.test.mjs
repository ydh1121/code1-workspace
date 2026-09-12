import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlUrl=new URL('../../../public/ops-relay.html',import.meta.url);
const jsUrl=new URL('../../../public/assets/ops-relay.js',import.meta.url);
const cssUrl=new URL('../../../public/assets/ops-relay.css',import.meta.url);

test('temporary OPS Admin exposes required history, filters, status, detail and Planning-review control',async()=>{
  const [html,js]=await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8')]);
  for(const label of ['전체','Planning 필요','Incident','실패','완료'])assert.match(html,new RegExp(label));
  assert.match(html,/event-list/);assert.match(html,/id="detail"/);assert.match(html,/relay-state/);
  assert.match(js,/admin\.ops\.events/);assert.match(js,/admin\.ops\.review/);assert.match(js,/기획 검토 필요/);
  assert.match(js,/correlationId/);assert.match(js,/lastErrorCode/);assert.match(js,/attemptCount/);
});

test('OWNER QA closure controls expose only fixed create and cleanup actions without arbitrary payload input',async()=>{
  const [html,js]=await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8')]);
  assert.match(html,/id="qa-create"/);assert.match(html,/id="qa-cleanup"/);
  assert.match(html,/QA 이벤트 준비/);assert.match(html,/QA 이벤트 정리/);assert.match(html,/실제 농가·계정·운영 데이터를 변경하지 않습니다/);
  assert.match(js,/admin\.ops\.qa\.fixture\.create/);assert.match(js,/admin\.ops\.qa\.fixture\.cleanup/);
  assert.doesNotMatch(html,/<input|<textarea|contenteditable/i);
  assert.match(js,/rpc\(action,\{\}\)/);
});

test('temporary OPS Admin carries no service-role/R2 credential material and remains responsive',async()=>{
  const [html,js,css]=await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8'),readFile(cssUrl,'utf8')]);
  assert.doesNotMatch(html+js,/SERVICE_ROLE|CODE1_SUPABASE_SERVICE_ROLE_KEY|R2_ACCESS|AWS_SECRET|BRIDGE_SECRET/i);
  assert.match(css,/@media\(max-width:900px\)/);assert.match(css,/@media\(max-width:560px\)/);
  assert.match(html,/STAGING ONLY/);assert.match(html,/Planning SSOT가 아닙니다/);
  assert.match(css,/\.qa-actions/);
});
