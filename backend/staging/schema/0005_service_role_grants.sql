-- CODE1 Internal Workspace / STAGING ONLY
-- Explicit service-role grants required when Supabase "Automatically expose new tables" is disabled.
-- Browser roles remain fail-closed. Do not apply to Production or current live runtime.

begin;

revoke all on table
  workspace_accounts,
  farms,
  farm_access,
  question_catalog,
  intake_submissions,
  submission_answers,
  question_policies,
  question_policy_history,
  media_assets,
  media_events,
  review_decisions,
  audit_log,
  login_guard,
  migration_registry,
  housing_environment_records,
  account_capabilities,
  fact_inbox,
  fact_events,
  planning_brief_versions,
  planning_source_artifacts
from anon, authenticated;

grant select, insert, update, delete on table
  workspace_accounts,
  farms,
  farm_access,
  question_catalog,
  intake_submissions,
  submission_answers,
  question_policies,
  question_policy_history,
  media_assets,
  media_events,
  review_decisions,
  audit_log,
  login_guard,
  migration_registry,
  housing_environment_records,
  account_capabilities,
  fact_inbox,
  fact_events,
  planning_brief_versions,
  planning_source_artifacts
to service_role;

revoke all on table submission_answers_current from anon, authenticated;
grant select on table submission_answers_current to service_role;

-- Identity-backed tables may require sequence access on inserts. Keep it server-only.
grant usage, select on all sequences in schema public to service_role;
revoke all on all sequences in schema public from anon, authenticated;

-- Internal helper function is not part of the browser API surface.
revoke all on function code1_fact_transition_allowed(text,text) from public, anon, authenticated;
grant execute on function code1_fact_transition_allowed(text,text) to service_role;

commit;
