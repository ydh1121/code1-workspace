# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: MATERIAL WORKSPACE REV B TECHNICAL PASS / PLANNING REVIEW PENDING / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-042
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260913-0092
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0065
LAST_CODING_OUTBOUND = MSG-20260912-0064

## Current Planning authority

Planning `MSG-20260913-0092 / Delta041` remains the active authority for `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`, STAGING ONLY.

Planning Delta `20260914-042` was consumed at the current handoff boundary as CODING-awareness only. It explicitly states that REV B is already in progress, no duplicate dispatch is required, and there is no CODING scope change.

`MSG-20260913-0091 / Delta040` is SUPERSEDED and was not executed as authority.

REV B is a separate internal Planning Material domain for product-detail and outbound proposal files. Exact internal tab order is:

1. `기획문서`
2. `상세페이지 및 제안서 파일`
3. `해야 할 일`

Farm questionnaire tables are not the primary business model. Reuse is restricted to domain-neutral auth/RBAC, private R2/media primitives, checksum/idempotency patterns, audit/review, OPS event/outbox and protected file read/export.

## Technical implementation status

Pre-work checkpoint: `a2a5a097dc27bf841ffe16c6c041ac08470011f9`.

Cloudflare Preview deployment commit: `cea50d617566c1243f86874b7868ce4014e77112`.

Read-only smoke technical checkpoint: `4b28c22a7efa64c348649d18018cd80e4f1a7ee7`.

Durable evidence: `docs/coding/PLANNING_MATERIAL_REV_B_EVIDENCE_20260914.md`.

Applied Supabase STAGING migrations read back live:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Post-acceptance synthetic residue read-back:

- QA accounts = 0
- QA template = 0
- QA media = 0
- QA request = 0
- Planning Material QA OPS event residue = 0

## Implemented REV B contract

- additive Planning Material template/request/item/file/version model
- exact seven default labels and order
- SUPER_ADMIN template add/rename/reorder/required/archive with immutable historic request snapshots
- separate `PARTNER` external uploader role; assigned-request-only `MATERIAL_UPLOAD_ASSIGNED`
- unassigned request access denied
- no FARMER-role reuse as uploader shortcut
- private R2 file authority with checksum/version/idempotency support
- uploaded material enters review-required state; public delivery remains false by default
- review history and audit trail
- deterministic manifest + checksum
- non-public Planning source artifact
- deduplicated `PLANNING_IMPACT` OPS event + pending outbox on submit/review-ready path
- safe manifest contract excludes URL/token/signature/credential/secret leakage
- existing internal UI loads Planning Material module dynamically from `accounts.js`

## QA / Preview

GitHub `isolated-node-checks` = SUCCESS at the final technical checkpoint.

Cloudflare Pages deployment for `cea50d61...` = SUCCESS.

Atomic Preview: `https://4f46d39c.code1-workspace.pages.dev`.

Read-only live smoke against stable branch Preview = SUCCESS:

- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-materials.js` 200
- `/assets/planning-materials.css` 200
- session configured=true / authenticated=false
- unauthenticated Planning Material bootstrap/get/upload-begin/submit RPCs all fail closed with 401 `UNAUTHENTICATED`
- dynamic loader contract PASS
- remote mutation NONE

Authenticated OWNER/PARTNER visual/click browser acceptance is not claimed. No credentials were read, reset, synthesized or exposed to fabricate QA.

## Hard boundaries preserved

- STAGING ONLY
- Supabase STAGING = structured operational authority
- private R2 = original file bytes
- Drive hot-path dual-write = 0
- public delivery default = false
- automatic VERIFIED / APPROVED_CURRENT = none
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credential mutation = 0
- paid resource activation = 0
- DESIGN/Figma/HOME/UIUX modification = 0
- retention freeze/purge = 0

## NEXT_ATOMIC_ACTION

1. Publish one CODING -> PLANNING implementation evidence message for REV B after fresh Bus range reconciliation.
2. Mark CODING track as technical-pass / Planning-review-pending.
3. Stop implementation after evidence handoff unless Planning issues a new explicit instruction.
4. Do not auto-start Drive mirroring, Productionization, retention freeze/purge, or cross-track design/UI work.
