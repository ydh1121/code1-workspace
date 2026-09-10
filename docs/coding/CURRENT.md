# CODE1 CODING CURRENT

Updated: 2026-09-10
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT DRAFTED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE / PRE-APPLY STATIC GATE PASS
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-001

## Verified authority

The coding track consumed `10_CODE1 Coding Handoff — Planning Delta 20260910-001 v0.1` and verified its referenced `02_CODE1 CROSS-TRACK PLANNING DELTA — CURRENT v1.0` sequence before continuing the existing isolated branch. Planning and UI/UX canonical documents were not edited.

The existing `coding/runtime-backend-staging` work was not discarded or restarted. Runtime migration work continued from the existing branch state.

## Verified runtime and migration facts

- Canonical temporary Sheet has 25 tabs (00–24) and retains `STAGING_ONLY`, `REVIEW_REQUIRED`, and `PRIVATE_DRIVE` settings.
- Two active workspace accounts exist: OWNER/SUPER_ADMIN and one ADMIN. Credential material exists in the source Sheet but must never be copied into docs/logs.
- Current frontend calls `/api/rpc`; Cloudflare server then calls the signed Apps Script bridge. The Apps Script/Sheet/Drive hot path remains the structural latency source.
- Git main remains the verified base SHA above for this isolated workstream; main/live/Public Frontend were not modified by the Planning Delta work.
- Current live Cloudflare deployment revision remains `LIVE_DEPLOYMENT_UNVERIFIED` from this execution environment.
- No CODE1 Supabase project has been created or connected by this workstream. Existing non-CODE1 projects are excluded and untouched.
- Existing R2 bucket identity/binding remains outside the verified/approved boundary.
- Native Google Sheets API dry-run normalization preserves stable IDs, explicit blank answer revisions, append-only runtime histories, and excludes DECK media from farm runtime cutover.

## Planning Delta implementation now present in the isolated branch

- Housing-environment data is modeled separately and accepts nullable codes `1..4`; category 1 is not hard-coded as the permanent schema.
- Imported housing-environment source values remain `UNCONFIRMED` until evidence-backed verification.
- Fact Inbox has an internal data contract, ordered verification state machine, evidence gate, append-only events, and no staging path for external disclosure.
- Executive Brief has a read-only `PUBLISHED` snapshot model/API; runtime reads do not expose source Drive document IDs.
- Planning capabilities are separated from legacy role names. Existing SUPER_ADMIN/ADMIN roles receive no new planning capability implicitly.
- Planning source artifacts, including any future GreatFarm PDF registration, are restricted to private planning object keys and cannot be marked for public delivery.

## Pre-apply schema hardening

Migration order is now:

1. `0001_runtime.sql`
2. `0002_mutations.sql`
3. `0003_planning_delta_20260910.sql`
4. `0004_preapply_security_hardening.sql`

`0004` closes pre-apply findings for immutable submission-to-farm identity, evidence-required planning verification, Fact Inbox staging non-disclosure, FARM housing-environment identity consistency, and direct browser-role EXECUTE access to service-boundary mutation RPCs.

See `docs/coding/SCHEMA_PRE_APPLY_AUDIT_20260910.md`.

## Automated verification

GitHub Actions run `34456909154` on code-bearing HEAD `f0505d24ea4eef9aa1823d3cc89adc40819b7f7b` completed successfully.

- `.mjs` syntax checks: PASS
- staging unit/contract tests: 27 PASS / 0 FAIL / 0 SKIP / 0 CANCEL
- schema pre-apply contract checks: included in the 27 PASS

This is not a PostgreSQL/Supabase migration PASS and not a live integration or performance PASS.

## Performance gate

No latency multiplier claim is accepted. Authenticated baseline/cutover p50/p95 is still pending and must be measured on equivalent actions before any live switch.

## Current boundary and next action

Do not create or connect Production. Do not modify current Public Frontend. Do not implement consumer UI for housing-environment categories 2–4. Do not implement Premium Membership.

The next external-resource action is a dedicated CODE1 Supabase STAGING project selection/creation followed by verified application of migrations `0001`–`0004`. That external action remains approval-gated. Until approval, only isolated code/schema/document verification may continue.
