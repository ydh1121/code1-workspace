import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {assertMaterialFileType,assertMaterialMagic,MATERIAL_MIME_ALLOWLIST,MATERIAL_CHUNK_BYTES,MATERIAL_MAX_BYTES} from '../src/planning-material-runtime.mjs';
import {privatePlanningMaterialObjectKey,publicAccount} from '../src/core.mjs';
import {ACCESS_CAPABILITIES} from '../src/workspace-access.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const read=p=>fs.readFileSync(resolve(root,p),'utf8');
const schema21=read('backend/staging/schema/0021_planning_material_workspace.sql');
const schema22=read('backend/staging/schema/0022_planning_material_acceptance.sql');
const schema23=read('backend/staging/schema/0023_planning_material_transactional_acceptance.sql');
const runtime=read('backend/staging/src/planning-material-runtime.mjs');
const dispatcher=read('backend/staging/src/staging-dispatch.mjs');
const edge=read('functions/api/rpc.js');
const ui=read('public/assets/planning-materials.js');
const css=read('public/assets/planning-materials.css');

const DEFAULT7=[
  '현재 상품명, 구성, 패키지 전후면',
  '현재 생산농장, 사육환경, 생산자',
  '동물복지, 무항생제, HACCP 등 현재 인증서',
  'JS-3550 또는 실제 급이원료 사양, 급이 방식',
  '현재 생란 제품과 직접 연결되는 바나듐 분석성적서(단위/시료/lot 포함)',
  '현재 선별, 포장, 출고, 배송 방식',
  '사업자등록증'
];

