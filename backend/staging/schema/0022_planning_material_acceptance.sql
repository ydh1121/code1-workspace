-- CODE1 Planning Material Workspace REV B / STAGING ONLY
-- Identity-safe shared review/media event corrections + submit dedupe contract.
-- Acceptance fixtures live in 0023 so this migration remains replay-safe.

begin;

alter table public.review_decisions drop constraint if exists review_decisions_subject_type_check;
alter table public.review_decisions add constraint review_decisions_subject_type_check
  check(subject_type in ('SUBMISSION','MEDIA','PLANNING_MATERIAL_ITEM'));

create or replace function public.code1_material_finalize_file_version(p_actor_id text,p_media_id text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_ver public.planning_material_file_versions%rowtype;
  v_file public.planning_material_files%rowtype;
  v_item public.planning_material_request_items%rowtype;
  v_media public.media_assets%rowtype;
  v_event_id bigint;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  select * into v_ver from public.planning_material_file_versions where media_id=p_media_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_file from public.planning_material_files where material_file_id=v_ver.material_file_id for update;
  select * into v_item from public.planning_material_request_items where request_item_id=v_file.request_item_id for update;
  if not (public.code1_material_has_cap(p_actor_id,'MATERIAL_REQUEST_MANAGE') or public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') or public.code1_material_assigned(p_actor_id,v_item.material_request_id)) then raise exception 'FORBIDDEN'; end if;
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
  update public.planning_material_request_items set submission_state='FILE_SUBMITTED',review_status=case when review_status='REQUESTED' then 'RECEIVED' else review_status end,updated_by=p_actor_id,updated_at=now() where request_item_id=v_item.request_item_id;
  update public.planning_material_requests set status=case when status in ('REQUESTED','DRAFT') then 'IN_PROGRESS' else status end,updated_by=p_actor_id,updated_at=now() where material_request_id=v_item.material_request_id;
  insert into public.media_events(actor_id,media_id,event_type,from_status,to_status,object_key,detail,request_id,metadata)
  values(p_actor_id,p_media_id,'PLANNING_MATERIAL_UPLOAD',v_media.status,'REVIEW_REQUIRED',v_media.object_key,'Planning material file finalized',p_request_id,jsonb_build_object('material_request_id',v_item.material_request_id,'request_item_id',v_item.request_item_id,'version_id',v_ver.version_id))
  returning event_id into v_event_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.material.file.finalize','PLANNING_MATERIAL_FILE',v_file.material_file_id,'파일 revision 업로드 완료',p_request_id,jsonb_build_object('version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'media_event_id',v_event_id));
  return jsonb_build_object('material_file_id',v_file.material_file_id,'version_id',v_ver.version_id,'revision',v_ver.revision,'media_id',p_media_id,'idempotent',false);
end $$;

