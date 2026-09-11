# CODE1 CODING BATON

Updated: 2026-09-12 03:40 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0018

LAST_VERIFIED_ACTION: Cloudflare Pages Preview origin gate is PASS. Successful Preview deployment for branch exactly `coding/runtime-backend-staging` was grounded at commit `0920bfa`, atomic URL `https://bea5991d.code1-workspace.pages.dev`, with stable branch alias `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`. Preview branch-control exact PASS and empty runtime inventory + verified R2 binding remain unchanged. No variable/secret/object/Production mutation occurred.

CURRENT_WORK: provision the minimum approved Cloudflare Pages **Preview-only** Supabase STAGING/runtime configuration, then re-open inventory before triggering any deployment.

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
- all new runtime secrets are staging-only and must never be committed to Git/Bus/chat

## Durable state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy copy has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media`: APAC / Standard, 0 objects / 0 B, r2.dev disabled, no custom domain, no lock rule, default 7-day multipart abort, CORS config absent/code 10059. No actual object write has run.

Upload hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. External R2 integration/browser PASS remains NOT YET RUN.

## Pages state

- Preview branch control: `PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`
- Preview branch: only `coding/runtime-backend-staging`
- Production branch observed: only `main`
- Preview vars/secrets: NONE before provisioning
- Preview R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE
- Preview runtime `SUPABASE_STAGING`: NOT_CONFIGURED
- previous read-only probe: root 200, session configured=false, unauth RPC 400, media route 404, object write NONE

## Stable Preview origin: PASS

Grounded successful deployment:

```text
commit = 0920bfa
deploymentId = bea5991d-0e6d-464d-bea9-7d695ec8b46d
atomicDeploymentUrl = https://bea5991d.code1-workspace.pages.dev
branchAlias = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

Use branch alias as stable runtime origin:

`APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

No trailing slash. The hash deployment URL is atomic and must not be used as APP_ORIGIN.

## Approved core Preview configuration

Plain/runtime values:

```text
APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev
CODE1_RUNTIME_BACKEND=SUPABASE_STAGING
CODE1_STAGING_PROJECT_REF=bsintmkyhptizrjoizfb
CODE1_SUPABASE_URL=https://bsintmkyhptizrjoizfb.supabase.co
```

Server-only encrypted Secrets:

```text
CODE1_SUPABASE_SERVICE_ROLE_KEY=<CODE1 STAGING service-role only>
SESSION_SECRET=<new staging-only 32+ chars>
CODE1_LOGIN_IP_SECRET=<new staging-only 32+ chars>
CODE1_UPLOAD_TOKEN_SECRET=<new staging-only 32+ chars>
CODE1_MEDIA_TOKEN_SECRET=<new staging-only 32+ chars>
```

Existing binding remains `CODE1_MEDIA_BUCKET -> code1-staging-media`; do not add a duplicate text variable.

Deferred in this first core pass:

- `PASSWORD_PEPPER`: do not randomly replace; imported password hashes depend on the correct existing pepper.
- Google OAuth variables: defer until OWNER Google recovery is explicitly enabled in Preview.
- `BRIDGE_URL/BRIDGE_SECRET`: defer; do not copy Production/live compatibility secrets by assumption.

## Cross-track sync

- MSG-0016: CODING -> PLANNING APPLIED.
- MSG-0017: PLANNING -> UIUX, unrelated to CODING.
- MSG-0018: CODING -> PLANNING PENDING, branch-control + Preview inventory evidence.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

Cloudflare Pages `code1-workspace -> Settings`, with `Choose Environment = Preview`:

1. Add the four plain/runtime values exactly as above.
2. Add the five server-only values as encrypted Secrets. Generate the four staging-local HMAC/token values as new 32+ character secrets locally; do not expose them in chat.
3. Obtain `CODE1_SUPABASE_SERVICE_ROLE_KEY` only from the CODE1 STAGING Supabase project.
4. Do not add PASSWORD_PEPPER, Google OAuth, or legacy bridge values yet.
5. Save all entries, then re-open Preview `Variables and secrets` and capture names/types only.
6. Do not manually deploy until inventory matches the approved nine-name set.

After exact inventory PASS, intentionally trigger one Preview deployment, run the read-only HTTP verifier, then only after PASS run actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy objects and Production has no R2 binding.
