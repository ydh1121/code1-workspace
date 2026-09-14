-- CODE1 Planning Material field types + draft/preview/publish lifecycle / STAGING ONLY
-- Authority: MSG-20260914-0099 / WO-20260914-CODING-MATERIAL-FIELD-TYPES-001 / Delta 20260914-048
-- Additive model correction. Existing request snapshots are never rewritten.

begin;

alter table public.planning_material_template_items
  add column if not exists response_kind text not null default 'TEXT_FILE';
alter table public.planning_material_template_items
  drop constraint if exists planning_material_template_items_response_kind_check;
alter table public.planning_material_template_items
  add constraint planning_material_template_items_response_kind_check
  check(response_kind in ('TEXT','LONG_TEXT','FILE','TEXT_FILE'));

alter table public.planning_material_request_items
  add column if not exists response_kind_snapshot text;
alter table public.planning_material_request_items
  drop constraint if exists planning_material_request_items_response_kind_snapshot_check;
alter table public.planning_material_request_items
  add constraint planning_material_request_items_response_kind_snapshot_check
  check(response_kind_snapshot is null or response_kind_snapshot in ('TEXT','LONG_TEXT','FILE','TEXT_FILE'));

alter table public.planning_material_request_items
  drop constraint if exists planning_material_request_items_submission_state_check;
alter table public.planning_material_request_items
  add constraint planning_material_request_items_submission_state_check
  check(submission_state in ('MISSING','TEXT_SUBMITTED','FILE_SUBMITTED','TEXT_FILE_SUBMITTED','LATER','NO_MATERIAL','NOT_APPLICABLE'));

alter table public.planning_material_templates
  add column if not exists published_revision integer;
alter table public.planning_material_templates
  drop constraint if exists planning_material_templates_published_revision_check;
alter table public.planning_material_templates
  add constraint planning_material_templates_published_revision_check
  check(published_revision is null or (published_revision > 0 and published_revision <= current_revision));

alter table public.planning_material_template_revisions
  add column if not exists revision_state text not null default 'DRAFT',
  add column if not exists published_at timestamptz;
alter table public.planning_material_template_revisions
  drop constraint if exists planning_material_template_revisions_revision_state_check;
alter table public.planning_material_template_revisions
  add constraint planning_material_template_revisions_revision_state_check
  check(revision_state in ('DRAFT','PUBLISHED','ARCHIVED'));

-- Before this migration every template save became immediately effective. Treat the latest
-- legacy revision as currently published and older legacy revisions as previously published history.
update public.planning_material_templates
set published_revision=current_revision
where published_revision is null;

update public.planning_material_template_revisions r
set published_at=coalesce(r.published_at,r.created_at),
    revision_state=case when r.revision=t.published_revision then 'PUBLISHED' else 'ARCHIVED' end
from public.planning_material_templates t
where t.template_id=r.template_id
  and r.published_at is null;

