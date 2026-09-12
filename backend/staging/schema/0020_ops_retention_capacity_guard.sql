-- CODE1 Internal Workspace / STAGING ONLY
-- WO-20260912-CODING-OPS-RETENTION-001
-- REPORT_ONLY / DRY_RUN retention + capacity guard.
-- This migration deliberately contains no purge executor, scheduler, or destructive cleanup.

begin;

create or replace function public.code1_ops_retention_policy_proposal()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status','PROPOSAL_NOT_FROZEN',
    'executionMode','REPORT_ONLY',
    'autoPurge',false,
    'policies',jsonb_build_array(
      jsonb_build_object(
        'key','QA_TEST_FIXTURE','ttlDays',1,
        'behavior','IMMEDIATE_CLEANUP_WITH_1D_FALLBACK',
        'deleteEligible',true,
        'rationale','Synthetic QA residue should be removed immediately after acceptance; one day is a fallback alert window, not approval to schedule deletion.'
      ),
      jsonb_build_object(
        'key','OUTBOX_DELIVERED_NO_ACTION','ttlDays',14,
        'behavior','TERMINAL_OUTBOX_CANDIDATE',
        'deleteEligible',true,
        'rationale','Delivered or no-action transport rows have short-term retry/audit value after their source event is durable.'
      ),
      jsonb_build_object(
        'key','OUTBOX_FAILED_RETRYABLE','ttlDays',30,
        'behavior','REVIEW_ONLY',
        'deleteEligible',false,
        'rationale','Retryable failures must not be deleted automatically; thirty days is an escalation/review threshold only.'
      ),
      jsonb_build_object(
        'key','OPS_DATA_ONLY','ttlDays',90,
        'behavior','TERMINAL_EVENT_CANDIDATE',
        'deleteEligible',true,
        'rationale','Routine operational audit has lower long-term policy value once NO_PLANNING_ACTION is final.'
      ),
      jsonb_build_object(
        'key','PLANNING_UIUX_CODING_IMPACT','ttlDays',180,
        'behavior','DONE_AND_DELIVERED_ONLY',
        'deleteEligible',true,
        'rationale','Impact events should remain longer and are candidates only after DONE plus delivered outbox state.'
      ),
      jsonb_build_object(
        'key','POLICY_INCIDENT','ttlDays',365,
        'behavior','ARCHIVE_REVIEW_ONLY',
        'deleteEligible',false,
        'rationale','Policy and incident history has elevated audit value; archival policy must be separately approved before any deletion.'
      )
    )
  )
$$;

