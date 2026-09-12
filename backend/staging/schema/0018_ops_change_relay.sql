-- CODE1 Internal Workspace / STAGING ONLY
-- CODE1 OPS CHANGE RELAY v0.1 source-side transactional event/outbox contract.
-- Do not apply to Production or the retired Apps Script/Sheet/Drive runtime.

begin;

create table if not exists public.ops_change_events (
  event_id text primary key,
  source_system text not null default 'TEMP_ADMIN',
  source_version text not null default 'OPS_RELAY_v0.1',
  entity_type text not null,
  entity_id text not null,
  action text not null,
  changed_fields text[] not null default array[]::text[],
  before_hash text,
  after_hash text,
  actor_ref text not null,
  event_class text not null,
  planning_relevance boolean not null,
  suggested_tracks text[] not null default array[]::text[],
  evidence_refs jsonb not null default '[]'::jsonb,
  correlation_id text not null,
  causation_id text,
  idempotency_key text not null unique,
  payload_hash text not null,
  priority text not null default 'P1',
  result_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  relay_status text not null default 'RECORDED',
  relay_status_updated_at timestamptz not null default now(),
  check (event_class in ('OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT')),
  check (priority in ('P0','P1','P2','P3')),
  check (relay_status in (
    'RECORDED','PLANNING_REVIEW','APPLIED_TO_SSOT','DISPATCHED','IN_PROGRESS','DONE',
    'NO_PLANNING_ACTION','HOLD','BLOCKED_USER_APPROVAL','BLOCKED_POLICY','BLOCKED_SECRET','FAILED_RECOVERABLE'
  )),
  check (jsonb_typeof(evidence_refs)='array'),
  check (jsonb_typeof(result_json)='object'),
  check (payload_hash ~ '^[a-f0-9]{64}$'),
  check (before_hash is null or before_hash ~ '^[a-f0-9]{64}$'),
  check (after_hash is null or after_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists ops_change_events_recorded_idx
  on public.ops_change_events(recorded_at desc);
create index if not exists ops_change_events_relay_idx
  on public.ops_change_events(relay_status,recorded_at desc);
create index if not exists ops_change_events_class_idx
  on public.ops_change_events(event_class,recorded_at desc);
create index if not exists ops_change_events_correlation_idx
  on public.ops_change_events(correlation_id,recorded_at asc);

create table if not exists public.ops_outbox (
  outbox_id text primary key,
  event_id text not null unique references public.ops_change_events(event_id) on delete cascade,
  delivery_state text not null default 'PENDING',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  consumer_version text,
  last_error_code text,
  idempotency_key text not null unique,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (delivery_state in ('PENDING','CLAIMED','DELIVERED','FAILED_RETRYABLE','HOLD','NO_ACTION')),
  check (last_error_code is null or last_error_code ~ '^[A-Z0-9_:-]{1,120}$')
);

create index if not exists ops_outbox_delivery_idx
  on public.ops_outbox(delivery_state,available_at,created_at);

alter table public.ops_change_events enable row level security;
alter table public.ops_outbox enable row level security;
revoke all on table public.ops_change_events from public,anon,authenticated;
revoke all on table public.ops_outbox from public,anon,authenticated;
grant select,insert,update,delete on table public.ops_change_events to service_role;
grant select,insert,update,delete on table public.ops_outbox to service_role;

create or replace function public.code1_ops_hash_json(p_value jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(digest(convert_to(coalesce(p_value,'null'::jsonb)::text,'UTF8'),'sha256'),'hex')
$$;

create or replace function public.code1_ops_assert_safe_evidence(p_refs jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_key text;
  v_value text;
  v_allowed constant text[] := array['kind','ref','sha256','size','mime','label','version','source'];
begin
  if p_refs is null or jsonb_typeof(p_refs)<>'array' then raise exception 'INVALID_EVIDENCE_REFS'; end if;
  for v_item in select value from jsonb_array_elements(p_refs) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'INVALID_EVIDENCE_REFS'; end if;
    for v_key,v_value in select key,value from jsonb_each_text(v_item) loop
      if not (v_key=any(v_allowed)) then raise exception 'UNSAFE_EVIDENCE_REF'; end if;
      if lower(v_key) ~ '(secret|token|password|credential|signature|key)' then raise exception 'UNSAFE_EVIDENCE_REF'; end if;
      if v_value ~* 'https?://' or v_value ~* '(token|signature|x-amz-|credential|password|secret)=' then raise exception 'UNSAFE_EVIDENCE_REF'; end if;
      if char_length(v_value)>1000 then raise exception 'UNSAFE_EVIDENCE_REF'; end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.code1_ops_assert_owner(p_actor_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and a.account_id='OWNER' and a.role='SUPER_ADMIN'
  ) then raise exception 'FORBIDDEN'; end if;
end;
$$;

create or replace function public.code1_ops_emit_event(
  p_actor_id text,
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_changed_fields text[],
  p_before_hash text,
  p_after_hash text,
  p_event_class text,
  p_suggested_tracks text[],
  p_evidence_refs jsonb,
  p_correlation_id text,
  p_causation_id text,
  p_idempotency_key text,
  p_payload_hash text,
  p_priority text,
  p_result_json jsonb
) returns public.ops_change_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.ops_change_events%rowtype;
  v_event public.ops_change_events%rowtype;
  v_event_id text;
  v_outbox_id text;
  v_planning boolean;
  v_relay_status text;
  v_delivery_state text;
  v_tracks text[] := coalesce(p_suggested_tracks,array[]::text[]);
  v_evidence jsonb := coalesce(p_evidence_refs,'[]'::jsonb);
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  if p_idempotency_key is null or p_idempotency_key !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_PAYLOAD_HASH'; end if;
  if p_event_class not in ('OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT') then raise exception 'INVALID_EVENT_CLASS'; end if;
  if coalesce(p_priority,'') not in ('P0','P1','P2','P3') then raise exception 'INVALID_PRIORITY'; end if;
  if nullif(btrim(coalesce(p_entity_type,'')),'') is null or nullif(btrim(coalesce(p_entity_id,'')),'') is null or nullif(btrim(coalesce(p_action,'')),'') is null then raise exception 'INVALID_EVENT'; end if;
  if exists(select 1 from unnest(coalesce(p_changed_fields,array[]::text[])) f where f !~ '^[A-Za-z0-9_.:-]{1,120}$') then raise exception 'INVALID_CHANGED_FIELDS'; end if;
  if exists(select 1 from unnest(v_tracks) t where t not in ('PLANNING','UIUX','CODING','ORCHESTRATOR')) then raise exception 'INVALID_SUGGESTED_TRACK'; end if;
  if p_before_hash is not null and p_before_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_BEFORE_HASH'; end if;
  if p_after_hash is not null and p_after_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_AFTER_HASH'; end if;
  perform public.code1_ops_assert_safe_evidence(v_evidence);

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key)::bigint);
  select * into v_existing from public.ops_change_events e where e.idempotency_key=p_idempotency_key;
  if found then
    if v_existing.payload_hash<>p_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing;
  end if;

  v_event_id:='OCE_'||replace(gen_random_uuid()::text,'-','');
  v_outbox_id:='OOB_'||replace(gen_random_uuid()::text,'-','');
  v_planning:=p_event_class<>'OPS_DATA_ONLY';
  v_relay_status:=case p_event_class
    when 'OPS_DATA_ONLY' then 'NO_PLANNING_ACTION'
    when 'POLICY_APPROVAL_REQUIRED' then 'BLOCKED_POLICY'
    else 'RECORDED'
  end;
  v_delivery_state:=case when p_event_class='OPS_DATA_ONLY' then 'NO_ACTION' else 'PENDING' end;

  insert into public.ops_change_events(
    event_id,source_system,source_version,entity_type,entity_id,action,changed_fields,
    before_hash,after_hash,actor_ref,event_class,planning_relevance,suggested_tracks,evidence_refs,
    correlation_id,causation_id,idempotency_key,payload_hash,priority,result_json,
    occurred_at,recorded_at,relay_status,relay_status_updated_at
  ) values (
    v_event_id,'TEMP_ADMIN','OPS_RELAY_v0.1',left(btrim(p_entity_type),120),left(btrim(p_entity_id),160),left(btrim(p_action),160),
    coalesce(p_changed_fields,array[]::text[]),p_before_hash,p_after_hash,p_actor_id,p_event_class,v_planning,v_tracks,v_evidence,
    coalesce(nullif(btrim(coalesce(p_correlation_id,'')),''),v_event_id),nullif(btrim(coalesce(p_causation_id,'')),''),
    p_idempotency_key,p_payload_hash,p_priority,coalesce(p_result_json,'{}'::jsonb),now(),now(),v_relay_status,now()
  ) returning * into v_event;

  insert into public.ops_outbox(
    outbox_id,event_id,delivery_state,attempt_count,available_at,idempotency_key,dedupe_key,created_at,updated_at
  ) values (
    v_outbox_id,v_event_id,v_delivery_state,0,now(),'OB_'||p_idempotency_key,'EV_'||v_event_id,now(),now()
  );
  return v_event;
end;
$$;

create or replace function public.code1_ops_delete_empty_farm(
  p_actor_id text,
  p_farm_id text,
  p_reason text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.ops_change_events%rowtype;
  v_before jsonb;
  v_before_hash text;
  v_payload_hash text;
  v_result jsonb;
  v_event public.ops_change_events%rowtype;
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id)::bigint);
  v_payload_hash:=public.code1_ops_hash_json(jsonb_build_object('op','farm.delete','id',p_farm_id,'reason',left(coalesce(p_reason,''),500)));
  select * into v_existing from public.ops_change_events e where e.idempotency_key=p_request_id;
  if found then
    if v_existing.payload_hash<>v_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('entity',v_existing.result_json,'event',to_jsonb(v_existing));
  end if;
  select to_jsonb(f) into v_before from public.farms f where f.farm_id=p_farm_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;
  v_before_hash:=public.code1_ops_hash_json(v_before);
  perform public.code1_delete_empty_farm(p_actor_id,p_farm_id,p_reason,p_request_id);
  v_result:=jsonb_build_object('farm_id',p_farm_id,'deleted',true);
  v_event:=public.code1_ops_emit_event(
    p_actor_id,'FARM',p_farm_id,'admin.farm.delete',array['deleted'],v_before_hash,null,
    'OPS_DATA_ONLY',array[]::text[],'[]'::jsonb,null,null,p_request_id,v_payload_hash,'P1',v_result
  );
  return jsonb_build_object('entity',v_result,'event',to_jsonb(v_event));
end;
$$;

create or replace function public.code1_ops_archive_account(
  p_actor_id text,
  p_account_id text,
  p_reason text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.ops_change_events%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_payload_hash text;
  v_result jsonb;
  v_event public.ops_change_events%rowtype;
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id)::bigint);
  v_payload_hash:=public.code1_ops_hash_json(jsonb_build_object('op','account.archive','id',p_account_id,'reason',left(coalesce(p_reason,''),500)));
  select * into v_existing from public.ops_change_events e where e.idempotency_key=p_request_id;
  if found then
    if v_existing.payload_hash<>v_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('entity',v_existing.result_json,'event',to_jsonb(v_existing));
  end if;
  select to_jsonb(a) into v_before from public.workspace_accounts a where a.account_id=p_account_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;
  perform public.code1_archive_account(p_actor_id,p_account_id,p_reason,p_request_id);
  select to_jsonb(a) into v_after from public.workspace_accounts a where a.account_id=p_account_id;
  v_result:=jsonb_build_object(
    'id',v_after->>'account_id','username',v_after->>'username','displayName',v_after->>'display_name',
    'status',v_after->>'status','archivedAt',v_after->>'archived_at','version',coalesce((v_after->>'session_version')::integer,0)
  );
  v_event:=public.code1_ops_emit_event(
    p_actor_id,'ACCOUNT',p_account_id,'admin.account.delete',array['status','archived_at','access'],
    public.code1_ops_hash_json(v_before),public.code1_ops_hash_json(v_after),'OPS_DATA_ONLY',array[]::text[],
    '[]'::jsonb,null,null,p_request_id,v_payload_hash,'P1',v_result
  );
  return jsonb_build_object('entity',v_result,'event',to_jsonb(v_event));
