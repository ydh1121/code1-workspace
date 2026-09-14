# CODE1 Planning Material Great Farm DRAFT Seed + Request Delete — STAGING Evidence

Date: 2026-09-14 KST
Authority: `MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Planning Delta 20260914-049`
Environment: STAGING ONLY
Status: `TECHNICAL PASS / DRAFT SEEDED / NOT PUBLISHED / AUTH_BROWSER_QA BLOCKED_AUTH_SESSION`

## 1. Authority and preserved baseline

Planning `MSG-0104` reconciles prior `MSG-0101` technical evidence and the user-QA request-delete gap `MSG-0102`.

Preserved from MSG-0096/0099:

- explicit `TEXT / LONG_TEXT / FILE / TEXT_FILE`
- immutable request-item response-kind snapshots
- DRAFT → internal preview → explicit PUBLISH lifecycle
- whole-zone drag/drop, multi-file queue, progress, result, reupload/new-version
- submitter/internal-review separation
- private R2, RBAC, immutable snapshots/version history
- deterministic Planning manifest and deduplicated `PLANNING_IMPACT`

No Production/main/live or Production Supabase/R2 changes were made.

## 2. Actual STAGING DRAFT identity

Supabase STAGING project: `bsintmkyhptizrjoizfb`.

The template revision table uses the composite identity `(template_id, revision)`; it has no separate draft UUID.

Actual Great Farm DRAFT identity:

- `template_id = PMT_GREAT_FARM_DEFAULT`
- `revision = 2`
- `revision_state = DRAFT`
- `published_at = NULL`
- template `current_revision = 2`
- template `published_revision = 1`
- r2 `items_snapshot` total = 39
- active Great Farm r2 items = 32
- inactive legacy r1 items retained inside revision history = 7
- r2 snapshot MD5 readback = `6d3f066c12a4b490a312b33755448a8c`

**No publish occurred.** Published pointer remains revision 1.

Actual request exposure readback:

- request count using Great Farm r2 = `0`
- existing Great Farm requests = `2`, both `template_revision = 1`, status `REQUESTED`

Therefore the new Great Farm r2 DRAFT has real STAGING data but no real submitter request exposure.

## 3. Full active Great Farm DRAFT item readback — 32 items

