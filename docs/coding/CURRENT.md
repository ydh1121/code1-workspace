# CODE1 CODING CURRENT

Updated: 2026-09-10
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT FIXED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE / SUPABASE STAGING SCHEMA+SECURITY GATE PASS / DATA IMPORT BLOCKED BY CONNECTOR WRITE CONTEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-001

## Verified authority

The coding track consumed `10_CODE1 Coding Handoff — Planning Delta 20260910-001 v0.1` and verified `02_CODE1 CROSS-TRACK PLANNING DELTA — CURRENT v1.0` before continuing this existing branch. Planning and UI/UX canonical documents were not edited.

## Current runtime boundary

- Current live Internal Workspace still runs through Cloudflare -> signed Apps Script bridge -> Google Sheet/Drive.
- Main/live/Public Frontend/formal Admin are unchanged by this workstream.
- Current live Cloudflare deployment revision remains `LIVE_DEPLOYMENT_UNVERIFIED` from this execution environment.
- Existing Apps Script/Sheet/Drive runtime remains rollback evidence and is not deleted or dual-written.

## Dedicated CODE1 Supabase STAGING

Verified project:

- project ref: `bsintmkyhptizrjoizfb`
- region: Seoul / `ap-northeast-2`
- status at apply: `ACTIVE_HEALTHY`
- logical role: CODE1 STAGING only

Applied migrations:

1. `0001_runtime.sql` -> `code1_0001_runtime` / `20260910101211`
2. `0002_mutations.sql` -> `code1_0002_mutations` / `20260910101239`
3. `0003_planning_delta_20260910.sql` -> `code1_0003_planning_delta_20260910` / `20260910101312`
4. `0004_preapply_security_hardening.sql` -> `code1_0004_preapply_security_hardening` / `20260910101342`
5. `0005_service_role_grants.sql` -> `code1_0005_service_role_grants` / `20260910112427`
6. `0006_postapply_security_hardening.sql` -> `code1_0006_postapply_security_hardening` / `20260910112904`

No HOOOO project/ref was reused or modified.

## Post-apply security gate

Verified after `0006`:

- 20 runtime/planning tables have RLS enabled.
- anon/authenticated have no table SELECT access.
- service_role has the required table CRUD grants.
- `submission_answers_current` is service-role readable and browser-role unreadable.
- CODE1 mutation RPCs and helper are not executable by anon/authenticated; required service-role EXECUTE remains.
- Supabase-generated `public.rls_auto_enable()` event trigger remains available for automatic RLS behavior but direct API-role EXECUTE was revoked.
- CODE1 function search paths are fixed.
- Supabase Security Advisor has no remaining WARN finding from the CODE1 schema. Remaining `rls_enabled_no_policy` notices are intentional INFO under the server-only authorization boundary.

See `docs/coding/SUPABASE_STAGING_APPLY_GATE_20260910.md`.

## Authoritative migration source snapshot

Native Google Sheet/API source remains canonical for migration. Current normalized counts immediately before import:

- farms: 12
- workspace accounts: 2
- active questions: 231
- submissions: 2
- answer revisions: 5
- commit sentinels represented by submission revision state: 3
- farm runtime media: 4, all currently `DELETED`
- DECK media excluded: 2
- media history events: 5
- access logs: 29
- login guard rows: 3
- question policies/history: 0 / 0
- housing-environment records: 12, all migration state `UNCONFIRMED`
- planning capabilities/brief versions/planning artifacts: 0 / 0 / 0

Explicit blank answer revisions are preserved. `M_4934...` has both ORGANIZED and later TRASHED source history and both events must remain. Housing-environment category 1 is not hard-coded; `미확인`/blank remain NULL code.

## Isolated import implementation

The branch now includes:

- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- `backend/staging/test/import-runner.test.mjs`

The runner maps legacy actor email/username to stable account IDs, reconstructs deleted-media timestamps from append-only history, preserves explicit blank answers, uses idempotent upserts, deduplicates imported event/log rows by source row, updates migration registry, and verifies post-import counts.

Write execution requires both `CODE1_IMPORT_TARGET=STAGING` and exact `CODE1_IMPORT_CONFIRM_REF == CODE1_STAGING_PROJECT_REF`. Secrets and source credential material are never committed.

## Current data-import blocker

The GPT Supabase connection can directly inspect the CODE1 project and can apply managed schema migrations, but its general SQL session currently identifies as `supabase_read_only_user` under the invited Developer context.

The first DML import attempt failed with `cannot execute INSERT in a read-only transaction`. It wrote zero rows. A follow-up count verified the target runtime tables remain empty.

Do not bypass this by placing account credential hashes into schema migrations. A writable CODE1-owner/service-role import context is required for real source data transfer.

## Planning Delta contract retained

- Housing-environment code accepts nullable 1..4; migration does not auto-verify source values.
- Fact Inbox requires ordered verification/evidence before VERIFIED/APPROVED_CURRENT and cannot disclose externally in staging.
- Executive Brief runtime model reads only a PUBLISHED snapshot.
- Planning capabilities are separate and are not auto-granted to SUPER_ADMIN/ADMIN.
- GreatFarm/confidential planning source artifacts are private-only and cannot enter a public-delivery path.

## Automated verification

GitHub Actions run `34472709381` on branch HEAD `930257c19f9559bcc3d8bf057cdf092cabf06e97` completed successfully after the import-runner tests were added. This validates branch syntax/unit/contract logic only; it is not a data-import, R2, live-browser, or performance PASS.

## Performance gate

No speed multiplier or latency target is accepted as PASS without measured equivalent actions. Authenticated baseline/new p50/p95 remains pending until the new backend can be integrated in an isolated runtime.

## Next atomic action

1. Establish writable CODE1 STAGING import context without exposing service-role secrets in Git/browser/docs.
2. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
3. Verify counts/stable IDs/revisions/deletion history/permissions and zero implicit planning capabilities.
4. Re-run security/performance advisor and imported-data query checks.
5. Then verify the exact existing CODE1 R2 bucket/binding and perform private-media migration/integration tests in isolation.
6. Keep live/Public Frontend/Production untouched until separate cutover approval.
