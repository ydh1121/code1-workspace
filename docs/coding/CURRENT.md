# CODE1 CODING CURRENT

Updated: 2026-09-11
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT FIXED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE / SUPABASE STAGING SCHEMA+SECURITY+CI+SOURCE GATE PASS / SECURE OPERATOR IMPORT PATH READY / DATA IMPORT WAITING OPERATOR SERVICE-ROLE INPUT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0001

## Verified authority and cross-track sync

The coding track consumed `10_CODE1 Coding Handoff — Planning Delta 20260910-001 v0.1`, re-read `02_CODE1 CROSS-TRACK PLANNING DELTA — CURRENT v1.0` through `LATEST_DELTA_SEQ = 20260910-002`, and applied the Message Bus protocol from `02_CODE1 CROSS-TRACK MESSAGE BUS — CURRENT v1.0`.

`MSG-20260910-0004` (BUS_PROTOCOL_ACTIVATION, PLANNING -> CODING) was actually read and ACKED. It will be marked APPLIED only after this handoff is written and final Bus sync is completed. Delta 002 explicitly says current coding-task priority is unchanged. Its coding impact is future Public commerce schema/API awareness only; no Public Frontend, main/live, Production, consumer UI, or Premium Membership implementation was started here.

Planning and UI/UX canonical documents were not edited.

## Current runtime boundary

- Current live Internal Workspace remains Cloudflare -> signed Apps Script bridge -> Google Sheet/Drive.
- Main/live/Public Frontend/formal Admin remain unchanged by this isolated backend workstream.
- No dual-write is enabled.
- Existing Apps Script/Sheet/Drive remains the migration source and rollback evidence.
- Current live Cloudflare deployment revision is not asserted from this execution environment.

## Dedicated CODE1 Supabase STAGING

Verified project:

- project ref: `bsintmkyhptizrjoizfb`
- region: Seoul / `ap-northeast-2`
- logical role: CODE1 STAGING only
- HOOOO refs/projects were not reused or modified.

Applied migrations:

1. `code1_0001_runtime` / `20260910101211`
2. `code1_0002_mutations` / `20260910101239`
3. `code1_0003_planning_delta_20260910` / `20260910101312`
4. `code1_0004_preapply_security_hardening` / `20260910101342`
5. `code1_0005_service_role_grants` / `20260910112427`
6. `code1_0006_postapply_security_hardening` / `20260910112904`
7. `code1_0007_auth_throttle` / `20260910123656`
8. `code1_0008_auth_throttle_sha256_compat` / `20260910125021`
9. `code1_0009_account_mutations` / `20260910133932`

## Security and mutation gate

Verified after `0009`:

- 20 runtime/planning tables have RLS enabled.
- anon/authenticated have no direct table SELECT path.
- service_role retains the required server-side access.
- `submission_answers_current` remains server-side readable and browser-role unreadable.
- `code1_auth_throttle`, `code1_save_account`, and `code1_change_password` are SECURITY DEFINER functions with fixed search paths; browser-role EXECUTE is denied and service_role EXECUTE is allowed.
- account save/password operations use single PostgreSQL transaction RPCs instead of several REST mutations that could leave partial account/farm-access/audit state.
- Security Advisor after `0009`: WARN 0. The remaining `rls_enabled_no_policy` notices are intentional INFO for the server-only authorization boundary.
- Performance Advisor after `0009`: INFO only — 23 unindexed foreign-key notices and 11 unused-index notices. Index changes remain deferred until imported-data query measurement.

## Current STAGING data state

The Supabase SQL execution context was re-verified as `supabase_read_only_user` with `transaction_read_only=on` and `default_transaction_read_only=on`.

The rejected connector DML attempt wrote zero rows. All checked durable import targets remain zero after `0009`; there is no partial source import.

## Authoritative private migration snapshot

Native Google Sheet/API source remains canonical. A private source snapshot was regenerated from the current canonical Sheet and retained outside Git because it contains password-hash fields and operational access-log data.

