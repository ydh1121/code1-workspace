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

## Stable IDs

Never use a Sheet row number as identity. Preserve `account_id`, `farm_id`, `submission_id`, `item_key`, `media_id/upload_id`, `policy_id`, and `request_id`. The Sheet `__COMMIT__` rows become `intake_submissions.current_revision`; they are not copied as answers.

## Media

Private original object keys are deterministic from stable IDs, not public website filenames:

`private/farms/{farm_id}/submissions/{submission_id}/media/{media_id}/original/{safe_original_name}`

Deletion is initially reversible: set DB state to `DELETED` immediately and retain the private R2 object until a separately approved retention purge. There is no public bucket/prefix in this implementation.

`mediaUpload.begin` returns a 10-minute HMAC-scoped upload URL handled by `media-put.mjs`. That endpoint streams the request body to an R2 binding without exposing R2 credentials. The API contract can later be replaced with an S3-compatible R2 presigned PUT without changing the database model.

## Environment contract

Required only in the isolated staging deployment:

- `CODE1_STAGING_PROJECT_REF`
- `CODE1_SUPABASE_URL` — hostname must exactly match the staging ref
- `CODE1_SUPABASE_SERVICE_ROLE_KEY` — server only
- `CODE1_UPLOAD_TOKEN_SECRET` — server only, 32+ characters
- `CODE1_MEDIA_BUCKET` — R2 binding, not a text secret
- existing `SESSION_SECRET` and `PASSWORD_PEPPER` remain server only during auth compatibility migration

No values are committed. `db.mjs` refuses a URL whose hostname does not match `CODE1_STAGING_PROJECT_REF`.

## Current compatibility scope

Implemented adapter actions: `bootstrap`, `getSubmission`, `saveSubmission`, `questionPolicy.list`, `mediaUpload.begin`, `mediaUpload.finish`, `deleteMedia`, `mediaBatch`.

Not yet wired and therefore not cutover-ready: account administration writes, review mutations, question-policy writes, media review, legacy small upload/linkDrive compatibility, private media read delivery, and deck actions. Deck remains explicitly out of the farm-runtime cutover until compatibility is verified.

## Migration workflow

1. Export runtime source data to a local/private JSON file; never commit it.
2. `node scripts/normalize-source.mjs source.json normalized.json`.
3. `node scripts/verify-migration.mjs normalized.json`.
4. Apply schema only to a separately approved CODE1 Supabase STAGING project.
5. Dry-run/apply normalized rows with stable-ID and count checks.
6. Migrate R2 bytes separately and verify every DB object key exists.
7. Run compatibility/integration tests before any live endpoint switch.
8. At cutover: final delta + short write freeze, then switch one reversible backend flag.
9. Keep Sheet/Drive read-only as rollback evidence after PASS.

Long-term dual-write is prohibited.

## Performance

No speed claim is accepted without measurement. `scripts/benchmark.mjs` records observed client RTT p50/p95 using an authenticated cookie supplied only through environment variables. Required cases are login, bootstrap, farm switch/getSubmission, draft save, text edit/delete save, photo upload, photo delete, and question-list load. Current baseline remains pending because this coding environment cannot establish the user's authenticated browser session or verify the live Pages deployment.
