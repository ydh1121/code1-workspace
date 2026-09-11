# CODE1 CODING CURRENT

Updated: 2026-09-12 03:40 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ENV INVENTORY PASS / PREVIEW ORIGIN PASS / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / CORE PREVIEW CONFIGURATION NEXT
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
- Any new runtime secret must be staging-only and must never be committed to Git or the Message Bus.

## Durable staging state

Supabase STAGING target ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE and must not be rerun. Verified counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

All imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; private Drive originals remain preserved and no legacy R2 migration has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied and verified.

Bucket `code1-staging-media` remains APAC / Standard, 0 objects / 0 B, `r2.dev` disabled, no custom domain, no lock rule, default multipart abort after 7 days. CORS configuration is absent / API code 10059. No R2 object write has occurred.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. Begin/chunk/finish, 6 MiB multipart, idempotency/retry/finalize, orphan compensation, and HEAD size/MIME verification are implemented. External R2 integration is still NOT RUN.

## Pages branch-control gate: PASS

Saved/reopened Cloudflare Dashboard state:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

`exposureGate = PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`

Recent deployment observation also remains consistent: Preview 25/25 observed deployments were only `coding/runtime-backend-staging`; Production 25/25 were only `main`; unexpected Preview branches were none.

## Preview environment inventory: PASS

Cloudflare Pages `code1-workspace -> Settings -> Preview` verified:

```text
Variables and secrets = NONE
Bindings = 1
CODE1_MEDIA_BUCKET -> code1-staging-media (R2 bucket)
Placement = Default
Compatibility date = 2026-09-01
```

`previewEnvInventory = PASS_EMPTY_RUNTIME_VARS_WITH_R2_BINDING`.

No Preview variable/secret was added, edited, revealed, or deleted. No Production setting/binding was changed. No R2 object write occurred.

## Preview origin gate: PASS

Operator deployment-history screenshots and a successful Preview deployment detail verified the branch exactly as `coding/runtime-backend-staging` and the latest grounded successful deployment as:

```text
commit = 0920bfa
status = success
deploymentId = bea5991d-0e6d-464d-bea9-7d695ec8b46d
atomicDeploymentUrl = https://bea5991d.code1-workspace.pages.dev
branchAlias = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

Cloudflare Pages branch aliases track the latest successful deployment for the branch, whereas the hash deployment URL is atomic. Therefore the stable Preview origin for runtime same-origin checks is:

`APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

No trailing slash. Do not use the hash deployment URL as APP_ORIGIN.

## Preview runtime state

Preview runtime remains NOT_CONFIGURED for `SUPABASE_STAGING`; the previous read-only probe still represents runtime state: root 200, session `configured=false`, unauth RPC 400, media route 404, object write NONE.

Repository `configured(env)` requires a valid `APP_ORIGIN`, a 32+ character `SESSION_SECRET`, and in `SUPABASE_STAGING` mode a 32+ character `CODE1_LOGIN_IP_SECRET` before the app reports configured. Full staging RPC/media operation additionally requires the staging Supabase and token secrets.

Supabase STAGING project URL was re-read as:

`https://bsintmkyhptizrjoizfb.supabase.co`

## Approved core Preview configuration

Plain/runtime values:

```text
APP_ORIGIN=https://coding-runtime-backend-stagi.code1-workspace.pages.dev
CODE1_RUNTIME_BACKEND=SUPABASE_STAGING
CODE1_STAGING_PROJECT_REF=bsintmkyhptizrjoizfb
CODE1_SUPABASE_URL=https://bsintmkyhptizrjoizfb.supabase.co
```

Server-only secrets:

```text
CODE1_SUPABASE_SERVICE_ROLE_KEY=<CODE1 STAGING service-role credential only>
SESSION_SECRET=<new staging-only 32+ chars>
CODE1_LOGIN_IP_SECRET=<new staging-only 32+ chars>
CODE1_UPLOAD_TOKEN_SECRET=<new staging-only 32+ chars>
CODE1_MEDIA_TOKEN_SECRET=<new staging-only 32+ chars>
```

Existing binding remains `CODE1_MEDIA_BUCKET -> code1-staging-media`; do not create a duplicate text variable.

Deferred compatibility:

- `PASSWORD_PEPPER`: do not create a random replacement if imported ID/password credentials must remain valid. Password hashes depend on the existing pepper; preserve it or use an approved staging reset path.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: defer until OWNER Google recovery is explicitly enabled in Preview.
- `BRIDGE_URL` / `BRIDGE_SECRET`: defer; current staging routing only needs the legacy bridge for compatibility fallback paths. Do not copy Production/live values by assumption.

No secret value is committed to Git or written to the Message Bus.

## Cross-track sync

- `MSG-20260912-0016`: CODING -> PLANNING, APPLIED at 2026-09-12 02:58.
- `MSG-20260912-0017`: PLANNING -> UIUX, unrelated to CODING.
- `MSG-20260912-0018`: CODING -> PLANNING, SUPERSEDED by 0019 after stable origin grounding.
- `MSG-20260912-0019`: CODING -> PLANNING PENDING evidence for Preview origin PASS + approved core Preview runtime provisioning set.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

Provision only the approved **Preview** runtime set in Cloudflare Pages; Production must remain untouched:

1. Keep `Choose Environment = Preview`.
2. Add the four plain/runtime values exactly as listed above.
3. Add the five server-only values as encrypted Secrets. The four staging-local HMAC/token secrets must be newly generated 32+ character values; do not paste them into chat or commit them anywhere.
4. `CODE1_SUPABASE_SERVICE_ROLE_KEY` must be the CODE1 STAGING project service-role credential only.
5. Do not add PASSWORD_PEPPER, Google OAuth, or legacy BRIDGE settings in this first core pass.
6. Do not deploy manually until all nine entries are saved and the Preview inventory is re-opened to confirm only the intended names/types are present.

After the Preview runtime inventory matches the approved set, intentionally trigger exactly one Preview deployment, run the read-only HTTP verifier, and only after PASS run actual R2 single/multipart/HEAD/DB/private-GET/denial/retry integration tests.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: wait for runnable R2-backed staging
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
