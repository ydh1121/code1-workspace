-- CODE1 Internal Workspace / STAGING ONLY
-- Planning Material Workspace REV B / Delta 20260913-041.
-- Separate from farm intake/questionnaire. Supabase = structured authority; private R2 = bytes.
-- No Production, public R2, Drive hot-path dual-write, auto-publication or auto-approval.

begin;

-- External planning-material contributors must not be disguised as FARMER or ADMIN.
alter table public.workspace_accounts drop constraint if exists workspace_accounts_role_check;
alter table public.workspace_accounts add constraint workspace_accounts_role_check
  check (role in ('SUPER_ADMIN','ADMIN','FARMER','PARTNER'));

alter table public.account_capabilities drop constraint if exists account_capabilities_capability_check;
alter table public.account_capabilities add constraint account_capabilities_capability_check check (capability in (
  'EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT','ACCESS_PROFILE_INITIALIZED',
  'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_PLANNING_MATERIALS','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
  'FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT','PLANNING_EDIT','PLANNING_FEEDBACK',
  'MATERIAL_REQUEST_MANAGE','MATERIAL_REVIEW','MATERIAL_TEMPLATE_MANAGE','MATERIAL_UPLOAD_ASSIGNED',
  'ACCOUNT_MANAGE','INPUT_POLICY_MANAGE'
));

create table public.planning_material_templates (
  template_id text primary key,
  name text not null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED')),
  current_revision integer not null default 1 check(current_revision > 0),
  created_by text references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now()
);

create table public.planning_material_template_items (
  template_id text not null references public.planning_material_templates(template_id),
  item_key text not null,
  label text not null,
  description text not null default '',
  required boolean not null default true,
  sort_order integer not null check(sort_order > 0),
  active boolean not null default true,
  archived_at timestamptz,
  classification_hint text not null default '10_기타',
  created_at timestamptz not null default now(),
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now(),
  primary key(template_id,item_key),
  check(item_key ~ '^[A-Z0-9_:-]{1,80}$'),
  check(char_length(label) between 1 and 300),
  check(classification_hint in (
    '01_사업자_법인','02_상품_패키지_표시','03_농장_생산자_사육환경','04_인증_검사_성적서',
    '05_사료_급이','06_선별_포장_물류','07_공급_납품_가격_INTERNAL','08_사진_영상_원본',
    '09_브랜드_로고_소개자료','10_기타'
  ))
);
create index planning_material_template_items_order_idx
  on public.planning_material_template_items(template_id,active desc,sort_order,item_key);

create table public.planning_material_template_revisions (
  template_id text not null references public.planning_material_templates(template_id),
  revision integer not null check(revision > 0),
  items_snapshot jsonb not null check(jsonb_typeof(items_snapshot)='array'),
  actor_id text references public.workspace_accounts(account_id),
  request_id text not null,
  created_at timestamptz not null default now(),
  primary key(template_id,revision),
  unique(template_id,request_id)
);

create table public.planning_material_requests (
  material_request_id text primary key,
  title text not null,
  counterparty text not null,
  product_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(product_snapshot)='object'),
  purpose text not null check(purpose in ('DETAIL_PAGE','OUTBOUND_SUPPLY_PROPOSAL','BOTH','OTHER')),
  requester_id text not null references public.workspace_accounts(account_id),
  farm_id text references public.farms(farm_id),
  status text not null default 'REQUESTED' check(status in ('DRAFT','REQUESTED','IN_PROGRESS','SUBMITTED','READY_FOR_REVIEW','REVIEWING','COMPLETED','ARCHIVED')),
  review_status text not null default 'REQUESTED' check(review_status in ('REQUESTED','RECEIVED','NEEDS_INFO','VERIFIED','REJECTED','SUPERSEDED')),
  revision integer not null default 1 check(revision > 0),
  template_id text not null references public.planning_material_templates(template_id),
  template_revision integer not null check(template_revision > 0),
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  manifest_revision integer not null default 0 check(manifest_revision >= 0),
  manifest_ready_at timestamptz,
  created_by text not null references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now(),
  source_request_id text not null unique
);
create index planning_material_requests_status_idx on public.planning_material_requests(status,updated_at desc);
create index planning_material_requests_counterparty_idx on public.planning_material_requests(counterparty,updated_at desc);

create table public.planning_material_request_items (
  request_item_id text primary key,
  material_request_id text not null references public.planning_material_requests(material_request_id) on delete cascade,
  item_key text not null,
  label_snapshot text not null,
  description_snapshot text not null default '',
  required_snapshot boolean not null,
  sort_order_snapshot integer not null,
  template_revision integer not null,
  classification_hint text not null,
  submission_state text not null default 'MISSING' check(submission_state in ('MISSING','FILE_SUBMITTED','LATER','NO_MATERIAL','NOT_APPLICABLE')),
  review_status text not null default 'REQUESTED' check(review_status in ('REQUESTED','RECEIVED','NEEDS_INFO','VERIFIED','REJECTED','SUPERSEDED')),
  memo text not null default '',
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now(),
  unique(material_request_id,item_key)
);
create index planning_material_request_items_order_idx on public.planning_material_request_items(material_request_id,sort_order_snapshot,item_key);

create table public.planning_material_request_assignees (
  material_request_id text not null references public.planning_material_requests(material_request_id) on delete cascade,
  account_id text not null references public.workspace_accounts(account_id),
  assignment_role text not null default 'UPLOADER' check(assignment_role='UPLOADER'),
  active boolean not null default true,
  assigned_by text not null references public.workspace_accounts(account_id),
  assigned_at timestamptz not null default now(),
  primary key(material_request_id,account_id)
);
create index planning_material_assignee_account_idx on public.planning_material_request_assignees(account_id,active,material_request_id);

