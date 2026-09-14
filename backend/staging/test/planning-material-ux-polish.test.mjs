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

test('material workspace keeps request discovery readable and uses one Korean configuration name',()=>{
  assert.match(ui,/material-request-row/);
  assert.match(ui,/요청 항목 관리/);
  assert.doesNotMatch(ui,/업로드 항목 관리/);
  assert.match(css,/\.material-request-row\{appearance:none;width:100%;display:grid/);
});

test('request item uses one coherent submission compose surface and secondary exception flow',()=>{
  assert.match(ui,/material-compose/);
  assert.match(ui,/자료 제출/);
  assert.match(ui,/material-exception-panel/);
  assert.match(ui,/자료를 지금 제출하기 어려운 경우/);
  assert.doesNotMatch(ui,/material-entry-grid/);
  assert.doesNotMatch(ui,/직접 입력/);
});

test('internal review is a separate collapsed details surface and not a numbered submitter step',()=>{
  assert.match(ui,/el\('details','material-review-panel'\)/);
  assert.match(ui,/제출자 화면과 분리된 내부 전용 영역/);
  assert.doesNotMatch(ui,/material-entry-number/);
});

test('template manager is outline-first with secondary edit dialog and collapsed non-empty categories',()=>{
  assert.match(ui,/template-outline-row/);
  assert.match(ui,/material-template-item-dialog/);
  assert.match(ui,/openItemEditor/);
  assert.match(ui,/현재 비어 있는 분류/);
  assert.match(ui,/section\.open=sections\.length===0/);
  assert.doesNotMatch(css,/template-item-top/);
});

test('single template is applied automatically while multi-template choice remains available',()=>{
  assert.match(ui,/boot\.templates\|\|\[\]\)\.length>1/);
  assert.match(ui,/현재 기본 항목으로 자동 적용/);
  assert.match(ui,/template\?\.value\|\|boot\.templates\?\.\[0\]\?\.templateId/);
});

test('file UX has queue remove progress result and drag-drop for new and revision uploads',()=>{
  for(const phrase of ['material-file-queue','material-remove-file','material-queue-status','dragenter','dragover','dragleave','dataTransfer?.files','새 버전 업로드'])assert.match(ui,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/multiple:true/);
  assert.match(ui,/multiple:false/);
  assert.match(ui,/uploadOne\(item,entry\.file,materialFileId/);
});

test('operator UI removes developer-facing English eyebrow labels',()=>{
  assert.doesNotMatch(ui,/PLANNING MATERIAL WORKSPACE/);
  assert.doesNotMatch(ui,/PLANNING MATERIAL REQUEST/);
  assert.doesNotMatch(ui,/REQUESTED MATERIALS/);
  assert.doesNotMatch(ui,/MATERIAL SUBMISSION/);
});

test('permission catalog stays operator-facing and backend vocabulary is not reintroduced',()=>{
  for(const phrase of ['자료요청 만들기·담당자 배정','제출 자료 검토','요청 항목 구성 관리','배정받은 자료 제출','현재값 확정'])assert.match(access,new RegExp(phrase));
  assert.doesNotMatch(access,/자료요청 package를 만들고 제출자를 배정/);
  assert.doesNotMatch(access,/Planning Material request의 파일·메모만 제출/);
});

test('390px contract prevents workspace horizontal overflow and stacks queue rows',()=>{
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/\.material-workspace,\.material-detail,\.material-external-page\{max-width:100%;overflow-x:hidden\}/);
  assert.match(css,/\.material-queue-row\{grid-template-columns:1fr\}/);
  assert.match(css,/font-size:16px/);
});