-- Save now means SAVE DRAFT. New requests keep using published_revision until explicit publish.
create or replace function public.code1_material_save_template(
  p_actor_id text,p_template_id text,p_base_revision integer,p_items jsonb,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_t public.planning_material_templates%rowtype;
  v_next integer;
  v_before jsonb;
  v_after jsonb;
  v_item jsonb;
  v_key text;
  v_kind text;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_TEMPLATE_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_template_id)::bigint);

  if exists(select 1 from public.planning_material_template_revisions r where r.template_id=p_template_id and r.request_id=p_request_id) then
    select current_revision into v_next from public.planning_material_templates where template_id=p_template_id;
    return jsonb_build_object('template_id',p_template_id,'revision',v_next,'published_revision',(select published_revision from public.planning_material_templates where template_id=p_template_id),'lifecycle_status','DRAFT','idempotent',true);
  end if;

  select * into v_t from public.planning_material_templates where template_id=p_template_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.current_revision<>p_base_revision then raise exception 'CONFLICT'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where nullif(btrim(x->>'item_key'),'') is null or nullif(btrim(x->>'label'),'') is null) then raise exception 'INVALID_TEMPLATE'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct upper(btrim(x->>'item_key'))) from jsonb_array_elements(p_items) x) then raise exception 'INVALID_TEMPLATE'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where coalesce(x->>'response_kind','') not in ('TEXT','LONG_TEXT','FILE','TEXT_FILE')) then raise exception 'INVALID_RESPONSE_KIND'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_key',i.item_key,'label',i.label,'description',i.description,'required',i.required,
    'sort_order',i.sort_order,'active',i.active,'classification_hint',i.classification_hint,
    'response_kind',i.response_kind
  ) order by i.sort_order,i.item_key),'[]'::jsonb)
  into v_before
  from public.planning_material_template_items i where i.template_id=p_template_id;

  -- Missing rows are first archived. Never-published omitted draft rows are physically deleted below.
  update public.planning_material_template_items
     set active=false,archived_at=coalesce(archived_at,now()),updated_by=p_actor_id,updated_at=now()
   where template_id=p_template_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key:=upper(btrim(v_item->>'item_key'));
    v_kind:=v_item->>'response_kind';
    if v_key !~ '^[A-Z0-9_:-]{1,80}$' or coalesce((v_item->>'sort_order')::integer,0)<=0 then raise exception 'INVALID_TEMPLATE'; end if;
    if v_kind not in ('TEXT','LONG_TEXT','FILE','TEXT_FILE') then raise exception 'INVALID_RESPONSE_KIND'; end if;
    insert into public.planning_material_template_items(
      template_id,item_key,label,description,required,sort_order,active,archived_at,
      classification_hint,response_kind,updated_by,updated_at
    ) values(
      p_template_id,v_key,left(btrim(v_item->>'label'),300),left(coalesce(v_item->>'description',''),2000),
      coalesce((v_item->>'required')::boolean,true),(v_item->>'sort_order')::integer,
      coalesce((v_item->>'active')::boolean,true),
      case when coalesce((v_item->>'active')::boolean,true) then null else now() end,
      coalesce(nullif(v_item->>'classification_hint',''),'10_기타'),v_kind,p_actor_id,now()
    )
    on conflict(template_id,item_key) do update set
      label=excluded.label,description=excluded.description,required=excluded.required,
      sort_order=excluded.sort_order,active=excluded.active,archived_at=excluded.archived_at,
      classification_hint=excluded.classification_hint,response_kind=excluded.response_kind,
      updated_by=p_actor_id,updated_at=now();
  end loop;

  -- Draft-only items omitted from the next draft have never been externally published and may be deleted.
  delete from public.planning_material_template_items i
   where i.template_id=p_template_id
     and not exists(
       select 1 from jsonb_array_elements(p_items) x
       where upper(btrim(x->>'item_key'))=i.item_key
     )
     and not exists(
       select 1
       from public.planning_material_template_revisions r
       cross join lateral jsonb_array_elements(r.items_snapshot) x
       where r.template_id=p_template_id
         and r.published_at is not null
         and upper(coalesce(x->>'item_key',''))=i.item_key
     );

  v_next:=v_t.current_revision+1;
  update public.planning_material_templates
     set current_revision=v_next,updated_by=p_actor_id,updated_at=now()
   where template_id=p_template_id;

  -- Only one live draft revision is needed. Older never-published drafts remain internal history.
  update public.planning_material_template_revisions
     set revision_state='ARCHIVED'
   where template_id=p_template_id and revision_state='DRAFT';

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_key',i.item_key,'label',i.label,'description',i.description,'required',i.required,
    'sort_order',i.sort_order,'active',i.active,'classification_hint',i.classification_hint,
    'response_kind',i.response_kind
  ) order by i.sort_order,i.item_key),'[]'::jsonb)
  into v_after
  from public.planning_material_template_items i where i.template_id=p_template_id;

  insert into public.planning_material_template_revisions(
    template_id,revision,items_snapshot,actor_id,request_id,revision_state,published_at
  ) values(p_template_id,v_next,v_after,p_actor_id,p_request_id,'DRAFT',null);

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.template.draft.save','PLANNING_MATERIAL_TEMPLATE',p_template_id,
    '요청 항목 초안 저장',p_request_id,
    jsonb_build_object('before',v_before,'after',v_after,'revision',v_next,'published_revision',v_t.published_revision)
  );

  return jsonb_build_object(
    'template_id',p_template_id,'revision',v_next,'published_revision',v_t.published_revision,
    'lifecycle_status','DRAFT','items',v_after,'idempotent',false
  );