end;
$$;

create or replace function public.code1_ops_set_account_capabilities(
  p_actor_id text,
  p_account_id text,
  p_capabilities text[],
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.ops_change_events%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_payload_hash text;
  v_result jsonb;
  v_event public.ops_change_events%rowtype;
  v_caps text[] := coalesce(p_capabilities,array[]::text[]);
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id)::bigint);
  select coalesce(jsonb_agg(c.capability order by c.capability),'[]'::jsonb) into v_before
    from public.account_capabilities c where c.account_id=p_account_id and c.effect='ALLOW';
  v_payload_hash:=public.code1_ops_hash_json(jsonb_build_object('op','account.permissions','id',p_account_id,'capabilities',to_jsonb(v_caps)));
  select * into v_existing from public.ops_change_events e where e.idempotency_key=p_request_id;
  if found then
    if v_existing.payload_hash<>v_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('entity',v_existing.result_json,'event',to_jsonb(v_existing));
  end if;
  perform public.code1_set_account_capabilities(p_actor_id,p_account_id,v_caps,p_request_id);
  select coalesce(jsonb_agg(c.capability order by c.capability),'[]'::jsonb) into v_after
    from public.account_capabilities c where c.account_id=p_account_id and c.effect='ALLOW';
  v_result:=jsonb_build_object(
    'id',p_account_id,
    'version',(select a.session_version from public.workspace_accounts a where a.account_id=p_account_id),
    'capabilities',v_after
  );
  v_event:=public.code1_ops_emit_event(
    p_actor_id,'ACCOUNT_ACCESS',p_account_id,'admin.access.save',array['capabilities','session_version'],
    public.code1_ops_hash_json(v_before),public.code1_ops_hash_json(v_after),'CODING_IMPACT',array['CODING'],
    '[]'::jsonb,null,null,p_request_id,v_payload_hash,'P1',v_result
  );
  return jsonb_build_object('entity',v_result,'event',to_jsonb(v_event));
