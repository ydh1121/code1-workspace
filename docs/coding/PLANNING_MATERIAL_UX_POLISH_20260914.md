# CODE1 Planning Material UX Polish — STAGING Preview Marker

Date: 2026-09-14 KST
Authority: `MSG-20260914-0094 / AUTH_BROWSER_QA_CONTINUATION`
Scope: bounded authenticated-browser QA defect correction only
Environment: STAGING ONLY

## Changed frontend surfaces

- Planning Material request list changed from collapsing tile cards to full-width operational rows.
- Generic farm/account KPI summary is hidden while the Planning Material tab is active and replaced with material-request summary metrics.
- Request detail items use compact accordion disclosure with submission/review/file-count summaries.
- File selection adds clear selected-file feedback and drag/drop affordance while retaining the existing private-R2 upload RPC contract.
- Upload item manager uses a wider no-horizontal-scroll layout, human-readable classification labels, order move controls, and sticky save/cancel actions.
- Explicit 390px responsive no-horizontal-overflow contract retained.

## Unchanged contracts

- Supabase schema/migrations: unchanged (`0021/0022/0023` remain current).
- R2 object authority and multipart/checksum/idempotency: unchanged.
- RBAC/PARTNER assigned-request access: unchanged.
- Request/item snapshot/version/review/manifest/OPS contracts: unchanged.
- Production/main/live mutation: 0.
- Production Supabase/R2 mutation: 0.
- Drive hot-path dual-write: 0.
- Credential mutation/access: 0.

Pre-deploy regression checkpoint: `70900c7e81ec4d798bed2dd22002378cc2790b31` — isolated-node-checks SUCCESS.

Deployment checkpoint: `69d78f5258df6e221cefb7a4b52723a0d3f6252a` — Cloudflare Pages SUCCESS, atomic Preview `https://265aa4a1.code1-workspace.pages.dev`.

This docs-only update triggers the credential-free stable Preview smoke and must not redeploy application code.