end $$;

create or replace function public.code1_material_publish_template(
  p_actor_id text,p_template_id text,p_revision integer,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_t public.planning_material_templates%rowtype;
  v_r public.planning_material_template_revisions%rowtype;
  v_active integer;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_TEMPLATE_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or coalesce(p_revision,0)<=0 then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_template_id)::bigint);
  select * into v_t from public.planning_material_templates where template_id=p_template_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.current_revision<>p_revision then raise exception 'CONFLICT'; end if;
  select * into v_r from public.planning_material_template_revisions where template_id=p_template_id and revision=p_revision for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_t.published_revision=p_revision and v_r.revision_state='PUBLISHED' then
    return jsonb_build_object('template_id',p_template_id,'revision',p_revision,'published_revision',p_revision,'lifecycle_status','PUBLISHED','idempotent',true);
  end if;
  if v_r.revision_state<>'DRAFT' then raise exception 'REVISION_NOT_DRAFT'; end if;
  select count(*) into v_active from jsonb_array_elements(v_r.items_snapshot) x where coalesce((x->>'active')::boolean,true);
  if v_active=0 then raise exception 'EMPTY_TEMPLATE'; end if;
  if exists(select 1 from jsonb_array_elements(v_r.items_snapshot) x where coalesce(x->>'response_kind','') not in ('TEXT','LONG_TEXT','FILE','TEXT_FILE')) then raise exception 'INVALID_RESPONSE_KIND'; end if;

  update public.planning_material_template_revisions
     set revision_state='ARCHIVED'
   where template_id=p_template_id and revision_state='PUBLISHED';
  update public.planning_material_template_revisions
     set revision_state='PUBLISHED',published_at=coalesce(published_at,now())
   where template_id=p_template_id and revision=p_revision;
  update public.planning_material_templates
     set published_revision=p_revision,updated_by=p_actor_id,updated_at=now()
   where template_id=p_template_id;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.template.publish','PLANNING_MATERIAL_TEMPLATE',p_template_id,
    '요청 항목 구성 게시',p_request_id,
    jsonb_build_object('before_published_revision',v_t.published_revision,'published_revision',p_revision,'active_item_count',v_active)
  );
  return jsonb_build_object('template_id',p_template_id,'revision',p_revision,'published_revision',p_revision,'lifecycle_status','PUBLISHED','idempotent',false);
end $$;

