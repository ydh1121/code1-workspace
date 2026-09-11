# CODE1 CODING CURRENT

Updated: 2026-09-12 04:07 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ORIGIN PASS / PREVIEW CORE ENV INVENTORY PASS / CONTROLLED PREVIEW DEPLOY NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0019

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credentials.
- Production variables/secrets/bindings remain READ_ONLY and must not be copied into Preview by assumption.
- No secret value may be committed to Git, Message Bus, or chat.

## Durable staging state

Supabase STAGING target ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE and must not be rerun. Verified counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; private Drive originals remain preserved and no legacy R2 migration has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied and verified.

R2 `code1-staging-media` remains APAC / Standard, 0 objects / 0 B, `r2.dev` disabled, no custom domain, no lock rule, default multipart abort after 7 days. CORS configuration remains absent / API code 10059. No R2 object write has occurred.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. External R2 integration remains NOT RUN.

## Pages isolation gates: PASS

Saved/reopened Cloudflare Dashboard state:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

`exposureGate = PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`.

Preview binding remains:

```text
CODE1_MEDIA_BUCKET -> code1-staging-media
```

Production R2 binding remains NONE.

## Stable Preview origin: PASS

Grounded successful Preview deployment:

```text
commit = 0920bfa
deploymentId = bea5991d-0e6d-464d-bea9-7d695ec8b46d
atomicDeploymentUrl = https://bea5991d.code1-workspace.pages.dev
branchAlias = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

Runtime same-origin value is therefore:

`APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

No trailing slash. Do not use the atomic hash deployment URL as APP_ORIGIN.

## Preview core runtime inventory: PASS

Operator screenshot after provisioning verified exactly these 9 names in Cloudflare Pages Preview `Variables and secrets`:

```text
APP_ORIGIN
CODE1_LOGIN_IP_SECRET
CODE1_MEDIA_TOKEN_SECRET
CODE1_RUNTIME_BACKEND
CODE1_STAGING_PROJECT_REF
CODE1_SUPABASE_SERVICE_ROLE_KEY
CODE1_SUPABASE_URL
CODE1_UPLOAD_TOKEN_SECRET
SESSION_SECRET
```

The Cloudflare Pages UI available to the operator stored all nine entries as encrypted `Secret` values and did not offer conversion of the non-sensitive four to plaintext. This is accepted. Pages secrets are still exposed to Pages Functions through the same runtime environment binding (`context.env`); encryption only changes dashboard visibility/storage semantics.

Therefore the effective approved values remain:

```text
APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev
CODE1_RUNTIME_BACKEND=SUPABASE_STAGING
CODE1_STAGING_PROJECT_REF=bsintmkyhptizrjoizfb
CODE1_SUPABASE_URL=https://bsintmkyhptizrjoizfb.supabase.co
CODE1_SUPABASE_SERVICE_ROLE_KEY=<CODE1 STAGING service-role only>
SESSION_SECRET=<staging-only 32+ chars>
CODE1_LOGIN_IP_SECRET=<staging-only 32+ chars>
CODE1_UPLOAD_TOKEN_SECRET=<staging-only 32+ chars>
CODE1_MEDIA_TOKEN_SECRET=<staging-only 32+ chars>
```

No secret value is recorded here.

Existing R2 binding is separate and remains `CODE1_MEDIA_BUCKET -> code1-staging-media`; no duplicate text variable exists.

Deferred compatibility remains unchanged:

- `PASSWORD_PEPPER`: not provisioned; do not randomly replace while imported password hashes must remain valid.
- Google OAuth variables: not provisioned.
- `BRIDGE_URL/BRIDGE_SECRET`: not provisioned; no Production/live compatibility secret copy.

## Runtime state before controlled redeploy

The saved Preview environment now contains the approved nine-name core configuration, but the currently served successful Preview deployment predates these saved values. Therefore runtime activation is not yet verified until one fresh Preview deployment completes.

Previous read-only probe remains historical only: root 200, session configured=false, unauth RPC 400, media route 404, object write NONE.

## Cross-track sync

- `MSG-20260912-0016`: CODING -> PLANNING APPLIED.
- `MSG-20260912-0017`: PLANNING -> UIUX, unrelated to CODING.
- `MSG-20260912-0018`: CODING -> PLANNING SUPERSEDED by 0019.
- `MSG-20260912-0019`: CODING -> PLANNING PENDING, Preview origin PASS + core provisioning contract.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

Trigger exactly one fresh Preview deployment from `coding/runtime-backend-staging` after the saved nine-name inventory PASS.

Controlled procedure:

1. This CURRENT correction commit is `[CF-Pages-Skip]` and must not deploy.
2. Make exactly one subsequent non-skip documentation checkpoint commit on `coding/runtime-backend-staging`; no runtime code change is needed.
3. Confirm Cloudflare creates exactly one successful Preview deployment for that new commit and branch alias remains `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`.
4. Do not retry/rollback/promote or create a second deployment.
5. After success, run the repository read-only HTTP verifier against the branch alias.
6. Only after read-only HTTP PASS may actual R2 single/multipart/HEAD/DB/private-GET/denial/retry integration tests write staging objects.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: wait for runnable R2-backed staging
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
