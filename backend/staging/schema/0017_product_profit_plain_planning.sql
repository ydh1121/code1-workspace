-- CODE1 Internal Workspace / STAGING ONLY
-- Product-level profit structure and plain-language planning copy.
-- Do not apply to Production until Preview QA is explicitly approved.

begin;

create table if not exists public.planning_product_profit_models (
  model_id text primary key,
  product_name text not null check (char_length(product_name) between 1 and 160),
  unit_name text,
  sales_channel text,
  sale_price numeric(16,2) not null default 0 check (sale_price >= 0),
  purchase_cost numeric(16,2) not null default 0 check (purchase_cost >= 0),
  package_cost numeric(16,2) not null default 0 check (package_cost >= 0),
  shipping_cost numeric(16,2) not null default 0 check (shipping_cost >= 0),
  sales_fee numeric(16,2) not null default 0 check (sales_fee >= 0),
  other_cost numeric(16,2) not null default 0 check (other_cost >= 0),
  monthly_units integer not null default 0 check (monthly_units >= 0),
  note text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  current_revision integer not null default 0 check (current_revision >= 0),
  created_by text references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  updated_by text references public.workspace_accounts(account_id),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_product_profit_revisions (
  revision_id text primary key,
  model_id text not null references public.planning_product_profit_models(model_id) on delete cascade,
  revision integer not null check (revision > 0),
  product_name text not null,
  unit_name text,
  sales_channel text,
  sale_price numeric(16,2) not null,
  purchase_cost numeric(16,2) not null,
  package_cost numeric(16,2) not null,
  shipping_cost numeric(16,2) not null,
  sales_fee numeric(16,2) not null,
  other_cost numeric(16,2) not null,
  monthly_units integer not null,
  note text,
  created_by text references public.workspace_accounts(account_id),
  created_at timestamptz not null default now(),
  request_id text,
  unique(model_id,revision),
  unique(request_id)
);

create index if not exists planning_product_profit_models_status_idx
  on public.planning_product_profit_models(status,updated_at desc);
create index if not exists planning_product_profit_revisions_model_idx
  on public.planning_product_profit_revisions(model_id,revision desc);

alter table public.planning_product_profit_models enable row level security;
alter table public.planning_product_profit_revisions enable row level security;
revoke all on table public.planning_product_profit_models from public,anon,authenticated;
revoke all on table public.planning_product_profit_revisions from public,anon,authenticated;
grant select,insert,update,delete on table public.planning_product_profit_models to service_role;
grant select,insert,update,delete on table public.planning_product_profit_revisions to service_role;

create or replace function public.code1_save_product_profit_model(
  p_actor_id text,
  p_model_id text,
  p_base_revision integer,
  p_product_name text,
  p_unit_name text,
  p_sales_channel text,
  p_sale_price numeric,
  p_purchase_cost numeric,
  p_package_cost numeric,
  p_shipping_cost numeric,
  p_sales_fee numeric,
  p_other_cost numeric,
  p_monthly_units integer,
  p_note text,
  p_request_id text
) returns setof public.planning_product_profit_models
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_model public.planning_product_profit_models%rowtype;
  v_existing public.planning_product_profit_revisions%rowtype;
  v_model_id text;
  v_revision_id text;
  v_next integer;
  v_now timestamptz := now();
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if nullif(btrim(coalesce(p_product_name,'')),'') is null then raise exception 'INVALID_PRODUCT_PROFIT'; end if;
  if coalesce(p_sale_price,0)<0 or coalesce(p_purchase_cost,0)<0 or coalesce(p_package_cost,0)<0
     or coalesce(p_shipping_cost,0)<0 or coalesce(p_sales_fee,0)<0 or coalesce(p_other_cost,0)<0
     or coalesce(p_monthly_units,0)<0 then raise exception 'INVALID_PRODUCT_PROFIT'; end if;
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and (a.account_id='OWNER' or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability='PLANNING_EDIT' and c.effect='ALLOW'))
  ) then raise exception 'FORBIDDEN'; end if;

  select * into v_existing from public.planning_product_profit_revisions r
   where r.request_id=p_request_id;
  if found then
    return query select m.* from public.planning_product_profit_models m where m.model_id=v_existing.model_id;
    return;
  end if;

  v_model_id:=nullif(btrim(coalesce(p_model_id,'')),'');
  if v_model_id is null then
    if coalesce(p_base_revision,0)<>0 then raise exception 'CONFLICT'; end if;
    v_model_id:='PPM_'||replace(gen_random_uuid()::text,'-','');
    v_next:=1;
    insert into public.planning_product_profit_models(
      model_id,product_name,unit_name,sales_channel,sale_price,purchase_cost,package_cost,
      shipping_cost,sales_fee,other_cost,monthly_units,note,status,current_revision,
      created_by,created_at,updated_by,updated_at
    ) values (
      v_model_id,left(btrim(p_product_name),160),left(btrim(coalesce(p_unit_name,'')),80),
      left(btrim(coalesce(p_sales_channel,'')),160),coalesce(p_sale_price,0),coalesce(p_purchase_cost,0),
      coalesce(p_package_cost,0),coalesce(p_shipping_cost,0),coalesce(p_sales_fee,0),coalesce(p_other_cost,0),
      coalesce(p_monthly_units,0),left(coalesce(p_note,''),4000),'ACTIVE',v_next,p_actor_id,v_now,p_actor_id,v_now
    );
  else
    select * into v_model from public.planning_product_profit_models m
     where m.model_id=v_model_id for update;
    if not found or v_model.status<>'ACTIVE' then raise exception 'NOT_FOUND'; end if;
    if v_model.current_revision<>coalesce(p_base_revision,-1) then raise exception 'CONFLICT'; end if;
    v_next:=v_model.current_revision+1;
    update public.planning_product_profit_models m set
      product_name=left(btrim(p_product_name),160),
      unit_name=left(btrim(coalesce(p_unit_name,'')),80),
      sales_channel=left(btrim(coalesce(p_sales_channel,'')),160),
      sale_price=coalesce(p_sale_price,0),purchase_cost=coalesce(p_purchase_cost,0),
      package_cost=coalesce(p_package_cost,0),shipping_cost=coalesce(p_shipping_cost,0),
      sales_fee=coalesce(p_sales_fee,0),other_cost=coalesce(p_other_cost,0),
      monthly_units=coalesce(p_monthly_units,0),note=left(coalesce(p_note,''),4000),
      current_revision=v_next,updated_by=p_actor_id,updated_at=v_now
    where m.model_id=v_model_id;
  end if;

  v_revision_id:='PPR_'||replace(gen_random_uuid()::text,'-','');
  insert into public.planning_product_profit_revisions(
    revision_id,model_id,revision,product_name,unit_name,sales_channel,sale_price,purchase_cost,
    package_cost,shipping_cost,sales_fee,other_cost,monthly_units,note,created_by,created_at,request_id
  ) select
    v_revision_id,m.model_id,m.current_revision,m.product_name,m.unit_name,m.sales_channel,m.sale_price,
    m.purchase_cost,m.package_cost,m.shipping_cost,m.sales_fee,m.other_cost,m.monthly_units,m.note,
    p_actor_id,v_now,p_request_id
  from public.planning_product_profit_models m where m.model_id=v_model_id;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
  values(p_actor_id,'planning.profit.save','PRODUCT_PROFIT',v_model_id,'제품 수익 구조 저장',p_request_id,
    jsonb_build_object('revision',v_next,'product_name',left(btrim(p_product_name),160)));

  return query select m.* from public.planning_product_profit_models m where m.model_id=v_model_id;