-- New requests snapshot only the explicitly published revision. Draft rows are never submitter-visible.
create or replace function public.code1_material_create_request(
  p_actor_id text,p_title text,p_counterparty text,p_product_snapshot jsonb,p_purpose text,p_farm_id text,p_template_id text,p_assignees text[],p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id text;
  v_t public.planning_material_templates%rowtype;
  v_snapshot jsonb;
  v_item jsonb;
  v_actor text;
  v_count integer:=0;
  v_kind text;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or nullif(btrim(coalesce(p_title,'')),'') is null or nullif(btrim(coalesce(p_counterparty,'')),'') is null or p_purpose not in ('DETAIL_PAGE','OUTBOUND_SUPPLY_PROPOSAL','BOTH','OTHER') then raise exception 'INVALID_REQUEST'; end if;
  select material_request_id into v_id from public.planning_material_requests where source_request_id=p_request_id;
  if found then return jsonb_build_object('material_request_id',v_id,'idempotent',true); end if;
  select * into v_t from public.planning_material_templates where template_id=p_template_id and status='ACTIVE';
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.published_revision is null then raise exception 'TEMPLATE_NOT_PUBLISHED'; end if;
  select items_snapshot into v_snapshot
  from public.planning_material_template_revisions
  where template_id=p_template_id and revision=v_t.published_revision and published_at is not null;
  if v_snapshot is null then raise exception 'TEMPLATE_NOT_PUBLISHED'; end if;
  if p_farm_id is not null and not exists(select 1 from public.farms where farm_id=p_farm_id) then raise exception 'INVALID_FARM'; end if;
  if exists(select 1 from unnest(coalesce(p_assignees,array[]::text[])) x left join public.workspace_accounts a on a.account_id=x where a.account_id is null or a.status<>'active' or a.archived_at is not null) then raise exception 'INVALID_ASSIGNEE'; end if;

  v_id:='PMR_'||replace(gen_random_uuid()::text,'-','');
  insert into public.planning_material_requests(
    material_request_id,title,counterparty,product_snapshot,purpose,requester_id,farm_id,status,review_status,
    revision,template_id,template_revision,created_by,updated_by,source_request_id
  ) values(
    v_id,left(btrim(p_title),240),left(btrim(p_counterparty),240),coalesce(p_product_snapshot,'{}'::jsonb),
    p_purpose,p_actor_id,p_farm_id,'REQUESTED','REQUESTED',1,p_template_id,v_t.published_revision,
    p_actor_id,p_actor_id,p_request_id
  );

  for v_item in select value from jsonb_array_elements(v_snapshot) loop
    if coalesce((v_item->>'active')::boolean,true) then
      v_kind:=nullif(v_item->>'response_kind',''); -- null is intentional legacy compatibility.
      insert into public.planning_material_request_items(
        request_item_id,material_request_id,item_key,label_snapshot,description_snapshot,required_snapshot,
        sort_order_snapshot,template_revision,classification_hint,response_kind_snapshot
      ) values(
        'PMI_'||replace(gen_random_uuid()::text,'-',''),v_id,upper(v_item->>'item_key'),left(v_item->>'label',300),
        left(coalesce(v_item->>'description',''),2000),coalesce((v_item->>'required')::boolean,true),
        (v_item->>'sort_order')::integer,v_t.published_revision,
        coalesce(nullif(v_item->>'classification_hint',''),'10_기타'),v_kind
      );
      v_count:=v_count+1;
    end if;
  end loop;
  if v_count=0 then raise exception 'EMPTY_TEMPLATE'; end if;

  foreach v_actor in array coalesce(p_assignees,array[]::text[]) loop
    insert into public.planning_material_request_assignees(material_request_id,account_id,assigned_by)
    values(v_id,v_actor,p_actor_id) on conflict do nothing;
  end loop;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.request.create','PLANNING_MATERIAL_REQUEST',v_id,'게시된 요청 항목 구성으로 자료요청 생성',p_request_id,
    jsonb_build_object('template_id',p_template_id,'template_revision',v_t.published_revision,'item_count',v_count,'assignees',coalesce(to_jsonb(p_assignees),'[]'::jsonb))
  );
  return jsonb_build_object('material_request_id',v_id,'item_count',v_count,'template_revision',v_t.published_revision,'idempotent',false);
end $$;

