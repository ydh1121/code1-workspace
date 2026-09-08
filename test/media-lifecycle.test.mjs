import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('media lifecycle assets are loaded before app and expose audited deletion plus resumable originals',()=>{
  const html=read('public/index.html'),life=read('public/assets/media-lifecycle.js');
  assert.ok(html.indexOf('/assets/media-lifecycle.js')>=0);
  assert.ok(html.indexOf('/assets/media-lifecycle.js')<html.indexOf('/assets/app.js'));
  for(const token of ['mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair'])assert.match(life,new RegExp(token.replace('.','\\.')));
  assert.match(life,/250\*1024\*1024/);
  assert.match(life,/압축·리사이즈 없이 촬영 원본 그대로 Drive에 저장/);
  assert.match(life,/Drive 원본은 휴지통으로 이동하고 삭제 이력은 남습니다/);
  assert.match(life,/기존 미정리 파일/);
});

test('Cloudflare and Apps Script route every media lifecycle action',()=>{
  const rpc=read('functions/api/rpc.js'),bridge=read('bridge/CloudflareBridge.gs'),life=read('bridge/MediaLifecycle.gs');
  for(const action of ['mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair']){
    assert.ok(rpc.includes(`'${action}'`),`rpc whitelist missing ${action}`);
    assert.ok(bridge.includes(`'${action}'`),`bridge missing ${action}`);
  }
  for(const fn of ['mediaUploadBegin_','mediaUploadChunk_','mediaUploadFinish_','mediaDelete_','mediaOrganizerStatus_','mediaOrganizerRepair_'])assert.ok(life.includes(`function ${fn}`),`lifecycle missing ${fn}`);
  assert.match(life,/setTrashed\(true\)/);
  assert.match(life,/statusIndex\+1\)\.setValue\('DELETED'\)/);
});

test('organizer uses human-readable farm, shot and label naming instead of legacy upload-id prefix',()=>{
  const organizer=read('bridge/MediaOrganizer.gs');
  assert.match(organizer,/farmName\+'_'+code\+'_'+label\+'_'+mediaOrganizerTimestamp_/);
  assert.match(organizer,/file\.setName\(stored\);file\.moveTo\(categoryFolder\)/);
  assert.match(organizer,/status:'ORGANIZED'/);
});
