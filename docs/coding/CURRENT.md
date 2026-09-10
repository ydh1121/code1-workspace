# CODE1 CODING CURRENT

Updated: 2026-09-11 04:17 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / PREVIEW DEPLOYMENT BRANCH OBSERVATION NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0014

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, or IndiaDesk resources.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive runtime remains rollback/live source until a separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate or delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, no `r2.dev`, no custom R2 domain, and no browser-visible service-role/R2 credentials.

## Durable Supabase STAGING state

Target ref: `bsintmkyhptizrjoizfb` only.

FIRST_IMPORT remains complete. Verified durable counts: accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media assets 4, media events 5, audit log 29, login guard 3, housing records 12, migration registry 268. Planning/question policy placeholder rows remain 0 as previously verified.

All four imported media rows remain `GOOGLE_DRIVE_LEGACY`, `object_key = NULL`, `status = DELETED`. Their private Drive originals remain preserved in `CODE1_SOURCE_MEDIA_MANIFEST_20260911`; no legacy object copy has occurred.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied. Readback previously verified four upload-state columns, actor+request partial unique idempotency index, and service-role-only register/finalize RPCs. Security Advisor WARN remains 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes; no workload-free index cleanup is authorized.

## R2 resource state

Bucket: `code1-staging-media`.

Verified: APAC / Standard, 0 objects / 0 B at latest operator audit, `r2.dev` disabled, no custom domain, no lock rule, default incomplete multipart abort after 7 days. CORS configuration does not exist / Cloudflare API code 10059; no CORS policy is required for the current server-side Pages Function binding architecture.

No R2 object mutation has occurred yet.

## Media runtime hardening

Commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS.

Implemented and tested: `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish`, 6 MiB multipart chunks, actor+request begin idempotency, chunk retry validation, finish retry/object-exists recovery, atomic final status/event transition, small PUT DB failure compensation delete, and final R2 HEAD size/MIME verification.

Actual external single/multipart object integration is still NOT RUN.

## Pages Preview R2 binding: VERIFIED PREVIEW-ONLY

Repository config introduced the binding in commit `0920bfa49afa3a55355b91fc7fe98890d2f59916` under `[[env.preview.r2_buckets]]`, while `[env.production]` contains no R2 binding. The intentional Preview deployment succeeded; GitHub Actions `34515272730` and the Cloudflare Pages check both passed. Production was not deployed.

Latest operator canonical download returned top-level `[[r2_buckets]] CODE1_MEDIA_BUCKET -> code1-staging-media` plus empty `[env.production]`.

Wrangler's actual `pages download config` implementation fetches both `deployment_configs.preview` and `.production`, uses Preview as top-level unless a named `env.preview` must be emitted, and writes Production under `env.production`. R2 bindings are non-inheritable. Therefore:

- Preview `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE

The earlier three-way `pages download config --env ...` attempt was not a valid environment discriminator. That command does not select one Pages environment that way.

## Preview runtime probe: NOT_CONFIGURED

Read-only probe against the stable branch Preview returned root 200, `/api/session` with `configured=false`, unauthenticated bootstrap RPC 400, and `/api/staging/media-get` 404. Object writes remained none.

This proves the Preview deployment currently has the R2 binding but has not yet been configured for `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and its required runtime secrets/vars.

## Staging auth secret separation

Commit `92f19361d7f028005024c5062f918078b6e70329`, CI `34517035790` SUCCESS.

Preview Supabase staging no longer needs Apps Script `BRIDGE_SECRET` for login IP hashing. Staging uses `CODE1_LOGIN_IP_SECRET`; legacy Apps Script mode retains `BRIDGE_URL/BRIDGE_SECRET`. Do not inject or reuse Production/live bridge secrets for staging.

## Preview deployment exposure audit

Cloudflare Pages Preview vars/secrets apply to Preview deployments project-wide, not per branch. The repository still contains additional stale/temporary branches, so project-wide Preview service-role/runtime secrets must not be provisioned until exposure is reviewed.

The first exposure runner version incorrectly parsed `pages deployment list --json` as raw API rows. Wrangler 4.129.0 actually emits flattened display objects with `Id`, `Environment`, `Branch`, `Source`, `Deployment`, `Status`, and `Build`; that is why the operator saw `deploymentCount=25` but `observedBranches=[]`.

Parser commit `7df5d597d9aed3aec67d1b0df5edaa04bbe3ade1` now reads the real flattened `Branch` / `Environment` keys, retains a raw-row fallback, and marks any non-`coding/runtime-backend-staging` Preview branch as blocked evidence. CI `34519391147` SUCCESS; `[CF-Pages-Skip]` prevented a new Pages deployment.

Important limitation: Wrangler's safe `pages project list --json` and `pages deployment list --json` do not expose configured `preview_branch_includes` / `preview_branch_excludes`. The runner therefore reports configured branch filters as `UNAVAILABLE_VIA_SAFE_WRANGLER_CLI` rather than inventing values. Wrangler debug logging is deliberately not used because the full project debug object may contain environment metadata.

## Cross-track sync

- `MSG-20260911-0009` Planning Delta003: APPLIED
- `MSG-20260911-0011` prior R2 deployment evidence: APPLIED by Planning
- `MSG-20260911-0014` current CODING -> PLANNING implementation evidence: PENDING at last read
- current CODING inbound at last read: 0

## Next atomic action

On the operator PC:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media
```

Required next evidence:

- `PAGES_PREVIEW_R2_BINDINGS_INTERPRETED` = `CODE1_MEDIA_BUCKET / code1-staging-media`
- `PAGES_PRODUCTION_R2_BINDINGS_INTERPRETED` = `NONE_FOUND`
- `PAGES_PREVIEW_DEPLOYMENT_EXPOSURE.observedBranches` contains the actual recent Preview branch names
- `unexpectedPreviewBranches` must be reviewed before any Preview secret provisioning
- `configuredBranchFilter` is expected to remain `UNAVAILABLE_VIA_SAFE_WRANGLER_CLI`

Do not rerun the Preview HTTP verifier yet; runtime env has not changed. Do not add Preview service-role/session/media/upload/login secrets until observed branch exposure is known and the configured branch-filter gap is resolved manually or by another safe authenticated read path.

After that gate, configure Preview-only Supabase staging vars/secrets, deploy one Preview intentionally, rerun the read-only HTTP verifier, and only after PASS run real R2 single/multipart integration tests.

## Other open items

- npm audit report: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: no baseline until runnable R2-backed staging exists
- Apps Script Drive root location: reconciled `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy media and Production has no R2 binding.
