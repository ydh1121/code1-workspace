# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260913-041
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260913-0092
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0065
LAST_CODING_OUTBOUND = MSG-20260912-0064

LAST_VERIFIED_ACTION: fresh Harness/Planning readback confirmed `MSG-20260912-0065` technically accepts/closes the retention/capacity Work Order, and `MSG-20260913-0092 / Delta041` supersedes `MSG-0091 / Delta040` and dispatches `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`, STAGING ONLY.

## Closed retention work

`WO-20260912-CODING-OPS-RETENTION-001` = TECHNICAL ACCEPTED / CLOSED by Planning MSG-0065.

Accepted refs remain:
- migration `ops_retention_capacity_guard_0020`
- final CODING report `MSG-20260912-0064`
- `AUTO_PURGE=FALSE`
- TTL matrix `PROPOSAL_NOT_FROZEN`

No purge/archive scheduler, destructive cleanup, paid upgrade, Productionization or Production/main mutation is authorized.

## Active Work Order

`WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`

Authority:
- `MSG-20260913-0092`
- Planning Delta `20260913-041`
- P0
- STAGING ONLY

`MSG-20260913-0091` is SUPERSEDED and must not be executed.

## REV B domain correction

The feature is a separate internal Planning domain for collecting material used to produce detail pages and outbound supply proposals. It is not an extension of farm intake/questionnaire.

Exact admin tab order:
`기획문서` -> `상세페이지 및 제안서 파일` -> `해야 할 일`.

Do not use farm-domain question/submission models as the primary Planning Material model. Reuse neutral shared infrastructure only: workspace authentication/RBAC patterns, private R2 multipart upload/retry/recovery, checksum/object-key/idempotency, safe file validation, audit_log, ops event/outbox and protected file export/read.

External uploaders get assigned-request-only least privilege and must not receive the whole 경영·기획 surface. FARMER role is not a Planning-uploader shortcut. No anonymous unrestricted upload.

Operational SSOT remains Supabase STAGING + private R2; Drive is later Planning work surface only, never hot-path dual-write.

## Fresh Git checkpoint

Before REV B implementation, remote `coding/runtime-backend-staging` was read back at `a2a5a097dc27bf841ffe16c6c041ac08470011f9`. Durable state sync begins after that checkpoint.

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credentials = unchanged
- paid resources = none
- Drive hot-path write = none
- automatic VERIFIED/APPROVED_CURRENT/public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT HANDOFF

1. Read actual Supabase STAGING schema/migrations and current admin/RBAC/media/R2 source.
2. Select the smallest additive planning-material schema and capability model that preserves farm-domain isolation.
3. Implement exact seven-item template, request/package/version/audit/manifest/event contracts and least-privilege uploader path.
4. Run REV B QA, including 390px/desktop and private R2/security checks.
5. Publish one CODING -> PLANNING implementation evidence message and stop for Planning review.
