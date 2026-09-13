-- CODE1 Planning Material Workspace REV B / STAGING ONLY
-- Synthetic transactional acceptance. All fixtures are removed before commit.

begin;

DO $$
DECLARE
  v_template constant text:='PMT_QA_REV_B';
  v_partner constant text:='QA_PM_PARTNER';
  v_outsider constant text:='QA_PM_OUTSIDER';
  v_request text;v_item text;v_file jsonb;v_manifest jsonb;v_submit jsonb;v_repeat jsonb;v_event text;v_count integer;
  v_denied boolean:=false;v_catalog_denied boolean:=false;
  v_labels text[];
BEGIN
  select array_agg(label order by sort_order) into v_labels
  from public.planning_material_template_items
  where template_id='PMT_GREAT_FARM_DEFAULT' and active;
  if cardinality(v_labels)<>7 or v_labels<>array[
    '현재 상품명, 구성, 패키지 전후면',
    '현재 생산농장, 사육환경, 생산자',
    '동물복지, 무항생제, HACCP 등 현재 인증서',
    'JS-3550 또는 실제 급이원료 사양, 급이 방식',
    '현재 생란 제품과 직접 연결되는 바나듐 분석성적서(단위/시료/lot 포함)',
    '현재 선별, 포장, 출고, 배송 방식',
    '사업자등록증'
  ]::text[] then raise exception 'QA_DEFAULT_7_MISMATCH'; end if;

  insert into public.workspace_accounts(account_id,username,display_name,email,role,status,permissions_json,session_version)
  values(v_partner,'qa.pm.partner','QA Planning Material Partner','','PARTNER','active','{}'::jsonb,1),
        (v_outsider,'qa.pm.outsider','QA Planning Material Outsider','','PARTNER','active','{}'::jsonb,1);
  insert into public.account_capabilities(account_id,capability,effect,granted_by,note) values
    (v_partner,'ACCESS_PROFILE_INITIALIZED','ALLOW','OWNER','synthetic acceptance'),
    (v_partner,'MATERIAL_UPLOAD_ASSIGNED','ALLOW','OWNER','synthetic acceptance'),
    (v_outsider,'ACCESS_PROFILE_INITIALIZED','ALLOW','OWNER','synthetic acceptance'),
    (v_outsider,'MATERIAL_UPLOAD_ASSIGNED','ALLOW','OWNER','synthetic acceptance');

  insert into public.planning_material_templates(template_id,name,status,current_revision,created_by,updated_by)
  values(v_template,'QA template','ACTIVE',1,'OWNER','OWNER');
  insert into public.planning_material_template_items(template_id,item_key,label,description,required,sort_order,active,classification_hint,updated_by) values
    (v_template,'QA_ITEM_A','현재 인증서','QA',true,1,true,'04_인증_검사_성적서','OWNER'),
    (v_template,'QA_ITEM_B','사업자등록증','QA',false,2,true,'01_사업자_법인','OWNER');
  insert into public.planning_material_template_revisions(template_id,revision,items_snapshot,actor_id,request_id)
  select v_template,1,jsonb_agg(jsonb_build_object('item_key',item_key,'label',label,'required',required,'sort_order',sort_order,'active',active,'classification_hint',classification_hint) order by sort_order),'OWNER',repeat('0',32)
  from public.planning_material_template_items where template_id=v_template;

  begin
    perform public.code1_material_save_template(v_partner,v_template,1,'[]'::jsonb,repeat('f',32));
  exception when others then v_catalog_denied:=true; end;
  if not v_catalog_denied then raise exception 'QA_UNAUTHORIZED_CATALOG_MUTATION_NOT_DENIED'; end if;

  v_request:=public.code1_material_create_request('OWNER','QA request','QA company',jsonb_build_object('name','QA product','sku','QA-SKU'),'BOTH',null,v_template,array[v_partner],repeat('1',32))->>'material_request_id';
  if v_request is null then raise exception 'QA_REQUEST_CREATE_FAILED'; end if;
  select request_item_id into v_item from public.planning_material_request_items where material_request_id=v_request and item_key='QA_ITEM_A';
  if (select label_snapshot from public.planning_material_request_items where request_item_id=v_item)<>'현재 인증서' then raise exception 'QA_SNAPSHOT_SEED_FAILED'; end if;

  perform public.code1_material_save_template('OWNER',v_template,1,jsonb_build_array(
    jsonb_build_object('item_key','QA_ITEM_B','label','사업자등록증','description','QA','required',true,'sort_order',1,'active',true,'classification_hint','01_사업자_법인'),
    jsonb_build_object('item_key','QA_ITEM_A','label','현재 인증서 및 허가·신고자료','description','QA2','required',false,'sort_order',2,'active',true,'classification_hint','04_인증_검사_성적서'),
    jsonb_build_object('item_key','QA_ITEM_C','label','추가 항목','description','QA3','required',false,'sort_order',3,'active',false,'classification_hint','10_기타')
  ),repeat('2',32));
  if (select label_snapshot from public.planning_material_request_items where request_item_id=v_item)<>'현재 인증서' then raise exception 'QA_REQUEST_SNAPSHOT_MUTATED'; end if;
  if (select current_revision from public.planning_material_templates where template_id=v_template)<>2 then raise exception 'QA_TEMPLATE_REVISION_FAILED'; end if;
  if not exists(select 1 from public.planning_material_template_items where template_id=v_template and item_key='QA_ITEM_A' and label='현재 인증서 및 허가·신고자료' and required=false and sort_order=2) then raise exception 'QA_TEMPLATE_RENAME_REORDER_REQUIRED_FAILED'; end if;
  if not exists(select 1 from public.planning_material_template_items where template_id=v_template and item_key='QA_ITEM_C' and active=false and archived_at is not null) then raise exception 'QA_TEMPLATE_ARCHIVE_FAILED'; end if;

  perform public.code1_material_set_item_submission(v_partner,v_item,'LATER','추후 제출',repeat('3',32));
  begin
    perform public.code1_material_set_item_submission(v_outsider,v_item,'NOT_APPLICABLE','should fail',repeat('4',32));
  exception when others then v_denied:=true; end;
  if not v_denied then raise exception 'QA_UNASSIGNED_ACCESS_NOT_DENIED'; end if;

  v_file:=public.code1_material_begin_file_version(v_partner,v_item,null,jsonb_build_object(
    'media_id','M_QA_PM_REV_B_1',
    'object_key','private/planning-materials/QA/request/item/M_QA_PM_REV_B_1/original/qa.pdf',
    'original_file_name','qa.pdf','mime_type','application/pdf','file_size_bytes',1234,
    'checksum_sha256',repeat('a',64),'rights_owner','QA','rights_use_state','REVIEW_REQUIRED',
    'r2_multipart_upload_id','QA-MULTIPART','upload_chunk_bytes',6291456
  ),repeat('5',32));
  if v_file->>'media_id'<>'M_QA_PM_REV_B_1' then raise exception 'QA_FILE_BEGIN_FAILED'; end if;
  perform public.code1_material_finalize_file_version(v_partner,'M_QA_PM_REV_B_1',repeat('6',32));
  if (select status from public.media_assets where media_id='M_QA_PM_REV_B_1')<>'REVIEW_REQUIRED' then raise exception 'QA_FILE_FINALIZE_FAILED'; end if;
  if (select public_delivery_allowed from public.planning_material_file_versions where media_id='M_QA_PM_REV_B_1') then raise exception 'QA_PUBLIC_DELIVERY_LEAK'; end if;
  if (select version_state from public.planning_material_file_versions where media_id='M_QA_PM_REV_B_1')<>'CURRENT_CANDIDATE' then raise exception 'QA_VERSION_STATE_FAILED'; end if;

  perform public.code1_material_review_item('OWNER',v_item,'NEEDS_INFO','추가 확인',repeat('7',32));
  perform public.code1_material_review_item('OWNER',v_item,'VERIFIED','증빙 확인',repeat('8',32));
  if (select review_status from public.planning_material_request_items where request_item_id=v_item)<>'VERIFIED' then raise exception 'QA_REVIEW_FAILED'; end if;
  if (select count(*) from public.review_decisions where subject_type='PLANNING_MATERIAL_ITEM' and subject_id=v_item)<>2 then raise exception 'QA_REVIEW_HISTORY_FAILED'; end if;

  v_manifest:=public.code1_material_manifest('OWNER',v_request);
  if v_manifest->>'material_request_id'<>v_request or jsonb_array_length(v_manifest->'items')<>2 then raise exception 'QA_MANIFEST_FAILED'; end if;
  if v_manifest::text ~* 'https?://|token=|signature=|credential=|password=|secret=' then raise exception 'QA_MANIFEST_SECRET_URL_LEAK'; end if;
  if not (v_manifest::text like '%M_QA_PM_REV_B_1%' and v_manifest::text like '%'||repeat('a',64)||'%') then raise exception 'QA_MANIFEST_DESCRIPTOR_MISSING'; end if;

  v_submit:=public.code1_material_submit_request(v_partner,v_request,'SUBMITTED',repeat('9',32));
  v_event:=v_submit->>'ops_event_id';
  if v_event is null then raise exception 'QA_OPS_EVENT_MISSING'; end if;
  if not exists(select 1 from public.ops_change_events where event_id=v_event and event_class='PLANNING_IMPACT' and planning_relevance and suggested_tracks=array['PLANNING']::text[]) then raise exception 'QA_OPS_EVENT_INVALID'; end if;
  if not exists(select 1 from public.ops_outbox where event_id=v_event and delivery_state='PENDING') then raise exception 'QA_OUTBOX_MISSING'; end if;
  v_repeat:=public.code1_material_submit_request(v_partner,v_request,'SUBMITTED',repeat('b',32));
  if coalesce((v_repeat->>'deduplicated')::boolean,false)<>true then raise exception 'QA_SUBMIT_DEDUPE_FAILED'; end if;
  select count(*) into v_count from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id=v_request and action='planning.material.request.submitted';
  if v_count<>1 then raise exception 'QA_OPS_EVENT_DUPLICATED'; end if;
  if not exists(select 1 from public.planning_source_artifacts where source_ref=v_request and source_type='PLANNING_MATERIAL_MANIFEST' and public_delivery_allowed=false) then raise exception 'QA_PLANNING_ARTIFACT_MISSING'; end if;
  if not exists(select 1 from public.audit_log where target_id=v_request and action='planning.material.request.create') or not exists(select 1 from public.audit_log where target_id=v_request and action='planning.material.request.submit') then raise exception 'QA_AUDIT_MISSING'; end if;

  delete from public.ops_outbox where event_id in (select event_id from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id=v_request);
  delete from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id=v_request;
  delete from public.planning_source_artifacts where source_ref=v_request and source_type='PLANNING_MATERIAL_MANIFEST';
  delete from public.review_decisions where subject_type='PLANNING_MATERIAL_ITEM' and subject_id in (select request_item_id from public.planning_material_request_items where material_request_id=v_request);
  delete from public.media_events where media_id='M_QA_PM_REV_B_1';
  update public.planning_material_files set current_version_id=null,pending_version_id=null where request_item_id in (select request_item_id from public.planning_material_request_items where material_request_id=v_request);
  delete from public.planning_material_file_versions where media_id='M_QA_PM_REV_B_1';
  delete from public.planning_material_files where request_item_id in (select request_item_id from public.planning_material_request_items where material_request_id=v_request);
  delete from public.media_assets where media_id='M_QA_PM_REV_B_1';
  delete from public.audit_log where (target_id=v_request or target_id=v_item or target_id=v_template or target_type in ('PLANNING_MATERIAL_FILE','PLANNING_MATERIAL_ITEM','PLANNING_MATERIAL_TEMPLATE')) and actor_id in ('OWNER',v_partner,v_outsider);
  delete from public.planning_material_request_assignees where material_request_id=v_request;
  delete from public.planning_material_request_items where material_request_id=v_request;
  delete from public.planning_material_requests where material_request_id=v_request;
  delete from public.planning_material_template_revisions where template_id=v_template;
  delete from public.planning_material_template_items where template_id=v_template;
  delete from public.planning_material_templates where template_id=v_template;
  delete from public.account_capabilities where account_id in (v_partner,v_outsider);
  delete from public.workspace_accounts where account_id in (v_partner,v_outsider);
END $$;

commit;
