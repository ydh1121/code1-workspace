-- CODE1 Planning Material archive assignment guard / STAGING ONLY
-- Authority: MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Delta049
-- Preserve assignment history but remove archived requests from active submitter access.

begin;

create or replace function public.code1_material_archive_assignment_guard()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status='ARCHIVED' and old.status is distinct from new.status then
    update public.planning_material_request_assignees
       set active=false
     where material_request_id=new.material_request_id and active=true;
  end if;
  return new;
end $$;

drop trigger if exists trg_code1_material_archive_assignment_guard on public.planning_material_requests;
create trigger trg_code1_material_archive_assignment_guard
after update of status on public.planning_material_requests
for each row
execute function public.code1_material_archive_assignment_guard();

revoke all on function public.code1_material_archive_assignment_guard() from public,anon,authenticated;

commit;
