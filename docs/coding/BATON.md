# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0064
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0063
LAST_CODING_OUTBOUND = MSG-20260912-0064

LAST_VERIFIED_ACTION: Planning `MSG-20260912-0063` dispatched `WO-20260912-CODING-OPS-RETENTION-001`. CODING measured the actual STAGING OPS footprint, applied report-only migration `ops_retention_capacity_guard_0020`, deployed and smoke-tested the guarded server actions, verified zero residue, and published consolidated evidence as `MSG-20260912-0064`. TTL values remain `PROPOSAL_NOT_FROZEN`; `AUTO_PURGE=FALSE`.

## Current Work Order

`WO-20260912-CODING-OPS-RETENTION-001` — technical/STAGING evidence PASS from CODING perspective; `MSG-0064` is pending Planning acceptance/policy decision.

Parent OPS Relay WOs remain COMPLETE/CLOSED.

## Durable refs

- pre-WO staging checkpoint: `9a36b7074bc56833aae730ad6ac313a6c1408d04`
- implementation/test head: `3993d50be6d388ddd5391e4035aab4d9d781a000`
- Preview deployment marker: `5cc9d7b467b5ec0f974e35a513f2e605fb4d7500`
- live smoke/test head: `bfae31df267943d86dd3d02f170f048b6112dd43`
- evidence: `docs/coding/OPS_RETENTION_CAPACITY_EVIDENCE_20260912.md`
- migration: `ops_retention_capacity_guard_0020`
- final Bus report: `MSG-20260912-0064`

## Actual STAGING measurements

Baseline before 0020:

```text
ops_change_events rows=0 total=147456 bytes
ops_outbox        rows=0 total=98304 bytes
combined fixed relation footprint=245760 bytes
database bytes=13569171
OWNER_QA residue=0
```

All 11 OPS indexes were present. No retained rows existed, so actual average row size and time-based growth rate were unavailable.

SELECT-only representative datum: event 808 bytes + outbox 224 bytes = 1,032 bytes. Conservative planning model = 4 KiB per logical pair: 1k ~4.14 MiB; 10k ~39.30 MiB; 100k ~390.86 MiB; 1M ~3.815 GiB.

## Implemented guard

Service-role/OWNER-only report functions back two STAGING-only fixed-payload actions:

- `admin.ops.capacity.report`
- `admin.ops.retention.dryRun`

anon/authenticated EXECUTE=false; service_role=true; direct read-only connector execution denied; RLS stays enabled.

No purge executor, DELETE/TRUNCATE/DROP path, trigger, scheduler/pg_cron, paid resource, archive destination, arbitrary SQL/debug path, credential provisioning or Production mutation exists.

Unknown configured DB quota reports `WATCH / CONFIGURED_LIMIT_UNKNOWN` rather than assuming a plan.

## Retention proposal awaiting Planning/user decision

```text
QA/test fixture                         immediate + 1d fallback alert
delivered / NO_ACTION outbox           14d candidate
FAILED_RETRYABLE outbox                30d REVIEW_ONLY
OPS_DATA_ONLY                           90d terminal candidate
PLANNING/UIUX/CODING impact            180d DONE+DELIVERED candidate
POLICY_APPROVAL_REQUIRED / INCIDENT    365d ARCHIVE_REVIEW_ONLY
```

Status = `PROPOSAL_NOT_FROZEN`.

## Verification

Cloudflare Preview deployment for `5cc9d7b...` = SUCCESS.

Smoke run `34677990898`, job `103511206750` = SUCCESS: unauth capacity report 401, unauth retention dryRun 401, remoteMutation NONE.

CI on `bfae31d...`: STAGING 162/162 PASS; npm audit 0; build PASS; root baseline same five known pre-existing failures / new failures 0.

Final STAGING readback:

```text
ops_change_events=0
ops_outbox=0
OWNER_QA_FIXTURE residue=0
events total bytes=147456
outbox total bytes=98304
database bytes=13585555
```

## Hard boundaries

- `AUTO_PURGE=FALSE`
- `PAID_UPGRADE=FALSE`
- `PRODUCTIONIZATION=NOT_DISPATCHED`
- Production/main/Production Supabase/R2/live Google mutation=0
- credential operation=0
- retained non-synthetic deletion=0

## NEXT HANDOFF

1. Fresh-read CURRENT and latest Planning -> CODING inbound.
2. Await Planning disposition on `MSG-0064` and the TTL proposal.
3. Do not self-start Productionization or Platform Reuse.
4. Do not freeze TTLs or activate purge/archive without explicit Planning/user authority.