end;
$$;

create or replace function public.code1_ops_record_manual_event(
  p_actor_id text,
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_event_class text,
  p_changed_fields text[],
  p_suggested_tracks text[],
  p_evidence_refs jsonb,
  p_correlation_id text,
  p_causation_id text,
  p_request_id text
) returns public.ops_change_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_priority text;
  v_result jsonb;
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  v_priority:=case when p_event_class='INCIDENT' then 'P0' when p_event_class='POLICY_APPROVAL_REQUIRED' then 'P0' else 'P1' end;
  v_result:=jsonb_build_object('recorded',true,'mutationApplied',false);
  v_hash:=public.code1_ops_hash_json(jsonb_build_object(
    'entityType',p_entity_type,'entityId',p_entity_id,'action',p_action,'eventClass',p_event_class,
    'changedFields',coalesce(to_jsonb(p_changed_fields),'[]'::jsonb),'suggestedTracks',coalesce(to_jsonb(p_suggested_tracks),'[]'::jsonb),
    'evidenceRefs',coalesce(p_evidence_refs,'[]'::jsonb),'correlationId',p_correlation_id,'causationId',p_causation_id
  ));
  return public.code1_ops_emit_event(
    p_actor_id,p_entity_type,p_entity_id,p_action,p_changed_fields,null,null,p_event_class,p_suggested_tracks,
    coalesce(p_evidence_refs,'[]'::jsonb),p_correlation_id,p_causation_id,p_request_id,v_hash,v_priority,v_result
  );
