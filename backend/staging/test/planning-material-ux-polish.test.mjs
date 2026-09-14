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
  assert.match(css,/\.material-request-row\{appearance:none;width:100%;min-width:0;display:grid/);
});

test('request item keeps one coherent submission surface and secondary exception flow',()=>{
  assert.match(ui,/material-compose/);
  assert.match(ui,/자료 제출/);
  assert.match(ui,/material-exception-panel/);
  assert.match(ui,/자료를 지금 제출하기 어려운 경우/);
  assert.doesNotMatch(ui,/material-entry-grid/);
  assert.doesNotMatch(ui,/직접 입력/);
});

test('response kind drives typed controls instead of universal text plus file',()=>{
  assert.match(ui,/responseKindOptions=\[\['TEXT'/);
  assert.match(ui,/\['LONG_TEXT','서술형 내용 입력'\]/);
  assert.match(ui,/\['FILE','파일 제출'\]/);
  assert.match(ui,/\['TEXT_FILE','내용 \+ 파일 제출'\]/);
  assert.match(ui,/if\(\['TEXT','LONG_TEXT','TEXT_FILE'\]\.includes\(item\.responseKind\)\)renderTextResponse/);
  assert.match(ui,/if\(\['FILE','TEXT_FILE'\]\.includes\(item\.responseKind\)\)renderFileResponse/);
});

test('internal review is separate and never rendered for external submitter',()=>{
  assert.match(ui,/if\(!external&&access\.canReview\)/);
  assert.match(ui,/el\('details','material-review-panel'\)/);
  assert.match(ui,/제출자 화면과 분리된 내부 전용 영역/);
});

test('template manager is outline-first and response kind lives in secondary edit detail',()=>{
  assert.match(ui,/template-outline-row/);
  assert.match(ui,/material-template-item-dialog/);
  assert.match(ui,/field\('응답 방식',responseKind/);
  assert.match(ui,/현재 비어 있는 분류/);
  assert.match(ui,/section\.open=sections\.length===0/);
});

test('draft preview and explicit publish lifecycle are operator-visible',()=>{
  for(const phrase of ['초안 미리보기','초안 저장','게시하기 전까지 실제 제출자','planning.material.template.publish','게시 후 생성하는 새 자료요청부터 적용'])assert.match(ui,new RegExp(phrase));
  assert.match(ui,/publishedTemplates\(\)/);
  assert.match(ui,/publishedRevision/);
});

test('single published template is auto-applied while multi-template choice remains available',()=>{
  assert.match(ui,/available\.length>1/);
  assert.match(ui,/게시 r\$\{only\.publishedRevision\}/);
  assert.match(ui,/template\?\.value\|\|available\[0\]\?\.templateId/);
});

test('file UX retains queue remove progress drag-drop and new-version path',()=>{
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