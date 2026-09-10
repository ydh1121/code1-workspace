-- CODE1 Internal Workspace STAGING auth-throttle compatibility fix.
-- Keep the migrated login_guard user key compatible with the existing Apps Script
-- contract: user:<sha256(username)> rather than introducing a new key space.

begin;

create or replace function public.code1_auth_throttle(
  p_username text,
  p_ip_key text
) returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_ip_key text := lower(btrim(coalesce(p_ip_key,'')));
  v_now timestamptz := clock_timestamp();
  v_window interval := interval '15 minutes';
  v_key text;
  v_limit integer;
  v_row public.login_guard%rowtype;
  v_user_hash text;
begin
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'LOGIN_INVALID';
  end if;
  if v_ip_key !~ '^[a-f0-9]{64}$' then
    raise exception 'FORBIDDEN';
  end if;

  v_user_hash := encode(extensions.digest(convert_to(v_username,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtext('code1-login-ip:' || v_ip_key));
  perform pg_advisory_xact_lock(hashtext('code1-login-user:' || v_user_hash));

  foreach v_key in array array[
    'ip:' || v_ip_key,
    'user:' || v_user_hash
  ] loop
    v_limit := case when v_key like 'ip:%' then 40 else 8 end;

    select * into v_row
    from public.login_guard
    where guard_key = v_key
    for update;

    if not found then
      insert into public.login_guard(guard_key,window_start,attempts,updated_at)
      values(v_key,v_now,1,v_now);
    elsif v_row.window_start <= v_now - v_window then
      update public.login_guard
      set window_start=v_now, attempts=1, updated_at=v_now
      where guard_key=v_key;
    else
      if v_row.attempts >= v_limit then
        raise exception 'LOGIN_THROTTLED';
      end if;
      update public.login_guard
      set attempts=v_row.attempts+1, updated_at=v_now
      where guard_key=v_key;
    end if;
  end loop;
end;
$$;

revoke all on function public.code1_auth_throttle(text,text) from public;
revoke all on function public.code1_auth_throttle(text,text) from anon;
revoke all on function public.code1_auth_throttle(text,text) from authenticated;
grant execute on function public.code1_auth_throttle(text,text) to service_role;

commit;
