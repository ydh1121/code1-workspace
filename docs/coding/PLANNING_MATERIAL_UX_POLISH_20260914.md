# CODE1 Planning Material UX Polish — STAGING Preview Marker

Date: 2026-09-14 KST
Authority: `MSG-20260914-0094 / AUTH_BROWSER_QA_CONTINUATION`
Scope: bounded authenticated-browser QA defect correction only
Environment: STAGING ONLY

## UX defect batch 1

- Planning Material request list changed from collapsing tile cards to full-width operational rows.
- Generic farm/account KPI summary is hidden while the Planning Material tab is active and replaced with material-request summary metrics.
- Request detail items use compact accordion disclosure with submission/review/file-count summaries.
- File selection adds clear selected-file feedback and drag/drop affordance while retaining the existing private-R2 upload RPC contract.
- Upload item manager uses a wider no-horizontal-scroll layout, human-readable classification labels, order move controls, and sticky save/cancel actions.
- Explicit 390px responsive no-horizontal-overflow contract retained.

## UX defect batch 2 — authenticated OWNER screenshot follow-up

- User-facing Planning export manifest button/modal removed from the normal workflow. Backend deterministic manifest/event contract remains unchanged.
- Each request item now separates `직접 입력`, `파일 첨부`, and internal-only `내부 검토` into distinct surfaces.
- Upload item manager is now `요청 항목 구성 관리`, grouped by existing `classification_hint` categories with independent child items (`item_key`). Each child item can keep its own input/file/review history without a schema change.
- Template editor width is explicitly expanded and horizontal overflow is suppressed.
- New-request assignee selection now displays eligible internal and external active accounts instead of filtering to PARTNER only. Assigned-only uploader use still requires the existing `MATERIAL_UPLOAD_ASSIGNED` capability.
- Account permission labels/descriptions were rewritten in operator-facing Korean; capability semantics are unchanged.

## Unchanged contracts

- Supabase schema/migrations: unchanged (`0021/0022/0023` remain current).
- R2 object authority and multipart/checksum/idempotency: unchanged.
- RBAC/capability semantics: unchanged.
- Request/item snapshot/version/review/manifest/OPS contracts: unchanged.
- Production/main/live mutation: 0.
- Production Supabase/R2 mutation: 0.
- Drive hot-path dual-write: 0.
- Credential mutation/access: 0.

Batch 1 deployment checkpoint: `69d78f5258df6e221cefb7a4b52723a0d3f6252a` — Cloudflare Pages SUCCESS, atomic Preview `https://265aa4a1.code1-workspace.pages.dev`.

Batch 2 pre-smoke checkpoint: `691588838dec7d4c07d0be5ad3d45e9d9b660c5c` — isolated-node-checks SUCCESS and Cloudflare Pages SUCCESS, atomic Preview `https://d7f4692c.code1-workspace.pages.dev`.

This docs-only update triggers the credential-free stable Preview smoke and must not redeploy application code.
