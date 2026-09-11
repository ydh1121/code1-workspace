-- CODE1 Internal Workspace / STAGING ONLY
-- Harden Deck asset registration so a repeated actor/request_id is idempotent only
-- when the exact asset identity and byte metadata match.

begin;

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
  v_account_status text;
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
  if coalesce(jsonb_typeof(p_asset->'metadata'),'object') <> 'object' then raise exception 'INVALID_DECK_ASSET_METADATA'; end if;

  select wa.role,wa.status,wa.permissions_json
    into v_role,v_account_status,v_permissions
  from workspace_accounts wa
  where wa.account_id=p_actor_id;
  if not found or v_account_status <> 'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_role not in ('SUPER_ADMIN','ADMIN') and coalesce(v_permissions->>'deck','none') <> 'edit' then raise exception 'FORBIDDEN'; end if;

  insert into deck_documents(deck_id,current_version,version_label,status,updated_by,updated_at)
  values(v_deck_id,0,'v0.1','INTERNAL WORKING COPY',p_actor_id,now())
  on conflict (deck_id) do nothing;

  select da.* into v_existing
  from deck_assets da
  where da.deck_id=v_deck_id and da.registered_by=p_actor_id and da.request_id=p_request_id
  limit 1;
  if found then
    if v_existing.asset_id=v_asset_id
       and v_existing.object_key=v_object_key
       and v_existing.mime_type=v_mime
       and v_existing.file_size_bytes=v_size
       and v_existing.checksum_sha256=v_checksum
       and v_existing.source_kind=v_source_kind
       and v_existing.state='ACTIVE' then
      return next v_existing;
      return;
    end if;
    raise exception 'REQUEST_ID_REUSE';
  end if;

  select da.* into v_existing
  from deck_assets da
  where da.asset_id=v_asset_id;
  if found then
    if v_existing.deck_id=v_deck_id
       and v_existing.object_key=v_object_key
       and v_existing.mime_type=v_mime
       and v_existing.file_size_bytes=v_size
       and v_existing.checksum_sha256=v_checksum
       and v_existing.source_kind=v_source_kind
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
    case when jsonb_typeof(p_asset->'metadata')='object' then p_asset->'metadata' else '{}'::jsonb end,
    'ACTIVE',p_actor_id,p_request_id
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

revoke all on function code1_register_deck_asset(text,text,jsonb) from public, anon, authenticated;
grant execute on function code1_register_deck_asset(text,text,jsonb) to service_role;

commit;
