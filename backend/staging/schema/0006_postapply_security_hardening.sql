-- CODE1 Internal Workspace / STAGING ONLY
-- Post-apply security hardening after Supabase advisor review.
-- Do not apply to Production or current live runtime.

begin;

-- Fix mutable search_path findings on CODE1 public-schema helper/RPC functions.
alter function code1_fact_transition_allowed(text,text)
  set search_path = public, pg_temp;
alter function code1_save_submission(text,text,text,text,text,integer,text,jsonb)
  set search_path = public, pg_temp;
alter function code1_review_submission(text,text,integer,text,text,text)
  set search_path = public, pg_temp;
alter function code1_review_media(text,text,text,text,text)
  set search_path = public, pg_temp;
alter function code1_save_question_policies(text,text,jsonb)
  set search_path = public, pg_temp;
alter function code1_transition_fact(text,text,text,text,numeric,jsonb,text)
  set search_path = public, pg_temp;

-- Supabase Automatic RLS creates this SECURITY DEFINER event-trigger function.
-- The event trigger may remain, but it is not an application RPC and must not be callable
-- by browser/API roles or by the CODE1 service boundary.
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

commit;
