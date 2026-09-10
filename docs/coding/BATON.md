# CODE1 CODING BATON

PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0001

LAST_VERIFIED_ACTION: completed the secure operator import handoff for the isolated CODE1 runtime-backend migration. The private source snapshot was moved to a dedicated My Drive root private migration folder, a Windows SecureString import wrapper and explicit runbook were added, the CI workflow was extended to parse-check the PowerShell wrapper, and GitHub Actions run `34498679315` completed SUCCESS with staging 41/41 PASS, root baseline gate PASS, and build PASS. No actual source import, live cutover, Public Frontend, main, Production, or HOOOO change was performed.

CURRENT_WORK: CODE1 STAGING schema/security/runtime adapters, source normalization, private source snapshot, fail-closed import preflight, exact-snapshot verifier, retry-safety gate, and Windows operator import path are prepared. Real source-data import now waits only for the operator to enter the CODE1 STAGING service-role key at the hidden local prompt. Current live Internal Workspace remains Apps Script/Sheet/Drive; no dual-write exists.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main remains: `a71a71eae73706862308e194110f4fcc2d25db01`
- latest verified implementation/documentation HEAD before final handoff-doc commits: `2b631deb54fe0fc16e8eb960c6ce93e7beeca7ea`
- retry identity fix commit: `2fa67873bc16c573cb48c4bb674f2fb5f63ad698`
- idempotency test commit: `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71`
- Windows secure wrapper commit: `fe0ee097acee365cea33ba5db2cb91869a79c1c9`
- PowerShell CI gate commit: `4660be991162fb6c612f8d5d732f3da1c3a81b8b`
- secure operator runbook commit: `2b631deb54fe0fc16e8eb960c6ce93e7beeca7ea`
- GitHub Actions run: `34498679315` / SUCCESS
- Windows PowerShell parser gate: PASS
- staging unit+contract tests: 41/41 PASS
- append-only retry regression: PASS
- root regression suite: 35 PASS / 5 known pre-existing FAIL only
- root baseline comparison gate: PASS / zero new failures
- build: PASS
- later handoff documentation commits advance branch HEAD; always re-read branch HEAD before the next code write.
- `public/*` UI and legacy media/deck sources were not changed to make this backend gate pass.

CROSS_TRACK_SYNC:
- Message Bus `MSG-20260910-0004` (PLANNING -> CODING / BUS_PROTOCOL_ACTIVATION) was actually read and ACKED earlier; final Bus sync must mark it APPLIED after this handoff is written.
- Planning Delta CURRENT was actually re-read at `LATEST_DELTA_SEQ = 20260910-002`.
- CODING -> PLANNING implementation evidence `MSG-20260911-0001` was already published for source snapshot/retry-safety work and remains subject to Planning review.
- Delta 002 states current coding priority is unchanged and only requires future schema/API awareness for guest order identity, multi-entity Save, review `DELIVERED + 7d`, and authoritative availability/price/shipping revalidation.
- No Public Frontend, consumer UI, main/live, Production, or Premium Membership implementation is authorized by this delta and none was started in this track.

SUPABASE_STAGING:
- project ref: `bsintmkyhptizrjoizfb`
- region: Seoul (`ap-northeast-2`)
- logical environment: CODE1 STAGING only
- Production: NOT CREATED/NOT CONNECTED by this workstream
- HOOOO refs/projects: excluded and untouched
- connected SQL identity re-verified as `supabase_read_only_user`
- `transaction_read_only=on`; `default_transaction_read_only=on`

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
- account mutation happens transactionally inside `code1_save_account` / `code1_change_password`.
- Security Advisor after `0009`: WARN 0; only intentional `rls_enabled_no_policy` INFO remains.
- Performance Advisor after `0009`: INFO only (`unindexed_foreign_keys` 23, `unused_index` 11). Do not change indexes solely to silence INFO before imported workload measurement.

CURRENT_STAGING_DATA:
- durable source-import targets remain all zero after `0009`.
- no source import was partially written by the rejected connector DML attempt.
- this handoff added no Supabase DML/DDL.

PRIVATE_SOURCE_SNAPSHOT:
- safe manifest: `docs/coding/SOURCE_SNAPSHOT_MANIFEST_20260910.md`
- actual source JSON is private and must not be committed or copied into browser code/docs/chat-visible config.
- SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- size: 200458 bytes
- Drive private folder: `[PRIVATE] CODE1 STAGING MIGRATION`
- folder ID: `1YMiqei4FbYe01V8RdN6x93Vjse4KPftw`
- source file: `CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json`
- file ID: `16iBk4-qDfIG1HlLlAzUsaUtOW4DQWJVm`
- farms 12
- accounts 2
- questions 231
- source submission rows 8 = answer revisions 5 + commit sentinels 3
- normalized submissions 2
- farm media 4, all current status DELETED
- DECK media excluded 2
- media events 5
- access logs 29
- login guard 3
- question policies/history 0/0
- housing-environment records 12, migration state UNCONFIRMED
- planning capabilities/brief versions/planning artifacts 0/0/0

