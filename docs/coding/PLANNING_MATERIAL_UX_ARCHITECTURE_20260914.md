# CODE1 Planning Material UX Architecture Correction — STAGING

Date: 2026-09-14 KST
Authority: `MSG-20260914-0096 / WO-20260914-CODING-MATERIAL-UX-001 / Planning Delta 20260914-046`
Environment: STAGING ONLY

## Authority and preserved technical acceptance

`MSG-0096` supersedes the remaining UX work under `MSG-0094`. It does not revoke the previously accepted REV B backend implementation.

Preserved without migration replay or schema expansion:

- Supabase STAGING structured authority and migrations `0021/0022/0023`
- private R2 originals and multipart/checksum/idempotency/recovery contract
- RBAC and assigned-request access model
- immutable request item snapshots
- file revision/current/superseded history
- deterministic Planning manifest
- deduplicated `PLANNING_IMPACT` OPS event/outbox
- `public_delivery_allowed=false` default and review/currentness/public-claim separation

## UX architecture correction

The Planning Material request flow was rebuilt around the actual user task rather than sequential implementation controls.

### Request item

- Each item now has one coherent `자료 제출` compose surface.
- Text explanation and file attachment coexist in that same submitter surface.
- `추후 제출 / 자료 없음 / 해당 없음` moved to a secondary collapsed exception area.
- Internal review is a separate collapsed internal-only panel and is never rendered for assigned submitter/PARTNER mode.
- Developer-facing English eyebrow labels were removed from ordinary operator surfaces.

### File attachment

- Entire drop zone is clickable and keyboard accessible.
- Native file picker remains available.
- Actual dragenter/dragover/dragleave/drop event handling is present with visual feedback.
- Multiple selected/dropped files become a pre-upload queue with filename and size.
- Each queued file can be removed before upload.
- Upload progress/state is displayed per file.
- One file failure does not erase the result of other files; success/failure remains per-file.
- Existing multipart private-R2 begin/chunk/finish RPC contract is unchanged.
- Existing current files retain `새 버전`; the revision dialog reuses the same drop interaction and preserves history.

### Request item management

- One consistent name is used: `요청 항목 관리`.
- The initial surface is an outline grouped by existing `classification_hint`.
- Independent child identity remains existing `item_key`.
- Dense inline settings were removed from the outline.
- Label, submission guidance, classification move, required and active state are edited in a secondary item dialog.
- Non-empty categories are collapsible; only the first is opened initially.
- Empty categories are summarized rather than expanded.
- Add/reorder/required/archive/version-history semantics are preserved through the existing template revision RPC.

### Request creation

- If exactly one active template exists, template selection is hidden and the current default is applied automatically.
- If multiple templates exist, an explicit configuration selector remains.
- Existing internal/external assignee support remains.

## Verification and deployment

Validated interaction-test checkpoint: `17ede232e9b6c625c0c63a77f4302a1b9486f46d`.

Deployment checkpoint: `58054a55c56d49bb03c821f6c523257c7920050c`.

Cloudflare Pages = SUCCESS.

- Atomic Preview: `https://a636445e.code1-workspace.pages.dev`
- Stable branch Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

At the validated tree, `isolated-node-checks` = SUCCESS.

Staging test suite:

- total: 187
- pass: 187
- fail: 0

Interaction tests use `happy-dom` and dispatch DOM events rather than only matching source strings. They verify:

1. OWNER flow: one compose surface, secondary exception flow, collapsed internal review, outline-first settings, single-template auto application.
2. File interaction: whole-zone click, dragover feedback, two-file drop, queue creation, pre-upload removal, multipart begin/chunk/finish, completed result state.
3. Assigned submitter/PARTNER mode: same compose/drop affordance with no internal review controls.

Locked npm audit = 0 vulnerabilities. Existing unrelated root-suite baseline failures remain unchanged and accepted by the branch baseline guard.

This docs-only checkpoint is the explicit `PLANNING_MATERIAL_PREVIEW_SMOKE` trigger and must not redeploy application code.

## Authentication/browser acceptance still required

This deployment does **not** claim the `MSG-0096` authenticated browser gate as complete. Real OWNER and assigned submitter/PARTNER desktop + 390px browser QA, including a real drag/drop gesture, horizontal overflow check and page/console error check, must still be performed through an existing authorized session. Credentials must not be read, reset or synthesized to manufacture evidence.

## Mutation audit

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- Supabase STAGING migration/schema mutation for this UX WO = 0
- credential mutation/access = 0
- Google Drive upload hot-path dual-write = 0
- paid resource activation = 0
- automatic VERIFIED / APPROVED_CURRENT / public delivery = 0
- DESIGN/Figma/HOME/UIUX mutation = 0
- retention freeze/purge = 0