create or replace function public.code1_ops_capacity_report(
  p_actor_id text,
  p_configured_limit_bytes bigint default null,
  p_watch_percent numeric default 60,
  p_warning_percent numeric default 75,
  p_critical_percent numeric default 90
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_db_bytes bigint;
  v_events_table bigint;
  v_events_index bigint;
  v_events_total bigint;
  v_outbox_table bigint;
  v_outbox_index bigint;
  v_outbox_total bigint;
  v_event_count bigint;
  v_outbox_count bigint;
  v_event_oldest timestamptz;
  v_outbox_oldest timestamptz;
  v_event_avg numeric;
  v_outbox_avg numeric;
  v_ops_total bigint;
  v_util numeric;
  v_state text;
  v_reason text;
begin
  perform public.code1_ops_assert_owner(p_actor_id);

  if p_configured_limit_bytes is not null and p_configured_limit_bytes <= 0 then
    raise exception 'INVALID_CAPACITY_LIMIT';
  end if;
  if p_watch_percent <= 0 or p_warning_percent <= p_watch_percent or p_critical_percent <= p_warning_percent or p_critical_percent > 100 then
    raise exception 'INVALID_CAPACITY_THRESHOLDS';
  end if;

  v_db_bytes:=pg_database_size(current_database());
  v_events_table:=pg_relation_size('public.ops_change_events'::regclass);
  v_events_index:=pg_indexes_size('public.ops_change_events'::regclass);
  v_events_total:=pg_total_relation_size('public.ops_change_events'::regclass);
  v_outbox_table:=pg_relation_size('public.ops_outbox'::regclass);
  v_outbox_index:=pg_indexes_size('public.ops_outbox'::regclass);
  v_outbox_total:=pg_total_relation_size('public.ops_outbox'::regclass);
  v_ops_total:=v_events_total+v_outbox_total;

  select count(*),min(recorded_at),avg(pg_column_size(e.*))
    into v_event_count,v_event_oldest,v_event_avg
    from public.ops_change_events e;
  select count(*),min(created_at),avg(pg_column_size(o.*))
    into v_outbox_count,v_outbox_oldest,v_outbox_avg
    from public.ops_outbox o;

  if p_configured_limit_bytes is null then
    v_util:=null;
    v_state:='WATCH';
    v_reason:='CONFIGURED_LIMIT_UNKNOWN';
  else
    v_util:=round((v_db_bytes::numeric*100)/p_configured_limit_bytes,2);
    if v_util>=p_critical_percent then v_state:='CRITICAL';
    elsif v_util>=p_warning_percent then v_state:='WARNING';
    elsif v_util>=p_watch_percent then v_state:='WATCH';
    else v_state:='NORMAL'; end if;
    v_reason:='DATABASE_UTILIZATION';
  end if;

  return jsonb_build_object(
    'mode','REPORT_ONLY',
    'autoPurge',false,
    'database',jsonb_build_object(
      'bytes',v_db_bytes,
      'configuredLimitBytes',p_configured_limit_bytes,
      'limitKnown',p_configured_limit_bytes is not null,
      'utilizationPercent',v_util
    ),
    'ops',jsonb_build_object(
      'totalBytes',v_ops_total,
      'events',jsonb_build_object(
        'rowCount',v_event_count,
        'tableBytes',v_events_table,
        'indexBytes',v_events_index,
        'toastAuxBytes',greatest(v_events_total-v_events_table-v_events_index,0),
        'totalBytes',v_events_total,
        'oldestRetainedAt',v_event_oldest,
        'averageRowBytesMeasured',v_event_avg
      ),
      'outbox',jsonb_build_object(
        'rowCount',v_outbox_count,
        'tableBytes',v_outbox_table,
        'indexBytes',v_outbox_index,
        'toastAuxBytes',greatest(v_outbox_total-v_outbox_table-v_outbox_index,0),
        'totalBytes',v_outbox_total,
        'oldestRetainedAt',v_outbox_oldest,
        'averageRowBytesMeasured',v_outbox_avg
      )
    ),
    'growthRate',jsonb_build_object('available',false,'reason','SINGLE_SNAPSHOT_ONLY'),
    'threshold',jsonb_build_object(
      'state',v_state,
      'reason',v_reason,
      'watchPercent',p_watch_percent,
      'warningPercent',p_warning_percent,
      'criticalPercent',p_critical_percent
    )
  );
end;
$$;

create or replace function public.code1_ops_retention_dry_run(
  p_actor_id text,
  p_as_of timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy jsonb;
  v_qa_current bigint;
  v_qa_aged bigint;
  v_terminal_outbox bigint;
  v_failed_retryable bigint;
  v_ops_data_only bigint;
  v_impact bigint;
  v_policy_incident bigint;
begin
  perform public.code1_ops_assert_owner(p_actor_id);
  v_policy:=public.code1_ops_retention_policy_proposal();

  select count(*) filter (where entity_type='OWNER_QA_FIXTURE'),
         count(*) filter (where entity_type='OWNER_QA_FIXTURE' and recorded_at < p_as_of - interval '1 day')
    into v_qa_current,v_qa_aged
    from public.ops_change_events;

  select count(*) filter (
           where delivery_state in ('DELIVERED','NO_ACTION')
             and updated_at < p_as_of - interval '14 days'
         ),
         count(*) filter (
           where delivery_state='FAILED_RETRYABLE'
             and updated_at < p_as_of - interval '30 days'
         )
    into v_terminal_outbox,v_failed_retryable
    from public.ops_outbox;

  select count(*) filter (
           where e.event_class='OPS_DATA_ONLY'
             and e.relay_status='NO_PLANNING_ACTION'
             and e.recorded_at < p_as_of - interval '90 days'
             and exists(select 1 from public.ops_outbox o where o.event_id=e.event_id and o.delivery_state='NO_ACTION')
         ),
         count(*) filter (
           where e.event_class in ('PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT')
             and e.relay_status='DONE'
             and e.recorded_at < p_as_of - interval '180 days'
             and exists(select 1 from public.ops_outbox o where o.event_id=e.event_id and o.delivery_state='DELIVERED')
         ),
         count(*) filter (
           where e.event_class in ('POLICY_APPROVAL_REQUIRED','INCIDENT')
             and e.relay_status='DONE'
             and e.recorded_at < p_as_of - interval '365 days'
             and exists(select 1 from public.ops_outbox o where o.event_id=e.event_id and o.delivery_state='DELIVERED')
         )
    into v_ops_data_only,v_impact,v_policy_incident
    from public.ops_change_events e;

  return jsonb_build_object(
    'mode','DRY_RUN',
    'executionMode','REPORT_ONLY',
    'autoPurge',false,
    'asOf',p_as_of,
    'policy',v_policy,
    'counts',jsonb_build_object(
      'qaFixtureCurrent',v_qa_current,
      'qaFixturePastFallbackWindow',v_qa_aged,
      'terminalOutboxPast14d',v_terminal_outbox,
      'failedRetryablePast30dReviewOnly',v_failed_retryable,
      'opsDataOnlyPast90dTerminal',v_ops_data_only,
      'impactPast180dDoneDelivered',v_impact,
      'policyIncidentPast365dArchiveReviewOnly',v_policy_incident
    ),
    'mutationApplied',false
  );
end;
$$;

revoke all on function public.code1_ops_retention_policy_proposal() from public,anon,authenticated;
revoke all on function public.code1_ops_capacity_report(text,bigint,numeric,numeric,numeric) from public,anon,authenticated;
revoke all on function public.code1_ops_retention_dry_run(text,timestamptz) from public,anon,authenticated;
grant execute on function public.code1_ops_retention_policy_proposal() to service_role;
grant execute on function public.code1_ops_capacity_report(text,bigint,numeric,numeric,numeric) to service_role;
grant execute on function public.code1_ops_retention_dry_run(text,timestamptz) to service_role;

commit;
