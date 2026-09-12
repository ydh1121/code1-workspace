import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const indexUrl=new URL('../../../public/index.html',import.meta.url);
const accessJsUrl=new URL('../../../public/assets/workspace-access-ui.js',import.meta.url);
const accessCssUrl=new URL('../../../public/assets/workspace-access.css',import.meta.url);
const migrationUrl=new URL('../schema/0016_planning_editor_access_control.sql',import.meta.url);

test('authenticated refresh is gated by neutral loading UI instead of painting login first',async()=>{
  const [html,js,css]=await Promise.all([readFile(indexUrl,'utf8'),readFile(accessJsUrl,'utf8'),readFile(accessCssUrl,'utf8')]);
  assert.match(html,/<body class="auth-pending">/);
  assert.match(html,/id="auth-pending"/);
  assert.match(html,/작업공간 연결 확인 중/);
  assert.match(css,/body\.auth-pending #login\{display:none!important\}/);
  assert.match(js,/upstreamFetch\('\/api\/session'/);
  assert.match(js,/session\?\.authenticated/);
  assert.match(js,/code1-ready/);
  assert.match(js,/resolveGate\(true\)/);
});

test('planning editor schema is revisioned, feedback-aware and server-only',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  assert.match(sql,/create table if not exists public\.planning_documents/);
  assert.match(sql,/create table if not exists public\.planning_document_revisions/);
  assert.match(sql,/create table if not exists public\.planning_feedback/);
  assert.match(sql,/unique\(document_id,revision\)/);
  assert.match(sql,/code1_save_planning_document/);
  assert.match(sql,/code1_add_planning_feedback/);
  assert.match(sql,/code1_set_account_capabilities/);
  assert.match(sql,/ACCESS_PROFILE_INITIALIZED/);
  assert.match(sql,/revoke all on table public\.planning_documents from public, anon, authenticated/);
  assert.match(sql,/grant select,insert,update,delete on table public\.planning_documents to service_role/);
});