create table public.planning_material_files (
  material_file_id text primary key,
  request_item_id text not null references public.planning_material_request_items(request_item_id) on delete cascade,
  current_revision integer not null default 0 check(current_revision >= 0),
  current_version_id text,
  pending_version_id text,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED')),
  created_by text not null references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_material_files_item_idx on public.planning_material_files(request_item_id,status,created_at);

create table public.planning_material_file_versions (
  version_id text primary key,
  material_file_id text not null references public.planning_material_files(material_file_id) on delete cascade,
  revision integer not null check(revision > 0),
  media_id text not null unique references public.media_assets(media_id),
  supersedes_version_id text references public.planning_material_file_versions(version_id),
  uploader_id text not null references public.workspace_accounts(account_id),
  confidentiality text not null default 'INTERNAL_RESTRICTED' check(confidentiality in ('INTERNAL_RESTRICTED','INTERNAL_GENERAL')),
  rights_use_state text not null default 'REVIEW_REQUIRED' check(rights_use_state in ('REVIEW_REQUIRED','ALLOWED_INTERNAL','RESTRICTED','REJECTED')),
  public_delivery_allowed boolean not null default false,
  version_state text not null default 'UPLOADING' check(version_state in ('UPLOADING','CURRENT_CANDIDATE','HISTORICAL','REJECTED')),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique(material_file_id,revision),
  check(public_delivery_allowed=false)
);
create index planning_material_file_versions_file_idx on public.planning_material_file_versions(material_file_id,revision desc);

alter table public.planning_material_files
  add constraint planning_material_files_current_version_fkey foreign key(current_version_id) references public.planning_material_file_versions(version_id),
  add constraint planning_material_files_pending_version_fkey foreign key(pending_version_id) references public.planning_material_file_versions(version_id);

-- Fail closed at the database boundary. Browser roles never access these tables/RPCs directly.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'planning_material_templates','planning_material_template_items','planning_material_template_revisions',
    'planning_material_requests','planning_material_request_items','planning_material_request_assignees',
    'planning_material_files','planning_material_file_versions'
  ] LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
    EXECUTE format('revoke all on table public.%I from public,anon,authenticated',t);
    EXECUTE format('grant select,insert,update,delete on table public.%I to service_role',t);
  END LOOP;
END $$;

create or replace function public.code1_material_has_cap(p_actor_id text,p_capability text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and ((a.account_id='OWNER' and a.role='SUPER_ADMIN') or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability=p_capability and c.effect='ALLOW'
      ))
  )
$$;

create or replace function public.code1_material_assigned(p_actor_id text,p_material_request_id text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.code1_material_has_cap(p_actor_id,'MATERIAL_UPLOAD_ASSIGNED') and exists(
    select 1 from public.planning_material_request_assignees a
    where a.material_request_id=p_material_request_id and a.account_id=p_actor_id and a.active
  )
$$;

-- Owner-only full template replacement. Missing prior items are archived, never physically deleted.
create or replace function public.code1_material_save_template(
  p_actor_id text,p_template_id text,p_base_revision integer,p_items jsonb,p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_t public.planning_material_templates%rowtype; v_next integer; v_before jsonb; v_after jsonb; v_item jsonb; v_key text;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_TEMPLATE_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_template_id)::bigint);
  if exists(select 1 from public.planning_material_template_revisions r where r.template_id=p_template_id and r.request_id=p_request_id) then
    select current_revision into v_next from public.planning_material_templates where template_id=p_template_id;
    return jsonb_build_object('template_id',p_template_id,'revision',v_next,'idempotent',true);
  end if;
  select * into v_t from public.planning_material_templates where template_id=p_template_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.current_revision<>p_base_revision then raise exception 'CONFLICT'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where nullif(btrim(x->>'item_key'),'') is null or nullif(btrim(x->>'label'),'') is null) then raise exception 'INVALID_TEMPLATE'; end if;
  if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'item_key') from jsonb_array_elements(p_items) x) then raise exception 'INVALID_TEMPLATE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_key',i.item_key,'label',i.label,'description',i.description,'required',i.required,'sort_order',i.sort_order,'active',i.active,'classification_hint',i.classification_hint) order by i.sort_order,i.item_key),'[]'::jsonb)
    into v_before from public.planning_material_template_items i where i.template_id=p_template_id;
  update public.planning_material_template_items set active=false,archived_at=coalesce(archived_at,now()),updated_by=p_actor_id,updated_at=now() where template_id=p_template_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key:=upper(btrim(v_item->>'item_key'));
    if v_key !~ '^[A-Z0-9_:-]{1,80}$' or coalesce((v_item->>'sort_order')::integer,0)<=0 then raise exception 'INVALID_TEMPLATE'; end if;
    insert into public.planning_material_template_items(template_id,item_key,label,description,required,sort_order,active,archived_at,classification_hint,updated_by,updated_at)
    values(p_template_id,v_key,left(btrim(v_item->>'label'),300),left(coalesce(v_item->>'description',''),2000),coalesce((v_item->>'required')::boolean,true),(v_item->>'sort_order')::integer,coalesce((v_item->>'active')::boolean,true),case when coalesce((v_item->>'active')::boolean,true) then null else now() end,coalesce(nullif(v_item->>'classification_hint',''),'10_기타'),p_actor_id,now())
    on conflict(template_id,item_key) do update set label=excluded.label,description=excluded.description,required=excluded.required,sort_order=excluded.sort_order,active=excluded.active,archived_at=excluded.archived_at,classification_hint=excluded.classification_hint,updated_by=p_actor_id,updated_at=now();
  end loop;
  v_next:=v_t.current_revision+1;
  update public.planning_material_templates set current_revision=v_next,updated_by=p_actor_id,updated_at=now() where template_id=p_template_id;
  select coalesce(jsonb_agg(jsonb_build_object('item_key',i.item_key,'label',i.label,'description',i.description,'required',i.required,'sort_order',i.sort_order,'active',i.active,'classification_hint',i.classification_hint) order by i.sort_order,i.item_key),'[]'::jsonb)
    into v_after from public.planning_material_template_items i where i.template_id=p_template_id;
  insert into public.planning_material_template_revisions(template_id,revision,items_snapshot,actor_id,request_id) values(p_template_id,v_next,v_after,p_actor_id,p_request_id);
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.material.template.save','PLANNING_MATERIAL_TEMPLATE',p_template_id,'업로드 항목 template revision 저장',p_request_id,jsonb_build_object('before',v_before,'after',v_after,'revision',v_next));
  return jsonb_build_object('template_id',p_template_id,'revision',v_next,'items',v_after,'idempotent',false);
