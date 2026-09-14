-- CODE1 Planning Material field type/lifecycle transactional acceptance / STAGING ONLY
-- Authority: MSG-20260914-0099 / WO-20260914-CODING-MATERIAL-FIELD-TYPES-001 / Delta 20260914-048
-- Synthetic rows are removed before commit. Any assertion failure aborts the migration transaction.

do $$
declare
  v jsonb;
  v_pre text;
  v_req1 text;
  v_req2 text;
  v_product text;
  v_file text;
  v_remove text;
  v_both text;
  v_failed boolean;
begin
  insert into public.planning_material_templates(
    template_id,name,status,current_revision,published_revision,created_by,updated_by
  ) values(
    'PMT_QA_FIELD_0024','QA FIELD TYPE 0024','ACTIVE',1,1,'OWNER','OWNER'
  );
  insert into public.planning_material_template_items(
    template_id,item_key,label,description,required,sort_order,active,classification_hint,response_kind,updated_by
  ) values(
    'PMT_QA_FIELD_0024','BASE_ITEM','기존 게시 항목','게시 전 기준',false,1,true,'10_기타','TEXT','OWNER'
  );
  insert into public.planning_material_template_revisions(
    template_id,revision,items_snapshot,actor_id,request_id,revision_state,published_at
  ) values(
    'PMT_QA_FIELD_0024',1,
    '[{"item_key":"BASE_ITEM","label":"기존 게시 항목","description":"게시 전 기준","required":false,"sort_order":1,"active":true,"classification_hint":"10_기타","response_kind":"TEXT"}]'::jsonb,
    'OWNER','f0240000000000000000000000000001','PUBLISHED',now()
  );

  select public.code1_material_save_template(
    'OWNER','PMT_QA_FIELD_0024',1,
    '[
      {"item_key":"PRODUCT_NAME","label":"제품명","description":"판매 중인 제품명을 입력해 주세요.","required":true,"sort_order":1,"active":true,"classification_hint":"02_상품_패키지_표시","response_kind":"TEXT"},
      {"item_key":"FILE_EVIDENCE","label":"파일 증빙","description":"현재 증빙 파일을 제출해 주세요.","required":true,"sort_order":2,"active":true,"classification_hint":"04_인증_검사_성적서","response_kind":"FILE"},
      {"item_key":"REMOVE_ME","label":"게시 후 제거 검증 항목","description":"게시 이력 보존 검증","required":true,"sort_order":3,"active":true,"classification_hint":"10_기타","response_kind":"TEXT"},
      {"item_key":"BOTH_ITEM","label":"텍스트와 파일 명시 항목","description":"TEXT_FILE 명시 선택 검증","required":false,"sort_order":4,"active":true,"classification_hint":"10_기타","response_kind":"TEXT_FILE"},
      {"item_key":"DRAFT_TEST","label":"QA 초안 테스트 항목","description":"게시 전 전용","required":false,"sort_order":5,"active":true,"classification_hint":"10_기타","response_kind":"TEXT"}
    ]'::jsonb,
    'f0240000000000000000000000000002'
  ) into v;
  if (v->>'revision')::int<>2 or v->>'lifecycle_status'<>'DRAFT' then raise exception 'QA_DRAFT_SAVE_FAILED'; end if;
  if (select published_revision from public.planning_material_templates where template_id='PMT_QA_FIELD_0024')<>1 then raise exception 'QA_DRAFT_CHANGED_PUBLISHED_POINTER'; end if;

  select public.code1_material_create_request(
    'OWNER','QA pre-publish','QA','{}'::jsonb,'DETAIL_PAGE',null,'PMT_QA_FIELD_0024',array[]::text[],
    'f0240000000000000000000000000003'
  ) into v;
  v_pre:=v->>'material_request_id';
  if exists(select 1 from public.planning_material_request_items where material_request_id=v_pre and item_key in ('DRAFT_TEST','PRODUCT_NAME')) then raise exception 'QA_DRAFT_LEAKED_TO_REQUEST'; end if;
  if (select template_revision from public.planning_material_requests where material_request_id=v_pre)<>1 then raise exception 'QA_PREPUBLISH_REQUEST_NOT_PUBLISHED_REV'; end if;

  select public.code1_material_save_template(
    'OWNER','PMT_QA_FIELD_0024',2,
    '[
      {"item_key":"PRODUCT_NAME","label":"제품명","description":"판매 중인 제품명을 입력해 주세요.","required":true,"sort_order":1,"active":true,"classification_hint":"02_상품_패키지_표시","response_kind":"TEXT"},
      {"item_key":"FILE_EVIDENCE","label":"파일 증빙","description":"현재 증빙 파일을 제출해 주세요.","required":true,"sort_order":2,"active":true,"classification_hint":"04_인증_검사_성적서","response_kind":"FILE"},
      {"item_key":"REMOVE_ME","label":"게시 후 제거 검증 항목","description":"게시 이력 보존 검증","required":true,"sort_order":3,"active":true,"classification_hint":"10_기타","response_kind":"TEXT"},
      {"item_key":"BOTH_ITEM","label":"텍스트와 파일 명시 항목","description":"TEXT_FILE 명시 선택 검증","required":false,"sort_order":4,"active":true,"classification_hint":"10_기타","response_kind":"TEXT_FILE"}
    ]'::jsonb,
    'f0240000000000000000000000000004'
  ) into v;
  if exists(select 1 from public.planning_material_template_items where template_id='PMT_QA_FIELD_0024' and item_key='DRAFT_TEST') then raise exception 'QA_DRAFT_DELETE_NOT_PHYSICAL'; end if;

  select public.code1_material_publish_template('OWNER','PMT_QA_FIELD_0024',3,'f0240000000000000000000000000005') into v;
  if v->>'lifecycle_status'<>'PUBLISHED' or (v->>'published_revision')::int<>3 then raise exception 'QA_PUBLISH_FAILED'; end if;

  select public.code1_material_create_request(
    'OWNER','QA published request A','QA','{}'::jsonb,'DETAIL_PAGE',null,'PMT_QA_FIELD_0024',array[]::text[],
    'f0240000000000000000000000000006'
  ) into v;
  v_req1:=v->>'material_request_id';
  if (select template_revision from public.planning_material_requests where material_request_id=v_req1)<>3 then raise exception 'QA_NEW_REQUEST_WRONG_REV'; end if;

  select request_item_id into v_product from public.planning_material_request_items where material_request_id=v_req1 and item_key='PRODUCT_NAME';
  select request_item_id into v_file from public.planning_material_request_items where material_request_id=v_req1 and item_key='FILE_EVIDENCE';
  select request_item_id into v_remove from public.planning_material_request_items where material_request_id=v_req1 and item_key='REMOVE_ME';
  select request_item_id into v_both from public.planning_material_request_items where material_request_id=v_req1 and item_key='BOTH_ITEM';
  if v_product is null or v_file is null or v_remove is null or v_both is null then raise exception 'QA_PUBLISHED_ITEMS_MISSING'; end if;
  if (select response_kind_snapshot from public.planning_material_request_items where request_item_id=v_product)<>'TEXT' then raise exception 'QA_PRODUCT_NOT_TEXT'; end if;
  if not (select required_snapshot from public.planning_material_request_items where request_item_id=v_product) then raise exception 'QA_PRODUCT_NOT_REQUIRED'; end if;
  if (select response_kind_snapshot from public.planning_material_request_items where request_item_id=v_file)<>'FILE' then raise exception 'QA_FILE_NOT_FILE'; end if;
  if not (select required_snapshot from public.planning_material_request_items where request_item_id=v_file) then raise exception 'QA_FILE_NOT_REQUIRED'; end if;
  if (select response_kind_snapshot from public.planning_material_request_items where request_item_id=v_both)<>'TEXT_FILE' then raise exception 'QA_TEXT_FILE_NOT_EXPLICIT'; end if;

  select public.code1_material_set_item_submission('OWNER',v_product,'TEXT_SUBMITTED','바나듐 계란','f0240000000000000000000000000007') into v;
  if v->>'submission_state'<>'TEXT_SUBMITTED' or (v->>'complete')::boolean is not true then raise exception 'QA_TEXT_REQUIRED_NOT_SATISFIED'; end if;

  v_failed:=false;
  begin
    insert into public.planning_material_files(material_file_id,request_item_id,created_by) values('PMF_QA_TEXT_GUARD_0024',v_product,'OWNER');
  exception when others then
    if sqlerrm='FIELD_KIND_NO_FILE' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'QA_TEXT_ACCEPTED_FILE'; end if;

  v_failed:=false;
  begin
    perform public.code1_material_set_item_submission('OWNER',v_file,'TEXT_SUBMITTED','should fail','f0240000000000000000000000000008');
  exception when others then
    if sqlerrm='FIELD_KIND_FILE_ONLY' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'QA_FILE_ACCEPTED_TEXT'; end if;

  v_failed:=false;
  begin
    perform public.code1_material_submit_request('OWNER',v_req1,'SUBMITTED','f0240000000000000000000000000009');
  exception when others then
    if sqlerrm='REQUIRED_MATERIAL_INCOMPLETE' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'QA_REQUIRED_FILE_NOT_ENFORCED'; end if;

  insert into public.media_assets(media_id,upload_id,media_group,original_file_name,object_key,mime_type,file_size_bytes,checksum_sha256,uploaded_by,status,source_storage)
  values('M_QA_FIELD_0024','U_QA_FIELD_0024','PLANNING_MATERIAL','proof.pdf','staging/planning-material/qa-0024/proof.pdf','application/pdf',1,repeat('a',64),'OWNER','REVIEW_REQUIRED','R2_PRIVATE');
  insert into public.planning_material_files(material_file_id,request_item_id,created_by)
  values('PMF_QA_FIELD_0024',v_file,'OWNER');
  insert into public.planning_material_file_versions(version_id,material_file_id,revision,media_id,uploader_id,version_state,is_current)
  values('PMFV_QA_FIELD_0024','PMF_QA_FIELD_0024',1,'M_QA_FIELD_0024','OWNER','CURRENT_CANDIDATE',true);
  update public.planning_material_files set current_revision=1,current_version_id='PMFV_QA_FIELD_0024' where material_file_id='PMF_QA_FIELD_0024';

  select public.code1_material_set_item_submission('OWNER',v_file,'FILE_SUBMITTED','','f0240000000000000000000000000010') into v;
  if v->>'submission_state'<>'FILE_SUBMITTED' or (v->>'complete')::boolean is not true then raise exception 'QA_FILE_REQUIRED_NOT_SATISFIED_BY_FILE'; end if;
  perform public.code1_material_set_item_submission('OWNER',v_remove,'TEXT_SUBMITTED','history','f0240000000000000000000000000011');
  perform public.code1_material_submit_request('OWNER',v_req1,'SUBMITTED','f0240000000000000000000000000012');

  select public.code1_material_save_template(
    'OWNER','PMT_QA_FIELD_0024',3,
    '[
      {"item_key":"PRODUCT_NAME","label":"제품명","description":"판매 중인 제품명을 입력해 주세요.","required":true,"sort_order":1,"active":true,"classification_hint":"02_상품_패키지_표시","response_kind":"TEXT"},
      {"item_key":"FILE_EVIDENCE","label":"파일 증빙","description":"현재 증빙 파일을 제출해 주세요.","required":true,"sort_order":2,"active":true,"classification_hint":"04_인증_검사_성적서","response_kind":"FILE"},
      {"item_key":"BOTH_ITEM","label":"텍스트와 파일 명시 항목","description":"TEXT_FILE 명시 선택 검증","required":false,"sort_order":3,"active":true,"classification_hint":"10_기타","response_kind":"TEXT_FILE"}
    ]'::jsonb,
    'f0240000000000000000000000000013'
  ) into v;
  if not exists(select 1 from public.planning_material_template_items where template_id='PMT_QA_FIELD_0024' and item_key='REMOVE_ME' and active=false) then raise exception 'QA_PUBLISHED_REMOVAL_NOT_ARCHIVED'; end if;
  select public.code1_material_publish_template('OWNER','PMT_QA_FIELD_0024',4,'f0240000000000000000000000000014') into v;

  select public.code1_material_create_request(
    'OWNER','QA published request B','QA','{}'::jsonb,'DETAIL_PAGE',null,'PMT_QA_FIELD_0024',array[]::text[],
    'f0240000000000000000000000000015'
  ) into v;
  v_req2:=v->>'material_request_id';
  if exists(select 1 from public.planning_material_request_items where material_request_id=v_req2 and item_key='REMOVE_ME') then raise exception 'QA_REMOVED_ITEM_LEAKED_TO_FUTURE'; end if;
  if not exists(select 1 from public.planning_material_request_items where material_request_id=v_req1 and item_key='REMOVE_ME' and response_kind_snapshot='TEXT') then raise exception 'QA_OLD_REQUEST_HISTORY_LOST'; end if;
  if exists(select 1 from public.planning_material_request_items where material_request_id=v_req2 and item_key='DRAFT_TEST') then raise exception 'QA_DRAFT_TEST_LEAKED_AFTER_PUBLISH'; end if;

  delete from public.ops_outbox where event_id in (select event_id from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id in (v_pre,v_req1,v_req2));
  delete from public.ops_change_events where entity_type='PLANNING_MATERIAL_REQUEST' and entity_id in (v_pre,v_req1,v_req2);
  delete from public.planning_source_artifacts where source_type='PLANNING_MATERIAL_MANIFEST' and source_ref in (v_pre,v_req1,v_req2);
  delete from public.audit_log where request_id in (
    'f0240000000000000000000000000002','f0240000000000000000000000000003','f0240000000000000000000000000004',
    'f0240000000000000000000000000005','f0240000000000000000000000000006','f0240000000000000000000000000007',
    'f0240000000000000000000000000008','f0240000000000000000000000000009','f0240000000000000000000000000010',
    'f0240000000000000000000000000011','f0240000000000000000000000000012','f0240000000000000000000000000013',
    'f0240000000000000000000000000014','f0240000000000000000000000000015'
  );
  delete from public.planning_material_requests where material_request_id in (v_pre,v_req1,v_req2);
  delete from public.media_assets where media_id='M_QA_FIELD_0024';
  delete from public.planning_material_template_revisions where template_id='PMT_QA_FIELD_0024';
  delete from public.planning_material_template_items where template_id='PMT_QA_FIELD_0024';
  delete from public.planning_material_templates where template_id='PMT_QA_FIELD_0024';

  if exists(select 1 from public.planning_material_templates where template_id='PMT_QA_FIELD_0024')
     or exists(select 1 from public.planning_material_requests where title like 'QA published request%' or title='QA pre-publish')
     or exists(select 1 from public.media_assets where media_id='M_QA_FIELD_0024')
     or exists(select 1 from public.audit_log where request_id like 'f024%') then
    raise exception 'QA_SYNTHETIC_RESIDUE';
  end if;
end $$;