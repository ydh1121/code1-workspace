# CODE1 CODING CURRENT

Updated: 2026-09-12 03:24 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ENV INVENTORY PASS / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / PREVIEW ORIGIN NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0018

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credentials.
- Production variables/secrets/bindings remain READ_ONLY and must not be copied into Preview by assumption.
- Do not add or modify Preview variables/secrets until the exact Preview origin is verified.

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

Operator screenshot of Cloudflare Pages `code1-workspace -> Settings -> Preview` on 2026-09-12 verified:

```text
Variables and secrets = NONE
Bindings = 1
CODE1_MEDIA_BUCKET -> code1-staging-media (R2 bucket)
Placement = Default
Compatibility date = 2026-09-01
```

Therefore `previewEnvInventory = PASS_EMPTY_RUNTIME_VARS_WITH_R2_BINDING`.

No Preview variable/secret was added, edited, revealed, or deleted. No Production setting/binding was changed. No R2 object write occurred.

Preview runtime remains NOT_CONFIGURED for `SUPABASE_STAGING`; the previous read-only probe still represents runtime state: root 200, session `configured=false`, unauth RPC 400, media route 404, object write NONE.

## Runtime provisioning plan

Core Preview-only configuration after exact Preview origin verification:

Text/runtime values:

- `APP_ORIGIN` = exact stable Preview origin, no trailing slash
- `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING`
- `CODE1_STAGING_PROJECT_REF=bsintmkyhptizrjoizfb`
- `CODE1_SUPABASE_URL=https://bsintmkyhptizrjoizfb.supabase.co`

Server-only secrets:

- `CODE1_SUPABASE_SERVICE_ROLE_KEY` = CODE1 STAGING service-role credential only
- `SESSION_SECRET` = newly generated staging-only 32+ character secret
- `CODE1_LOGIN_IP_SECRET` = newly generated staging-only 32+ character secret
- `CODE1_UPLOAD_TOKEN_SECRET` = newly generated staging-only 32+ character secret
- `CODE1_MEDIA_TOKEN_SECRET` = newly generated staging-only 32+ character secret

Existing binding:

- `CODE1_MEDIA_BUCKET -> code1-staging-media` — already VERIFIED; do not add a duplicate text variable.

Auth/legacy compatibility is intentionally deferred until explicitly needed:

- `PASSWORD_PEPPER` must not be randomly regenerated if imported ID/password credentials are expected to remain valid; current password hashes depend on the existing pepper. Preserve the correct existing pepper or use a separately approved staging password-reset path.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are needed only when enabling OWNER Google recovery in Preview; they are not required for the first core runtime/read-only R2 probe.
- `BRIDGE_URL` / `BRIDGE_SECRET` are required only for legacy deck/DECK fallback paths in the current staging routing; do not inject Production/live bridge secrets into staging by assumption.

No secret value is committed to Git or written to the Message Bus.

## Cross-track sync correction

The prior CODING harness text incorrectly treated `MSG-20260912-0017` as a CODING outbound message. Bus readback proves that global ID is already `PLANNING -> UIUX / LONG_FORM_WORK_ORDER_AVAILABLE` and is unrelated to CODING.

Correct state:

- `MSG-20260912-0016`: CODING -> PLANNING implementation evidence, APPLIED by Planning at 2026-09-12 02:58.
- `MSG-20260912-0017`: PLANNING -> UIUX long-form work order, PENDING; not a CODING message.
- prior CODING status events that claimed 0016 was superseded by CODING 0017 are bookkeeping errors and are corrected append-only in the Bus.
- `MSG-20260912-0018`: new CODING -> PLANNING PENDING implementation evidence for exact branch-control PASS plus Preview inventory PASS and Preview-origin next gate.
- current CODING inbound: 0.

## NEXT_ATOMIC_ACTION

Read only the exact stable Preview origin before provisioning any variable/secret:

1. In Cloudflare Pages `code1-workspace`, open **Deployments**.
2. Find the latest successful **Preview** deployment whose branch is exactly `coding/runtime-backend-staging`.
3. Open that deployment and capture the displayed Preview deployment URL / branch alias / environment identifier.
4. Do not click Retry deployment, Rollback, Promote, or any deployment mutation.
5. Do not add variables or secrets yet.

The origin must be an HTTPS non-Production `*.code1-workspace.pages.dev` origin accepted by the repository verifier; do not guess it from the branch name.

After exact origin verification, provision only the approved core Preview values/secrets above, intentionally deploy one Preview, rerun `verify-pages-preview-readonly.mjs`, and only after PASS run actual R2 single/multipart/HEAD/DB/private-GET/denial/retry integration tests.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: wait for runnable R2-backed staging
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
