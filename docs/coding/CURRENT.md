# CODE1 CODING CURRENT

Updated: 2026-09-10
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT FIXED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE / SUPABASE STAGING SCHEMA+SECURITY+CI+SOURCE GATE PASS / DATA IMPORT BLOCKED BY SERVICE-ROLE EXECUTION CONTEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260910-0004

## Verified authority and cross-track sync

The coding track consumed `10_CODE1 Coding Handoff — Planning Delta 20260910-001 v0.1`, then re-read `02_CODE1 CROSS-TRACK PLANNING DELTA — CURRENT v1.0` after it advanced to `LATEST_DELTA_SEQ = 20260910-002` and performed the required SESSION CHECK against `02_CODE1 CROSS-TRACK MESSAGE BUS — CURRENT v1.0`.

`MSG-20260910-0004` (BUS_PROTOCOL_ACTIVATION, PLANNING -> CODING) was actually read and ACKED. Delta 002 explicitly says current coding-task priority is unchanged. Its coding impact is future Public commerce schema/API awareness only (guest order identity, multi-entity Save, delivered-window reviews, availability revalidation). It does not authorize Public Frontend implementation, main/live changes, Production changes, consumer UI, or Premium Membership implementation. No such work was started here.

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

Native Google Sheet/API source remains canonical. A private source snapshot was regenerated from the current canonical Sheet and retained outside Git because it contains credential-derived account fields and operational access-log data.

Safe integrity record: `docs/coding/SOURCE_SNAPSHOT_MANIFEST_20260910.md`.

- SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- byte size: `200458`
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

Explicit blank answer revisions are preserved. `M_4934...` has both ORGANIZED and later TRASHED source history and both events must remain. Housing-environment category 1 is never defaulted; `미확인`/blank remain NULL code.

### Source anomaly retained but excluded

Direct live-Sheet read confirmed `01_농가_Master` contains stale sparse duplicates of `GF-ORIGIN-01` through `GF-ORIGIN-12` at rows 501–512. The canonical migration snapshot uses rows 2–13 only. Including the stale block creates duplicate `farm_id` identities and normalization fails closed. The source Sheet was not changed; cleanup is a separate decision.

## Import implementation and preflight

The isolated branch includes:

- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/src/import-preflight.mjs`
- `backend/staging/scripts/preflight-import-to-staging.mjs`
- `backend/staging/test/import-runner.test.mjs`
- `backend/staging/test/import-preflight.test.mjs`
- `backend/staging/test/import-idempotency.test.mjs`

The runner maps legacy actors to stable account IDs, preserves explicit blank answers, reconstructs deleted-media timestamps from append-only history, uses idempotent upserts, updates the migration registry, and verifies final counts.

The preflight is fail-closed before any write:

- `CODE1_IMPORT_TARGET` must equal `STAGING`.
- `CODE1_IMPORT_CONFIRM_REF` must exactly equal `CODE1_STAGING_PROJECT_REF`.
- Supabase URL hostname must exactly match that ref.
- all durable import surfaces are read before write; first import requires an all-zero target.
- non-empty retry requires explicit `CODE1_IMPORT_ALLOW_NONEMPTY=IDEMPOTENT_RETRY`.
- output does not include the service-role secret.

### Append-only retry correction

Pre-import audit found a real retry-safety defect: `appendHistoryRows()` deduplicated `media_events` and `audit_log` using `metadata.source_row`, but the source normalizer did not populate that field. An explicitly allowed `IDEMPOTENT_RETRY` could therefore duplicate append-only legacy rows.

Fixed before any import:

- `backend/staging/src/source-normalizer.mjs` now records original source-row identity for access logs and media history.
- code fix commit: `2fa67873bc16c573cb48c4bb674f2fb5f63ad698`
- dedicated second-apply test: `backend/staging/test/import-idempotency.test.mjs`
- test commit: `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71`

## Automated verification

GitHub Actions run `34494835092` on code-bearing HEAD `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71` completed SUCCESS:

- syntax check: PASS
- staging unit/contract tests: 41/41 PASS
- append-only idempotent retry regression: PASS
- root regression baseline gate: PASS; no additional root failure beyond the five known pre-existing baseline failures
- build: PASS

The five known root baseline failures remain the deck-edit fixture, media-organizer filename assertion, two media-upload UX fixture assertions, and `test/migration.test.mjs`. The coding/backend track did not edit `public/*` or legacy UI/media source merely to force those unrelated baseline tests green.

`npm ci` previously reported 4 dependency vulnerabilities (3 high, 1 critical). They remain a separate dependency-hardening item; no forced breaking upgrade is performed inside this runtime migration step.

The complete apply-gate record is `docs/coding/SUPABASE_STAGING_APPLY_GATE_20260910.md`.

## Current data-import blocker

The remaining blocker is execution context only:

- connected Supabase SQL is read-only;
- no connected tool exposes the CODE1 service-role/secret key or a writable Cloudflare secret context;
- GitHub connector cannot administer repository secrets;
- the private source snapshot must not be committed to Git or browser code.

Do not work around this by committing service-role secrets, account credential hashes, private source data, or writable import credentials into Git/migrations/browser code/logs/chat.

## Planning Delta contracts retained

- Delta 001: housing-environment code accepts nullable 1..4; migration never auto-verifies source values.
- Delta 001: Fact Inbox requires ordered verification/evidence before VERIFIED/APPROVED_CURRENT and cannot disclose externally in staging.
- Delta 001: Executive Brief reads only a PUBLISHED snapshot.
- Delta 001: Planning capabilities remain separate and are not auto-granted to SUPER_ADMIN/ADMIN.
- Delta 001: confidential planning source artifacts remain private-only and have no public-delivery path.
- Delta 002: future Public commerce schema/API must remain extensible for guest order identity, Save across product/farm/story, reviews tied to DELIVERED+7d, and server-authoritative availability/price/shipping revalidation. Awareness only in this workstream; no Public commerce implementation now.

## Performance gate

No speed multiplier or latency target is accepted as PASS without measured equivalent actions. Authenticated old/new p50/p95 remains pending until imported staging runtime can actually be exercised.

## Next atomic action

1. Establish a writable CODE1 STAGING service-role execution context without exposing the secret in Git/browser/docs/chat output.
2. Use the verified private snapshot matching `SOURCE_SNAPSHOT_MANIFEST_20260910.md`.
3. Run `backend/staging/scripts/preflight-import-to-staging.mjs` and require `FIRST_IMPORT` with an all-zero target.
4. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
5. Verify exact counts, stable IDs, revisions, deletion/event history, append-only retry identity, permissions, actor mapping, and planning capability count 0.
6. Re-run Security/Performance Advisor and measured imported-data query checks.
7. After DB data gate PASS, verify the exact existing CODE1 R2 bucket/binding and proceed with isolated private-media migration/integration tests.
8. Keep live/Public Frontend/Production untouched until separate cutover approval.
