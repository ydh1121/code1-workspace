-- CODE1 Internal Workspace / STAGING ONLY
-- Temporary-admin management, executive planning read model and owner-only audit controls.
-- Do not apply to Production or the legacy Apps Script/Sheet/Drive runtime.

begin;

alter table public.workspace_accounts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text references public.workspace_accounts(account_id),
  add column if not exists archive_reason text;

create index if not exists workspace_accounts_active_idx
  on public.workspace_accounts(status, created_at) where archived_at is null;

-- OWNER is the current temporary-workspace executive viewer/reviewer.
insert into public.account_capabilities(account_id,capability,effect,granted_by,note)
select 'OWNER',v.capability,'ALLOW','OWNER','Temporary admin executive planning access'
from (values
  ('EXECUTIVE_BRIEF_VIEW'),
  ('FACT_SUBMIT'),
  ('FACT_VERIFY'),
  ('FACT_APPROVE_CURRENT')
) as v(capability)
on conflict (account_id,capability) do update
set effect='ALLOW',granted_by='OWNER',granted_at=now(),note=excluded.note;

-- Publish the approved internal Executive Brief snapshot. Runtime reads this snapshot,
-- not the live Drive document, so Drive remains the planning SSOT and is never overwritten here.
update public.planning_brief_versions
set status='SUPERSEDED'
where brief_key='EXECUTIVE_CURRENT'
  and status='PUBLISHED'
  and brief_version<>'v0.1-20260909';