end;
$$;

create or replace function public.code1_archive_product_profit_model(
  p_actor_id text,
  p_model_id text,
  p_request_id text
) returns setof public.planning_product_profit_models
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_model public.planning_product_profit_models%rowtype;
begin
  if p_request_id is null or p_request_id !~ '^[a-f0-9]{32}$' then raise exception 'INVALID_REQUEST'; end if;
  if not exists(
    select 1 from public.workspace_accounts a
    where a.account_id=p_actor_id and a.status='active' and a.archived_at is null
      and (a.account_id='OWNER' or exists(
        select 1 from public.account_capabilities c
        where c.account_id=a.account_id and c.capability='PLANNING_EDIT' and c.effect='ALLOW'))
  ) then raise exception 'FORBIDDEN'; end if;
  select * into v_model from public.planning_product_profit_models m where m.model_id=p_model_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_model.status='ACTIVE' then
    update public.planning_product_profit_models m
      set status='ARCHIVED',updated_by=p_actor_id,updated_at=now()
      where m.model_id=p_model_id;
    insert into public.audit_log(actor_id,action,target_type,target_id,detail,request_id,metadata)
    values(p_actor_id,'planning.profit.archive','PRODUCT_PROFIT',p_model_id,'제품 수익 구조 보관 처리',p_request_id,
      jsonb_build_object('product_name',v_model.product_name));
  end if;
  return query select m.* from public.planning_product_profit_models m where m.model_id=p_model_id;
