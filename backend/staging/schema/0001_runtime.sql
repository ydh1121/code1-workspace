-- CODE1 Internal Workspace / STAGING runtime schema
-- Isolated migration target. Do not apply to Production.
-- Browser clients must not receive the service-role key. All browser-facing access
-- remains behind the Cloudflare server boundary.

begin;

create table if not exists workspace_accounts (
  account_id text primary key,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  display_name text not null,
  email text,
  role text not null check (role in ('SUPER_ADMIN','ADMIN','FARMER')),
  status text not null check (status in ('active','disabled')),
  permissions_json jsonb not null default '{}'::jsonb,
  password_salt text,
  password_hash text,
  password_iterations integer,
  password_scheme text,
  session_version integer not null default 1 check (session_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'SUPER_ADMIN' or account_id = 'OWNER'),
  check ((password_hash is null and password_salt is null and password_iterations is null and password_scheme is null)
      or (password_hash ~ '^[a-f0-9]{64}$' and password_salt ~ '^[a-f0-9]{32}$' and password_iterations = 100000 and password_scheme = 'pbkdf2-sha256-pepper-v1'))
);

create table if not exists farms (
  farm_id text primary key,
  internal_name text,
  public_name text,
  onboarding_status text not null default '자료요청',
  origin_cohort boolean not null default false,
  region_province text,
  region_district text,
  public_region_label text,
  source_system text not null default 'GOOGLE_SHEET',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists farm_access (
  account_id text not null references workspace_accounts(account_id) on delete cascade,
  farm_id text not null references farms(farm_id) on delete cascade,
  access_level text not null check (access_level in ('view','edit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, farm_id)
);

create table if not exists question_catalog (
  item_key text primary key,
  sort_order integer not null,
  section_code text not null,
  section_name text not null,
  item_label text not null,
  plain_question text not null,
  why_needed text,
  input_type text not null,
  required_level text not null,
  options jsonb,
  evidence_required boolean not null default false,
  evidence_hint text,
  target_sheet text,
  target_column text,
  help_text text,
  active boolean not null default true,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists intake_submissions (
  submission_id text primary key,
  farm_id text references farms(farm_id),
  farm_name_snapshot text not null default '',
  status text not null check (status in ('DRAFT','SUBMITTED','REVIEWING','NEEDS_INFO','APPROVED','REJECTED','REFLECTED','WITHDRAWN')),
  current_revision integer not null default 0 check (current_revision >= 0),
  created_by text references workspace_accounts(account_id),
  last_edited_by text references workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id text references workspace_accounts(account_id),
  review_note text,
  latest_request_id text
);

create table if not exists submission_answers (
  submission_id text not null references intake_submissions(submission_id) on delete cascade,
  item_key text not null references question_catalog(item_key),
  revision integer not null check (revision > 0),
  input_type text not null,
  value_jsonb jsonb,
  evidence_required boolean not null default false,
  evidence_media_id text,
  source_note text,
  request_id text,
  edited_by text references workspace_accounts(account_id),
  recorded_at timestamptz not null default now(),
  primary key (submission_id, item_key, revision)
);

create table if not exists question_policies (
  policy_id text primary key,
  scope text not null check (scope in ('GLOBAL','FARM')),
  farm_id text references farms(farm_id),
  item_key text not null references question_catalog(item_key),
  mode text not null,
  reason_code text,
  reason_note text,
  version integer not null check (version > 0),
  status text not null default 'active' check (status in ('active','inactive')),
  updated_by text references workspace_accounts(account_id),
  updated_at timestamptz not null default now(),
  request_id text,
  check ((scope='GLOBAL' and farm_id is null and mode in ('SHOW','OPTIONAL','HIDE','PERMANENT_EXCLUDE'))
      or (scope='FARM' and farm_id is not null and mode in ('INHERIT','SHOW','OPTIONAL','HIDE','NOT_APPLICABLE'))),
  check (reason_code is null or reason_code in ('DUPLICATE','DERIVED','NOT_APPLICABLE','LATER_PHASE','COLLECT_LATER','SENSITIVE','LOW_VALUE','OTHER'))
);
create unique index if not exists question_policies_active_key
  on question_policies(scope, coalesce(farm_id,''), item_key) where status='active';

create table if not exists question_policy_history (
  history_id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id text references workspace_accounts(account_id),
  policy_id text not null,
  scope text not null,
  farm_id text,
  item_key text not null,
  before_mode text,
  after_mode text not null,
  reason_code text,
  reason_note text,
  version integer not null,
  request_id text,
  before_json jsonb,
  after_json jsonb
);

create table if not exists media_assets (
  media_id text primary key,
  upload_id text not null unique,
  submission_id text references intake_submissions(submission_id),
  farm_id text references farms(farm_id),
  media_group text not null,
  shot_code text,
  shot_label text,
  original_file_name text not null,
  object_key text unique,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  checksum_sha256 text,
  caption text,
  taken_at timestamptz,
  photographer text,
  rights_owner text,
  face_present text,
  face_consent text,
  privacy_present text,
  privacy_checked text,
  web_use text,
  magazine_use text,
  sns_use text,
  b2b_use text,
  ad_use text,
  edit_allowed text,
  ai_edit_allowed text,
  status text not null default 'REVIEW_REQUIRED' check (status in ('UPLOADING','REVIEW_REQUIRED','NEEDS_INFO','APPROVED','REJECTED','RESTRICTED','DELETED')),
  review_note text,
  request_id text,
  uploaded_by text references workspace_accounts(account_id),
  uploaded_at timestamptz not null default now(),
  reviewed_by text references workspace_accounts(account_id),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  source_drive_file_id text,
  source_drive_url text,
  source_storage text not null default 'R2_PRIVATE' check (source_storage in ('R2_PRIVATE','GOOGLE_DRIVE_LEGACY'))
);

create table if not exists media_events (
  event_id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id text references workspace_accounts(account_id),
  media_id text references media_assets(media_id),
  event_type text not null,
  from_status text,
  to_status text,
  object_key text,
  detail text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists review_decisions (
  decision_id bigint generated always as identity primary key,
  subject_type text not null check (subject_type in ('SUBMISSION','MEDIA')),
  subject_id text not null,
  old_status text,
  new_status text not null,
  note text,
  actor_id text references workspace_accounts(account_id),
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  audit_id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id text,
  action text not null,
  target_type text,
  target_id text,
  detail text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists login_guard (
  guard_key text primary key,
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists migration_registry (
  source_system text not null,
  entity_type text not null,
  stable_id text not null,
  source_ref text,
  source_hash text,
  migrated_at timestamptz not null default now(),
  primary key (source_system, entity_type, stable_id)
);

create index if not exists intake_submissions_farm_idx on intake_submissions(farm_id, updated_at desc);
create index if not exists submission_answers_latest_idx on submission_answers(submission_id, item_key, revision desc);
create index if not exists media_assets_submission_idx on media_assets(submission_id, status, uploaded_at desc);
create index if not exists media_assets_farm_idx on media_assets(farm_id, status, uploaded_at desc);
create index if not exists media_events_media_idx on media_events(media_id, at desc);
create index if not exists audit_log_actor_idx on audit_log(actor_id, at desc);

create or replace view submission_answers_current as
select distinct on (submission_id, item_key)
  submission_id, item_key, revision, input_type, value_jsonb, evidence_required,
  evidence_media_id, source_note, request_id, edited_by, recorded_at
from submission_answers
order by submission_id, item_key, revision desc, recorded_at desc;

create or replace function code1_save_submission(
  p_actor_id text,
  p_submission_id text,
  p_farm_id text,
  p_farm_name text,
  p_status text,
  p_base_revision integer,
  p_request_id text,
  p_answers jsonb
) returns table(submission_id text, revision integer, status text)
language plpgsql
as $$
declare
  v_current integer;
  v_next integer;
  v_exists boolean;
  v_item record;
  v_input_type text;
begin
  if p_status not in ('DRAFT','SUBMITTED') then raise exception 'INVALID_STATUS'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'INVALID_ANSWERS'; end if;

  select true, s.current_revision into v_exists, v_current
  from intake_submissions s where s.submission_id=p_submission_id for update;

  if coalesce(v_exists,false) then
    if v_current <> p_base_revision then raise exception 'CONFLICT'; end if;
  else
    if p_base_revision <> 0 then raise exception 'CONFLICT'; end if;
    insert into intake_submissions(submission_id,farm_id,farm_name_snapshot,status,current_revision,created_by,last_edited_by,latest_request_id)
    values(p_submission_id,p_farm_id,coalesce(p_farm_name,''),p_status,0,p_actor_id,p_actor_id,p_request_id);
    v_current:=0;
  end if;

  v_next:=v_current+1;
  update intake_submissions set
    farm_id=p_farm_id,
    farm_name_snapshot=coalesce(p_farm_name,''),
    status=p_status,
    current_revision=v_next,
    last_edited_by=p_actor_id,
    updated_at=now(),
    submitted_at=case when p_status='SUBMITTED' then now() else submitted_at end,
    latest_request_id=p_request_id
  where intake_submissions.submission_id=p_submission_id;

  for v_item in select key, value from jsonb_each(p_answers) loop
    select q.input_type into v_input_type from question_catalog q where q.item_key=v_item.key;
    if v_input_type is null then raise exception 'UNKNOWN_ITEM_KEY:%', v_item.key; end if;
    insert into submission_answers(submission_id,item_key,revision,input_type,value_jsonb,evidence_required,request_id,edited_by,recorded_at)
    select p_submission_id,v_item.key,v_next,v_input_type,v_item.value,q.evidence_required,p_request_id,p_actor_id,now()
    from question_catalog q where q.item_key=v_item.key;
  end loop;

  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id)
  values(p_actor_id,case when p_status='SUBMITTED' then 'submission.submit' else 'submission.draft.save' end,'SUBMISSION',p_submission_id,'revision='||v_next,p_request_id);

  return query select p_submission_id,v_next,p_status;
end;
$$;

alter table workspace_accounts enable row level security;
alter table farms enable row level security;
alter table farm_access enable row level security;
alter table question_catalog enable row level security;
alter table intake_submissions enable row level security;
alter table submission_answers enable row level security;
alter table question_policies enable row level security;
alter table question_policy_history enable row level security;
alter table media_assets enable row level security;
alter table media_events enable row level security;
alter table review_decisions enable row level security;
alter table audit_log enable row level security;
alter table login_guard enable row level security;
alter table migration_registry enable row level security;

commit;
