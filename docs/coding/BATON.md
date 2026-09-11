# CODE1 CODING BATON

Updated: 2026-09-12 02:51 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0016

LAST_VERIFIED_ACTION: Cloudflare Pages branch-control gate was closed by explicit Dashboard configuration and re-open verification. `Production branch=main`, Preview=`Custom branches`, include exactly `coding/runtime-backend-staging`, exclude empty. The prior policy was `All non-Production branches`; only Branch control was changed. No Preview/Production variable or secret was changed, no R2 object was written, and Production binding/runtime was not mutated.

CURRENT_WORK: inventory the existing Cloudflare Pages Preview environment before adding any Supabase/runtime variable or secret.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- no main/history rewrite/force push
- no Public Frontend / formal Admin / Planning SSOT / UIUX SSOT mutation
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy Drive-media auto migration/deletion
- Production vars/secrets/bindings remain READ_ONLY

## Durable state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy copy has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media`: APAC / Standard, 0 objects / 0 B, r2.dev disabled, no custom domain, no lock rule, default 7-day multipart abort, CORS config absent/code 10059. No actual object write has run.

Upload hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. External R2 integration/browser PASS remains NOT YET RUN.

## Pages state

- Preview R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE
- Preview runtime `SUPABASE_STAGING`: NOT_CONFIGURED
- latest read-only probe: root 200, session configured=false, unauth RPC 400, media route 404, object write NONE

Staging login uses `CODE1_LOGIN_IP_SECRET`; do not reuse live Apps Script `BRIDGE_SECRET`.

## Security gate

Recent deployment observation:

- Preview 25/25 observed: only `coding/runtime-backend-staging`
- unexpected Preview branches: none
- Production 25/25 observed: only `main`

Saved/reopened Dashboard branch control:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

`PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`

The previous configured-branch-filter blocker is CLOSED. This authorizes planning the Preview-only runtime configuration, but does not authorize blind copying of Production secrets or unreviewed mutation.

## Runtime configuration contract

Repository contract includes `APP_ORIGIN`, `SESSION_SECRET`, `CODE1_RUNTIME_BACKEND`, `CODE1_STAGING_PROJECT_REF`, `CODE1_SUPABASE_URL`, `CODE1_SUPABASE_SERVICE_ROLE_KEY`, `CODE1_LOGIN_IP_SECRET`, `CODE1_UPLOAD_TOKEN_SECRET`, `CODE1_MEDIA_TOKEN_SECRET`, plus optional/flow-dependent Google, password, and legacy bridge settings. `CODE1_MEDIA_BUCKET` is an R2 binding, not a text secret.

Do not decide Password/Google/Bridge values until the actual Preview inventory is visible.

## Cross-track sync

- MSG-0009: APPLIED
- MSG-0011: APPLIED
- MSG-0015: SUPERSEDED
- MSG-0016: PENDING outbound, to be superseded by exact branch-control PASS checkpoint
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

Cloudflare Dashboard `code1-workspace -> Settings`:

1. Change `Choose Environment` from **Production** to **Preview**.
2. Read `Variables and secrets` names/types only. Do not add/edit/delete/reveal secret values.
3. Read `Bindings` and confirm `CODE1_MEDIA_BUCKET -> code1-staging-media`; record any additional Preview bindings.
4. Capture Preview origin/deployment identifier if visible.
5. Do not rerun the Preview HTTP verifier yet.

After inventory reconciliation: prepare the minimum exact Preview-only mutation set, then provision approved staging vars/new staging-only secrets, intentionally deploy one Preview, run read-only HTTP verification, and only after PASS run actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy objects and Production has no R2 binding.