Safe integrity record: `docs/coding/SOURCE_SNAPSHOT_MANIFEST_20260910.md`.

- SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- byte size: `200458`
- private Drive folder: `[PRIVATE] CODE1 STAGING MIGRATION`
- folder ID: `1YMiqei4FbYe01V8RdN6x93Vjse4KPftw`
- source file: `CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json`
- file ID: `16iBk4-qDfIG1HlLlAzUsaUtOW4DQWJVm`
- farms: 12
- workspace accounts: 2
- active questions: 231
- source submission rows: 8 = 5 answer revisions + 3 commit sentinels
- normalized submissions: 2
- farm runtime media: 4, all currently `DELETED`
- DECK media excluded: 2
- media history events: 5
- access logs: 29
- login guard rows: 3
- question policies/history: 0 / 0
- housing-environment records: 12, all migration state `UNCONFIRMED`
- planning capabilities/brief versions/planning artifacts: 0 / 0 / 0

The snapshot was moved out of the normal CODE1 coding folder into a newly created My Drive root private migration folder so it is not casually inherited into a future shared coding folder. Do not re-share or copy the private source into Git, browser code, docs, tickets, logs, or chat-visible configuration.

Explicit blank answer revisions are preserved. `M_4934...` has both ORGANIZED and later TRASHED source history and both events must remain. Housing-environment category 1 is never defaulted; `미확인`/blank remain NULL code.

### Source anomaly retained but excluded

Direct live-Sheet read confirmed `01_농가_Master` contains stale sparse duplicates of `GF-ORIGIN-01` through `GF-ORIGIN-12` at rows 501–512. The canonical migration snapshot uses rows 2–13 only. Including the stale block creates duplicate `farm_id` identities and normalization fails closed. The source Sheet was not changed; cleanup is a separate decision.

## Import implementation and preflight

The isolated branch includes:

- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/src/import-preflight.mjs`
- `backend/staging/scripts/preflight-import-to-staging.mjs`
- `backend/staging/scripts/run-verified-private-import.mjs`
- `backend/staging/scripts/run-private-import.ps1`
- `backend/staging/test/import-runner.test.mjs`
- `backend/staging/test/import-preflight.test.mjs`
- `backend/staging/test/import-idempotency.test.mjs`
- `docs/coding/PRIVATE_STAGING_IMPORT_RUNBOOK_20260911.md`

The runner maps legacy actors to stable account IDs, preserves explicit blank answers, reconstructs deleted-media timestamps from append-only history, uses idempotent upserts, updates the migration registry, and verifies final counts.

The preflight is fail-closed before any write:

- `CODE1_IMPORT_TARGET` must equal `STAGING`.
- `CODE1_IMPORT_CONFIRM_REF` must exactly equal `CODE1_STAGING_PROJECT_REF`.
- Supabase URL hostname must exactly match that ref.
- all durable import surfaces are read before write; first import requires an all-zero target.
- non-empty retry requires explicit `CODE1_IMPORT_ALLOW_NONEMPTY=IDEMPOTENT_RETRY`.
- output does not include the service-role secret.

### Verified private import runner

`run-verified-private-import.mjs` pins the exact CODE1 STAGING ref plus the private snapshot SHA-256, byte size and normalized source shape before any write. It rejects unknown flags and post-write count mismatches.

`run-private-import.ps1` is the Windows operator entrypoint. It requires the exact isolated branch, prompts for `service_role` as hidden `SecureString`, sets the process environment only for the Node call, re-runs preflight immediately before apply, requires the exact project ref to be typed before the write, and removes the environment variable/zeroes the BSTR in `finally`.

The GitHub Actions workflow now parses this PowerShell wrapper with PowerShell's language parser, so syntax errors fail the same isolated branch CI.

### Append-only retry correction

Pre-import audit found a retry-safety defect: `appendHistoryRows()` deduplicated `media_events` and `audit_log` using `metadata.source_row`, but the source normalizer did not populate that field. An explicitly allowed `IDEMPOTENT_RETRY` could therefore duplicate append-only legacy rows.

Fixed before any import:

- `backend/staging/src/source-normalizer.mjs` now records original source-row identity for access logs and media history.
- code fix commit: `2fa67873bc16c573cb48c4bb674f2fb5f63ad698`
- dedicated second-apply test: `backend/staging/test/import-idempotency.test.mjs`
- test commit: `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71`

## Automated verification

Latest verified implementation/documentation HEAD before this handoff refresh: `2b631deb54fe0fc16e8eb960c6ce93e7beeca7ea`.

GitHub Actions run `34498679315` completed SUCCESS:

- Node/JavaScript syntax check: PASS
- Windows PowerShell private-import wrapper parser gate: PASS
- staging unit/contract tests: 41/41 PASS
- append-only idempotent retry regression: PASS
- root regression suite: 35 PASS / 5 FAIL, all five exactly matching the known pre-existing baseline
- zero additional root failures
- root baseline comparison gate: PASS
- build: PASS

The five known root baseline failures remain the deck-edit fixture, media-organizer filename assertion, two media-upload UX fixture assertions, and `test/migration.test.mjs`. The coding/backend track did not edit `public/*` or legacy UI/media source merely to force those unrelated baseline tests green.

`npm ci` reports 4 dependency vulnerabilities (3 high, 1 critical). They remain a separate dependency-hardening item; no forced breaking upgrade is performed inside this runtime migration step.

The complete apply-gate record is `docs/coding/SUPABASE_STAGING_APPLY_GATE_20260910.md`; secure operator execution procedure is `docs/coding/PRIVATE_STAGING_IMPORT_RUNBOOK_20260911.md`.

## Infra changes in this handoff

- Supabase: no new DDL/DML in this handoff; target remains zero imported rows.
- GitHub isolated branch: added secure Windows import wrapper, private import runbook, and PowerShell parser CI gate.
- Google Drive: created My Drive root folder `[PRIVATE] CODE1 STAGING MIGRATION` and moved the verified private source JSON there.
- Cloudflare/live Apps Script: unchanged.
- HOOOO/Production/main/Public Frontend: unchanged.

## Planning-impacting technical constraints

- No code-derived value is promoted to business policy.
- The stale lower `01_농가_Master` duplicate block is a source-data hygiene issue only; its cleanup requires an explicit source decision and is not silently performed by migration code.
- Actual STAGING import requires one operator-provided CODE1 `service_role` credential because the connected Supabase SQL session is read-only.
- Planning capabilities remain 0 by migration contract; existing SUPER_ADMIN/ADMIN roles do not gain Delta planning capabilities implicitly.
- Performance/index decisions remain evidence-driven after imported workload measurement; INFO notices are not treated as policy or a reason to preemptively alter schema.

## OPEN / WAITING

- actual STAGING source import: WAITING on operator service-role input;
- post-import exact count/security/performance verification: WAITING on import;
- R2/private-media migration: WAITING on DB data gate PASS;
- source Sheet stale duplicate cleanup: OPEN, separate decision;
- dependency vulnerabilities: OPEN, separate hardening workstream.

## Next atomic action

1. On the operator Windows machine, update/check out `coding/runtime-backend-staging`.
2. Download `CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json` from the private Drive migration folder to a local non-repository path.
3. Run `backend/staging/scripts/run-private-import.ps1 -PreflightOnly`; enter the CODE1 STAGING service-role key only at the hidden prompt.
4. Require `ok: true`, exact ref `bsintmkyhptizrjoizfb`, all-zero destination and preflight mode `FIRST_IMPORT`.
5. Run the same wrapper without `-PreflightOnly`, type the exact project ref when prompted, and allow import plus post-write count verification.
6. Return only sanitized output; never return the secret.
7. Re-run exact DB count/security/performance checks; only after DB data gate PASS proceed to R2/private-media migration.
8. Keep live/Public Frontend/Production untouched until separate cutover approval.
