-- CODE1 Internal Workspace / STAGING ONLY
-- Versioned planning working copies, executive feedback and explicit workspace access profiles.
-- Do not apply to Production until the Preview QA gate is explicitly approved.

begin;

alter table public.account_capabilities
  drop constraint if exists account_capabilities_capability_check;

alter table public.account_capabilities
  add constraint account_capabilities_capability_check check (capability in (
    'EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT',
    'ACCESS_PROFILE_INITIALIZED',
    'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
    'FARM_EDIT','FARM_REVIEW',
    'DECK_EDIT','DECK_EXPORT',
    'PLANNING_EDIT','PLANNING_FEEDBACK',
    'ACCOUNT_MANAGE','INPUT_POLICY_MANAGE'
  ));

create table if not exists public.planning_documents (
  document_id text primary key,
  title text not null,
  purpose text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  current_revision integer not null default 0 check (current_revision >= 0),
  current_revision_id text,
  source_brief_key text,
  source_brief_version text,
  created_by text references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_document_revisions (
  revision_id text primary key,
  document_id text not null references public.planning_documents(document_id) on delete cascade,
  revision integer not null check (revision > 0),
  title text not null,
  purpose text,
  sections jsonb not null default '[]'::jsonb,
  summary text,
  created_by text references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  request_id text,
  unique(document_id,revision),
  unique(document_id,request_id),
  check (jsonb_typeof(sections)='array')
);

alter table public.planning_documents
  drop constraint if exists planning_documents_current_revision_id_fkey;
alter table public.planning_documents
  add constraint planning_documents_current_revision_id_fkey
  foreign key (current_revision_id) references public.planning_document_revisions(revision_id);

create index if not exists planning_document_revisions_doc_idx
  on public.planning_document_revisions(document_id,revision desc);

create table if not exists public.planning_feedback (
  feedback_id text primary key,
  document_id text not null references public.planning_documents(document_id) on delete cascade,
  revision integer not null check (revision > 0),
  section_id text,
  actor_id text not null references public.workspace_accounts(account_id),
  body text not null,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  created_at timestamptz not null default now(),
  request_id text,
  resolved_at timestamptz,
  resolved_by text references public.workspace_accounts(account_id),
  unique(document_id,request_id),
  check (char_length(body) between 1 and 8000),
  check ((status='OPEN' and resolved_at is null and resolved_by is null) or
         (status='RESOLVED' and resolved_at is not null and resolved_by is not null))
);

create index if not exists planning_feedback_doc_idx
  on public.planning_feedback(document_id,created_at desc);

alter table public.planning_documents enable row level security;
alter table public.planning_document_revisions enable row level security;
alter table public.planning_feedback enable row level security;

revoke all on table public.planning_documents from public, anon, authenticated;
revoke all on table public.planning_document_revisions from public, anon, authenticated;
revoke all on table public.planning_feedback from public, anon, authenticated;
grant select,insert,update,delete on table public.planning_documents to service_role;
grant select,insert,update,delete on table public.planning_document_revisions to service_role;
grant select,insert,update,delete on table public.planning_feedback to service_role;

insert into public.planning_documents(
  document_id,title,purpose,status,current_revision,current_revision_id,
  source_brief_key,source_brief_version,created_by,updated_by
)
select
  'EXECUTIVE_CURRENT',
  coalesce(b.content_json->>'title','CODE1 경영진 사업계획 Executive Brief'),
  b.content_json->>'purpose','ACTIVE',0,null,
  b.brief_key,b.brief_version,'OWNER','OWNER'
from public.planning_brief_versions b
where b.brief_key='EXECUTIVE_CURRENT' and b.status='PUBLISHED'
order by b.published_at desc nulls last
limit 1
on conflict (document_id) do nothing;

insert into public.planning_document_revisions(
  revision_id,document_id,revision,title,purpose,sections,summary,created_by,request_id
)
select
  'PDR_EXECUTIVE_CURRENT_000001','EXECUTIVE_CURRENT',1,
  coalesce(b.content_json->>'title','CODE1 경영진 사업계획 Executive Brief'),
  b.content_json->>'purpose',b.sections,
  'Initial working copy from published Executive Brief','OWNER','seed-executive-current-v1'
from public.planning_brief_versions b
where b.brief_key='EXECUTIVE_CURRENT' and b.status='PUBLISHED'
  and exists(select 1 from public.planning_documents d where d.document_id='EXECUTIVE_CURRENT')
order by b.published_at desc nulls last
limit 1
on conflict (document_id,revision) do nothing;

update public.planning_documents d
set current_revision=1,
    current_revision_id='PDR_EXECUTIVE_CURRENT_000001',
    updated_by='OWNER',updated_at=now()
where d.document_id='EXECUTIVE_CURRENT'
  and d.current_revision=0
  and exists(select 1 from public.planning_document_revisions r
             where r.revision_id='PDR_EXECUTIVE_CURRENT_000001');

create or replace function public.code1_set_account_capabilities(
  p_actor_id text,
  p_account_id text,
  p_capabilities text[],
  p_request_id text
) returns table(account_id text,session_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.workspace_accounts%rowtype;
  v_target public.workspace_accounts%rowtype;
  v_cap text;
  v_allowed constant text[] := array[
    'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
    'FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT',
    'PLANNING_EDIT','PLANNING_FEEDBACK','ACCOUNT_MANAGE','INPUT_POLICY_MANAGE',
    'EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT'
  ];
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_actor from public.workspace_accounts
    where workspace_accounts.account_id=p_actor_id and status='active' and archived_at is null;
  if not found or v_actor.account_id<>'OWNER' or v_actor.role<>'SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  select * into v_target from public.workspace_accounts
    where workspace_accounts.account_id=p_account_id for update;
  if not found or v_target.archived_at is not null then raise exception 'NOT_FOUND'; end if;
  if v_target.account_id='OWNER' or v_target.role='SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  foreach v_cap in array coalesce(p_capabilities,array[]::text[]) loop
    if not (v_cap=any(v_allowed)) then raise exception 'INVALID_CAPABILITY:%',v_cap; end if;
  end loop;
  delete from public.account_capabilities c
   where c.account_id=p_account_id
     and (c.capability='ACCESS_PROFILE_INITIALIZED' or c.capability=any(v_allowed));
  insert into public.account_capabilities(account_id,capability,effect,granted_by,note)
  values(p_account_id,'ACCESS_PROFILE_INITIALIZED','ALLOW',p_actor_id,'Explicit workspace access profile initialized');
  insert into public.account_capabilities(account_id,capability,effect,granted_by,note)
  select p_account_id,x,'ALLOW',p_actor_id,'Explicit workspace access profile'
  from unnest(coalesce(p_capabilities,array[]::text[])) as x;
  update public.workspace_accounts
  set session_version=workspace_accounts.session_version+1,updated_at=now()
  where workspace_accounts.account_id=p_account_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'account.permissions','ACCOUNT',p_account_id,'페이지·기능 권한 저장',p_request_id,
         jsonb_build_object('capabilities',coalesce(to_jsonb(p_capabilities),'[]'::jsonb),'session_invalidated',true));
  return query select a.account_id,a.session_version from public.workspace_accounts a where a.account_id=p_account_id;
end;
$$;

create or replace function public.code1_save_planning_document(
  p_actor_id text,
  p_document_id text,
  p_base_revision integer,
  p_title text,
  p_purpose text,
  p_sections jsonb,
  p_summary text,
  p_request_id text
) returns table(document_id text,revision integer,revision_id text,created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc public.planning_documents%rowtype;
  v_existing public.planning_document_revisions%rowtype;
  v_next integer;
  v_revision_id text;
  v_created timestamptz;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_sections is null or jsonb_typeof(p_sections)<>'array' then raise exception 'INVALID_PLANNING_DOCUMENT'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'INVALID_PLANNING_DOCUMENT'; end if;
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and (a.account_id='OWNER' or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability='PLANNING_EDIT' and c.effect='ALLOW'))
  ) then raise exception 'FORBIDDEN'; end if;
  select * into v_existing from public.planning_document_revisions
   where planning_document_revisions.document_id=p_document_id
     and planning_document_revisions.request_id=p_request_id;
  if found then
    return query select v_existing.document_id,v_existing.revision,v_existing.revision_id,v_existing.created_at;
    return;
  end if;
  select * into v_doc from public.planning_documents
   where planning_documents.document_id=p_document_id and status='ACTIVE' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_doc.current_revision<>p_base_revision then raise exception 'CONFLICT'; end if;
  v_next:=v_doc.current_revision+1;
  v_revision_id:='PDR_'||regexp_replace(p_document_id,'[^A-Za-z0-9]','','g')||'_'||lpad(v_next::text,6,'0');
  insert into public.planning_document_revisions(
    revision_id,document_id,revision,title,purpose,sections,summary,created_by,request_id
  ) values (
    v_revision_id,p_document_id,v_next,left(btrim(p_title),240),left(coalesce(p_purpose,''),4000),
    p_sections,left(coalesce(p_summary,''),2000),p_actor_id,p_request_id
  ) returning planning_document_revisions.created_at into v_created;
  update public.planning_documents d
  set title=left(btrim(p_title),240),purpose=left(coalesce(p_purpose,''),4000),
      current_revision=v_next,current_revision_id=v_revision_id,updated_by=p_actor_id,updated_at=v_created
  where d.document_id=p_document_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.document.save','PLANNING_DOCUMENT',p_document_id,
         '기획문서 revision 저장',p_request_id,jsonb_build_object('revision',v_next,'revision_id',v_revision_id));
  return query select p_document_id,v_next,v_revision_id,v_created;
