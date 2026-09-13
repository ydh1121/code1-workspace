# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: MATERIAL WORKSPACE REV B ACTIVE / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260913-041
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260913-0092
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0065
LAST_CODING_OUTBOUND = MSG-20260912-0064

## Retention acceptance consumed

Planning `MSG-20260912-0065 / RETENTION_TECHNICAL_ACCEPTANCE` is now durable-consumed. `WO-20260912-CODING-OPS-RETENTION-001` is TECHNICAL ACCEPTED / CLOSED. Migration `ops_retention_capacity_guard_0020`, report-only/dry-run contracts, RBAC, Preview and CI evidence from `MSG-0064` are accepted.

Retention policy remains `PROPOSAL_NOT_FROZEN`; `AUTO_PURGE=FALSE`. No purge/archive scheduler, destructive cleanup, paid upgrade or Productionization is authorized.

## Current Planning authority

Planning Delta `20260913-041` and `MSG-20260913-0092` activate `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B` at P0, STAGING ONLY.

`MSG-20260913-0091 / Delta040` is SUPERSEDED and must not be executed.

REV B defines an `INTERNAL PLANNING MATERIAL WORKSPACE`, separate from farm intake/questionnaire. Exact internal menu label and order:

1. `기획문서`
2. `상세페이지 및 제안서 파일`
3. `해야 할 일`

The farm-domain primary models `question_catalog`, `intake_submissions`, `submission_answers`, and farm questionnaire workflow must not be used as the Planning Material business model. Shared domain-neutral primitives must be reused where safe: workspace auth/RBAC, private R2 multipart upload/retry/recovery, SHA-256/object keys/idempotency, safe media validation, audit_log, ops event/outbox, and protected server-side file retrieval/export.

External uploaders must have least privilege to assigned material requests only. FARMER role must not be repurposed merely for convenience. Anonymous unrestricted upload is forbidden.

## Material workspace hard boundaries

- STAGING ONLY
- operational structured authority = Supabase STAGING
- original file bytes = private R2
- Google Drive is not in the upload hot path and is not dual-written
- default sensitive material = `INTERNAL_RESTRICTED`
- `public_delivery_allowed=false` by default
- upload does not imply VERIFIED, APPROVED_CURRENT, or public delivery
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credential mutation = 0
- paid-resource activation = 0
- DESIGN/Figma/HOME/UIUX modification = 0
- retention policy freeze/purge = 0

## Current execution checkpoint

Fresh Git readback before REV B implementation: `coding/runtime-backend-staging` at `a2a5a097dc27bf841ffe16c6c041ac08470011f9`. CURRENT/BATON were stale at MSG-0064 and are being advanced before any material-workspace implementation.

## NEXT_ATOMIC_ACTION

1. Finish durable BATON sync for MSG-0065/MSG-0092.
2. Fresh-read actual Supabase STAGING migrations/schema and current admin/RBAC/media/R2 implementation.
3. Design the smallest additive Planning Material domain schema without farm-intake model abuse.
4. Implement only `MSG-0092 / Delta041 / REV B` on staging.
5. Run required security/domain/version/manifest/mobile/desktop QA and publish CODING -> PLANNING evidence.
6. Stop after Planning evidence; do not auto-start Drive mirroring or Productionization.
