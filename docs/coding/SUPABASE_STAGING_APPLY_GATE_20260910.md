# CODE1 Supabase STAGING Apply Gate — 2026-09-10

Status: SCHEMA_APPLIED / SECURITY_GATE_PASS / CI_GATE_PASS / DATA_IMPORT_PENDING_SERVICE_ROLE_CONTEXT
Track: CODING
Branch: `coding/runtime-backend-staging`
Logical environment: CODE1 STAGING only
Supabase project ref: `bsintmkyhptizrjoizfb`
Production/live cutover: NOT APPROVED
Planning delta seen: `20260910-001`

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
- Performance Advisor: INFO only — 23 unindexed foreign-key notices and 11 unused-index notices. The target has not received runtime workload, so index changes are deferred until imported-data query plans and measured latency exist.

## Current STAGING data state

A rejected connector DML attempt wrote zero rows. Re-check after `0009` confirms the durable import target is still empty:

- workspace_accounts: 0
- farms: 0
- question_catalog: 0
- intake_submissions: 0
- submission_answers: 0
- media_assets: 0
- media_events: 0
- audit_log: 0
- login_guard: 0
- housing_environment_records: 0
- account_capabilities: 0
- planning_brief_versions: 0
- planning_source_artifacts: 0

There is no partial source import.

## Authoritative source snapshot immediately before data import

Migration source authority is the native Google Sheet / Google Sheets API representation, not the earlier XLSX parser result.

Current normalized source counts:

- farms: 12
- workspace accounts: 2
- active question catalog rows: 231
- submissions: 2
- answer revisions: 5
- commit sentinels represented as submission revision state: 3
- farm runtime media rows: 4, all current status `DELETED`
- DECK media excluded from farm runtime cutover: 2
- media history events: 5
- access log rows: 29
- login guard rows: 3
- question policies/history: 0 / 0
- housing-environment source records: 12, migration state `UNCONFIRMED`
- planning capabilities/brief versions/source artifacts: 0 / 0 / 0

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

Apply requires:

- `CODE1_IMPORT_TARGET=STAGING`
- `CODE1_IMPORT_CONFIRM_REF` exactly equal to `CODE1_STAGING_PROJECT_REF`
- Supabase URL hostname matching that exact project ref
- server-only `CODE1_SUPABASE_SERVICE_ROLE_KEY`

Preflight reads all durable import surfaces before any write. First import requires an all-zero target. A non-empty retry is refused unless `CODE1_IMPORT_ALLOW_NONEMPTY=IDEMPOTENT_RETRY` is explicitly set. Preflight output does not expose the service-role secret.

The import runner performs normalization, stable actor mapping, explicit-blank preservation, deleted-media timestamp reconstruction, idempotent upserts, append-only source-row deduplication, migration-registry updates, and post-write count verification.

## Automated verification

GitHub Actions run `34486213742` on code-bearing HEAD `85e51274b30538d87acce2f7761b53be19fdfc64` completed SUCCESS:

- syntax check: PASS
- staging unit/contract tests: 40/40 PASS
- root regression suite: 35 PASS / 5 FAIL, with all five failures exactly matching the known pre-existing baseline
- zero new root regression failures
- build: PASS

The five known root baseline failures are the deck-edit fixture, media-organizer filename assertion, two media-upload UX fixture assertions, and `test/migration.test.mjs`. The coding/backend track does not modify Public/UIUX/legacy media sources merely to force those unrelated baseline tests green. CI fails if any additional root regression appears.

`npm ci` currently reports 4 dependency vulnerabilities (3 high, 1 critical). They are tracked separately; no forced breaking dependency upgrade is performed inside this runtime migration step.

## Current import blocker

The connected Supabase tool can inspect this CODE1 project and apply managed DDL migrations, but general SQL execution under the invited Developer context is read-only. No connected tool exposes the CODE1 service-role secret.

Do not work around this by committing service-role secrets, account credential hashes, private source rows, or writable import credentials to Git/migrations/browser code/chat-visible configuration.

## Next atomic action

1. Establish a writable CODE1 STAGING service-role execution context outside Git/browser/docs.
2. Run `backend/staging/scripts/preflight-import-to-staging.mjs` and require `FIRST_IMPORT` with an all-zero target.
3. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
4. Verify exact counts, stable IDs, revisions, deleted-media history, actor mapping, permissions, and planning capability count 0.
5. Re-run Security/Performance Advisors and measured imported-data query checks.
6. Only after DB data gate PASS, verify the exact existing CODE1 R2 bucket/binding and proceed to isolated private-media migration/integration tests.

Live/Public Frontend remains unchanged. Production remains prohibited.
