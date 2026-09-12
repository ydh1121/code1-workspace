-- CODE1 Internal Workspace / STAGING ONLY
-- OPS CHANGE RELAY transactional acceptance. Leaves no synthetic business/event rows behind.

begin;

do $$
declare
  v jsonb;
  v2 jsonb;
  v_event_id text;
  v_child_id text;
  v_outbox_id text;
  v_claim record;
  v_count integer;
  v_caught boolean;
  v_classes text[] := array['OPS_DATA_ONLY','PLANNING_IMPACT','UIUX_IMPACT','CODING_IMPACT','POLICY_APPROVAL_REQUIRED','INCIDENT'];
  v_class text;
  v_req text;
  v_event public.ops_change_events%rowtype;
begin
  if (select count(*) from public.ops_change_events)<>0 or (select count(*) from public.ops_outbox)<>0 then
    raise exception 'OPS_ACCEPTANCE_REQUIRES_EMPTY_QUEUE';
  end if;

  insert into public.farms(farm_id,internal_name,public_name,source_system)
  values('OPS_TEST_FARM_ATOMIC','OPS TEST','OPS TEST','OPS_ACCEPTANCE');
  v:=public.code1_ops_delete_empty_farm('OWNER','OPS_TEST_FARM_ATOMIC','atomic commit probe','11111111111111111111111111111111');
  if exists(select 1 from public.farms where farm_id='OPS_TEST_FARM_ATOMIC') then raise exception 'OPS_ASSERT_ENTITY_NOT_DELETED'; end if;
  v_event_id:=v->'event'->>'event_id';
  if v_event_id is null then raise exception 'OPS_ASSERT_EVENT_MISSING'; end if;
  select count(*) into v_count from public.ops_outbox where event_id=v_event_id and delivery_state='NO_ACTION';
  if v_count<>1 or v->'event'->>'event_class'<>'OPS_DATA_ONLY' or v->'event'->>'relay_status'<>'NO_PLANNING_ACTION' then raise exception 'OPS_ASSERT_EVENT_OUTBOX_ATOMIC'; end if;
  v2:=public.code1_ops_delete_empty_farm('OWNER','OPS_TEST_FARM_ATOMIC','atomic commit probe','11111111111111111111111111111111');
  if v2->'event'->>'event_id'<>v_event_id then raise exception 'OPS_ASSERT_IDEMPOTENT_REPLAY'; end if;
  v_caught:=false;
  begin
    perform public.code1_ops_delete_empty_farm('OWNER','OPS_TEST_FARM_ATOMIC','different payload','11111111111111111111111111111111');
  exception when others then
    if sqlerrm not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'OPS_ASSERT_IDEMPOTENCY_CONFLICT_MISSING'; end if;
  delete from public.ops_change_events where event_id=v_event_id;
  delete from public.audit_log where request_id='11111111111111111111111111111111';

  v_caught:=false;
  begin
    perform public.code1_ops_delete_empty_farm('OWNER','OPS_TEST_FARM_MISSING','missing entity probe','22222222222222222222222222222222');
  exception when others then
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'OPS_ASSERT_ENTITY_FAILURE_MISSING'; end if;
  if exists(select 1 from public.ops_change_events where idempotency_key='22222222222222222222222222222222') then raise exception 'OPS_ASSERT_ENTITY_FAIL_EVENT_LEAK'; end if;

  insert into public.farms(farm_id,internal_name,public_name,source_system)
  values('OPS_TEST_FARM_ROLLBACK','OPS TEST ROLLBACK','OPS TEST ROLLBACK','OPS_ACCEPTANCE');
  create or replace function public.code1_ops_acceptance_fail_outbox() returns trigger
  language plpgsql set search_path = public, pg_temp as $f$
  begin raise exception 'OPS_ACCEPTANCE_FORCED_OUTBOX_FAIL'; end $f$;
  create trigger zz_ops_acceptance_fail_outbox before insert on public.ops_outbox
  for each row execute function public.code1_ops_acceptance_fail_outbox();
  v_caught:=false;
  begin
    perform public.code1_ops_delete_empty_farm('OWNER','OPS_TEST_FARM_ROLLBACK','forced outbox rollback','33333333333333333333333333333333');
  exception when others then
    if sqlerrm not like '%OPS_ACCEPTANCE_FORCED_OUTBOX_FAIL%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught then raise exception 'OPS_ASSERT_FORCED_OUTBOX_FAILURE_MISSING'; end if;
  if not exists(select 1 from public.farms where farm_id='OPS_TEST_FARM_ROLLBACK') then raise exception 'OPS_ASSERT_ENTITY_DID_NOT_ROLLBACK'; end if;
  if exists(select 1 from public.ops_change_events where idempotency_key='33333333333333333333333333333333') then raise exception 'OPS_ASSERT_EVENT_DID_NOT_ROLLBACK'; end if;
  drop trigger zz_ops_acceptance_fail_outbox on public.ops_outbox;
  drop function public.code1_ops_acceptance_fail_outbox();
  delete from public.farms where farm_id='OPS_TEST_FARM_ROLLBACK';

  foreach v_class in array v_classes loop
    v_req:=case v_class
      when 'OPS_DATA_ONLY' then '44444444444444444444444444444441'
      when 'PLANNING_IMPACT' then '44444444444444444444444444444442'
      when 'UIUX_IMPACT' then '44444444444444444444444444444443'
      when 'CODING_IMPACT' then '44444444444444444444444444444444'
      when 'POLICY_APPROVAL_REQUIRED' then '44444444444444444444444444444445'
      else '44444444444444444444444444444446' end;
    v_event:=public.code1_ops_record_manual_event(
      'OWNER','ACCEPTANCE','CLASS_'||v_class,'acceptance.classification',v_class,array['probe'],
      case v_class when 'PLANNING_IMPACT' then array['PLANNING']::text[] when 'UIUX_IMPACT' then array['UIUX']::text[] when 'CODING_IMPACT' then array['CODING']::text[] else array[]::text[] end,
      jsonb_build_array(jsonb_build_object('kind','TEST','ref','OPS_ACCEPTANCE','sha256',repeat('a',64),'size','0','mime','text/plain')),
      'COR_OPS_ACCEPTANCE',null,v_req
    );
    if v_event.event_class<>v_class then raise exception 'OPS_ASSERT_CLASS_MISMATCH:%',v_class; end if;
    if v_class='OPS_DATA_ONLY' and (v_event.planning_relevance or v_event.relay_status<>'NO_PLANNING_ACTION') then raise exception 'OPS_ASSERT_DATA_ONLY_RELAY'; end if;
    if v_class='POLICY_APPROVAL_REQUIRED' and (v_event.relay_status<>'BLOCKED_POLICY' or coalesce((v_event.result_json->>'mutationApplied')::boolean,true)) then raise exception 'OPS_ASSERT_POLICY_FAIL_CLOSED'; end if;
    if v_class='INCIDENT' and v_event.priority<>'P0' then raise exception 'OPS_ASSERT_INCIDENT_PRIORITY'; end if;
  end loop;
  if (select count(*) from public.ops_outbox o join public.ops_change_events e on e.event_id=o.event_id where e.correlation_id='COR_OPS_ACCEPTANCE' and e.event_class='OPS_DATA_ONLY' and o.delivery_state='NO_ACTION')<>1 then raise exception 'OPS_ASSERT_DATA_ONLY_OUTBOX'; end if;
  if (select count(*) from public.ops_outbox o join public.ops_change_events e on e.event_id=o.event_id where e.correlation_id='COR_OPS_ACCEPTANCE' and e.event_class<>'OPS_DATA_ONLY' and o.delivery_state='PENDING')<>5 then raise exception 'OPS_ASSERT_PLANNING_CANDIDATES'; end if;

  v_caught:=false;
  begin
    perform public.code1_ops_record_manual_event('OWNER','ACCEPTANCE','UNSAFE','acceptance.evidence','PLANNING_IMPACT',array['probe'],array['PLANNING'],jsonb_build_array(jsonb_build_object('kind','URL','ref','https://example.invalid/signed?token=secret')),'COR_UNSAFE',null,'55555555555555555555555555555555');
  exception when others then
    if sqlerrm not like '%UNSAFE_EVIDENCE_REF%' then raise; end if;
    v_caught:=true;
  end;
  if not v_caught or exists(select 1 from public.ops_change_events where idempotency_key='55555555555555555555555555555555') then raise exception 'OPS_ASSERT_EVIDENCE_FAIL_CLOSED'; end if;

  select * into v_event from public.ops_change_events where idempotency_key='44444444444444444444444444444441';
  v_event_id:=v_event.event_id;
  select (public.code1_ops_request_planning_review('OWNER',v_event_id,'66666666666666666666666666666666')).event_id into v_child_id;
  if not exists(select 1 from public.ops_change_events where event_id=v_child_id and event_class='PLANNING_IMPACT' and causation_id=v_event_id and correlation_id=v_event.correlation_id) then raise exception 'OPS_ASSERT_PLANNING_CHILD'; end if;
  if not exists(select 1 from public.ops_outbox where event_id=v_child_id and delivery_state='PENDING') then raise exception 'OPS_ASSERT_PLANNING_CHILD_OUTBOX'; end if;

  delete from public.ops_change_events where correlation_id='COR_OPS_ACCEPTANCE';
  delete from public.ops_change_events where event_id=v_child_id;

  v_event:=public.code1_ops_record_manual_event('OWNER','ACCEPTANCE','RETRY','acceptance.retry','PLANNING_IMPACT',array['probe'],array['PLANNING'],'[]'::jsonb,'COR_RETRY',null,'77777777777777777777777777777771');
  select * into v_claim from public.code1_ops_claim_outbox('ops-acceptance-v1',1);
  if v_claim.event_id<>v_event.event_id or v_claim.attempt_count<>1 then raise exception 'OPS_ASSERT_CLAIM'; end if;
  v_outbox_id:=v_claim.outbox_id;
  perform public.code1_ops_ack_outbox(v_outbox_id,'ops-acceptance-v1','RETRY','SYNTHETIC_RETRY');
  if not exists(select 1 from public.ops_outbox where outbox_id=v_outbox_id and delivery_state='FAILED_RETRYABLE' and attempt_count=1 and last_error_code='SYNTHETIC_RETRY') then raise exception 'OPS_ASSERT_RETRY_PRESERVED'; end if;
  if not exists(select 1 from public.ops_change_events where event_id=v_event.event_id and relay_status='FAILED_RECOVERABLE') then raise exception 'OPS_ASSERT_RETRY_EVENT_STATUS'; end if;
  delete from public.ops_change_events where event_id=v_event.event_id;

  v_event:=public.code1_ops_record_manual_event('OWNER','ACCEPTANCE','LIFECYCLE','acceptance.lifecycle','PLANNING_IMPACT',array['probe'],array['PLANNING'],'[]'::jsonb,'COR_LIFECYCLE',null,'77777777777777777777777777777772');
  perform public.code1_ops_transition_event(v_event.event_id,'PLANNING_REVIEW');
  perform public.code1_ops_transition_event(v_event.event_id,'APPLIED_TO_SSOT');
  perform public.code1_ops_transition_event(v_event.event_id,'DISPATCHED');
  perform public.code1_ops_transition_event(v_event.event_id,'IN_PROGRESS');
  perform public.code1_ops_transition_event(v_event.event_id,'DONE');
  v_caught:=false;
  begin perform public.code1_ops_transition_event(v_event.event_id,'RECORDED'); exception when others then if sqlerrm not like '%INVALID_RELAY_TRANSITION%' then raise; end if; v_caught:=true; end;
  if not v_caught then raise exception 'OPS_ASSERT_ILLEGAL_TRANSITION'; end if;
  delete from public.ops_change_events where event_id=v_event.event_id;

  if has_table_privilege('anon','public.ops_change_events','SELECT') or has_table_privilege('authenticated','public.ops_change_events','SELECT') then raise exception 'OPS_ASSERT_TABLE_RBAC'; end if;
  if has_table_privilege('anon','public.ops_outbox','SELECT') or has_table_privilege('authenticated','public.ops_outbox','SELECT') then raise exception 'OPS_ASSERT_OUTBOX_RBAC'; end if;
  if has_function_privilege('anon','public.code1_ops_request_planning_review(text,text,text)','EXECUTE') or has_function_privilege('authenticated','public.code1_ops_request_planning_review(text,text,text)','EXECUTE') then raise exception 'OPS_ASSERT_RPC_RBAC'; end if;

  delete from public.ops_change_events where entity_type='ACCEPTANCE' or correlation_id like 'COR_%';
  delete from public.audit_log where request_id in ('22222222222222222222222222222222','33333333333333333333333333333333');
  if exists(select 1 from public.farms where farm_id like 'OPS_TEST_FARM_%') then raise exception 'OPS_ASSERT_SYNTHETIC_FARM_LEAK'; end if;
  if (select count(*) from public.ops_change_events)<>0 or (select count(*) from public.ops_outbox)<>0 then raise exception 'OPS_ASSERT_QUEUE_NOT_CLEAN'; end if;
end $$;

commit;
