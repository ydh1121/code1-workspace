import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.resolve(here,'../schema/0010_r2_media_upload_state.sql'),'utf8');

test('R2 media migration adds resumable state without exposing browser roles',()=>{
  assert.match(sql,/r2_multipart_upload_id text/);
  assert.match(sql,/upload_chunk_bytes integer/);
  assert.match(sql,/upload_received_bytes bigint not null default 0/);
  assert.match(sql,/upload_parts jsonb not null default '\[\]'::jsonb/);
  assert.match(sql,/where source_storage = 'R2_PRIVATE'/);
  assert.match(sql,/security invoker/g);
  assert.match(sql,/revoke all on function code1_finalize_media_upload\(text,text,text\) from public, anon, authenticated/);
  assert.match(sql,/revoke all on function code1_register_media_upload\(text,text,jsonb\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function code1_finalize_media_upload\(text,text,text\) to service_role/);
  assert.match(sql,/grant execute on function code1_register_media_upload\(text,text,jsonb\) to service_role/);
});

test('finalization is status-idempotent and event insertion shares the same transaction',()=>{
  assert.match(sql,/if v_row.status = 'REVIEW_REQUIRED' then[\s\S]*return next v_row/);
  assert.match(sql,/update media_assets[\s\S]*status = 'REVIEW_REQUIRED'/);
  assert.match(sql,/insert into media_events\([\s\S]*'R2_MULTIPART'/);
  assert.match(sql,/begin;[\s\S]*create or replace function code1_finalize_media_upload[\s\S]*commit;/);
});
