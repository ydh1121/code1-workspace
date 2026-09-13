# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260914-044
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0094
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0094
LAST_CODING_OUTBOUND = MSG-20260914-0093

LAST_VERIFIED_ACTION: Under Planning `MSG-20260914-0094 / AUTH_BROWSER_QA_CONTINUATION`, a second bounded authenticated-OWNER UX defect batch was implemented, regression-tested, deployed to STAGING Preview and credential-free stable Preview smoke passed. No Supabase migration/schema, R2, RBAC semantics, manifest/OPS backend contract, Production/main/live resource, Drive hot-path or credential state was changed. OWNER post-fix visual recheck remains open.

## Active authority

`WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`

Latest Planning authority: `MSG-20260914-0094 / Delta044`.

REV B is `TECHNICAL_ACCEPTED`; do not replay migrations or expand scope. Underlying domain correction remains `MSG-20260913-0092 / Delta041`; `MSG-20260913-0091 / Delta040` is SUPERSEDED.

Exact internal tab order remains `기획문서` -> `상세페이지 및 제안서 파일` -> `해야 할 일`.

## Backend checkpoint — unchanged

Supabase STAGING migrations remain:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Existing `classification_hint` + independent `item_key` + request-item snapshots are used for category/child-item organization. No schema migration was necessary.

## UX defect batch 2

User-provided OWNER screenshots established these defects:

- manifest JSON surfaced as a normal operator action;
- direct input, upload, status and review were visually mixed;
- template manager was flat/cramped instead of expressing classification -> child item hierarchy;
- new-request assignee selector hid internal accounts due PARTNER-only filtering;
- permission descriptions exposed developer vocabulary.

Applied checkpoints:

- JS: `e86bb66afaff7dab63cc9bb32900616e06e0164c`
- CSS: `3a2bf1dd095e4cc7496ed0fc9a5c29932e1d015d`
- permission catalog copy: `3d8084e8836602a714ed92a4942edef17c13ac65`
- regression-test/deploy checkpoint: `691588838dec7d4c07d0be5ad3d45e9d9b660c5c`
- atomic Preview: `https://d7f4692c.code1-workspace.pages.dev`
- stable Preview smoke checkpoint: `1bb1b7b5ca24a33eaf9a13f26c5f33f644085795`

New operator UI contract:

- manifest JSON is not exposed in the normal request-detail UI;
- request child item is separated into `직접 입력`, `파일 첨부`, and internal-only `내부 검토`;
- template editor groups items by human-readable category and allows independent child-item creation/move/order/required/active/guidance editing;
- new-request assignee selector lists eligible active internal and external accounts instead of PARTNER only;
- assigned-only uploader access continues to use existing `MATERIAL_UPLOAD_ASSIGNED` capability and request assignment;
- permission labels/descriptions are written as operator actions, not implementation terminology.

## Verification read-back

At `691588838...`:

- isolated-node-checks = SUCCESS
- Cloudflare Pages = SUCCESS
- atomic Preview = `https://d7f4692c.code1-workspace.pages.dev`

Credential-free stable Preview smoke at `1bb1b7b5...` = SUCCESS:

- root + accounts/material JS/CSS 200
- dynamic loader PASS
- session configured=true / authenticated=false
- unauthenticated material bootstrap/get/upload-begin/submit -> 401 `UNAUTHENTICATED`
- remote mutation NONE

`1bb1b7b5...` isolated-node-checks = SUCCESS.

## Remaining authenticated QA

OWNER post-fix recheck must use the existing authorized browser session. Do not read/reset/synthesize credentials and do not infer visual PASS from smoke.

Immediate checks:

1. no manifest button/modal in normal request detail;
2. direct input / file upload / internal review are clearly separated;
3. category-grouped child-item editor is wide enough and has no horizontal clipping;
4. internal account candidates appear in new-request assignee selection;
5. account permission labels/descriptions are intuitive Korean;
6. desktop errors = 0 and 390px overflow = 0 when evidence is available.

Assigned-account/PARTNER authenticated access/denial QA remains pending under `MSG-0094` unless a newer Planning disposition changes it.

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credentials unchanged/not accessed
- Drive hot-path write = 0
- paid resources = none
- automatic VERIFIED/APPROVED_CURRENT/public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT HANDOFF

1. Obtain fresh post-fix screenshots from the user's existing authorized OWNER session after hard refresh.
2. Evaluate only demonstrated visual/click paths and fix only bounded defects.
3. Complete assigned-account/PARTNER auth QA or preserve the truthful remaining blocker.
4. Send one CODING -> PLANNING implementation evidence message for `MSG-0094` only after authenticated QA status is known.
5. Do not auto-start Drive mirroring, Productionization or unrelated work.
