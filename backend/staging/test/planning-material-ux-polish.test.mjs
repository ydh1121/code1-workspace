import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const ui=fs.readFileSync(resolve(root,'public/assets/planning-materials.js'),'utf8');
const css=fs.readFileSync(resolve(root,'public/assets/planning-materials.css'),'utf8');

test('material workspace uses readable request rows instead of collapsing tile cards',()=>{
  assert.match(ui,/material-request-row/);
  assert.match(css,/\.material-request-row\{appearance:none;width:100%;display:grid/);
  assert.match(css,/word-break:keep-all/);
  assert.doesNotMatch(css,/repeat\(auto-fill,minmax\(280px,1fr\)\)/);
});

test('material detail is compact accordion with progress and file-count summaries',()=>{
  assert.match(ui,/el\('details','material-item'\)/);
  assert.match(ui,/material-progress-chips/);
  assert.match(ui,/material-file-count/);
  assert.match(css,/\.material-item-summary/);
  assert.match(css,/\.material-item\[open\]/);
});

test('material tab replaces generic admin KPIs with material-specific operational summary',()=>{
  assert.match(ui,/summary\.hidden=true/);
  for(const label of ['전체 요청','요청 중','제출 완료','검토 대기'])assert.match(ui,new RegExp(label));
  assert.match(ui,/tab\.dataset\.adminTab!=='materials'/);
});

test('template manager avoids horizontal scroll and exposes human-readable classification labels',()=>{
  assert.match(ui,/material-template-dialog/);
  assert.match(css,/\.material-template-dialog\{width:min\(1180px/);
  assert.match(css,/\.material-dialog-body\{overflow:auto;overflow-x:hidden/);
  assert.match(css,/\.material-template-footer\{position:sticky/);
  for(const label of ['사업자·법인','상품·패키지·표시','농장·생산자·사육환경','인증·검사·성적서','사료·급이','선별·포장·물류'])assert.match(ui,new RegExp(label));
  assert.match(ui,/template-icon-button/);
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
