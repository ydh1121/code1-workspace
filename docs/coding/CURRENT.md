# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: `MSG-20260914-0104` CONSUMED / GREAT FARM r2 DRAFT SEEDED / REQUEST DELETE TECHNICAL PASS / NOT PUBLISHED / `BLOCKED_AUTH_SESSION` / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Drive hot-path mutation: 0
Credential read/reset/synthesis: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-049
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0104
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0104
LAST_CODING_OUTBOUND = MSG-20260914-0102

## Current Planning authority

Active Work Order: `WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001`.

Authority: `MSG-20260914-0104 / Planning Delta 20260914-049 / P0`.

Planning reconciled `MSG-0101` technical evidence and `MSG-0102` user-QA request-delete gap into this Work Order.

## Actual Great Farm DRAFT — STAGING data

Composite DRAFT identity:

- template: `PMT_GREAT_FARM_DEFAULT`
- revision: `2`
- state: `DRAFT`
- published_at: NULL
- current_revision: `2`
- published_revision: `1`

No publish occurred.

Revision-2 snapshot readback:

- total historical snapshot items: 39
- active current DRAFT items: 32
- inactive retained legacy items: 7
- snapshot MD5: `6d3f066c12a4b490a312b33755448a8c`

Submitter exposure readback:

- material requests using template revision 2: `0`
- existing Great Farm material requests: `2`, both revision `1`, status `REQUESTED`

Thus the real r2 DRAFT exists only as an internal editable/preview configuration; published r1 remains the only request source.

Full 32-item readback is durable in `docs/coding/PLANNING_MATERIAL_DRAFT_SEED_DELETE_DEPLOY_20260914.md`.

Acceptance-sensitive rules read back from actual STAGING rows:

- 현재 상품명 = TEXT required
- 지정 택배사 = TEXT required
- 상품1 구성 = FILE required
- 상품2~5 구성 = FILE optional
- 상품1 package front/back = FILE required
- 상품2~5 package front/back = FILE optional
- all farm/photo/logistics/feed/certificate/report/business-registration evidence items = FILE with exact required/optional rules from MSG-0104

MSG-0099 typed rendering remains: TEXT does not render file upload; FILE uses upload/drop UI.

## Whole material-request delete — implemented

Applied safe delete contract:

- internal SUPER_ADMIN only
- exact request-title confirmation
- pristine unused request => transactional hard delete
- request with meaningful history => ARCHIVED, history preserved
- ARCHIVED removed from active bootstrap
- active assignees deactivated on archive while assignment rows/history remain
- PARTNER/non-SUPER_ADMIN receives no delete control

UI helper: `public/assets/planning-material-request-actions.js`.

Acceptance:

- pristine synthetic request => `DELETED`
- historied request => `ARCHIVED / history_preserved=true`
- ADMIN attempt => `FORBIDDEN`
- synthetic acceptance residue => 0

## Supabase STAGING migrations

Fresh migration readback confirms:

- 0021 workspace
- 0022 acceptance
- 0023 transactional acceptance
- 0024 field types/lifecycle
- 0025 field-type acceptance
- `planning_material_draft_seed_request_delete_0026`
- `planning_material_request_delete_acceptance_0027`
- `planning_material_archive_assignment_guard_0028`

## Git / Preview / CI

Key application commits:

- `1a2590c1fe167d31210871d898f52175e92b41a3` — Great Farm r2 DRAFT + safe request-delete DB contract
- `c4fdf205ad35e9a5d1336eb5dc7ada7663a30dcd` — delete acceptance
- `e8635a09e9a5ed7ea9a468feee0b4e96f42edc34` — delete runtime
- `ed23fe9dcf72c0855f412e6e455fb9492e438d3f` — staging routing / archived active-list exclusion
- `71675a8e83cd7c45bf7983176201e3e568f7ab7f` — archive assignment guard
- `6dd77996a3f97d0a19e5a74e15ea4bece9032966` — SUPER_ADMIN row delete control
- `1104d0c141a9e2d52defc2a2733eab84fe552046` — MSG-0104 regression tests
- `ce5082d23102e58bb2f88e89cb109bdc5b30d466` — Cloudflare application deploy
- atomic Preview: `https://042bbc4b.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

Verification before durable docs sync:

- STAGING tests = 207 / 207 PASS
- npm audit = 0
- build PASS
- root baseline unchanged: 44 total / 39 pass / 5 known pre-existing failures
- Cloudflare Pages deploy = SUCCESS
- stable Preview material smoke = SUCCESS
- requestDeleteBundleContract = PASS
- fieldTypeBundleContract = PASS
- draftPublishBundleContract = PASS
- unauth request.delete and other material RPCs = 401 fail-closed
- remoteMutation from smoke = NONE

## Authenticated-browser gate

Real authenticated OWNER + assigned PARTNER desktop/390 browser QA is not claimed.

Fresh account readback:

- active SUPER_ADMIN = 1
- active ADMIN = 1
- active PARTNER = 0

This execution context has no interactive browser carrying the user's authenticated OWNER session and there is no existing PARTNER account/session. Per harness rules CODING did not create/reset/synthesize any credential or QA identity.

Therefore the MSG-0104 implementation/data/delete checkpoint is technically complete, but the mandatory real-browser acceptance remains `BLOCKED_AUTH_SESSION`.

## Mutation audit

- Great Farm r2 DRAFT seed: applied to STAGING
- Great Farm r2 publish: 0
- real request creation using r2: 0
- real user request deletion during implementation/evidence collection: 0
- Production/main/live mutation: 0
- Production Supabase/R2 access/mutation: 0
- Drive hot-path dual-write: 0
- credential/password/session-secret mutation/access: 0
- paid resource activation: 0
- retention freeze/purge: 0

## NEXT_ATOMIC_ACTION

1. Fresh-read Message Bus.
2. Publish CODING → PLANNING MSG-0104 implementation evidence with DRAFT identity/full readback, internal-preview/no-exposure evidence, delete evidence, commit/Preview refs, mutation audit, and exact auth-session blocker.
3. If Planning issues newer CODING authority, process it first.
4. Otherwise wait for existing authenticated OWNER and assigned PARTNER sessions; then execute desktop + 390 browser QA without credential reset/synthesis.
