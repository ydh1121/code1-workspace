# CODE1 Planning Material Workspace REV B — STAGING Evidence

Date: 2026-09-14 KST
Work Order: `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`
Authority: Planning `MSG-20260913-0092` / Delta `20260913-041`
Branch: `coding/runtime-backend-staging`
Base checkpoint: `a2a5a097dc27bf841ffe16c6c041ac08470011f9`
Preview deployment commit: `cea50d617566c1243f86874b7868ce4014e77112`
Read-only smoke / final technical checkpoint before durable closeout: `4b28c22a7efa64c348649d18018cd80e4f1a7ee7`
Supabase STAGING project: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

## Verdict

REV B technical implementation is PASS on STAGING for source contract, applied database migrations, transactional acceptance, CI/build, Cloudflare Pages Preview deployment, and unauthenticated read-only live smoke.

Authenticated OWNER/PARTNER visual/click browser acceptance is not claimed by this document. No credentials were read, reset, synthesized, or exposed for QA.

Production/main/live mutation: 0.
Production Supabase/R2 mutation: 0.
Live legacy Google mutation: 0.
Credential mutation: 0.
Drive hot-path dual-write: 0.

## Domain correction implemented

The feature is a separate internal Planning Material domain and does not use farm questionnaire models as its primary business model.

Exact internal menu contract remains:

1. `기획문서`
2. `상세페이지 및 제안서 파일`
3. `해야 할 일`

Shared infrastructure is limited to domain-neutral primitives: workspace auth/RBAC, private R2 media/upload machinery, checksum/object-key/idempotency patterns, audit log, review history, OPS event/outbox, and protected server-side file read/export.

`PARTNER` is a separate external uploader role. Assigned-request access is guarded by `MATERIAL_UPLOAD_ASSIGNED`; unassigned request access and template/catalog mutation are denied.

## Applied STAGING migrations

Supabase migration read-back confirms:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

### 0021 core contract

Additive Planning Material schema, template/request/item/file/version contracts, default seven-item seed, least-privilege capability model, manifest support, audit/review integration, and service-role-only database boundary.

### 0022 identity-safe acceptance corrections

- Planning Material review decisions added without weakening existing review history.
- File finalization requires authorized manager/reviewer or assigned uploader.
- Current file versions are revisioned; previous current candidate becomes historical.
- Uploaded Planning Material media enters `REVIEW_REQUIRED` and does not become public automatically.
- Request submission creates a deterministic Planning manifest hash, non-public Planning source artifact, `PLANNING_IMPACT` OPS event, and outbox row.
- Submission is idempotent/deduplicated and browser roles have no direct RPC execution.

### 0023 synthetic transactional acceptance

Synthetic transaction acceptance verifies and then removes all fixtures before commit:

- exact seven authoritative default labels and order
- unauthorized template mutation denied
- request item label snapshot remains immutable after later template rename/reorder/required/archive changes
- assigned uploader may update assigned item; unassigned uploader is denied
- private Planning Material file version begin/finalize path
- `public_delivery_allowed=false`
- review history transitions and audit rows
- deterministic manifest with descriptor/checksum and no URL/token/signature/credential/secret leakage
- `PLANNING_IMPACT` event + pending outbox on submit
- duplicate submit produces one OPS event only
- Planning source artifact remains non-public

Post-acceptance live read-back on STAGING:

- synthetic account count = 0
- synthetic template count = 0
- synthetic media count = 0
- synthetic request count = 0
- synthetic Planning Material OPS event count = 0

## Source/runtime/UI contract

REV B source diff from the pre-work checkpoint adds or changes the following relevant surfaces:

- `backend/staging/schema/0021_planning_material_workspace.sql`
- `backend/staging/schema/0022_planning_material_acceptance.sql`
- `backend/staging/schema/0023_planning_material_transactional_acceptance.sql`
- `backend/staging/src/planning-material-runtime.mjs`
- `backend/staging/src/staging-dispatch.mjs`
- `backend/staging/src/workspace-access.mjs`
- `backend/staging/src/accounts-adapter.mjs`
- `functions/api/rpc.js`
- `public/assets/planning-materials.js`
- `public/assets/planning-materials.css`
- `public/assets/accounts.js`
- `backend/staging/test/planning-material-contract.test.mjs`

`accounts.js` dynamically loads `planning-materials.js` and `planning-materials.css`; a direct static tag in `index.html` is intentionally unnecessary.

## CI / build

At technical checkpoint `4b28c22a7efa64c348649d18018cd80e4f1a7ee7`:

- `isolated-node-checks`: SUCCESS
- Planning Material read-only Preview smoke: SUCCESS
- legacy OPS smoke: skipped by its own trigger condition

The staging CI pipeline includes syntax checks, staging tests, locked dependency audit/root baseline comparator, and build. No automatic dependency fix or remote business-data mutation is part of this closeout.

## Cloudflare Pages Preview

Deployment commit `cea50d617566c1243f86874b7868ce4014e77112`:

- Cloudflare Pages: SUCCESS
- atomic Preview: `https://4f46d39c.code1-workspace.pages.dev`
- stable branch Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

No Production/main deployment was performed.

## Read-only live smoke

GitHub Actions job `readonly-planning-material-preview-smoke` ran against the stable branch Preview with no credentials and no remote mutation.

PASS:

- `GET /` -> 200
- `GET /assets/accounts.js` -> 200
- `GET /assets/planning-materials.js` -> 200
- `GET /assets/planning-materials.css` -> 200
- `/api/session` -> configured=true, authenticated=false
- unauthenticated `planning.material.bootstrap` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.request.get` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.upload.begin` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.request.submit` -> 401 `UNAUTHENTICATED`
- dynamic loader contract -> PASS
- remoteMutation -> NONE

## Remaining acceptance boundary

Technical implementation is ready for Planning review. Authenticated visual/click acceptance with an authorized OWNER and, if Planning requires it, a real/approved PARTNER test account remains a separate browser-session gate. This document does not fabricate that result.

No further Productionization, Drive mirroring, retention-policy freeze, or cross-track design/UI work is authorized by REV B itself.
