# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: OPS RETENTION/CAPACITY TECHNICAL PASS / MSG-0064 PENDING PLANNING
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0064
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0063
LAST_CODING_OUTBOUND = MSG-20260912-0064

## Current work order

`WO-20260912-CODING-OPS-RETENTION-001` was dispatched by Planning `MSG-20260912-0063` as a STAGING-only, non-destructive retention/capacity hardening task after the parent OPS Relay closure.

CODING technical implementation and verification are complete. Consolidated evidence was published to Planning as `MSG-20260912-0064`; Planning acceptance and retention-policy decision are pending.

## Durable implementation refs

- starting branch checkpoint: `9a36b7074bc56833aae730ad6ac313a6c1408d04`
- implementation/test head: `3993d50be6d388ddd5391e4035aab4d9d781a000`
- Preview deployment marker: `5cc9d7b467b5ec0f974e35a513f2e605fb4d7500`
- final live smoke/test head: `bfae31df267943d86dd3d02f170f048b6112dd43`
- evidence: `docs/coding/OPS_RETENTION_CAPACITY_EVIDENCE_20260912.md`
- STAGING migration: `ops_retention_capacity_guard_0020`
- final Bus evidence: `MSG-20260912-0064`

## Measured baseline / capacity model

Pre-change STAGING readback:

- `ops_change_events`: rows 0 / total 147,456 bytes
- `ops_outbox`: rows 0 / total 98,304 bytes
- combined empty relation footprint: 245,760 bytes
- database bytes before 0020: 13,569,171
- OWNER QA residue: 0
- eleven OPS indexes present
- actual average retained row/growth rate unavailable because both tables were empty

SELECT-only representative datum sizing, without insert: event 808 bytes + outbox 224 bytes = 1,032 bytes.

Conservative planning model uses 4 KiB per logical event+outbox pair: 1k ~4.14 MiB; 10k ~39.30 MiB; 100k ~390.86 MiB; 1M ~3.815 GiB.

## Report-only retention contract

Migration 0020 adds only service-role/OWNER-authorized report functions and exposes two fixed-empty-payload STAGING server actions:

- `admin.ops.capacity.report`
- `admin.ops.retention.dryRun`

anon/authenticated EXECUTE=false; service_role=true. RLS remains enabled. Direct invocation from the read-only SQL connector was denied.

If configured DB limit is unknown, capacity reports `WATCH / CONFIGURED_LIMIT_UNKNOWN`; no quota or paid plan is invented.

No purge executor, DELETE/TRUNCATE/DROP path, trigger, pg_cron scheduler, automatic upgrade, archive destination, arbitrary SQL/debug path or Production resource operation exists.

## Retention proposal — PROPOSAL_NOT_FROZEN

- QA/test fixture: immediate cleanup; 1-day fallback alert
- delivered / NO_ACTION outbox: 14-day terminal candidate
- FAILED_RETRYABLE outbox: 30-day REVIEW_ONLY
- OPS_DATA_ONLY: 90-day terminal candidate after `NO_PLANNING_ACTION + NO_ACTION`
- PLANNING/UIUX/CODING impact: 180-day candidate after `DONE + DELIVERED`
- POLICY_APPROVAL_REQUIRED / INCIDENT: 365-day `ARCHIVE_REVIEW_ONLY`

Planning/user approval is required before policy freeze or purge/archive activation.

## Acceptance evidence

Preview deployment `5cc9d7b...` = SUCCESS.

Stable Preview smoke at `bfae31d...`, run `34677990898`, job `103511206750` = SUCCESS. Both new report actions fail closed unauthenticated with 401; remote mutation NONE.

CI on `bfae31d...`: STAGING tests 162/162 PASS; npm audit 0; build PASS; root baseline exactly five accepted pre-existing failures, no new failures.

Final STAGING readback: events=0, outbox=0, OWNER_QA residue=0, relation sizes unchanged, database bytes=13,585,555.

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

## NEXT_ATOMIC_ACTION

1. Fresh-read CURRENT and latest `PLANNING -> CODING` inbound.
2. Await Planning disposition on `MSG-20260912-0064` and retention-policy proposal.
3. Do not freeze TTLs, activate purge/archive, buy resources, or self-start Productionization/Platform Reuse.
4. Execute only a newly dispatched Planning Work Order.