insert into public.planning_brief_versions(
  brief_key,brief_version,status,source_doc_ids,source_revision,source_version,
  content_json,sections,confidentiality,published_at,published_by,created_by
) values (
  'EXECUTIVE_CURRENT',
  'v0.1-20260909',
  'PUBLISHED',
  '["1bINByqVn9CmI1l-jhYTpFGHp_MczgujfG1Ot1SEQDpk"]'::jsonb,
  'ANLCKQkY5inj-3o5lJWdQkyOiOTcDXDUWm_DHjxb7Rd1ykraMVcphLeeE1vDPMEPvNwhY5IrCl7pTf2iIef7s9NKnENhAnot96_gYq1Fn18',
  'v0.1',
  jsonb_build_object(
    'title','CODE1 경영진 사업계획 Executive Brief v0.1',
    'status','CURRENT_EXECUTIVE_BRIEF / INTERNAL_ONLY / LIVE_VALUES_PARTLY_WAITING',
    'audience','그레이트팜 대표, 사업총괄, CODE1 운영책임자',
    'purpose','긴 기획문서를 모두 읽지 않아도 현재 사업정의, 돈이 나는 구조, 다음 행동, 미확정 위험을 5~10분 안에 파악한다.'
  ),
  jsonb_build_array(
    jsonb_build_object('id','business','title','1. CODE1은 무엇인가','body',jsonb_build_array(
      '현재 런칭축은 사육환경번호 1번 계란을 중심으로 한 생산자 네트워크·커머스 플랫폼이다. 운영 사업자는 농업회사법인 그레이트팜으로 진행하고 PG 예정사는 Toss Payments다. 런칭 판매모델과 실제 소비자 판매자·계약책임은 별도 Gate에서 확정한다.',
      '장기 전략은 1번에만 고정하지 않는다. 1번을 프리미엄·브랜드 출발점으로 유지하면서 사육환경번호 1~4번 계란을 모두 다룰 수 있는 구조와, 그레이트팜이 보유·추진하는 농축산 기술·제품 사업을 CODE1의 확장 포트폴리오로 연결한다. 1~4번은 우열등급이 아니라 사육환경 구분이다.'
    )),
    jsonb_build_object('id','revenue','title','2. 돈이 나는 세 축','items',jsonb_build_array(
      jsonb_build_object('label','NETWORK / AGENCY','text','외부 유통사·제휴사·B2B 공급 요청을 농가·선별장 대신 묶어 관리하고 물량조정, 커뮤니케이션, 정산운영 등을 담당한다. 사용자 전달 기준 알당 10원 관리수익 구조는 실제 계약 검증 전 USER_REPORTED_COMMERCIAL_TERM으로 관리한다.'),
      jsonb_build_object('label','COMMERCE','text','FARM_BRAND 공식몰 판매, CODE1 PB/OEM, B2B, 제휴채널에서 수수료 또는 상품마진을 만든다. 사용자 전달 기준 PB·계약직판 알당 250원 수익안은 단위경제성 검증 전 CANDIDATE다.'),
      jsonb_build_object('label','MEMBERSHIP','text','Premium Membership을 반복매출 축으로 검토한다. 일반 정기배송과 유료멤버십은 분리하며 등급·가격·기프트·배송지원 원가는 단위경제성으로 결정한다.')
    )),
    jsonb_build_object('id','supply','title','3. 현재 공급망 가설','items',jsonb_build_array(
      '합천에 주요 관계 농가가 집중되어 있다는 사용자 전달이 있다.',
      '알이랑 선별장이 주변 농가 물량의 선별·포장 허브 역할을 한다는 사용자 전달이 있다.',
      '전체 관계농가 최대 공급량 약 18만 알/일, 유정란 약 2만 알/일이라는 정보가 있으나 실측·문서검증 전이다.',
      '전국 확장에서는 농가뿐 아니라 적법한 지역 선별·포장·출고 허브 확보가 핵심 제약이 될 수 있다.'
    )),
    jsonb_build_object('id','growth','title','4. 성장 방향','items',jsonb_build_array(
      'STEP 1. 1번 계란 런칭 공급망과 실제 거래구조를 검증한다.',
      'STEP 2. 합천 농가·알이랑 중심의 Regional Supply Hub와 Agency 운영모델을 계약·데이터로 정리한다.',
      'STEP 3. CODE1 PB를 복수 적격 농가·지역 허브에서 생산·직출고할 수 있는 네트워크로 확장한다.',
      'STEP 4. 소비자 선택·가격대·공급안정성을 고려해 1~4번 계란을 모두 다룰 수 있는 카테고리 구조로 확장한다. 1번은 브랜드의 프리미엄 출발점으로 유지한다.',
      'STEP 5. 그레이트팜 제공자료의 사업항목 중 실제 사업화 조건을 통과한 영역을 별도 vertical로 연결한다.'
    )),
    jsonb_build_object('id','kpi','title','5. 경영진이 봐야 할 숫자','items',jsonb_build_array(
      'VERIFIED 농가 수 / ACTIVE 농가 수','VERIFIED 선별·포장·출고 허브 수','일·주 판매가능 공급량과 실제 출고가능량','Agency 관리 물량과 알당 관리수익','FARM_BRAND GMV / 기여이익','PB 판매량 / 알당 실제 기여이익','B2B·제휴 거래처 수와 반복물량','Premium 유료회원 수 / ARPU / 해지율 / 혜택원가','정시출고·도착률 / 파손·클레임률','미검증 핵심 Fact 수와 검증 완료율'
    )),
    jsonb_build_object('id','economics','title','6. 돈 계산 원칙','items',jsonb_build_array(
      'Agency 수익 = 실제 관리대상 출고수량 × 계약상 알당 관리수익.',
      'PB 기여이익 = 소비자·채널 매출 - 농가/OEM 지급 - 포장 - 물류 - PG - 프로모션 - 순클레임비용.',
      'Membership 반복매출 = 활성 유료회원 × 실제 월요금 또는 연회비. 기프트·배송지원·우선공급 운영비를 별도 차감한다.',
      '10원/알, 250원/알, 2,000원/월, 18만 알/일, 유정란 2만 알/일은 같은 확정등급의 숫자가 아니며 검증 전 경영계획 확정치로 합산하지 않는다.'
    )),
    jsonb_build_object('id','next','title','7. 지금 해야 할 일','items',jsonb_build_array(
      '합천 농가·알이랑 관계, 실제 일 공급량, 유정란 공급량, 시설 역할과 영업자격을 증빙으로 확인.',
      '10원/알 Agency 모델의 거래흐름, 계약당사자, 수익귀속, 포함업무를 실제 사례로 검증.',
      'PB 250원/알 수익안의 원가구조와 적용 SKU·계약범위를 확인.',
      'Premium 등급·혜택·정상가격·기프트 원가·배송비·해지정책을 단위경제성으로 설계.',
      '전국 확장을 위해 지역별 적격 선별·포장시설 지도를 구축.',
      '1~4번 계란 확장 시 브랜드·카테고리·상품정보 구조를 설계하되 현재 승인된 1번 런칭 UX를 임의 변경하지 않음.',
      '그레이트팜 사업항목을 사업기회 목록으로 관리하고 효능·성능 주장은 독립 검증·법률검토 전 소비자 카피로 사용하지 않음.',
      '임시 관리자단에 Fact Inbox와 이 Executive Brief의 읽기 전용 CURRENT 화면을 제공.'
    )),
    jsonb_build_object('id','open','title','8. 현재 미결정','items',jsonb_build_array(
      'Premium 멤버십 등급 수, 정상가격, 연회비, 기프트 구성','1~4번 계란을 소비자 브랜드 안에서 어떻게 구획할지','FARM_BRAND 런칭 판매모델과 법적 판매자','합천 외 Regional Hub 확보방식','GreatFarm 사업 포트폴리오 중 CODE1 우선 편입 순서','실제 공급·가격·배송·클레임·PG 계약값'
    ))
  ),
  'INTERNAL',now(),'OWNER','OWNER'
)
on conflict (brief_key,brief_version) do update set
  status='PUBLISHED',
  source_doc_ids=excluded.source_doc_ids,
  source_revision=excluded.source_revision,
  source_version=excluded.source_version,
  content_json=excluded.content_json,
  sections=excluded.sections,
  confidentiality=excluded.confidentiality,
  published_at=now(),
  published_by='OWNER';