-- Typed item submissions derive their state from the response channel rather than trusting UI labels.
create or replace function public.code1_material_set_item_submission(
  p_actor_id text,p_request_item_id text,p_submission_state text,p_memo text,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_item public.planning_material_request_items%rowtype;
  v_before jsonb;
  v_internal boolean;
  v_kind text;
  v_has_file boolean:=false;
  v_has_text boolean:=false;
  v_state text;
  v_memo text;
  v_complete boolean:=false;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' or p_submission_state not in ('MISSING','TEXT_SUBMITTED','FILE_SUBMITTED','TEXT_FILE_SUBMITTED','LATER','NO_MATERIAL','NOT_APPLICABLE') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_item from public.planning_material_request_items where request_item_id=p_request_item_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_internal:=public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW');
  if not v_internal and not public.code1_material_assigned(p_actor_id,v_item.material_request_id) then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.audit_log where actor_id=p_actor_id and action='planning.material.item.submit' and request_id=p_request_id) then return jsonb_build_object('request_item_id',p_request_item_id,'submission_state',v_item.submission_state,'idempotent',true); end if;

  v_before:=jsonb_build_object('submission_state',v_item.submission_state,'memo',v_item.memo,'review_status',v_item.review_status);
  v_kind:=v_item.response_kind_snapshot;
  v_memo:=left(coalesce(p_memo,''),8000);

  if v_kind is null then
    -- Existing pre-0024 snapshots keep REV B behavior and are not reinterpreted retroactively.
    v_state:=p_submission_state;
    v_complete:=v_state<>'MISSING' or btrim(v_memo)<>'';
  elsif p_submission_state in ('LATER','NO_MATERIAL','NOT_APPLICABLE') then
    v_state:=p_submission_state;
    v_complete:=true;
  else
    select exists(
      select 1 from public.planning_material_files f
      join public.planning_material_file_versions fv on fv.version_id=f.current_version_id and fv.is_current
      where f.request_item_id=p_request_item_id and f.status='ACTIVE' and fv.version_state='CURRENT_CANDIDATE'
    ) into v_has_file;
    v_has_text:=btrim(v_memo)<>'';
    if v_kind='FILE' then
      if v_has_text then raise exception 'FIELD_KIND_FILE_ONLY'; end if;
      v_memo:='';
      v_state:=case when v_has_file then 'FILE_SUBMITTED' else 'MISSING' end;
      v_complete:=v_has_file;
    elsif v_kind in ('TEXT','LONG_TEXT') then
      v_state:=case when v_has_text then 'TEXT_SUBMITTED' else 'MISSING' end;
      v_complete:=v_has_text;
    elsif v_kind='TEXT_FILE' then
      v_state:=case when v_has_text and v_has_file then 'TEXT_FILE_SUBMITTED' when v_has_text then 'TEXT_SUBMITTED' when v_has_file then 'FILE_SUBMITTED' else 'MISSING' end;
      v_complete:=v_has_text and v_has_file;
    else raise exception 'INVALID_RESPONSE_KIND';
    end if;
  end if;

  update public.planning_material_request_items
     set submission_state=v_state,memo=v_memo,
         review_status=case
           when v_complete and review_status='REQUESTED' then 'RECEIVED'
           when not v_complete and review_status='RECEIVED' then 'REQUESTED'
           else review_status end,
         updated_by=p_actor_id,updated_at=now()
   where request_item_id=p_request_item_id;
  update public.planning_material_requests
     set status=case when status in ('REQUESTED','DRAFT') then 'IN_PROGRESS' else status end,
         updated_by=p_actor_id,updated_at=now()
   where material_request_id=v_item.material_request_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.item.submit','PLANNING_MATERIAL_ITEM',p_request_item_id,'자료 항목 응답 변경',p_request_id,
    jsonb_build_object('before',v_before,'after',jsonb_build_object('submission_state',v_state,'memo',v_memo,'response_kind',v_kind,'complete',v_complete))
  );
  return jsonb_build_object('request_item_id',p_request_item_id,'submission_state',v_state,'response_kind',v_kind,'complete',v_complete,'idempotent',false);
end $$;

-- Defense in depth: typed text-only request items cannot acquire a planning-material file container.
create or replace function public.code1_material_guard_file_response_kind()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_kind text;
begin
  select response_kind_snapshot into v_kind from public.planning_material_request_items where request_item_id=new.request_item_id;
  if v_kind is not null and v_kind not in ('FILE','TEXT_FILE') then raise exception 'FIELD_KIND_NO_FILE'; end if;
  return new;
end $$;
drop trigger if exists planning_material_files_response_kind_guard on public.planning_material_files;
create trigger planning_material_files_response_kind_guard
before insert on public.planning_material_files
for each row execute function public.code1_material_guard_file_response_kind();

