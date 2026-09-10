-- CODE1 Internal Workspace / STAGING atomic account mutations.
-- Keeps account row, farm access and audit log in one PostgreSQL transaction.
-- Browser roles never receive EXECUTE; Cloudflare service boundary only.

begin;

create or replace function public.code1_save_account(
  p_actor_id text,
  p_account_id text,
  p_base_version integer,
  p_username text,
  p_display_name text,
  p_role text,
  p_status text,
  p_permissions jsonb,
  p_farm_ids text[],
  p_credential jsonb default null
) returns setof public.workspace_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.workspace_accounts%rowtype;
  v_old public.workspace_accounts%rowtype;
  v_exists boolean := false;
  v_next_version integer;
  v_permissions jsonb := coalesce(p_permissions,'{}'::jsonb);
  v_farm_ids text[] := coalesce(p_farm_ids,array[]::text[]);
  v_hash text;
  v_salt text;
  v_iterations integer;
  v_scheme text;
begin
  if coalesce(p_account_id,'') = '' then raise exception 'INVALID_ACCOUNT'; end if;

  select * into v_actor from public.workspace_accounts
  where account_id=p_actor_id and status='active';
  if not found or v_actor.role not in ('SUPER_ADMIN','ADMIN') then raise exception 'FORBIDDEN'; end if;
  if v_actor.role='SUPER_ADMIN' and v_actor.account_id<>'OWNER' then raise exception 'FORBIDDEN'; end if;

  if p_role not in ('ADMIN','FARMER') or p_status not in ('active','disabled') then raise exception 'INVALID_ACCOUNT'; end if;
  if p_username is null or p_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' or btrim(coalesce(p_display_name,''))='' then raise exception 'INVALID_ACCOUNT'; end if;
  if jsonb_typeof(v_permissions)<>'object' then raise exception 'INVALID_PERMISSIONS'; end if;

  select * into v_old from public.workspace_accounts where account_id=p_account_id for update;
  v_exists := found;

  if v_exists then
    if v_old.account_id='OWNER' or v_old.account_id=v_actor.account_id then raise exception 'FORBIDDEN'; end if;
    if coalesce(p_base_version,0)<>v_old.session_version then raise exception 'CONFLICT'; end if;
    if p_username<>v_old.username then raise exception 'FORBIDDEN'; end if;
    if v_actor.role<>'SUPER_ADMIN' and (v_old.role<>'FARMER' or p_role<>'FARMER') then raise exception 'FORBIDDEN'; end if;
    v_next_version:=v_old.session_version+1;
  else
    if coalesce(p_base_version,0)<>0 then raise exception 'CONFLICT'; end if;
    if v_actor.role<>'SUPER_ADMIN' and p_role<>'FARMER' then raise exception 'FORBIDDEN'; end if;
    if exists(select 1 from public.workspace_accounts where username=p_username) then raise exception 'DUPLICATE_USERNAME'; end if;
    v_next_version:=1;
  end if;

  if p_role='FARMER' then
    if coalesce(v_permissions->>'farm','none') not in ('none','view','edit') or coalesce(v_permissions->>'deck','none') not in ('none','view','edit') then
      raise exception 'INVALID_PERMISSIONS';
    end if;
    if coalesce(v_permissions->>'farm','none')<>'none' and cardinality(v_farm_ids)=0 then raise exception 'INVALID_PERMISSIONS'; end if;
    if exists(
      select 1 from unnest(v_farm_ids) as x(farm_id)
      left join public.farms f on f.farm_id=x.farm_id
      where f.farm_id is null
    ) then raise exception 'INVALID_PERMISSIONS'; end if;
    v_permissions:=jsonb_build_object(
      'farm',coalesce(v_permissions->>'farm','none'),
      'deck',coalesce(v_permissions->>'deck','none'),
      'farmIds',to_jsonb(v_farm_ids)
    );
  else
    v_permissions:='{}'::jsonb;
    v_farm_ids:=array[]::text[];
  end if;

  if p_credential is not null then
    v_hash:=p_credential->>'hash';
    v_salt:=p_credential->>'salt';
    v_iterations:=nullif(p_credential->>'iterations','')::integer;
    v_scheme:=p_credential->>'scheme';
    if v_hash !~ '^[a-f0-9]{64}$' or v_salt !~ '^[a-f0-9]{32}$' or v_iterations<>100000 or v_scheme<>'pbkdf2-sha256-pepper-v1' then
      raise exception 'INVALID_CREDENTIAL';
    end if;
  elsif not v_exists then
    raise exception 'INVALID_CREDENTIAL';
  end if;

  if v_exists then
    update public.workspace_accounts set
      display_name=left(btrim(p_display_name),80),
      role=p_role,
      status=p_status,
      permissions_json=v_permissions,
      password_hash=coalesce(v_hash,v_old.password_hash),
      password_salt=coalesce(v_salt,v_old.password_salt),
      password_iterations=coalesce(v_iterations,v_old.password_iterations),
      password_scheme=coalesce(v_scheme,v_old.password_scheme),
      session_version=v_next_version,
      updated_at=now()
    where account_id=p_account_id;
  else
    insert into public.workspace_accounts(
      account_id,username,display_name,email,role,status,permissions_json,
      password_hash,password_salt,password_iterations,password_scheme,session_version
    ) values(
      p_account_id,p_username,left(btrim(p_display_name),80),'',p_role,p_status,v_permissions,
      v_hash,v_salt,v_iterations,v_scheme,v_next_version
    );
  end if;

  delete from public.farm_access where account_id=p_account_id;
  if p_role='FARMER' and cardinality(v_farm_ids)>0 then
    insert into public.farm_access(account_id,farm_id,access_level)
    select p_account_id,x,case when v_permissions->>'farm'='edit' then 'edit' else 'view' end
    from unnest(v_farm_ids) as x;
  end if;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,metadata)
  values(v_actor.account_id,case when v_exists then 'account.update' else 'account.create' end,'ACCOUNT',p_account_id,p_role,
    jsonb_build_object('backend','SUPABASE_STAGING','session_version',v_next_version));

  return query select * from public.workspace_accounts where account_id=p_account_id;
