import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.resolve(here,'../schema/0012_deck_saved_at_contract.sql'),'utf8');
const must=(re,msg)=>assert.match(sql,re,msg);
const mustNot=(re,msg)=>assert.doesNotMatch(sql,re,msg);

test('saved-at correction is a bounded function replacement only',()=>{
  must(/create or replace function code1_save_deck\(/);
  mustNot(/create\s+table|alter\s+table|drop\s+table|truncate\s+table/i);
  mustNot(/BRIDGE_URL|BRIDGE_SECRET|script\.google\.com|spreadsheets\/d\//i);
});

test('Deck save derives one authoritative timestamp from validated payload.updated_at',()=>{
  must(/v_saved:=nullif\(v_payload->>'updated_at',''\)::timestamptz/);
  must(/abs\(extract\(epoch from \(now\(\)-v_saved\)\)\) > 600/);
  must(/raise exception 'INVALID_SAVED_AT'/);
  must(/v_snapshot[\s\S]*coalesce\(v_payload->>'saved_by',''\) <> v_snapshot/s);
});

test('same v_saved value is committed to revision pointer audit and response',()=>{
  must(/p_actor_id,v_snapshot,v_saved,left\(p_summary,1000\),p_request_id,'STAGING_SAVE','COMMITTED'/);
  must(/update deck_documents dd[\s\S]*updated_at=v_saved/s);
  must(/'saved_at',v_saved/);
  must(/return query select v_next,v_label,v_saved,v_revision/);
  mustNot(/v_saved timestamptz := now\(\)/);
});

test('existing optimistic concurrency asset linkage and service boundary remain intact',()=>{
  must(/v_doc\.current_version <> p_base_version then raise exception 'CONFLICT'/);
  must(/dr\.saved_by=p_actor_id[\s\S]*dr\.request_id=p_request_id[\s\S]*dr\.source_kind='STAGING_SAVE'/s);
  must(/left join deck_assets da[\s\S]*da\.asset_id=refs\.asset_id and da\.deck_id=p_deck_id and da\.state='ACTIVE'/s);
  must(/extensions\.digest\(convert_to\(p_payload_text,'UTF8'\),'sha256'\)/);
  must(/revoke all on function code1_save_deck\(text,text,integer,boolean,text,text,text,text\[\]\) from public, anon, authenticated/);
  must(/grant execute on function code1_save_deck\(text,text,integer,boolean,text,text,text,text\[\]\) to service_role/);
});