create or replace function public.code1_material_finalize_file_version(p_actor_id text,p_media_id text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_ver public.planning_material_file_versions%rowtype;
  v_file public.planning_material_files%rowtype;
  v_item public.planning_material_request_items%rowtype;
  v_media public.media_assets%rowtype;
  v_event_id bigint;
  v_kind text;
  v_state text;
  v_complete boolean:=true;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_ver from public.planning_material_file_versions where media_id=p_media_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_file from public.planning_material_files where material_file_id=v_ver.material_file_id for update;
  select * into v_item from public.planning_material_request_items where request_item_id=v_file.request_item_id for update;
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') or public.code1_material_assigned(p_actor_id,v_item.material_request_id)) then raise exception 'FORBIDDEN'; end if;
  v_kind:=v_item.response_kind_snapshot;
  if v_kind is not null and v_kind not in ('FILE','TEXT_FILE') then raise exception 'FIELD_KIND_NO_FILE'; end if;
  if v_ver.version_state='CURRENT_CANDIDATE' and v_ver.is_current then
    return jsonb_build_object('material_file_id',v_file.material_file_id,'version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'idempotent',true);
  end if;
  if v_file.pending_version_id<>v_ver.version_id then raise exception 'CONFLICT'; end if;
  select * into v_media from public.media_assets where media_id=p_media_id for update;
  if not found or v_media.media_group<>'PLANNING_MATERIAL' then raise exception 'NOT_FOUND'; end if;

  update public.planning_material_file_versions
     set is_current=false,version_state=case when version_state='CURRENT_CANDIDATE' then 'HISTORICAL' else version_state end
   where material_file_id=v_file.material_file_id and is_current;
  update public.planning_material_file_versions set is_current=true,version_state='CURRENT_CANDIDATE' where version_id=v_ver.version_id;
  update public.planning_material_files set current_revision=v_ver.revision,current_version_id=v_ver.version_id,pending_version_id=null,updated_at=now() where material_file_id=v_file.material_file_id;
  update public.media_assets set status='REVIEW_REQUIRED',review_note=null where media_id=p_media_id;

  if v_kind='TEXT_FILE' then
    v_complete:=btrim(coalesce(v_item.memo,''))<>'';
    v_state:=case when v_complete then 'TEXT_FILE_SUBMITTED' else 'FILE_SUBMITTED' end;
  else
    v_state:='FILE_SUBMITTED';
    v_complete:=true;
  end if;
  update public.planning_material_request_items
     set submission_state=v_state,
         review_status=case when v_complete and review_status='REQUESTED' then 'RECEIVED' else review_status end,
         updated_by=p_actor_id,updated_at=now()
   where request_item_id=v_item.request_item_id;
  update public.planning_material_requests
     set status=case when status in ('REQUESTED','DRAFT') then 'IN_PROGRESS' else status end,
         updated_by=p_actor_id,updated_at=now()
   where material_request_id=v_item.material_request_id;

  insert into public.media_events(actor_id,media_id,event_type,from_status,to_status,object_key,detail,request_id,metadata)
  values(
    p_actor_id,p_media_id,'PLANNING_MATERIAL_UPLOAD',v_media.status,'REVIEW_REQUIRED',v_media.object_key,
    'Planning material file finalized',p_request_id,
    jsonb_build_object('material_request_id',v_item.material_request_id,'request_item_id',v_item.request_item_id,'version_id',v_ver.version_id,'response_kind',v_kind)
  ) returning event_id into v_event_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.file.finalize','PLANNING_MATERIAL_FILE',v_file.material_file_id,
    '파일 revision 업로드 완료',p_request_id,
    jsonb_build_object('version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'media_event_id',v_event_id,'response_kind',v_kind,'complete',v_complete)
  );
  return jsonb_build_object('material_file_id',v_file.material_file_id,'version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'submission_state',v_state,'complete',v_complete,'idempotent',false);
end $$;

create or replace function public.code1_material_manifest(p_actor_id text,p_material_request_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_r public.planning_material_requests%rowtype; v_items jsonb;
begin
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW')) then raise exception 'FORBIDDEN'; end if;
  select * into v_r from public.planning_material_requests where material_request_id=p_material_request_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_item_id',i.request_item_id,'item_key',i.item_key,'item_label_snapshot',i.label_snapshot,
    'response_kind_snapshot',i.response_kind_snapshot,'required_snapshot',i.required_snapshot,
    'item_state',i.submission_state,'review_state',i.review_status,'classification_hint',i.classification_hint,
    'files',coalesce((
      select jsonb_agg(jsonb_build_object(
        'material_file_id',f.material_file_id,'version_id',v.version_id,'revision',v.revision,
        'media_id',m.media_id,'object_key',m.object_key,'original_file_name',m.original_file_name,
        'sha256',m.checksum_sha256,'mime',m.mime_type,'size',m.file_size_bytes,
        'confidentiality',v.confidentiality,'rights_use_state',v.rights_use_state,
        'public_delivery_allowed',v.public_delivery_allowed,'current',v.is_current,
        'supersedes_version_id',v.supersedes_version_id
      ) order by f.material_file_id,v.revision)
      from public.planning_material_files f
      join public.planning_material_file_versions v on v.material_file_id=f.material_file_id
      join public.media_assets m on m.media_id=v.media_id
      where f.request_item_id=i.request_item_id
    ),'[]'::jsonb)
  ) order by i.sort_order_snapshot,i.item_key),'[]'::jsonb)
  into v_items
  from public.planning_material_request_items i where i.material_request_id=p_material_request_id;
  return jsonb_build_object(
    'manifest_version',2,'material_request_id',v_r.material_request_id,'title',v_r.title,
    'counterparty',v_r.counterparty,'product_snapshot',v_r.product_snapshot,'purpose',v_r.purpose,
    'status',v_r.status,'review_status',v_r.review_status,'revision',v_r.revision,
    'template_id',v_r.template_id,'template_revision',v_r.template_revision,'items',v_items
  );
end $$;

create or replace function public.code1_material_submit_request(p_actor_id text,p_material_request_id text,p_target_status text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_r public.planning_material_requests%rowtype;
  v_internal boolean;
  v_manifest jsonb;
  v_hash text;
  v_event_id text;
  v_outbox_id text;
  v_event_key text;
  v_artifact_id text;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' or p_target_status not in ('SUBMITTED','READY_FOR_REVIEW') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_r from public.planning_material_requests where material_request_id=p_material_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_internal:=public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW');
  if not v_internal and not public.code1_material_assigned(p_actor_id,p_material_request_id) then raise exception 'FORBIDDEN'; end if;
  if p_target_status='READY_FOR_REVIEW' and not v_internal then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.audit_log where actor_id=p_actor_id and action='planning.material.request.submit' and request_id=p_request_id) then
    select event_id into v_event_id from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id=p_material_request_id and action='planning.material.request.'||lower(p_target_status) order by recorded_at desc limit 1;
    return jsonb_build_object('material_request_id',p_material_request_id,'status',v_r.status,'manifest_revision',v_r.manifest_revision,'ops_event_id',v_event_id,'idempotent',true);
  end if;
  if v_r.status=p_target_status and v_r.manifest_revision>0 then
    select event_id into v_event_id from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id=p_material_request_id and action='planning.material.request.'||lower(p_target_status) order by recorded_at desc limit 1;
    return jsonb_build_object('material_request_id',p_material_request_id,'status',v_r.status,'manifest_revision',v_r.manifest_revision,'ops_event_id',v_event_id,'idempotent',true,'deduplicated',true);
  end if;

  -- Legacy request snapshots (response_kind_snapshot IS NULL) keep the old permissive contract.
  if exists(
    select 1
    from public.planning_material_request_items i
    where i.material_request_id=p_material_request_id
      and i.required_snapshot
      and i.response_kind_snapshot is not null
      and i.submission_state not in ('LATER','NO_MATERIAL','NOT_APPLICABLE')
      and (
        (i.response_kind_snapshot in ('TEXT','LONG_TEXT') and btrim(coalesce(i.memo,''))='')
        or (i.response_kind_snapshot='FILE' and not exists(
          select 1 from public.planning_material_files f
          join public.planning_material_file_versions fv on fv.version_id=f.current_version_id and fv.is_current
          where f.request_item_id=i.request_item_id and f.status='ACTIVE' and fv.version_state='CURRENT_CANDIDATE'
        ))
        or (i.response_kind_snapshot='TEXT_FILE' and (
          btrim(coalesce(i.memo,''))='' or not exists(
            select 1 from public.planning_material_files f
            join public.planning_material_file_versions fv on fv.version_id=f.current_version_id and fv.is_current
            where f.request_item_id=i.request_item_id and f.status='ACTIVE' and fv.version_state='CURRENT_CANDIDATE'
          )
        ))
      )
  ) then raise exception 'REQUIRED_MATERIAL_INCOMPLETE'; end if;

  update public.planning_material_requests
     set status=p_target_status,submitted_at=coalesce(submitted_at,now()),review_status='RECEIVED',
         revision=revision+1,manifest_revision=manifest_revision+1,manifest_ready_at=now(),
         updated_by=p_actor_id,updated_at=now()
   where material_request_id=p_material_request_id returning * into v_r;
  select public.code1_material_manifest(case when v_internal then p_actor_id else 'OWNER' end,p_material_request_id) into v_manifest;
  v_hash:=public.code1_ops_hash_json(v_manifest);
  v_artifact_id:='PMA_'||regexp_replace(p_material_request_id,'[^A-Za-z0-9]','','g');
  insert into public.planning_source_artifacts(artifact_id,source_type,source_ref,title,confidentiality,object_key,public_delivery_allowed,metadata,created_at,updated_at)
  values(v_artifact_id,'PLANNING_MATERIAL_MANIFEST',p_material_request_id,v_r.title,'INTERNAL_CONFIDENTIAL',null,false,jsonb_build_object('manifest_revision',v_r.manifest_revision,'sha256',v_hash,'purpose',v_r.purpose),now(),now())
  on conflict(artifact_id) do update set title=excluded.title,metadata=excluded.metadata,updated_at=now(),public_delivery_allowed=false;
  v_event_key:=md5('planning-material:'||p_material_request_id||':'||p_target_status||':'||v_hash);
  select event_id into v_event_id from public.ops_change_events where idempotency_key=v_event_key;
  if v_event_id is null then
    v_event_id:='OCE_'||replace(gen_random_uuid()::text,'-','');
    v_outbox_id:='OOB_'||replace(gen_random_uuid()::text,'-','');
    insert into public.ops_change_events(
      event_id,source_system,source_version,entity_type,entity_id,action,changed_fields,before_hash,after_hash,
      actor_ref,event_class,planning_relevance,suggested_tracks,evidence_refs,correlation_id,causation_id,
      idempotency_key,payload_hash,priority,result_json,relay_status
    ) values(
      v_event_id,'TEMP_ADMIN','PLANNING_MATERIAL_v2','PLANNING_MATERIAL_REQUEST',p_material_request_id,
      'planning.material.request.'||lower(p_target_status),array['status','manifest_revision'],null,v_hash,p_actor_id,
      'PLANNING_IMPACT',true,array['PLANNING'],
      jsonb_build_array(jsonb_build_object('kind','manifest','ref',p_material_request_id,'sha256',v_hash,'version',v_r.manifest_revision::text,'source','SUPABASE_STAGING')),
      v_event_id,null,v_event_key,v_hash,'P1',
      jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision),
      'RECORDED'
    );
    insert into public.ops_outbox(outbox_id,event_id,delivery_state,idempotency_key,dedupe_key)
    values(v_outbox_id,v_event_id,'PENDING','OB_'||v_event_key,'PM_'||p_material_request_id||'_'||p_target_status||'_'||v_hash);
  end if;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.request.submit','PLANNING_MATERIAL_REQUEST',p_material_request_id,
    '자료 package 제출/검토준비',p_request_id,
    jsonb_build_object('status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id)
  );
  return jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id,'idempotent',false);
end $$;

revoke all on function public.code1_material_publish_template(text,text,integer,text) from public,anon,authenticated;
revoke all on function public.code1_material_guard_file_response_kind() from public,anon,authenticated;
revoke all on function public.code1_material_save_template(text,text,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.code1_material_create_request(text,text,text,jsonb,text,text,text,text[],text) from public,anon,authenticated;
revoke all on function public.code1_material_set_item_submission(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_finalize_file_version(text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_manifest(text,text) from public,anon,authenticated;
revoke all on function public.code1_material_submit_request(text,text,text,text) from public,anon,authenticated;

grant execute on function public.code1_material_publish_template(text,text,integer,text) to service_role;
grant execute on function public.code1_material_save_template(text,text,integer,jsonb,text) to service_role;
grant execute on function public.code1_material_create_request(text,text,text,jsonb,text,text,text,text[],text) to service_role;
grant execute on function public.code1_material_set_item_submission(text,text,text,text,text) to service_role;
grant execute on function public.code1_material_finalize_file_version(text,text,text) to service_role;
grant execute on function public.code1_material_manifest(text,text) to service_role;
grant execute on function public.code1_material_submit_request(text,text,text,text) to service_role;

commit;