end;
$$;

create or replace function public.code1_ops_request_planning_review(
  p_actor_id text,
  p_source_event_id text,
  p_request_id text
) returns public.ops_change_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.ops_change_events%rowtype;
  v_hash text;
  v_result jsonb;
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  select * into v_source from public.ops_change_events e where e.event_id=p_source_event_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result:=jsonb_build_object('sourceEventId',v_source.event_id,'planningReviewRequested',true);
  v_hash:=public.code1_ops_hash_json(jsonb_build_object('op','planning.review.request','sourceEventId',v_source.event_id));
  return public.code1_ops_emit_event(
    p_actor_id,v_source.entity_type,v_source.entity_id,'planning.review.request',v_source.changed_fields,
    v_source.before_hash,v_source.after_hash,'PLANNING_IMPACT',array['PLANNING'],v_source.evidence_refs,
    v_source.correlation_id,v_source.event_id,p_request_id,v_hash,'P0',v_result
  );
end;
$$;

create or replace function public.code1_ops_claim_outbox(
  p_consumer_version text,
  p_limit integer default 20
) returns table(
  outbox_id text,event_id text,event_class text,entity_type text,entity_id text,action text,
  correlation_id text,causation_id text,planning_relevance boolean,suggested_tracks text[],
  evidence_refs jsonb,priority text,attempt_count integer,recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(p_consumer_version,'')),'') is null or char_length(p_consumer_version)>120 then raise exception 'INVALID_CONSUMER'; end if;
  if coalesce(p_limit,0)<1 or p_limit>100 then raise exception 'INVALID_LIMIT'; end if;
  return query
  with candidates as (
    select o.outbox_id
    from public.ops_outbox o
    where (
      (o.delivery_state in ('PENDING','FAILED_RETRYABLE') and o.available_at<=now())
      or (o.delivery_state='CLAIMED' and o.claimed_at<now()-interval '15 minutes')
    )
    order by o.available_at,o.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.ops_outbox o set
      delivery_state='CLAIMED',attempt_count=o.attempt_count+1,claimed_at=now(),
      consumer_version=left(btrim(p_consumer_version),120),last_error_code=null,updated_at=now()
    from candidates c where o.outbox_id=c.outbox_id
    returning o.*
  )
  select c.outbox_id,e.event_id,e.event_class,e.entity_type,e.entity_id,e.action,e.correlation_id,e.causation_id,
         e.planning_relevance,e.suggested_tracks,e.evidence_refs,e.priority,c.attempt_count,e.recorded_at
  from claimed c join public.ops_change_events e on e.event_id=c.event_id
  order by e.recorded_at;
