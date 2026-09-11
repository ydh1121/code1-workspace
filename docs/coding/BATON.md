# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0016

LAST_VERIFIED_ACTION: operator pulled through `abcd5ea089a8717c20ed536df9f7d691db514d1d` and reran the canonical Cloudflare/R2 read-only audit successfully. Preview deployment observation is only `coding/runtime-backend-staging` (25/25 observed) with no unexpected branches; Production observation is only `main` (25/25 observed). Preview R2 binding `CODE1_MEDIA_BUCKET -> code1-staging-media` remains VERIFIED, Production R2 binding remains NONE, R2 remains private/empty, and remote mutation remained NONE. The canonical runner now reaches `MANUAL_DASHBOARD_VERIFICATION_REQUIRED` without any `workers-auth` resolution/import error, proving the unsupported private Wrangler auth dependency is removed from the operator path.

CURRENT_WORK: close the configured Cloudflare Pages Preview branch-control gate in Dashboard before placing any Supabase service-role or other staging-only runtime secret into the project-wide Pages Preview environment.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- CODE1 Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- no main/history rewrite/force push
- no Public Frontend / formal Admin / Planning SSOT / UIUX SSOT mutation
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy Drive-media auto migration/deletion
- no Preview runtime/service-role secret provisioning until branch-control gate PASS

## Durable database/import state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain: accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

All imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`. Private Drive originals remain preserved; no legacy object copy has occurred.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied and verified. Security Advisor WARN 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes.

## R2 / upload runtime state

Bucket `code1-staging-media`: APAC / Standard, 0 objects / 0 B, r2.dev disabled, custom domain none, CORS config absent / code 10059, lock rules none, default multipart abort after 7 days. No actual R2 object write has been run yet.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. Implemented: 6 MiB multipart, begin request idempotency, chunk retry verification, finish retry/object-exists recovery, atomic finalization, small-PUT orphan compensation, exact HEAD size/MIME verification.

External R2 integration/browser PASS: NOT YET RUN.

## Pages binding/runtime state

Preview-only R2 config deployment commit `0920bfa49afa3a55355b91fc7fe98890d2f59916`; GitHub Actions `34515272730` SUCCESS and Cloudflare Pages Preview deployment SUCCESS. Production was not deployed.

Remote canonical config semantics verify:

- Preview `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE

Read-only Preview probe still represents current runtime state: root 200, session `configured=false`, unauth RPC 400, media route 404, object write NONE. `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and required Preview vars/secrets are not yet provisioned.

Staging login uses `CODE1_LOGIN_IP_SECRET`; do not reuse live Apps Script `BRIDGE_SECRET`.

## Current security gate

Recent deployment observation and canonical runner rerun are PASS:

- Preview 25 observed deployments: only `coding/runtime-backend-staging`
- unexpected Preview branches: none
- Production 25 observed deployments: only `main`
- Preview R2 binding: VERIFIED
- Production R2 binding: NONE
- R2 object count / size: 0 / 0 B
- canonical audit result: `MANUAL_DASHBOARD_VERIFICATION_REQUIRED`
- private `workers-auth` error: NONE
- remote mutation: NONE

Configured branch-control verification remains OPEN. Supported Wrangler Pages list/download commands do not expose configured source branch include/exclude controls. Private Wrangler OAuth/module import workarounds are retired because they depend on non-contractual installation internals.

Canonical audit runner commit `deb68234965cc38b404c2b08e5204896f742695d` is read-only and explicitly fails closed on manual Dashboard verification. CI `34627805003` SUCCESS. No Pages deployment, secret mutation, or R2 object mutation occurred from that commit.

Required Cloudflare Dashboard values:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

If any value differs, stop before secrets. Do not infer this configuration from deployment history alone.

## Cross-track sync

- MSG-0009: APPLIED
- MSG-0011: APPLIED
- MSG-0015: SUPERSEDED
- MSG-0016: PENDING outbound to Planning
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

Open Cloudflare Dashboard for Pages project `code1-workspace` and inspect branch controls only. Do not change secrets or environment variables.

Required UI state:

```text
Production branch = main
Preview branch = Custom branches
Include Preview branches = coding/runtime-backend-staging
Exclude Preview branches = empty
```

If any value differs, stop before secret provisioning. Correct only branch-control configuration and report the resulting values.

Do not rerun the Preview HTTP verifier yet. After explicit branch-control PASS, provision Preview-only Supabase/runtime vars and newly generated staging-only secrets, intentionally deploy one Preview, rerun read-only HTTP probes, then perform actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
