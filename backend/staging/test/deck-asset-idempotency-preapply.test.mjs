import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.join(here,'../schema/0013_deck_asset_request_idempotency.sql'),'utf8');

test('Deck asset request retry requires exact byte identity before returning existing row',()=>{
  assert.match(sql,/where da\.deck_id=v_deck_id and da\.registered_by=p_actor_id and da\.request_id=p_request_id/);
  for(const clause of [
    'v_existing.asset_id=v_asset_id',
    'v_existing.object_key=v_object_key',
    'v_existing.mime_type=v_mime',
    'v_existing.file_size_bytes=v_size',
    'v_existing.checksum_sha256=v_checksum',
    'v_existing.source_kind=v_source_kind',
    "v_existing.state='ACTIVE'"
  ])assert.ok(sql.includes(clause),clause);
  assert.match(sql,/raise exception 'REQUEST_ID_REUSE'/);
});

test('Deck asset registration remains service-role only and staging namespace only',()=>{
  assert.match(sql,/v_object_key not like 'private\/decks\/%'/);
  assert.match(sql,/revoke all on function code1_register_deck_asset\(text,text,jsonb\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function code1_register_deck_asset\(text,text,jsonb\) to service_role/);
});