end $$;

create or replace function public.code1_material_create_request(
  p_actor_id text,p_title text,p_counterparty text,p_product_snapshot jsonb,p_purpose text,p_farm_id text,p_template_id text,p_assignees text[],p_request_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id text; v_t public.planning_material_templates%rowtype; v_actor text; v_count integer;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or nullif(btrim(coalesce(p_title,'')),'') is null or nullif(btrim(coalesce(p_counterparty,'')),'') is null or p_purpose not in ('DETAIL_PAGE','OUTBOUND_SUPPLY_PROPOSAL','BOTH','OTHER') then raise exception 'INVALID_REQUEST'; end if;
  select material_request_id into v_id from public.planning_material_requests where source_request_id=p_request_id;
  if found then return jsonb_build_object('material_request_id',v_id,'idempotent',true); end if;
  select * into v_t from public.planning_material_templates where template_id=p_template_id and status='ACTIVE'; if not found then raise exception 'NOT_FOUND'; end if;
  if p_farm_id is not null and not exists(select 1 from public.farms where farm_id=p_farm_id) then raise exception 'INVALID_FARM'; end if;
  if exists(select 1 from unnest(coalesce(p_assignees,array[]::text[])) x left join public.workspace_accounts a on a.account_id=x where a.account_id is null or a.status<>'active' or a.archived_at is not null) then raise exception 'INVALID_ASSIGNEE'; end if;
  v_id:='PMR_'||replace(gen_random_uuid()::text,'-','');
  insert into public.planning_material_requests(material_request_id,title,counterparty,product_snapshot,purpose,requester_id,farm_id,status,review_status,revision,template_id,template_revision,created_by,updated_by,source_request_id)
  values(v_id,left(btrim(p_title),240),left(btrim(p_counterparty),240),coalesce(p_product_snapshot,'{}'::jsonb),p_purpose,p_actor_id,p_farm_id,'REQUESTED','REQUESTED',1,p_template_id,v_t.current_revision,p_actor_id,p_actor_id,p_request_id);
  insert into public.planning_material_request_items(request_item_id,material_request_id,item_key,label_snapshot,description_snapshot,required_snapshot,sort_order_snapshot,template_revision,classification_hint)
  select 'PMI_'||replace(gen_random_uuid()::text,'-',''),v_id,i.item_key,i.label,i.description,i.required,i.sort_order,v_t.current_revision,i.classification_hint
  from public.planning_material_template_items i where i.template_id=p_template_id and i.active order by i.sort_order,i.item_key;
  get diagnostics v_count=row_count; if v_count=0 then raise exception 'EMPTY_TEMPLATE'; end if;
  foreach v_actor in array coalesce(p_assignees,array[]::text[]) loop
    insert into public.planning_material_request_assignees(material_request_id,account_id,assigned_by) values(v_id,v_actor,p_actor_id) on conflict do nothing;
  end loop;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.material.request.create','PLANNING_MATERIAL_REQUEST',v_id,'자료요청 package 생성',p_request_id,jsonb_build_object('template_id',p_template_id,'template_revision',v_t.current_revision,'item_count',v_count,'assignees',coalesce(to_jsonb(p_assignees),'[]'::jsonb)));
  return jsonb_build_object('material_request_id',v_id,'item_count',v_count,'template_revision',v_t.current_revision,'idempotent',false);
end $$;

create or replace function public.code1_material_assign_uploaders(p_actor_id text,p_material_request_id text,p_assignees text[],p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_before jsonb; v_after jsonb; v_id text;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if not exists(select 1 from public.planning_material_requests where material_request_id=p_material_request_id) then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(account_id order by account_id),'[]'::jsonb) into v_before from public.planning_material_request_assignees where material_request_id=p_material_request_id and active;
  update public.planning_material_request_assignees set active=false where material_request_id=p_material_request_id;
  foreach v_id in array coalesce(p_assignees,array[]::text[]) loop
    if not exists(select 1 from public.workspace_accounts where account_id=v_id and status='active' and archived_at is null) then raise exception 'INVALID_ASSIGNEE'; end if;
    insert into public.planning_material_request_assignees(material_request_id,account_id,active,assigned_by,assigned_at) values(p_material_request_id,v_id,true,p_actor_id,now()) on conflict(material_request_id,account_id) do update set active=true,assigned_by=p_actor_id,assigned_at=now();
  end loop;
  select coalesce(jsonb_agg(account_id order by account_id),'[]'::jsonb) into v_after from public.planning_material_request_assignees where material_request_id=p_material_request_id and active;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.assignment.save','PLANNING_MATERIAL_REQUEST',p_material_request_id,'자료 제출자 배정',p_request_id,jsonb_build_object('before',v_before,'after',v_after));
  return jsonb_build_object('material_request_id',p_material_request_id,'assignees',v_after);
end $$;

create or replace function public.code1_material_set_item_submission(p_actor_id text,p_request_item_id text,p_submission_state text,p_memo text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.planning_material_request_items%rowtype; v_before jsonb; v_internal boolean;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' or p_submission_state not in ('MISSING','FILE_SUBMITTED','LATER','NO_MATERIAL','NOT_APPLICABLE') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_item from public.planning_material_request_items where request_item_id=p_request_item_id for update; if not found then raise exception 'NOT_FOUND'; end if;
  v_internal:=public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW');
  if not v_internal and not public.code1_material_assigned(p_actor_id,v_item.material_request_id) then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.audit_log where actor_id=p_actor_id and action='planning.material.item.submit' and request_id=p_request_id) then return jsonb_build_object('request_item_id',p_request_item_id,'idempotent',true); end if;
  v_before:=jsonb_build_object('submission_state',v_item.submission_state,'memo',v_item.memo,'review_status',v_item.review_status);
  update public.planning_material_request_items set submission_state=p_submission_state,memo=left(coalesce(p_memo,''),8000),review_status=case when p_submission_state='FILE_SUBMITTED' and review_status='REQUESTED' then 'RECEIVED' else review_status end,updated_by=p_actor_id,updated_at=now() where request_item_id=p_request_item_id;
  update public.planning_material_requests set status=case when status in ('REQUESTED','DRAFT') then 'IN_PROGRESS' else status end,updated_by=p_actor_id,updated_at=now() where material_request_id=v_item.material_request_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.item.submit','PLANNING_MATERIAL_ITEM',p_request_item_id,'자료 항목 제출상태/메모 변경',p_request_id,jsonb_build_object('before',v_before,'after',jsonb_build_object('submission_state',p_submission_state,'memo',left(coalesce(p_memo,''),8000))));
  return jsonb_build_object('request_item_id',p_request_item_id,'submission_state',p_submission_state,'idempotent',false);
end $$;

create or replace function public.code1_material_begin_file_version(p_actor_id text,p_request_item_id text,p_material_file_id text,p_media jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.planning_material_request_items%rowtype; v_file public.planning_material_files%rowtype; v_file_id text; v_version_id text; v_revision integer; v_existing text;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_media)<>'object' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_item from public.planning_material_request_items where request_item_id=p_request_item_id; if not found then raise exception 'NOT_FOUND'; end if;
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') or public.code1_material_assigned(p_actor_id,v_item.material_request_id)) then raise exception 'FORBIDDEN'; end if;
  select media_id into v_existing from public.media_assets where uploaded_by=p_actor_id and request_id=p_request_id and source_storage='R2_PRIVATE';
  if found then
    select f.material_file_id,v.version_id,v.revision into v_file_id,v_version_id,v_revision from public.planning_material_file_versions v join public.planning_material_files f on f.material_file_id=v.material_file_id where v.media_id=v_existing;
    return jsonb_build_object('material_file_id',v_file_id,'version_id',v_version_id,'revision',v_revision,'media_id',v_existing,'idempotent',true);
  end if;
  if coalesce(p_media->>'media_id','')='' or coalesce(p_media->>'object_key','')='' or coalesce(p_media->>'original_file_name','')='' or coalesce(p_media->>'mime_type','')='' or coalesce(p_media->>'checksum_sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_MEDIA'; end if;
  v_file_id:=nullif(p_material_file_id,'');
  if v_file_id is null then
    v_file_id:='PMF_'||replace(gen_random_uuid()::text,'-','');
    insert into public.planning_material_files(material_file_id,request_item_id,created_by) values(v_file_id,p_request_item_id,p_actor_id);
    select * into v_file from public.planning_material_files where material_file_id=v_file_id for update;
  else
    select * into v_file from public.planning_material_files where material_file_id=v_file_id and request_item_id=p_request_item_id and status='ACTIVE' for update;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  v_revision:=v_file.current_revision+1;
  v_version_id:='PMV_'||replace(gen_random_uuid()::text,'-','');
  insert into public.media_assets(media_id,upload_id,submission_id,farm_id,media_group,shot_code,shot_label,original_file_name,object_key,mime_type,file_size_bytes,checksum_sha256,rights_owner,b2b_use,status,request_id,uploaded_by,source_storage,r2_multipart_upload_id,upload_chunk_bytes,upload_received_bytes,upload_parts)
  values(p_media->>'media_id',p_media->>'media_id',null,null,'PLANNING_MATERIAL',v_item.item_key,v_item.label_snapshot,left(p_media->>'original_file_name',255),p_media->>'object_key',left(p_media->>'mime_type',120),(p_media->>'file_size_bytes')::bigint,p_media->>'checksum_sha256',left(coalesce(p_media->>'rights_owner',''),500),left(coalesce(p_media->>'rights_use_state','REVIEW_REQUIRED'),120),'UPLOADING',p_request_id,p_actor_id,'R2_PRIVATE',p_media->>'r2_multipart_upload_id',(p_media->>'upload_chunk_bytes')::integer,0,'[]'::jsonb);
  insert into public.planning_material_file_versions(version_id,material_file_id,revision,media_id,supersedes_version_id,uploader_id,confidentiality,rights_use_state,public_delivery_allowed,version_state,is_current)
  values(v_version_id,v_file_id,v_revision,p_media->>'media_id',v_file.current_version_id,p_actor_id,'INTERNAL_RESTRICTED',coalesce(nullif(p_media->>'rights_use_state',''),'REVIEW_REQUIRED'),false,'UPLOADING',false);
  update public.planning_material_files set pending_version_id=v_version_id,updated_at=now() where material_file_id=v_file_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.file.begin','PLANNING_MATERIAL_FILE',v_file_id,'비공개 R2 파일 revision 업로드 시작',p_request_id,jsonb_build_object('version_id',v_version_id,'revision',v_revision,'media_id',p_media->>'media_id','mime',p_media->>'mime_type','size',(p_media->>'file_size_bytes')::bigint,'sha256',p_media->>'checksum_sha256'));
  return jsonb_build_object('material_file_id',v_file_id,'version_id',v_version_id,'revision',v_revision,'media_id',p_media->>'media_id','idempotent',false);
end $$;

create or replace function public.code1_material_finalize_file_version(p_actor_id text,p_media_id text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ver public.planning_material_file_versions%rowtype; v_file public.planning_material_files%rowtype; v_item public.planning_material_request_items%rowtype;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_ver from public.planning_material_file_versions where media_id=p_media_id for update; if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_file from public.planning_material_files where material_file_id=v_ver.material_file_id for update;
  select * into v_item from public.planning_material_request_items where request_item_id=v_file.request_item_id for update;
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') or public.code1_material_assigned(p_actor_id,v_item.material_request_id)) then raise exception 'FORBIDDEN'; end if;
  if v_ver.version_state='CURRENT_CANDIDATE' and v_ver.is_current then return jsonb_build_object('material_file_id',v_file.material_file_id,'version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'idempotent',true); end if;
  if v_file.pending_version_id<>v_ver.version_id then raise exception 'CONFLICT'; end if;
  update public.planning_material_file_versions set is_current=false,version_state=case when version_state='CURRENT_CANDIDATE' then 'HISTORICAL' else version_state end where material_file_id=v_file.material_file_id and is_current;
  update public.planning_material_file_versions set is_current=true,version_state='CURRENT_CANDIDATE' where version_id=v_ver.version_id;
  update public.planning_material_files set current_revision=v_ver.revision,current_version_id=v_ver.version_id,pending_version_id=null,updated_at=now() where material_file_id=v_file.material_file_id;
  update public.media_assets set status='REVIEW_REQUIRED',review_note=null where media_id=p_media_id;
  update public.planning_material_request_items set submission_state='FILE_SUBMITTED',review_status=case when review_status='REQUESTED' then 'RECEIVED' else review_status end,updated_by=p_actor_id,updated_at=now() where request_item_id=v_item.request_item_id;
  update public.planning_material_requests set status=case when status in ('REQUESTED','DRAFT') then 'IN_PROGRESS' else status end,updated_by=p_actor_id,updated_at=now() where material_request_id=v_item.material_request_id;
  insert into public.media_events(actor_id,media_id,event_type,from_status,to_status,object_key,detail,request_id,metadata)
    select p_actor_id,m.media_id,'PLANNING_MATERIAL_UPLOAD',m.status,'REVIEW_REQUIRED',m.object_key,'Planning material file finalized',p_request_id,jsonb_build_object('material_request_id',v_item.material_request_id,'request_item_id',v_item.request_item_id,'version_id',v_ver.version_id) from public.media_assets m where m.media_id=p_media_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.file.finalize','PLANNING_MATERIAL_FILE',v_file.material_file_id,'파일 revision 업로드 완료',p_request_id,jsonb_build_object('version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id));
  return jsonb_build_object('material_file_id',v_file.material_file_id,'version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'idempotent',false);
end $$;

create or replace function public.code1_material_review_item(p_actor_id text,p_request_item_id text,p_review_status text,p_note text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.planning_material_request_items%rowtype;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or p_review_status not in ('REQUESTED','RECEIVED','NEEDS_INFO','VERIFIED','REJECTED','SUPERSEDED') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_item from public.planning_material_request_items where request_item_id=p_request_item_id for update; if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.review_decisions where subject_type='PLANNING_MATERIAL_ITEM' and subject_id=p_request_item_id and request_id=p_request_id) then return jsonb_build_object('request_item_id',p_request_item_id,'review_status',v_item.review_status,'idempotent',true); end if;
  update public.planning_material_request_items set review_status=p_review_status,updated_by=p_actor_id,updated_at=now() where request_item_id=p_request_item_id;
  insert into public.review_decisions(subject_type,subject_id,old_status,new_status,note,actor_id,request_id) values('PLANNING_MATERIAL_ITEM',p_request_item_id,v_item.review_status,p_review_status,left(coalesce(p_note,''),4000),p_actor_id,p_request_id);
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.item.review','PLANNING_MATERIAL_ITEM',p_request_item_id,'자료 항목 검토 상태 변경',p_request_id,jsonb_build_object('before',v_item.review_status,'after',p_review_status,'note',left(coalesce(p_note,''),4000)));
  return jsonb_build_object('request_item_id',p_request_item_id,'review_status',p_review_status,'idempotent',false);
end $$;

create or replace function public.code1_material_manifest(p_actor_id text,p_material_request_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_r public.planning_material_requests%rowtype; v_items jsonb;
begin
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW')) then raise exception 'FORBIDDEN'; end if;
  select * into v_r from public.planning_material_requests where material_request_id=p_material_request_id; if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_item_id',i.request_item_id,'item_key',i.item_key,'item_label_snapshot',i.label_snapshot,'item_state',i.submission_state,'review_state',i.review_status,'classification_hint',i.classification_hint,
    'files',coalesce((select jsonb_agg(jsonb_build_object('material_file_id',f.material_file_id,'version_id',v.version_id,'revision',v.revision,'media_id',m.media_id,'object_key',m.object_key,'original_file_name',m.original_file_name,'sha256',m.checksum_sha256,'mime',m.mime_type,'size',m.file_size_bytes,'confidentiality',v.confidentiality,'rights_use_state',v.rights_use_state,'public_delivery_allowed',v.public_delivery_allowed,'current',v.is_current,'supersedes_version_id',v.supersedes_version_id) order by f.material_file_id,v.revision) from public.planning_material_files f join public.planning_material_file_versions v on v.material_file_id=f.material_file_id join public.media_assets m on m.media_id=v.media_id where f.request_item_id=i.request_item_id),'[]'::jsonb)
  ) order by i.sort_order_snapshot,i.item_key),'[]'::jsonb) into v_items from public.planning_material_request_items i where i.material_request_id=p_material_request_id;
  return jsonb_build_object('manifest_version',1,'material_request_id',v_r.material_request_id,'title',v_r.title,'counterparty',v_r.counterparty,'product_snapshot',v_r.product_snapshot,'purpose',v_r.purpose,'status',v_r.status,'review_status',v_r.review_status,'revision',v_r.revision,'template_id',v_r.template_id,'template_revision',v_r.template_revision,'items',v_items);
end $$;

create or replace function public.code1_material_submit_request(p_actor_id text,p_material_request_id text,p_target_status text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_r public.planning_material_requests%rowtype; v_internal boolean; v_manifest jsonb; v_hash text; v_event_id text; v_outbox_id text; v_event_key text; v_artifact_id text;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' or p_target_status not in ('SUBMITTED','READY_FOR_REVIEW') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_r from public.planning_material_requests where material_request_id=p_material_request_id for update; if not found then raise exception 'NOT_FOUND'; end if;
  v_internal:=public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW');
  if not v_internal and not public.code1_material_assigned(p_actor_id,p_material_request_id) then raise exception 'FORBIDDEN'; end if;
  if p_target_status='READY_FOR_REVIEW' and not v_internal then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.audit_log where actor_id=p_actor_id and action='planning.material.request.submit' and request_id=p_request_id) then return jsonb_build_object('material_request_id',p_material_request_id,'status',v_r.status,'idempotent',true); end if;
  update public.planning_material_requests set status=p_target_status,submitted_at=coalesce(submitted_at,now()),review_status='RECEIVED',revision=revision+1,manifest_revision=manifest_revision+1,manifest_ready_at=now(),updated_by=p_actor_id,updated_at=now() where material_request_id=p_material_request_id returning * into v_r;
  -- Manifest is Planning-only. Use OWNER solely to call the existing protected manifest helper when actor is an assigned external uploader.
  select public.code1_material_manifest(case when v_internal then p_actor_id else 'OWNER' end,p_material_request_id) into v_manifest;
  v_hash:=public.code1_ops_hash_json(v_manifest);
  v_artifact_id:='PMA_'||regexp_replace(p_material_request_id,'[^A-Za-z0-9]','','g');
  insert into public.planning_source_artifacts(artifact_id,source_type,source_ref,title,confidentiality,object_key,public_delivery_allowed,metadata,created_at,updated_at)
  values(v_artifact_id,'PLANNING_MATERIAL_MANIFEST',p_material_request_id,v_r.title,'INTERNAL_CONFIDENTIAL',null,false,jsonb_build_object('manifest_revision',v_r.manifest_revision,'sha256',v_hash,'purpose',v_r.purpose),now(),now())
  on conflict(artifact_id) do update set title=excluded.title,metadata=excluded.metadata,updated_at=now(),public_delivery_allowed=false;
  v_event_key:=md5('planning-material:'||p_material_request_id||':'||p_target_status||':'||v_r.manifest_revision::text);
  select event_id into v_event_id from public.ops_change_events where idempotency_key=v_event_key;
  if v_event_id is null then
    v_event_id:='OCE_'||replace(gen_random_uuid()::text,'-',''); v_outbox_id:='OOB_'||replace(gen_random_uuid()::text,'-','');
    insert into public.ops_change_events(event_id,source_system,source_version,entity_type,entity_id,action,changed_fields,before_hash,after_hash,actor_ref,event_class,planning_relevance,suggested_tracks,evidence_refs,correlation_id,causation_id,idempotency_key,payload_hash,priority,result_json,relay_status)
    values(v_event_id,'TEMP_ADMIN','PLANNING_MATERIAL_v1','PLANNING_MATERIAL_REQUEST',p_material_request_id,'planning.material.request.'||lower(p_target_status),array['status','manifest_revision'],null,v_hash,p_actor_id,'PLANNING_IMPACT',true,array['PLANNING'],jsonb_build_array(jsonb_build_object('kind','manifest','ref',p_material_request_id,'sha256',v_hash,'version',v_r.manifest_revision::text,'source','SUPABASE_STAGING')),v_event_id,null,v_event_key,v_hash,'P1',jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision),'RECORDED');
    insert into public.ops_outbox(outbox_id,event_id,delivery_state,idempotency_key,dedupe_key) values(v_outbox_id,v_event_id,'PENDING','OB_'||v_event_key,'PM_'||p_material_request_id||'_'||p_target_status||'_'||v_r.manifest_revision::text);
  end if;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'planning.material.request.submit','PLANNING_MATERIAL_REQUEST',p_material_request_id,'자료 package 제출/검토준비',p_request_id,jsonb_build_object('status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id));
  return jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id,'idempotent',false);