-- Evidence is part of the Fact transition transaction. The previous six-argument
-- function could not persist DOCUMENT_RECEIVED evidence before VERIFIED.
drop function if exists public.code1_transition_fact(text,text,text,text,numeric,text);
create or replace function public.code1_transition_fact(
  p_actor_id text,
  p_fact_id text,
  p_to_status text,
  p_note text,
  p_confidence numeric,
  p_evidence_ref jsonb,
  p_request_id text
) returns table(fact_id text, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.fact_inbox%rowtype;
  v_capability text;
  v_evidence jsonb;
begin
  select * into v_old from public.fact_inbox where fact_inbox.fact_id=p_fact_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.code1_fact_transition_allowed(v_old.status,p_to_status) then raise exception 'INVALID_FACT_TRANSITION'; end if;

  v_capability := case
    when p_to_status='APPROVED_CURRENT' then 'FACT_APPROVE_CURRENT'
    when p_to_status in ('EVIDENCE_REQUESTED','DOCUMENT_RECEIVED','VERIFIED') then 'FACT_VERIFY'
    else 'FACT_SUBMIT'
  end;
  if not exists(select 1 from public.account_capabilities c where c.account_id=p_actor_id and c.capability=v_capability and c.effect='ALLOW') then
    raise exception 'FORBIDDEN';
  end if;

  v_evidence:=coalesce(p_evidence_ref,v_old.evidence_ref);
  if p_to_status in ('DOCUMENT_RECEIVED','VERIFIED','APPROVED_CURRENT') and v_evidence is null then
    raise exception 'EVIDENCE_REQUIRED';
  end if;

  update public.fact_inbox f set
    status=p_to_status,
    evidence_ref=v_evidence,
    verification_note=case when p_to_status in ('VERIFIED','APPROVED_CURRENT') then coalesce(nullif(btrim(p_note),''),f.verification_note) else f.verification_note end,
    verification_confidence=case when p_to_status='VERIFIED' then p_confidence else f.verification_confidence end,
    verified_by=case when p_to_status='VERIFIED' then p_actor_id else f.verified_by end,
    verified_at=case when p_to_status='VERIFIED' then now() else f.verified_at end,
    approved_current_by=case when p_to_status='APPROVED_CURRENT' then p_actor_id else f.approved_current_by end,
    approved_current_at=case when p_to_status='APPROVED_CURRENT' then now() else f.approved_current_at end,
    updated_by=p_actor_id,
    updated_at=now()
  where f.fact_id=p_fact_id;

  insert into public.fact_events(fact_id,actor_id,event_type,from_status,to_status,note,request_id,metadata)
  values(p_fact_id,p_actor_id,'STATUS_CHANGED',v_old.status,p_to_status,left(coalesce(p_note,''),2000),p_request_id,
    jsonb_build_object('evidence_updated',p_evidence_ref is not null));
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'fact.transition','FACT',p_fact_id,v_old.status||'→'||p_to_status,p_request_id,
    jsonb_build_object('backend','SUPABASE_STAGING'));

  return query select f.fact_id,f.status,f.updated_at from public.fact_inbox f where f.fact_id=p_fact_id;
end;
$$;

-- Empty farm deletion is OWNER-only and intentionally refuses farms with business history.
create or replace function public.code1_delete_empty_farm(
  p_actor_id text,
  p_farm_id text,
  p_reason text,
  p_request_id text
) returns table(farm_id text, deleted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.workspace_accounts%rowtype;
  v_farm public.farms%rowtype;
begin
  select * into v_actor from public.workspace_accounts where account_id=p_actor_id and status='active' and archived_at is null;
  if not found or v_actor.account_id<>'OWNER' or v_actor.role<>'SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  select * into v_farm from public.farms where farms.farm_id=p_farm_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.intake_submissions s where s.farm_id=p_farm_id)
     or exists(select 1 from public.media_assets m where m.farm_id=p_farm_id)
     or exists(select 1 from public.question_policies q where q.farm_id=p_farm_id)
     or exists(select 1 from public.fact_inbox f where f.subject_type='FARM' and f.subject_id=p_farm_id) then
    raise exception 'FARM_HAS_HISTORY';
  end if;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'farm.delete','FARM',p_farm_id,left(coalesce(p_reason,'사용자 삭제'),500),p_request_id,
    jsonb_build_object('backend','SUPABASE_STAGING','history_preserved',true));
  delete from public.housing_environment_records where housing_environment_records.farm_id=p_farm_id;
  delete from public.migration_registry where stable_id in (p_farm_id,'HER_FARM_'||p_farm_id);
  delete from public.farms where farms.farm_id=p_farm_id;
  return query select p_farm_id,true;
