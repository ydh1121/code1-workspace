import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.resolve(here,'../schema/0011_deck_staging_runtime.sql'),'utf8');

const must=(re,msg)=>assert.match(sql,re,msg);
const mustNot=(re,msg)=>assert.doesNotMatch(sql,re,msg);

test('Deck target is additive and isolated from live/Production bridge infrastructure',()=>{
  for(const table of ['deck_documents','deck_assets','deck_revisions','deck_revision_assets']){
    must(new RegExp(`create table if not exists ${table}\\s*\\(`),`missing ${table}`);
  }
  must(/deck_id\s*=\s*'CODE1_AZA_INTERNAL'/);
  must(/object_key like 'private\/decks\/%'/);
  mustNot(/BRIDGE_URL|BRIDGE_SECRET|script\.google\.com|spreadsheets\/d\//i);
  mustNot(/drop\s+table|truncate\s+table/i);
});

test('Deck current pointer and immutable revision lineage are relationally linked',()=>{
  must(/current_revision_id text/);
  must(/foreign key \(current_revision_id\) references deck_revisions\(revision_id\)/);
  must(/unique\(deck_id, version\)/);
  must(/source_kind text not null check \(source_kind in \('LEGACY_IMPORT','STAGING_SAVE'\)\)/);
  must(/state text not null default 'COMMITTED' check \(state = 'COMMITTED'\)/);
  must(/payload_text text not null check \(char_length\(payload_text\) between 2 and 1200000\)/);
  must(/content_hash text not null check \(content_hash ~ '\^\[A-Za-z0-9_-\]\{43\}\$'\)/);
});

test('Deck asset model preserves stable media refs and private R2 integrity metadata',()=>{
  must(/asset_id text primary key/);
  must(/mime_type in \('image\/jpeg','image\/png','image\/webp'\)/);
  must(/file_size_bytes > 0 and file_size_bytes <= 8388608/);
  must(/checksum_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  must(/source_kind in \('SEED_EMBEDDED','LEGACY_DRIVE','STAGING_UPLOAD'\)/);
  must(/primary key \(revision_id, asset_id\)/);
  must(/references deck_assets\(asset_id\) on delete restrict/);
});

test('Deck tables are RLS fail-closed and browser roles receive no direct table access',()=>{
  for(const table of ['deck_documents','deck_assets','deck_revisions','deck_revision_assets']){
    must(new RegExp(`alter table ${table} enable row level security`));
  }
  must(/revoke all on table deck_documents, deck_assets, deck_revisions, deck_revision_assets from anon, authenticated/);
  must(/grant select, insert, update on table deck_documents, deck_assets to service_role/);
  must(/grant select, insert on table deck_revisions, deck_revision_assets to service_role/);
  mustNot(/create\s+policy/i);
});

test('runtime Deck save RPC enforces authorization, retry idempotency, concurrency and exact media linkage',()=>{
  must(/create or replace function code1_save_deck\(/);
  must(/p_request_id !~ '\^\[a-f0-9\]\{32\}\$'/);
  must(/v_role not in \('SUPER_ADMIN','ADMIN'\).*permissions->>'deck'/s);
  must(/source_kind='STAGING_SAVE'/);
  must(/current_version <> p_base_version then raise exception 'CONFLICT'/);
  must(/v_next:=v_doc\.current_version\+1/);
  must(/p_new_version,false\).*'v0\.'\|\|v_next::text/s);
  must(/left join deck_assets a on a\.asset_id=x and a\.deck_id=p_deck_id and a\.state='ACTIVE'/);
  must(/raise exception 'INVALID_DECK_MEDIA'/);
  must(/insert into deck_revision_assets/);
  must(/update deck_documents\s+set current_revision_id=v_revision/s);
  must(/'deck\.save','DECK'/);
});

test('Deck save/import verify exact serialized payload hash in Postgres',()=>{
  const digestUses=(sql.match(/extensions\.digest\(convert_to\(p_payload_text,'UTF8'\),'sha256'\)/g)||[]).length;
  assert.ok(digestUses>=2,`expected save+import hash verification, got ${digestUses}`);
  must(/DECK_CONTENT_HASH_MISMATCH/);
  must(/source_revision_id/);
  must(/'deck\.revision\.import','DECK'/);
});

test('legacy import is OWNER-only, idempotent by source revision and does not need live source writes',()=>{
  must(/create or replace function code1_import_deck_revision\(/);
  must(/v_actor\.role <> 'SUPER_ADMIN' or p_actor_id <> 'OWNER'/);
  must(/where revision_id=p_revision_id/);
  must(/v_existing\.content_hash=p_content_hash/);
  must(/'LEGACY_IMPORT',p_revision_id,'COMMITTED'/);
  must(/p_make_current/);
});

test('Deck service RPCs are not browser executable',()=>{
  for(const sig of [
    'code1_register_deck_asset\\(text,text,jsonb\\)',
    'code1_import_deck_revision\\(text,text,text,integer,text,text,text,text,timestamptz,text,text,text\\[\\],boolean\\)',
    'code1_save_deck\\(text,text,integer,boolean,text,text,text,text\\[\\]\\)'
  ]){
    must(new RegExp(`revoke all on function ${sig} from public, anon, authenticated`));
    must(new RegExp(`grant execute on function ${sig} to service_role`));
  }
});
