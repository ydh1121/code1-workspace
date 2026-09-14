# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: `MSG-20260914-0096` CONSUMED / MATERIAL UX IA DEPLOYED / AUTHENTICATED BROWSER QA REQUIRED / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-046
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0096
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0096
LAST_CODING_OUTBOUND = MSG-20260914-0093

## Current Planning authority

Active Work Order: `WO-20260914-CODING-MATERIAL-UX-001`.

Latest CODING authority: `MSG-20260914-0096 / Planning Delta 20260914-046 / MATERIAL_WORKSPACE_UX_ARCHITECTURE_CORRECTION / P0`.

`MSG-0096` supersedes the remaining UX interpretation/work under `MSG-0094`. It does **not** revoke the accepted REV B technical backend baseline.

Fresh Message Bus read after deployment shows no newer PLANNING -> CODING inbound than `MSG-0096`.

## Preserved REV B technical baseline

No migration replay or schema expansion was performed for this UX Work Order.

Supabase STAGING migrations remain:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Fresh Supabase schema read confirmed the existing model is sufficient:

- `planning_material_template_items.item_key + classification_hint`
- immutable request-item snapshots (`label_snapshot`, `description_snapshot`, `required_snapshot`, `sort_order_snapshot`, `classification_hint`)
- request assignees
- planning material files + immutable file revisions

Preserved unchanged:

- private R2 original-file authority
- multipart/checksum/idempotency/recovery contract
- RBAC and assigned-request authorization
- immutable request/template snapshots
- file revision/current/superseded history
- deterministic Planning export manifest
- deduplicated `PLANNING_IMPACT` event/outbox
- review/currentness/public-claim separation
- `public_delivery_allowed=false`

## MSG-0096 UX architecture correction

The request-item flow is now organized by user task rather than by implementation controls.

### 자료 제출

Each request item has one coherent `자료 제출` compose surface:

- explanation/text and attachments coexist in one submitter surface;
- there is no equal competing `직접 입력 / 파일 첨부 / 내부 검토` step sequence;
- `추후 제출 / 자료 없음 / 해당 없음` are secondary actions inside a collapsed exception panel;
- internal review is a separate collapsed internal-only panel and is never rendered in assigned submitter/PARTNER mode;
- ordinary operator surfaces no longer expose developer-facing English eyebrow labels.

### File interaction

The normal upload and new-version paths now share explicit interaction behavior:

- entire visible drop zone is clickable and keyboard accessible;
- normal file picker remains available;
- dragenter/dragover/dragleave/drop interaction with drag-over visual feedback;
- multi-file select/drop on the normal upload path;
- pre-upload queue with filename + human-readable size;
- per-file removal before upload;
- per-file upload state/progress/success/failure;
- one failed file does not erase other file results;
- existing current file `새 버전` opens a revision uploader that reuses the same drop interaction while preserving version history.

### 요청 항목 관리

One operator-facing name is used: `요청 항목 관리`.

The first surface is now a scannable category/item outline:

- categories use existing `classification_hint`;
- child-item identity uses existing `item_key`;
- only the first non-empty category opens initially;
- empty categories are summarized rather than expanded;
- outline rows show item summary and state, not all editing controls;
- label, guidance, category move, required and active state are changed in a secondary item-edit dialog;
- add/reorder/required/archive/template revision semantics remain on the existing versioned template RPC.

### New request

- one active template => no redundant template selector; current default is applied automatically;
- multiple templates => selector remains;
- active internal and external accounts remain available as assignee candidates while server-side authorization remains unchanged.

## Implementation checkpoints

- request-flow JS refactor: `ef90b1e3c2bae014320f58d5876928ed013c73e9`
- IA/responsive CSS: `91f14a9569b54fa28f6ac7e46ea65132651cf957`
- source guard update: `5cdbefb8a75d805385c0257091d88cf12db2a93b`
- interactive DOM regression checkpoint: `17ede232e9b6c625c0c63a77f4302a1b9486f46d`
- Cloudflare Pages deployment checkpoint: `58054a55c56d49bb03c821f6c523257c7920050c`
- atomic Preview: `https://a636445e.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- stable smoke trigger/checkpoint: `9d560b01a1956f312130883447a50a1f88f02658`

## Verification

At the validated tree:

- staging tests: 187 total / 187 pass / 0 fail
- `isolated-node-checks` = SUCCESS
- locked npm audit = 0 vulnerabilities

New `happy-dom` interaction tests dispatch DOM events rather than only searching source strings and verify:

1. OWNER flow: one compose surface, secondary exceptions, collapsed internal review, outline-first settings, single-template auto application.
2. File flow: whole-zone click, dragover feedback, two-file drop, queue creation, pre-upload removal, multipart begin/chunk/finish, completed result state.
3. Assigned submitter/PARTNER mode: same compose/drop affordance and no internal review controls.

Cloudflare Pages deployment `58054a55...` = SUCCESS.

Credential-free stable Preview smoke `9d560b01...` = SUCCESS:

- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-materials.js` 200
- `/assets/planning-materials.css` 200
- session configured=true / authenticated=false
- unauthenticated material bootstrap/get/upload-begin/submit => 401 `UNAUTHENTICATED`
- dynamic loader contract PASS
- remote mutation NONE

## Remaining MSG-0096 gate

The required **real authenticated browser QA is not yet complete and must not be inferred from CI/DOM simulation**.

Still required through existing authorized sessions:

### OWNER desktop + 390px

- request detail has one coherent `자료 제출` surface;
- exception actions remain secondary;
- internal review is separate/collapsed;
- actual file drag/drop gesture works;
- multi-file queue, filename/size, remove, progress, success/failure are usable;
- existing file `새 버전` drag/drop path is usable and preserves prior version;
- `요청 항목 관리` is outline-first with secondary edit detail and no dense field wall;
- one-template request creation does not show a redundant selector;
- horizontal overflow = 0;
- page/console errors = 0.

### assigned submitter/PARTNER desktop + 390px

- only assigned requests are visible;
- same coherent submit/drop flow works;
- internal review controls are absent;
- actual drag/drop gesture works;
- horizontal overflow = 0;
- page/console errors = 0.

Credentials must not be read, reset or synthesized to manufacture this evidence.

## Hard boundaries preserved

- STAGING ONLY
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- Supabase STAGING schema/migration mutation for this UX WO = 0
- Drive hot-path dual-write = 0
- credential mutation/access = 0
- paid resources = none
- automatic VERIFIED / APPROVED_CURRENT / public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT_ATOMIC_ACTION

1. Use existing authorized OWNER and assigned submitter/PARTNER browser sessions to perform the `MSG-0096` desktop + 390px QA, including an actual drag/drop gesture and console/overflow checks.
2. If concrete defects appear, fix only bounded defects and rerun impacted CI/smoke.
3. Only after the authenticated browser gate is truthfully complete, publish the required CODING -> PLANNING `IMPLEMENTATION_EVIDENCE` for `MSG-0096` with before/after visuals, click paths, drag/drop results, commit/Preview refs and mutation audit.
4. Do not auto-start Drive mirroring, Productionization, retention work or unrelated cross-track work.
