# CODE1 Supabase STAGING Apply Gate — 2026-09-10

Status: SCHEMA_APPLIED / SECURITY_GATE_PASS / CI_GATE_PASS / SOURCE_SNAPSHOT_VERIFIED / DATA_IMPORT_PENDING_SERVICE_ROLE_CONTEXT
Track: CODING
Branch: `coding/runtime-backend-staging`
Logical environment: CODE1 STAGING only
Supabase project ref: `bsintmkyhptizrjoizfb`
Production/live cutover: NOT APPROVED
Planning delta seen: `20260910-002`

## Applied migration ledger

Applied to the dedicated CODE1 STAGING project only:

1. `code1_0001_runtime` — `20260910101211`
2. `code1_0002_mutations` — `20260910101239`
3. `code1_0003_planning_delta_20260910` — `20260910101312`
4. `code1_0004_preapply_security_hardening` — `20260910101342`
5. `code1_0005_service_role_grants` — `20260910112427`
6. `code1_0006_postapply_security_hardening` — `20260910112904`
7. `code1_0007_auth_throttle` — `20260910123656`
8. `code1_0008_auth_throttle_sha256_compat` — `20260910125021`
9. `code1_0009_account_mutations` — `20260910133932`

No HOOOO, Production, Public Frontend, or current live runtime resource was modified by these database migrations.

## Post-apply security and mutation gate

`Automatically expose new tables` is disabled. `0005` explicitly grants required runtime access to `service_role` while keeping browser roles denied. `0006` fixes CODE1 function search paths and removes direct API-role EXECUTE from the Supabase-generated `public.rls_auto_enable()` helper while preserving its event-trigger behavior.

`0007` moves the legacy password-login throttle contract into Postgres under the staging service boundary. `0008` corrects its user-key namespace to SHA-256 compatibility with the Apps Script implementation. `0009` makes account save and password rotation atomic PostgreSQL transactions so account/farm-access/audit state cannot be partially updated across multiple REST writes.

Current verified state after `0009`:

- 20 runtime/planning tables have RLS enabled.
- anon/authenticated have no direct table SELECT path.
- service_role has the required server-side table access.
- `submission_answers_current` is service-role readable and browser-role unreadable.
- CODE1 service-boundary mutation/auth RPCs are not executable by anon/authenticated.
- `code1_auth_throttle`, `code1_save_account`, and `code1_change_password` are SECURITY DEFINER functions with fixed search paths and service-role-only EXECUTE.
- Security Advisor: WARN 0. Remaining `rls_enabled_no_policy` notices are intentional INFO because browser table access is prohibited and application authorization lives at the Cloudflare service boundary.
- Performance Advisor: INFO only — 23 unindexed foreign-key notices and 11 unused-index notices. Index changes remain deferred until imported-data query plans and measured latency exist.

## Current STAGING data state

The connected SQL session was re-verified as `supabase_read_only_user` with both `transaction_read_only=on` and `default_transaction_read_only=on`. It can inspect the target but cannot execute the source import.

The rejected connector DML attempt wrote zero rows. Re-check after `0009` confirms the durable import target remains empty across the checked runtime/planning surfaces. There is no partial source import.

## Authoritative private source snapshot

Migration source authority remains the native Google Sheet / Google Sheets API representation. The actual private `source.json` is not committed because it contains credential-derived account fields and operational log data.

Safe integrity manifest: `docs/coding/SOURCE_SNAPSHOT_MANIFEST_20260910.md`.

Private snapshot integrity metadata:

- SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- byte size: `200458`

Verified normalized source counts:

- farms: 12
- workspace accounts: 2
- active question catalog rows: 231
- source submission rows: 8 = 5 answer revisions + 3 `__COMMIT__` sentinels
- normalized submissions: 2
- farm runtime media rows: 4, all current status `DELETED`
- DECK media excluded from farm runtime cutover: 2
- media history events: 5
- access log rows: 29
- login guard rows: 3
- question policies/history: 0 / 0
- housing-environment source records: 12, migration state `UNCONFIRMED`
- planning capabilities/brief versions/source artifacts: 0 / 0 / 0

### Source anomaly — stale duplicate farm block

Direct live-Sheet read confirmed `01_농가_Master` contains a second sparse `GF-ORIGIN-01` through `GF-ORIGIN-12` block at rows 501–512, all in `자료요청` state. The canonical migration snapshot uses rows 2–13 only.

The duplicate block is excluded rather than merged because including it creates duplicate `farm_id` identities and source normalization correctly fails closed. The source Sheet itself was not modified. Any future snapshot regeneration must preserve the rows 2–13 boundary until a separate source-cleanup decision is made.