end $$;

-- Replace account mutation to admit PARTNER only when OWNER/SUPER_ADMIN is the caller.
create or replace function public.code1_save_account(
  p_actor_id text,p_account_id text,p_base_version integer,p_username text,p_display_name text,p_role text,p_status text,p_permissions jsonb,p_farm_ids text[],p_credential jsonb default null
) returns setof public.workspace_accounts language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor public.workspace_accounts%rowtype; v_old public.workspace_accounts%rowtype; v_exists boolean:=false; v_next_version integer; v_permissions jsonb:=coalesce(p_permissions,'{}'::jsonb); v_farm_ids text[]:=coalesce(p_farm_ids,array[]::text[]); v_hash text; v_salt text; v_iterations integer; v_scheme text;
begin
  if coalesce(p_account_id,'')='' then raise exception 'INVALID_ACCOUNT'; end if;
  select * into v_actor from public.workspace_accounts where account_id=p_actor_id and status='active';
  if not found or v_actor.role not in ('SUPER_ADMIN','ADMIN') then raise exception 'FORBIDDEN'; end if;
  if v_actor.role='SUPER_ADMIN' and v_actor.account_id<>'OWNER' then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('ADMIN','FARMER','PARTNER') or p_status not in ('active','disabled') then raise exception 'INVALID_ACCOUNT'; end if;
  if v_actor.role<>'SUPER_ADMIN' and p_role<>'FARMER' then raise exception 'FORBIDDEN'; end if;
  if p_username is null or p_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' or btrim(coalesce(p_display_name,''))='' then raise exception 'INVALID_ACCOUNT'; end if;
  select * into v_old from public.workspace_accounts where account_id=p_account_id for update; v_exists:=found;
  if v_exists then
    if v_old.account_id='OWNER' or v_old.account_id=v_actor.account_id or coalesce(p_base_version,0)<>v_old.session_version or p_username<>v_old.username then raise exception 'FORBIDDEN'; end if;
    if v_actor.role<>'SUPER_ADMIN' and (v_old.role<>'FARMER' or p_role<>'FARMER') then raise exception 'FORBIDDEN'; end if;
    v_next_version:=v_old.session_version+1;
  else
    if coalesce(p_base_version,0)<>0 then raise exception 'CONFLICT'; end if;
    if exists(select 1 from public.workspace_accounts where username=p_username) then raise exception 'DUPLICATE_USERNAME'; end if;
    v_next_version:=1;
  end if;
  if p_role='FARMER' then
    if coalesce(v_permissions->>'farm','none') not in ('none','view','edit') or coalesce(v_permissions->>'deck','none') not in ('none','view','edit') then raise exception 'INVALID_PERMISSIONS'; end if;
    if coalesce(v_permissions->>'farm','none')<>'none' and cardinality(v_farm_ids)=0 then raise exception 'INVALID_PERMISSIONS'; end if;
    v_permissions:=jsonb_build_object('farm',coalesce(v_permissions->>'farm','none'),'deck',coalesce(v_permissions->>'deck','none'),'farmIds',to_jsonb(v_farm_ids));
  else v_permissions:='{}'::jsonb; v_farm_ids:=array[]::text[]; end if;
  if p_credential is not null then
    v_hash:=p_credential->>'hash';v_salt:=p_credential->>'salt';v_iterations:=nullif(p_credential->>'iterations','')::integer;v_scheme:=p_credential->>'scheme';
    if v_hash !~ '^[a-f0-9]{64}$' or v_salt !~ '^[a-f0-9]{32}$' or v_iterations<>100000 or v_scheme<>'pbkdf2-sha256-pepper-v1' then raise exception 'INVALID_CREDENTIAL'; end if;
  elsif not v_exists then raise exception 'INVALID_CREDENTIAL'; end if;
  if v_exists then update public.workspace_accounts set display_name=left(btrim(p_display_name),80),role=p_role,status=p_status,permissions_json=v_permissions,password_hash=coalesce(v_hash,v_old.password_hash),password_salt=coalesce(v_salt,v_old.password_salt),password_iterations=coalesce(v_iterations,v_old.password_iterations),password_scheme=coalesce(v_scheme,v_old.password_scheme),session_version=v_next_version,updated_at=now() where account_id=p_account_id;
  else insert into public.workspace_accounts(account_id,username,display_name,email,role,status,permissions_json,password_hash,password_salt,password_iterations,password_scheme,session_version) values(p_account_id,p_username,left(btrim(p_display_name),80),'',p_role,p_status,v_permissions,v_hash,v_salt,v_iterations,v_scheme,v_next_version); end if;
  delete from public.farm_access where account_id=p_account_id;
  if p_role='FARMER' and cardinality(v_farm_ids)>0 then insert into public.farm_access(account_id,farm_id,access_level) select p_account_id,x,case when v_permissions->>'farm'='edit' then 'edit' else 'view' end from unnest(v_farm_ids) x; end if;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,metadata) values(v_actor.account_id,case when v_exists then 'account.update' else 'account.create' end,'ACCOUNT',p_account_id,p_role,jsonb_build_object('backend','SUPABASE_STAGING','session_version',v_next_version));
  return query select * from public.workspace_accounts where account_id=p_account_id;