end;
$$;

create or replace function public.code1_change_password(
  p_actor_id text,
  p_base_version integer,
  p_credential jsonb
) returns setof public.workspace_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.workspace_accounts%rowtype;
  v_hash text := p_credential->>'hash';
  v_salt text := p_credential->>'salt';
  v_iterations integer := nullif(p_credential->>'iterations','')::integer;
  v_scheme text := p_credential->>'scheme';
  v_next integer;
begin
  select * into v_actor from public.workspace_accounts where account_id=p_actor_id for update;
  if not found or v_actor.status<>'active' then raise exception 'UNAUTHENTICATED'; end if;
  if v_actor.role='SUPER_ADMIN' and v_actor.account_id<>'OWNER' then raise exception 'FORBIDDEN'; end if;
  if v_actor.session_version<>p_base_version then raise exception 'CONFLICT'; end if;
  if v_hash !~ '^[a-f0-9]{64}$' or v_salt !~ '^[a-f0-9]{32}$' or v_iterations<>100000 or v_scheme<>'pbkdf2-sha256-pepper-v1' then
    raise exception 'INVALID_CREDENTIAL';
  end if;

  v_next:=v_actor.session_version+1;
  update public.workspace_accounts set
    password_hash=v_hash,password_salt=v_salt,password_iterations=v_iterations,password_scheme=v_scheme,
    session_version=v_next,updated_at=now()
  where account_id=p_actor_id;

  insert into public.audit_log(actor_id,action,target_type,target_id,detail,metadata)
  values(p_actor_id,'account.password','ACCOUNT',p_actor_id,'credential rotated',jsonb_build_object('backend','SUPABASE_STAGING','session_version',v_next));

  return query select * from public.workspace_accounts where account_id=p_actor_id;
end;
$$;

revoke all on function public.code1_save_account(text,text,integer,text,text,text,text,jsonb,text[],jsonb) from public, anon, authenticated;
revoke all on function public.code1_change_password(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.code1_save_account(text,text,integer,text,text,text,text,jsonb,text[],jsonb) to service_role;
grant execute on function public.code1_change_password(text,integer,jsonb) to service_role;

commit;
