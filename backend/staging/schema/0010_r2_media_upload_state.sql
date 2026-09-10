-- CODE1 Internal Workspace / STAGING ONLY
-- R2 multipart upload state and idempotent media registration/finalization.
-- Do not apply to Production or the current live Apps Script runtime.

begin;

alter table media_assets
  add column if not exists r2_multipart_upload_id text,
  add column if not exists upload_chunk_bytes integer,
  add column if not exists upload_received_bytes bigint not null default 0,
  add column if not exists upload_parts jsonb not null default '[]'::jsonb;

alter table media_assets
  drop constraint if exists media_assets_upload_chunk_bytes_check,
  add constraint media_assets_upload_chunk_bytes_check
    check (upload_chunk_bytes is null or upload_chunk_bytes between 5242880 and 52428800),
  drop constraint if exists media_assets_upload_received_bytes_check,
  add constraint media_assets_upload_received_bytes_check
    check (upload_received_bytes >= 0 and (file_size_bytes is null or upload_received_bytes <= file_size_bytes)),
  drop constraint if exists media_assets_upload_parts_array_check,
  add constraint media_assets_upload_parts_array_check
    check (jsonb_typeof(upload_parts) = 'array');

create unique index if not exists media_assets_r2_actor_request_uniq
  on media_assets(uploaded_by, request_id)
  where source_storage = 'R2_PRIVATE'
    and uploaded_by is not null
    and request_id is not null
    and request_id <> '';

create or replace function code1_finalize_media_upload(
  p_actor_id text,
  p_media_id text,
  p_request_id text
) returns setof media_assets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row media_assets%rowtype;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then
    raise exception 'INVALID_REQUEST';
  end if;

  select * into v_row
  from media_assets
  where media_id = p_media_id
  for update;

  if not found then
    raise exception 'MEDIA_NOT_FOUND';
  end if;

  if v_row.status = 'REVIEW_REQUIRED' then
    return next v_row;
    return;
  end if;

  if v_row.status <> 'UPLOADING' then
    raise exception 'MEDIA_FINALIZE_INVALID_STATUS';
  end if;

  if v_row.upload_received_bytes <> v_row.file_size_bytes then
    raise exception 'MEDIA_UPLOAD_INCOMPLETE';
  end if;

  update media_assets
  set status = 'REVIEW_REQUIRED',
      uploaded_at = now()
  where media_id = p_media_id
  returning * into v_row;

  insert into media_events(
    actor_id, media_id, event_type, from_status, to_status,
    object_key, request_id, metadata
  ) values (
    p_actor_id, p_media_id, 'UPLOADED', 'UPLOADING', 'REVIEW_REQUIRED',
    v_row.object_key, p_request_id,
    jsonb_build_object('transport','R2_MULTIPART')
  );

  return next v_row;
end;
$$;

create or replace function code1_register_media_upload(
  p_actor_id text,
  p_request_id text,
  p_media jsonb
) returns setof media_assets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing media_assets%rowtype;
  v_row media_assets%rowtype;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then
    raise exception 'INVALID_REQUEST';
  end if;

  select * into v_existing
  from media_assets
  where source_storage = 'R2_PRIVATE'
    and uploaded_by = p_actor_id
    and request_id = p_request_id
  limit 1;

  if found then
    return next v_existing;
    return;
  end if;

  begin
    insert into media_assets(
      media_id, upload_id, submission_id, farm_id, media_group,
      shot_code, shot_label, original_file_name, object_key, mime_type,
      file_size_bytes, caption, taken_at, photographer, rights_owner,
      face_present, face_consent, privacy_checked, web_use, magazine_use,
      sns_use, b2b_use, ad_use, edit_allowed, ai_edit_allowed,
      status, request_id, uploaded_by, source_storage,
      upload_received_bytes, upload_parts
    ) values (
      p_media->>'media_id',
      p_media->>'upload_id',
      nullif(p_media->>'submission_id',''),
      nullif(p_media->>'farm_id',''),
      coalesce(nullif(p_media->>'media_group',''),'PHOTO'),
      p_media->>'shot_code',
      p_media->>'shot_label',
      coalesce(nullif(p_media->>'original_file_name',''),'original'),
      nullif(p_media->>'object_key',''),
      coalesce(nullif(p_media->>'mime_type',''),'application/octet-stream'),
      nullif(p_media->>'file_size_bytes','')::bigint,
      p_media->>'caption',
      nullif(p_media->>'taken_at','')::timestamptz,
      p_media->>'photographer',
      p_media->>'rights_owner',
      p_media->>'face_present',
      p_media->>'face_consent',
      p_media->>'privacy_checked',
      p_media->>'web_use',
      p_media->>'magazine_use',
      p_media->>'sns_use',
      p_media->>'b2b_use',
      p_media->>'ad_use',
      p_media->>'edit_allowed',
      p_media->>'ai_edit_allowed',
      'REVIEW_REQUIRED',
      p_request_id,
      p_actor_id,
      'R2_PRIVATE',
      coalesce(nullif(p_media->>'upload_received_bytes','')::bigint, nullif(p_media->>'file_size_bytes','')::bigint, 0),
      coalesce(p_media->'upload_parts','[]'::jsonb)
    )
    returning * into v_row;
  exception when unique_violation then
    select * into v_existing
    from media_assets
    where source_storage = 'R2_PRIVATE'
      and uploaded_by = p_actor_id
      and request_id = p_request_id
    limit 1;
    if found then
      return next v_existing;
      return;
    end if;
    raise;
  end;

  insert into media_events(
    actor_id, media_id, event_type, to_status, object_key, request_id, metadata
  ) values (
    p_actor_id, v_row.media_id, 'UPLOADED', 'REVIEW_REQUIRED',
    v_row.object_key, p_request_id,
    jsonb_build_object('transport','R2_SINGLE_PUT')
  );

  return next v_row;
end;
$$;

revoke all on function code1_finalize_media_upload(text,text,text) from public, anon, authenticated;
grant execute on function code1_finalize_media_upload(text,text,text) to service_role;
revoke all on function code1_register_media_upload(text,text,jsonb) from public, anon, authenticated;
grant execute on function code1_register_media_upload(text,text,jsonb) to service_role;

commit;