end $$;

create or replace function public.code1_set_account_capabilities(p_actor_id text,p_account_id text,p_capabilities text[],p_request_id text)
returns table(account_id text,session_version integer) language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor public.workspace_accounts%rowtype; v_target public.workspace_accounts%rowtype; v_cap text; v_allowed constant text[]:=array[
  'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_PLANNING_MATERIALS','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
  'FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT','PLANNING_EDIT','PLANNING_FEEDBACK',
  'MATERIAL_REQUEST_MANAGE','MATERIAL_REVIEW','MATERIAL_TEMPLATE_MANAGE','MATERIAL_UPLOAD_ASSIGNED',
  'ACCOUNT_MANAGE','INPUT_POLICY_MANAGE','EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT'];
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_actor from public.workspace_accounts where workspace_accounts.account_id=p_actor_id and status='active' and archived_at is null;
  if not found or v_actor.account_id<>'OWNER' or v_actor.role<>'SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  select * into v_target from public.workspace_accounts where workspace_accounts.account_id=p_account_id for update;
  if not found or v_target.archived_at is not null then raise exception 'NOT_FOUND'; end if;
  if v_target.account_id='OWNER' or v_target.role='SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  foreach v_cap in array coalesce(p_capabilities,array[]::text[]) loop if not(v_cap=any(v_allowed)) then raise exception 'INVALID_CAPABILITY:%',v_cap; end if; end loop;
  delete from public.account_capabilities c where c.account_id=p_account_id and (c.capability='ACCESS_PROFILE_INITIALIZED' or c.capability=any(v_allowed));
  insert into public.account_capabilities(account_id,capability,effect,granted_by,note) values(p_account_id,'ACCESS_PROFILE_INITIALIZED','ALLOW',p_actor_id,'Explicit workspace access profile initialized');
  insert into public.account_capabilities(account_id,capability,effect,granted_by,note) select p_account_id,x,'ALLOW',p_actor_id,'Explicit workspace access profile' from unnest(coalesce(p_capabilities,array[]::text[])) x;
  update public.workspace_accounts set session_version=workspace_accounts.session_version+1,updated_at=now() where workspace_accounts.account_id=p_account_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata) values(p_actor_id,'account.permissions','ACCOUNT',p_account_id,'페이지·기능 권한 저장',p_request_id,jsonb_build_object('capabilities',coalesce(to_jsonb(p_capabilities),'[]'::jsonb),'session_invalidated',true));
  return query select a.account_id,a.session_version from public.workspace_accounts a where a.account_id=p_account_id;