Required migration semantics:

- preserve explicit blank answer revision `C-02 / revision 2`;
- convert `__COMMIT__` rows to submission current-revision state, never answer rows;
- preserve both ORGANIZED and later TRASHED events for the same legacy media;
- exclude DECK media from farm runtime migration;
- keep legacy media `GOOGLE_DRIVE_LEGACY` with no R2 object key until the R2 phase;
- never default housing-environment code to 1; explicit source 1 stays 1, `미확인`/blank becomes NULL, all imported housing records remain UNCONFIRMED;
- do not auto-grant Planning Delta capabilities.

## Import runner and fail-closed preflight

The isolated branch contains:

- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/src/import-preflight.mjs`
- `backend/staging/scripts/preflight-import-to-staging.mjs`
- `backend/staging/test/import-runner.test.mjs`
- `backend/staging/test/import-preflight.test.mjs`
- `backend/staging/test/import-idempotency.test.mjs`

Apply requires:

- `CODE1_IMPORT_TARGET=STAGING`
- `CODE1_IMPORT_CONFIRM_REF` exactly equal to `CODE1_STAGING_PROJECT_REF`
- Supabase URL hostname matching that exact project ref
- server-only `CODE1_SUPABASE_SERVICE_ROLE_KEY`

Preflight reads all durable import surfaces before any write. First import requires an all-zero target. A non-empty retry is refused unless `CODE1_IMPORT_ALLOW_NONEMPTY=IDEMPOTENT_RETRY` is explicitly set. Preflight output does not expose the service-role secret.

The import runner performs normalization, stable actor mapping, explicit-blank preservation, deleted-media timestamp reconstruction, idempotent upserts, migration-registry updates, and post-write count verification.

### Retry idempotency correction

A pre-import audit found that append-only `media_events` and `audit_log` retry deduplication already queried `metadata.source_row`, but the normalizer was not storing that field. That could duplicate legacy append-only rows during an explicitly allowed `IDEMPOTENT_RETRY`.

This was fixed before any source data was imported:

- `source-normalizer.mjs` now records `metadata.source` plus original source row ordinal as `metadata.source_row` for both media-history and access-log records.
- commit: `2fa67873bc16c573cb48c4bb674f2fb5f63ad698`
- dedicated second-apply regression test: `backend/staging/test/import-idempotency.test.mjs`
- test commit: `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71`

## Automated verification

Latest code-bearing verification run: GitHub Actions `34494835092` on HEAD `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71` — SUCCESS.

- syntax check: PASS
- staging unit/contract tests: 41/41 PASS
- retry idempotency regression: PASS
- root regression baseline gate: PASS; no new root regression beyond the five known pre-existing failures
- build: PASS

The five known root baseline failures remain the deck-edit fixture, media-organizer filename assertion, two media-upload UX fixture assertions, and `test/migration.test.mjs`. The coding/backend track does not modify Public/UIUX/legacy media sources merely to force those unrelated baseline tests green.

`npm ci` previously reported 4 dependency vulnerabilities (3 high, 1 critical). They remain a separate dependency-hardening item; no forced breaking dependency upgrade is performed inside this runtime migration step.

## Cross-track boundary

Planning Delta `20260910-002` has been read and coding Message Bus activation `MSG-20260910-0004` ACKED. Delta 002 explicitly leaves current coding priority unchanged and does not authorize Public Frontend/live/main/Production implementation. Future Public commerce schema/API extensibility requirements are recorded only as awareness.

## Current import blocker

The remaining blocker is execution context, not source normalization, schema, security, or CI:

- connected Supabase SQL is read-only;
- connected tools do not expose the CODE1 service-role secret;
- GitHub connector does not provide repository-secret administration;
- the private source snapshot must not be committed to Git or embedded in a browser bundle.

Do not work around this by committing service-role secrets, account credential hashes, private source rows, or writable import credentials to Git/migrations/browser code/chat-visible configuration.

## Next atomic action

1. Establish a writable CODE1 STAGING service-role execution context outside Git/browser/docs/chat.
2. Use the verified private source snapshot identified by the manifest hash.
3. Run `backend/staging/scripts/preflight-import-to-staging.mjs` and require `FIRST_IMPORT` with an all-zero target.
4. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
5. Verify exact counts, stable IDs, revisions, deleted-media history, append-only retry identity, actor mapping, permissions, and planning capability count 0.
6. Re-run Security/Performance Advisors and measured imported-data query checks.
7. Only after DB data gate PASS, verify the exact existing CODE1 R2 bucket/binding and proceed to isolated private-media migration/integration tests.

Live/Public Frontend remains unchanged. Production remains prohibited.
