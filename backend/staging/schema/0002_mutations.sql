-- CODE1 Internal Workspace STAGING mutation helpers.
-- Apply only after 0001_runtime.sql and only to the separately approved CODE1 STAGING project.

begin;

create or replace function code1_review_submission(
  p_actor_id text,
  p_submission_id text,
  p_base_revision integer,
  p_status text,
  p_note text,
  p_request_id text
) returns table(submission_id text, revision integer, status text)
language plpgsql
as $$
declare
  v_old text;
  v_rev integer;
begin
  select s.status,s.current_revision into v_old,v_rev
  from intake_submissions s where s.submission_id=p_submission_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_rev <> p_base_revision then raise exception 'CONFLICT'; end if;
  if not (
    (v_old='SUBMITTED' and p_status in ('NEEDS_INFO','APPROVED','REJECTED')) or
    (v_old='NEEDS_INFO' and p_status in ('APPROVED','REJECTED')) or
    (v_old='APPROVED' and p_status='REFLECTED')
  ) then raise exception 'INVALID_REVIEW_TRANSITION'; end if;
  v_rev:=v_rev+1;
  update intake_submissions set status=p_status,current_revision=v_rev,review_note=left(coalesce(p_note,''),1000),reviewer_id=p_actor_id,reviewed_at=now(),updated_at=now(),latest_request_id=p_request_id where intake_submissions.submission_id=p_submission_id;
  insert into review_decisions(subject_type,subject_id,old_status,new_status,note,actor_id,request_id)
    values('SUBMISSION',p_submission_id,v_old,p_status,left(coalesce(p_note,''),1000),p_actor_id,p_request_id);
  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id)
    values(p_actor_id,'submission.review','SUBMISSION',p_submission_id,v_old||'→'||p_status,p_request_id);
  return query select p_submission_id,v_rev,p_status;
end;
$$;

create or replace function code1_review_media(
  p_actor_id text,
  p_media_id text,
  p_status text,
  p_note text,
  p_request_id text
) returns table(media_id text, status text)
language plpgsql
as $$
declare v_old text;
begin
  if p_status not in ('APPROVED','REJECTED') then raise exception 'INVALID_MEDIA_STATUS'; end if;
  select m.status into v_old from media_assets m where m.media_id=p_media_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_old='DELETED' then raise exception 'FORBIDDEN'; end if;
  update media_assets set status=p_status,review_note=left(coalesce(p_note,''),1000),reviewed_by=p_actor_id,reviewed_at=now() where media_assets.media_id=p_media_id;
  insert into media_events(actor_id,media_id,event_type,from_status,to_status,object_key,detail,request_id)
    select p_actor_id,m.media_id,'REVIEWED',v_old,p_status,m.object_key,left(coalesce(p_note,''),1000),p_request_id from media_assets m where m.media_id=p_media_id;
  insert into review_decisions(subject_type,subject_id,old_status,new_status,note,actor_id,request_id)
    values('MEDIA',p_media_id,v_old,p_status,left(coalesce(p_note,''),1000),p_actor_id,p_request_id);
  return query select p_media_id,p_status;
end;
$$;

create or replace function code1_save_question_policies(
  p_actor_id text,
  p_request_id text,
  p_changes jsonb
) returns jsonb
language plpgsql
as $$
declare
  c jsonb;
  v_scope text;
  v_farm text;
  v_item text;
  v_mode text;
  v_reason text;
  v_note text;
  v_base integer;
  v_old question_policies%rowtype;
  v_id text;
  v_ver integer;
  v_out jsonb := '[]'::jsonb;
begin
  if p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)=0 or jsonb_array_length(p_changes)>300 then raise exception 'INVALID_POLICY_REQUEST'; end if;
  for c in select value from jsonb_array_elements(p_changes) loop
    v_scope:=coalesce(c->>'scope','');v_farm:=nullif(c->>'farmId','');v_item:=coalesce(c->>'itemKey','');v_mode:=coalesce(c->>'mode','');v_reason:=nullif(c->>'reasonCode','');v_note:=nullif(btrim(c->>'reasonNote'),'');v_base:=coalesce((c->>'baseVersion')::integer,0);
    if v_scope='GLOBAL' then v_farm:=null; if v_mode not in ('SHOW','OPTIONAL','HIDE','PERMANENT_EXCLUDE') then raise exception 'INVALID_POLICY_MODE'; end if;
    elsif v_scope='FARM' then if v_farm is null then raise exception 'INVALID_POLICY_FARM'; end if; if v_mode not in ('INHERIT','SHOW','OPTIONAL','HIDE','NOT_APPLICABLE') then raise exception 'INVALID_POLICY_MODE'; end if;
    else raise exception 'INVALID_POLICY_SCOPE'; end if;
    if not exists(select 1 from question_catalog q where q.item_key=v_item) then raise exception 'INVALID_POLICY_ITEM'; end if;
    if v_scope='FARM' and not exists(select 1 from farms f where f.farm_id=v_farm) then raise exception 'INVALID_POLICY_FARM'; end if;
    if v_mode in ('OPTIONAL','HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE') then
      if v_reason not in ('DUPLICATE','DERIVED','NOT_APPLICABLE','LATER_PHASE','COLLECT_LATER','SENSITIVE','LOW_VALUE','OTHER') or v_note is null then raise exception 'POLICY_REASON_REQUIRED'; end if;
    else v_reason:=null;v_note:=null; end if;

    select * into v_old from question_policies q where q.status='active' and q.scope=v_scope and coalesce(q.farm_id,'')=coalesce(v_farm,'') and q.item_key=v_item for update;
    if found then
      if v_old.version<>v_base then raise exception 'CONFLICT'; end if;
      v_id:=v_old.policy_id;v_ver:=v_old.version+1;
      update question_policies set mode=v_mode,reason_code=v_reason,reason_note=left(v_note,500),version=v_ver,updated_by=p_actor_id,updated_at=now(),request_id=p_request_id where policy_id=v_id;
    else
      if v_base<>0 then raise exception 'CONFLICT'; end if;
      v_id:='QP_'||substr(md5(random()::text||clock_timestamp()::text),1,24);v_ver:=1;
      insert into question_policies(policy_id,scope,farm_id,item_key,mode,reason_code,reason_note,version,status,updated_by,updated_at,request_id)
      values(v_id,v_scope,v_farm,v_item,v_mode,v_reason,left(v_note,500),v_ver,'active',p_actor_id,now(),p_request_id);
    end if;
    insert into question_policy_history(actor_id,policy_id,scope,farm_id,item_key,before_mode,after_mode,reason_code,reason_note,version,request_id,before_json,after_json)
    values(p_actor_id,v_id,v_scope,v_farm,v_item,case when v_old.policy_id is null then null else v_old.mode end,v_mode,v_reason,left(v_note,500),v_ver,p_request_id,case when v_old.policy_id is null then null else to_jsonb(v_old) end,(select to_jsonb(q) from question_policies q where q.policy_id=v_id));
    v_out:=v_out||jsonb_build_array((select to_jsonb(q) from question_policies q where q.policy_id=v_id));
  end loop;
  insert into audit_log(actor_id,action,target_type,target_id,detail,request_id) values(p_actor_id,'question-policy.save','QUESTION_POLICY',null,jsonb_array_length(p_changes)||' changes',p_request_id);
  return v_out;
end;
$$;

commit;