end $$;

-- Initial Great Farm template: exact seven labels, but the domain itself is generic.
insert into public.planning_material_templates(template_id,name,status,current_revision,created_by,updated_by)
values('PMT_GREAT_FARM_DEFAULT','Great Farm 상세페이지·납품제안서 기본 자료','ACTIVE',1,'OWNER','OWNER');
insert into public.planning_material_template_items(template_id,item_key,label,description,required,sort_order,active,classification_hint,updated_by) values
('PMT_GREAT_FARM_DEFAULT','MAT_01_PRODUCT_PACKAGE','현재 상품명, 구성, 패키지 전후면','상품명·구성·패키지 표시를 확인할 수 있는 자료',true,1,true,'02_상품_패키지_표시','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_02_FARM_PRODUCER','현재 생산농장, 사육환경, 생산자','현재 생산농장·사육환경·생산자 자료',true,2,true,'03_농장_생산자_사육환경','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_03_CERTIFICATIONS','동물복지, 무항생제, HACCP 등 현재 인증서','현재 유효한 인증·허가 증빙',true,3,true,'04_인증_검사_성적서','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_04_FEED','JS-3550 또는 실제 급이원료 사양, 급이 방식','실제 급이원료 사양과 급이 방식',true,4,true,'05_사료_급이','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_05_VANADIUM_REPORT','현재 생란 제품과 직접 연결되는 바나듐 분석성적서(단위/시료/lot 포함)','현재 제품과 직접 연결되는 시험성적서',true,5,true,'04_인증_검사_성적서','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_06_LOGISTICS','현재 선별, 포장, 출고, 배송 방식','현재 선별·포장·출고·배송 방식 자료',true,6,true,'06_선별_포장_물류','OWNER'),
('PMT_GREAT_FARM_DEFAULT','MAT_07_BUSINESS_REG','사업자등록증','현재 사업자등록 증빙',true,7,true,'01_사업자_법인','OWNER');
insert into public.planning_material_template_revisions(template_id,revision,items_snapshot,actor_id,request_id)
select 'PMT_GREAT_FARM_DEFAULT',1,jsonb_agg(jsonb_build_object('item_key',item_key,'label',label,'description',description,'required',required,'sort_order',sort_order,'active',active,'classification_hint',classification_hint) order by sort_order),'OWNER','seed-great-farm-v1' from public.planning_material_template_items where template_id='PMT_GREAT_FARM_DEFAULT';