end;
$$;

create or replace function public.code1_ops_ack_outbox(
  p_outbox_id text,
  p_consumer_version text,
  p_outcome text,
  p_error_code text default null
) returns table(outbox_id text,event_id text,delivery_state text,relay_status text,attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_box public.ops_outbox%rowtype;
  v_state text;
  v_status text;
begin
  if p_outcome not in ('DELIVERED','RETRY','HOLD') then raise exception 'INVALID_OUTCOME'; end if;
  if nullif(btrim(coalesce(p_consumer_version,'')),'') is null then raise exception 'INVALID_CONSUMER'; end if;
  if p_error_code is not null and p_error_code !~ '^[A-Z0-9_:-]{1,120}$' then raise exception 'INVALID_ERROR_CODE'; end if;
  select * into v_box from public.ops_outbox o where o.outbox_id=p_outbox_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_box.delivery_state='DELIVERED' then
    return query select v_box.outbox_id,v_box.event_id,v_box.delivery_state,e.relay_status,v_box.attempt_count from public.ops_change_events e where e.event_id=v_box.event_id;
    return;
  end if;
  if v_box.delivery_state<>'CLAIMED' then raise exception 'INVALID_OUTBOX_STATE'; end if;
  v_state:=case p_outcome when 'DELIVERED' then 'DELIVERED' when 'RETRY' then 'FAILED_RETRYABLE' else 'HOLD' end;
  v_status:=case p_outcome when 'DELIVERED' then 'PLANNING_REVIEW' when 'RETRY' then 'FAILED_RECOVERABLE' else 'HOLD' end;
  update public.ops_outbox o set
    delivery_state=v_state,
    delivered_at=case when p_outcome='DELIVERED' then now() else o.delivered_at end,
    available_at=case when p_outcome='RETRY' then now()+least(interval '60 minutes',interval '30 seconds' * greatest(1,o.attempt_count)) else o.available_at end,
    consumer_version=left(btrim(p_consumer_version),120),last_error_code=p_error_code,updated_at=now()
  where o.outbox_id=p_outbox_id;
  update public.ops_change_events e set relay_status=v_status,relay_status_updated_at=now() where e.event_id=v_box.event_id;
  return query select o.outbox_id,o.event_id,o.delivery_state,e.relay_status,o.attempt_count
    from public.ops_outbox o join public.ops_change_events e on e.event_id=o.event_id where o.outbox_id=p_outbox_id;
end;
$$;

create or replace function public.code1_ops_transition_event(
  p_event_id text,
  p_to_status text
) returns table(event_id text,relay_status text,relay_status_updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from text;
  v_ok boolean := false;
begin
  select e.relay_status into v_from from public.ops_change_events e where e.event_id=p_event_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_from=p_to_status then v_ok:=true;
  elsif v_from='RECORDED' and p_to_status in ('PLANNING_REVIEW','HOLD','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from='PLANNING_REVIEW' and p_to_status in ('APPLIED_TO_SSOT','NO_PLANNING_ACTION','HOLD','BLOCKED_USER_APPROVAL','BLOCKED_POLICY','BLOCKED_SECRET','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from='APPLIED_TO_SSOT' and p_to_status in ('DISPATCHED','DONE','HOLD','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from='DISPATCHED' and p_to_status in ('IN_PROGRESS','DONE','HOLD','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from='IN_PROGRESS' and p_to_status in ('DONE','HOLD','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from='FAILED_RECOVERABLE' and p_to_status in ('RECORDED','PLANNING_REVIEW','DISPATCHED','IN_PROGRESS','HOLD') then v_ok:=true;
  elsif v_from='HOLD' and p_to_status in ('PLANNING_REVIEW','DISPATCHED','IN_PROGRESS','FAILED_RECOVERABLE') then v_ok:=true;
  elsif v_from in ('BLOCKED_USER_APPROVAL','BLOCKED_POLICY','BLOCKED_SECRET') and p_to_status='PLANNING_REVIEW' then v_ok:=true;
  end if;
  if not v_ok then raise exception 'INVALID_RELAY_TRANSITION'; end if;
  update public.ops_change_events e set relay_status=p_to_status,relay_status_updated_at=now() where e.event_id=p_event_id;
  return query select e.event_id,e.relay_status,e.relay_status_updated_at from public.ops_change_events e where e.event_id=p_event_id;
end;
$$;

-- Browser roles cannot touch event/outbox tables or privileged producer/consumer RPCs.
revoke all on function public.code1_ops_hash_json(jsonb) from public,anon,authenticated;
revoke all on function public.code1_ops_assert_safe_evidence(jsonb) from public,anon,authenticated;
revoke all on function public.code1_ops_assert_owner(text) from public,anon,authenticated;
revoke all on function public.code1_ops_emit_event(text,text,text,text,text[],text,text,text,text[],jsonb,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.code1_ops_delete_empty_farm(text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_ops_archive_account(text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_ops_set_account_capabilities(text,text,text[],text) from public,anon,authenticated;
revoke all on function public.code1_ops_record_manual_event(text,text,text,text,text,text[],text[],jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_ops_request_planning_review(text,text,text) from public,anon,authenticated;
revoke all on function public.code1_ops_claim_outbox(text,integer) from public,anon,authenticated;
revoke all on function public.code1_ops_ack_outbox(text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_ops_transition_event(text,text) from public,anon,authenticated;

grant execute on function public.code1_ops_hash_json(jsonb) to service_role;
grant execute on function public.code1_ops_assert_safe_evidence(jsonb) to service_role;
grant execute on function public.code1_ops_assert_owner(text) to service_role;
grant execute on function public.code1_ops_emit_event(text,text,text,text,text[],text,text,text,text[],jsonb,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.code1_ops_delete_empty_farm(text,text,text,text) to service_role;
grant execute on function public.code1_ops_archive_account(text,text,text,text) to service_role;
grant execute on function public.code1_ops_set_account_capabilities(text,text,text[],text) to service_role;
grant execute on function public.code1_ops_record_manual_event(text,text,text,text,text,text[],text[],jsonb,text,text,text) to service_role;
grant execute on function public.code1_ops_request_planning_review(text,text,text) to service_role;
grant execute on function public.code1_ops_claim_outbox(text,integer) to service_role;
grant execute on function public.code1_ops_ack_outbox(text,text,text,text) to service_role;
grant execute on function public.code1_ops_transition_event(text,text) to service_role;

commit;
