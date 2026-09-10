# CODE1 CODING BATON

PLANNING_DELTA_SEQ_SEEN = 20260910-001

LAST_VERIFIED_ACTION: resumed the isolated CODE1 Supabase STAGING backend work, applied migrations `0007` through `0009`, moved account save/password mutation to atomic PostgreSQL RPCs, converted CI to a baseline-aware regression gate, added a fail-closed import preflight, and verified the latest GitHub Actions run is green. No live/Public Frontend/Production cutover was performed.

CURRENT_WORK: CODE1 STAGING schema/security/runtime adapters are prepared, but the real source-data import is still blocked on a writable CODE1 service-role execution context. Current live Internal Workspace remains Apps Script/Sheet/Drive; no dual-write exists.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main remains: `a71a71eae73706862308e194110f4fcc2d25db01`
- latest verified code-bearing HEAD before this documentation commit: `85e51274b30538d87acce2f7761b53be19fdfc64`
- GitHub Actions run: `34486213742` / SUCCESS
- staging unit+contract tests: 40/40 PASS
- root regression gate: 35 PASS / 5 known pre-existing baseline failures only; zero new failures
- build: PASS
- `public/*` UI and legacy media/deck sources were not changed to make this backend gate pass.

SUPABASE_STAGING:
- project ref: `bsintmkyhptizrjoizfb`
- region: Seoul (`ap-northeast-2`)
- logical environment: CODE1 STAGING only
- Production: NOT CREATED/NOT CONNECTED by this workstream
- HOOOO refs/projects: excluded and untouched

APPLIED_MIGRATIONS:
1. `code1_0001_runtime` / `20260910101211`
2. `code1_0002_mutations` / `20260910101239`
3. `code1_0003_planning_delta_20260910` / `20260910101312`
4. `code1_0004_preapply_security_hardening` / `20260910101342`
5. `code1_0005_service_role_grants` / `20260910112427`
6. `code1_0006_postapply_security_hardening` / `20260910112904`
7. `code1_0007_auth_throttle` / `20260910123656`
8. `code1_0008_auth_throttle_sha256_compat` / `20260910125021`
9. `code1_0009_account_mutations` / `20260910133932`

LATEST SECURITY/DB GATE:
- 20 runtime/planning tables remain RLS-enabled with no browser data policies by design.
- anon/authenticated have no direct table read path.
- `code1_auth_throttle`, `code1_save_account`, `code1_change_password`: SECURITY DEFINER with fixed search_path, browser-role EXECUTE denied, service_role EXECUTE allowed.
- account mutation now happens transactionally inside `code1_save_account` / `code1_change_password`; the adapter no longer leaves a partial account/farm_access/audit state across several HTTP writes.
- Security Advisor after `0009`: WARN 0; only intentional `rls_enabled_no_policy` INFO remains.
- Performance Advisor after `0009`: INFO only (`unindexed_foreign_keys` 23, `unused_index` 11). Target is still empty, so do not add/remove indexes solely to silence INFO before import and measured query tests.

CURRENT_STAGING_DATA:
- runtime import target remains empty: accounts 0, farms 0, questions 0, submissions 0, media 0.
- no source import was partially written by the rejected connector DML attempt.

AUTHORITATIVE NATIVE SOURCE COUNTS:
- farms 12
- accounts 2
- questions 231
- submissions 2
- answer revisions 5
- commit sentinels 3
- farm media 4, all current status DELETED
- DECK media excluded 2
- media events 5
- access logs 29
- login guard 3
- question policies/history 0/0
- housing-environment records 12, migration state UNCONFIRMED
- planning capabilities/brief versions/planning artifacts 0/0/0

MIGRATION SEMANTICS:
- preserve explicit blank answer revision `C-02 / revision 2`;
- convert `__COMMIT__` rows to submission current-revision state, never answers;
- preserve both ORGANIZED and later TRASHED events for the same legacy media;
- exclude DECK media from farm runtime media;
- legacy media stay `GOOGLE_DRIVE_LEGACY` with no R2 object key until the R2 phase;
- housing code 1 is only an explicit source value, never a default; `미확인`/blank become NULL and imported records stay UNCONFIRMED;
- do not auto-grant Planning Delta capabilities.

IMPORT TOOLING:
- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/src/import-preflight.mjs`
- `backend/staging/scripts/preflight-import-to-staging.mjs`
- apply requires `CODE1_IMPORT_TARGET=STAGING`, exact `CODE1_IMPORT_CONFIRM_REF`, exact staging URL/ref match, and a server-only `CODE1_SUPABASE_SERVICE_ROLE_KEY`.
- preflight reads all durable import surfaces before write, refuses a non-empty target by default, and only permits a non-empty idempotent retry with explicit `CODE1_IMPORT_ALLOW_NONEMPTY=IDEMPOTENT_RETRY`.
- preflight output never includes the service-role secret.

KNOWN ROOT BASELINE FAILURES — DO NOT FIX FROM CODING/BACKEND TRACK BY EDITING UI:
1. `deck edit text uses side panel, undo/redo restores content, ordinary save has no prompt`
2. `organizer uses human-readable farm, shot and label naming instead of legacy upload-id prefix`
3. `media upload UX replaces long select with grouped searchable shot cards`
4. `media shot search finds items across categories and keeps native select synchronized`
5. `test/migration.test.mjs`

CI now treats exactly those five as the known baseline and fails on any additional root regression. This is not equivalent to claiming the root suite itself is fully green.

CURRENT_BLOCKER:
- Supabase connector can inspect the CODE1 project and apply managed DDL migrations, but general SQL execution is read-only in the current invited Developer context.
- no connected tool exposes the CODE1 service-role/secret key.
- do not put credential hashes or service-role secrets into Git, migrations, logs, browser code, or chat-visible config as a workaround.

NEXT_ATOMIC ACTION:
1. Establish a writable CODE1 STAGING service-role execution context outside Git/browser/docs.
2. Run `preflight-import-to-staging.mjs`; require FIRST_IMPORT / all-zero target.
3. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
4. Verify exact counts, stable IDs, revision history, deleted-media event history, actor mapping, permissions, and planning capability count 0.
5. Re-run Security/Performance Advisor and measured imported-data query checks.
6. Only after DB data gate PASS, verify the exact existing CODE1 R2 bucket/binding and proceed with isolated private-media migration/integration tests.
7. Do not change live/Public Frontend/Production before separately approved cutover.

ROLLBACK: live remains unchanged. Until an approved cutover, rollback remains “do nothing.” Existing Apps Script/Sheet/Drive stays the migration source and rollback evidence; long-term dual-write remains prohibited.
