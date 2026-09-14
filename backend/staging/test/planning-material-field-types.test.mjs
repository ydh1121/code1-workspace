import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const migration=fs.readFileSync(resolve(root,'backend/staging/schema/0024_planning_material_field_types_lifecycle.sql'),'utf8');
const runtime=fs.readFileSync(resolve(root,'backend/staging/src/planning-material-runtime.mjs'),'utf8');
const farmSchema=fs.readFileSync(resolve(root,'backend/staging/schema/0001_runtime.sql'),'utf8');
const farmModel=fs.readFileSync(resolve(root,'public/assets/farm-model.js'),'utf8');
const farmUi=fs.readFileSync(resolve(root,'public/assets/app.js'),'utf8');

test('field model follows proven catalog type plus immutable snapshot pattern',()=>{
  assert.match(farmSchema,/input_type text not null/);
  assert.match(farmSchema,/insert into public\.submission_answers\([\s\S]*input_type/);
  assert.match(migration,/add column if not exists response_kind text not null default 'TEXT_FILE'/);
  assert.match(migration,/add column if not exists response_kind_snapshot text/);
  assert.match(migration,/response_kind in \('TEXT','LONG_TEXT','FILE','TEXT_FILE'\)/);
  assert.match(migration,/response_kind_snapshot is null or response_kind_snapshot in \('TEXT','LONG_TEXT','FILE','TEXT_FILE'\)/);
});

test('farm exposure policy remains non-destructive reference pattern',()=>{
  assert.match(farmModel,/hiddenModes=\['HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE'\]/);
  assert.match(farmModel,/visibleCatalog\(catalog,form\)/);
  assert.match(farmUi,/q\.input_type==='file'/);
  assert.match(farmUi,/q\.input_type==='longtext'/);
});

test('template lifecycle separates draft current revision from published revision',()=>{
  assert.match(migration,/add column if not exists published_revision integer/);
  assert.match(migration,/revision_state in \('DRAFT','PUBLISHED','ARCHIVED'\)/);
  assert.match(migration,/create or replace function public\.code1_material_publish_template/);
  assert.match(migration,/Save now means SAVE DRAFT/);
  assert.match(runtime,/planning\.material\.template\.publish/);
});

test('new requests are generated from published revision snapshot only',()=>{
  assert.match(migration,/where template_id=p_template_id and revision=v_t\.published_revision and published_at is not null/);
  assert.match(migration,/template_revision,classification_hint,response_kind_snapshot/);
  assert.match(migration,/p_actor_id,p_actor_id,p_request_id/);
  assert.doesNotMatch(migration,/select 'PMI_'\|\|replace\(gen_random_uuid\(\)::text,'-',''\),v_id,i\.item_key/);
});

test('typed required validation is enforced server-side by response kind',()=>{
  assert.match(migration,/v_kind='FILE'/);
  assert.match(migration,/v_kind in \('TEXT','LONG_TEXT'\)/);
  assert.match(migration,/v_kind='TEXT_FILE'/);
  assert.match(migration,/raise exception 'REQUIRED_MATERIAL_INCOMPLETE'/);
  assert.match(migration,/FIELD_KIND_NO_FILE/);
  assert.match(runtime,/item\.response_kind_snapshot!=null&&!\['FILE','TEXT_FILE'\]\.includes/);
});

test('legacy request snapshots are deliberately not retrofitted',()=>{
  assert.match(migration,/response_kind_snapshot text;/);
  assert.match(migration,/null is intentional legacy compatibility/);
  assert.match(migration,/Existing pre-0024 snapshots keep REV B behavior/);
  assert.match(runtime,/responseKindLegacy:item\.response_kind_snapshot==null/);
});

test('draft-only deletion and published history preservation are distinct',()=>{
  assert.match(migration,/Draft-only items omitted from the next draft have never been externally published and may be deleted/);
  assert.match(migration,/and not exists\([\s\S]*published_at is not null/);
  assert.match(migration,/update public\.planning_material_template_items[\s\S]*set active=false,archived_at/);
});

test('manifest keeps field type snapshot and existing planning impact contract',()=>{
  assert.match(migration,/'response_kind_snapshot',i\.response_kind_snapshot/);
  assert.match(migration,/'required_snapshot',i\.required_snapshot/);
  assert.match(migration,/'PLANNING_IMPACT'/);
  assert.match(migration,/public_delivery_allowed=false/);
});