-- Service-role-only functions.
revoke all on function public.code1_material_has_cap(text,text) from public,anon,authenticated;
revoke all on function public.code1_material_assigned(text,text) from public,anon,authenticated;
revoke all on function public.code1_material_save_template(text,text,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.code1_material_create_request(text,text,text,jsonb,text,text,text,text[],text) from public,anon,authenticated;
revoke all on function public.code1_material_assign_uploaders(text,text,text[],text) from public,anon,authenticated;
revoke all on function public.code1_material_set_item_submission(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_begin_file_version(text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.code1_material_finalize_file_version(text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_review_item(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_manifest(text,text) from public,anon,authenticated;
revoke all on function public.code1_material_submit_request(text,text,text,text) from public,anon,authenticated;
grant execute on function public.code1_material_has_cap(text,text) to service_role;
grant execute on function public.code1_material_assigned(text,text) to service_role;
grant execute on function public.code1_material_save_template(text,text,integer,jsonb,text) to service_role;
grant execute on function public.code1_material_create_request(text,text,text,jsonb,text,text,text,text[],text) to service_role;
grant execute on function public.code1_material_assign_uploaders(text,text,text[],text) to service_role;
grant execute on function public.code1_material_set_item_submission(text,text,text,text,text) to service_role;
grant execute on function public.code1_material_begin_file_version(text,text,text,jsonb,text) to service_role;
grant execute on function public.code1_material_finalize_file_version(text,text,text) to service_role;
grant execute on function public.code1_material_review_item(text,text,text,text,text) to service_role;
grant execute on function public.code1_material_manifest(text,text) to service_role;
grant execute on function public.code1_material_submit_request(text,text,text,text) to service_role;

commit;
