# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: OPS RETENTION/CAPACITY TECHNICAL PASS / PLANNING REVIEW PENDING
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0063
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0063
LAST_CODING_OUTBOUND = MSG-20260912-0061

## Current work order

`WO-20260912-CODING-OPS-RETENTION-001` was dispatched by Planning `MSG-20260912-0063` as a STAGING-only, non-destructive retention/capacity hardening task after the parent OPS Relay closure.

CODING technical implementation and verification are complete. Final cross-track implementation evidence still needs to be published and accepted by Planning.

## Durable implementation refs

- starting branch checkpoint: `9a36b7074bc56833aae730ad6ac313a6c1408d04`
- retention migration source: `backend/staging/schema/0020_ops_retention_capacity_guard.sql`
- server report actions: `admin.ops.capacity.report`, `admin.ops.retention.dryRun`
- implementation/test head: `3993d50be6d388ddd5391e4035aab4d9d781a000`
- Preview deployment marker: `5cc9d7b467b5ec0f974e35a513f2e605fb4d7500`
- final live smoke/test head: `bfae31df267943d86dd3d02f170f048b6112dd43`
- evidence: `docs/coding/OPS_RETENTION_CAPACITY_EVIDENCE_20260912.md`
- STAGING migration: `ops_retention_capacity_guard_0020`

## Measured baseline / capacity model

Pre-change STAGING readback:

- `ops_change_events`: rows 0 / total 147,456 bytes
- `ops_outbox`: rows 0 / total 98,304 bytes
- combined empty relation footprint: 245,760 bytes
- database bytes before 0020: 13,569,171
- OWNER QA residue: 0
- eleven OPS indexes present
- measured average retained row unavailable because both tables were empty

SELECT-only representative datum sizing, without insert:

- event row: 808 bytes
- outbox row: 224 bytes
- combined heap datum: 1,032 bytes

Conservative planning model uses 4 KiB per logical event+outbox pair. From the measured fixed baseline:

- 1k events ~4.14 MiB
- 10k ~39.30 MiB
- 100k ~390.86 MiB
- 1M ~3.815 GiB

Actual growth-rate calculation remains unavailable until multiple time-separated samples exist.

## Report-only retention contract

Migration 0020 adds only:

- `code1_ops_retention_policy_proposal()`
- `code1_ops_capacity_report(...)`
- `code1_ops_retention_dry_run(...)`

All are service-role-only and OWNER-authorized. anon/authenticated EXECUTE=false; service_role=true. RLS remains enabled on both OPS tables.

The application actions are STAGING-only, fixed-empty-payload, server-side actions. No arbitrary SQL/debug payload is accepted. If no configured database limit is supplied, the capacity state is intentionally `WATCH / CONFIGURED_LIMIT_UNKNOWN`; no Supabase quota or paid plan is invented.

No purge executor, DELETE/TRUNCATE/DROP path, trigger, pg_cron scheduler, automatic upgrade, archive destination or Production resource operation was created.

## Retention proposal — NOT FROZEN

- QA/test fixture: immediate cleanup; 1-day fallback alert
- delivered / NO_ACTION outbox: 14-day terminal candidate
- FAILED_RETRYABLE outbox: 30-day REVIEW_ONLY, not deletion-eligible
- OPS_DATA_ONLY: 90-day terminal candidate only after `NO_PLANNING_ACTION + NO_ACTION`
- PLANNING/UIUX/CODING impact: 180-day candidate only after `DONE + DELIVERED`
- POLICY_APPROVAL_REQUIRED / INCIDENT: 365-day `ARCHIVE_REVIEW_ONLY`, not deletion-eligible

This is `PROPOSAL_NOT_FROZEN`. Planning/user approval is required before policy freeze or any purge/archive activation.

## Acceptance evidence

Preview deployment `5cc9d7b...` = SUCCESS.

Stable Preview read-only smoke at `bfae31d...`:

- run `34677990898`, job `103511206750` = SUCCESS
- page/assets 200
- session configured=true/authenticated=false
- `admin.ops.capacity.report` unauthenticated = 401
- `admin.ops.retention.dryRun` unauthenticated = 401
- remote mutation NONE

CI on `bfae31d...`:

- STAGING tests 162/162 PASS
- npm audit 0
- build PASS
- root baseline: exactly five accepted pre-existing failures, no new failure

Final STAGING readback:

- events=0
- outbox=0
- OWNER_QA residue=0
- relation sizes unchanged
- database bytes=13,585,555, increase attributable to function/catalog metadata

## Hard boundaries preserved

- `AUTO_PURGE=FALSE`
- `PAID_UPGRADE=FALSE`
- `PRODUCTIONIZATION=NOT_DISPATCHED`
- Production/main/Production Supabase/R2/live legacy Google mutation=0
- credential read/reset/synthesis/provisioning=0
- browser service-role exposure=0
- retained non-synthetic deletion=0
- scheduler activation=0

## Reserved work — NOT DISPATCHED

- `WO-20260912-CODING-PRODUCTIONIZATION-001` remains `RESERVED / NOT_DISPATCHED`.
- `WO-20260912-PLATFORM-REUSE-001` remains `RESERVED / DEFERRED / NOT_DISPATCHED`.

Do not start either from the reserved Ledger entry.

## NEXT_ATOMIC_ACTION

1. Publish one consolidated `CODING -> PLANNING / IMPLEMENTATION_EVIDENCE` for `WO-20260912-CODING-OPS-RETENTION-001` after a fresh Bus-tail reconciliation.
2. Update CODING TRACK_STATE from the live Bus state.
3. Await Planning technical acceptance and separate retention-policy decision.
4. Do not freeze TTLs, activate purge/archive, buy resources, or start Productionization without explicit Planning/user authority.
