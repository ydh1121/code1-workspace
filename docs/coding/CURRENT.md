# CODE1 CODING CURRENT

Updated: 2026-09-12 05:08 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ORIGIN PASS / PREVIEW CORE ENV PASS / CONTROLLED PREVIEW DEPLOY PASS / PREVIEW READONLY HTTP PASS / ACTUAL R2 INTEGRATION PASS / SUPABASE POST-INTEGRATION VERIFY PASS / R2 INVENTORY READBACK PASS / RUNTIME SEMANTICS HARDENING ACTIVE
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0025

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- No force push/history rewrite; do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credential.
- Production variables/secrets/bindings remain READ_ONLY.
- No secret value may be committed to Git, Message Bus, Drive documents, or chat.
- Local Orchestrator work is OUT OF SCOPE for this CODING chat/track. It runs only in the separate ORCHESTRATOR track per `MSG-20260912-0024/0025`.

## Durable staging state

Supabase STAGING ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE.

Imported legacy media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; Drive originals remain preserved. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media` remains private, with `r2.dev` disabled, no custom domain, and no legacy media migration.

Upload runtime supports begin/chunk/finish, 6 MiB multipart, request idempotency/retry/finalize, HEAD verification, private GET, and small-upload orphan compensation.

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

Preview environment runtime-name set:

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

Deferred remains `PASSWORD_PEPPER`, Google OAuth vars, and `BRIDGE_URL/BRIDGE_SECRET`.

## Controlled Preview deployment + read-only gate: PASS

Controlled post-provisioning Preview deployment commit:

`84ef7ed379c0a568544536b89039a0b335b681b1` -> SUCCESS

Read-only verifier result:

```text
ROOT_GET = 200
SESSION_GET = 200 {configured:true, authenticated:false, googleEnabled:false}
RPC_UNAUTH_BOOTSTRAP = 401 UNAUTHENTICATED
MEDIA_BINDING_PROBE = 403 FORBIDDEN
PREVIEW_READONLY_VERIFY=PASS
OBJECT_WRITE=NONE
REMOTE_MUTATION=NONE
```

## Actual external R2 integration: PASS

Operator ran the guarded Preview-only integration once. Observed result:

```text
SIGNED_SESSION=PASS
bootstrapBackend=SUPABASE_STAGING
SMALL_PUT=PASS mediaId=M_32c63189358249c2844869a4 bytes=131072
SMALL_PUT_RETRY_IDEMPOTENT=PASS
SMALL_PRIVATE_GET=PASS
TAMPERED_MEDIA_TOKEN_DENIAL=PASS
MULTIPART_BEGIN=PASS mediaId=M_6132c51925d449b2b5b2e402 bytes=11534336
MULTIPART_BEGIN_RETRY_IDEMPOTENT=PASS
MULTIPART_CHUNK1=PASS
MULTIPART_CHUNK_RETRY_IDEMPOTENT=PASS
MULTIPART_CHUNK2=PASS
MULTIPART_FINISH_HEAD_DB=PASS
MULTIPART_FINISH_RETRY_IDEMPOTENT=PASS
MULTIPART_PRIVATE_GET=PASS
DB_LINKAGE=PASS
R2_STAGING_INTEGRATION=PASS
SOFT_DELETE=PASS (2 rows)
DELETED_NEW_READ_ISSUANCE_DENIAL=PASS (2 rows)
PRODUCTION_MUTATION=NONE
LEGACY_DRIVE_MUTATION=NONE
```

Independent Supabase SQL readback verified both test rows are `DELETED`, `R2_PRIVATE`, exact expected sizes/received bytes, and each has one `UPLOADED` + one `SOFT_DELETED` event.

## Independent R2 inventory close: PASS

Operator read-only verifier result:

```text
BUCKET_OBJECT_COUNT=2
BUCKET_SIZE_REPORTED=11.7 MB
OBJECT_READ=PASS mediaId=M_32c63189358249c2844869a4 bytes=131072
OBJECT_READ=PASS mediaId=M_6132c51925d449b2b5b2e402 bytes=11534336
VERIFIED_OBJECT_TOTAL_BYTES=11665408
EXPECTED_OBJECTS=2
R2_INVENTORY_READONLY_VERIFY=PASS
REMOTE_MUTATION=NONE
```

Therefore the external `Pages Preview -> Supabase STAGING -> private R2` integration gate is CLOSED PASS. Exactly two intentional private test objects exist; unexpected objects = 0; legacy Drive migration = 0; Production mutation = 0.

Do not rerun the integration merely to re-prove the same gate.

## Planning scope correction: APPLIED LOCALLY

Latest Planning inbound is `MSG-20260912-0025` (`SCOPE_CORRECTION`, P0):

- do NOT execute Local Orchestrator in CODING;
- prior CODING-targeted orchestrator order `MSG-20260912-0021` is superseded;
- dedicated Orchestrator work is `MSG-20260912-0024` in the separate ORCHESTRATOR chat/track;
- CODING continues Cloudflare Preview/Supabase/R2/runtime-backend work unchanged.

This CURRENT follows that routing. No Orchestrator implementation belongs in this branch's current CODING atomic path.

## Runtime semantics hardening: NOT_FOUND -> 404

The completed R2 integration exposed one response-semantics defect: requesting a soft-deleted media item correctly denied access but surfaced generic HTTP 400 `REQUEST_FAILED` because `NOT_FOUND` was not in the shared failure map.

Staging-only correction:

- `functions/_shared/security.js`: exact `NOT_FOUND` now maps to HTTP 404 + stable `error=NOT_FOUND`.
- unknown/unmapped runtime failures remain generic HTTP 400 `REQUEST_FAILED`.
- unit regression `backend/staging/test/http-failure-mapping.test.mjs` added.
- read-only Preview E2E verifier `backend/staging/scripts/verify-deleted-media-not-found.mjs` added for the two already-soft-deleted test media IDs.
- commit `f79e11045a92c5dbe667c7860e74b61faf8073e5` CI `34642527599` SUCCESS.
- verifier commit `1f276ac2f9d6c8b26f74ec40ee71ce6768a75a53` CI `34642626295` SUCCESS.
- all related commits so far used `[CF-Pages-Skip]`; live Preview has not yet received this 404 mapping.

## Local input preference

Do not use clipboard-dependent secret instructions and do not use hidden/SecureString prompts for future local operator steps. If a local secret must be entered, use ordinary visible input; avoid asking for secret input when technically unnecessary. Never put the value in chat or durable project documents.

## Cross-track sync

- `MSG-20260912-0019`: CODING -> PLANNING APPLIED.
- `MSG-20260912-0022`: CODING -> PLANNING APPLIED.
- `MSG-20260912-0021`: superseded orchestrator-in-CODING order; DO NOT EXECUTE here.
- `MSG-20260912-0024`: canonical ORCHESTRATOR-only work order; separate track/chat.
- `MSG-20260912-0025`: PLANNING -> CODING P0 scope correction; consumed by this CURRENT/BATON update and should be marked APPLIED in Bus after durable refs are written.

## NEXT_ATOMIC_ACTION

1. Trigger exactly one controlled Preview deployment containing the `NOT_FOUND -> 404` mapping and its verifier. Do not alter Preview env/bindings or Production.
2. After deployment SUCCESS, run the read-only deleted-media verifier against the stable Preview alias. It must prove both known soft-deleted media IDs return `HTTP 404 / error=NOT_FOUND` with `REMOTE_MUTATION=NONE / R2_OBJECT_WRITE=NONE`.
3. If PASS, close this runtime-semantics defect and continue the existing runtime-backend stabilization queue. The next likely runnable technical item is same-action staging latency measurement (`p50/p95`), but do not promote or optimize before the 404 live verification is closed.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`.
- stale source duplicate rows 501-512: separate Planning/data decision.
- same-action p50/p95: eligible after current 404 verification.
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement.
- Local Orchestrator: separate ORCHESTRATOR track only; not a CODING next action.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
