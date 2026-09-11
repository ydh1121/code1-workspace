-- CODE1 Internal Workspace / STAGING ONLY
-- Aza Mall Deck runtime target for WO-20260912-CODING-DECK-001.
-- ADDITIVE DESIGN ONLY at commit time: this file must pass pre-apply tests before DB application.
-- Never apply to Production and never use this migration to mutate the live Apps Script/Sheet/Drive source.

begin;

create table if not exists deck_documents (
  deck_id text primary key check (deck_id = 'CODE1_AZA_INTERNAL'),
  current_revision_id text,
  current_version integer not null default 0 check (current_version >= 0),
  version_label text not null default 'v0.1' check (char_length(version_label) between 1 and 30),
  status text not null default 'INTERNAL WORKING COPY' check (status = 'INTERNAL WORKING COPY'),
  updated_by text references workspace_accounts(account_id),
  updated_at timestamptz not null default now()
);

create table if not exists deck_assets (
  asset_id text primary key check (asset_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  deck_id text not null references deck_documents(deck_id) on delete restrict
    check (deck_id = 'CODE1_AZA_INTERNAL'),
  object_key text not null unique check (object_key like 'private/decks/%'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 8388608),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  source_kind text not null check (source_kind in ('SEED_EMBEDDED','LEGACY_DRIVE','STAGING_UPLOAD')),
  source_ref text,
  rights_status text,
  usage_note text,
  review_note text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  state text not null default 'ACTIVE' check (state in ('ACTIVE','DELETED')),
  registered_by text references workspace_accounts(account_id),
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists deck_assets_actor_request_uniq
  on deck_assets(deck_id, registered_by, request_id)
  where registered_by is not null and request_id is not null and request_id <> '';
create index if not exists deck_assets_deck_state_idx
  on deck_assets(deck_id, state, asset_id);

create table if not exists deck_revisions (
  revision_id text primary key check (revision_id ~ '^R_[A-Za-z0-9]{24}$'),
  deck_id text not null references deck_documents(deck_id) on delete restrict
    check (deck_id = 'CODE1_AZA_INTERNAL'),
  version integer not null check (version > 0),
  version_label text not null check (char_length(version_label) between 1 and 30),
  status text not null default 'INTERNAL WORKING COPY' check (status = 'INTERNAL WORKING COPY'),
  payload_text text not null check (char_length(payload_text) between 2 and 1200000),
  content_hash text not null check (content_hash ~ '^[A-Za-z0-9_-]{43}$'),
  saved_by text not null references workspace_accounts(account_id),
  saved_by_snapshot text not null,
  saved_at timestamptz not null default now(),
  change_summary text not null default '' check (char_length(change_summary) <= 1000),
  request_id text not null check (request_id ~ '^[a-f0-9]{32}$'),
  source_kind text not null check (source_kind in ('LEGACY_IMPORT','STAGING_SAVE')),
  source_revision_id text,
  state text not null default 'COMMITTED' check (state = 'COMMITTED'),
  unique(deck_id, version)
);

create unique index if not exists deck_revisions_runtime_request_uniq
  on deck_revisions(deck_id, saved_by, request_id)
  where source_kind = 'STAGING_SAVE';
create index if not exists deck_revisions_deck_version_idx
  on deck_revisions(deck_id, version desc);

create table if not exists deck_revision_assets (
  revision_id text not null references deck_revisions(revision_id) on delete cascade,
  asset_id text not null references deck_assets(asset_id) on delete restrict,
  primary key (revision_id, asset_id)
);
create index if not exists deck_revision_assets_asset_idx
  on deck_revision_assets(asset_id, revision_id);

alter table deck_documents
  drop constraint if exists deck_documents_current_revision_fkey,
  add constraint deck_documents_current_revision_fkey
    foreign key (current_revision_id) references deck_revisions(revision_id)
    deferrable initially immediate;

alter table deck_documents enable row level security;
alter table deck_assets enable row level security;
alter table deck_revisions enable row level security;
alter table deck_revision_assets enable row level security;

-- Browser roles never access Deck persistence directly. Cloudflare uses the STAGING service boundary.
revoke all on table deck_documents, deck_assets, deck_revisions, deck_revision_assets from anon, authenticated;
grant select, insert, update on table deck_documents, deck_assets to service_role;
grant select, insert on table deck_revisions, deck_revision_assets to service_role;

create or replace function code1_register_deck_asset(
  p_actor_id text,
  p_request_id text,
  p_asset jsonb
) returns setof deck_assets
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_role text;
  v_status text;
  v_permissions jsonb;
  v_existing deck_assets%rowtype;
  v_row deck_assets%rowtype;
  v_asset_id text := coalesce(p_asset->>'asset_id','');
  v_deck_id text := coalesce(p_asset->>'deck_id','');
  v_object_key text := coalesce(p_asset->>'object_key','');
  v_mime text := coalesce(p_asset->>'mime_type','');
  v_size bigint := coalesce(nullif(p_asset->>'file_size_bytes','')::bigint,0);
  v_checksum text := lower(coalesce(p_asset->>'checksum_sha256',''));
  v_source_kind text := coalesce(p_asset->>'source_kind','');
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if v_deck_id <> 'CODE1_AZA_INTERNAL' then raise exception 'INVALID_DECK'; end if;
  if v_asset_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'INVALID_DECK_MEDIA'; end if;
  if v_object_key not like 'private/decks/%' then raise exception 'INVALID_DECK_OBJECT_KEY'; end if;
  if v_mime not in ('image/jpeg','image/png','image/webp') then raise exception 'PREVIEW_NOT_SUPPORTED'; end if;
  if v_size < 1 or v_size > 8388608 then raise exception 'PREVIEW_TOO_LARGE'; end if;
  if v_checksum !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_CHECKSUM'; end if;
  if v_source_kind not in ('SEED_EMBEDDED','LEGACY_DRIVE','STAGING_UPLOAD') then raise exception 'INVALID_DECK_ASSET_SOURCE'; end if;

  select role,status,permissions_json into v_role,v_status,v_permissions
  from workspace_accounts where account_id=p_actor_id;
  if not found or v_status <> 'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_role not in ('SUPER_ADMIN','ADMIN') and coalesce(v_permissions->>'deck','none') <> 'edit' then raise exception 'FORBIDDEN'; end if;

  select * into v_existing
  from deck_assets
  where deck_id=v_deck_id and registered_by=p_actor_id and request_id=p_request_id
  limit 1;
  if found then
    return next v_existing;
    return;
  end if;

  select * into v_existing from deck_assets where asset_id=v_asset_id;
  if found then
    if v_existing.deck_id=v_deck_id
       and v_existing.object_key=v_object_key
       and v_existing.mime_type=v_mime
       and v_existing.file_size_bytes=v_size
       and v_existing.checksum_sha256=v_checksum
       and v_existing.state='ACTIVE' then
      return next v_existing;
      return;
    end if;
    raise exception 'DECK_ASSET_CONFLICT';
  end if;

  insert into deck_assets(
    asset_id,deck_id,object_key,mime_type,file_size_bytes,checksum_sha256,
    source_kind,source_ref,rights_status,usage_note,review_note,metadata,
    state,registered_by,request_id
  ) values (
    v_asset_id,v_deck_id,v_object_key,v_mime,v_size,v_checksum,
    v_source_kind,nullif(p_asset->>'source_ref',''),nullif(p_asset->>'rights_status',''),
    nullif(p_asset->>'usage_note',''),nullif(p_asset->>'review_note',''),
    coalesce(p_asset->'metadata','{}'::jsonb),'ACTIVE',p_actor_id,p_request_id
  ) returning * into v_row;

  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'deck.asset.register','DECK_ASSET',v_asset_id,
    'deck='||v_deck_id,p_request_id,
    jsonb_build_object('source_kind',v_source_kind,'object_key',v_object_key,'checksum_sha256',v_checksum,'bytes',v_size)
  );

  return next v_row;
end;
$$;

create or replace function code1_import_deck_revision(
  p_actor_id text,
  p_revision_id text,
  p_deck_id text,
  p_version integer,
  p_version_label text,
  p_payload_text text,
  p_content_hash text,
  p_saved_by_snapshot text,
  p_saved_at timestamptz,
  p_change_summary text,
  p_request_id text,
  p_asset_refs text[],
  p_make_current boolean default false
) returns table(revision_id text, version integer, version_label text, saved_at timestamptz)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_actor workspace_accounts%rowtype;
  v_payload jsonb;
  v_hash text;
  v_existing deck_revisions%rowtype;
  v_missing integer;
  v_distinct integer;
  v_current integer;
begin
  select * into v_actor from workspace_accounts where account_id=p_actor_id;
  if not found or v_actor.status <> 'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_actor.role <> 'SUPER_ADMIN' or p_actor_id <> 'OWNER' then raise exception 'FORBIDDEN'; end if;
  if p_deck_id <> 'CODE1_AZA_INTERNAL' then raise exception 'INVALID_DECK'; end if;
  if p_revision_id !~ '^R_[A-Za-z0-9]{24}$' then raise exception 'INVALID_DECK_REVISION'; end if;
  if p_version is null or p_version < 1 then raise exception 'INVALID_DECK_VERSION'; end if;
  if p_version_label is null or char_length(p_version_label) not between 1 and 30 then raise exception 'INVALID_DECK_VERSION_LABEL'; end if;
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_payload_text is null or char_length(p_payload_text) not between 2 and 1200000 then raise exception 'INVALID_DECK'; end if;
  if p_asset_refs is null or cardinality(p_asset_refs) > 256 then raise exception 'INVALID_DECK_MEDIA'; end if;

  begin v_payload:=p_payload_text::jsonb; exception when others then raise exception 'INVALID_DECK'; end;
  if coalesce(v_payload->>'deck_id','') <> p_deck_id
     or coalesce((v_payload->>'version')::integer,0) <> p_version
     or coalesce(v_payload->>'version_label','') <> p_version_label
     or coalesce(v_payload->>'status','') <> 'INTERNAL WORKING COPY'
     or jsonb_typeof(v_payload->'slides') <> 'array'
     or jsonb_array_length(v_payload->'slides') not between 1 and 40 then
    raise exception 'INVALID_DECK';
  end if;

  v_hash:=replace(translate(encode(extensions.digest(convert_to(p_payload_text,'UTF8'),'sha256'),'base64'),'+/','-_'),'=','');
  if v_hash <> p_content_hash then raise exception 'DECK_CONTENT_HASH_MISMATCH'; end if;

  select count(distinct x) into v_distinct from unnest(p_asset_refs) x;
  if v_distinct <> cardinality(p_asset_refs) then raise exception 'INVALID_DECK_MEDIA'; end if;
  select count(*) into v_missing
  from unnest(p_asset_refs) x
  left join deck_assets a on a.asset_id=x and a.deck_id=p_deck_id and a.state='ACTIVE'
  where a.asset_id is null;
  if v_missing <> 0 then raise exception 'INVALID_DECK_MEDIA'; end if;

  select * into v_existing from deck_revisions where revision_id=p_revision_id;
  if found then
    if v_existing.deck_id=p_deck_id and v_existing.version=p_version and v_existing.content_hash=p_content_hash then
      return query select v_existing.revision_id,v_existing.version,v_existing.version_label,v_existing.saved_at;
      return;
    end if;
    raise exception 'DECK_REVISION_CONFLICT';
  end if;

  insert into deck_documents(deck_id,current_version,version_label,status,updated_by,updated_at)
  values(p_deck_id,0,p_version_label,'INTERNAL WORKING COPY',p_actor_id,coalesce(p_saved_at,now()))
  on conflict (deck_id) do nothing;

  if exists(select 1 from deck_revisions where deck_id=p_deck_id and version=p_version) then
    raise exception 'DECK_VERSION_CONFLICT';
  end if;

  insert into deck_revisions(
    revision_id,deck_id,version,version_label,status,payload_text,content_hash,
    saved_by,saved_by_snapshot,saved_at,change_summary,request_id,
    source_kind,source_revision_id,state
  ) values (
    p_revision_id,p_deck_id,p_version,p_version_label,'INTERNAL WORKING COPY',p_payload_text,p_content_hash,
    p_actor_id,coalesce(nullif(p_saved_by_snapshot,''),p_actor_id),coalesce(p_saved_at,now()),left(coalesce(p_change_summary,''),1000),p_request_id,
    'LEGACY_IMPORT',p_revision_id,'COMMITTED'
  );

  insert into deck_revision_assets(revision_id,asset_id)
  select p_revision_id,x from unnest(p_asset_refs) x;

  if coalesce(p_make_current,false) then
    select current_version into v_current from deck_documents where deck_id=p_deck_id for update;
    if v_current > p_version then raise exception 'DECK_VERSION_CONFLICT'; end if;
    update deck_documents
    set current_revision_id=p_revision_id,current_version=p_version,version_label=p_version_label,
        status='INTERNAL WORKING COPY',updated_by=p_actor_id,updated_at=coalesce(p_saved_at,now())
    where deck_id=p_deck_id;
  end if;

  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'deck.revision.import','DECK',p_deck_id,'version='||p_version,p_request_id,
    jsonb_build_object('revision_id',p_revision_id,'content_hash',p_content_hash,'asset_count',cardinality(p_asset_refs),'make_current',coalesce(p_make_current,false))
  );

  return query select p_revision_id,p_version,p_version_label,coalesce(p_saved_at,now());
