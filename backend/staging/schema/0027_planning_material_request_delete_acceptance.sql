-- CODE1 Planning Material request-delete acceptance / STAGING ONLY
-- Authority: MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Delta049

begin;

do $$
declare
  v_owner text;
  v_admin text;
  v_pristine text;
  v_historied text;
  v_denied text;
  v_item text;
  v_result jsonb;
  v_failed boolean:=false;
  v_ids text[]:=array[]::text[];
  c_create1 constant text:=md5('0104-delete-accept-pristine-create');
  c_delete1 constant text:=md5('0104-delete-accept-pristine-delete');
  c_create2 constant text:=md5('0104-delete-accept-history-create');
  c_touch2 constant text:=md5('0104-delete-accept-history-touch');
  c_delete2 constant text:=md5('0104-delete-accept-history-delete');
  c_create3 constant text:=md5('0104-delete-accept-admin-create');
  c_delete3 constant text:=md5('0104-delete-accept-admin-delete');
  c_cleanup3 constant text:=md5('0104-delete-accept-admin-cleanup');
begin
  select account_id into v_owner from public.workspace_accounts where role='SUPER_ADMIN' and status='active' and archived_at is null order by account_id limit 1;
  select account_id into v_admin from public.workspace_accounts where role='ADMIN' and status='active' and archived_at is null order by account_id limit 1;
  if v_owner is null or v_admin is null then raise exception 'ACCEPTANCE_ACTORS_MISSING'; end if;

  select (public.code1_material_create_request(v_owner,'QA pristine delete','QA',jsonb_build_object('name','QA'),'DETAIL_PAGE',null,'PMT_GREAT_FARM_DEFAULT',array[]::text[],c_create1)->>'material_request_id') into v_pristine;
  select public.code1_material_delete_request(v_owner,v_pristine,'QA pristine delete',c_delete1) into v_result;
  if v_result->>'mode'<>'DELETED' then raise exception 'PRISTINE_NOT_DELETED'; end if;
  if exists(select 1 from public.planning_material_requests where material_request_id=v_pristine) then raise exception 'PRISTINE_REQUEST_RESIDUE'; end if;
  if exists(select 1 from public.planning_material_request_items where material_request_id=v_pristine) then raise exception 'PRISTINE_ITEM_RESIDUE'; end if;

  select (public.code1_material_create_request(v_owner,'QA history archive','QA',jsonb_build_object('name','QA'),'DETAIL_PAGE',null,'PMT_GREAT_FARM_DEFAULT',array[]::text[],c_create2)->>'material_request_id') into v_historied;
  select request_item_id into v_item from public.planning_material_request_items where material_request_id=v_historied order by sort_order_snapshot limit 1;
  perform public.code1_material_set_item_submission(v_owner,v_item,'LATER','QA history',c_touch2);
  select public.code1_material_delete_request(v_owner,v_historied,'QA history archive',c_delete2) into v_result;
  if v_result->>'mode'<>'ARCHIVED' or coalesce((v_result->>'history_preserved')::boolean,false)<>true then raise exception 'HISTORY_NOT_ARCHIVED'; end if;
  if not exists(select 1 from public.planning_material_requests where material_request_id=v_historied and status='ARCHIVED') then raise exception 'ARCHIVED_REQUEST_MISSING'; end if;
  if not exists(select 1 from public.planning_material_request_items where material_request_id=v_historied and submission_state='LATER') then raise exception 'ARCHIVED_HISTORY_LOST'; end if;

  select (public.code1_material_create_request(v_owner,'QA admin denied','QA',jsonb_build_object('name','QA'),'DETAIL_PAGE',null,'PMT_GREAT_FARM_DEFAULT',array[]::text[],c_create3)->>'material_request_id') into v_denied;
  begin
    perform public.code1_material_delete_request(v_admin,v_denied,'QA admin denied',c_delete3);
  exception when others then
    if sqlerrm='FORBIDDEN' then v_failed:=true; else raise; end if;
  end;
  if not v_failed then raise exception 'ADMIN_DELETE_NOT_DENIED'; end if;
  select public.code1_material_delete_request(v_owner,v_denied,'QA admin denied',c_cleanup3) into v_result;
  if v_result->>'mode'<>'DELETED' then raise exception 'ADMIN_DENIAL_CLEANUP_FAILED'; end if;

  v_ids:=array[v_pristine,v_historied,v_denied];

  -- Cleanup only synthetic acceptance data. This is not the application delete path.
  delete from public.planning_material_requests where material_request_id=v_historied;
  delete from public.audit_log
   where request_id in (c_create1,c_delete1,c_create2,c_touch2,c_delete2,c_create3,c_delete3,c_cleanup3)
      or target_id=any(v_ids)
      or target_id in (select unnest(v_ids));

  if exists(select 1 from public.planning_material_requests where material_request_id=any(v_ids)) then raise exception 'DELETE_ACCEPTANCE_REQUEST_RESIDUE'; end if;
  if exists(select 1 from public.planning_material_request_items where material_request_id=any(v_ids)) then raise exception 'DELETE_ACCEPTANCE_ITEM_RESIDUE'; end if;
end $$;

commit;
