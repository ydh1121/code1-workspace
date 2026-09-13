import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const ui=fs.readFileSync(resolve(root,'public/assets/planning-materials.js'),'utf8');
const css=fs.readFileSync(resolve(root,'public/assets/planning-materials.css'),'utf8');
const access=fs.readFileSync(resolve(root,'backend/staging/src/workspace-access.mjs'),'utf8');

test('material workspace uses readable request rows instead of collapsing tile cards',()=>{
  assert.match(ui,/material-request-row/);
  assert.match(css,/\.material-request-row\{appearance:none;width:100%;display:grid/);
  assert.match(css,/word-break:keep-all/);
  assert.doesNotMatch(css,/repeat\(auto-fill,minmax\(280px,1fr\)\)/);
});

test('material detail separates direct input, file upload, and internal review',()=>{
  assert.match(ui,/el\('details','material-item'\)/);
  for(const label of ['직접 입력','파일 첨부','내부 검토','내용 \/ 보충 설명'])assert.match(ui,new RegExp(label));
  assert.match(ui,/material-entry-grid/);
  assert.match(ui,/material-review-panel/);
  assert.match(ui,/material-file-count/);
  assert.match(css,/\.material-entry-grid\{display:grid/);
});

test('developer manifest is no longer exposed as a normal UI action',()=>{
  assert.doesNotMatch(ui,/Planning manifest 보기/);
  assert.doesNotMatch(ui,/Planning export manifest/);
});

test('material tab replaces generic admin KPIs with material-specific operational summary',()=>{
  assert.match(ui,/summary\.hidden=true/);
  for(const label of ['전체 요청','요청 중','제출 완료','검토 대기'])assert.match(ui,new RegExp(label));
  assert.match(ui,/tab\.dataset\.adminTab!=='materials'/);
});

test('template manager groups independent child items by classification and supports category-specific add',()=>{
  assert.match(ui,/template-category-list/);
  assert.match(ui,/이 분류에 항목 추가/);
  assert.match(ui,/새 하위 항목/);
  assert.match(ui,/classification_hint/);
  assert.match(css,/#material-template-dialog\{width:min\(1320px/);
  assert.match(css,/\.material-dialog-body\{overflow:auto;overflow-x:hidden/);
  for(const label of ['사업자·법인','상품·패키지·표시','농장·생산자·사육환경','인증·검사·성적서','사료·급이','선별·포장·물류'])assert.match(ui,new RegExp(label));
});

test('request creation can assign internal or external accounts instead of PARTNER-only filtering',()=>{
  assert.match(ui,/내부·외부 계정 모두 지정/);
  assert.match(ui,/자료 제출 담당자 배정/);
  assert.match(ui,/a\.id!==user\?\.id&&a\.id!=='OWNER'/);
  assert.doesNotMatch(ui,/filter\(a=>a\.role==='PARTNER'\)/);
});

test('permission catalog uses operator-facing Korean instead of developer vocabulary',()=>{
  for(const phrase of ['자료요청 만들기·담당자 배정','제출 자료 검토','요청 항목 구성 관리','배정받은 자료 제출','현재값 확정'])assert.match(access,new RegExp(phrase));
  assert.doesNotMatch(access,/자료요청 package를 만들고 제출자를 배정/);
  assert.doesNotMatch(access,/Planning Material request의 파일·메모만 제출/);
});

test('upload UI keeps existing upload contract while adding selection and drag-drop affordance',()=>{
  assert.match(ui,/planning\.material\.upload\.begin/);
  assert.match(ui,/planning\.material\.upload\.chunk/);
  assert.match(ui,/planning\.material\.upload\.finish/);
  assert.match(ui,/material-upload-zone/);
  assert.match(ui,/dragover/);
  assert.match(ui,/dataTransfer\.files/);
});

test('390px layout explicitly prevents horizontal overflow',()=>{
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/\.material-workspace,\.material-detail,\.material-external-page\{max-width:100%;overflow-x:hidden\}/);
  assert.match(css,/font-size:16px/);
});