end;
$$;

create or replace function public.code1_add_planning_feedback(
  p_actor_id text,
  p_document_id text,
  p_revision integer,
  p_section_id text,
  p_body text,
  p_request_id text
) returns setof public.planning_feedback
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_existing public.planning_feedback%rowtype;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'INVALID_FEEDBACK'; end if;
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and (a.account_id='OWNER' or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability='PLANNING_FEEDBACK' and c.effect='ALLOW'))
  ) then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from public.planning_document_revisions r where r.document_id=p_document_id and r.revision=p_revision) then raise exception 'NOT_FOUND'; end if;
  select * into v_existing from public.planning_feedback f
   where f.document_id=p_document_id and f.request_id=p_request_id;
  if found then return next v_existing; return; end if;
  v_id:='PFB_'||replace(gen_random_uuid()::text,'-','');
  insert into public.planning_feedback(feedback_id,document_id,revision,section_id,actor_id,body,request_id)
  values(v_id,p_document_id,p_revision,nullif(left(btrim(coalesce(p_section_id,'')),160),''),p_actor_id,left(btrim(p_body),8000),p_request_id);
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.feedback.create','PLANNING_DOCUMENT',p_document_id,
         '경영진 피드백 등록',p_request_id,jsonb_build_object('feedback_id',v_id,'revision',p_revision,'section_id',p_section_id));
  return query select * from public.planning_feedback where feedback_id=v_id;