end;
$$;

create or replace function code1_save_deck(
  p_actor_id text,
  p_deck_id text,
  p_base_version integer,
  p_new_version boolean,
  p_summary text,
  p_request_id text,
  p_payload_text text,
  p_asset_refs text[]
) returns table(version integer, version_label text, saved_at timestamptz, revision_id text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_role text;
  v_account_status text;
  v_permissions jsonb;
  v_snapshot text;
  v_doc deck_documents%rowtype;
  v_existing deck_revisions%rowtype;
  v_payload jsonb;
  v_next integer;
  v_label text;
  v_revision text;
  v_saved timestamptz := now();
  v_hash text;
  v_missing integer;
  v_distinct integer;
begin
  if p_deck_id <> 'CODE1_AZA_INTERNAL' then raise exception 'INVALID_DECK'; end if;
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_summary is null or char_length(p_summary) > 1000 then raise exception 'INVALID_SUMMARY'; end if;
  if p_payload_text is null or char_length(p_payload_text) not between 2 and 1200000 then raise exception 'INVALID_DECK'; end if;
  if p_asset_refs is null or cardinality(p_asset_refs) > 256 then raise exception 'INVALID_DECK_MEDIA'; end if;

  select role,status,permissions_json,coalesce(nullif(email,''),username)
  into v_role,v_account_status,v_permissions,v_snapshot
  from workspace_accounts where account_id=p_actor_id;
  if not found or v_account_status <> 'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_role not in ('SUPER_ADMIN','ADMIN') and coalesce(v_permissions->>'deck','none') <> 'edit' then raise exception 'FORBIDDEN'; end if;

  select * into v_existing
  from deck_revisions
  where deck_id=p_deck_id and saved_by=p_actor_id and request_id=p_request_id and source_kind='STAGING_SAVE'
  limit 1;
  if found then
    return query select v_existing.version,v_existing.version_label,v_existing.saved_at,v_existing.revision_id;
    return;
  end if;

  select * into v_doc from deck_documents where deck_id=p_deck_id for update;
  if not found or v_doc.current_revision_id is null then raise exception 'NOT_FOUND'; end if;
  if v_doc.current_version <> p_base_version then raise exception 'CONFLICT'; end if;

  v_next:=v_doc.current_version+1;
  v_label:=case when coalesce(p_new_version,false) then 'v0.'||v_next::text else v_doc.version_label end;

  begin v_payload:=p_payload_text::jsonb; exception when others then raise exception 'INVALID_DECK'; end;
  if coalesce(v_payload->>'deck_id','') <> p_deck_id
     or coalesce((v_payload->>'version')::integer,0) <> v_next
     or coalesce(v_payload->>'version_label','') <> v_label
     or coalesce(v_payload->>'status','') <> 'INTERNAL WORKING COPY'
     or jsonb_typeof(v_payload->'slides') <> 'array'
     or jsonb_array_length(v_payload->'slides') not between 1 and 40 then
    raise exception 'INVALID_DECK';
  end if;

  select count(distinct x) into v_distinct from unnest(p_asset_refs) x;
  if v_distinct <> cardinality(p_asset_refs) then raise exception 'INVALID_DECK_MEDIA'; end if;
  select count(*) into v_missing
  from unnest(p_asset_refs) x
  left join deck_assets a on a.asset_id=x and a.deck_id=p_deck_id and a.state='ACTIVE'
  where a.asset_id is null;
  if v_missing <> 0 then raise exception 'INVALID_DECK_MEDIA'; end if;

  v_hash:=replace(translate(encode(extensions.digest(convert_to(p_payload_text,'UTF8'),'sha256'),'base64'),'+/','-_'),'=','');
  v_revision:='R_'||substr(replace(gen_random_uuid()::text,'-',''),1,24);

  insert into deck_revisions(
    revision_id,deck_id,version,version_label,status,payload_text,content_hash,
    saved_by,saved_by_snapshot,saved_at,change_summary,request_id,source_kind,state
  ) values (
    v_revision,p_deck_id,v_next,v_label,'INTERNAL WORKING COPY',p_payload_text,v_hash,
    p_actor_id,v_snapshot,v_saved,left(p_summary,1000),p_request_id,'STAGING_SAVE','COMMITTED'
  );

  insert into deck_revision_assets(revision_id,asset_id)
  select v_revision,x from unnest(p_asset_refs) x;

  update deck_documents
  set current_revision_id=v_revision,current_version=v_next,version_label=v_label,
      status='INTERNAL WORKING COPY',updated_by=p_actor_id,updated_at=v_saved
  where deck_id=p_deck_id;

  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'deck.save','DECK',p_deck_id,'version='||v_next,p_request_id,
    jsonb_build_object('revision_id',v_revision,'content_hash',v_hash,'asset_count',cardinality(p_asset_refs),'new_version',coalesce(p_new_version,false))
  );

  return query select v_next,v_label,v_saved,v_revision;
end;
$$;

revoke all on function code1_register_deck_asset(text,text,jsonb) from public, anon, authenticated;
grant execute on function code1_register_deck_asset(text,text,jsonb) to service_role;
revoke all on function code1_import_deck_revision(text,text,text,integer,text,text,text,text,timestamptz,text,text,text[],boolean) from public, anon, authenticated;
grant execute on function code1_import_deck_revision(text,text,text,integer,text,text,text,text,timestamptz,text,text,text[],boolean) to service_role;
revoke all on function code1_save_deck(text,text,integer,boolean,text,text,text,text[]) from public, anon, authenticated;
grant execute on function code1_save_deck(text,text,integer,boolean,text,text,text,text[]) to service_role;

commit;