end;
$$;

revoke all on function public.code1_save_product_profit_model(text,text,integer,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,integer,text,text) from public,anon,authenticated;
revoke all on function public.code1_archive_product_profit_model(text,text,text) from public,anon,authenticated;
grant execute on function public.code1_save_product_profit_model(text,text,integer,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,integer,text,text) to service_role;
grant execute on function public.code1_archive_product_profit_model(text,text,text) to service_role;

-- Replace the staging management summary with plain Korean while preserving the previous published snapshot.
update public.planning_brief_versions
set status='SUPERSEDED'
where brief_key='EXECUTIVE_CURRENT' and status='PUBLISHED' and brief_version<>'v0.2-20260912-plain';

insert into public.planning_brief_versions(
  brief_key,brief_version,status,source_doc_ids,source_revision,source_version,
  content_json,sections,confidentiality,published_at,published_by,created_by
)
select
  'EXECUTIVE_CURRENT','v0.2-20260912-plain','PUBLISHED',b.source_doc_ids,b.source_revision,b.source_version,
  jsonb_build_object(
    'title','CODE1 현재 사업 계획 요약',
    'status','내부 검토용',
    'audience','그레이트팜 대표, 사업 담당자, CODE1 운영 담당자',
    'purpose','긴 기획문서를 모두 읽지 않아도 현재 사업 방향, 수익이 생기는 방법, 지금 해야 할 일과 아직 확인되지 않은 위험을 빠르게 파악한다.'
  ),
  jsonb_build_array(
    jsonb_build_object('id','business','title','1. CODE1이 하는 일','body',jsonb_build_array(
      '현재 첫 판매는 사육환경번호 1번 계란을 중심으로 시작한다. 여러 농가의 상품과 공급 정보를 한곳에서 관리하고, 소비자 판매와 기업 거래를 연결하는 것이 핵심이다. 운영 사업자는 농업회사법인 그레이트팜이며 결제 대행사는 Toss Payments를 사용할 예정이다. 실제 판매자와 계약 책임 주체는 계약 전에 최종 확인한다.',
      '장기적으로는 1번 계란에만 머무르지 않는다. 사육환경번호 1~4번 계란을 모두 다룰 수 있게 하고, 그레이트팜이 보유하거나 준비하는 농축산 기술·제품도 사업성이 확인되면 별도 상품으로 연결한다. 1~4번은 품질 순위가 아니라 사육환경 구분이다.'
    )),
    jsonb_build_object('id','revenue','title','2. 수익이 생기는 방법','items',jsonb_build_array(
      jsonb_build_object('label','유통·관리 대행','text','외부 유통사나 기업의 공급 요청을 농가·선별장 대신 모아서 관리하고, 물량 조정·연락·정산 같은 일을 맡아 수익을 만든다. 알당 10원 관리수익은 전달받은 내용이며 실제 계약으로 확인하기 전에는 확정 수익으로 보지 않는다.'),
      jsonb_build_object('label','상품 판매','text','공식몰, 자체 상품, 위탁 생산 상품, 기업 거래, 제휴 판매처에서 상품을 판매해 남는 금액을 만든다. 알당 250원 수익안은 현재 가정이며 실제 원가와 계약 범위를 확인해야 한다.'),
      jsonb_build_object('label','유료 회원제','text','월요금이나 연회비를 받는 회원제를 검토한다. 일반 정기배송과는 구분하며, 선물·배송지원 같은 비용까지 계산한 뒤 가격과 혜택을 정한다.')
    )),
    jsonb_build_object('id','supply','title','3. 현재 파악한 공급 상황','items',jsonb_build_array(
      '합천에 주요 관계 농가가 모여 있다는 전달 내용이 있다.',
      '알이랑 선별장이 주변 농가 물량의 선별·포장을 맡는다는 전달 내용이 있다.',
      '전체 관계 농가의 최대 공급량이 하루 약 18만 알, 유정란이 하루 약 2만 알이라는 정보가 있으나 아직 문서와 실제 수량으로 확인되지 않았다.',
      '전국으로 넓히려면 농가뿐 아니라 지역별 선별·포장·출고 시설을 안정적으로 확보해야 한다.'
    )),
    jsonb_build_object('id','growth','title','4. 사업을 넓히는 순서','items',jsonb_build_array(
      '1단계. 1번 계란의 실제 공급량과 거래 구조를 확인한다.',
      '2단계. 합천 농가와 알이랑을 중심으로 누가 어떤 일을 맡고 얼마를 받는지 계약과 자료로 정리한다.',
      '3단계. CODE1 자체 상품을 여러 적격 농가와 지역 출고 거점에서 생산·출고할 수 있게 넓힌다.',
      '4단계. 소비자 선택, 가격대, 공급 안정성을 보면서 사육환경번호 1~4번 계란을 모두 다룰 수 있게 넓힌다. 1번은 프리미엄 출발점으로 유지한다.',
      '5단계. 그레이트팜이 보유하거나 준비하는 다른 농축산 기술·제품 중 실제로 사업성이 확인된 항목을 별도 사업으로 연결한다.'
    )),
    jsonb_build_object('id','kpi','title','5. 매주 확인할 숫자','items',jsonb_build_array(
      '확인 완료 농가 수 / 운영 중 농가 수',
      '확인 완료 선별·포장·출고 시설 수',
      '하루·주간 판매 가능 물량과 실제 출고 가능 물량',
      '유통·관리 대행 물량과 알당 실제 관리수익',
      '공식몰 총 판매금액과 실제로 남는 금액',
      '자체 상품 판매량과 알당 실제로 남는 금액',
      '기업·제휴 거래처 수와 반복 주문 물량',
      '유료 회원 수, 회원 1명당 평균 매출, 해지율, 혜택 비용',
      '제때 출고·도착한 비율, 파손·불만 발생 비율',
      '아직 확인되지 않은 핵심 정보 수와 확인 완료 비율'
    )),
    jsonb_build_object('id','economics','title','6. 수익 계산 방법','items',jsonb_build_array(
      '유통·관리 대행 수익 = 실제 관리 물량 × 계약서에 적힌 알당 관리금액.',
      '자체 상품에서 남는 금액 = 판매금액 - 농가 또는 위탁생산 지급액 - 포장비 - 배송비 - 결제수수료 - 할인비 - 환불·파손 비용.',
      '유료 회원제 매출 = 유료 회원 수 × 실제 요금. 여기에서 선물·배송지원 같은 비용을 뺀다.',
      '10원/알, 250원/알, 2,000원/월, 18만 알/일, 유정란 2만 알/일은 확인 수준이 서로 다르므로 확정값처럼 더하지 않는다.'
    )),
    jsonb_build_object('id','next','title','7. 지금 해야 할 일','items',jsonb_build_array(
      '합천 농가와 알이랑의 관계, 실제 하루 공급량, 유정란 공급량, 시설 역할과 영업 자격을 자료로 확인한다.',
      '알당 10원 관리수익 구조에서 실제 거래 순서, 계약 당사자, 돈을 받는 주체, 맡는 업무를 실제 사례로 확인한다.',
      '알당 250원 수익안의 실제 원가와 어떤 상품·계약에 적용되는지 확인한다.',
      '유료 회원제의 가격, 혜택, 선물 비용, 배송비, 해지 기준을 계산해 정한다.',
      '전국 확장을 위해 지역별 선별·포장 시설 목록을 만든다.',
      '사육환경번호 1~4번 계란으로 넓힐 때 브랜드와 상품 정보 구성을 정하되, 현재 승인된 1번 계란 출시 화면은 별도 승인 없이 바꾸지 않는다.',
      '그레이트팜의 다른 사업 항목은 사업 기회 목록으로 관리하고, 효능·성능 주장은 독립 확인과 법률 검토 전에는 소비자 문구로 사용하지 않는다.'
    )),
    jsonb_build_object('id','open','title','8. 아직 결정하지 않은 것','items',jsonb_build_array(
      '유료 회원제의 등급 수, 가격, 연회비, 선물 구성',
      '사육환경번호 1~4번 계란을 소비자에게 어떻게 구분해서 보여줄지',
      '첫 출시 상품의 실제 판매 방식과 법적 판매자',
      '합천 밖 지역의 선별·포장·출고 시설을 확보하는 방법',
      '그레이트팜의 여러 사업 중 CODE1에 먼저 연결할 순서',
      '실제 공급량, 판매가격, 배송비, 파손·환불 비용, 결제 계약값'
    ))
  ),
  'INTERNAL',now(),'OWNER','OWNER'
