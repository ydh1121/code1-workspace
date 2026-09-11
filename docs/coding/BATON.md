# CODE1 CODING BATON

Updated: 2026-09-12 03:24 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0018

LAST_VERIFIED_ACTION: Cloudflare Pages Preview environment inventory is complete. Preview `Variables and secrets` is empty. The only Preview binding is R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`. Placement is Default and Compatibility date is 2026-09-01. The configured branch-control gate remains exact PASS: Production `main`; Preview Custom branches; include only `coding/runtime-backend-staging`; exclude empty. No variable/secret/object/Production mutation occurred.

CURRENT_WORK: verify the exact stable Pages Preview origin for `coding/runtime-backend-staging` before provisioning any Preview runtime value or secret.

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
- do not provision Preview variables/secrets before exact Preview origin verification

## Durable state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy copy has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media`: APAC / Standard, 0 objects / 0 B, r2.dev disabled, no custom domain, no lock rule, default 7-day multipart abort, CORS config absent/code 10059. No actual object write has run.

Upload hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. External R2 integration/browser PASS remains NOT YET RUN.

## Pages state

- Preview branch control: `PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`
- Preview recent deployments observed: only `coding/runtime-backend-staging`
- Production recent deployments observed: only `main`
- Preview vars/secrets: NONE
- Preview R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE
- Preview runtime `SUPABASE_STAGING`: NOT_CONFIGURED
- previous read-only runtime probe: root 200, session configured=false, unauth RPC 400, media route 404, object write NONE

## Exact core Preview configuration after origin gate

Text/runtime values:

```text
APP_ORIGIN=<exact stable Preview origin; no trailing slash>
CODE1_RUNTIME_BACKEND=SUPABASE_STAGING
CODE1_STAGING_PROJECT_REF=bsintmkyhptizrjoizfb
CODE1_SUPABASE_URL=https://bsintmkyhptizrjoizfb.supabase.co
```

Server-only secrets:

```text
CODE1_SUPABASE_SERVICE_ROLE_KEY=<CODE1 STAGING service-role only>
SESSION_SECRET=<new staging-only 32+ chars>
CODE1_LOGIN_IP_SECRET=<new staging-only 32+ chars>
CODE1_UPLOAD_TOKEN_SECRET=<new staging-only 32+ chars>
CODE1_MEDIA_TOKEN_SECRET=<new staging-only 32+ chars>
```

Existing binding remains `CODE1_MEDIA_BUCKET -> code1-staging-media`; it is not a text secret.

Deferred compatibility:

- `PASSWORD_PEPPER`: do not create a random replacement if imported ID/password credentials must remain valid. Password hashes depend on the existing pepper; preserve it or use an approved staging reset path.
- Google OAuth vars: defer until OWNER Google recovery is explicitly enabled in Preview.
- `BRIDGE_URL/BRIDGE_SECRET`: defer; current staging routing uses legacy bridge only for deck/DECK fallback. Do not copy Production/live bridge secrets by assumption.

## Cross-track sync correction

A prior CODING harness update incorrectly reused global Bus ID `MSG-20260912-0017`. Bus readback shows:

- `MSG-20260912-0016`: CODING -> PLANNING, APPLIED at 2026-09-12 02:58.
- `MSG-20260912-0017`: PLANNING -> UIUX, PENDING long-form Work Order; unrelated to CODING.
- erroneous CODING STATUS_EVENTS for 0016/0017 are corrected append-only rather than deleted.
- `MSG-20260912-0018`: CODING -> PLANNING PENDING evidence for branch-control exact PASS + Preview environment inventory PASS + Preview-origin next gate.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

Cloudflare Pages `code1-workspace -> Deployments`:

1. Find the latest successful **Preview** deployment for branch exactly `coding/runtime-backend-staging`.
2. Open it and capture the displayed deployment URL / branch alias / environment identifier.
3. Do not Retry, Rollback, Promote, or trigger a deployment.
4. Do not add/edit/reveal Preview variables or secrets yet.
5. Do not guess `APP_ORIGIN` from the branch name.

After exact Preview origin is grounded, provision the minimum core Preview values/secrets above, intentionally deploy one Preview, run the read-only HTTP verifier, and only after PASS run actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 has no migrated legacy objects and Production has no R2 binding.
