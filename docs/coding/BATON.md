# CODE1 CODING BATON

Updated: 2026-09-12 04:07 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0019

LAST_VERIFIED_ACTION: Cloudflare Pages Preview core environment inventory is PASS. The operator verified exactly nine intended runtime names and the existing R2 binding. The current Cloudflare Pages UI stored all nine runtime entries as encrypted Secrets; this is accepted because Pages Functions read secrets through the same runtime environment binding as ordinary variables. Preview branch-control exact PASS and stable branch origin PASS remain unchanged. No Production setting or R2 object was mutated.

CURRENT_WORK: this BATON commit intentionally triggers exactly one fresh Preview deployment so the saved Preview environment becomes active; then run the read-only HTTP verifier before any R2 object write.

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
- no secret value in Git/Bus/chat

## Durable state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy copy has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media`: APAC / Standard, 0 objects / 0 B, r2.dev disabled, no custom domain, no lock rule, default 7-day multipart abort, CORS config absent/code 10059. No actual object write has run.

Upload hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. External R2 integration/browser PASS remains NOT YET RUN.

## Pages isolation state

- Preview branch control: `PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`
- Preview include: only `coding/runtime-backend-staging`
- Production branch: `main`
- Preview R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE
- stable Preview alias: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

Grounded prior successful Preview:

```text
commit = 0920bfa
deploymentId = bea5991d-0e6d-464d-bea9-7d695ec8b46d
atomicDeploymentUrl = https://bea5991d.code1-workspace.pages.dev
branchAlias = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

## Preview core environment inventory: PASS

Exactly these nine names are saved in Preview:

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

Current Pages UI stores all nine as encrypted Secret entries; this is accepted. Runtime semantics remain `context.env.<NAME>`.

Expected effective values/roles:

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

No secret values are stored in this document.

Deferred: `PASSWORD_PEPPER`, Google OAuth vars, and `BRIDGE_URL/BRIDGE_SECRET` remain absent.

## Deployment trigger contract

The immediately preceding CURRENT commit `4f87a465212e603d81caf18b4103b0c874cea02c` used `[CF-Pages-Skip]` and must not deploy.

This BATON commit intentionally does **not** use `[CF-Pages-Skip]`; it is the single controlled Preview deployment trigger after environment provisioning. No runtime code change is required because Pages environment bindings are captured by a fresh deployment.

Do not Retry, Rollback, Promote, or manually create another deployment.

## Cross-track sync

- MSG-0016: CODING -> PLANNING APPLIED.
- MSG-0017: PLANNING -> UIUX, unrelated to CODING.
- MSG-0018: CODING -> PLANNING SUPERSEDED by MSG-0019.
- MSG-0019: CODING -> PLANNING PENDING, Preview origin PASS + provisioning contract.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

1. Wait for exactly one Cloudflare Pages Preview deployment for this BATON commit on branch `coding/runtime-backend-staging`.
2. Verify status = success and branch alias remains `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`.
3. Do not trigger another deployment.
4. Run `backend/staging/scripts/verify-pages-preview-readonly.mjs` against the stable branch alias.
5. Required verifier result must prove the freshly deployed Preview is runtime-configured without performing an R2 object write.
6. Only after read-only verifier PASS proceed to actual R2 single/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy objects and Production has no R2 binding.
