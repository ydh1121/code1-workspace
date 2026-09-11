# CODE1 CODING CURRENT

Updated: 2026-09-12 04:18 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ORIGIN PASS / PREVIEW CORE ENV PASS / CONTROLLED PREVIEW DEPLOY PASS / PREVIEW READONLY HTTP PASS / ACTUAL R2 INTEGRATION NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0022

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- No force push/history rewrite; do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credential.
- Production variables/secrets/bindings remain READ_ONLY.
- No secret value may be committed to Git, Message Bus, Drive documents, or chat.

## Durable staging state before external R2 integration

Supabase STAGING ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE. Pre-integration verified counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; Drive originals remain preserved. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media` remains private. Before the integration run it is APAC / Standard, 0 objects / 0 B, `r2.dev` disabled, no custom domain, no lock rule, default multipart abort after 7 days, CORS absent/code 10059. No R2 object write had occurred through the completed read-only gate.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. Begin/chunk/finish, 6 MiB multipart, idempotency/retry/finalize, HEAD size/MIME verification, and small-upload orphan compensation are implemented.

## Pages isolation/runtime gates: PASS

Saved/reopened branch control:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

Preview R2 binding:

```text
CODE1_MEDIA_BUCKET -> code1-staging-media
```

Production R2 binding: NONE.

Stable Preview origin:

`https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

The Preview environment contains exactly these nine runtime names, all stored as encrypted Secret entries by the current Pages UI and accepted as `context.env` bindings:

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

Deferred remains `PASSWORD_PEPPER`, Google OAuth vars, and `BRIDGE_URL/BRIDGE_SECRET`. Password-login compatibility is therefore NOT part of the current R2 integration proof.

## Controlled Preview deployment: PASS

Exactly one intended post-provisioning Preview deployment was triggered by commit:

`84ef7ed379c0a568544536b89039a0b335b681b1`

Cloudflare operator evidence shows branch `coding/runtime-backend-staging`, status SUCCESS, with the stable alias unchanged. No retry/rollback/promote occurred.

GitHub staging CI run `34637185378` also completed SUCCESS.

## Preview read-only HTTP verification: PASS

Operator executed:

```powershell
node backend/staging/scripts/verify-pages-preview-readonly.mjs --base-url https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

Observed result:

```text
ROOT_GET = 200
SESSION_GET = 200 {configured:true, authenticated:false, googleEnabled:false}
RPC_UNAUTH_BOOTSTRAP = 401 UNAUTHENTICATED
MEDIA_BINDING_PROBE = 403 FORBIDDEN
PREVIEW_READONLY_VERIFY=PASS
OBJECT_WRITE=NONE
REMOTE_MUTATION=NONE
```

This proves the freshly deployed Preview is runtime-configured for the isolated staging path, enforces unauthenticated fail-closed behavior, and exposes the R2-backed media route without performing an object write.

## Guarded external R2 integration runner: READY

Added:

- `backend/staging/scripts/integrate-pages-r2-staging.mjs`
- `backend/staging/scripts/run-pages-r2-integration.ps1`

The Node runner commit `1bef88f9ecaa0ba8dc929e3492c0a4b13d09a988` passed CI run `34637938259` SUCCESS. Latest staging CI coverage commit `fa9b1fc6fb501a91ab9b0c69b7e28a4ebac0a488` also passes syntax/unit/root-baseline/build and parses all staging PowerShell wrappers.

The runner is fail-closed to branch `coding/runtime-backend-staging`, refuses the Production Pages host, and requires explicit `--confirm-staging-r2-write`. The PowerShell wrapper reads Preview `SESSION_SECRET` via hidden SecureString input and clears it after the child process; the secret is not an argument, Git value, Bus value, or chat value.

Planned integration scope:

1. locally sign a short staging session for active `OWNER` session version 2;
2. authenticated bootstrap must report `SUPABASE_STAGING`;
3. actual 128 KiB small R2 PUT + same-request retry idempotency;
4. private read + exact byte/hash verification + tampered-token 403;
5. actual 11 MiB multipart upload in 6 MiB + 5 MiB parts;
6. begin/chunk/finish retry idempotency;
7. finish HEAD/size/MIME + Supabase finalization/linkage;
8. private multipart GET + exact byte/hash verification;
9. soft-delete test media rows and verify new read-token issuance is denied.

Per current product retention contract, successful test R2 objects are retained privately after DB soft-delete; therefore a full PASS intentionally changes bucket object count from 0 to 2. It does not touch Production, main, or legacy Drive media.

If the integration run fails, do not blindly rerun. Inspect the emitted stage, DB rows, and incomplete multipart state first.

## Cross-track sync

- `MSG-20260912-0019`: CODING -> PLANNING APPLIED, stable Preview origin/provisioning contract.
- `MSG-20260912-0021`: PLANNING -> CODING Local Orchestrator Phase 1 notice ACKED. Per its own instruction, it is deferred until the active Cloudflare/Supabase/R2 atomic work completes.
- `MSG-20260912-0022`: CODING -> PLANNING PENDING, Preview runtime read-only PASS + guarded R2 integration readiness.
- current CODING inbound pending: 0.
- current CODING outbound pending: 1.

## NEXT_ATOMIC_ACTION

Run exactly one guarded external integration pass from the operator PC after pulling the latest branch:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
powershell -NoProfile -ExecutionPolicy Bypass -File backend/staging/scripts/run-pages-r2-integration.ps1
```

At the hidden prompt, paste the exact Preview `SESSION_SECRET` currently configured in Cloudflare. Do not paste it into chat or command history.

Expected top-level success marker:

`R2_STAGING_INTEGRATION=PASS`

After the operator output is reviewed, independently verify Supabase test-row/event state and Cloudflare R2 object inventory before closing the R2 integration gate.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: wait until R2 integration is verified
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement
- Local Orchestrator Phase 1: ACKED but deferred until current R2 atomic work completes

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
