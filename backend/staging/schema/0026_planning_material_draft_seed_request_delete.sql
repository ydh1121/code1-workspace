-- CODE1 Planning Material Great Farm DRAFT seed + safe request delete / STAGING ONLY
-- Authority: MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Delta 20260914-049
-- IMPORTANT: this migration creates DRAFT revision 2 only. It MUST NOT publish it.

begin;

create or replace function public.code1_material_delete_request(
  p_actor_id text,
  p_material_request_id text,
  p_confirm_title text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_req public.planning_material_requests%rowtype;
  v_role text;
  v_prior jsonb;
  v_item_ids text[];
  v_pristine boolean:=false;
  v_result jsonb;
begin
  if p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;

  select metadata into v_prior
  from public.audit_log
  where request_id=p_request_id
    and action='planning.material.request.delete'
  order by audit_id desc
  limit 1;
  if found then
    return coalesce(v_prior->'result',jsonb_build_object('material_request_id',p_material_request_id,'idempotent',true));
  end if;

  select role into v_role
  from public.workspace_accounts
  where account_id=p_actor_id and status='active' and archived_at is null;
  if coalesce(v_role,'')<>'SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;

  perform pg_advisory_xact_lock(hashtext(p_material_request_id)::bigint);
  select * into v_req
  from public.planning_material_requests
  where material_request_id=p_material_request_id
  for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if btrim(coalesce(p_confirm_title,''))<>v_req.title then raise exception 'CONFIRMATION_MISMATCH'; end if;

  select coalesce(array_agg(request_item_id),array[]::text[]) into v_item_ids
  from public.planning_material_request_items
  where material_request_id=p_material_request_id;

  v_pristine :=
    v_req.status in ('DRAFT','REQUESTED')
    and v_req.review_status='REQUESTED'
    and v_req.submitted_at is null
    and coalesce(v_req.manifest_revision,0)=0
    and v_req.manifest_ready_at is null
    and not exists(
      select 1 from public.planning_material_request_assignees
      where material_request_id=p_material_request_id
    )
    and not exists(
      select 1 from public.planning_material_request_items i
      where i.material_request_id=p_material_request_id
        and (i.submission_state<>'MISSING' or i.review_status<>'REQUESTED' or btrim(coalesce(i.memo,''))<>'')
    )
    and not exists(
      select 1
      from public.planning_material_files f
      join public.planning_material_request_items i on i.request_item_id=f.request_item_id
      where i.material_request_id=p_material_request_id
    )
    and not exists(
      select 1 from public.review_decisions d
      where d.subject_id=p_material_request_id or d.subject_id=any(v_item_ids)
    )
    and not exists(
      select 1 from public.planning_source_artifacts a
      where a.source_ref=p_material_request_id
         or a.metadata->>'material_request_id'=p_material_request_id
    )
    and not exists(
      select 1 from public.audit_log a
      where (a.target_id=p_material_request_id or a.target_id=any(v_item_ids))
        and a.action not in ('planning.material.request.create')
    );

  if v_pristine then
    -- There can be no file/media rows on this path; request children cascade safely.
    delete from public.planning_material_requests
    where material_request_id=p_material_request_id;
    v_result:=jsonb_build_object(
      'material_request_id',p_material_request_id,
      'title',v_req.title,
      'mode','DELETED',
      'history_preserved',false,
      'idempotent',false
    );
  else
    update public.planning_material_requests
       set status='ARCHIVED',updated_by=p_actor_id,updated_at=now()
     where material_request_id=p_material_request_id;
    v_result:=jsonb_build_object(
      'material_request_id',p_material_request_id,
      'title',v_req.title,
      'mode','ARCHIVED',
      'history_preserved',true,
      'idempotent',false
    );
  end if;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(
    p_actor_id,'planning.material.request.delete','PLANNING_MATERIAL_REQUEST',p_material_request_id,
    case when v_pristine then '비어 있는 자료요청 완전 삭제' else '자료요청 보관 처리(이력 보존)' end,
    p_request_id,
    jsonb_build_object(
      'result',v_result,
      'before',jsonb_build_object(
        'status',v_req.status,'review_status',v_req.review_status,'submitted_at',v_req.submitted_at,
        'manifest_revision',v_req.manifest_revision,'template_id',v_req.template_id,'template_revision',v_req.template_revision
      )
    )
  );

  return v_result;
end $$;

revoke all on function public.code1_material_delete_request(text,text,text,text) from public,anon,authenticated;
grant execute on function public.code1_material_delete_request(text,text,text,text) to service_role;

-- Seed the exact Great Farm authority as the NEXT DRAFT of the existing canonical template.
-- The currently published r1 remains untouched and real submitters continue to see only r1-backed requests.
do $$
declare
  v_owner text;
  v_current integer;
  v_published integer;
  v_result jsonb;
  v_items jsonb:=jsonb_build_array(
    jsonb_build_object('item_key','MAT_GF_PRODUCT_NAME','label','현재 상품명','description','현재 판매 중인 상품명을 입력해 주세요.','required',true,'sort_order',1,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','TEXT'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_1_COMPOSITION','label','상품1 구성','description','상품1의 구성 내용을 확인할 수 있는 파일을 제출해 주세요.','required',true,'sort_order',2,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_2_COMPOSITION','label','상품2 구성','description','상품2가 있는 경우 구성 파일을 제출해 주세요.','required',false,'sort_order',3,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_3_COMPOSITION','label','상품3 구성','description','상품3이 있는 경우 구성 파일을 제출해 주세요.','required',false,'sort_order',4,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_4_COMPOSITION','label','상품4 구성','description','상품4가 있는 경우 구성 파일을 제출해 주세요.','required',false,'sort_order',5,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_5_COMPOSITION','label','상품5 구성','description','상품5가 있는 경우 구성 파일을 제출해 주세요.','required',false,'sort_order',6,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_1_PACKAGE_FRONT','label','상품1 패키지 전면','description','상품1 패키지 전면이 식별되는 파일을 제출해 주세요.','required',true,'sort_order',7,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_1_PACKAGE_BACK','label','상품1 패키지 후면','description','상품1 패키지 후면이 식별되는 파일을 제출해 주세요.','required',true,'sort_order',8,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_2_PACKAGE_FRONT','label','상품2 패키지 전면','description','상품2가 있는 경우 패키지 전면 파일을 제출해 주세요.','required',false,'sort_order',9,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_2_PACKAGE_BACK','label','상품2 패키지 후면','description','상품2가 있는 경우 패키지 후면 파일을 제출해 주세요.','required',false,'sort_order',10,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_3_PACKAGE_FRONT','label','상품3 패키지 전면','description','상품3이 있는 경우 패키지 전면 파일을 제출해 주세요.','required',false,'sort_order',11,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_3_PACKAGE_BACK','label','상품3 패키지 후면','description','상품3이 있는 경우 패키지 후면 파일을 제출해 주세요.','required',false,'sort_order',12,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_4_PACKAGE_FRONT','label','상품4 패키지 전면','description','상품4가 있는 경우 패키지 전면 파일을 제출해 주세요.','required',false,'sort_order',13,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_4_PACKAGE_BACK','label','상품4 패키지 후면','description','상품4가 있는 경우 패키지 후면 파일을 제출해 주세요.','required',false,'sort_order',14,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_5_PACKAGE_FRONT','label','상품5 패키지 전면','description','상품5가 있는 경우 패키지 전면 파일을 제출해 주세요.','required',false,'sort_order',15,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCT_5_PACKAGE_BACK','label','상품5 패키지 후면','description','상품5가 있는 경우 패키지 후면 파일을 제출해 주세요.','required',false,'sort_order',16,'active',true,'classification_hint','02_상품_패키지_표시','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_FARM_PHOTO','label','현재 생산농장 사진','description','현재 생산농장을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',17,'active',true,'classification_hint','03_농장_생산자_사육환경','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_HOUSING_PHOTO','label','사육환경 사진','description','현재 사육환경을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',18,'active',true,'classification_hint','03_농장_생산자_사육환경','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PRODUCER_GROUP_PHOTO','label','생산자 단체 사진','description','생산자 단체 사진이 있는 경우 제출해 주세요.','required',false,'sort_order',19,'active',true,'classification_hint','03_농장_생산자_사육환경','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_SORTING_PHOTO','label','선별작업 사진','description','현재 선별작업을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',20,'active',true,'classification_hint','06_선별_포장_물류','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_PACKING_PHOTO','label','포장 방식 사진','description','현재 포장 방식을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',21,'active',true,'classification_hint','06_선별_포장_물류','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_DISPATCH_PHOTO','label','출고 방식 사진','description','현재 출고 방식을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',22,'active',true,'classification_hint','06_선별_포장_물류','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_DELIVERY_CUSHION_PHOTO','label','배송 및 완충재 포장방식 사진','description','배송 및 완충재 포장 방식을 확인할 수 있는 사진이 있는 경우 제출해 주세요.','required',false,'sort_order',23,'active',true,'classification_hint','06_선별_포장_물류','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_CARRIER','label','지정 택배사','description','현재 이용하는 지정 택배사명을 입력해 주세요.','required',true,'sort_order',24,'active',true,'classification_hint','06_선별_포장_물류','response_kind','TEXT'),
    jsonb_build_object('item_key','MAT_GF_FEEDING_METHOD_PHOTO','label','급이 방식 사진','description','현재 급이 방식을 확인할 수 있는 사진을 제출해 주세요.','required',true,'sort_order',25,'active',true,'classification_hint','05_사료_급이','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_FEED_SPEC','label','JS-3550 또는 실제 급이원료 종류 및 사양','description','JS-3550 또는 실제 급이원료 종류 및 사양을 확인할 수 있는 파일을 제출해 주세요.','required',true,'sort_order',26,'active',true,'classification_hint','05_사료_급이','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_CERT_ANIMAL_WELFARE','label','동물복지 인증서','description','현재 유효한 동물복지 인증서를 제출해 주세요.','required',true,'sort_order',27,'active',true,'classification_hint','04_인증_검사_성적서','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_CERT_ANTIBIOTIC_FREE','label','무항생제 인증서','description','현재 유효한 무항생제 인증서를 제출해 주세요.','required',true,'sort_order',28,'active',true,'classification_hint','04_인증_검사_성적서','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_CERT_HACCP','label','HACCP 인증서','description','현재 유효한 HACCP 인증서를 제출해 주세요.','required',true,'sort_order',29,'active',true,'classification_hint','04_인증_검사_성적서','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_CERT_OTHER','label','기타 현재 인증서','description','그 밖의 현재 유효한 인증서를 제출해 주세요. 여러 파일 제출이 가능합니다.','required',true,'sort_order',30,'active',true,'classification_hint','04_인증_검사_성적서','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_VANADIUM_REPORT','label','현재 생란 제품과 직접 연결되는 바나듐 분석성적서(단위/시료/lot 포함)','description','현재 생란 제품과 직접 연결되고 단위·시료·lot 정보가 포함된 분석성적서를 제출해 주세요.','required',true,'sort_order',31,'active',true,'classification_hint','04_인증_검사_성적서','response_kind','FILE'),
    jsonb_build_object('item_key','MAT_GF_BUSINESS_REG','label','사업자등록증','description','현재 사업자등록증을 제출해 주세요.','required',true,'sort_order',32,'active',true,'classification_hint','01_사업자_법인','response_kind','FILE')
  );
begin
  select account_id into v_owner
  from public.workspace_accounts
  where role='SUPER_ADMIN' and status='active' and archived_at is null
  order by account_id
  limit 1;
  if v_owner is null then raise exception 'SUPER_ADMIN_REQUIRED'; end if;

  select current_revision,published_revision into v_current,v_published
  from public.planning_material_templates
  where template_id='PMT_GREAT_FARM_DEFAULT'
  for update;
  if not found then raise exception 'GREAT_FARM_TEMPLATE_NOT_FOUND'; end if;
  if v_current<>1 or v_published<>1 then raise exception 'GREAT_FARM_TEMPLATE_BASE_CONFLICT'; end if;

  select public.code1_material_save_template(
    v_owner,
    'PMT_GREAT_FARM_DEFAULT',
    1,
    v_items,
    md5('MSG-20260914-0104:greatfarm-draft-seed')
  ) into v_result;

  if coalesce((v_result->>'revision')::integer,0)<>2 then raise exception 'DRAFT_REVISION_MISMATCH'; end if;
  if coalesce((v_result->>'published_revision')::integer,0)<>1 then raise exception 'DRAFT_MUST_NOT_PUBLISH'; end if;

  if (select count(*) from public.planning_material_template_items where template_id='PMT_GREAT_FARM_DEFAULT' and active)=32 then null;
  else raise exception 'DRAFT_ACTIVE_ITEM_COUNT_MISMATCH'; end if;

  if not exists(
    select 1 from public.planning_material_template_revisions
    where template_id='PMT_GREAT_FARM_DEFAULT' and revision=2 and revision_state='DRAFT' and published_at is null
  ) then raise exception 'DRAFT_REVISION_NOT_ISOLATED'; end if;

  if exists(
    select 1 from public.planning_material_requests where template_id='PMT_GREAT_FARM_DEFAULT' and template_revision=2
  ) then raise exception 'DRAFT_EXPOSED_TO_REAL_REQUEST'; end if;
end $$;

commit;
