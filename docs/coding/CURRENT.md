# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / PREVIEW BRANCH OBSERVATION PASS / CONFIGURED BRANCH FILTER MANUAL GATE OPEN
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0016

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive runtime remains rollback/live source until a separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible service-role/R2 credentials.
- Do not place staging runtime/service-role secrets into Cloudflare Pages Preview until the configured Preview branch filter is explicitly verified.

## Durable Supabase STAGING state

Target ref: `bsintmkyhptizrjoizfb` only.

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Verified counts remain: accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media assets 4, media events 5, audit log 29, login guard 3, housing records 12, migration registry 268. Planning/question policy placeholder rows remain 0.

All four imported media rows remain `GOOGLE_DRIVE_LEGACY`, `object_key = NULL`, `status = DELETED`. Private Drive originals remain preserved in `CODE1_SOURCE_MEDIA_MANIFEST_20260911`; no legacy object copy has occurred.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied and verified. Service-role-only register/finalize RPCs remain in place. Security Advisor WARN remains 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes; no workload-free index cleanup is authorized.

## R2 resource state

Bucket: `code1-staging-media`.

Latest operator read-only audit verified APAC / Standard, 0 objects / 0 B, `r2.dev` disabled, no custom domain, no lock rule, and default incomplete multipart abort after 7 days. CORS configuration is absent / Cloudflare API code 10059; no browser CORS policy is required for the current server-side Pages Function binding architecture.

No R2 object mutation has occurred yet.

## Media runtime hardening

Commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS.

Implemented and tested: `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish`, 6 MiB multipart chunks, actor+request begin idempotency, chunk retry validation, finish retry/object-exists recovery, atomic final status/event transition, small PUT DB-failure compensation delete, and final R2 HEAD size/MIME verification.

Actual external single/multipart object integration is still NOT RUN.

## Pages Preview R2 binding: VERIFIED PREVIEW-ONLY

Repository config declares only Preview binding `CODE1_MEDIA_BUCKET -> code1-staging-media`; `[env.production]` has no R2 binding. Intentional Preview deployment commit `0920bfa49afa3a55355b91fc7fe98890d2f59916` succeeded; GitHub Actions `34515272730` and the Cloudflare Pages Preview deployment both passed. Production was not deployed.

Latest remote canonical config readback continues to prove:

- Preview `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE

Wrangler `pages download config` fetches both deployment configs, canonicalizes Preview at top-level unless `env.preview` is needed, and writes Production under `env.production`; R2 bindings are non-inheritable.

## Preview runtime state: NOT_CONFIGURED

Latest read-only Preview probe before this gate returned root 200, `/api/session` with `configured=false`, unauthenticated bootstrap RPC 400, and `/api/staging/media-get` 404. Object writes remained none.

Therefore the Preview deployment has the R2 binding but still does not have `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and required staging runtime vars/secrets.

Staging login IP HMAC uses `CODE1_LOGIN_IP_SECRET`; staging does not reuse Apps Script `BRIDGE_SECRET`. Legacy Apps Script mode retains its existing `BRIDGE_URL/BRIDGE_SECRET`. Production/live bridge secrets must not be injected into staging.

## Pages Preview branch-exposure gate

Operator audit on 2026-09-12 produced:

- Preview deploymentCount: 25
- Preview observedBranches: only `coding/runtime-backend-staging`
- Preview unexpectedPreviewBranches: `[]`
- Production deploymentCount: 25
- Production observedBranches: only `main`
- Preview R2 binding: `CODE1_MEDIA_BUCKET -> code1-staging-media`
- Production R2 binding: NONE
- R2 object count / size: 0 / 0 B
- remote mutation: NONE

This closes the recent-deployment observation portion of the gate.

The operator then pulled through `abcd5ea089a8717c20ed536df9f7d691db514d1d` and reran the canonical read-only audit successfully. The runner reached `PAGES_PROJECT_SOURCE_BRANCH_CONTROLS = MANUAL_DASHBOARD_VERIFICATION_REQUIRED` without any `workers-auth` package-resolution/import error, proving the unsupported private Wrangler auth dependency is fully removed from the operator path.

The configured Project branch filter remains unverified. Supported Wrangler Pages list/download commands do not expose `preview_deployment_setting`, `preview_branch_includes`, or `preview_branch_excludes`. Attempts to reuse/import private Wrangler OAuth internals (`61d467a...`, `bd2bd30...`) proved dependent on package-install layout and are retired; no further private-auth-module workaround is authorized.

Canonical read-only runner commit `deb68234965cc38b404c2b08e5204896f742695d` removes that unsupported dependency and fails closed on an explicit manual Dashboard gate. CI `34627805003` SUCCESS. `[CF-Pages-Skip]` means no Pages deployment was requested by this commit.

Required Dashboard values before any Preview secret provisioning:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

Any mismatch keeps the gate BLOCKED. Observed deployment history alone is not sufficient to infer configured branch controls.

## Cross-track sync

- `MSG-20260911-0009` Planning Delta003: APPLIED
- `MSG-20260911-0011` prior R2 deployment evidence: APPLIED by Planning
- `MSG-20260911-0015` prior branch-exposure/filter evidence: SUPERSEDED
- `MSG-20260912-0016` current CODING -> PLANNING implementation evidence: PENDING
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

1. In Cloudflare Dashboard for Pages project `code1-workspace`, inspect the configured branch controls without changing secrets or environment variables.

Required values:

```text
Production branch = main
Preview branch = Custom branches
Include Preview branches = coding/runtime-backend-staging
Exclude Preview branches = empty
```

2. If any configured value differs, stop before secret provisioning. Correct only the branch-control configuration, then report the resulting values before any runtime secret mutation.

3. Do not rerun `verify-pages-preview-readonly.mjs` yet; runtime env has not changed.

4. Only after the configured branch filter gate is explicitly PASS: provision Preview-only Supabase staging vars and newly generated staging-only secrets, intentionally deploy one Preview, rerun read-only HTTP probes, then perform actual R2 single PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

## Other open items

- npm audit report: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: no baseline until runnable R2-backed staging exists
- Apps Script Drive root location: reconciled `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy media and Production has no R2 binding.