end;
$$;

-- Account "delete" is a reversible archive: credentials stop working immediately,
-- active farm assignments/capabilities are revoked, while audit/history rows remain.
create or replace function public.code1_archive_account(
  p_actor_id text,
  p_account_id text,
  p_reason text,
  p_request_id text
) returns setof public.workspace_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.workspace_accounts%rowtype;
  v_target public.workspace_accounts%rowtype;
begin
  select * into v_actor from public.workspace_accounts where account_id=p_actor_id and status='active' and archived_at is null;
  if not found or v_actor.account_id<>'OWNER' or v_actor.role<>'SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  select * into v_target from public.workspace_accounts where account_id=p_account_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_target.account_id='OWNER' or v_target.account_id=p_actor_id or v_target.role='SUPER_ADMIN' then raise exception 'FORBIDDEN'; end if;
  if v_target.archived_at is not null then return query select * from public.workspace_accounts where account_id=p_account_id; return; end if;

  update public.workspace_accounts set
    status='disabled',archived_at=now(),archived_by=p_actor_id,
    archive_reason=left(coalesce(p_reason,'사용자 삭제'),500),
    session_version=session_version+1,updated_at=now()
  where account_id=p_account_id;
  delete from public.farm_access where account_id=p_account_id;
  delete from public.account_capabilities where account_id=p_account_id;
  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'account.archive','ACCOUNT',p_account_id,left(coalesce(p_reason,'사용자 삭제'),500),p_request_id,
    jsonb_build_object('backend','SUPABASE_STAGING','session_invalidated',true));
  return query select * from public.workspace_accounts where account_id=p_account_id;
end;
$$;

revoke all on function public.code1_transition_fact(text,text,text,text,numeric,jsonb,text) from public, anon, authenticated;
revoke all on function public.code1_delete_empty_farm(text,text,text,text) from public, anon, authenticated;
revoke all on function public.code1_archive_account(text,text,text,text) from public, anon, authenticated;
grant execute on function public.code1_transition_fact(text,text,text,text,numeric,jsonb,text) to service_role;
grant execute on function public.code1_delete_empty_farm(text,text,text,text) to service_role;
grant execute on function public.code1_archive_account(text,text,text,text) to service_role;

-- Explicit user-directed cleanup of empty source placeholders GF-ORIGIN-05 through 12.
-- Abort rather than deleting if any row has become a real farm or acquired business history.
do $$
declare
  v_id text;
  v_farm public.farms%rowtype;
begin
  foreach v_id in array array[
    'GF-ORIGIN-05','GF-ORIGIN-06','GF-ORIGIN-07','GF-ORIGIN-08',
    'GF-ORIGIN-09','GF-ORIGIN-10','GF-ORIGIN-11','GF-ORIGIN-12'
  ] loop
    select * into v_farm from public.farms where farm_id=v_id for update;
    if not found then continue; end if;
    if v_farm.origin_cohort is not true
       or v_farm.internal_name is not null
       or v_farm.public_name is not null
       or exists(select 1 from public.farm_access x where x.farm_id=v_id)
       or exists(select 1 from public.intake_submissions x where x.farm_id=v_id)
       or exists(select 1 from public.media_assets x where x.farm_id=v_id)
       or exists(select 1 from public.question_policies x where x.farm_id=v_id)
       or exists(select 1 from public.fact_inbox x where x.subject_type='FARM' and x.subject_id=v_id)
       or exists(select 1 from public.housing_environment_records x where x.farm_id=v_id and (x.verification_status<>'UNCONFIRMED' or x.housing_environment_code is not null)) then
      raise exception 'PLACEHOLDER_DELETE_GUARD_FAILED:%',v_id;
    end if;
    insert into public.audit_log(actor_id,action,target_type,target_id,detail,metadata)
    values('OWNER','farm.placeholder.delete','FARM',v_id,'Explicit user-directed STAGING placeholder cleanup',
      jsonb_build_object('backend','SUPABASE_STAGING','had_submissions',false,'had_media',false));
    delete from public.housing_environment_records where farm_id=v_id;
    delete from public.migration_registry where stable_id in (v_id,'HER_FARM_'||v_id);
    delete from public.farms where farm_id=v_id;
  end loop;
end;
$$;

commit;
