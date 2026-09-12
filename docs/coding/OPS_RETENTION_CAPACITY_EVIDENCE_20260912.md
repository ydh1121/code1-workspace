# CODE1 OPS Retention / Capacity Guard — Evidence

Work Order: `WO-20260912-CODING-OPS-RETENTION-001`
Planning dispatch: `MSG-20260912-0063`
Scope: STAGING ONLY / NON_DESTRUCTIVE_FIRST
Policy state: `PROPOSAL_NOT_FROZEN`
Execution mode: `REPORT_ONLY / DRY_RUN`
`AUTO_PURGE=FALSE`
`PAID_UPGRADE=FALSE`
`PRODUCTIONIZATION=NOT_DISPATCHED`

## Pre-change measured STAGING baseline

Supabase STAGING project: `bsintmkyhptizrjoizfb`.

Measured by read-only SQL before migration 0020:

| Relation | Rows | Heap bytes | Index bytes | TOAST/aux bytes | Total bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ops_change_events` | 0 | 16,384 | 98,304 | 32,768 | 147,456 |
| `ops_outbox` | 0 | 8,192 | 81,920 | 8,192 | 98,304 |
| Combined | 0 logical pairs | 24,576 | 180,224 | 40,960 | 245,760 |

Whole database measured size: `13,569,171 bytes` (~13 MB).
OWNER QA synthetic residue: `0`.
Oldest/newest retained timestamps: null because both OPS relations are empty.
Measured average stored row size: unavailable because row count is zero.

All eleven current OPS indexes were individually present at 16 KiB empty-relation minimum size: six on `ops_change_events`, five on `ops_outbox`.

A SELECT-only representative composite (no insert) measured approximately:

- representative event row datum: 808 bytes
- representative outbox row datum: 224 bytes
- combined representative heap payload before page/index/TOAST overhead: 1,032 bytes

## Conservative growth model

The planning model deliberately uses `4 KiB per logical event + outbox pair`, roughly four times the representative 1,032-byte heap datum, to leave conservative allowance for PostgreSQL tuple/page overhead, eleven B-tree index entries, alignment, JSON variation and occasional TOAST growth. This is an extrapolation, not a measured production average.

Starting from the measured 245,760-byte empty-relation baseline:

| Logical events | Conservative OPS footprint |
| ---: | ---: |
| 1,000 | ~4.14 MiB |
| 10,000 | ~39.30 MiB |
| 100,000 | ~390.86 MiB |
| 1,000,000 | ~3.815 GiB |

Illustrative time-to-count only; these are not observed traffic rates:

| Daily logical events | 1k | 10k | 100k | 1M |
| ---: | ---: | ---: | ---: | ---: |
| 100/day (low example) | 10 d | 100 d | 1,000 d | 10,000 d |
| 1,000/day (normal example) | 1 d | 10 d | 100 d | 1,000 d |
| 10,000/day (high example) | 0.1 d | 1 d | 10 d | 100 d |

Actual growth-rate reporting remains unavailable until at least two time-separated measured samples exist.

## Implemented report-only framework

Migration: `backend/staging/schema/0020_ops_retention_capacity_guard.sql`.

It adds only service-role report functions:

- `code1_ops_retention_policy_proposal()`
- `code1_ops_capacity_report(...)`
- `code1_ops_retention_dry_run(...)`

There is deliberately no purge executor, DELETE/TRUNCATE/DROP, pg_cron scheduler, trigger, automatic plan upgrade, archive destination, or Production resource operation.

The authenticated server boundary exposes STAGING-only OWNER actions:

- `admin.ops.capacity.report`
- `admin.ops.retention.dryRun`

Both accept fixed empty payload only. Browser roles do not receive service-role access. `OPS_DB_CONFIGURED_LIMIT_BYTES` is an optional non-secret server configuration input; it is not provisioned by this Work Order. When it is unknown, capacity state intentionally reports `WATCH / CONFIGURED_LIMIT_UNKNOWN` rather than inventing a quota.

## Proposed retention matrix — PROPOSAL_NOT_FROZEN

| Category | Proposed TTL / review window | Behavior |
| --- | ---: | --- |
| QA/test fixture | immediate cleanup; 1-day fallback alert | candidate only as cleanup fallback |
| delivered / NO_ACTION outbox | 14 days | terminal outbox candidate |
| FAILED_RETRYABLE outbox | 30 days | REVIEW_ONLY; not deletion-eligible |
| OPS_DATA_ONLY events | 90 days | only terminal `NO_PLANNING_ACTION` + `NO_ACTION` |
| PLANNING/UIUX/CODING impact | 180 days | only `DONE` + delivered |
| POLICY_APPROVAL_REQUIRED / INCIDENT | 365 days | ARCHIVE_REVIEW_ONLY; not deletion-eligible |

These durations are a Coding proposal for Planning/user review. They are not frozen policy and do not authorize deletion or scheduling.

## Security / RBAC checkpoint

Migration `ops_retention_capacity_guard_0020` applied successfully to STAGING only.

Post-migration privilege readback:

- anon execute on all three new functions: `false`
- authenticated execute on all three new functions: `false`
- service_role execute on all three new functions: `true`
- current SQL connector identity: `supabase_read_only_user`

A direct capacity-function call from that read-only SQL identity returned `permission denied`, confirming that the migration-owner/read-only connector was not used as a service-role bypass.

RLS remains enabled on both OPS tables. Catalog inspection found zero destructive tokens in the three new function definitions. Current dry-run-equivalent candidate counts are all zero.

Post-migration readback remained:

- `ops_change_events=0`
- `ops_outbox=0`
- `OWNER_QA_FIXTURE residue=0`
- relation sizes unchanged at 147,456 + 98,304 bytes

The database itself increased only by function/catalog metadata to `13,585,555 bytes`; no OPS row was created by this Work Order.

## CI / Preview deployment checkpoint

Implementation/test head before deployment marker: `3993d50be6d388ddd5391e4035aab4d9d781a000` — isolated-node checks SUCCESS.

Preview deployment marker: `5cc9d7b467b5ec0f974e35a513f2e605fb4d7500`.

Cloudflare Pages deployment: SUCCESS.

- atomic Preview: `https://bff5b428.code1-workspace.pages.dev`
- stable branch Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- isolated-node checks: SUCCESS

## Pending final evidence

This commit triggers the credential-free stable-Preview smoke using the updated script. The smoke verifies both new report actions fail closed with `401 UNAUTHENTICATED` before any application data path is reached. No remote mutation is performed.

After smoke completion, final evidence must still record:

- smoke run/job PASS
- final post-smoke zero-residue readback
- durable CURRENT/BATON checkpoint
- CODING -> PLANNING IMPLEMENTATION_EVIDENCE
