-- CODE1 Planning Delta 20260910-001 / STAGING ONLY
-- Isolated schema extension. Do not apply to Production or the current live runtime.
-- No table or constraint below treats housing-environment category 1 as a quality grade
-- or permanently restricts the data model to category 1.

begin;

create table if not exists housing_environment_records (
  record_id text primary key,
  farm_id text references farms(farm_id),
  subject_type text not null check (subject_type in ('FARM','PRODUCT_VARIANT','PRODUCTION_UNIT','LOT')),
  subject_id text not null,
  housing_environment_code smallint check (housing_environment_code between 1 and 4),
  source_value text,
  verification_status text not null default 'UNCONFIRMED'
    check (verification_status in ('UNCONFIRMED','EVIDENCE_REQUESTED','VERIFIED','REJECTED','SUPERSEDED')),
  evidence_ref jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  verified_by text references workspace_accounts(account_id),
  verified_at timestamptz,
  source_system text not null default 'GOOGLE_SHEET',
  source_ref text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'VERIFIED' or (housing_environment_code is not null and verified_by is not null and verified_at is not null)),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create unique index if not exists housing_environment_current_subject
  on housing_environment_records(subject_type, subject_id) where is_current;
create index if not exists housing_environment_farm_idx
  on housing_environment_records(farm_id, is_current, updated_at desc);

create table if not exists account_capabilities (
  account_id text not null references workspace_accounts(account_id) on delete cascade,
  capability text not null check (capability in ('EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT')),
  effect text not null default 'ALLOW' check (effect in ('ALLOW','DENY')),
  granted_by text references workspace_accounts(account_id),
  granted_at timestamptz not null default now(),
  note text,
  primary key (account_id, capability)
);

create table if not exists fact_inbox (
  fact_id text primary key,
  domain text not null,
  subject_type text not null,
  subject_id text not null,
  statement text not null,
  source_type text not null,
  reported_by text,
  reported_at timestamptz not null default now(),
  evidence_ref jsonb,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','USER_REPORTED','PARTNER_REPORTED','EVIDENCE_REQUESTED','DOCUMENT_RECEIVED','VERIFIED','APPROVED_CURRENT')),
  verification_note text,
  verification_confidence numeric(5,4) check (verification_confidence is null or (verification_confidence >= 0 and verification_confidence <= 1)),
  external_disclosure_allowed boolean not null default false,
  verified_by text references workspace_accounts(account_id),
  verified_at timestamptz,
  approved_current_at timestamptz,
  approved_current_by text references workspace_accounts(account_id),
  supersedes_fact_id text references fact_inbox(fact_id),
  created_by text references workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_by text references workspace_accounts(account_id),
  updated_at timestamptz not null default now(),
  check (supersedes_fact_id is null or supersedes_fact_id <> fact_id),
  check (status <> 'VERIFIED' or (verified_by is not null and verified_at is not null)),
  check (status <> 'APPROVED_CURRENT' or (verified_by is not null and verified_at is not null and approved_current_by is not null and approved_current_at is not null))
);
create index if not exists fact_inbox_subject_idx on fact_inbox(subject_type, subject_id, updated_at desc);
create index if not exists fact_inbox_status_idx on fact_inbox(status, updated_at desc);
create index if not exists fact_inbox_supersedes_idx on fact_inbox(supersedes_fact_id);

