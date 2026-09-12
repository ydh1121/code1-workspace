import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const uiUrl=new URL('../../../public/assets/planning-profit.js',import.meta.url);
const loaderUrl=new URL('../../../public/assets/workspace-access-ui.js',import.meta.url);
const cssUrl=new URL('../../../public/assets/planning-profit.css',import.meta.url);
const migrationUrl=new URL('../schema/0017_product_profit_plain_planning.sql',import.meta.url);

test('planning extension loads product profit UI and adds a dedicated planning tab',async()=>{
  const [ui,loader,css]=await Promise.all([readFile(uiUrl,'utf8'),readFile(loaderUrl,'utf8'),readFile(cssUrl,'utf8')]);
  assert.match(loader,/planning-profit\.js/);
  assert.match(loader,/planning-profit\.css/);
  assert.match(ui,/제품 수익 구조/);
  assert.match(ui,/planning\.profit\.list/);
  assert.match(ui,/planning\.profit\.save/);
  assert.match(ui,/planning\.profit\.archive/);
  assert.match(ui,/planning-profit-tab/);
  assert.match(css,/@media\(max-width:760px\)/);
});

test('profit editor uses plain Korean cost and income labels',async()=>{
  const ui=await readFile(uiUrl,'utf8');
  for(const text of ['제품명','판매 단위','판매처·판매 방식','1개 판매가','매입·생산비','포장비','배송비','결제·판매 수수료','기타 비용','월 예상 판매수량','한 개 팔 때 남는 금액','월 예상 남는 금액'])assert.match(ui,new RegExp(text));
  assert.doesNotMatch(ui,/unit economics|contribution margin|gross margin|EBITDA/i);
});

test('plain planning snapshot avoids internal shorthand and specialist English labels',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  const start=sql.indexOf("'v0.2-20260912-plain'");
  assert.ok(start>=0);
  const plain=sql.slice(start);
  assert.match(plain,/CODE1 현재 사업 계획 요약/);
  assert.match(plain,/수익이 생기는 방법/);
  assert.match(plain,/매주 확인할 숫자/);
  assert.doesNotMatch(plain,/NETWORK\s*\/\s*AGENCY|REGIONAL SUPPLY HUB|\bGMV\b|\bARPU\b|\bCANDIDATE\b|USER_REPORTED_COMMERCIAL_TERM|\bSTEP\s+[1-9]|\bvertical\b/i);
});

test('product profit tables are service-role only and preserve revision history',async()=>{
  const sql=await readFile(migrationUrl,'utf8');
  assert.match(sql,/create table if not exists public\.planning_product_profit_models/);
  assert.match(sql,/create table if not exists public\.planning_product_profit_revisions/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table public\.planning_product_profit_models from public,anon,authenticated/);
  assert.match(sql,/grant select,insert,update,delete on table public\.planning_product_profit_models to service_role/);
  assert.match(sql,/code1_save_product_profit_model/);
  assert.match(sql,/code1_archive_product_profit_model/);
});