create or replace function public.code1_material_review_item(p_actor_id text,p_request_item_id text,p_review_status text,p_note text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item public.planning_material_request_items%rowtype;v_decision bigint;
begin
  if not public.code1_material_has_cap(p_actor_id,'MATERIAL_REVIEW') then raise exception 'FORBIDDEN'; end if;
  if p_request_id !~ '^[a-f0-9]{32}$' or p_review_status not in ('REQUESTED','RECEIVED','NEEDS_INFO','VERIFIED','REJECTED','SUPERSEDED') then raise exception 'INVALID_REQUEST'; end if;
  select * into v_item from public.planning_material_request_items where request_item_id=p_request_item_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select decision_id into v_decision from public.review_decisions where subject_type='PLANNING_MATERIAL_ITEM' and subject_id=p_request_item_id and request_id=p_request_id;
  if found then return jsonb_build_object('request_item_id',p_request_item_id,'review_status',v_item.review_status,'decision_id',v_decision,'idempotent',true); end if;
  update public.planning_material_request_items set review_status=p_review_status,updated_by=p_actor_id,updated_at=now() where request_item_id=p_request_item_id;
  insert into public.review_decisions(subject_type,subject_id,old_status,new_status,note,actor_id,request_id)
  values('PLANNING_MATERIAL_ITEM',p_request_item_id,v_item.review_status,p_review_status,left(coalesce(p_note,''),4000),p_actor_id,p_request_id)
  returning decision_id into v_decision;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.material.item.review','PLANNING_MATERIAL_ITEM',p_request_item_id,'자료 항목 검토 상태 변경',p_request_id,jsonb_build_object('before',v_item.review_status,'after',p_review_status,'note',left(coalesce(p_note,''),4000),'decision_id',v_decision));
  return jsonb_build_object('request_item_id',p_request_item_id,'review_status',p_review_status,'decision_id',v_decision,'idempotent',false);
end $$;

create or replace function public.code1_material_submit_request(p_actor_id text,p_material_request_id text,p_target_status text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_r public.planning_material_requests%rowtype;v_internal boolean;v_manifest jsonb;v_hash text;v_event_id text;v_outbox_id text;v_event_key text;v_artifact_id text;
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
  update public.planning_material_requests set status=p_target_status,submitted_at=coalesce(submitted_at,now()),review_status='RECEIVED',revision=revision+1,manifest_revision=manifest_revision+1,manifest_ready_at=now(),updated_by=p_actor_id,updated_at=now() where material_request_id=p_material_request_id returning * into v_r;
  select public.code1_material_manifest(case when v_internal then p_actor_id else 'OWNER' end,p_material_request_id) into v_manifest;
  v_hash:=public.code1_ops_hash_json(v_manifest);
  v_artifact_id:='PMA_'||regexp_replace(p_material_request_id,'[^A-Za-z0-9]','','g');
  insert into public.planning_source_artifacts(artifact_id,source_type,source_ref,title,confidentiality,object_key,public_delivery_allowed,metadata,created_at,updated_at)
  values(v_artifact_id,'PLANNING_MATERIAL_MANIFEST',p_material_request_id,v_r.title,'INTERNAL_CONFIDENTIAL',null,false,jsonb_build_object('manifest_revision',v_r.manifest_revision,'sha256',v_hash,'purpose',v_r.purpose),now(),now())
  on conflict(artifact_id) do update set title=excluded.title,metadata=excluded.metadata,updated_at=now(),public_delivery_allowed=false;
  v_event_key:=md5('planning-material:'||p_material_request_id||':'||p_target_status||':'||v_hash);
  select event_id into v_event_id from public.ops_change_events where idempotency_key=v_event_key;
  if v_event_id is null then
    v_event_id:='OCE_'||replace(gen_random_uuid()::text,'-','');v_outbox_id:='OOB_'||replace(gen_random_uuid()::text,'-','');
    insert into public.ops_change_events(event_id,source_system,source_version,entity_type,entity_id,action,changed_fields,before_hash,after_hash,actor_ref,event_class,planning_relevance,suggested_tracks,evidence_refs,correlation_id,causation_id,idempotency_key,payload_hash,priority,result_json,relay_status)
    values(v_event_id,'TEMP_ADMIN','PLANNING_MATERIAL_v1','PLANNING_MATERIAL_REQUEST',p_material_request_id,'planning.material.request.'||lower(p_target_status),array['status','manifest_revision'],null,v_hash,p_actor_id,'PLANNING_IMPACT',true,array['PLANNING'],jsonb_build_array(jsonb_build_object('kind','manifest','ref',p_material_request_id,'sha256',v_hash,'version',v_r.manifest_revision::text,'source','SUPABASE_STAGING')),v_event_id,null,v_event_key,v_hash,'P1',jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision),'RECORDED');
    insert into public.ops_outbox(outbox_id,event_id,delivery_state,idempotency_key,dedupe_key) values(v_outbox_id,v_event_id,'PENDING','OB_'||v_event_key,'PM_'||p_material_request_id||'_'||p_target_status||'_'||v_hash);
  end if;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.material.request.submit','PLANNING_MATERIAL_REQUEST',p_material_request_id,'자료 package 제출/검토준비',p_request_id,jsonb_build_object('status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id));
  return jsonb_build_object('material_request_id',p_material_request_id,'status',p_target_status,'manifest_revision',v_r.manifest_revision,'manifest_sha256',v_hash,'ops_event_id',v_event_id,'idempotent',false);
end $$;

revoke all on function public.code1_material_finalize_file_version(text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_review_item(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.code1_material_submit_request(text,text,text,text) from public,anon,authenticated;
grant execute on function public.code1_material_finalize_file_version(text,text,text) to service_role;
grant execute on function public.code1_material_review_item(text,text,text,text,text) to service_role;
grant execute on function public.code1_material_submit_request(text,text,text,text) to service_role;

commit;