create table if not exists fact_events (
  event_id bigint generated always as identity primary key,
  fact_id text not null references fact_inbox(fact_id) on delete cascade,
  actor_id text references workspace_accounts(account_id),
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists fact_events_fact_idx on fact_events(fact_id, at asc);

create table if not exists planning_brief_versions (
  brief_key text not null default 'EXECUTIVE_CURRENT',
  brief_version text not null,
  status text not null check (status in ('DRAFT','PUBLISHED','SUPERSEDED')),
  source_doc_ids jsonb not null default '[]'::jsonb,
  source_revision text,
  source_version text,
  content_json jsonb not null default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  confidentiality text not null default 'INTERNAL' check (confidentiality in ('INTERNAL','INTERNAL_CONFIDENTIAL')),
  published_at timestamptz,
  published_by text references workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  created_by text references workspace_accounts(account_id),
  primary key (brief_key, brief_version),
  check (status <> 'PUBLISHED' or (published_at is not null and published_by is not null))
);
create unique index if not exists planning_brief_one_published_per_key
  on planning_brief_versions(brief_key) where status='PUBLISHED';

-- Narrow registry for planning-source file references. It is not a public media registry.
-- Confidential artifacts, including a GreatFarm PDF if registered later, are prohibited
-- from public delivery and may only use a private planning object key.
create table if not exists planning_source_artifacts (
  artifact_id text primary key,
  source_type text not null,
  source_ref text not null,
  title text,
  confidentiality text not null default 'INTERNAL_CONFIDENTIAL'
    check (confidentiality in ('INTERNAL','INTERNAL_CONFIDENTIAL')),
  object_key text,
  public_delivery_allowed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_delivery_allowed = false),
  check (object_key is null or object_key like 'private/planning/%')
);

alter table housing_environment_records enable row level security;
alter table account_capabilities enable row level security;
alter table fact_inbox enable row level security;
alter table fact_events enable row level security;
alter table planning_brief_versions enable row level security;
alter table planning_source_artifacts enable row level security;

-- No anon/authenticated browser policy is created. Cloudflare's server-only service-role
-- path remains the database boundary and application code must perform actor checks.

create or replace function code1_fact_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'RECEIVED' then p_to in ('USER_REPORTED','PARTNER_REPORTED')
    when 'USER_REPORTED' then p_to = 'EVIDENCE_REQUESTED'
    when 'PARTNER_REPORTED' then p_to = 'EVIDENCE_REQUESTED'
    when 'EVIDENCE_REQUESTED' then p_to = 'DOCUMENT_RECEIVED'
    when 'DOCUMENT_RECEIVED' then p_to = 'VERIFIED'
    when 'VERIFIED' then p_to = 'APPROVED_CURRENT'
    else false
  end;
$$;

create or replace function code1_transition_fact(
  p_actor_id text,
  p_fact_id text,
  p_to_status text,
  p_note text,
  p_confidence numeric,
  p_request_id text
) returns table(fact_id text, status text, updated_at timestamptz)
language plpgsql
as $$
declare
  v_old fact_inbox%rowtype;
  v_capability text;
begin
  select * into v_old from fact_inbox where fact_inbox.fact_id=p_fact_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not code1_fact_transition_allowed(v_old.status,p_to_status) then raise exception 'INVALID_FACT_TRANSITION'; end if;

  v_capability := case
    when p_to_status='APPROVED_CURRENT' then 'FACT_APPROVE_CURRENT'
    when p_to_status in ('EVIDENCE_REQUESTED','DOCUMENT_RECEIVED','VERIFIED') then 'FACT_VERIFY'
    else 'FACT_SUBMIT'
  end;
  if not exists(select 1 from account_capabilities c where c.account_id=p_actor_id and c.capability=v_capability and c.effect='ALLOW') then
    raise exception 'FORBIDDEN';
  end if;

  update fact_inbox f set
    status=p_to_status,
    verification_note=case when p_to_status in ('VERIFIED','APPROVED_CURRENT') then coalesce(p_note,f.verification_note) else f.verification_note end,
    verification_confidence=case when p_to_status='VERIFIED' then p_confidence else f.verification_confidence end,
    verified_by=case when p_to_status='VERIFIED' then p_actor_id else f.verified_by end,
    verified_at=case when p_to_status='VERIFIED' then now() else f.verified_at end,
    approved_current_by=case when p_to_status='APPROVED_CURRENT' then p_actor_id else f.approved_current_by end,
    approved_current_at=case when p_to_status='APPROVED_CURRENT' then now() else f.approved_current_at end,
    updated_by=p_actor_id,
    updated_at=now()
  where f.fact_id=p_fact_id;

  insert into fact_events(fact_id,actor_id,event_type,from_status,to_status,note,request_id)
  values(p_fact_id,p_actor_id,'STATUS_CHANGED',v_old.status,p_to_status,p_note,p_request_id);

  return query select f.fact_id,f.status,f.updated_at from fact_inbox f where f.fact_id=p_fact_id;
end;
$$;

commit;