| # | item_key | label | classification | response | required |
|---:|---|---|---|---|---|
| 1 | MAT_GF_PRODUCT_NAME | 현재 상품명 | 02_상품_패키지_표시 | TEXT | YES |
| 2 | MAT_GF_PRODUCT_1_COMPOSITION | 상품1 구성 | 02_상품_패키지_표시 | FILE | YES |
| 3 | MAT_GF_PRODUCT_2_COMPOSITION | 상품2 구성 | 02_상품_패키지_표시 | FILE | NO |
| 4 | MAT_GF_PRODUCT_3_COMPOSITION | 상품3 구성 | 02_상품_패키지_표시 | FILE | NO |
| 5 | MAT_GF_PRODUCT_4_COMPOSITION | 상품4 구성 | 02_상품_패키지_표시 | FILE | NO |
| 6 | MAT_GF_PRODUCT_5_COMPOSITION | 상품5 구성 | 02_상품_패키지_표시 | FILE | NO |
| 7 | MAT_GF_PRODUCT_1_PACKAGE_FRONT | 상품1 패키지 전면 | 02_상품_패키지_표시 | FILE | YES |
| 8 | MAT_GF_PRODUCT_1_PACKAGE_BACK | 상품1 패키지 후면 | 02_상품_패키지_표시 | FILE | YES |
| 9 | MAT_GF_PRODUCT_2_PACKAGE_FRONT | 상품2 패키지 전면 | 02_상품_패키지_표시 | FILE | NO |
| 10 | MAT_GF_PRODUCT_2_PACKAGE_BACK | 상품2 패키지 후면 | 02_상품_패키지_표시 | FILE | NO |
| 11 | MAT_GF_PRODUCT_3_PACKAGE_FRONT | 상품3 패키지 전면 | 02_상품_패키지_표시 | FILE | NO |
| 12 | MAT_GF_PRODUCT_3_PACKAGE_BACK | 상품3 패키지 후면 | 02_상품_패키지_표시 | FILE | NO |
| 13 | MAT_GF_PRODUCT_4_PACKAGE_FRONT | 상품4 패키지 전면 | 02_상품_패키지_표시 | FILE | NO |
| 14 | MAT_GF_PRODUCT_4_PACKAGE_BACK | 상품4 패키지 후면 | 02_상품_패키지_표시 | FILE | NO |
| 15 | MAT_GF_PRODUCT_5_PACKAGE_FRONT | 상품5 패키지 전면 | 02_상품_패키지_표시 | FILE | NO |
| 16 | MAT_GF_PRODUCT_5_PACKAGE_BACK | 상품5 패키지 후면 | 02_상품_패키지_표시 | FILE | NO |
| 17 | MAT_GF_FARM_PHOTO | 현재 생산농장 사진 | 03_농장_생산자_사육환경 | FILE | YES |
| 18 | MAT_GF_HOUSING_PHOTO | 사육환경 사진 | 03_농장_생산자_사육환경 | FILE | YES |
| 19 | MAT_GF_PRODUCER_GROUP_PHOTO | 생산자 단체 사진 | 03_농장_생산자_사육환경 | FILE | NO |
| 20 | MAT_GF_SORTING_PHOTO | 선별작업 사진 | 06_선별_포장_물류 | FILE | YES |
| 21 | MAT_GF_PACKING_PHOTO | 포장 방식 사진 | 06_선별_포장_물류 | FILE | YES |
| 22 | MAT_GF_DISPATCH_PHOTO | 출고 방식 사진 | 06_선별_포장_물류 | FILE | YES |
| 23 | MAT_GF_DELIVERY_CUSHION_PHOTO | 배송 및 완충재 포장방식 사진 | 06_선별_포장_물류 | FILE | NO |
| 24 | MAT_GF_CARRIER | 지정 택배사 | 06_선별_포장_물류 | TEXT | YES |
| 25 | MAT_GF_FEEDING_METHOD_PHOTO | 급이 방식 사진 | 05_사료_급이 | FILE | YES |
| 26 | MAT_GF_FEED_SPEC | JS-3550 또는 실제 급이원료 종류 및 사양 | 05_사료_급이 | FILE | YES |
| 27 | MAT_GF_CERT_ANIMAL_WELFARE | 동물복지 인증서 | 04_인증_검사_성적서 | FILE | YES |
| 28 | MAT_GF_CERT_ANTIBIOTIC_FREE | 무항생제 인증서 | 04_인증_검사_성적서 | FILE | YES |
| 29 | MAT_GF_CERT_HACCP | HACCP 인증서 | 04_인증_검사_성적서 | FILE | YES |
| 30 | MAT_GF_CERT_OTHER | 기타 현재 인증서 | 04_인증_검사_성적서 | FILE | YES |
| 31 | MAT_GF_VANADIUM_REPORT | 현재 생란 제품과 직접 연결되는 바나듐 분석성적서(단위/시료/lot 포함) | 04_인증_검사_성적서 | FILE | YES |
| 32 | MAT_GF_BUSINESS_REG | 사업자등록증 | 01_사업자_법인 | FILE | YES |

Acceptance-sensitive slot rules are therefore materialized in actual STAGING rows:

- 상품1 구성 = required; 상품2~5 구성 = optional.
- 상품1 패키지 전면/후면 = required.
- 상품2~5 패키지 전면/후면 = optional.
- package front/back identity is preserved in distinct `item_key` and label values.
- `현재 상품명` and `지정 택배사` are TEXT.
- all evidence/photo/certificate/report/business-registration fields above are FILE.

## 4. Internal-preview / submitter-exposure evidence

The real r2 template state is `DRAFT`, while `published_revision` remains `1` and no material request uses revision 2.

Runtime access separation remains:

- internal bootstrap loads active templates/current template items, which is the source for the internal DRAFT preview;
- assigned submitter bootstrap does not receive the template catalog/DRAFT configuration;
- new request creation continues to snapshot the published revision only;
- the Great Farm DRAFT seeding migration explicitly asserts `template_revision=2` request count is zero and contains no publish call.

Automated STAGING test coverage verifies:

- r2 is DRAFT-only and no publish function is invoked;
- product1~5 composition and product1~5 package front/back slot identity/rules;
- TEXT-only identity fields and FILE evidence fields;
- the field renderer inherited from MSG-0099 keeps TEXT without upload UI and FILE with the upload/drop surface.

Authenticated visual preview is **not** claimed because this execution context has no reusable interactive authorized browser session.

## 5. Whole material-request delete contract

Migration: `planning_material_draft_seed_request_delete_0026`.

Server contract: `code1_material_delete_request`.

Policy:

- SUPER_ADMIN only.
- Exact request title confirmation is required.
- External submitter/PARTNER has no delete control.
- Pristine request can hard-delete transactionally only when it has no submission/file/review/assignee/manifest/source-artifact meaningful history and only initial create audit.
- Otherwise delete action transitions request to `ARCHIVED` while preserving request items, private-R2 file/history, review/audit/version evidence.
- `ARCHIVED` is removed from active bootstrap results.
- archive guard deactivates active request assignees but preserves assignment rows/history.

UI:

