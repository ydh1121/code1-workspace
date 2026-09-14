import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const accessCss=fs.readFileSync(resolve(root,'public/assets/workspace-access.css'),'utf8');
const polish=fs.readFileSync(resolve(root,'public/assets/user-qa-visual-polish.css'),'utf8');

test('global workspace loads bounded OWNER QA visual corrections',()=>{
  assert.match(accessCss,/^@import url\('\/assets\/user-qa-visual-polish\.css'\);/);
});

test('selected farm group keeps its title readable on the white active surface',()=>{
  assert.match(polish,/\.farm-work #categories \.group-card\.active\{color:var\(--ink\)!important\}/);
  assert.match(polish,/\.farm-work #categories \.group-card\.active strong\{color:var\(--ink\)!important\}/);
});

test('planning material request puts the requested item above generic submission chrome',()=>{
  assert.match(polish,/content:'제출 항목 ' counter\(material-request-item,decimal-leading-zero\)/);
  assert.match(polish,/\.material-detail \.material-item-name>strong\{font-size:23px!important/);
  assert.match(polish,/\.material-detail \.material-compose-head h4\{font-size:13px!important/);
  assert.match(polish,/\.material-detail \.material-compose-files>h5\{font-size:17px!important/);
});

test('material item hierarchy remains responsive at mobile widths',()=>{
  assert.match(polish,/@media\(max-width:760px\)/);
  assert.match(polish,/@media\(max-width:390px\)/);
  assert.match(polish,/\.material-detail \.material-item-name>strong\{font-size:20px!important\}/);
});
