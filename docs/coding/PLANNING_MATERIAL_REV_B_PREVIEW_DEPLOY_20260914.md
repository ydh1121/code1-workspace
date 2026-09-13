# CODE1 Planning Material REV B Preview Deploy — 2026-09-14

Scope: WO-20260913-CODING-MATERIAL-INGEST-001 REV B / Planning Delta 20260913-041 / STAGING ONLY.

This marker intentionally triggers one Cloudflare Pages Preview deployment after the Planning Material REV B source, database acceptance, security boundary, and build reached a green predeploy checkpoint.

Included contract:
- additive Planning Material domain, separate from farm intake/questionnaire business tables
- exact internal menu label `상세페이지 및 제안서 파일`, inserted between `기획문서` and `해야 할 일`
- exact seven authoritative default upload items
- revisioned template catalog with add/rename/reorder/required/archive and immutable historic request snapshots
- explicit PARTNER/assigned-uploader least-privilege access
- Supabase STAGING authority with browser roles denied direct table/RPC access
- private R2 object namespace, resumable multipart upload, SHA-256, extension/MIME allowlist, and magic-signature validation
- deterministic private Planning manifest with audit + deduplicated `PLANNING_IMPACT` outbox event
- no Google Drive hot-path dual-write and no farm intake primary-model reuse

Applied STAGING migrations and acceptance:
- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`
- synthetic acceptance residue read-back: 0 across QA accounts/templates/requests/media/ops events

Predeploy verification:
- isolated staging CI: SUCCESS
- staging/contract tests: 175/175 PASS
- locked npm audit: 0 vulnerabilities
- root baseline comparator: only 5 known pre-existing failures; no new regression
- build: PASS
- Production/main/live/credential mutation: 0

Authenticated OWNER/PARTNER visual-click QA is not claimed by this marker. It remains a separate post-deploy user-session gate if Planning requires it.