- `planning-material-request-actions.js` decorates internal SUPER_ADMIN request rows with `삭제`.
- confirmation explicitly tells the operator that unused empty requests are permanently removed, while requests with meaningful history disappear from the active screen but their records are preserved.

Acceptance migration `planning_material_request_delete_acceptance_0027` verified transactionally:

1. pristine synthetic request → `DELETED`, request/item residue absent;
2. historied synthetic request → `ARCHIVED`, `history_preserved=true`, request/item history retained;
3. ADMIN delete → `FORBIDDEN`;
4. synthetic acceptance rows/audits cleaned.

Migration `planning_material_archive_assignment_guard_0028` additionally deactivates assignments when a request becomes ARCHIVED.

## 6. Applied migrations

Fresh Supabase migration readback confirms:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`
- `planning_material_field_types_lifecycle_0024`
- `planning_material_field_types_acceptance_0025`
- `planning_material_draft_seed_request_delete_0026`
- `planning_material_request_delete_acceptance_0027`
- `planning_material_archive_assignment_guard_0028`

## 7. Git / Preview / CI

Relevant commits:

- feature/migration seed + safe request delete: `1a2590c1fe167d31210871d898f52175e92b41a3`
- delete acceptance: `c4fdf205ad35e9a5d1336eb5dc7ada7663a30dcd`
- delete runtime: `e8635a09e9a5ed7ea9a468feee0b4e96f42edc34`
- routing/active-list archive exclusion: `ed23fe9dcf72c0855f412e6e455fb9492e438d3f`
- edge allowlist: `ee097f08240dc954a3608882d2a64a728ef2a2b8`
- archive assignment guard: `71675a8e83cd7c45bf7983176201e3e568f7ab7f`
- SUPER_ADMIN request-row delete UI: `6dd77996a3f97d0a19e5a74e15ea4bece9032966`
- index loader: `0d139c715a54d3849c077d5a9536a6ed73bb3007`
- MSG-0104 contract tests: `1104d0c141a9e2d52defc2a2733eab84fe552046`
- preview-smoke extension: `9e3bdd495608ad205154591f60b41c47caf9d802`
- application deployment: `ce5082d23102e58bb2f88e89cb109bdc5b30d466`
- smoke checkpoint before evidence: `b8a137351bc5c0f91c57e5870efbfb52d1c3c641`

Cloudflare Pages deployment = SUCCESS.

- Atomic Preview: `https://042bbc4b.code1-workspace.pages.dev`
- Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

Final pre-evidence branch checks:

- STAGING tests = 207 total / 207 pass / 0 fail
- npm audit = 0
- build = PASS
- root suite remains exactly the known pre-existing baseline (44 total / 39 pass / 5 known baseline failures); no new root regression.

Dedicated live stable-Preview read-only smoke = PASS:

- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-material-request-actions.js` 200
- `/assets/planning-materials.js` 200
- `/assets/planning-materials.css` 200
- `/api/session`: configured=true, authenticated=false
- unauth `planning.material.bootstrap` → 401 `UNAUTHENTICATED`
- unauth `planning.material.request.get` → 401
- unauth `planning.material.request.delete` → 401
- unauth `planning.material.upload.begin` → 401
- unauth `planning.material.request.submit` → 401
- unauth `planning.material.template.publish` → 401
- `fieldTypeBundleContract = PASS`
- `draftPublishBundleContract = PASS`
- `requestDeleteBundleContract = PASS`
- `dynamicLoaderContract = PASS`
- `remoteMutation = NONE`

## 8. Authenticated-browser gate

Current STAGING account readback contains:

- active SUPER_ADMIN = 1
- active ADMIN = 1
- active PARTNER = 0

This chat execution environment has no interactive browser capable of reusing the user's existing authenticated OWNER cookies. There is also no active PARTNER account/session to truthfully execute assigned-submitter QA.

Per the existing-session rule:

- no account/password was created;
- no OWNER password/session was reset;
- no credential/session secret was read or synthesized;
- no authenticated OWNER/PARTNER browser PASS is claimed.

Status therefore remains `BLOCKED_AUTH_SESSION` only for the mandatory real-browser acceptance gate; the MSG-0104 STAGING data/model/delete implementation itself is technically complete.

## 9. Mutation audit

- STAGING structured mutation: 0026 DRAFT seed + 0027 delete acceptance + 0028 archive-assignment guard only.
- Actual Great Farm r2 PUBLISH mutation: **0**.
- Actual request creation using r2: **0**.
- Real user request deletion during implementation/evidence collection: **0**.
- R2 real user-file mutation for this Work Order: **0**.
- Production/main/live mutation: **0**.
- Production Supabase/R2 access/mutation: **0**.
- Google Drive hot-path dual-write: **0**.
- credential/password/session-secret mutation/access: **0**.
- paid-resource activation: **0**.
- retention freeze/purge: **0**.
