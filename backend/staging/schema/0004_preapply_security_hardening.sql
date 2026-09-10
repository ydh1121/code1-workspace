-- CODE1 Internal Workspace / STAGING ONLY
-- Pre-apply security hardening found during the 2026-09-10 schema audit.
-- Apply after 0001_runtime.sql, 0002_mutations.sql, and 0003_planning_delta_20260910.sql.
-- Do not apply to Production or the current live runtime.

begin;

-- A FARM housing-environment record must identify the same farm in both identity fields.
-- VERIFIED values require actual evidence; a source value alone is not verification.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='housing_environment_farm_subject_consistency'
  ) then
    alter table housing_environment_records
      add constraint housing_environment_farm_subject_consistency
      check (subject_type <> 'FARM' or (farm_id is not null and subject_id = farm_id));
  end if;

  if not exists (
    select 1 from pg_constraint where conname='housing_environment_verified_requires_evidence'
  ) then
    alter table housing_environment_records
      add constraint housing_environment_verified_requires_evidence
      check (verification_status <> 'VERIFIED' or evidence_ref is not null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname='fact_verified_requires_evidence'
  ) then
    alter table fact_inbox
      add constraint fact_verified_requires_evidence
      check (status not in ('VERIFIED','APPROVED_CURRENT') or evidence_ref is not null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname='fact_external_disclosure_disabled_staging'
  ) then
    alter table fact_inbox
      add constraint fact_external_disclosure_disabled_staging
      check (external_disclosure_allowed = false);
  end if;
end
$$;

-- A stable submission ID may not be reassigned to a different farm. This is enforced
-- inside the service-role RPC because RLS is intentionally bypassed by that server path.
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
  v_existing_farm text;
  v_item record;
  v_input_type text;
begin
  if p_status not in ('DRAFT','SUBMITTED') then raise exception 'INVALID_STATUS'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'INVALID_ANSWERS'; end if;

  select true, s.current_revision, s.farm_id into v_exists, v_current, v_existing_farm
  from intake_submissions s where s.submission_id=p_submission_id for update;

  if coalesce(v_exists,false) then
    if v_current <> p_base_revision then raise exception 'CONFLICT'; end if;
    if v_existing_farm is distinct from p_farm_id then raise exception 'SUBMISSION_FARM_IMMUTABLE'; end if;
  else
    if p_base_revision <> 0 then raise exception 'CONFLICT'; end if;
    insert into intake_submissions(submission_id,farm_id,farm_name_snapshot,status,current_revision,created_by,last_edited_by,latest_request_id)
    values(p_submission_id,p_farm_id,coalesce(p_farm_name,''),p_status,0,p_actor_id,p_actor_id,p_request_id);
    v_current:=0;
  end if;

  v_next:=v_current+1;
  update intake_submissions set
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

-- Replace the first Planning Delta transition RPC. DOCUMENT_RECEIVED must carry evidence,
-- and later VERIFIED / APPROVED_CURRENT states are therefore impossible without evidence.
drop function if exists code1_transition_fact(text,text,text,text,numeric,text);

create function code1_transition_fact(
  p_actor_id text,
  p_fact_id text,
  p_to_status text,
  p_note text,
  p_confidence numeric,
  p_evidence_ref jsonb,
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

  if p_to_status='DOCUMENT_RECEIVED' and coalesce(p_evidence_ref,v_old.evidence_ref) is null then
    raise exception 'EVIDENCE_REQUIRED';
  end if;
  if p_to_status in ('VERIFIED','APPROVED_CURRENT') and v_old.evidence_ref is null then
    raise exception 'EVIDENCE_REQUIRED';
  end if;

  update fact_inbox f set
    status=p_to_status,
    evidence_ref=case when p_to_status='DOCUMENT_RECEIVED' then coalesce(p_evidence_ref,f.evidence_ref) else f.evidence_ref end,
    verification_note=case when p_to_status in ('VERIFIED','APPROVED_CURRENT') then coalesce(p_note,f.verification_note) else f.verification_note end,
    verification_confidence=case when p_to_status='VERIFIED' then p_confidence else f.verification_confidence end,
    verified_by=case when p_to_status='VERIFIED' then p_actor_id else f.verified_by end,
    verified_at=case when p_to_status='VERIFIED' then now() else f.verified_at end,
    approved_current_by=case when p_to_status='APPROVED_CURRENT' then p_actor_id else f.approved_current_by end,
    approved_current_at=case when p_to_status='APPROVED_CURRENT' then now() else f.approved_current_at end,
    updated_by=p_actor_id,
    updated_at=now()
  where f.fact_id=p_fact_id;

  insert into fact_events(fact_id,actor_id,event_type,from_status,to_status,note,request_id,metadata)
  values(
    p_fact_id,p_actor_id,'STATUS_CHANGED',v_old.status,p_to_status,p_note,p_request_id,
    case when p_to_status='DOCUMENT_RECEIVED' then jsonb_build_object('evidence_received',true) else '{}'::jsonb end
  );

  return query select f.fact_id,f.status,f.updated_at from fact_inbox f where f.fact_id=p_fact_id;
end;
$$;

-- Supabase public-schema functions are executable by PUBLIC unless ACLs are tightened.
-- Browser roles must not invoke service-boundary mutation RPCs directly.
revoke all on function code1_save_submission(text,text,text,text,text,integer,text,jsonb) from public, anon, authenticated;
revoke all on function code1_review_submission(text,text,integer,text,text,text) from public, anon, authenticated;
revoke all on function code1_review_media(text,text,text,text,text) from public, anon, authenticated;
revoke all on function code1_save_question_policies(text,text,jsonb) from public, anon, authenticated;
revoke all on function code1_transition_fact(text,text,text,text,numeric,jsonb,text) from public, anon, authenticated;

 grant execute on function code1_save_submission(text,text,text,text,text,integer,text,jsonb) to service_role;
 grant execute on function code1_review_submission(text,text,integer,text,text,text) to service_role;
 grant execute on function code1_review_media(text,text,text,text,text) to service_role;
 grant execute on function code1_save_question_policies(text,text,jsonb) to service_role;
 grant execute on function code1_transition_fact(text,text,text,text,numeric,jsonb,text) to service_role;

commit;
