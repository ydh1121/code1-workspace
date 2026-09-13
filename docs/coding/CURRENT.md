# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: MATERIAL WORKSPACE REV B TECHNICAL ACCEPTED / MSG-0094 AUTH QA CONTINUATION / UX DEFECT BATCH 2 DEPLOYED / OWNER RECHECK PENDING / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-044
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0094
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0094
LAST_CODING_OUTBOUND = MSG-20260914-0093

## Current Planning authority

Planning `MSG-20260914-0094 / Delta044 / AUTH_BROWSER_QA_CONTINUATION` is the latest CODING authority for `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`, STAGING ONLY.

REV B remains `TECHNICAL_ACCEPTED`. Do not replay migrations or expand scope. Only concrete authenticated-browser QA defects may be corrected. `MSG-20260913-0092 / Delta041` remains the underlying REV B domain correction; `MSG-20260913-0091 / Delta040` is SUPERSEDED.

Exact internal tab order remains `기획문서` -> `상세페이지 및 제안서 파일` -> `해야 할 일`.

## Backend contracts — unchanged

Supabase STAGING migrations remain:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

No migration/schema/R2/RBAC/manifest/OPS contract was changed by UX defect batch 2. Existing `planning_material_template_items.item_key + classification_hint` and request-item snapshots are sufficient to model classification -> independent child item -> input/file/review history without schema expansion.

## Authenticated OWNER QA defect batch 2

Fresh user screenshots exposed four concrete defects:

1. developer-facing Planning export manifest was visible in the normal operator workflow;
2. request-item body mixed submission state, memo, upload and review controls into one dense surface;
3. template manager was still visually cramped and flat despite `classification_hint`, making child-item structure unclear;
4. new-request assignee UI filtered to `PARTNER` only, hiding internal accounts even though the server accepts any active account assignment.

The account permission dialog also used implementation vocabulary (`Planning Material`, `package`, `request`, `Fact`) rather than operator-facing descriptions.

## UX defect batch 2 implementation

Application checkpoints:

- request-detail / grouped-template / assignee JS: `e86bb66afaff7dab63cc9bb32900616e06e0164c`
- responsive/grouped CSS: `3a2bf1dd095e4cc7496ed0fc9a5c29932e1d015d`
- operator-facing permission copy: `3d8084e8836602a714ed92a4942edef17c13ac65`
- focused regression test checkpoint: `691588838dec7d4c07d0be5ad3d45e9d9b660c5c`
- atomic Preview: `https://d7f4692c.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- stable smoke checkpoint: `1bb1b7b5ca24a33eaf9a13f26c5f33f644085795`

Implemented behavior:

- normal UI no longer exposes `Planning manifest 보기` / manifest JSON modal; deterministic backend manifest remains intact;
- each request child item has explicit `직접 입력`, `파일 첨부`, and internal-only `내부 검토` sections;
- direct input and uploaded originals are visually and operationally separated while keeping the existing item/file/revision RPC model;
- template manager is now `요청 항목 구성 관리`, grouped by human-readable classification with independent child items;
- each child item supports name, submission guidance, required/active status, within-category ordering and classification move;
- no new DB table/column was introduced; `classification_hint` is the category and `item_key` is the independent child-item identity;
- new request assignee list now shows eligible internal and external active accounts, rather than PARTNER-only filtering;
- assigned-only uploader use still requires existing `MATERIAL_UPLOAD_ASSIGNED` authority when the account is not otherwise an internal material operator;
- permission catalog text was rewritten to operator-facing Korean while capability IDs and authorization semantics remain unchanged.

## Verification

At `691588838...`:

- GitHub `isolated-node-checks` = SUCCESS
- Cloudflare Pages = SUCCESS
- atomic Preview = `https://d7f4692c.code1-workspace.pages.dev`

Credential-free stable Preview smoke at `1bb1b7b5...` = SUCCESS:

- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-materials.js` 200
- `/assets/planning-materials.css` 200
- session configured=true / authenticated=false
- unauthenticated material bootstrap/get/upload-begin/submit RPCs -> 401 `UNAUTHENTICATED`
- dynamic loader contract PASS
- remote mutation NONE

`1bb1b7b5...` isolated-node-checks = SUCCESS.

## Remaining acceptance gate

Authenticated OWNER post-fix visual/click recheck is still required; do not invent PASS. The next user-visible recheck should verify:

- manifest control is absent from normal request detail;
- item body clearly separates direct input / file attachment / internal review;
- `요청 항목 구성 관리` is wide, category-grouped, and exposes independent child items without horizontal clipping;
- new request shows internal and external assignee candidates as expected;
- account permission labels/descriptions are understandable without internal developer terminology;
- desktop errors = 0 and 390px overflow = 0 when evidence is available.

PARTNER/assigned-account authenticated access/denial QA remains required by `MSG-0094` unless a newer Planning message changes the gate.

## Hard boundaries preserved

- STAGING ONLY
- Drive hot-path dual-write = 0
- public delivery default = false
- automatic VERIFIED / APPROVED_CURRENT = none
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credential mutation/access = 0
- paid resource activation = 0
- DESIGN/Figma/HOME/UIUX modification = 0
- retention freeze/purge = 0

## NEXT_ATOMIC_ACTION

1. Recheck the four corrected surfaces in the user's existing authorized OWNER session after hard refresh.
2. Assess only evidence actually shown; fix only additional bounded defects and rerun impacted checks.
3. Complete assigned-account/PARTNER authorization QA or truthfully preserve the remaining gate.
4. Publish one CODING -> PLANNING evidence message for `MSG-0094` only after authenticated QA status is known.
5. Do not auto-start Drive mirroring, Productionization, retention work or unrelated cross-track work.