SOURCE_ANOMALY:
- live `01_농가_Master` contains stale sparse duplicate `GF-ORIGIN-01..12` rows at 501–512.
- canonical migration snapshot uses rows 2–13 only.
- including the stale block causes duplicate `farm_id` and source normalization fails closed.
- source Sheet was not changed. Cleanup requires a separate source-data decision; migration code does not silently delete it.

MIGRATION_SEMANTICS:
- preserve explicit blank answer revision `C-02 / revision 2`;
- convert `__COMMIT__` rows to submission current-revision state, never answers;
- preserve both ORGANIZED and later TRASHED events for the same legacy media;
- exclude DECK media from farm runtime media;
- legacy media stay `GOOGLE_DRIVE_LEGACY` with no R2 object key until the R2 phase;
- housing code 1 is only an explicit source value, never a default; `미확인`/blank become NULL and imported records stay UNCONFIRMED;
- do not auto-grant Planning Delta capabilities.

IMPORT_TOOLING:
- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/src/import-preflight.mjs`
- `backend/staging/scripts/preflight-import-to-staging.mjs`
- `backend/staging/scripts/run-verified-private-import.mjs`
- `backend/staging/scripts/run-private-import.ps1`
- `backend/staging/test/import-idempotency.test.mjs`
- `docs/coding/PRIVATE_STAGING_IMPORT_RUNBOOK_20260911.md`
- verified runner pins the exact CODE1 STAGING ref, source SHA-256/byte size and normalized shape before write.
- Windows wrapper requires exact isolated branch, prompts service-role as hidden `SecureString`, runs preflight before apply, requires exact project-ref confirmation, then clears the process environment and zeroes the BSTR.
- preflight requires `FIRST_IMPORT` on an all-zero target; non-empty target requires explicit controlled `IDEMPOTENT_RETRY`.
- legacy `media_events` and `audit_log` preserve `metadata.source_row`, so controlled retry can deduplicate append-only source rows.

KNOWN_ROOT_BASELINE_FAILURES — DO NOT FIX FROM CODING/BACKEND TRACK BY EDITING UI:
1. deck-edit fixture
2. media-organizer filename assertion
3. media upload UX grouped-card assertion
4. media shot-search assertion
5. `test/migration.test.mjs`

CI treats those five as known baseline and fails on any additional root regression. This is not a claim that the whole root suite is green.

INFRA_CHANGES_THIS_HANDOFF:
- Google Drive: created `[PRIVATE] CODE1 STAGING MIGRATION` in My Drive root and moved the verified private snapshot there.
- GitHub isolated branch: added secure Windows import wrapper, runbook, and PowerShell parser CI gate.
- Supabase: no new DDL/DML; source-import tables remain empty.
- Cloudflare/live Apps Script: unchanged.
- HOOOO/Production/main/Public Frontend: unchanged.

PLANNING_IMPACTING_TECHNICAL_CONSTRAINTS:
- code-derived values are not Planning policy.
- stale duplicate farm rows are a source-data hygiene issue requiring a separate explicit cleanup decision.
- actual STAGING import requires one operator-provided `service_role` credential because connected SQL is read-only.
- Planning capabilities remain 0 by contract; existing admin roles are not silently granted them.
- index/performance changes wait for imported workload measurement.

OPEN_WAITING:
- actual STAGING source import: WAITING_OPERATOR_SERVICE_ROLE_INPUT
- post-import exact count/security/performance checks: WAITING_IMPORT
- R2/private-media migration: WAITING_DB_DATA_GATE
- stale source duplicate cleanup: OPEN_SEPARATE_DECISION
- dependency vulnerabilities 3 high + 1 critical: OPEN_SEPARATE_HARDENING

NEXT_ATOMIC_ACTION:
1. On the operator Windows machine, update/check out `coding/runtime-backend-staging`.
2. Download the private source file from `[PRIVATE] CODE1 STAGING MIGRATION` to a local non-repository path.
3. Run `backend/staging/scripts/run-private-import.ps1 -PreflightOnly` and enter the CODE1 STAGING service-role key only at the hidden prompt.
4. Require `ok: true`, exact ref `bsintmkyhptizrjoizfb`, all-zero target, and `FIRST_IMPORT`.
5. Run the same wrapper without `-PreflightOnly`, type the exact project ref when prompted, and let the runner perform import plus post-write count verification.
6. Return only sanitized output; never return the service-role key.
7. Re-run exact count/security/performance checks and only after DB data gate PASS proceed to R2/private-media migration.
8. Do not change live/Public Frontend/Production before separately approved cutover.

ROLLBACK: live remains unchanged. Until an approved cutover, rollback remains “do nothing.” Existing Apps Script/Sheet/Drive stays the migration source and rollback evidence; long-term dual-write remains prohibited.
