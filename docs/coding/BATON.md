# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260914-049
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0104
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0104
LAST_CODING_OUTBOUND = MSG-20260914-0102

LAST_VERIFIED_ACTION: `MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Delta049` was executed on STAGING. Great Farm r2 DRAFT data is physically present, exact active 32-item readback matches Planning, published pointer remains r1, real requests using r2 = 0, and safe whole-request delete/archive is deployed and acceptance-tested. Cloudflare Pages and stable Preview smoke passed. Real authenticated OWNER/PARTNER browser acceptance remains `BLOCKED_AUTH_SESSION` and was not fabricated.

## Active authority

`WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001`

Latest Planning authority consumed: `MSG-20260914-0104 / Delta049 / P0`.

This authority reconciles prior CODING `MSG-0101` technical evidence and user-QA request-delete gap `MSG-0102`.

## Great Farm DRAFT checkpoint

Template: `PMT_GREAT_FARM_DEFAULT`

- current_revision = 2
- published_revision = 1
- r2 state = DRAFT
- r2 published_at = NULL
- r2 snapshot = 39 total entries / 32 active / 7 inactive legacy-history entries
- r2 snapshot MD5 = `6d3f066c12a4b490a312b33755448a8c`
- real requests using r2 = 0
- existing Great Farm requests = 2, both r1 / REQUESTED

Do **not** publish r2 without a future explicit Planning/user authority.

Full active 32-item row-by-row readback is in:
`docs/coding/PLANNING_MATERIAL_DRAFT_SEED_DELETE_DEPLOY_20260914.md`

Key rules:

- 현재 상품명 = TEXT required
- 지정 택배사 = TEXT required
- 상품1 구성 = FILE required; 상품2~5 = FILE optional
- 상품1 package front/back = required; 상품2~5 front/back = optional
- all specified photo/certificate/report/business-registration evidence fields = FILE
- TEXT does not expose upload UI; FILE uses the MSG-0096 drag/drop/queue/progress/version flow

## Whole material-request delete

SUPER_ADMIN-only delete is deployed.

- exact title confirmation required
- pristine unused request => hard `DELETED`
- meaningful history => `ARCHIVED`, history preserved
- archived requests excluded from active bootstrap
- archived request assignees are deactivated, assignment rows retained
- ADMIN/PARTNER/non-SUPER_ADMIN => no delete control / forbidden server path

Acceptance migrations:

- `planning_material_draft_seed_request_delete_0026`
- `planning_material_request_delete_acceptance_0027`
- `planning_material_archive_assignment_guard_0028`

Delete acceptance passed:

- pristine => DELETED
- historied => ARCHIVED + history preserved
- ADMIN => FORBIDDEN
- synthetic residue => 0

## Git / deploy

- feature seed/delete: `1a2590c1fe167d31210871d898f52175e92b41a3`
- delete acceptance: `c4fdf205ad35e9a5d1336eb5dc7ada7663a30dcd`
- delete runtime: `e8635a09e9a5ed7ea9a468feee0b4e96f42edc34`
- routing/archive exclusion: `ed23fe9dcf72c0855f412e6e455fb9492e438d3f`
- assignment guard: `71675a8e83cd7c45bf7983176201e3e568f7ab7f`
- SUPER_ADMIN delete UI: `6dd77996a3f97d0a19e5a74e15ea4bece9032966`
- contract tests: `1104d0c141a9e2d52defc2a2733eab84fe552046`
- application deploy: `ce5082d23102e58bb2f88e89cb109bdc5b30d466`
- atomic Preview: `https://042bbc4b.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- smoke checkpoint before durable evidence: `b8a137351bc5c0f91c57e5870efbfb52d1c3c641`

Verification:

- STAGING tests = 207 / 207 PASS
- npm audit = 0
- build = PASS
- known root baseline unchanged (44 total / 39 pass / 5 known failures)
- Cloudflare Pages deploy = SUCCESS
- stable material Preview smoke = SUCCESS
- requestDeleteBundleContract = PASS
- fieldTypeBundleContract = PASS
- draftPublishBundleContract = PASS
- unauth material/delete/publish RPCs fail closed at 401
- smoke remote mutation = NONE

## Remaining blocker

`BLOCKED_AUTH_SESSION` only for required real-browser acceptance.

Fresh account readback:

- active SUPER_ADMIN = 1
- active ADMIN = 1
- active PARTNER = 0

Current execution environment has no interactive browser carrying an existing OWNER session, and there is no existing PARTNER identity/session. Do not create/reset/synthesize credentials or QA accounts.

Therefore:

- Great Farm r2 DRAFT seed = technically complete
- request delete/archive = technically complete
- r2 publish = prohibited / 0
- actual authenticated browser QA = not claimed

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 access/mutation = 0
- Drive hot-path dual-write = 0
- credential/password/session-secret read/reset/synthesis = 0
- real user request deletion during implementation/evidence = 0
- no fabricated browser evidence

## NEXT HANDOFF

1. Fresh-read Message Bus.
2. Publish CODING -> PLANNING MSG-0104 implementation evidence after Bus reconciliation.
3. If newer Planning authority exists, process it first.
4. Otherwise remain `BLOCKED_AUTH_SESSION` until existing authorized OWNER + assigned PARTNER browser sessions are available; then run desktop/390 authenticated QA without creating/resetting credentials.