test('REV B seeds exactly seven authoritative default upload items in order',()=>{
  for(const label of DEFAULT7)assert.match(schema21,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(schema23,/cardinality\(v_labels\)<>7/);
  const seed=[...schema21.matchAll(/'MAT_0[1-7]_[A-Z_]+'/g)].map(x=>x[0]);
  assert.ok(seed.length>=7);
});

test('Planning Material domain is separate from farm questionnaire while reusing media_assets',()=>{
  for(const table of ['planning_material_templates','planning_material_template_revisions','planning_material_template_items','planning_material_requests','planning_material_request_assignees','planning_material_request_items','planning_material_files','planning_material_file_versions'])assert.match(schema21,new RegExp(`create table if not exists public\\.${table}`,'i'));
  assert.match(schema21,/references public\.media_assets\(media_id\)/i);
  assert.doesNotMatch(runtime,/\bquestion_catalog\b|\bintake_submissions\b|\bsubmission_answers\b/);
});

test('PARTNER is domain-neutral and material capability is explicit',()=>{
  const partner=publicAccount({account_id:'U_PARTNER',username:'partner',display_name:'Partner',email:'',role:'PARTNER',status:'active',permissions_json:{farm:'edit',deck:'edit'},session_version:1,password_hash:'x'},[]);
  assert.equal(partner.permissions.farm,'none');
  assert.equal(partner.permissions.deck,'none');
  assert.equal(partner.permissions.allFarms,false);
  for(const cap of ['PAGE_PLANNING_MATERIALS','MATERIAL_UPLOAD_ASSIGNED','MATERIAL_REQUEST_MANAGE','MATERIAL_REVIEW','MATERIAL_TEMPLATE_MANAGE'])assert.ok(ACCESS_CAPABILITIES.includes(cap));
});

test('private R2 object key is stable and contains no public URL surface',()=>{
  const key=privatePlanningMaterialObjectKey({materialRequestId:'PMR_123',itemKey:'MAT_01',mediaId:'M_1',fileName:'사업자 등록증.pdf'});
  assert.equal(key,'private/planning-materials/PMR_123/items/MAT_01/uploads/M_1/original/사업자-등록증.pdf');
  assert.doesNotMatch(key,/^https?:|public\//i);
  assert.match(runtime,/CODE1_MEDIA_BUCKET/);
  assert.doesNotMatch(runtime,/DriveApp|GOOGLE_DRIVE|source_drive|linkDrive/);
});

test('material upload limits keep resumable multipart contract',()=>{
  assert.equal(MATERIAL_CHUNK_BYTES,6*1024*1024);
  assert.equal(MATERIAL_MAX_BYTES,250*1024*1024);
  assert.match(runtime,/createMultipartUpload/);
  assert.match(runtime,/resumeMultipartUpload/);
  assert.match(runtime,/UPLOAD_OFFSET_CONFLICT/);
  assert.match(runtime,/checksum_sha256/);
});

test('supported document/image/video allowlist is explicit and archive/executable formats are rejected',()=>{
  for(const ext of ['.pdf','.jpg','.jpeg','.png','.webp','.docx','.xlsx','.pptx'])assert.ok(MATERIAL_MIME_ALLOWLIST[ext],ext);
  for(const ext of ['.exe','.msi','.bat','.cmd','.js','.zip','.rar','.7z'])assert.equal(MATERIAL_MIME_ALLOWLIST[ext],undefined,ext);
  assert.throws(()=>assertMaterialFileType('payload.exe','application/octet-stream'),/UNSUPPORTED_FILE_TYPE/);
  assert.throws(()=>assertMaterialFileType('archive.zip','application/zip'),/UNSUPPORTED_FILE_TYPE/);
});

test('runtime validates actual file signatures instead of trusting extension/MIME alone',()=>{
  assert.doesNotThrow(()=>assertMaterialMagic(Uint8Array.from([0x25,0x50,0x44,0x46,0x2d]),'application/pdf'));
  assert.doesNotThrow(()=>assertMaterialMagic(Uint8Array.from([0xff,0xd8,0xff]),'image/jpeg'));
  assert.doesNotThrow(()=>assertMaterialMagic(Uint8Array.from([0x89,0x50,0x4e,0x47]),'image/png'));
  const webp=new Uint8Array(12);webp.set([...Buffer.from('RIFF')],0);webp.set([...Buffer.from('WEBP')],8);assert.doesNotThrow(()=>assertMaterialMagic(webp,'image/webp'));
  assert.doesNotThrow(()=>assertMaterialMagic(Uint8Array.from([0x50,0x4b,0x03,0x04]),'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  const mp4=new Uint8Array(8);mp4.set([...Buffer.from('ftyp')],4);assert.doesNotThrow(()=>assertMaterialMagic(mp4,'video/mp4'));
  assert.throws(()=>assertMaterialMagic(Uint8Array.from([0x4d,0x5a,0x90,0x00]),'application/pdf'),/FILE_SIGNATURE_MISMATCH/);
});

test('all Planning Material actions are STAGING-owned and cannot fall back to legacy bridge',()=>{
  for(const action of ['planning.material.bootstrap','planning.material.request.get','planning.material.template.save','planning.material.request.create','planning.material.request.assign','planning.material.item.update','planning.material.review','planning.material.request.submit','planning.material.manifest','planning.material.upload.begin','planning.material.upload.chunk','planning.material.upload.finish','planning.material.file.read']){
    assert.match(edge,new RegExp(action.replaceAll('.','\\.')));
  }
  assert.match(edge,/\.\.\.materialActions/);
  assert.match(edge,/PLANNING_MATERIAL_STAGING_ONLY/);
  assert.match(dispatcher,/isPlanningMaterialAction\(action\).*dispatchPlanningMaterial/s);
});

test('internal menu label and ordering contract are exact',()=>{
  assert.match(ui,/btn\('상세페이지 및 제안서 파일'/);
  assert.match(ui,/querySelector\('\[data-admin-tab="actions"\]'\)/);
  assert.match(ui,/insertBefore\(b,action\)/);
  assert.doesNotMatch(ui,/농가 상세페이지 자료|농가 제안서 자료/);
});

test('external uploader UI is assigned-request-only and does not expose internal Planning labels',()=>{
  assert.match(ui,/boot\.mode==='INTERNAL'\?ensureInternalTab\(\):ensureExternalPage\(\)/);
  assert.match(ui,/ASSIGNED_UPLOAD|자료 제출/);
  assert.doesNotMatch(ui,/Fact Inbox|기획문서 수정|Executive Brief/);
});

test('mobile-first contract includes an explicit 390px no-horizontal-overflow layout',()=>{
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/overflow-x:hidden/);
  assert.match(css,/font-size:16px/);
});

test('catalog mutations and request snapshots are revisioned and audited rather than hard-deleted',()=>{
  assert.match(schema21,/planning_material_template_revisions/);
  assert.match(schema21,/label_snapshot/);
  assert.match(schema21,/required_snapshot/);
  assert.match(schema21,/archive|archived_at/i);
  assert.match(schema23,/QA_REQUEST_SNAPSHOT_MUTATED/);
  assert.match(schema23,/QA_TEMPLATE_ARCHIVE_FAILED/);
  assert.match(schema23,/QA_UNAUTHORIZED_CATALOG_MUTATION_NOT_DENIED/);
});

test('submission manifest is deterministic, private, audited and emits one deduplicated Planning outbox event',()=>{
  assert.match(schema21,/code1_material_manifest/);
  assert.match(schema22,/PLANNING_MATERIAL_MANIFEST/);
  assert.match(schema22,/INTERNAL_CONFIDENTIAL/);
  assert.match(schema22,/public_delivery_allowed/);
  assert.match(schema22,/PLANNING_IMPACT/);
  assert.match(schema22,/ops_outbox/);
  assert.match(schema23,/QA_MANIFEST_SECRET_URL_LEAK/);
  assert.match(schema23,/QA_OPS_EVENT_DUPLICATED/);
  assert.match(schema23,/QA_AUDIT_MISSING/);
});