end;
$$;

create or replace function public.code1_resolve_planning_feedback(
  p_actor_id text,
  p_feedback_id text,
  p_request_id text
) returns setof public.planning_feedback
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.planning_feedback%rowtype;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and (a.account_id='OWNER' or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability='PLANNING_EDIT' and c.effect='ALLOW'))
  ) then raise exception 'FORBIDDEN'; end if;
  select * into v_row from public.planning_feedback where feedback_id=p_feedback_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.status='OPEN' then
    update public.planning_feedback
    set status='RESOLVED',resolved_at=now(),resolved_by=p_actor_id
    where feedback_id=p_feedback_id;
    insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
    values(p_actor_id,'planning.feedback.resolve','PLANNING_FEEDBACK',p_feedback_id,
           '경영진 피드백 해결',p_request_id,jsonb_build_object('document_id',v_row.document_id));
  end if;
  return query select * from public.planning_feedback where feedback_id=p_feedback_id;
end;
$$;

revoke all on function public.code1_set_account_capabilities(text,text,text[],text) from public,anon,authenticated;
revoke all on function public.code1_save_planning_document(text,text,integer,text,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.code1_add_planning_feedback(text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_resolve_planning_feedback(text,text,text) from public,anon,authenticated;
grant execute on function public.code1_set_account_capabilities(text,text,text[],text) to service_role;
grant execute on function public.code1_save_planning_document(text,text,integer,text,text,jsonb,text,text) to service_role;
grant execute on function public.code1_add_planning_feedback(text,text,integer,text,text,text) to service_role;
grant execute on function public.code1_resolve_planning_feedback(text,text,text) to service_role;

commit;
