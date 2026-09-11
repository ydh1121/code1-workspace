-- CODE1 Internal Workspace / STAGING ONLY
-- Make saveDeck request retries idempotent only when the same logical Deck payload,
-- base version, summary, actor and asset linkage are replayed. Server-generated updated_at
-- may differ across an HTTP retry, so it is excluded from logical payload equality.

begin;

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
  v_existing_payload jsonb;
  v_next integer;
  v_label text;
  v_revision text;
  v_saved timestamptz;
  v_hash text;
  v_missing integer;
  v_distinct integer;
  v_existing_asset_count integer;
begin
  if p_deck_id <> 'CODE1_AZA_INTERNAL' then raise exception 'INVALID_DECK'; end if;
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_summary is null or char_length(p_summary) > 1000 then raise exception 'INVALID_SUMMARY'; end if;
  if p_payload_text is null or char_length(p_payload_text) not between 2 and 1200000 then raise exception 'INVALID_DECK'; end if;
  if p_asset_refs is null or cardinality(p_asset_refs) > 256 then raise exception 'INVALID_DECK_MEDIA'; end if;

  select count(distinct refs.asset_id) into v_distinct
  from unnest(p_asset_refs) as refs(asset_id);
  if v_distinct <> cardinality(p_asset_refs) then raise exception 'INVALID_DECK_MEDIA'; end if;

  begin
    v_payload:=p_payload_text::jsonb;
  exception when others then
    raise exception 'INVALID_DECK';
  end;
  if coalesce(v_payload->>'deck_id','') <> p_deck_id
     or coalesce(v_payload->>'status','') <> 'INTERNAL WORKING COPY'
     or jsonb_typeof(v_payload->'slides') <> 'array'
     or jsonb_array_length(v_payload->'slides') not between 1 and 40 then
    raise exception 'INVALID_DECK';
  end if;

  select wa.role,wa.status,wa.permissions_json,coalesce(nullif(wa.email,''),wa.username)
    into v_role,v_account_status,v_permissions,v_snapshot
  from workspace_accounts wa
  where wa.account_id=p_actor_id;
  if not found or v_account_status <> 'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_role not in ('SUPER_ADMIN','ADMIN') and coalesce(v_permissions->>'deck','none') <> 'edit' then raise exception 'FORBIDDEN'; end if;
  if coalesce(v_payload->>'saved_by','') <> v_snapshot then raise exception 'INVALID_DECK'; end if;

  select dr.* into v_existing
  from deck_revisions dr
  where dr.deck_id=p_deck_id
    and dr.saved_by=p_actor_id
    and dr.request_id=p_request_id
    and dr.source_kind='STAGING_SAVE'
  limit 1;
  if found then
    begin
      v_existing_payload:=v_existing.payload_text::jsonb;
    exception when others then
      raise exception 'DECK_REVISION_INCOMPLETE';
    end;
    select count(*) into v_existing_asset_count
    from deck_revision_assets dra
    where dra.revision_id=v_existing.revision_id;
    select count(*) into v_missing
    from unnest(p_asset_refs) as refs(asset_id)
    left join deck_revision_assets dra
      on dra.revision_id=v_existing.revision_id and dra.asset_id=refs.asset_id
    where dra.asset_id is null;

    if p_base_version <> v_existing.version-1
       or coalesce((v_payload->>'version')::integer,0) <> v_existing.version
       or coalesce(v_payload->>'version_label','') <> v_existing.version_label
       or left(p_summary,1000) <> v_existing.change_summary
       or (v_payload - 'updated_at') <> (v_existing_payload - 'updated_at')
       or v_missing <> 0
       or v_existing_asset_count <> cardinality(p_asset_refs) then
      raise exception 'REQUEST_ID_REUSE';
    end if;
    return query select v_existing.version,v_existing.version_label,v_existing.saved_at,v_existing.revision_id;
    return;
  end if;

  select dd.* into v_doc
  from deck_documents dd
  where dd.deck_id=p_deck_id
  for update;
  if not found or v_doc.current_revision_id is null then raise exception 'NOT_FOUND'; end if;
  if v_doc.current_version <> p_base_version then raise exception 'CONFLICT'; end if;

  v_next:=v_doc.current_version+1;
  v_label:=case when coalesce(p_new_version,false) then 'v0.'||v_next::text else v_doc.version_label end;

  begin
    v_saved:=nullif(v_payload->>'updated_at','')::timestamptz;
  exception when others then
    raise exception 'INVALID_SAVED_AT';
  end;
  if v_saved is null or abs(extract(epoch from (now()-v_saved))) > 600 then raise exception 'INVALID_SAVED_AT'; end if;

  if coalesce((v_payload->>'version')::integer,0) <> v_next
     or coalesce(v_payload->>'version_label','') <> v_label then
    raise exception 'INVALID_DECK';
  end if;

  select count(*) into v_missing
  from unnest(p_asset_refs) as refs(asset_id)
  left join deck_assets da
    on da.asset_id=refs.asset_id and da.deck_id=p_deck_id and da.state='ACTIVE'
  where da.asset_id is null;
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
  select v_revision,refs.asset_id
  from unnest(p_asset_refs) as refs(asset_id);

  update deck_documents dd
  set current_revision_id=v_revision,
      current_version=v_next,
      version_label=v_label,
      status='INTERNAL WORKING COPY',
      updated_by=p_actor_id,
      updated_at=v_saved
  where dd.deck_id=p_deck_id;

  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'deck.save','DECK',p_deck_id,'version='||v_next,p_request_id,
    jsonb_build_object(
      'revision_id',v_revision,'content_hash',v_hash,
      'asset_count',cardinality(p_asset_refs),'new_version',coalesce(p_new_version,false),
      'saved_at',v_saved
    )
  );

  return query select v_next,v_label,v_saved,v_revision;
end;
$$;

revoke all on function code1_save_deck(text,text,integer,boolean,text,text,text,text[]) from public, anon, authenticated;
grant execute on function code1_save_deck(text,text,integer,boolean,text,text,text,text[]) to service_role;

commit;
