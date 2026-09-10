-- CODE1 Internal Workspace STAGING auth throttle helper.
-- Isolated migration only. Preserve the legacy 15-minute limits while moving
-- the password-login hot path from Apps Script/Sheets to Postgres.

begin;

create or replace function public.code1_auth_throttle(
  p_username text,
  p_ip_key text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_ip_key text := lower(btrim(coalesce(p_ip_key,'')));
  v_now timestamptz := clock_timestamp();
  v_window interval := interval '15 minutes';
  v_key text;
  v_limit integer;
  v_row public.login_guard%rowtype;
begin
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'LOGIN_INVALID';
  end if;
  if v_ip_key !~ '^[a-f0-9]{64}$' then
    raise exception 'FORBIDDEN';
  end if;

  -- Serialize each dimension independently. The two-user internal workspace
  -- stays cheap while concurrent login attempts cannot race the counters.
  perform pg_advisory_xact_lock(hashtext('code1-login-ip:' || v_ip_key));
  perform pg_advisory_xact_lock(hashtext('code1-login-user:' || v_username));

  foreach v_key in array array[
    'ip:' || v_ip_key,
    'user:' || md5(v_username)
  ] loop
    v_limit := case when v_key like 'ip:%' then 40 else 8 end;

    select * into v_row
    from public.login_guard
    where guard_key = v_key
    for update;

    if not found then
      insert into public.login_guard(guard_key,window_start,attempts,updated_at)
      values(v_key,v_now,1,v_now);
    else
      if v_row.window_start <= v_now - v_window then
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
    end if;
  end loop;
end;
$$;

revoke all on function public.code1_auth_throttle(text,text) from public;
revoke all on function public.code1_auth_throttle(text,text) from anon;
revoke all on function public.code1_auth_throttle(text,text) from authenticated;
grant execute on function public.code1_auth_throttle(text,text) to service_role;

commit;
