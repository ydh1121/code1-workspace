import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.join(here,'../schema/0014_deck_save_request_idempotency.sql'),'utf8');

test('saveDeck request retry compares logical payload, base version, summary and exact asset links',()=>{
  assert.match(sql,/where dr\.deck_id=p_deck_id[\s\S]*dr\.saved_by=p_actor_id[\s\S]*dr\.request_id=p_request_id[\s\S]*dr\.source_kind='STAGING_SAVE'/);
  assert.match(sql,/p_base_version <> v_existing\.version-1/);
  assert.match(sql,/left\(p_summary,1000\) <> v_existing\.change_summary/);
  assert.match(sql,/\(v_payload - 'updated_at'\) <> \(v_existing_payload - 'updated_at'\)/);
  assert.match(sql,/v_existing_asset_count <> cardinality\(p_asset_refs\)/);
  assert.match(sql,/raise exception 'REQUEST_ID_REUSE'/);
});

test('saveDeck retry intentionally ignores only server regenerated updated_at',()=>{
  const comparison=sql.match(/\(v_payload - 'updated_at'\) <> \(v_existing_payload - 'updated_at'\)/g)||[];
  assert.equal(comparison.length,1);
  assert.doesNotMatch(sql,/v_payload - 'saved_by'/);
});

test('saveDeck remains service-role only',()=>{
  assert.match(sql,/revoke all on function code1_save_deck\(text,text,integer,boolean,text,text,text,text\[\]\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function code1_save_deck\(text,text,integer,boolean,text,text,text,text\[\]\) to service_role/);
});