from public.planning_brief_versions b
where b.brief_key='EXECUTIVE_CURRENT'
order by b.published_at desc nulls last
limit 1
on conflict (brief_key,brief_version) do update set
  status='PUBLISHED',content_json=excluded.content_json,sections=excluded.sections,
  confidentiality='INTERNAL',published_at=now(),published_by='OWNER';

insert into public.planning_document_revisions(
  revision_id,document_id,revision,title,purpose,sections,summary,created_by,request_id
)
select
  'PDR_EXECUTIVE_CURRENT_000002','EXECUTIVE_CURRENT',2,
  b.content_json->>'title',b.content_json->>'purpose',b.sections,
  '표현을 쉬운 한국어로 정리','OWNER','seed-plain-language-v2'
from public.planning_brief_versions b
join public.planning_documents d on d.document_id='EXECUTIVE_CURRENT' and d.current_revision=1
where b.brief_key='EXECUTIVE_CURRENT' and b.brief_version='v0.2-20260912-plain'
on conflict (document_id,revision) do nothing;

update public.planning_documents d
set title=b.content_json->>'title',purpose=b.content_json->>'purpose',
    current_revision=2,current_revision_id='PDR_EXECUTIVE_CURRENT_000002',
    source_brief_key=b.brief_key,source_brief_version=b.brief_version,
    updated_by='OWNER',updated_at=now()
from public.planning_brief_versions b
where d.document_id='EXECUTIVE_CURRENT' and d.current_revision=1
  and b.brief_key='EXECUTIVE_CURRENT' and b.brief_version='v0.2-20260912-plain'
  and exists(select 1 from public.planning_document_revisions r where r.revision_id='PDR_EXECUTIVE_CURRENT_000002');

commit;
