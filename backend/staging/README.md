# CODE1 Runtime Backend STAGING

Status: **ISOLATED_IMPLEMENTATION / NOT_CONNECTED_TO_LIVE / NO_PRODUCTION**

This directory is the coding-track implementation for replacing the hot path of the temporary CODE1 Internal Workspace. It does not modify the current live Pages/Apps Script runtime and it must not be pointed at another project's Supabase project.

## Runtime boundary

```text
existing CODE1 browser UI
  -> Cloudflare server boundary (Pages Functions / Worker runtime)
     -> CODE1 Supabase STAGING: structured runtime data, permissions, review/audit metadata
     -> private Cloudflare R2 binding: media/file bytes
```

R2 is never the canonical database. Public delivery assets are out of scope for this temporary cutover and must be generated only after a later approval/review pipeline.

## Auth decision for this phase

Do **not** introduce Supabase Auth yet. Preserve the current account IDs, username/password credentials, roles, session versions, server-only password pepper, signed HttpOnly Cloudflare session, and Google OWNER recovery path. Move account/permission lookup from Sheets to Supabase. Browser clients receive neither the Supabase service-role key nor R2 credentials.

RLS is enabled without browser policies in `0001_runtime.sql`; therefore anon/authenticated browser access is fail-closed. The Cloudflare server uses the service-role credential and performs explicit account-version/farm authorization.

## Stable IDs and migration source

Never use a Sheet row number as identity. Preserve `account_id`, `farm_id`, `submission_id`, `item_key`, `media_id/upload_id`, `policy_id`, and `request_id`. The Sheet `__COMMIT__` rows become `intake_submissions.current_revision`; they are not copied as answers. Explicit empty answer revisions are preserved because they represent clearing a previous answer.

Real source JSON and normalized output are private migration artifacts and are never committed. Native Google Sheets API values are the extraction authority. The 2026-09-10 XLSX export is snapshot evidence only because an isolated workbook-parser check produced a blank-cell interpretation anomaly.

`fixtures/2026-09-10-native-sheet-dry-run.md` contains only sanitized counts and integrity findings from the current native source.

## Media

Private original object keys are deterministic from stable IDs, not public website filenames:

`private/farms/{farm_id}/submissions/{submission_id}/media/{media_id}/original/{safe_original_name}`

Deletion is initially reversible: set DB state to `DELETED` immediately and retain the private R2 object until a separately approved retention purge. There is no public bucket/prefix in this implementation.

`mediaUpload.begin` returns a short-lived HMAC-scoped upload URL handled by `media-put.mjs`. That endpoint streams the request body to an R2 binding without exposing R2 credentials. The API contract can later be replaced with an S3-compatible R2 presigned PUT without changing the database model.

## Planning Delta 20260910-001

The isolated backend now contains an additive planning contract without implementing consumer UI, Premium Membership, or any live feature.

- `0003_planning_delta_20260910.sql` adds an extensible housing-environment record model with values 1–4; there is no permanent `= 1` database constraint and no quality-grade field in that model.
- `fact_inbox` and `fact_events` preserve reported/evidence/verification/approval states and superseding history. `USER_REPORTED`/`PARTNER_REPORTED` are not `VERIFIED`; external disclosure defaults to false and is not enabled by the current API.
- `planning_brief_versions` is a PUBLISHED snapshot read model. Runtime reads do not fetch the full Drive planning document per request.
- `account_capabilities` adds `EXECUTIVE_BRIEF_VIEW`, `FACT_SUBMIT`, `FACT_VERIFY`, and `FACT_APPROVE_CURRENT`. No account receives a new capability merely because it is currently SUPER_ADMIN or ADMIN; assignments remain an explicit later approval step.
- `planning_source_artifacts` is internal-only, prohibits public delivery, and permits only `private/planning/` object keys. No confidential planning PDF bytes or content are committed or copied to R2 by this branch.
- `staging-dispatch.mjs` composes the existing staging runtime adapter with the isolated Fact Inbox / Executive Brief API module without touching the live `/api/rpc` function.

## Environment contract

Required only in a future approved isolated staging deployment:

- `CODE1_STAGING_PROJECT_REF`
- `CODE1_SUPABASE_URL` — hostname must exactly match the staging ref
- `CODE1_SUPABASE_SERVICE_ROLE_KEY` — server only
- `CODE1_UPLOAD_TOKEN_SECRET` — server only, 32+ characters
- `CODE1_MEDIA_BUCKET` — R2 binding, not a text secret
- existing `SESSION_SECRET` and `PASSWORD_PEPPER` remain server only during auth compatibility migration

No values are committed. `db.mjs` refuses a URL whose hostname does not match `CODE1_STAGING_PROJECT_REF`.

## Current compatibility scope

Farm-runtime adapter actions implemented in the isolated backend include `bootstrap`, `getSubmission`, `saveSubmission`, submission review, small/private media upload, resumable upload authorization/finalization, media read/batch/delete/review, question-policy list/save, media-organizer compatibility, and account compatibility in the separate account adapter. Deck actions and legacy Drive-link ingestion are intentionally not part of the first farm hot-path cutover unless a compatibility requirement is separately established.

Isolated planning actions are `factInbox.list`, `factInbox.create`, `factInbox.transition`, and `executiveBrief.current`. They are not wired into the live Pages Functions.

## Migration workflow

1. Extract runtime source data to a local/private JSON file using native Google Sheets API values; never commit it.
2. `node scripts/normalize-source.mjs source.json normalized.json`.
3. `node scripts/verify-migration.mjs normalized.json`.
4. Apply schemas only to a separately approved CODE1 Supabase STAGING project.
5. Dry-run/apply normalized rows with stable-ID and count checks.
6. Migrate R2 bytes separately and verify every DB object key exists.
7. Run compatibility/integration tests before any live endpoint switch.
8. At cutover: final delta + short write freeze, then switch one reversible backend flag.
9. Keep Sheet/Drive read-only as rollback evidence after PASS.

Long-term dual-write is prohibited.

## Performance

No speed claim is accepted without measurement. `scripts/benchmark.mjs` records observed client RTT p50/p95 using an authenticated cookie supplied only through environment variables. Required cases are login, bootstrap, farm switch/getSubmission, draft save, text edit/delete save, photo upload, photo delete, and question-list load. Current baseline remains pending because this coding environment cannot establish the user's authenticated browser session or verify the live Pages deployment.
